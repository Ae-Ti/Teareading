import { expect, test } from "@playwright/test";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { MAPS } from "@/lib/space/map";
import { ANON_KEY, SUPABASE_URL, login, makeUser, userClient } from "./seed";

// 고도화 시험 3: 찻집 실시간 채널 권한. 브라우저 없이 API를 직접 쓰는 사람을 흉내 낸다.
// 화면 크기와 무관해 desktop에서만 실행한다.
// 사람마다 개인 채널(본인만 보냄)을 쓰는 구조: supabase/migrations/20261113000100_space_user_topics.sql
test.skip(({ isMobile }) => isMobile, "브라우저와 무관한 시험");

function join(channel: RealtimeChannel, ms = 8_000) {
  return new Promise<string>((resolve) => {
    const timer = setTimeout(() => resolve("TIMEOUT"), ms);
    channel.subscribe((s) => {
      if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "CLOSED") {
        clearTimeout(timer);
        resolve(s);
      }
    });
  });
}

test("찻집 채널: 손님은 못 들어오고, 로그인 회원만 들어온다", async () => {
  const guest = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });
  const g = guest.channel("space:teahouse", { config: { private: true } });
  expect(await join(g)).not.toBe("SUBSCRIBED");
  await guest.removeAllChannels();

  // 공개 채널 이름을 그대로 써도 비공개 채널의 대화는 들을 수 없다
  const member = await userClient(await makeUser("채널"));
  await member.realtime.setAuth();
  const m = member.channel("space:teahouse", { config: { private: true } });
  expect(await join(m)).toBe("SUBSCRIBED");

  const heard: unknown[] = [];
  const pub = guest
    .channel("space:teahouse")
    .on("broadcast", { event: "state" }, (p) => heard.push(p));
  await join(pub);
  await m.send({
    type: "broadcast",
    event: "state",
    payload: { user_id: "x", message: "비공개 채널 말" },
  });
  await new Promise((r) => setTimeout(r, 1_500));
  expect(heard).toEqual([]);
  await guest.removeAllChannels();
  await member.removeAllChannels();
});

test("허용 목록 밖의 채널 이름(space:아무거나)은 로그인해도 못 들어간다", async () => {
  const member = await userClient(await makeUser("채널2"));
  await member.realtime.setAuth();
  for (const topic of ["space:secret", "space:room:abc", "dm:anything"]) {
    const c = member.channel(topic, { config: { private: true } });
    expect(await join(c), topic).not.toBe("SUBSCRIBED");
    await member.removeChannel(c);
  }
});

test("남의 개인 채널로는 보낼 수 없고, 공용 채널에는 Broadcast를 보낼 수 없다", async () => {
  const [attacker, victim, watcher] = await Promise.all([
    makeUser("공격"),
    makeUser("피해"),
    makeUser("관찰"),
  ]);
  const [a, v, w] = await Promise.all([
    userClient(attacker),
    userClient(victim),
    userClient(watcher),
  ]);
  for (const c of [a, v, w]) await c.realtime.setAuth();
  const topic = `space:teahouse:u:${victim.id}`;
  const got: string[] = [];
  const wc = w
    .channel(topic, { config: { private: true } })
    .on("broadcast", { event: "state" }, ({ payload }) =>
      got.push(payload.message),
    )
    .on("presence", { event: "sync" }, () => {
      for (const m of Object.values(wc.presenceState()).flat())
        got.push(`presence:${(m as { who?: string }).who}`);
    });
  const vc = v.channel(topic, { config: { private: true } });
  const ac = a.channel(topic, { config: { private: true } });
  expect(await join(wc)).toBe("SUBSCRIBED");
  expect(await join(vc)).toBe("SUBSCRIBED");
  expect(await join(ac)).toBe("SUBSCRIBED"); // 듣기는 누구나

  // 대조군: 채널 주인 본인의 말은 도착한다 (채널이 준비됐는지도 확인)
  await expect(async () => {
    await vc.send({
      type: "broadcast",
      event: "state",
      payload: { message: "본인" },
    });
    expect(got).toContain("본인");
  }).toPass({ timeout: 15_000, intervals: [500, 1_000] });

  await ac.send({
    type: "broadcast",
    event: "state",
    payload: { message: "위조" },
  });
  expect(await ac.track({ who: "공격자" })).not.toBe("ok");
  const token = (await a.auth.getSession()).data.session!.access_token;
  for (const isPrivate of [true, false])
    await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            topic,
            event: "state",
            payload: { message: "위조-http" },
            private: isPrivate,
          },
        ],
      }),
    });

  // 공용 채널에는 Broadcast를 보낼 수 없다
  const heard: string[] = [];
  const lobbyW = w
    .channel("space:teahouse", { config: { private: true } })
    .on("broadcast", { event: "state" }, ({ payload }) =>
      heard.push(payload.message),
    );
  const lobbyA = a.channel("space:teahouse", { config: { private: true } });
  expect(await join(lobbyW)).toBe("SUBSCRIBED");
  expect(await join(lobbyA)).toBe("SUBSCRIBED");
  await lobbyA.send({
    type: "broadcast",
    event: "state",
    payload: { message: "공용 위조" },
  });

  await new Promise((r) => setTimeout(r, 2_500));
  for (const c of [a, v, w]) await c.removeAllChannels();
  // 대조군은 다시 보내며 기다려 여러 번 올 수 있다. 그 밖의 것은 하나도 오면 안 된다.
  expect(got.filter((m) => m !== "본인")).toEqual([]);
  expect(heard).toEqual([]);
});

test("찻집 화면: 공용 채널에 남의 이름으로 들어온 척해도, 가짜 닉네임을 올려도 그대로 보이지 않는다", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const [observer, attacker, victim] = await Promise.all([
    makeUser("관찰자"),
    makeUser("공격자"),
    makeUser("피해자"),
  ]);
  await login(page, observer, "/space");
  await page.getByRole("button", { name: "찻집 입장" }).click();
  await expect(page.getByRole("button", { name: "나가기" })).toBeVisible({
    timeout: 15_000,
  });

  // 공격자 연결 1: 공용 채널에 피해자 id로 "여기 있다"고 알린다
  const fake = await userClient(attacker);
  await fake.realtime.setAuth();
  const lobbyFake = fake.channel("space:teahouse", {
    config: { private: true, presence: { key: victim.id } },
  });
  expect(await join(lobbyFake)).toBe("SUBSCRIBED");
  expect(await lobbyFake.track({ user_id: victim.id })).toBe("ok");

  // 공격자 연결 2: 자기 이름으로 들어오되, 상태에는 피해자 닉네임을 적는다
  const own = await userClient(attacker);
  await own.realtime.setAuth();
  const lobbyOwn = own.channel("space:teahouse", {
    config: { private: true, presence: { key: attacker.id } },
  });
  const mine = own.channel(`space:teahouse:u:${attacker.id}`, {
    config: { private: true, presence: { key: attacker.id } },
  });
  expect(await join(mine)).toBe("SUBSCRIBED");
  expect(await join(lobbyOwn)).toBe("SUBSCRIBED");
  expect(
    await mine.track({
      user_id: victim.id,
      nickname: victim.nickname,
      avatar_url: null,
      entered_at: new Date().toISOString(),
      timer: null,
      pos: MAPS.teahouse.spawn,
      dir: "up",
      seat: null,
      message: null,
    }),
  ).toBe("ok");
  expect(await lobbyOwn.track({ user_id: attacker.id })).toBe("ok");

  // 공격자는 자기 DB 닉네임으로 한 명만 보이고, 피해자는 보이지 않는다
  await expect(
    page.locator(".space-label", { hasText: attacker.nickname }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("1명과 함께 있어요")).toBeVisible();
  await expect(
    page.locator(".space-label", { hasText: victim.nickname }),
  ).toHaveCount(0);

  // 공격자가 나가면 사라진다
  await own.removeAllChannels();
  await expect(
    page.locator(".space-label", { hasText: attacker.nickname }),
  ).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByText("혼자 있어요")).toBeVisible();
  await fake.removeAllChannels();
});

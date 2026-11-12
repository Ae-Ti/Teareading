import { expect, test } from "@playwright/test";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { ANON_KEY, SUPABASE_URL, makeUser, userClient } from "./seed";

// 고도화 시험 3: 찻집 실시간 채널 권한. 브라우저 없이 API를 직접 쓰는 사람을 흉내 낸다.
// 한 번만 돌면 되므로 desktop에서만 실행한다.
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

test.fail(
  "알려진 문제: 로그인 회원이 다른 사람인 척 위치·상태 메시지를 보낼 수 있다",
  async () => {
    // 고치면 이 시험이 통과해 test.fail이 실패로 바뀐다 → 그때 test.fail을 지운다
    const [attacker, victim, watcher] = await Promise.all([
      makeUser("공격"),
      makeUser("피해"),
      makeUser("관찰"),
    ]);
    const a = await userClient(attacker);
    const w = await userClient(watcher);
    await a.realtime.setAuth();
    await w.realtime.setAuth();
    const got: { user_id?: string; message?: string }[] = [];
    const wc = w
      .channel("space:teahouse", { config: { private: true } })
      .on("broadcast", { event: "state" }, ({ payload }) => got.push(payload));
    const ac = a.channel("space:teahouse", { config: { private: true } });
    expect(await join(wc)).toBe("SUBSCRIBED");
    expect(await join(ac)).toBe("SUBSCRIBED");
    // 대조군: 자기 이름으로 보낸 말이 도착할 때까지 기다려 채널이 준비됐는지 확인한다
    await expect(async () => {
      await ac.send({
        type: "broadcast",
        event: "state",
        payload: { user_id: attacker.id, message: "대조" },
      });
      expect(got.some((p) => p.user_id === attacker.id)).toBe(true);
    }).toPass({ timeout: 15_000, intervals: [500, 1_000] });
    await ac.send({
      type: "broadcast",
      event: "state",
      payload: {
        user_id: victim.id,
        pos: { x: 1, y: 1 },
        dir: "down",
        seat: null,
        message: "피해자인 척",
      },
    });
    await new Promise((r) => setTimeout(r, 2_000));
    await a.removeAllChannels();
    await w.removeAllChannels();
    // 서버가 남의 user_id로 보낸 메시지를 전달하지 않아야 한다
    expect(got.filter((p) => p.user_id === victim.id)).toEqual([]);
  },
);

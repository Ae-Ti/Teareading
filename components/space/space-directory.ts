import type {
  REALTIME_SUBSCRIBE_STATES,
  RealtimeChannel,
  SupabaseClient,
} from "@supabase/supabase-js";
import type { MapId } from "@/lib/space/map";
import {
  MOVE_EVENT,
  spaceChannel,
  STATE_EVENT,
  userChannel,
  type MoveMessage,
  type SpacePresence,
  type StateMessage,
} from "./presence";

// 한 공간에서 동시에 따라가는 사람 수 상한 (꾸민 공용 Presence로 채널을 많이 열게 하는 것을 막는다)
const MAX_PEOPLE = 40;

type Handlers = {
  /** 본인 채널에서 확인한 상태. null이면 나갔다. user_id는 채널 이름에서 정한다. */
  onState: (userId: string, state: SpacePresence | null) => void;
  onLive: (userId: string, msg: StateMessage) => void;
  onMove: (userId: string, msg: MoveMessage) => void;
  onStatus?: (status: `${REALTIME_SUBSCRIBE_STATES}`) => void;
};

/**
 * 공간에 누가 있는지 따라간다 (20261113000100_space_user_topics.sql).
 * - 공용 채널 space:{공간}의 Presence는 "누가 있다"는 힌트일 뿐이라 누구나 꾸밀 수 있다.
 * - 그래서 사람마다 개인 채널 space:{공간}:u:{id}를 따로 듣고, 그 채널에 본인이 올린 상태만 믿는다.
 *   개인 채널에는 본인만 보낼 수 있으므로 메시지 안의 user_id는 보지 않고 채널 주인으로 정한다.
 */
export class SpaceDirectory {
  private lobby: RealtimeChannel;
  private people = new Map<string, RealtimeChannel>();
  private stopped = false;

  constructor(
    private supabase: SupabaseClient,
    private mapId: MapId,
    private me: string | null,
    private handlers: Handlers,
  ) {
    this.lobby = supabase.channel(spaceChannel(mapId), {
      config: {
        private: true,
        ...(me ? { presence: { key: me } } : {}),
      },
    });
    this.lobby.on("presence", { event: "sync" }, () => this.follow());
  }

  /** 비공개 채널은 로그인 토큰이 있어야 해서, 토큰을 넘긴 뒤 연결한다 */
  start() {
    void this.supabase.realtime.setAuth().finally(() => {
      if (!this.stopped)
        this.lobby.subscribe((s) => this.handlers.onStatus?.(s));
    });
  }

  /** 공용 채널에 "나 여기 있다"만 알린다. 위치·이름 같은 상태는 개인 채널로 보낸다. */
  announce() {
    if (!this.me) return Promise.resolve("error" as const);
    return this.lobby.track({ user_id: this.me });
  }

  hide() {
    return this.lobby.untrack();
  }

  /** 공용 Presence에 있는 사람 (꾸며졌을 수 있다) */
  hinted() {
    return Object.keys(this.lobby.presenceState()).filter(
      (id) => id !== this.me,
    );
  }

  stop() {
    this.stopped = true;
    for (const ch of this.people.values()) void this.supabase.removeChannel(ch);
    this.people.clear();
    void this.supabase.removeChannel(this.lobby);
  }

  private follow() {
    const ids = new Set(this.hinted().slice(0, MAX_PEOPLE));
    for (const [id, ch] of this.people) {
      if (ids.has(id)) continue;
      void this.supabase.removeChannel(ch);
      this.people.delete(id);
      this.handlers.onState(id, null);
    }
    for (const id of ids) {
      if (this.people.has(id)) continue;
      const ch = this.supabase.channel(userChannel(this.mapId, id), {
        config: { private: true },
      });
      ch.on("presence", { event: "sync" }, () => {
        // 개인 채널에는 본인만 Presence를 올릴 수 있다. 탭이 여럿이면 첫 번째 것을 쓴다.
        const meta = Object.values(ch.presenceState<SpacePresence>()).flat()[0];
        this.handlers.onState(id, meta ? { ...meta, user_id: id } : null);
      })
        .on("broadcast", { event: STATE_EVENT }, ({ payload }) => {
          this.handlers.onLive(id, {
            ...(payload as StateMessage),
            user_id: id,
          });
        })
        .on("broadcast", { event: MOVE_EVENT }, ({ payload }) => {
          this.handlers.onMove(id, {
            ...(payload as MoveMessage),
            user_id: id,
          });
        })
        .subscribe();
      this.people.set(id, ch);
    }
  }
}

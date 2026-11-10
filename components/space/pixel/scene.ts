// 찻집 장면: 캐릭터 이동·애니메이션·카메라·그리기. React 바깥에서 requestAnimationFrame으로 돈다.

import type { Look } from "@/lib/space/look";
import {
  seatAt,
  TILE,
  type Dir,
  type GameMap,
  type Point,
} from "@/lib/space/map";
import { dirBetween } from "@/lib/space/path";
import { CHAR_H, CHAR_W, characterSprite, type Pose } from "./character";
import { drawGround, propsFor, type Decor } from "./tiles";

// 한 칸 걷는 시간 (약 초당 4칸)
export const STEP_MS = 240;
const FADE_MS = 180;

type Entity = {
  id: string;
  look: Look;
  tile: Point; // 지금 서 있거나 떠나온 칸
  next: Point | null; // 걷는 중이면 향하는 칸
  progress: number; // 0~1
  path: Point[];
  dir: Dir;
  sitting: boolean;
  steps: number;
  isMe: boolean;
  label: HTMLDivElement;
  name: string;
  status: string;
  message: string | null;
};

export type SceneEvents = {
  onTap: (tile: Point) => void;
  onArrive: (tile: Point, dir: Dir) => void;
};

export class TeahouseScene {
  private ctx: CanvasRenderingContext2D;
  private ground: HTMLCanvasElement;
  private entities = new Map<string, Entity>();
  private raf = 0;
  private last = 0;
  private scale = 2;
  private cssW = 0;
  private cssH = 0;
  private dpr = 1;
  private cam = { x: 0, y: 0 };
  private offset = { x: 0, y: 0 };
  private marker: { tile: Point; t: number } | null = null;
  private resize: ResizeObserver;
  private props: ReturnType<typeof propsFor>;
  private places: { el: HTMLSpanElement; x: number; y: number }[] = [];
  private fade: { t: number; out: boolean; done?: () => void } | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private overlay: HTMLDivElement,
    private map: GameMap,
    private decor: Decor | undefined,
    private events: SceneEvents,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.ground = drawGround(map, decor);
    this.props = propsFor(map, decor);
    this.makePlaces();
    this.resize = new ResizeObserver(() => this.layout());
    this.resize.observe(canvas.parentElement!);
    canvas.addEventListener("pointerdown", this.handlePointer);
    this.layout();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.resize.disconnect();
    this.canvas.removeEventListener("pointerdown", this.handlePointer);
    for (const e of this.entities.values()) e.label.remove();
    this.entities.clear();
    for (const p of this.places) p.el.remove();
  }

  // ─── 맵 ───

  // 맵을 바꾼다. 내 캐릭터만 tile로 옮기고 다른 사람은 지운다.
  setMap(map: GameMap, decor: Decor | undefined, tile: Point, dir: Dir) {
    this.map = map;
    this.decor = decor;
    this.ground = drawGround(map, decor);
    this.props = propsFor(map, decor);
    this.marker = null;
    this.makePlaces();
    for (const e of [...this.entities.values()]) {
      if (!e.isMe) {
        this.remove(e.id);
        continue;
      }
      e.tile = tile;
      e.next = null;
      e.path = [];
      e.progress = 0;
      e.dir = dir;
      e.sitting = false;
    }
    this.layout();
  }

  setDecor(decor: Decor) {
    this.decor = decor;
    this.ground = drawGround(this.map, decor);
    this.props = propsFor(this.map, decor);
  }

  // 화면을 어둡게 한 뒤 done을 부르고 다시 밝힌다 (맵 이동)
  fadeThrough(done: () => void) {
    this.fade = { t: 0, out: true, done };
  }

  private makePlaces() {
    for (const p of this.places) p.el.remove();
    this.places = this.map.places.map((p) => {
      const el = document.createElement("span");
      el.className = "space-label space-label-place";
      el.textContent = p.text;
      this.overlay.appendChild(el);
      return { el, x: p.x, y: p.y };
    });
  }

  // ─── 캐릭터 관리 ───

  upsert(
    id: string,
    opts: {
      look: Look;
      name: string;
      status: string;
      tile?: Point;
      dir?: Dir;
      sitting?: boolean;
      isMe?: boolean;
      message?: string | null;
    },
  ) {
    let e = this.entities.get(id);
    if (!e) {
      const label = document.createElement("div");
      label.className = "space-label";
      this.overlay.appendChild(label);
      e = {
        id,
        look: opts.look,
        tile: opts.tile ?? this.map.spawn,
        next: null,
        progress: 0,
        path: [],
        dir: opts.dir ?? "up",
        sitting: opts.sitting ?? false,
        steps: 0,
        isMe: opts.isMe ?? false,
        label,
        name: "",
        status: "",
        message: null,
      };
      this.entities.set(id, e);
    } else if (opts.tile && !e.next && e.path.length === 0) {
      // 걷고 있지 않을 때만 마지막 위치로 맞춘다 (놓친 이동 보정)
      if (e.tile.x !== opts.tile.x || e.tile.y !== opts.tile.y)
        e.tile = opts.tile;
      if (opts.dir) e.dir = opts.dir;
      if (opts.sitting !== undefined) e.sitting = opts.sitting;
    }
    e.look = opts.look;
    const message = opts.message === undefined ? e.message : opts.message;
    if (
      e.name !== opts.name ||
      e.status !== opts.status ||
      e.message !== message
    ) {
      e.name = opts.name;
      e.status = opts.status;
      e.message = message;
      this.drawLabel(e);
    }
  }

  // 앉아 있는 동안 머리 위에 보이는 상태 메시지
  setMessage(id: string, message: string | null) {
    const e = this.entities.get(id);
    if (!e || e.message === message) return;
    e.message = message;
    this.drawLabel(e);
  }

  private drawLabel(e: Entity) {
    e.label.replaceChildren();
    if (e.message) {
      const m = document.createElement("span");
      m.className = "space-label-message";
      m.textContent = e.message;
      e.label.appendChild(m);
    }
    if (e.status) {
      const s = document.createElement("span");
      s.className = "space-label-status";
      s.textContent = e.status;
      e.label.appendChild(s);
    }
    const n = document.createElement("span");
    n.className = e.isMe
      ? "space-label-name space-label-me"
      : "space-label-name";
    n.textContent = e.name;
    e.label.appendChild(n);
  }

  remove(id: string) {
    const e = this.entities.get(id);
    if (!e) return;
    e.label.remove();
    this.entities.delete(id);
  }

  ids() {
    return [...this.entities.keys()];
  }

  // 다음 경로를 계산할 출발 칸: 걷는 중이면 지금 향하는 칸
  planStart(id: string): Point | null {
    const e = this.entities.get(id);
    if (!e) return null;
    return e.next ?? e.tile;
  }

  isIdle(id: string) {
    const e = this.entities.get(id);
    return !!e && !e.next && e.path.length === 0;
  }

  // from에서 출발하는 경로를 따라 걷게 한다. 위치가 어긋나 있으면 from으로 맞춘다.
  walk(id: string, from: Point, path: Point[], showMarker = false) {
    const e = this.entities.get(id);
    if (!e) return;
    const start = e.next ?? e.tile;
    if (start.x !== from.x || start.y !== from.y) {
      e.tile = from;
      e.next = null;
      e.progress = 0;
    }
    e.sitting = false;
    e.path = [...path];
    if (path.length === 0 && !e.next) this.arrive(e);
    if (showMarker && path.length > 0) {
      this.marker = { tile: path[path.length - 1], t: 0 };
    }
  }

  turn(id: string, dir: Dir) {
    const e = this.entities.get(id);
    if (e && !e.next) {
      e.dir = dir;
      e.sitting = false;
    }
  }

  sit(id: string, dir: Dir) {
    const e = this.entities.get(id);
    if (!e) return;
    e.sitting = true;
    e.dir = dir;
  }

  // ─── 화면 크기 ───

  private layout() {
    const parent = this.canvas.parentElement!;
    const width = parent.clientWidth;
    const worldW = this.map.cols * TILE;
    const worldH = this.map.rows * TILE;
    // 정수 배율: 데스크톱은 맵 전체가, 모바일은 2배로 키우고 카메라가 따라간다
    this.scale = Math.max(2, Math.min(3, Math.floor(width / worldW)));
    const maxH = Math.max(320, Math.round(window.innerHeight * 0.68));
    this.cssW = width;
    this.cssH = Math.min(worldH * this.scale, maxH);
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    this.overlay.style.width = `${this.cssW}px`;
    this.overlay.style.height = `${this.cssH}px`;
  }

  // ─── 입력 ───

  private handlePointer = (ev: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const wx =
      (ev.clientX - rect.left - this.offset.x) / this.scale + this.cam.x;
    const wy =
      (ev.clientY - rect.top - this.offset.y) / this.scale + this.cam.y;
    const tile = { x: Math.floor(wx / TILE), y: Math.floor(wy / TILE) };
    if (
      tile.x < 0 ||
      tile.y < 0 ||
      tile.x >= this.map.cols ||
      tile.y >= this.map.rows
    )
      return;
    this.events.onTap(tile);
  };

  // ─── 매 프레임 ───

  private frame = (now: number) => {
    const dt = Math.min(100, this.last ? now - this.last : 16);
    this.last = now;
    for (const e of this.entities.values()) this.step(e, dt);
    if (this.marker) {
      this.marker.t += dt;
      if (this.marker.t > 900) this.marker = null;
    }
    if (this.fade) {
      this.fade.t += dt;
      if (this.fade.t >= FADE_MS) {
        if (this.fade.out) {
          this.fade.done?.();
          this.fade = { t: 0, out: false };
        } else {
          this.fade = null;
        }
      }
    }
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  private step(e: Entity, dt: number) {
    if (!e.next) {
      const n = e.path.shift();
      if (!n) return;
      e.next = n;
      e.progress = 0;
      e.dir = dirBetween(e.tile, n);
      e.steps++;
    }
    e.progress += dt / STEP_MS;
    if (e.progress >= 1) {
      e.tile = e.next!;
      e.next = null;
      e.progress = 0;
      if (e.path.length === 0) this.arrive(e);
      else this.step(e, 0);
    }
  }

  private arrive(e: Entity) {
    const seat = seatAt(this.map, e.tile.x, e.tile.y);
    if (e.isMe) this.events.onArrive(e.tile, seat ? seat.face : e.dir);
  }

  private pos(e: Entity) {
    const t = e.next
      ? {
          x: e.tile.x + (e.next.x - e.tile.x) * e.progress,
          y: e.tile.y + (e.next.y - e.tile.y) * e.progress,
        }
      : e.tile;
    return { x: t.x * TILE, y: t.y * TILE };
  }

  private pose(e: Entity): Pose {
    if (e.sitting) return "sit";
    if (!e.next) return "stand";
    // 한 칸의 앞 절반은 발을 내딛고, 뒤 절반은 선 자세 (칸마다 좌우 번갈아)
    if (e.progress < 0.5) return e.steps % 2 ? "stepA" : "stepB";
    return "stand";
  }

  private draw() {
    const { ctx, scale, dpr } = this;
    const worldW = this.map.cols * TILE;
    const worldH = this.map.rows * TILE;
    const viewW = this.cssW / scale;
    const viewH = this.cssH / scale;

    // 카메라: 내 캐릭터를 가운데로, 맵 밖은 보이지 않게
    const me = [...this.entities.values()].find((e) => e.isMe);
    const focus = me ? this.pos(me) : { x: worldW / 2, y: worldH / 2 };
    const camX =
      viewW >= worldW
        ? 0
        : clamp(focus.x + TILE / 2 - viewW / 2, 0, worldW - viewW);
    const camY =
      viewH >= worldH
        ? 0
        : clamp(focus.y + TILE / 2 - viewH / 2, 0, worldH - viewH);
    // 픽셀이 번지지 않게 화면 픽셀 단위로 맞춘다
    this.cam = {
      x: Math.round(camX * scale * dpr) / (scale * dpr),
      y: Math.round(camY * scale * dpr) / (scale * dpr),
    };
    this.offset = {
      x: viewW > worldW ? Math.floor((this.cssW - worldW * scale) / 2) : 0,
      y: viewH > worldH ? Math.floor((this.cssH - worldH * scale) / 2) : 0,
    };

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#2c2430";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = false;
    const k = scale * dpr;
    ctx.setTransform(
      k,
      0,
      0,
      k,
      Math.round(this.offset.x * dpr - this.cam.x * k),
      Math.round(this.offset.y * dpr - this.cam.y * k),
    );
    ctx.drawImage(this.ground, 0, 0);

    if (this.marker) this.drawMarker(this.marker.tile, this.marker.t);

    // 앞뒤 정렬: 바닥에 닿는 y가 작은 것부터
    const drawables: { y: number; draw: () => void }[] = this.props.map(
      (p) => ({
        y: p.sortY,
        draw: () => p.draw(ctx),
      }),
    );
    for (const e of this.entities.values()) {
      const p = this.pos(e);
      const sitting = e.sitting;
      drawables.push({
        y: p.y + TILE + (e.isMe ? 0.2 : 0.1),
        draw: () => {
          const sprite = characterSprite(e.look, e.dir, this.pose(e));
          const sx = Math.round(p.x + (TILE - CHAR_W) / 2);
          const sy = Math.round(p.y + TILE - CHAR_H - (sitting ? 1 : 2));
          if (!sitting) {
            ctx.fillStyle = "rgba(44,36,48,0.25)";
            ctx.fillRect(sx + 4, sy + CHAR_H - 2, 8, 2);
            ctx.fillRect(sx + 3, sy + CHAR_H - 1, 10, 1);
          }
          ctx.drawImage(sprite, sx, sy);
        },
      });
    }
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    for (const p of this.places) {
      const lx = this.offset.x + (p.x * TILE + TILE / 2 - this.cam.x) * scale;
      const ly = this.offset.y + (p.y * TILE - this.cam.y) * scale;
      p.el.style.transform = `translate(${Math.round(lx)}px, ${Math.round(ly)}px) translate(-50%, -50%)`;
    }

    if (this.fade) {
      const r = Math.min(1, this.fade.t / FADE_MS);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(44, 36, 48, ${this.fade.out ? r : 1 - r})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // 이름표 위치 (DOM)
    for (const e of this.entities.values()) {
      const p = this.pos(e);
      const lx = this.offset.x + (p.x + TILE / 2 - this.cam.x) * scale;
      const ly =
        this.offset.y +
        (p.y + TILE - CHAR_H - (e.sitting ? 0 : 2) - this.cam.y) * scale;
      e.label.style.transform = `translate(${Math.round(lx)}px, ${Math.round(ly)}px) translate(-50%, -100%)`;
    }
  }

  private drawMarker(tile: Point, t: number) {
    const ctx = this.ctx;
    const x = tile.x * TILE;
    const y = tile.y * TILE;
    const inset = Math.floor((t / 900) * 4);
    const a = 1 - t / 900;
    ctx.fillStyle = `rgba(255, 246, 200, ${a})`;
    const L = 4;
    const x0 = x + inset;
    const y0 = y + inset;
    const x1 = x + TILE - inset;
    const y1 = y + TILE - inset;
    ctx.fillRect(x0, y0, L, 1);
    ctx.fillRect(x0, y0, 1, L);
    ctx.fillRect(x1 - L, y0, L, 1);
    ctx.fillRect(x1 - 1, y0, 1, L);
    ctx.fillRect(x0, y1 - 1, L, 1);
    ctx.fillRect(x0, y1 - L, 1, L);
    ctx.fillRect(x1 - L, y1 - 1, L, 1);
    ctx.fillRect(x1 - 1, y1 - L, 1, L);
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

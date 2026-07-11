import type { Pt } from './types';

export interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * 위상장 등위선을 **단일 연속 나선 폴리라인**으로 추출 (#14).
 *
 * 1) 레벨별로 marching-squares 세그먼트 추출 (θ=0 브랜치컷 셀은 seam guard 로 skip).
 * 2) 각 레벨 세그먼트를 끝점 인접으로 chain → 순서 있는 아크.
 * 3) 아크를 θ 증가 방향으로 정렬.
 * 4) 레벨 오름차순으로, 이전 아크의 끝과 다음 아크의 시작이 가까우면 이어붙여
 *    (seam 가로지름) 하나의 나선 폴리라인으로 만든다.
 *
 * 반환: 폴리라인 배열(각 폴리라인 = 순서 있는 점열). 이상적으로 1개(전체 나선).
 */
export function isoPolylines(
  field: Float32Array,
  w: number,
  h: number,
  min: number,
  max: number,
  center: Pt,
  pitch: number,
): Pt[][] {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);

  // 레벨별 아크 (θ 증가로 정렬), 레벨 오름차순
  const arcs: { level: number; pts: Pt[] }[] = [];
  for (let level = lo; level <= hi; level++) {
    const segs = marchLevel(field, w, h, level);
    for (const poly of chain(segs)) {
      if (poly.length < 2) continue;
      orientByTheta(poly, center);
      arcs.push({ level, pts: poly });
    }
  }

  // 레벨 → (θ 시작) 순 정렬. 같은 레벨 내 아크는 시작 θ 순.
  arcs.sort((a, b) =>
    a.level !== b.level ? a.level - b.level : theta(a.pts[0], center) - theta(b.pts[0], center),
  );

  // 근접 끝점 이어붙이기 (seam·레벨 경계 bridge)
  const bridgeDist = pitch * 1.5;
  const out: Pt[][] = [];
  for (const arc of arcs) {
    const cur = out[out.length - 1];
    if (cur) {
      const tail = cur[cur.length - 1];
      const head = arc.pts[0];
      if (Math.hypot(tail.x - head.x, tail.y - head.y) <= bridgeDist) {
        for (const p of arc.pts) cur.push(p);
        continue;
      }
    }
    out.push(arc.pts.slice());
  }
  return out;
}

function theta(p: Pt, c: Pt): number {
  let t = Math.atan2(p.y - c.y, p.x - c.x);
  if (t < 0) t += 2 * Math.PI;
  return t;
}

/** 아크를 θ 증가 방향(시작 θ작음 → 끝 θ큼)으로 정렬. */
function orientByTheta(pts: Pt[], c: Pt): void {
  if (theta(pts[0], c) > theta(pts[pts.length - 1], c)) pts.reverse();
}

/** 세그먼트를 끝점 인접(0.25px 양자화)으로 연결 → 순서 있는 폴리라인들. */
function chain(segs: Seg[]): Pt[][] {
  const q = (v: number): number => Math.round(v * 4) / 4;
  const key = (x: number, y: number): string => `${q(x)},${q(y)}`;
  const adj = new Map<string, { i: number; end: 0 | 1 }[]>();
  const add = (k: string, i: number, end: 0 | 1): void => {
    const a = adj.get(k);
    if (a) a.push({ i, end });
    else adj.set(k, [{ i, end }]);
  };
  segs.forEach((s, i) => {
    add(key(s.x1, s.y1), i, 0);
    add(key(s.x2, s.y2), i, 1);
  });

  const used = new Array<boolean>(segs.length).fill(false);
  const other = (s: Seg, end: 0 | 1): Pt => (end === 0 ? { x: s.x2, y: s.y2 } : { x: s.x1, y: s.y1 });
  const polys: Pt[][] = [];

  for (let start = 0; start < segs.length; start++) {
    if (used[start]) continue;
    used[start] = true;
    const s0 = segs[start];
    const pts: Pt[] = [{ x: s0.x1, y: s0.y1 }, { x: s0.x2, y: s0.y2 }];
    const extend = (dir: 'f' | 'b'): void => {
      for (;;) {
        const tip = dir === 'f' ? pts[pts.length - 1] : pts[0];
        const cand = (adj.get(key(tip.x, tip.y)) ?? []).filter((a) => !used[a.i]);
        if (cand.length === 0) break;
        const { i, end } = cand[0];
        used[i] = true;
        const np = other(segs[i], end);
        if (dir === 'f') pts.push(np);
        else pts.unshift(np);
      }
    };
    extend('f');
    extend('b');
    polys.push(pts);
  }
  return polys;
}

/** 단일 정수 레벨의 marching-squares 세그먼트 (seam guard 포함). */
function marchLevel(field: Float32Array, w: number, h: number, level: number): Seg[] {
  const segs: Seg[] = [];
  const t = (a: number, b: number): number => (level - a) / (b - a);
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const tl = field[y * w + x];
      const tr = field[y * w + x + 1];
      const br = field[(y + 1) * w + x + 1];
      const bl = field[(y + 1) * w + x];
      const maxDiff = Math.max(
        Math.abs(tl - tr),
        Math.abs(tr - br),
        Math.abs(br - bl),
        Math.abs(bl - tl),
      );
      if (maxDiff > 0.75) continue; // 브랜치컷 seam

      let idx = 0;
      if (tl > level) idx |= 8;
      if (tr > level) idx |= 4;
      if (br > level) idx |= 2;
      if (bl > level) idx |= 1;
      if (idx === 0 || idx === 15) continue;

      const top = { x: x + t(tl, tr), y };
      const right = { x: x + 1, y: y + t(tr, br) };
      const bottom = { x: x + t(bl, br), y: y + 1 };
      const left = { x, y: y + t(tl, bl) };
      const push = (a: Pt, b: Pt): void => {
        segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      };
      switch (idx) {
        case 1: case 14: push(left, bottom); break;
        case 2: case 13: push(bottom, right); break;
        case 3: case 12: push(left, right); break;
        case 4: case 11: push(top, right); break;
        case 5: push(left, top); push(bottom, right); break;
        case 6: case 9: push(top, bottom); break;
        case 7: case 8: push(left, top); break;
        case 10: push(top, right); push(left, bottom); break;
      }
    }
  }
  return segs;
}

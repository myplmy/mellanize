export interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * 스칼라 필드의 정수 레벨 등위선을 marching-squares 로 추출 → 선분 집합.
 * 위상장(§5.A)에 적용하면 각 정수 레벨이 한 나선 턴이 된다.
 *
 * θ=0/2π 브랜치컷에서 n'이 ~1 점프하므로, 인접 코너 차가 0.5 초과인 셀은 건너뛰어
 * seam 을 따라 생기는 가짜 방사 선분을 막는다(얇은 seam 갭은 허용, 후속 개선 대상).
 */
export function isoSegments(
  field: Float32Array,
  w: number,
  h: number,
  min: number,
  max: number,
): Seg[] {
  const segs: Seg[] = [];
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  const t = (a: number, b: number, level: number): number => (level - a) / (b - a);

  for (let level = lo; level <= hi; level++) {
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
        if (maxDiff > 0.5) continue; // 브랜치컷 seam

        let idx = 0;
        if (tl > level) idx |= 8;
        if (tr > level) idx |= 4;
        if (br > level) idx |= 2;
        if (bl > level) idx |= 1;
        if (idx === 0 || idx === 15) continue;

        const top = { x: x + t(tl, tr, level), y };
        const right = { x: x + 1, y: y + t(tr, br, level) };
        const bottom = { x: x + t(bl, br, level), y: y + 1 };
        const left = { x, y: y + t(tl, bl, level) };
        const push = (a: Pt2, b: Pt2): void => {
          segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
        };

        switch (idx) {
          case 1:
          case 14:
            push(left, bottom);
            break;
          case 2:
          case 13:
            push(bottom, right);
            break;
          case 3:
          case 12:
            push(left, right);
            break;
          case 4:
          case 11:
            push(top, right);
            break;
          case 5: // saddle
            push(left, top);
            push(bottom, right);
            break;
          case 6:
          case 9:
            push(top, bottom);
            break;
          case 7:
          case 8:
            push(left, top);
            break;
          case 10: // saddle
            push(top, right);
            push(left, bottom);
            break;
        }
      }
    }
  }
  return segs;
}

interface Pt2 {
  x: number;
  y: number;
}

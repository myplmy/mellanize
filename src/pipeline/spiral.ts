import type { Pt } from './types';

/**
 * 왜곡 없는 아르키메데스 나선 r = a·θ 의 중심축 점열.
 * pitch p = 2πa (인접 턴 반경 간격) → a = p / 2π.
 * 화면 공간에서 대략 균일한 간격(step px)이 되도록 dθ 를 r 에 반비례로 조절한다.
 */
export function archimedes(
  center: Pt,
  pitch: number,
  rMax: number,
  step: number,
  startAngle = 0,
): Pt[] {
  const a = pitch / (2 * Math.PI);
  const pts: Pt[] = [];
  let theta = 0;
  // r = a·θ 가 rMax 를 넘을 때까지. 전체 나선을 startAngle 만큼 회전.
  while (a * theta <= rMax) {
    const r = a * theta;
    const ang = theta + startAngle;
    pts.push({
      x: center.x + r * Math.cos(ang),
      y: center.y + r * Math.sin(ang),
    });
    // 호길이 ds ≈ r·dθ (큰 r) → dθ = step / max(r, a). 초반(작은 r)엔 a 로 하한.
    theta += step / Math.max(r, a);
  }
  return pts;
}

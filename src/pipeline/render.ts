import type { Polyline } from './types';

/**
 * 가변폭 폴리라인 래스터화 (Canvas 2D). 각 폴리라인은 순서 있는 정점열이므로
 * 연속 선으로 그린다. 세그먼트마다 두 정점 두께 평균을 lineWidth 로 → 가변폭.
 * (#14: 무순서 세그먼트 → 정렬 폴리라인으로 전환.)
 */
export function renderPolylines(
  ctx: CanvasRenderingContext2D,
  polylines: Polyline[],
  opts: { background?: string; color?: string } = {},
): void {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = opts.background ?? '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = opts.color ?? '#111111';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const poly of polylines) {
    for (let i = 1; i < poly.length; i++) {
      const a = poly[i - 1];
      const b = poly[i];
      ctx.beginPath();
      ctx.lineWidth = (a.thickness + b.thickness) / 2;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
}

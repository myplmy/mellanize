import type { StrokeSeg } from './types';

/**
 * 가변폭 선분 래스터화 (Canvas 2D). 각 선분을 자기 두께로 그린다. round cap 으로
 * 이어진 선분이 연속 곡선처럼 보인다. (SVG 렌더러는 백엔드 공유로 Slice 9 에 추가.)
 */
export function renderSegments(
  ctx: CanvasRenderingContext2D,
  segs: StrokeSeg[],
  opts: { background?: string; color?: string } = {},
): void {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = opts.background ?? '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = opts.color ?? '#111111';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const s of segs) {
    ctx.beginPath();
    ctx.lineWidth = s.thickness;
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }
}

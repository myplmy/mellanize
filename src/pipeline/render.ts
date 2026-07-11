import type { StrokePoint } from './types';

/**
 * 가변폭 스트로크 래스터화 (Canvas 2D).
 * 인접 점 쌍을 평균 두께의 짧은 선분으로 이어 그린다. round cap 으로 세그먼트가
 * 이어져 연속 가변폭 곡선처럼 보인다. (Slice 9 에서 SVG 렌더러가 백엔드를 공유해 추가됨.)
 */
export function renderStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: StrokePoint[],
  opts: { background?: string; color?: string } = {},
): void {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = opts.background ?? '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = opts.color ?? '#111111';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 1; i < strokes.length; i++) {
    const a = strokes[i - 1];
    const b = strokes[i];
    ctx.beginPath();
    ctx.lineWidth = (a.thickness + b.thickness) / 2;
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

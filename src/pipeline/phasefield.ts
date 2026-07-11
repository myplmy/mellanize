import type { GrayImage, Pt } from './types';

export interface PhaseField {
  field: Float32Array;
  min: number;
  max: number;
}

/**
 * 위상장 턴 좌표 + tone_only 워프 (docs/claude_mellan_pipeline_v2.md §5.A).
 *
 *   n(x,y)  = ρ/p − θ/(2π)          (θ ∈ [0,2π); 기준 나선 = 정수 등위선)
 *   n'(x,y) = n + (λ/p)·α·(I − Ī)   (톤 구동 워프)
 *
 * 간격 자동 변조: 인접 턴 간격 ≈ 1/|∇n'| 이므로 워프가 간격을 이미지로 구동한다.
 */
export function warpedTurnField(
  gray: GrayImage,
  alpha: Float32Array,
  center: Pt,
  pitch: number,
  lambda: number,
): PhaseField {
  const { width: w, height: h, data: I } = gray;
  const p = pitch;
  const TWO_PI = 2 * Math.PI;

  let mean = 0;
  for (let i = 0; i < w * h; i++) mean += I[i];
  mean /= w * h;

  const field = new Float32Array(w * h);
  let min = Infinity;
  let max = -Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - center.x;
      const dy = y - center.y;
      const rho = Math.hypot(dx, dy);
      let th = Math.atan2(dy, dx);
      if (th < 0) th += TWO_PI;
      let n = rho / p - th / TWO_PI;
      n += (lambda / p) * alpha[y * w + x] * (I[y * w + x] - mean);
      field[y * w + x] = n;
      if (n < min) min = n;
      if (n > max) max = n;
    }
  }
  return { field, min, max };
}

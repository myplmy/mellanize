import type { GrayImage, PipelineConfig, Pt } from './types';

export interface PhaseField {
  field: Float32Array;
  min: number;
  max: number;
}

/**
 * 위상장 턴 좌표 + 워프 (docs/claude_mellan_pipeline_v2.md §5.A·§6·§8).
 *
 *   n(x,y)  = ρ/p − (θ−θ₀)/(2π)          (θ₀ = startAngle, 브랜치컷·시작 회전)
 *   n'(x,y) = n + (λ/p)·α·(I − Ī)         (톤 워프)
 *             + (spacing/p)·(dLow − dLowMean)   (tone_plus_spacing: 간격 채널)
 *
 * λ gap cap(#8): λ_eff = min(λ, 0.8·p) 로 워프 진폭 < 0.4턴 → 인접 턴 교차 방지(단조성).
 */
export function warpedTurnField(
  gray: GrayImage,
  alpha: Float32Array,
  cfg: PipelineConfig,
  center: Pt,
  dLow: Float32Array | null,
): PhaseField {
  const { width: w, height: h, data: I } = gray;
  const p = cfg.pitch;
  const TWO_PI = 2 * Math.PI;
  const theta0 = ((cfg.startAngle || 0) * Math.PI) / 180;
  const lambda = Math.min(cfg.lambda, 0.8 * p); // λ gap cap

  let mean = 0;
  for (let i = 0; i < w * h; i++) mean += I[i];
  mean /= w * h;

  const spacing = cfg.toneChannels === 'thickness_plus_spacing' && dLow ? lambda : 0;
  let dLowMean = 0;
  if (spacing && dLow) {
    for (let i = 0; i < w * h; i++) dLowMean += dLow[i];
    dLowMean /= w * h;
  }

  const field = new Float32Array(w * h);
  let min = Infinity;
  let max = -Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const dx = x - center.x;
      const dy = y - center.y;
      const rho = Math.hypot(dx, dy);
      let th = Math.atan2(dy, dx) - theta0;
      th = ((th % TWO_PI) + TWO_PI) % TWO_PI;
      let n = rho / p - th / TWO_PI;
      n += (lambda / p) * alpha[i] * (I[i] - mean);
      if (spacing && dLow) n += (spacing / p) * (dLow[i] - dLowMean);
      field[i] = n;
      if (n < min) min = n;
      if (n > max) max = n;
    }
  }
  return { field, min, max };
}

import type { Gradients } from './derivatives';

/**
 * alpha_source = grad: α₀ = Normalize(|∇I|) 후 Perona-Malik 이방성 확산으로 평활.
 * (docs/claude_mellan_pipeline_v2.md §1·§2). α ∈ [0,1] = "이미지를 얼마나 따를지".
 */
export function gradientAlpha(
  g: Gradients,
  w: number,
  h: number,
  iters: number,
  kappa: number,
): Float32Array {
  const mag = new Float32Array(w * h);
  let max = 0;
  for (let i = 0; i < w * h; i++) {
    const m = Math.hypot(g.ix[i], g.iy[i]);
    mag[i] = m;
    if (m > max) max = m;
  }
  if (max > 0) for (let i = 0; i < w * h; i++) mag[i] /= max;
  return peronaMalik(mag, w, h, iters, kappa);
}

/** Perona-Malik 이방성 확산: 에지 보존하며 평탄부 평활. */
function peronaMalik(
  src: Float32Array,
  w: number,
  h: number,
  iters: number,
  kappa: number,
): Float32Array {
  const dt = 0.2;
  const cond = (s: number): number => 1 / (1 + (s / kappa) * (s / kappa));
  const at = (arr: Float32Array, x: number, y: number): number =>
    arr[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];

  let a = src.slice();
  for (let t = 0; t < iters; t++) {
    const next = a.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = a[y * w + x];
        const dN = at(a, x, y - 1) - c;
        const dS = at(a, x, y + 1) - c;
        const dE = at(a, x + 1, y) - c;
        const dW = at(a, x - 1, y) - c;
        next[y * w + x] =
          c +
          dt *
            (cond(Math.abs(dN)) * dN +
              cond(Math.abs(dS)) * dS +
              cond(Math.abs(dE)) * dE +
              cond(Math.abs(dW)) * dW);
      }
    }
    a = next;
  }
  return a;
}

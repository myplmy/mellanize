import type { OrientationField } from './structureTensor';

/**
 * 이방성 워프 (warp_mode=anisotropic) — `along` 실현.
 *
 * 위상장 n'을 **에지 방향 v₂ 를 따라** 방향성 평활한다. n'이 v₂ 를 따라 상수에
 * 가까워지면 등위선(=선)이 v₂ 를 따라 굴곡한다(∇n'이 v₁ 로 정렬).
 *
 * ⚠️ v2 문서 §5.A 는 확산 텐서를 "D = v₁v₁ᵀ + η v₂v₂ᵀ (v₁ 강)"로 적었으나, 그러면
 * 등위선이 v₁(에지 가로지름)로 서서 목표(∇n'∥v₁, 선∥v₂)와 모순된다. 올바른 방향은
 * **v₂ 를 따라 확산**(v₂ 강). 본 구현·문서는 이를 교정했다.
 *
 * 커버리지 보존: 평활 가중을 coherence A 에 비례시켜, 에지 근처에서만 굴곡하고
 * 평탄부는 나선을 유지한다. 브랜치컷(θ=0) seam 은 |Δ|>0.5 샘플을 배제해 방지.
 */
export function alongSmooth(
  field: Float32Array,
  w: number,
  h: number,
  ori: OrientationField,
  iters: number,
  strength: number,
  reach: number,
): Float32Array {
  const { v2x, v2y, coherence } = ori;

  const sample = (f: Float32Array, x: number, y: number): number => {
    const cx = Math.min(Math.max(x, 0), w - 1);
    const cy = Math.min(Math.max(y, 0), h - 1);
    const x0 = Math.floor(cx);
    const y0 = Math.floor(cy);
    const x1 = Math.min(x0 + 1, w - 1);
    const y1 = Math.min(y0 + 1, h - 1);
    const fx = cx - x0;
    const fy = cy - y0;
    const top = f[y0 * w + x0] + (f[y0 * w + x1] - f[y0 * w + x0]) * fx;
    const bot = f[y1 * w + x0] + (f[y1 * w + x1] - f[y1 * w + x0]) * fx;
    return top + (bot - top) * fy;
  };

  let a = field.slice();
  for (let t = 0; t < iters; t++) {
    const next = a.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const c = a[i];
        const dx = v2x[i] * reach;
        const dy = v2y[i] * reach;
        const ff = sample(a, x + dx, y + dy);
        const fb = sample(a, x - dx, y - dy);
        // seam guard: 브랜치컷 점프(~1)를 평활에 끌어들이지 않음
        const uf = Math.abs(ff - c) <= 0.75 ? ff : c;
        const ub = Math.abs(fb - c) <= 0.75 ? fb : c;
        const avg = (uf + ub + c) / 3;
        const weight = Math.min(1, coherence[i] * strength);
        next[i] = c + weight * (avg - c);
      }
    }
    a = next;
  }
  return a;
}

/** Float32 필드 min/max. */
export function fieldRange(field: Float32Array): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < field.length; i++) {
    const v = field[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

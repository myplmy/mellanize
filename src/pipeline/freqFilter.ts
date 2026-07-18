import { gaussianBlur } from './gaussianBlur';

/**
 * 주파수 필터 (#19). 공간 컨볼루션(Gaussian 차분, DoG) 기반 — FFT 대안은 #37.
 *  - lowpass  : blur(σ)                     (저역만 통과 = 넓은 톤)
 *  - highpass : 0.5 + (I − blur(σ))         (고역만 = 미세 디테일/에지, 0.5 중심 재배치)
 *  - bandpass : 0.5 + (blur(σ_lo) − blur(σ_hi)), σ_lo<σ_hi  (중간 대역)
 * 출력은 [0,1] 클램프. σ 클수록 cutoff 저주파(더 부드럽게 자름).
 */
export type FreqFilter = 'none' | 'lowpass' | 'highpass' | 'bandpass';

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function applyFreqFilter(
  img: Float32Array,
  w: number,
  h: number,
  type: FreqFilter,
  sigma1: number,
  sigma2: number,
): Float32Array {
  if (type === 'none' || sigma1 <= 0) return img;
  const n = w * h;
  const out = new Float32Array(n);
  if (type === 'lowpass') {
    const lo = gaussianBlur(img, w, h, sigma1);
    for (let i = 0; i < n; i++) out[i] = clamp01(lo[i]);
    return out;
  }
  if (type === 'highpass') {
    const lo = gaussianBlur(img, w, h, sigma1);
    for (let i = 0; i < n; i++) out[i] = clamp01(0.5 + (img[i] - lo[i]));
    return out;
  }
  // bandpass
  const lo = gaussianBlur(img, w, h, Math.min(sigma1, sigma2));
  const hi = gaussianBlur(img, w, h, Math.max(sigma1, sigma2));
  for (let i = 0; i < n; i++) out[i] = clamp01(0.5 + (lo[i] - hi[i]));
  return out;
}

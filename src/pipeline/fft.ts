/**
 * FFT 기반 주파수 필터 (#37). Gaussian DoG(freqFilter.ts)의 정밀 대안.
 * 2D radix-2 FFT(자체 구현, 외부 의존 없음) → 주파수 마스크 → 역FFT.
 * 이미지를 2의 거듭제곱으로 edge-clamp 패딩 후 처리(경계 wrap 효과 감수).
 * 마스크 3종 선택: butterworth(order 조절) / ideal(하드 컷) / gaussian.
 */
import type { FreqFilter } from './freqFilter';

export type FftMask = 'butterworth' | 'ideal' | 'gaussian';

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/** in-place 1D radix-2 FFT. off/stride 로 행/열 벡터 지정. sign=-1 정변환, +1 역변환(스케일 미포함). */
function fft1d(re: Float64Array, im: Float64Array, off: number, stride: number, n: number, sign: number): void {
  // 비트 반전 순열
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const ii = off + i * stride;
      const jj = off + j * stride;
      const tr = re[ii];
      re[ii] = re[jj];
      re[jj] = tr;
      const ti = im[ii];
      im[ii] = im[jj];
      im[jj] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (sign * 2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cwr = 1;
      let cwi = 0;
      for (let k = 0; k < half; k++) {
        const a = off + (i + k) * stride;
        const b = off + (i + k + half) * stride;
        const xr = re[b] * cwr - im[b] * cwi;
        const xi = re[b] * cwi + im[b] * cwr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
        const ncwr = cwr * wr - cwi * wi;
        cwi = cwr * wi + cwi * wr;
        cwr = ncwr;
      }
    }
  }
}

function fft2d(re: Float64Array, im: Float64Array, W: number, H: number, sign: number): void {
  for (let y = 0; y < H; y++) fft1d(re, im, y * W, 1, W, sign);
  for (let x = 0; x < W; x++) fft1d(re, im, x, W, H, sign);
}

/** σ(공간 평활 스케일) → 정규화 컷오프 반경. σ 클수록 저주파(작은 반경). */
function radiusFromSigma(sigma: number): number {
  const r = 1 / (Math.PI * Math.max(0.05, sigma));
  return r < 0.005 ? 0.005 : r > 1.5 ? 1.5 : r;
}

/** 저역 응답 L(r; rc) — 마스크별. high = 1−L, band = L(rHi)−L(rLo). */
function lowResp(r: number, rc: number, mask: FftMask, order: number): number {
  if (mask === 'ideal') return r <= rc ? 1 : 0;
  if (mask === 'gaussian') return Math.exp(-(r * r) / (2 * rc * rc));
  return 1 / (1 + Math.pow(r / rc, 2 * Math.max(1, order))); // butterworth
}

function maskValue(
  type: FreqFilter,
  r: number,
  rLo: number,
  rHi: number,
  rc: number,
  mask: FftMask,
  order: number,
): number {
  if (type === 'lowpass') return lowResp(r, rc, mask, order);
  if (type === 'highpass') return 1 - lowResp(r, rc, mask, order);
  // bandpass: rLo..rHi 통과 (rHi>rLo)
  return lowResp(r, rHi, mask, order) - lowResp(r, rLo, mask, order);
}

export function applyFftFilter(
  img: Float32Array,
  w: number,
  h: number,
  type: FreqFilter,
  sigma1: number,
  sigma2: number,
  mask: FftMask,
  order: number,
): Float32Array {
  if (type === 'none') return img;
  const W = nextPow2(w);
  const H = nextPow2(h);
  const re = new Float64Array(W * H);
  const im = new Float64Array(W * H);
  // edge-clamp 패딩
  for (let y = 0; y < H; y++) {
    const sy = Math.min(h - 1, y);
    for (let x = 0; x < W; x++) {
      const sx = Math.min(w - 1, x);
      re[y * W + x] = img[sy * w + sx];
    }
  }
  fft2d(re, im, W, H, -1); // 정변환

  const rc = radiusFromSigma(sigma1);
  const rHi = radiusFromSigma(Math.min(sigma1, sigma2)); // 작은 σ = 큰 반경
  const rLo = radiusFromSigma(Math.max(sigma1, sigma2));
  for (let v = 0; v < H; v++) {
    const fv = (v <= H / 2 ? v : v - H) / H;
    for (let u = 0; u < W; u++) {
      const fu = (u <= W / 2 ? u : u - W) / W;
      const r = Math.hypot(fu, fv);
      const m = maskValue(type, r, rLo, rHi, rc, mask, order);
      const i = v * W + u;
      re[i] *= m;
      im[i] *= m;
    }
  }

  fft2d(re, im, W, H, 1); // 역변환
  const scale = 1 / (W * H);
  const recenter = type === 'highpass' || type === 'bandpass' ? 0.5 : 0; // DC 제거분 재배치
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const val = re[y * W + x] * scale + recenter;
      out[y * w + x] = val < 0 ? 0 : val > 1 ? 1 : val;
    }
  }
  return out;
}

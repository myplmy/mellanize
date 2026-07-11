import type { GrayImage, PipelineConfig } from './types';
import type { Gradients } from './derivatives';
import { secondDerivatives } from './derivatives';
import { meanCurvatureMag, gaussCurvatureMag } from './curvature';

/**
 * α 필드 = "이미지를 얼마나 따를지" 스칼라 (docs/claude_mellan_pipeline_v2.md §1·§2).
 * alpha_source 로 구동 신호 선택 후 Normalize → Perona-Malik 이방성 확산.
 *   grad  : |∇I|          (톤 경사)
 *   meanH : |H|           (평균곡률, 원통형 form 포착)
 *   mixed : w_g|∇I|+w_H|H|+w_K|K| 가중합
 */
export function computeAlpha(gray: GrayImage, grad: Gradients, cfg: PipelineConfig): Float32Array {
  const n = gray.width * gray.height;
  let s: Float32Array;

  if (cfg.alphaSource === 'grad') {
    s = gradMag(grad, n);
  } else {
    const sec = secondDerivatives(gray, cfg.sigma);
    if (cfg.alphaSource === 'meanH') {
      s = meanCurvatureMag(grad, sec, cfg.c, n);
    } else {
      const g = normalize(gradMag(grad, n), n);
      const hh = normalize(meanCurvatureMag(grad, sec, cfg.c, n), n);
      const kk = normalize(gaussCurvatureMag(grad, sec, cfg.c, n), n);
      // mixed 가중치: 기본값 (필요 시 노출 대상 — DEV_REGISTRY)
      const wg = 0.5;
      const wh = 0.3;
      const wk = 0.2;
      s = new Float32Array(n);
      for (let i = 0; i < n; i++) s[i] = wg * g[i] + wh * hh[i] + wk * kk[i];
    }
  }

  normalize(s, n);
  return peronaMalik(s, gray.width, gray.height, cfg.diffIters, cfg.diffKappa);
}

function gradMag(g: Gradients, n: number): Float32Array {
  const o = new Float32Array(n);
  for (let i = 0; i < n; i++) o[i] = Math.hypot(g.ix[i], g.iy[i]);
  return o;
}

/** 최댓값으로 [0,1] 정규화 (in place, 반환도 동일 배열). */
function normalize(a: Float32Array, n: number): Float32Array {
  let max = 0;
  for (let i = 0; i < n; i++) if (a[i] > max) max = a[i];
  if (max > 0) for (let i = 0; i < n; i++) a[i] /= max;
  return a;
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
  const cond = (val: number): number => 1 / (1 + (val / kappa) * (val / kappa));
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

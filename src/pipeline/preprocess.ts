import type { GrayImage, PreprocessMode } from './types';

/**
 * 전처리 (docs/claude_mellan_pipeline_v2.md §1). 입력 raw luma(GrayImage) →
 * preprocess 모드별 처리된 GrayImage.
 * - luma_only    : 그대로 (Rec.709 luma, 정규화 없음)
 * - luma_clahe   : CLAHE 국소 대비 정규화 (기본)
 * - user_adjust  : 대비·감마 수동
 */
export function preprocessGray(
  raw: GrayImage,
  mode: PreprocessMode,
  contrast: number,
  gamma: number,
): GrayImage {
  const { width, height } = raw;
  if (mode === 'luma_only') return raw;
  if (mode === 'user_adjust') {
    return { width, height, data: contrastGamma(raw.data, raw.data.length, contrast, gamma) };
  }
  return { width, height, data: clahe(raw, 8, 8, 3) };
}

/** v' = clamp((v−0.5)·contrast + 0.5)^(1/gamma). */
function contrastGamma(data: Float32Array, n: number, contrast: number, gamma: number): Float32Array {
  const g = gamma > 0 ? 1 / gamma : 1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = (data[i] - 0.5) * contrast + 0.5;
    v = v < 0 ? 0 : v > 1 ? 1 : v;
    out[i] = Math.pow(v, g);
  }
  return out;
}

/**
 * CLAHE — 타일별 clip 히스토그램 평활화 + 타일 매핑 bilinear 보간.
 * tilesX·tilesY: 타일 격자, clip: 클립 한계 배수.
 */
function clahe(gray: GrayImage, tilesX: number, tilesY: number, clip: number): Float32Array {
  const { width: w, height: h, data } = gray;
  const BINS = 256;
  const tw = Math.ceil(w / tilesX);
  const th = Math.ceil(h / tilesY);
  const out = new Float32Array(w * h);

  // 타일별 매핑 (bin → [0,1])
  const maps: Float32Array[][] = [];
  for (let ty = 0; ty < tilesY; ty++) {
    maps[ty] = [];
    for (let tx = 0; tx < tilesX; tx++) {
      const x0 = tx * tw;
      const y0 = ty * th;
      const x1 = Math.min(w, x0 + tw);
      const y1 = Math.min(h, y0 + th);
      const hist = new Float32Array(BINS);
      let count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const b = Math.min(BINS - 1, Math.max(0, Math.round(data[y * w + x] * (BINS - 1))));
          hist[b]++;
          count++;
        }
      }
      // clip + 재분배
      const climit = Math.max(1, (clip * count) / BINS);
      let excess = 0;
      for (let i = 0; i < BINS; i++) {
        if (hist[i] > climit) {
          excess += hist[i] - climit;
          hist[i] = climit;
        }
      }
      const inc = excess / BINS;
      // CDF → 매핑
      const map = new Float32Array(BINS);
      let cum = 0;
      const norm = count > 0 ? 1 / count : 0;
      for (let i = 0; i < BINS; i++) {
        cum += hist[i] + inc;
        map[i] = Math.min(1, cum * norm);
      }
      maps[ty][tx] = map;
    }
  }

  const clX = (t: number): number => Math.min(tilesX - 1, Math.max(0, t));
  const clY = (t: number): number => Math.min(tilesY - 1, Math.max(0, t));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const b = Math.min(BINS - 1, Math.max(0, Math.round(data[y * w + x] * (BINS - 1))));
      const fx = (x + 0.5) / tw - 0.5;
      const fy = (y + 0.5) / th - 0.5;
      const tx0 = Math.floor(fx);
      const ty0 = Math.floor(fy);
      const ax = fx - tx0;
      const ay = fy - ty0;
      const m00 = maps[clY(ty0)][clX(tx0)][b];
      const m10 = maps[clY(ty0)][clX(tx0 + 1)][b];
      const m01 = maps[clY(ty0 + 1)][clX(tx0)][b];
      const m11 = maps[clY(ty0 + 1)][clX(tx0 + 1)][b];
      const top = m00 + (m10 - m00) * ax;
      const bot = m01 + (m11 - m01) * ax;
      out[y * w + x] = top + (bot - top) * ay;
    }
  }
  return out;
}

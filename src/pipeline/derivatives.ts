import type { GrayImage } from './types';
import { gaussianBlur } from './gaussianBlur';

export interface Gradients {
  ix: Float32Array;
  iy: Float32Array;
}

export interface Second {
  ixx: Float32Array;
  iyy: Float32Array;
  ixy: Float32Array;
}

/** 2차 편미분 (σ 블러 후 유한차분). meanH/gaussK 곡률용. */
export function secondDerivatives(img: GrayImage, sigma: number): Second {
  const { width: w, height: h, data } = img;
  const b = gaussianBlur(data, w, h, sigma);
  const at = (x: number, y: number): number =>
    b[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  const ixx = new Float32Array(w * h);
  const iyy = new Float32Array(w * h);
  const ixy = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      ixx[i] = at(x + 1, y) - 2 * at(x, y) + at(x - 1, y);
      iyy[i] = at(x, y + 1) - 2 * at(x, y) + at(x, y - 1);
      ixy[i] = (at(x + 1, y + 1) - at(x - 1, y + 1) - at(x + 1, y - 1) + at(x - 1, y - 1)) / 4;
    }
  }
  return { ixx, iyy, ixy };
}

/** Sobel 1차 편미분 (경계 클램프). ix,iy 는 대략 [-1,1] 스케일. */
export function sobel(img: GrayImage): Gradients {
  const { width: w, height: h, data: d } = img;
  const ix = new Float32Array(w * h);
  const iy = new Float32Array(w * h);
  const at = (x: number, y: number): number =>
    d[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx =
        at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const gy =
        at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      ix[y * w + x] = gx / 8;
      iy[y * w + x] = gy / 8;
    }
  }
  return { ix, iy };
}

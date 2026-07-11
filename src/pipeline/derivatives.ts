import type { GrayImage } from './types';

export interface Gradients {
  ix: Float32Array;
  iy: Float32Array;
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

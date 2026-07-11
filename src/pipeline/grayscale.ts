import type { GrayImage } from './types';

/** ImageData → 그레이스케일 (Rec.709 luma). */
export function toGray(img: ImageData): GrayImage {
  const { width, height, data } = img;
  const out = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4] / 255;
    const g = data[i * 4 + 1] / 255;
    const b = data[i * 4 + 2] / 255;
    out[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  return { width, height, data: out };
}

/** 경계 클램프 bilinear 샘플. 좌표가 이미지 밖이면 가장 가까운 픽셀로 클램프. */
export function sampleBilinear(img: GrayImage, x: number, y: number): number {
  const { width, height, data } = img;
  const cx = Math.min(Math.max(x, 0), width - 1);
  const cy = Math.min(Math.max(y, 0), height - 1);
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const fx = cx - x0;
  const fy = cy - y0;
  const i00 = data[y0 * width + x0];
  const i10 = data[y0 * width + x1];
  const i01 = data[y1 * width + x0];
  const i11 = data[y1 * width + x1];
  const top = i00 + (i10 - i00) * fx;
  const bot = i01 + (i11 - i01) * fx;
  return top + (bot - top) * fy;
}

/** 분리형(separable) 가우시안 블러. 경계는 클램프. */
export function gaussianBlur(
  src: Float32Array,
  w: number,
  h: number,
  sigma: number,
): Float32Array {
  if (sigma <= 0) return src.slice();
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const k = new Float32Array(radius * 2 + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k[i + radius] = v;
    sum += v;
  }
  for (let i = 0; i < k.length; i++) k[i] /= sum;

  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  // 수평
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let i = -radius; i <= radius; i++) {
        const xx = Math.min(w - 1, Math.max(0, x + i));
        acc += src[y * w + xx] * k[i + radius];
      }
      tmp[y * w + x] = acc;
    }
  }
  // 수직
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let i = -radius; i <= radius; i++) {
        const yy = Math.min(h - 1, Math.max(0, y + i));
        acc += tmp[yy * w + x] * k[i + radius];
      }
      out[y * w + x] = acc;
    }
  }
  return out;
}

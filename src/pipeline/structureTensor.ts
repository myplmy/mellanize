import type { Gradients } from './derivatives';
import { gaussianBlur } from './gaussianBlur';

/**
 * 구조 텐서 J = K_ρ * [[Ix², IxIy],[IxIy, Iy²]] (평활된 성분).
 * Slice 2 에서는 preprocessing 으로 계산만 하고, 고유분해(v₁·v₂)를 쓰는
 * anisotropic 워프는 Slice 3(#3)에서 이 필드를 소비한다.
 */
export interface StructureTensor {
  jxx: Float32Array;
  jxy: Float32Array;
  jyy: Float32Array;
  width: number;
  height: number;
}

export function structureTensor(
  g: Gradients,
  w: number,
  h: number,
  rho: number,
): StructureTensor {
  const jxx0 = new Float32Array(w * h);
  const jxy0 = new Float32Array(w * h);
  const jyy0 = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const gx = g.ix[i];
    const gy = g.iy[i];
    jxx0[i] = gx * gx;
    jxy0[i] = gx * gy;
    jyy0[i] = gy * gy;
  }
  return {
    jxx: gaussianBlur(jxx0, w, h, rho),
    jxy: gaussianBlur(jxy0, w, h, rho),
    jyy: gaussianBlur(jyy0, w, h, rho),
    width: w,
    height: h,
  };
}

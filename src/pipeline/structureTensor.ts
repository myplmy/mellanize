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

/**
 * 구조 텐서 → 방향장. v₂(minor eigenvector) = 에지 흐름(등고선) 방향(단위벡터),
 * coherence A = (λ₁−λ₂)/(λ₁+λ₂) ∈ [0,1] (에지에서 1, 평탄에서 0).
 * 대칭 2×2 닫힌형 고유분해.
 */
export interface OrientationField {
  v2x: Float32Array;
  v2y: Float32Array;
  coherence: Float32Array;
}

export function orientation(st: StructureTensor): OrientationField {
  const { jxx, jxy, jyy } = st;
  const n = st.width * st.height;
  const v2x = new Float32Array(n);
  const v2y = new Float32Array(n);
  const coherence = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = jxx[i];
    const b = jxy[i];
    const c = jyy[i];
    // major eigenvector 각 φ (= 그래디언트/에지 가로지름 방향)
    const phi = 0.5 * Math.atan2(2 * b, a - c);
    // v₂ = major 에 수직 = 에지 방향
    v2x[i] = -Math.sin(phi);
    v2y[i] = Math.cos(phi);
    const disc = Math.sqrt((a - c) * (a - c) + 4 * b * b);
    const l1 = (a + c + disc) / 2;
    const l2 = (a + c - disc) / 2;
    coherence[i] = l1 + l2 > 1e-12 ? (l1 - l2) / (l1 + l2) : 0;
  }
  return { v2x, v2y, coherence };
}

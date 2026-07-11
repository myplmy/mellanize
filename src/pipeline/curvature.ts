import type { Gradients, Second } from './derivatives';

/**
 * 몽주 패치 f = c·I 의 곡률 크기 (docs/claude_mellan_pipeline_v2.md §2).
 * fx = c·Ix, fxx = c·Ixx, ...
 */

/** 평균곡률 |H| — 단일 곡률(원통형)까지 포착. */
export function meanCurvatureMag(g: Gradients, s: Second, c: number, n: number): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const fx = c * g.ix[i];
    const fy = c * g.iy[i];
    const fxx = c * s.ixx[i];
    const fyy = c * s.iyy[i];
    const fxy = c * s.ixy[i];
    const denom = 2 * Math.pow(1 + fx * fx + fy * fy, 1.5);
    const H = ((1 + fy * fy) * fxx - 2 * fx * fy * fxy + (1 + fx * fx) * fyy) / (denom || 1);
    out[i] = Math.abs(H);
  }
  return out;
}

/** 가우시안 곡률 |K| = c²(Ixx Iyy − Ixy²)/(1+fx²+fy²)². */
export function gaussCurvatureMag(g: Gradients, s: Second, c: number, n: number): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const fx = c * g.ix[i];
    const fy = c * g.iy[i];
    const fxx = c * s.ixx[i];
    const fyy = c * s.iyy[i];
    const fxy = c * s.ixy[i];
    const d = Math.pow(1 + fx * fx + fy * fy, 2);
    const K = (fxx * fyy - fxy * fxy) / (d || 1);
    out[i] = Math.abs(K);
  }
  return out;
}

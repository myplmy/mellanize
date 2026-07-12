import type { GrayImage } from './types';
import { gaussianBlur } from './gaussianBlur';

/**
 * 톤 채널 분해 (docs/claude_mellan_pipeline_v2.md §6, thickness_plus_spacing).
 * D = 1 − I(어둠). 주파수 분해:
 *   dLow  = 저역(넓은 영역 명암)  → 간격 채널
 *   dHigh = D − dLow (국소 디테일) → 두께 채널
 */
export interface DarknessChannels {
  dLow: Float32Array;
  dHigh: Float32Array;
}

export function darknessChannels(gray: GrayImage, splitSigma: number): DarknessChannels {
  const { width: w, height: h, data: I } = gray;
  const n = w * h;
  const D = new Float32Array(n);
  for (let i = 0; i < n; i++) D[i] = 1 - I[i];
  const dLow = gaussianBlur(D, w, h, splitSigma);
  const dHigh = new Float32Array(n);
  for (let i = 0; i < n; i++) dHigh[i] = D[i] - dLow[i];
  return { dLow, dHigh };
}

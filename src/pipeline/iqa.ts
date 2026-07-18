/**
 * IQA 지표 (#20): 그레이스케일 원본 vs 나선 변환(그레이스케일) 비교.
 * 두 입력 모두 [0,1] 동일 해상도. 사진↔선화는 구조가 크게 다르므로 SSIM 절대값보다는
 * **옵션 간 상대 비교·튜닝 지표**로 활용(이슈 참고).
 */
export interface IqaResult {
  mse: number;
  psnr: number; // dB (데이터 범위 1 기준)
  ssim: number; // 8×8 블록 평균 SSIM
}

export function computeIqa(ref: Float32Array, test: Float32Array, w: number, h: number): IqaResult {
  const n = Math.min(ref.length, test.length);
  let se = 0;
  for (let i = 0; i < n; i++) {
    const d = ref[i] - test[i];
    se += d * d;
  }
  const mse = n > 0 ? se / n : 0;
  const psnr = mse > 1e-12 ? 10 * Math.log10(1 / mse) : 99;

  // 8×8 비겹침 블록 SSIM 평균. c1=(0.01)², c2=(0.03)² (범위 1).
  const B = 8;
  const c1 = 0.0001;
  const c2 = 0.0009;
  let ssimSum = 0;
  let blocks = 0;
  for (let by = 0; by + B <= h; by += B) {
    for (let bx = 0; bx + B <= w; bx += B) {
      let sx = 0;
      let sy = 0;
      let sxx = 0;
      let syy = 0;
      let sxy = 0;
      for (let y = 0; y < B; y++) {
        for (let x = 0; x < B; x++) {
          const i = (by + y) * w + (bx + x);
          const a = ref[i];
          const b = test[i];
          sx += a;
          sy += b;
          sxx += a * a;
          syy += b * b;
          sxy += a * b;
        }
      }
      const cnt = B * B;
      const mx = sx / cnt;
      const my = sy / cnt;
      const vx = sxx / cnt - mx * mx;
      const vy = syy / cnt - my * my;
      const cxy = sxy / cnt - mx * my;
      ssimSum += ((2 * mx * my + c1) * (2 * cxy + c2)) / ((mx * mx + my * my + c1) * (vx + vy + c2));
      blocks++;
    }
  }
  return { mse, psnr, ssim: blocks > 0 ? ssimSum / blocks : 1 };
}

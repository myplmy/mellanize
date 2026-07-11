import type { GrayImage, SkeletonConfig, StrokePoint } from './types';
import { sampleBilinear } from './grayscale';
import { archimedes } from './spiral';

export type { GrayImage, SkeletonConfig, StrokePoint } from './types';
export { toGray } from './grayscale';
export { renderStrokes } from './render';

/**
 * Slice 1 walking skeleton 파이프라인:
 *   그레이스케일 → (왜곡 없는) 아르키메데스 나선 → 밝기→두께 매핑 → StrokePoint[].
 *
 * 두께: t = tMin + (1 − I)·(tMax − tMin)  — 어두울수록 굵다
 * (docs/claude_mellan_pipeline_v2.md §6).
 *
 * 후속 슬라이스: 나선 생성 자리에 deformation_model(phasefield 등), 그 앞에
 * alpha_source·구조텐서 단계가 삽입된다.
 */
export function buildStrokes(gray: GrayImage, cfg: SkeletonConfig): StrokePoint[] {
  const center = cfg.center ?? { x: gray.width / 2, y: gray.height / 2 };

  // 중심에서 가장 먼 코너까지 = 전 이미지 커버 (coverage_extent=diagonal).
  const corners = [
    { x: 0, y: 0 },
    { x: gray.width, y: 0 },
    { x: 0, y: gray.height },
    { x: gray.width, y: gray.height },
  ];
  const rMax = Math.max(...corners.map((c) => Math.hypot(c.x - center.x, c.y - center.y)));

  const spiral = archimedes(center, cfg.pitch, rMax, cfg.step);

  const range = cfg.tMax - cfg.tMin;
  return spiral.map((p) => {
    const i = sampleBilinear(gray, p.x, p.y);
    return { x: p.x, y: p.y, thickness: cfg.tMin + (1 - i) * range };
  });
}

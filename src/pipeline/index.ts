import type { GrayImage, PipelineConfig, Pt, StrokeSeg } from './types';
import { sampleBilinear } from './grayscale';
import { archimedes } from './spiral';
import { sobel } from './derivatives';
import { structureTensor } from './structureTensor';
import { gradientAlpha } from './alpha';
import { warpedTurnField } from './phasefield';
import { isoSegments } from './marchingSquares';

export type { GrayImage, PipelineConfig, StrokeSeg } from './types';
export { toGray } from './grayscale';
export { renderSegments } from './render';

/** 중심에서 가장 먼 코너까지 (coverage_extent=diagonal). */
function rMaxFor(gray: GrayImage, c: Pt): number {
  const corners = [
    { x: 0, y: 0 },
    { x: gray.width, y: 0 },
    { x: 0, y: gray.height },
    { x: gray.width, y: gray.height },
  ];
  return Math.max(...corners.map((p) => Math.hypot(p.x - c.x, p.y - c.y)));
}

/** 선분 중점 밝기 → 두께 t = tMin + (1−I)(tMax−tMin). */
function toSeg(
  gray: GrayImage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  tMin: number,
  range: number,
): StrokeSeg {
  const i = sampleBilinear(gray, (x1 + x2) / 2, (y1 + y2) / 2);
  return { x1, y1, x2, y2, thickness: tMin + (1 - i) * range };
}

/**
 * 파이프라인 진입점. deformation_model 에 따라 분기하여 렌더용 선분을 만든다.
 * - skeleton  (Slice 1): 왜곡 없는 아르키메데스 나선
 * - phasefield(Slice 2): grad α + 위상장 tone_only 워프 등위선
 */
export function buildSegments(gray: GrayImage, cfg: PipelineConfig): StrokeSeg[] {
  const center = cfg.center ?? { x: gray.width / 2, y: gray.height / 2 };
  return cfg.deformationModel === 'phasefield'
    ? phasefield(gray, cfg, center)
    : skeleton(gray, cfg, center);
}

function skeleton(gray: GrayImage, cfg: PipelineConfig, center: Pt): StrokeSeg[] {
  const pts = archimedes(center, cfg.pitch, rMaxFor(gray, center), cfg.step);
  const range = cfg.tMax - cfg.tMin;
  const out: StrokeSeg[] = [];
  for (let i = 1; i < pts.length; i++) {
    out.push(toSeg(gray, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, cfg.tMin, range));
  }
  return out;
}

function phasefield(gray: GrayImage, cfg: PipelineConfig, center: Pt): StrokeSeg[] {
  const { width: w, height: h } = gray;
  const grad = sobel(gray);
  // 구조 텐서는 Slice 3(anisotropic 워프)가 소비. tone_only 에서는 계산만 (AC).
  const tensor = structureTensor(grad, w, h, cfg.rho);
  void tensor;
  const alpha = gradientAlpha(grad, w, h, cfg.diffIters, cfg.diffKappa);
  const { field, min, max } = warpedTurnField(gray, alpha, center, cfg.pitch, cfg.lambda);
  const isos = isoSegments(field, w, h, min, max);
  const range = cfg.tMax - cfg.tMin;
  return isos.map((s) => toSeg(gray, s.x1, s.y1, s.x2, s.y2, cfg.tMin, range));
}

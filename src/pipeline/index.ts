import type { GrayImage, PipelineConfig, Pt, Polyline } from './types';
import { sampleBilinear } from './grayscale';
import { archimedes } from './spiral';
import { sobel } from './derivatives';
import { structureTensor, orientation } from './structureTensor';
import { computeAlpha } from './alpha';
import { warpedTurnField } from './phasefield';
import { alongSmooth, fieldRange } from './anisoWarp';
import { isoPolylines } from './marchingSquares';
import { integrateModel, warpModel } from './vectorModels';

export type { GrayImage, PipelineConfig, StrokePoint, Polyline, Pt } from './types';
export { toGray } from './grayscale';
export { preprocessGray } from './preprocess';
export { renderPolylines } from './render';

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

/** 점 밝기 → 두께 t = tMin + (1−I)(tMax−tMin). */
function toStrokePolyline(gray: GrayImage, pts: Pt[], tMin: number, range: number): Polyline {
  return pts.map((p) => {
    const i = sampleBilinear(gray, p.x, p.y);
    return { x: p.x, y: p.y, thickness: tMin + (1 - i) * range };
  });
}

/**
 * 파이프라인 진입점. deformation_model 별로 렌더용 폴리라인을 만든다.
 * - skeleton  (Slice 1): 왜곡 없는 아르키메데스 나선 (단일 폴리라인)
 * - phasefield(Slice 2·3·#14): grad/meanH/mixed α + 위상장 워프 등위선을
 *   정렬·이어붙인 단일 연속 나선 폴리라인
 */
export function buildPolylines(gray: GrayImage, cfg: PipelineConfig): Polyline[] {
  const center = cfg.center ?? { x: gray.width / 2, y: gray.height / 2 };
  switch (cfg.deformationModel) {
    case 'phasefield':
      return phasefield(gray, cfg, center);
    case 'integrate':
    case 'warp':
      return vectorModel(gray, cfg, center);
    default:
      return skeleton(gray, cfg, center);
  }
}

/** integrate·warp: 벡터장 기반 단일 연속 폴리라인 (Slice 7). */
function vectorModel(gray: GrayImage, cfg: PipelineConfig, center: Pt): Polyline[] {
  const { width: w, height: h } = gray;
  const grad = sobel(gray);
  const ori = orientation(structureTensor(grad, w, h, cfg.rho));
  const alpha = computeAlpha(gray, grad, cfg);
  const pts =
    cfg.deformationModel === 'warp'
      ? warpModel(gray, cfg, center, ori, alpha)
      : integrateModel(gray, cfg, center, ori, alpha);
  return [toStrokePolyline(gray, pts, cfg.tMin, cfg.tMax - cfg.tMin)];
}

function skeleton(gray: GrayImage, cfg: PipelineConfig, center: Pt): Polyline[] {
  const pts = archimedes(center, cfg.pitch, rMaxFor(gray, center), cfg.step);
  return [toStrokePolyline(gray, pts, cfg.tMin, cfg.tMax - cfg.tMin)];
}

function phasefield(gray: GrayImage, cfg: PipelineConfig, center: Pt): Polyline[] {
  const { width: w, height: h } = gray;
  const grad = sobel(gray);
  const tensor = structureTensor(grad, w, h, cfg.rho);
  const alpha = computeAlpha(gray, grad, cfg);

  const pf = warpedTurnField(gray, alpha, center, cfg.pitch, cfg.lambda);
  let field = pf.field;
  let { min, max } = pf;

  if (cfg.warpMode === 'anisotropic') {
    const ori = orientation(tensor);
    field = alongSmooth(field, w, h, ori, cfg.alongIters, cfg.alongStrength, cfg.alongReach);
    ({ min, max } = fieldRange(field));
  }

  const polys = isoPolylines(field, w, h, min, max, center, cfg.pitch);
  const range = cfg.tMax - cfg.tMin;
  return polys.map((pts) => toStrokePolyline(gray, pts, cfg.tMin, range));
}

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
import { darknessChannels } from './tone';

export type { GrayImage, PipelineConfig, StrokePoint, Polyline, Pt } from './types';
export { toGray } from './grayscale';
export { preprocessGray } from './preprocess';
export { renderPolylines } from './render';
export { svgFromPolylines } from './svg';
export { computeIqa } from './iqa';
export { applyFreqFilter, type FreqFilter } from './freqFilter';

/** 커버리지 범위 rMax (§8). diagonal: 최원거리 코너 / fixed_turns: N·pitch. */
function computeRMax(gray: GrayImage, c: Pt, cfg: PipelineConfig): number {
  if (cfg.coverageExtent === 'fixed_turns') return Math.max(1, cfg.fixedTurns) * cfg.pitch;
  const corners = [
    { x: 0, y: 0 }, { x: gray.width, y: 0 },
    { x: 0, y: gray.height }, { x: gray.width, y: gray.height },
  ];
  return Math.max(...corners.map((p) => Math.hypot(p.x - c.x, p.y - c.y)));
}

/**
 * 점 밝기 → 두께. tone_channels:
 *  - thickness_only: t = tMin + (1−I)(tMax−tMin)
 *  - thickness_plus_spacing: t 는 고역 dHigh(국소 디테일), 넓은 명암은 간격 채널(§6)
 */
function toStrokePolyline(
  gray: GrayImage,
  pts: Pt[],
  cfg: PipelineConfig,
  dHigh: Float32Array | null,
): Polyline {
  const range = cfg.tMax - cfg.tMin;
  const usePlus = cfg.toneChannels === 'thickness_plus_spacing' && dHigh;
  const dHighImg = dHigh ? { width: gray.width, height: gray.height, data: dHigh } : null;
  return pts.map((p) => {
    let v: number;
    if (usePlus && dHighImg) {
      const dh = sampleBilinear(dHighImg, p.x, p.y); // 고역 잔차 (±)
      v = Math.min(1, Math.max(0, 0.5 + dh * 3));
    } else {
      v = 1 - sampleBilinear(gray, p.x, p.y);
    }
    return { x: p.x, y: p.y, thickness: cfg.tMin + v * range };
  });
}

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

function skeleton(gray: GrayImage, cfg: PipelineConfig, center: Pt): Polyline[] {
  const th0 = ((cfg.startAngle || 0) * Math.PI) / 180;
  const pts = archimedes(center, cfg.pitch, computeRMax(gray, center, cfg), cfg.step, th0);
  const dHigh = cfg.toneChannels === 'thickness_plus_spacing' ? darknessChannels(gray, cfg.pitch * 2).dHigh : null;
  return [toStrokePolyline(gray, pts, cfg, dHigh)];
}

function vectorModel(gray: GrayImage, cfg: PipelineConfig, center: Pt): Polyline[] {
  const { width: w, height: h } = gray;
  const grad = sobel(gray);
  const ori = orientation(structureTensor(grad, w, h, cfg.rho));
  const alpha = computeAlpha(gray, grad, cfg);
  const rMax = computeRMax(gray, center, cfg);
  const pts =
    cfg.deformationModel === 'warp'
      ? warpModel(gray, cfg, center, ori, alpha, rMax)
      : integrateModel(gray, cfg, center, ori, alpha, rMax);
  const dHigh = cfg.toneChannels === 'thickness_plus_spacing' ? darknessChannels(gray, cfg.pitch * 2).dHigh : null;
  return [toStrokePolyline(gray, pts, cfg, dHigh)];
}

function phasefield(gray: GrayImage, cfg: PipelineConfig, center: Pt): Polyline[] {
  const { width: w, height: h } = gray;
  const grad = sobel(gray);
  const tensor = structureTensor(grad, w, h, cfg.rho);
  const alpha = computeAlpha(gray, grad, cfg);

  const plus = cfg.toneChannels === 'thickness_plus_spacing';
  const dc = plus ? darknessChannels(gray, cfg.pitch * 2) : null;

  const pf = warpedTurnField(gray, alpha, cfg, center, dc ? dc.dLow : null);
  let field = pf.field;
  let { min, max } = pf;

  if (cfg.warpMode === 'anisotropic') {
    const ori = orientation(tensor);
    field = alongSmooth(field, w, h, ori, cfg.alongIters, cfg.alongStrength, cfg.alongReach);
    ({ min, max } = fieldRange(field));
  }

  // coverage_extent=fixed_turns: 렌더 턴(정수 레벨)을 N 으로 제한
  if (cfg.coverageExtent === 'fixed_turns') max = Math.min(max, Math.max(1, cfg.fixedTurns));

  const polys = isoPolylines(field, w, h, min, max, center, cfg.pitch);
  return polys.map((pts) => toStrokePolyline(gray, pts, cfg, dc ? dc.dHigh : null));
}

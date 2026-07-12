import type { GrayImage, PipelineConfig, Pt } from './types';
import type { OrientationField } from './structureTensor';
import { archimedes } from './spiral';

/**
 * 벡터장 기반 deformation 모델 (docs/claude_mellan_pipeline_v2.md §5.B·§5.C).
 * 둘 다 **단일 연속 폴리라인**을 만든다(phasefield의 등위선 분절과 대조).
 * - integrate: V_final RK4 유선 적분 (+ 단조 클램프)
 * - warp     : 기준 나선 샘플 + 변위
 */

/** 중심에서 가장 먼 코너 거리. */
function rMaxFor(gray: GrayImage, c: Pt): number {
  const cs = [
    { x: 0, y: 0 }, { x: gray.width, y: 0 },
    { x: 0, y: gray.height }, { x: gray.width, y: gray.height },
  ];
  return Math.max(...cs.map((p) => Math.hypot(p.x - c.x, p.y - c.y)));
}

/** 아르키메데스 나선 단위 접선 t 와 외향 법선 n (a = pitch/2π). */
function spiralVec(p: Pt, center: Pt, a: number): { t: Pt; n: Pt } {
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  const r = Math.hypot(dx, dy);
  const th = Math.atan2(dy, dx);
  const inv = 1 / Math.sqrt(a * a + r * r);
  const t = {
    x: inv * (-r * Math.sin(th) + a * Math.cos(th)),
    y: inv * (r * Math.cos(th) + a * Math.sin(th)),
  };
  const n = r > 1e-6 ? { x: dx / r, y: dy / r } : { x: 1, y: 0 };
  return { t, n };
}

function sampleNearest(arr: Float32Array, w: number, h: number, p: Pt): number {
  const xi = Math.min(w - 1, Math.max(0, Math.round(p.x)));
  const yi = Math.min(h - 1, Math.max(0, Math.round(p.y)));
  return arr[yi * w + xi];
}

/** line_orientation 에 따른 방향 D (unit, 부호 미정). */
function orientationAt(
  ori: OrientationField,
  w: number,
  h: number,
  p: Pt,
  mode: PipelineConfig['lineOrientation'],
  vSpiral: Pt,
): Pt {
  const xi = Math.min(w - 1, Math.max(0, Math.round(p.x)));
  const yi = Math.min(h - 1, Math.max(0, Math.round(p.y)));
  const i = yi * w + xi;
  const v2 = { x: ori.v2x[i], y: ori.v2y[i] }; // 에지 방향(along)
  const v1 = { x: v2.y, y: -v2.x }; // 에지 가로지름(across)
  if (mode === 'across') return v1;
  if (mode === 'switch') {
    const wgt = Math.abs(vSpiral.x * v2.x + vSpiral.y * v2.y);
    return wgt >= 0.5 ? v2 : v1;
  }
  return v2;
}

/** integrate 모델: 단일 시드에서 V_final RK4 적분 → 단일 폴리라인. */
export function integrateModel(
  gray: GrayImage,
  cfg: PipelineConfig,
  center: Pt,
  ori: OrientationField,
  alpha: Float32Array,
): Pt[] {
  const { width: w, height: h } = gray;
  const a = cfg.pitch / (2 * Math.PI);
  const rMax = rMaxFor(gray, center);
  const step = Math.max(0.5, cfg.step);
  const MAX_STEPS = 400000;
  const ALPHA_CAP = 0.85; // V_spiral 성분 ≥15% 보장 → 단조 진행

  let prevT: Pt = { x: 1, y: 0 };

  const vFinal = (q: Pt): Pt => {
    const { t: vs } = spiralVec(q, center, a);
    const al = Math.min(sampleNearest(alpha, w, h, q), ALPHA_CAP);
    const D = orientationAt(ori, w, h, q, cfg.lineOrientation, vs);
    let vx: number;
    let vy: number;
    if (cfg.signHandling === 'tensorblend') {
      const phiS = Math.atan2(vs.y, vs.x);
      const phiD = Math.atan2(D.y, D.x);
      const cx = (1 - al) * Math.cos(2 * phiS) + al * Math.cos(2 * phiD);
      const sy = (1 - al) * Math.sin(2 * phiS) + al * Math.sin(2 * phiD);
      const phi = 0.5 * Math.atan2(sy, cx);
      vx = Math.cos(phi);
      vy = Math.sin(phi);
      if (vx * prevT.x + vy * prevT.y < 0) { vx = -vx; vy = -vy; } // 이전 접선과 연속
    } else {
      const s = D.x * vs.x + D.y * vs.y >= 0 ? 1 : -1; // spiralalign
      vx = (1 - al) * vs.x + al * s * D.x;
      vy = (1 - al) * vs.y + al * s * D.y;
    }
    let m = Math.hypot(vx, vy) || 1;
    vx /= m; vy /= m;
    // 단조 클램프: 나선 진행 역행 방지
    if (vx * vs.x + vy * vs.y < 0.1) {
      vx += vs.x; vy += vs.y;
      m = Math.hypot(vx, vy) || 1;
      vx /= m; vy /= m;
    }
    return { x: vx, y: vy };
  };

  const pts: Pt[] = [];
  let p: Pt = { x: center.x + a * 0.5, y: center.y };
  for (let k = 0; k < MAX_STEPS; k++) {
    pts.push({ x: p.x, y: p.y });
    if (Math.hypot(p.x - center.x, p.y - center.y) > rMax) break;
    const k1 = vFinal(p);
    const k2 = vFinal({ x: p.x + (step / 2) * k1.x, y: p.y + (step / 2) * k1.y });
    const k3 = vFinal({ x: p.x + (step / 2) * k2.x, y: p.y + (step / 2) * k2.y });
    const k4 = vFinal({ x: p.x + step * k3.x, y: p.y + step * k3.y });
    const vx = (k1.x + 2 * k2.x + 2 * k3.x + k4.x) / 6;
    const vy = (k1.y + 2 * k2.y + 2 * k3.y + k4.y) / 6;
    p = { x: p.x + step * vx, y: p.y + step * vy };
    prevT = { x: vx, y: vy };
  }
  return pts;
}

/** warp 모델: 기준 나선 샘플 + 변위(|δ| < pitch/2) → 단일 폴리라인. */
export function warpModel(
  gray: GrayImage,
  cfg: PipelineConfig,
  center: Pt,
  ori: OrientationField,
  alpha: Float32Array,
): Pt[] {
  const { width: w, height: h } = gray;
  const a = cfg.pitch / (2 * Math.PI);
  const base = archimedes(center, cfg.pitch, rMaxFor(gray, center), cfg.step);
  return base.map((S) => {
    const { t: vs, n } = spiralVec(S, center, a);
    const D = orientationAt(ori, w, h, S, cfg.lineOrientation, vs);
    const s = D.x * n.x + D.y * n.y >= 0 ? 1 : -1; // 법선 정렬(일관 변위)
    const al = sampleNearest(alpha, w, h, S);
    const mag = Math.min(cfg.warpStrength * al, 0.49) * cfg.pitch; // |δ| < pitch/2
    return { x: S.x + mag * s * D.x, y: S.y + mag * s * D.y };
  });
}

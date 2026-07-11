import './style.css';
import {
  toGray,
  preprocessGray,
  buildSegments,
  renderSegments,
  type GrayImage,
  type PipelineConfig,
  type Pt,
} from './pipeline';

const DOWNSAMPLE_MAX = 1024;

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const fileInput = $<HTMLInputElement>('file');
const modeSel = $<HTMLSelectElement>('mode');
const warpSel = $<HTMLSelectElement>('warp');
const preSel = $<HTMLSelectElement>('preprocess');
const alphaSel = $<HTMLSelectElement>('alpha');
const autoregen = $<HTMLInputElement>('autoregen');
const renderBtn = $<HTMLButtonElement>('render');
const statusEl = $<HTMLSpanElement>('status');
const canvas = $<HTMLCanvasElement>('canvas');
const basicBox = $<HTMLDivElement>('basic');
const advBox = $<HTMLDivElement>('advanced');

const P: Record<string, number> = {
  pitch: 8, tMin: 0.4, tMax: 6, lambda: 4,
  sigma: 1, rho: 2, c: 6, diffIters: 6, diffKappa: 0.1,
  alongIters: 16, alongStrength: 2, alongReach: 4,
  contrast: 1, gamma: 1,
};

interface Spec { key: string; label: string; min: number; max: number; step: number; advanced?: boolean; preproc?: boolean; }
const SPECS: Spec[] = [
  { key: 'pitch', label: 'pitch', min: 2, max: 40, step: 1 },
  { key: 'tMax', label: 'T_max', min: 1, max: 30, step: 0.5 },
  { key: 'lambda', label: 'λ', min: 0, max: 10, step: 0.1 },
  { key: 'tMin', label: 'T_min', min: 0, max: 5, step: 0.1, advanced: true },
  { key: 'sigma', label: 'σ deriv', min: 0, max: 4, step: 0.1, advanced: true },
  { key: 'rho', label: 'ρ tensor', min: 0, max: 6, step: 0.1, advanced: true },
  { key: 'c', label: 'c height', min: 0, max: 20, step: 0.5, advanced: true },
  { key: 'diffIters', label: 'α iters', min: 0, max: 30, step: 1, advanced: true },
  { key: 'diffKappa', label: 'α κ', min: 0.01, max: 1, step: 0.01, advanced: true },
  { key: 'alongIters', label: 'along iters', min: 0, max: 40, step: 1, advanced: true },
  { key: 'alongStrength', label: 'along str', min: 0, max: 5, step: 0.1, advanced: true },
  { key: 'alongReach', label: 'along reach', min: 1, max: 10, step: 0.5, advanced: true },
  { key: 'contrast', label: 'contrast', min: 0, max: 3, step: 0.05, advanced: true, preproc: true },
  { key: 'gamma', label: 'gamma', min: 0.2, max: 3, step: 0.05, advanced: true, preproc: true },
];

let rawGray: GrayImage | null = null; // Rec.709 luma (전처리 전)
let procGray: GrayImage | null = null; // 전처리 적용본 (파이프라인 입력)
let dirtyPreprocess = true;
let centerOverride: Pt | null = null;

for (const s of SPECS) {
  const wrap = document.createElement('label');
  wrap.className = 'param';
  const name = document.createElement('span');
  name.textContent = s.label;
  const range = document.createElement('input');
  const num = document.createElement('input');
  range.type = 'range';
  num.type = 'number';
  for (const el of [range, num]) {
    el.min = String(s.min);
    el.max = String(s.max);
    el.step = String(s.step);
    el.value = String(P[s.key]);
  }
  const onEdit = (src: HTMLInputElement, other: HTMLInputElement): void => {
    const v = Number(src.value);
    if (Number.isNaN(v)) return;
    P[s.key] = v;
    other.value = src.value;
    if (s.preproc) dirtyPreprocess = true;
    scheduleRender();
  };
  range.addEventListener('input', () => onEdit(range, num));
  num.addEventListener('input', () => onEdit(num, range));
  wrap.append(name, range, num);
  (s.advanced ? advBox : basicBox).appendChild(wrap);
}

function preprocessMode(): 'luma_clahe' | 'luma_only' | 'user_adjust' {
  const v = preSel.value;
  return v === 'luma_only' || v === 'user_adjust' ? v : 'luma_clahe';
}

function config(): PipelineConfig {
  return {
    deformationModel: modeSel.value === 'skeleton' ? 'skeleton' : 'phasefield',
    alphaSource: alphaSel.value === 'meanH' ? 'meanH' : alphaSel.value === 'mixed' ? 'mixed' : 'grad',
    warpMode: warpSel.value === 'tone_only' ? 'tone_only' : 'anisotropic',
    pitch: P.pitch, tMin: P.tMin, tMax: P.tMax, step: 1.5, lambda: P.lambda,
    sigma: P.sigma, rho: P.rho, c: P.c, diffIters: P.diffIters, diffKappa: P.diffKappa,
    alongIters: P.alongIters, alongStrength: P.alongStrength, alongReach: P.alongReach,
    preprocess: preprocessMode(), contrast: P.contrast, gamma: P.gamma,
    center: centerOverride ?? undefined,
  };
}

async function loadImage(file: File): Promise<GrayImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, DOWNSAMPLE_MAX / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext('2d');
  if (!tctx) throw new Error('2D 컨텍스트를 만들 수 없습니다.');
  tctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return toGray(tctx.getImageData(0, 0, w, h));
}

function render(): void {
  if (!rawGray) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (dirtyPreprocess || !procGray) {
    procGray = preprocessGray(rawGray, preprocessMode(), P.contrast, P.gamma);
    dirtyPreprocess = false;
  }
  canvas.width = procGray.width;
  canvas.height = procGray.height;
  const t0 = performance.now();
  const segs = buildSegments(procGray, config());
  renderSegments(ctx, segs);
  const ms = Math.round(performance.now() - t0);
  const ctr = centerOverride ? ` · center(${centerOverride.x | 0},${centerOverride.y | 0})` : '';
  statusEl.textContent = `${modeSel.value}/${warpSel.value}/${preSel.value} · ${procGray.width}×${procGray.height} · 선분 ${segs.length.toLocaleString()} · ${ms}ms${ctr}`;
}

let timer: number | undefined;
function scheduleRender(): void {
  if (!autoregen.checked) {
    renderBtn.textContent = 'Render *';
    return;
  }
  window.clearTimeout(timer);
  timer = window.setTimeout(render, 200);
}

renderBtn.addEventListener('click', () => {
  renderBtn.textContent = 'Render';
  render();
});
for (const sel of [modeSel, warpSel, alphaSel]) sel.addEventListener('change', scheduleRender);
preSel.addEventListener('change', () => {
  dirtyPreprocess = true;
  scheduleRender();
});

canvas.addEventListener('click', (e) => {
  if (!rawGray) return;
  const rect = canvas.getBoundingClientRect();
  centerOverride = {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  };
  render();
});

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  statusEl.textContent = '변환 중…';
  try {
    rawGray = await loadImage(file);
    dirtyPreprocess = true;
    centerOverride = null;
    render();
  } catch (err) {
    statusEl.textContent = `오류: ${err instanceof Error ? err.message : String(err)}`;
  }
});

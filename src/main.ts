import './style.css';
import {
  toGray,
  buildSegments,
  renderSegments,
  type GrayImage,
  type PipelineConfig,
} from './pipeline';

/** 내부 처리 해상도 상한 (장변, px). 브라우저 성능용 다운샘플. */
const DOWNSAMPLE_MAX = 1024;

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const fileInput = $<HTMLInputElement>('file');
const modeSel = $<HTMLSelectElement>('mode');
const warpSel = $<HTMLSelectElement>('warp');
const pitchInput = $<HTMLInputElement>('pitch');
const tmaxInput = $<HTMLInputElement>('tmax');
const lambdaInput = $<HTMLInputElement>('lambda');
const statusEl = $<HTMLSpanElement>('status');
const canvas = $<HTMLCanvasElement>('canvas');

let gray: GrayImage | null = null;

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

function config(): PipelineConfig {
  const mode = modeSel.value === 'skeleton' ? 'skeleton' : 'phasefield';
  const warp = warpSel.value === 'tone_only' ? 'tone_only' : 'anisotropic';
  return {
    deformationModel: mode,
    alphaSource: 'grad',
    warpMode: warp,
    pitch: Number(pitchInput.value) || 8,
    tMin: 0.4,
    tMax: Number(tmaxInput.value) || 6,
    step: 1.5,
    lambda: Number(lambdaInput.value) || 0,
    sigma: 1.0,
    rho: 2.0,
    diffIters: 6,
    diffKappa: 0.1,
    alongIters: 16,
    alongStrength: 2,
    alongReach: 4,
  };
}

function render(): void {
  if (!gray) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = gray.width;
  canvas.height = gray.height;

  const t0 = performance.now();
  const segs = buildSegments(gray, config());
  renderSegments(ctx, segs);
  const ms = Math.round(performance.now() - t0);

  statusEl.textContent = `${modeSel.value} · ${gray.width}×${gray.height}px · 선분 ${segs.length.toLocaleString()} · ${ms}ms`;
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  statusEl.textContent = '변환 중…';
  try {
    gray = await loadImage(file);
    render();
  } catch (err) {
    statusEl.textContent = `오류: ${err instanceof Error ? err.message : String(err)}`;
  }
});

for (const input of [modeSel, warpSel, pitchInput, tmaxInput, lambdaInput]) {
  input.addEventListener('change', render);
}

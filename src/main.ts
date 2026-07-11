import './style.css';
import { toGray, buildStrokes, renderStrokes, type GrayImage } from './pipeline';

/** 내부 처리 해상도 상한 (장변, px). 브라우저 성능용 다운샘플. */
const DOWNSAMPLE_MAX = 1024;

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const fileInput = $<HTMLInputElement>('file');
const pitchInput = $<HTMLInputElement>('pitch');
const tmaxInput = $<HTMLInputElement>('tmax');
const statusEl = $<HTMLSpanElement>('status');
const canvas = $<HTMLCanvasElement>('canvas');

let gray: GrayImage | null = null;

/** 파일 → 다운샘플 → 그레이스케일 GrayImage. */
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
  if (!gray) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = gray.width;
  canvas.height = gray.height;

  const pitch = Number(pitchInput.value) || 8;
  const tMax = Number(tmaxInput.value) || 6;
  const t0 = performance.now();
  const strokes = buildStrokes(gray, { pitch, tMin: 0.4, tMax, step: 1.5 });
  renderStrokes(ctx, strokes);
  const ms = Math.round(performance.now() - t0);

  statusEl.textContent = `${gray.width}×${gray.height}px · 세그먼트 ${strokes.length.toLocaleString()} · ${ms}ms`;
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

for (const input of [pitchInput, tmaxInput]) {
  input.addEventListener('change', render);
}

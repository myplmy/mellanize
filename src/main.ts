import './style.css';
import {
  toGray,
  preprocessGray,
  buildPolylines,
  renderPolylines,
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
const lineSel = $<HTMLSelectElement>('lineorient');
const signSel = $<HTMLSelectElement>('signhandling');
const toneSel = $<HTMLSelectElement>('tone');
const coverageSel = $<HTMLSelectElement>('coverage');
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
  contrast: 1, gamma: 1, warpStrength: 0.6, integrateAlphaCap: 0.8,
  startAngle: 0, fixedTurns: 30,
};

/** 고급 패널 섹션 = 파라미터가 영향을 주는 모드/단계. #18 그룹화. */
type GroupId = 'common' | 'alpha' | 'phasefield' | 'aniso' | 'integrate' | 'warp' | 'coverage' | 'preproc';
interface Spec { key: string; label: string; min: number; max: number; step: number; advanced?: boolean; preproc?: boolean; group: GroupId; tip: string; }
const SPECS: Spec[] = [
  { key: 'pitch', label: 'pitch', min: 2, max: 40, step: 1, group: 'common', tip: '인접 나선 턴 사이 반경 간격(px). 작을수록 선이 촘촘 · 전 모드' },
  { key: 'tMax', label: 'T_max', min: 1, max: 30, step: 0.5, group: 'common', tip: '가장 어두운 곳의 최대 선 두께(px) · 음영→두께 사상' },
  { key: 'lambda', label: 'λ', min: 0, max: 10, step: 0.1, group: 'phasefield', tip: 'phasefield 톤 워프 강도. 클수록 등위선이 명암 따라 크게 변형 · phasefield' },
  { key: 'startAngle', label: 'start°', min: 0, max: 359, step: 1, group: 'common', tip: '나선 시작 각도(0~359°) · 전 모드' },
  { key: 'fixedTurns', label: 'turns N', min: 1, max: 200, step: 1, advanced: true, group: 'coverage', tip: '커버리지=고정 턴수일 때 감을 턴 수 N · 커버리지' },
  { key: 'tMin', label: 'T_min', min: 0, max: 5, step: 0.1, advanced: true, group: 'common', tip: '가장 밝은 곳의 최소 선 두께(px) · 음영→두께 사상' },
  { key: 'sigma', label: 'σ deriv', min: 0, max: 4, step: 0.1, advanced: true, group: 'common', tip: '도함수 가우시안 σ. 클수록 곡률·에지 계산이 부드러움 · 미분' },
  { key: 'rho', label: 'ρ tensor', min: 0, max: 6, step: 0.1, advanced: true, group: 'common', tip: '구조 텐서 평활 ρ. 에지 방향장(v₂)의 매끈함 · 방향장' },
  { key: 'c', label: 'c height', min: 0, max: 20, step: 0.5, advanced: true, group: 'alpha', tip: '몽주 패치 밝기→높이 스케일. meanH/mixed α의 곡률 크기 · α 소스' },
  { key: 'diffIters', label: 'α iters', min: 0, max: 30, step: 1, advanced: true, group: 'alpha', tip: 'α Perona-Malik 확산 반복. 클수록 α 전이가 넓게 번짐 · α 필드' },
  { key: 'diffKappa', label: 'α κ', min: 0.01, max: 1, step: 0.01, advanced: true, group: 'alpha', tip: 'α 확산 에지 임계 κ. 작을수록 에지 경계 보존 · α 필드' },
  { key: 'alongIters', label: 'along iters', min: 0, max: 40, step: 1, advanced: true, group: 'aniso', tip: 'anisotropic 워프의 v₂ 방향 평활 반복 횟수 · phasefield anisotropic' },
  { key: 'alongStrength', label: 'along str', min: 0, max: 5, step: 0.1, advanced: true, group: 'aniso', tip: 'anisotropic 워프의 coherence 대비 평활 강도 · phasefield anisotropic' },
  { key: 'alongReach', label: 'along reach', min: 1, max: 10, step: 0.5, advanced: true, group: 'aniso', tip: 'anisotropic 워프의 v₂ 방향 샘플 도달 거리(px) · phasefield anisotropic' },
  { key: 'warpStrength', label: 'warp μ', min: 0, max: 1, step: 0.05, advanced: true, group: 'warp', tip: 'warp 모델 변위 강도 μ. |δ|<pitch/2로 클램프 · warp' },
  { key: 'integrateAlphaCap', label: 'integ αcap', min: 0.3, max: 0.98, step: 0.02, advanced: true, group: 'integrate', tip: 'integrate α 상한(텐서 최대 비중). 낮을수록 나선 복원·커버리지↑ · integrate' },
  { key: 'contrast', label: 'contrast', min: 0, max: 3, step: 0.05, advanced: true, preproc: true, group: 'preproc', tip: 'user_adjust 대비(1=원본) · 전처리' },
  { key: 'gamma', label: 'gamma', min: 0.2, max: 3, step: 0.05, advanced: true, preproc: true, group: 'preproc', tip: 'user_adjust 감마(1=원본) · 전처리' },
];

interface Group { id: GroupId; label: string; active: () => boolean; }
/** 고급 패널 섹션 순서 + 현재 선택과의 관련성(false면 흐리게). common·alpha 는 전 모드 공통. */
const ADV_GROUPS: Group[] = [
  { id: 'common', label: '공통 · 기하/미분', active: () => true },
  { id: 'alpha', label: 'α 필드 · 곡률/확산', active: () => true },
  { id: 'aniso', label: 'phasefield · anisotropic 워프', active: () => modeSel.value === 'phasefield' && warpSel.value === 'anisotropic' },
  { id: 'integrate', label: 'integrate · 단일 유선', active: () => modeSel.value === 'integrate' },
  { id: 'warp', label: 'warp · 변위', active: () => modeSel.value === 'warp' },
  { id: 'coverage', label: '커버리지 · 고정 턴수', active: () => coverageSel.value === 'fixed_turns' },
  { id: 'preproc', label: '전처리 · user_adjust', active: () => preSel.value === 'user_adjust' },
];

let rawGray: GrayImage | null = null; // Rec.709 luma (전처리 전)
let procGray: GrayImage | null = null; // 전처리 적용본 (파이프라인 입력)
let dirtyPreprocess = true;
let centerOverride: Pt | null = null;

function makeParamRow(s: Spec): HTMLLabelElement {
  const wrap = document.createElement('label');
  wrap.className = 'param';
  wrap.title = s.tip;
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
    el.title = s.tip;
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
  return wrap;
}

// 기본 파라미터: 평탄 그리드(항상 표시) + 툴팁.
for (const s of SPECS.filter((x) => !x.advanced)) basicBox.appendChild(makeParamRow(s));

// 고급 파라미터: 영향 모드/단계별 섹션으로 그룹화 + 툴팁 + 비활성 흐리게(#18).
const groupSections = new Map<GroupId, HTMLElement>();
for (const g of ADV_GROUPS) {
  const advSpecs = SPECS.filter((x) => x.advanced && x.group === g.id);
  if (advSpecs.length === 0) continue;
  const section = document.createElement('section');
  section.className = 'param-group';
  section.dataset.group = g.id;
  const head = document.createElement('h4');
  head.textContent = g.label;
  const grid = document.createElement('div');
  grid.className = 'params';
  for (const s of advSpecs) grid.appendChild(makeParamRow(s));
  section.append(head, grid);
  advBox.appendChild(section);
  groupSections.set(g.id, section);
}

/** 현재 선택 모드와 무관한 고급 그룹을 흐리게 표시(AC #3). */
function refreshGroups(): void {
  for (const g of ADV_GROUPS) {
    const sec = groupSections.get(g.id);
    if (sec) sec.classList.toggle('inactive', !g.active());
  }
}
refreshGroups();

function preprocessMode(): 'luma_clahe' | 'luma_only' | 'user_adjust' {
  const v = preSel.value;
  return v === 'luma_only' || v === 'user_adjust' ? v : 'luma_clahe';
}

function deformMode(): PipelineConfig['deformationModel'] {
  const v = modeSel.value;
  return v === 'skeleton' || v === 'integrate' || v === 'warp' ? v : 'phasefield';
}

function config(): PipelineConfig {
  return {
    deformationModel: deformMode(),
    alphaSource: alphaSel.value === 'meanH' ? 'meanH' : alphaSel.value === 'mixed' ? 'mixed' : 'grad',
    warpMode: warpSel.value === 'tone_only' ? 'tone_only' : 'anisotropic',
    pitch: P.pitch, tMin: P.tMin, tMax: P.tMax, step: 1.5, lambda: P.lambda,
    sigma: P.sigma, rho: P.rho, c: P.c, diffIters: P.diffIters, diffKappa: P.diffKappa,
    alongIters: P.alongIters, alongStrength: P.alongStrength, alongReach: P.alongReach,
    preprocess: preprocessMode(), contrast: P.contrast, gamma: P.gamma,
    warpStrength: P.warpStrength,
    lineOrientation: lineSel.value === 'across' ? 'across' : lineSel.value === 'switch' ? 'switch' : 'along',
    signHandling: signSel.value === 'spiralalign' ? 'spiralalign' : 'tensorblend',
    integrateAlphaCap: P.integrateAlphaCap,
    startAngle: P.startAngle,
    toneChannels: toneSel.value === 'thickness_plus_spacing' ? 'thickness_plus_spacing' : 'thickness_only',
    coverageExtent: coverageSel.value === 'fixed_turns' ? 'fixed_turns' : 'diagonal',
    fixedTurns: P.fixedTurns,
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
  const polys = buildPolylines(procGray, config());
  renderPolylines(ctx, polys);
  const ms = Math.round(performance.now() - t0);
  const pts = polys.reduce((n, p) => n + p.length, 0);
  const ctr = centerOverride ? ` · center(${centerOverride.x | 0},${centerOverride.y | 0})` : '';
  statusEl.textContent = `${modeSel.value}/${warpSel.value}/${preSel.value} · ${procGray.width}×${procGray.height} · 폴리라인 ${polys.length.toLocaleString()}·점 ${pts.toLocaleString()} · ${ms}ms${ctr}`;
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
for (const sel of [modeSel, warpSel, alphaSel, lineSel, signSel, toneSel, coverageSel])
  sel.addEventListener('change', () => {
    refreshGroups();
    scheduleRender();
  });
preSel.addEventListener('change', () => {
  dirtyPreprocess = true;
  refreshGroups();
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

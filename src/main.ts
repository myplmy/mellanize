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
const viewModeSel = $<HTMLSelectElement>('viewmode');
const compareOpts = $<HTMLSpanElement>('compareopts');
const cmpOriginalSel = $<HTMLSelectElement>('cmpOriginal');
const cmpSplitSel = $<HTMLSelectElement>('cmpSplit');
const cmpHandleSel = $<HTMLSelectElement>('cmpHandle');
const quadOpts = $<HTMLSpanElement>('quadopts');
const quadBox = $<HTMLDivElement>('quad');
const quadResRange = $<HTMLInputElement>('quadResRange');
const quadResNum = $<HTMLInputElement>('quadResNum');
const panelCanvases = [...quadBox.querySelectorAll('canvas.panel')] as HTMLCanvasElement[];

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

// 비교 뷰(#21): 변환 결과·원본을 오프스크린 캔버스에 캐시하고 합성만 재수행(절취선 이동 시 변환 재계산 없음).
const transformCanvas = document.createElement('canvas'); // 나선 변환 결과(엔그레이빙)
let colorCanvas: HTMLCanvasElement | null = null; // 원본 컬러(작업 해상도)
let grayCanvas: HTMLCanvasElement | null = null; // 전처리 luma(procGray)
let transformReady = false;
let splitPos = 0.5; // 절취선 위치 (0~1)
let dragging = false;

// 4분할 비교(#22): 패널별 컨트롤 상태 스냅샷 + 렌더 결과. 활성 패널만 편집·재렌더.
interface Panel {
  snap: CtrlState;
  canvas: HTMLCanvasElement;
}
let panels: Panel[] = [];
let activePanel = 0;
let quadRes = 512; // 패널 축소 렌더 장변 px (슬라이더 노출)

// 스냅샷 로드 시 슬라이더/수치 입력을 P 값으로 되돌리기 위한 참조.
const paramInputs = new Map<string, { range: HTMLInputElement; num: HTMLInputElement }>();

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
  paramInputs.set(s.key, { range, num });
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

/** 전체 컨트롤 상태 스냅샷 (8 셀렉트 + 파라미터 + 중심). #22 패널별 저장·복원 단위. */
interface CtrlState {
  mode: string;
  warp: string;
  preprocess: string;
  alpha: string;
  lineorient: string;
  signhandling: string;
  tone: string;
  coverage: string;
  params: Record<string, number>;
  center: Pt | null;
}

function readLive(): CtrlState {
  return {
    mode: modeSel.value, warp: warpSel.value, preprocess: preSel.value, alpha: alphaSel.value,
    lineorient: lineSel.value, signhandling: signSel.value, tone: toneSel.value, coverage: coverageSel.value,
    params: { ...P },
    center: centerOverride,
  };
}

/** 스냅샷을 컨트롤(셀렉트·P·입력·중심)에 로드. change 이벤트 미발생 → 재렌더는 호출측 제어. */
function applyState(s: CtrlState): void {
  modeSel.value = s.mode; warpSel.value = s.warp; preSel.value = s.preprocess; alphaSel.value = s.alpha;
  lineSel.value = s.lineorient; signSel.value = s.signhandling; toneSel.value = s.tone; coverageSel.value = s.coverage;
  Object.assign(P, s.params);
  centerOverride = s.center;
  for (const [key, io] of paramInputs) {
    io.range.value = String(P[key]);
    io.num.value = String(P[key]);
  }
  dirtyPreprocess = true;
  refreshGroups();
}

function cloneState(s: CtrlState): CtrlState {
  return { ...s, params: { ...s.params }, center: s.center ? { ...s.center } : null };
}

function configFrom(s: CtrlState, center?: Pt): PipelineConfig {
  const q = s.params;
  return {
    deformationModel:
      s.mode === 'skeleton' || s.mode === 'integrate' || s.mode === 'warp' ? s.mode : 'phasefield',
    alphaSource: s.alpha === 'meanH' ? 'meanH' : s.alpha === 'mixed' ? 'mixed' : 'grad',
    warpMode: s.warp === 'tone_only' ? 'tone_only' : 'anisotropic',
    pitch: q.pitch, tMin: q.tMin, tMax: q.tMax, step: 1.5, lambda: q.lambda,
    sigma: q.sigma, rho: q.rho, c: q.c, diffIters: q.diffIters, diffKappa: q.diffKappa,
    alongIters: q.alongIters, alongStrength: q.alongStrength, alongReach: q.alongReach,
    preprocess: s.preprocess === 'luma_only' || s.preprocess === 'user_adjust' ? s.preprocess : 'luma_clahe',
    contrast: q.contrast, gamma: q.gamma, warpStrength: q.warpStrength,
    lineOrientation: s.lineorient === 'across' ? 'across' : s.lineorient === 'switch' ? 'switch' : 'along',
    signHandling: s.signhandling === 'spiralalign' ? 'spiralalign' : 'tensorblend',
    integrateAlphaCap: q.integrateAlphaCap,
    startAngle: q.startAngle,
    toneChannels: s.tone === 'thickness_plus_spacing' ? 'thickness_plus_spacing' : 'thickness_only',
    coverageExtent: s.coverage === 'fixed_turns' ? 'fixed_turns' : 'diagonal',
    fixedTurns: q.fixedTurns,
    center: center ?? s.center ?? undefined,
  };
}

function config(): PipelineConfig {
  return configFrom(readLive());
}

async function loadImage(file: File): Promise<{ gray: GrayImage; color: HTMLCanvasElement }> {
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
  // tmp = 원본 컬러(작업 해상도) — 비교 뷰 원본으로 재사용.
  return { gray: toGray(tctx.getImageData(0, 0, w, h)), color: tmp };
}

/** procGray(Float [0,1]) → 그레이스케일 캔버스. 비교 뷰 '그레이 원본'. */
function grayToCanvas(gray: GrayImage): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = gray.width;
  c.height = gray.height;
  const cx = c.getContext('2d');
  if (!cx) return c;
  const img = cx.createImageData(gray.width, gray.height);
  const n = gray.width * gray.height;
  for (let i = 0; i < n; i++) {
    const v = Math.max(0, Math.min(255, Math.round(gray.data[i] * 255)));
    const j = i * 4;
    img.data[j] = v;
    img.data[j + 1] = v;
    img.data[j + 2] = v;
    img.data[j + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  return c;
}

function viewMode(): 'single' | 'compare' | 'quad' {
  const v = viewModeSel.value;
  return v === 'compare' || v === 'quad' ? v : 'single';
}

/** GrayImage 를 장변 maxDim 으로 최근접 다운샘플(패널 축소 렌더용). scale 은 원본→축소 배율. */
function downsampleGray(g: GrayImage, maxDim: number): { gray: GrayImage; scale: number } {
  const scale = Math.min(1, maxDim / Math.max(g.width, g.height));
  if (scale >= 1) return { gray: g, scale: 1 };
  const w = Math.max(1, Math.round(g.width * scale));
  const h = Math.max(1, Math.round(g.height * scale));
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(g.height - 1, Math.floor(y / scale));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(g.width - 1, Math.floor(x / scale));
      data[y * w + x] = g.data[sy * g.width + sx];
    }
  }
  return { gray: { width: w, height: h, data }, scale };
}

/** 한 패널을 스냅샷 설정으로 축소 렌더(전처리도 스냅샷 기준). 활성 패널만 자주 호출됨. */
function renderPanel(i: number): void {
  if (!rawGray) return;
  const panel = panels[i];
  const { gray: small, scale } = downsampleGray(rawGray, quadRes);
  const pm = panel.snap.preprocess === 'luma_only' || panel.snap.preprocess === 'user_adjust'
    ? panel.snap.preprocess
    : 'luma_clahe';
  const pg = preprocessGray(small, pm, panel.snap.params.contrast, panel.snap.params.gamma);
  const center = panel.snap.center
    ? { x: panel.snap.center.x * scale, y: panel.snap.center.y * scale }
    : undefined;
  const polys = buildPolylines(pg, configFrom(panel.snap, center));
  panel.canvas.width = pg.width;
  panel.canvas.height = pg.height;
  const ctx = panel.canvas.getContext('2d');
  if (ctx) renderPolylines(ctx, polys);
}

function renderAllPanels(): void {
  for (let i = 0; i < panels.length; i++) renderPanel(i);
}

function highlightActive(): void {
  panelCanvases.forEach((cv, i) => cv.classList.toggle('active', i === activePanel));
}

/** 4분할 진입: 최초엔 현재 라이브 설정을 4패널에 복제, 이후엔 기존 스냅샷 유지. */
function enterQuad(): void {
  if (panels.length === 0) {
    const base = readLive();
    panels = panelCanvases.map((cv) => ({ snap: cloneState(base), canvas: cv }));
    activePanel = 0;
    applyState(panels[activePanel].snap);
  }
  renderAllPanels();
  highlightActive();
  quadStatus();
}

function quadStatus(): void {
  statusEl.textContent = `4분할 · 활성 패널 ${activePanel + 1}/4 · 패널 해상도 ${quadRes}px · 컨트롤은 활성 패널에 적용`;
}

/** 오프스크린 변환 결과 + 원본을 절취선으로 합성해 표시 캔버스에 그린다(변환 재계산 없음). */
function paint(): void {
  if (!transformReady) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = transformCanvas.width;
  const H = transformCanvas.height;
  canvas.width = W;
  canvas.height = H;
  if (viewMode() === 'single') {
    ctx.drawImage(transformCanvas, 0, 0);
    return;
  }
  // 비교: 변환 전체 그린 뒤 원본 영역만 클립 합성 → 절취선 표시.
  ctx.drawImage(transformCanvas, 0, 0);
  const orig = cmpOriginalSel.value === 'gray' ? grayCanvas : colorCanvas;
  const vertical = cmpSplitSel.value !== 'horizontal';
  const x = splitPos * W;
  const y = splitPos * H;
  ctx.save();
  ctx.beginPath();
  if (vertical) ctx.rect(0, 0, x, H); // 좌 = 원본
  else ctx.rect(0, 0, W, y); // 상 = 원본
  ctx.clip();
  if (orig) ctx.drawImage(orig, 0, 0, orig.width, orig.height, 0, 0, W, H);
  ctx.restore();
  ctx.strokeStyle = '#e0245e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (vertical) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  } else {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();
}

/** 포인터 위치 → 절취선 위치(0~1). 분할 방향에 따라 x/y 축. */
function posToSplit(e: PointerEvent): number {
  const rect = canvas.getBoundingClientRect();
  const t =
    cmpSplitSel.value !== 'horizontal'
      ? (e.clientX - rect.left) / rect.width
      : (e.clientY - rect.top) / rect.height;
  return Math.max(0, Math.min(1, t));
}

function render(): void {
  if (!rawGray) return;
  // 4분할: 라이브 컨트롤을 활성 패널 스냅샷에 반영하고 그 패널만 재렌더(나머지 유지).
  if (viewMode() === 'quad') {
    if (panels.length) {
      panels[activePanel].snap = readLive();
      renderPanel(activePanel);
      quadStatus();
    }
    return;
  }
  if (dirtyPreprocess || !procGray) {
    procGray = preprocessGray(rawGray, preprocessMode(), P.contrast, P.gamma);
    dirtyPreprocess = false;
    grayCanvas = grayToCanvas(procGray); // 전처리 바뀔 때만 그레이 원본 재생성
  }
  transformCanvas.width = procGray.width;
  transformCanvas.height = procGray.height;
  const tctx = transformCanvas.getContext('2d');
  if (!tctx) return;
  const t0 = performance.now();
  const polys = buildPolylines(procGray, config());
  renderPolylines(tctx, polys);
  const ms = Math.round(performance.now() - t0);
  transformReady = true;
  paint();
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

// 뷰 전환: compare/quad 옵션·컨테이너 토글. quad 진입 시 패널 초기화, 그 외엔 전체 렌더.
viewModeSel.addEventListener('change', () => {
  const m = viewMode();
  compareOpts.hidden = m !== 'compare';
  quadOpts.hidden = m !== 'quad';
  quadBox.hidden = m !== 'quad';
  canvas.hidden = m === 'quad';
  if (m === 'quad') enterQuad();
  else render();
});
// 비교 뷰(#21): 원본/분할 변경은 합성만 재수행(변환 재계산 불요).
for (const sel of [cmpOriginalSel, cmpSplitSel]) sel.addEventListener('change', paint);

// 4분할(#22): 패널 클릭 = 선택 + 그 패널 스냅샷을 컨트롤에 로드(재렌더 없음).
for (const cv of panelCanvases) {
  cv.addEventListener('click', () => {
    if (viewMode() !== 'quad' || panels.length === 0) return;
    activePanel = Number(cv.dataset.panel) || 0;
    applyState(panels[activePanel].snap);
    highlightActive();
    quadStatus();
  });
}
// 패널 해상도 슬라이더/수치: 전 패널 재렌더.
const onQuadRes = (src: HTMLInputElement, other: HTMLInputElement): void => {
  const v = Number(src.value);
  if (Number.isNaN(v)) return;
  quadRes = v;
  other.value = src.value;
  if (viewMode() === 'quad') {
    renderAllPanels();
    quadStatus();
  }
};
quadResRange.addEventListener('input', () => onQuadRes(quadResRange, quadResNum));
quadResNum.addEventListener('input', () => onQuadRes(quadResNum, quadResRange));

// 단일 뷰: 캔버스 클릭 = 나선 중심 지정.
canvas.addEventListener('click', (e) => {
  if (!rawGray || viewMode() !== 'single') return;
  const rect = canvas.getBoundingClientRect();
  centerOverride = {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  };
  render();
});

// 비교 뷰: 절취선 드래그 / 커서 추종.
canvas.addEventListener('pointerdown', (e) => {
  if (viewMode() !== 'compare' || cmpHandleSel.value !== 'drag') return;
  dragging = true;
  splitPos = posToSplit(e);
  paint();
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (viewMode() !== 'compare') return;
  if (cmpHandleSel.value === 'follow' || dragging) {
    splitPos = posToSplit(e);
    paint();
  }
});
canvas.addEventListener('pointerup', () => {
  dragging = false;
});

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  statusEl.textContent = '변환 중…';
  try {
    const loaded = await loadImage(file);
    rawGray = loaded.gray;
    colorCanvas = loaded.color;
    dirtyPreprocess = true;
    centerOverride = null;
    if (viewMode() === 'quad') enterQuad();
    else render();
  } catch (err) {
    statusEl.textContent = `오류: ${err instanceof Error ? err.message : String(err)}`;
  }
});

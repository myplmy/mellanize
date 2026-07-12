/** 그레이스케일 이미지 (I ∈ [0,1], row-major). */
export interface GrayImage {
  width: number;
  height: number;
  data: Float32Array;
}

export interface Pt {
  x: number;
  y: number;
}

/** 폴리라인 정점: 위치 + 그 지점 선 두께. */
export interface StrokePoint {
  x: number;
  y: number;
  thickness: number;
}

/** 연속 폴리라인 (순서 있는 정점열). 렌더 단위. */
export type Polyline = StrokePoint[];

/** deformation_model (docs/claude_mellan_pipeline_v2.md §5). */
export type DeformationModel = 'skeleton' | 'phasefield' | 'integrate' | 'warp';
/** alpha_source (§2). */
export type AlphaSource = 'grad' | 'meanH' | 'mixed';
/** phasefield warp_mode (§5.A). */
export type WarpMode = 'tone_only' | 'anisotropic';
/** 전처리 모드 (§1). meanH·mixed 대비 정규화 방식. */
export type PreprocessMode = 'luma_clahe' | 'luma_only' | 'user_adjust';
/** 선 방향 (§3). integrate·warp 전용. */
export type LineOrientation = 'along' | 'across' | 'switch';
/** 부호 처리 (§4). integrate·warp 전용. */
export type SignHandling = 'tensorblend' | 'spiralalign';
/** 톤 채널 (§6). */
export type ToneChannels = 'thickness_only' | 'thickness_plus_spacing';
/** 커버리지 범위 (§8). */
export type CoverageExtent = 'diagonal' | 'fixed_turns';

export interface PipelineConfig {
  deformationModel: DeformationModel;
  alphaSource: AlphaSource;
  warpMode: WarpMode;
  /** 인접 나선 턴 반경 간격 p (px). */
  pitch: number;
  tMin: number;
  tMax: number;
  /** skeleton 호길이 샘플 스텝 (px). */
  step: number;
  /** 나선 중심. 미지정 시 이미지 기하 중심. */
  center?: Pt;
  /** phasefield 톤 워프 강도. */
  lambda: number;
  /** 도함수 가우시안 σ. */
  sigma: number;
  /** 구조 텐서 평활 ρ. */
  rho: number;
  /** 몽주 패치 밝기→높이 스케일 (meanH/gaussK/mixed 곡률용). */
  c: number;
  /** α Perona-Malik 확산 반복 횟수. */
  diffIters: number;
  /** α 확산 에지 임계 κ. */
  diffKappa: number;
  /** anisotropic 워프: v₂ 방향 평활 반복 횟수. */
  alongIters: number;
  /** anisotropic 워프: coherence 대비 평활 강도. */
  alongStrength: number;
  /** anisotropic 워프: v₂ 방향 샘플 도달 거리(px). */
  alongReach: number;
  /** 전처리 모드. */
  preprocess: PreprocessMode;
  /** user_adjust 대비 (1=원본). */
  contrast: number;
  /** user_adjust 감마 (1=원본). */
  gamma: number;
  /** warp 모델 변위 강도 (μ). |δ| < pitch/2 로 클램프됨. */
  warpStrength: number;
  /** integrate·warp: 선 방향. */
  lineOrientation: LineOrientation;
  /** integrate·warp: 부호 처리. */
  signHandling: SignHandling;
  /** integrate: α 상한(텐서 최대 비중). 낮을수록 나선 복원·커버리지↑·점수↓. */
  integrateAlphaCap: number;
  /** 나선 시작 각도 (도, 0~359). */
  startAngle: number;
  /** 톤 채널 (thickness_only / thickness_plus_spacing). */
  toneChannels: ToneChannels;
  /** 커버리지 범위 (diagonal / fixed_turns). */
  coverageExtent: CoverageExtent;
  /** fixed_turns 시 턴 수 N. */
  fixedTurns: number;
}

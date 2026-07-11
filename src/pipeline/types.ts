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

/** 렌더 단위: 두께를 가진 선분 (skeleton·phasefield 공통 출력). */
export interface StrokeSeg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
}

/** deformation_model (docs/claude_mellan_pipeline_v2.md §5). integrate·warp: Slice 7. */
export type DeformationModel = 'skeleton' | 'phasefield';
/** alpha_source (§2). */
export type AlphaSource = 'grad' | 'meanH' | 'mixed';
/** phasefield warp_mode (§5.A). */
export type WarpMode = 'tone_only' | 'anisotropic';
/** 전처리 모드 (§1). meanH·mixed 대비 정규화 방식. */
export type PreprocessMode = 'luma_clahe' | 'luma_only' | 'user_adjust';

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
}

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

/** 나선 중심축 위의 한 점 + 그 지점 선 두께. */
export interface StrokePoint {
  x: number;
  y: number;
  thickness: number;
}

/**
 * Slice 1 walking skeleton 설정.
 * 후속 슬라이스에서 deformation_model·alpha_source 등 교체축이 여기에 추가된다
 * (docs/claude_mellan_pipeline_v2.md §0).
 */
export interface SkeletonConfig {
  /** 인접 나선 턴 간 반경 간격 p (px). */
  pitch: number;
  /** 선 최소 두께 (px). */
  tMin: number;
  /** 선 최대 두께 (px). */
  tMax: number;
  /** 유선 샘플 목표 스텝 (px). 작을수록 매끄럽고 무겁다. */
  step: number;
  /** 나선 중심. 미지정 시 이미지 기하 중심. */
  center?: Pt;
}

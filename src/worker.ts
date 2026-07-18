import { buildPolylines, type GrayImage, type PipelineConfig, type Polyline } from './pipeline';

/**
 * 파이프라인 오프로드 워커(#9). 무거운 `buildPolylines`(구조텐서·α 확산·마칭·적분)를
 * 메인 스레드 밖에서 실행해 UI 논블로킹. 전처리(procGray)는 메인에 남겨(비교 뷰 그레이
 * 원본에 필요) gray 를 받아 폴리라인만 돌려준다.
 */
interface Req {
  id: number;
  gray: GrayImage;
  cfg: PipelineConfig;
}
interface Res {
  id: number;
  polys: Polyline[];
}

self.onmessage = (e: MessageEvent<Req>): void => {
  const { id, gray, cfg } = e.data;
  const polys = buildPolylines(gray, cfg);
  const msg: Res = { id, polys };
  (self as unknown as Worker).postMessage(msg);
};

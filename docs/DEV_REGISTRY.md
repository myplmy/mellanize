# Dev Registry

개발 진행 중 **임시로 저장해둘 사항**을 기록하는 곳. 작업 로그·결정 근거·미결 TODO·인프라 상태를 담는다.

- **여기 vs CLAUDE.md**: CLAUDE.md는 영구 규범·아키텍처(안정적). 이 파일은 진행 중 상태·결정·할 일(변동적). 상태 기록은 CLAUDE.md가 아니라 여기에 쌓는다.
- 항목이 영구 사실로 굳으면 CLAUDE.md로 승격하고 여기서는 제거한다.
- 날짜는 절대 표기(YYYY-MM-DD).

---

## 미결 / TODO

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 1 | 파이프라인 설계 검증 (grill) | 완료 (차수 1~3) | 설계 트리 수렴. v2 문서가 정본. 잔여는 구현 시점 세부(파라미터 기본값·CLAHE 계수 등, 비차단) |
| 2 | v2 구현 계획 수립 (to-issues) | 완료 | GitHub 이슈 #1~#10 (tracer-bullet 슬라이스, needs-triage) |
| 3 | v2 알고리즘 구현 | 진행 중 | 코어 Slice 1~8 + #14·#26·#27 완료. UI/처리/분석 이슈 #18·#21·#22·#9·#23·#20·#19(주파수) 완료. 남은: #10(HITL 캘리브, ready-for-human=사용자 몫)·#37(FFT 필터 옵션, needs-triage) |
| 7 | phasefield 단일연속선(#14) | 부분 완료 | 세그먼트→정렬 폴리라인 chain+bridge: ~25k조각→~320 폴리라인(78× 연속성↑), seam guard+bridge, 커버리지 유지. **완전 단일곡선은 아님**(워프 등위선 위상). 진짜 단일 나선은 #7 integrate |
| 4 | GitHub Pages 호스팅 | 동작 (라이브) | https://myplmy.github.io/mellanize/ · Actions 배포 파이프라인 그린 |
| 5 | 테스트 인프라 도입 시 `check-and-verify` 규약 정합 | 대기 | 아래 "스킬 인프라 상태" 참조 |
| 6 | CI Node 20 deprecation | 해결 | 액션 최신 메이저 pin(checkout v7·setup-node v6·upload-pages-artifact v5·deploy-pages v5, node-version 22) → node24 타깃. github changelog 2025-09-19 권장 해법(임시 env 회피 아님) |

---

## 작업 로그

### 2026-07-18 — #19 (주파수 필터: 하이/로우/밴드패스)

- **triage 결정(사용자)**: 적용 지점 **(a) 입력변형 + (b) 분석용 둘 다 분리 구현**. 방식 **공간 컨볼루션(Gaussian DoG) 채택**, **FFT는 신규 이슈 #37로 분리**.
- **#19 구현**: `pipeline/freqFilter.ts` `applyFreqFilter` — low=blur(σ)·high=0.5+(I−blur)·band=0.5+(blur σ_lo−blur σ_hi), [0,1] 클램프, 기존 gaussianBlur 재사용. **(a) 입력필터**: preprocess 뒤 procGray 에 적용(변환에 영향, 패널별 스냅샷 `inFilter` 포함, dirtyPreprocess 무효화). **(b) 분석필터**: 단일 뷰 paint 시 변환 결과 그레이에 적용해 표시(변환·다운로드엔 미영향). UI: 입력필터·분석필터 셀렉트(none/low/high/band) + 고급 `주파수 필터` 그룹의 in/out σ·σ_hi 슬라이더.
- **검증(구조)**: build(22 modules). (a) none 106→high 109→low 105 폴리라인 변화(입력이 변환에 영향)·reset 106 복귀·band 108. (b) outFilter=high 시 표시 ink 21910→37496 변화하나 폴리라인 106 불변(변환 미영향, 표시만). 필터 그룹 both-none 시 흐림·활성 시 표시. 콘솔 에러 0. 시각/튜닝은 사용자.
- **한계(정직)**: Gaussian DoG는 부드러운 응답(이상적 주파수 창 아님) → 정밀 대역은 #37(FFT). σ 클수록 저주파 컷.

### 2026-07-18 — #20 (IQA: MSE/PSNR/SSIM)

- **#20 구현**: `pipeline/iqa.ts` `computeIqa(ref,test,w,h)` — MSE(전역), PSNR(dB, 범위1), SSIM(8×8 비겹침 블록 평균, c1=.01²·c2=.03²). `updateIqa`가 그레이 원본(`procGray.data`) vs 변환 결과(`canvasGray(transformCanvas)` Rec.709 luma)를 동일 작업 해상도로 비교 → `#iqa`에 표시, 단일/비교 뷰 render마다 갱신(quad 에선 clear).
- **검증(구조)**: build(21 modules). 로드 시 MSE 0.21·PSNR 6.7dB·SSIM 0.01 표시(유효 범위 mse∈[0,1]·psnr>0·ssim∈[-1,1]), pitch 변경 시 값 갱신, quad 전환 시 clear·단일/비교 복귀 시 재표시. 콘솔 에러 0.
- **주의(이슈 명시)**: 사진↔선화 구조 차이로 SSIM 절대값 해석 주의 → 옵션 간 상대 비교·튜닝 지표로 활용. 값 해석·튜닝은 사용자.

### 2026-07-18 — #23 (원본 해상도 변환·다운로드)

- **triage 결정(사용자)**: **(a)+(b) 둘 다 스위치 제공**. (b) 기본.
- **#23 구현**: `원본해상도` 방식 셀렉트(scale/reprocess) + `원본 해상도 내보내기` 버튼. **(b) 좌표 스케일업**: 작업 해상도(≤1024)서 워커 분석 후 폴리라인 좌표·두께를 ×(origW/workingW)로 확대. **(a) 재처리**: `decodeFullGray`로 원본 풀 해상도 재디코드 → 전처리 → 워커 buildPolylines(#9 재사용, center scale 보정). 출력은 output_target 따름(svg 벡터 / png `toDataURL`, `mellanize-original.*`). 진행 상태 텍스트 + 버튼 disable. `loadImage`가 origW/origH 반환, 원본 File 보관.
- **검증(구조)**: build(20 modules). 1600×1200 입력→작업 1024×768(다운샘플). (b) SVG/PNG·(a) SVG 모두 원본 1600×1200 출력(viewBox·`<path>` 확인), 상태에 방식 표기, (a) 풀해상도 파이프라인 완료. 콘솔 에러 0. 시각/성능은 사용자.
- **한계(정직)**: (a)는 대형 이미지서 무거움(워커로 논블로킹하나 수초). (b)는 분석이 다운샘플 기반이라 미세 디테일은 선 위치에 미반영(선은 crisp). PNG 원본해상도는 큰 캔버스 `toDataURL`(메모리).

### 2026-07-18 — Slice #9 (output_target=svg + Web Worker + downsample)

- **#9 구현**: (1) **SVG 출력** `pipeline/svg.ts` `svgFromPolylines` — stroke-width가 경로 따라 못 변하므로 각 폴리라인을 **오프셋 아웃라인 폴리곤**(점별 ±t/2 좌/우 오프셋 후 닫음)으로 채워 단일 `<path fill>` 벡터. (2) **output_target 스위치**(canvas/svg) + **다운로드 버튼**(svg=벡터 blob, canvas=PNG `toDataURL` 동기). (3) **Web Worker** `worker.ts`가 `buildPolylines` 오프로드 → `computePolylines` Promise 래퍼, `render`/`renderPanel` async화, **최신-우선 토큰**(single 1개 + 패널 4개)으로 stale 폐기. 전처리(procGray)는 메인 유지(비교 그레이 원본용). (4) downsample_max 1024 기존 유지 + SVG 벡터 출력.
- **검증(구조)**: build(20 modules, 별도 worker 청크 11kB 생성). single/compare/quad 전부 워커 async 렌더로 ink 생성(콘솔 에러 0), buildPolylines가 메인에 없음에도 렌더됨 = 워커 실행 확증(네트워크 worker.ts 로드 확인). SVG 다운로드 = `image/svg+xml`·`<path>` 포함·mellanize.svg, PNG = `data:image/png;base64…`·mellanize.png. 최신-우선: pitch 4→20→8 연타 후 8 결과로 수렴. 시각/성능 체감은 사용자.
- **한계(정직)**: 워커는 buildPolylines만(전처리는 메인, CLAHE는 상대적으로 가벼움). SVG는 폴리라인마다 오프셋 폴리곤이라 integrate(2.8만점)는 큰 파일. 브라우저 자동화 환경에서 `canvas.toBlob` 미동작 → PNG는 `toDataURL`로 구현(견고). **원본 해상도 래스터 출력은 #23**(SVG는 이미 해상도 독립).

### 2026-07-18 — Slice #22 (4분할 비교 뷰)

- **#22 구현**: 뷰 모드에 `quad` 추가 → 2×2 개별 캔버스 그리드(사용자 선택). **컨트롤 상태 직렬화**(`CtrlState`: 8 셀렉트 + P 18값 + center)로 `readLive`/`applyState`/`configFrom`/`cloneState` 리팩터(기존 `config()`=`configFrom(readLive())`). 패널별 스냅샷 저장, 패널 클릭=선택+스냅샷 로드(재렌더 없음), 라이브 컨트롤 편집=활성 패널만 갱신·재렌더(나머지 유지, auto-regen도 활성만). **패널 축소 렌더**: `downsampleGray`로 장변 `quadRes`(기본 512) 최근접 다운샘플 후 파이프라인 실행(center는 scale 보정) — 해상도는 슬라이더 노출(하드코딩 안 함, 사용자 선택).
- **검증(구조)**: build(19 modules). 진입 시 4패널=라이브 복제(ink 동일 28316), 패널0 편집→패널0만 변경·나머지 유지, 패널2 클릭→활성 전환+phasefield 로드, 패널별 스냅샷 지속(패널0 skeleton·패널2 integrate 각자 유지), quadRes 128<240→128²로 축소·1024는 원본 유지(다운샘플만), 단일 복귀 정상. 콘솔 에러 0. 시각/UX는 사용자.
- **한계(정직)**: 4분할에서 캔버스 클릭은 패널 선택이라 나선 중심 지정 불가(중심은 단일 뷰에서). 축소 렌더는 pitch가 픽셀 단위라 단일 뷰(1024)와 밀도가 다를 수 있음 — 패널 상호 비교엔 무해(동일 quadRes), 단일 충실도 원하면 슬라이더 상향.

### 2026-07-18 — Slice #21 (before-after 비교 뷰)

- **#21 구현**: 뷰 모드 셀렉트(단일 / 비교)+ 비교 옵션(원본 컬러·그레이 / 세로·가로 분할 / 절취선 드래그·커서추종). `loadImage`가 원본 컬러 캔버스 보존(기존엔 gray 변환 후 폐기), `grayToCanvas`로 procGray→그레이 원본. **변환은 오프스크린 `transformCanvas`에 캐시**, `paint()`가 원본/변환을 절취선으로 클립 합성 → 절취선 이동 시 변환 재계산 없이 합성만(매끄러움). 단일 뷰는 클릭=중심, 비교 뷰는 pointer=절취선(모드 가드).
- **검증(구조)**: build(19 modules). 컬러 원본 좌=red[71,0,18]/우=변환 achromatic, 그레이 전환 시 좌 achromatic[52,52,52], 세로↔가로 전환·follow/drag 절취선 이동 정상(drag는 pointerdown 없는 move 무시), 단일 복귀 시 옵션 숨김. 콘솔 에러 0. 시각/UX는 사용자.
- **재사용 대비**: 오프스크린 렌더·원본 취득을 #22(4분할)가 재사용하도록 분리(영향도 분석 권장안 B). 렌더 파이프라인 무변경(디스플레이 레이어).

### 2026-07-18 — Slice #18 (고급 설정 모드별 그룹화 + 툴팁)

- **#18 구현**: `SPECS`에 `group`·`tip` 추가 → 고급 패널을 영향 모드/단계별 7섹션(공통·α·anisotropic·integrate·warp·coverage·preproc)으로 그룹화. 전 파라미터 행·입력에 hover 툴팁(의미+영향, types.ts JSDoc 근거). `refreshGroups()`: 현재 선택과 무관한 그룹 흐리게(AC #3). 기본 패널은 평탄 유지+툴팁만.
- **검증(구조)**: build(19 modules). 7그룹 섹션·헤딩·전 행 툴팁 확인, mode/coverage 전환 시 `.inactive` 토글·복원 정상, range↔number 동기화·엔드투엔드 렌더 회귀 없음, 콘솔 에러 0. 렌더 파이프라인 무변경.
- PR #31 merged, 배포 success, 라이브 200, #18 closed(해소 코멘트).

### 2026-07-12 — 세션 핸드오프 + 상태 동기화

- **핸드오프 메모**: [`.claude/handoff/session_20260712_core_pipeline_1to8.md`](../.claude/handoff/session_20260712_core_pipeline_1to8.md) (세션 맥락·착수 가이드; 정본 상태는 본 파일).
- **동기화 점검**: 해소 이슈 #1~8·#14·#26·#27 전부 해소 코멘트 보유(누락 없음). 본 DEV_REGISTRY 최신. 추가 doc 동기화 불필요.
- **코어 파이프라인(Slice 1~8 + #14·#26·#27) 완료·배포**. 남은 슬라이스 #9·#10, 신규 UI/처리/분석 이슈 #18~#23. 다음 권장: #18.

### 2026-07-12 — Slice 8 (tone_channels·coverage_extent·λ cap) + #27 (startAngle)

- **Slice 8(#8)**: `tone_channels`(thickness_only / thickness_plus_spacing — `tone.ts` D=1−I 주파수분해: dLow→간격[phasefield 워프항], dHigh→두께). `coverage_extent`(diagonal / fixed_turns=N·pitch; phasefield는 레벨 상한 N). **λ gap cap**: phasefield λ_eff=min(λ, 0.8·pitch)로 워프<0.4턴 → 단조성·비교차 보장.
- **#27 startAngle(0~359°)**: archimedes 회전(skeleton·warp), phasefield θ 브랜치컷 회전, integrate 시드 방향 회전. 4모델 반영.
- **검증(구조)**: build(19 modules). startAngle 0↔90 diff 25%, tone_only↔plus 33.5%, fixed_turns8 먼코너 0 vs diagonal 0.62, λ cap(λ10=λ7 동일) 활성. 시각은 사용자.
- **미세**: tone_plus_spacing 간격 채널은 phasefield 워프에 dLow 주입한 근사(integrate/warp는 두께만). integrate startAngle은 시드 회전(근사).

### 2026-07-12 — #26 integrate 커버리지 분석·수정 + 신규 이슈(#27 start angle)

- **#26 원인 분석(실측)**: integrate 점수 ≈ 경로/step. 고정 상한 400k가 큰 rMax(off-center)에서 truncate → 부분 커버. 더 깊게: integrate는 **이미지 텐서 유선**을 따르므로 궤적이 텐서 지배적 → off-center 시드는 텐서 궤도에 끌려 불균등(캡·αCap 조절로도 해결 안 됨). 커버리지 그리드로 확인.
- **수정**: 고정 400k → **rMax 기반 동적 상한(π·rMax²·4/(pitch·step), 상한 1M)**. `integrateAlphaCap`(텐서 상한) 사용자 파라미터 노출. 라디얼-진행 클램프 시도했으나 내부 winding 붕괴로 폐기(단조 클램프 유지).
- **검증**: 중심 배치 = 28k점(유계, 67ms), 5×5 그리드 전 셀 0.45~0.87 **균등 전면 커버**. off-center(코너)는 잔여 불균등 = 모델 특성으로 문서화(균등 필요 시 warp/phasefield 또는 중앙 시드).
- **#27 신설**: 나선 시작각(startAngle 0~359°). #8과 함께 구현 권장(나선 생성 레이어).

### 2026-07-12 — Slice 7 (integrate·warp 벡터 모델)

- **Slice 7(#7) 구현**: `vectorModels.ts` — integrate(V_final RK4 + α cap 0.85 단조 클램프 + 역행 방지 + 대각 rMax 종료), warp(기준 나선 샘플 + 변위 |δ|<pitch/2). `sign_handling`(tensorblend 이중각 보간+연속성 / spiralalign 벡터블렌드), `line_orientation`(along v₂ / across v₁ / switch β) config·UI 추가. deformationModel 스위치 4종(phasefield/integrate/warp/skeleton).
- **검증(구조)**: build tsc(18 modules). **integrate 폴리라인 1개**(28,094점, 74ms, 코너 커버) = 진짜 단일 연속 나선. warp 1개(20,942점). sign_handling diff 30.6%, line_orientation diff 52.2% → 스위치 구별. 무한루프 없이 종료. 시각 판단은 사용자.
- **의의**: #14가 못 준 "단 하나의 나선"을 integrate가 태생적으로 제공.

### 2026-07-12 — #14 phasefield 연속성 개선 + 신규 이슈 5건

- **#14 구현**: 렌더 프리미티브 세그먼트→**정렬 폴리라인**. `marchingSquares.isoPolylines`: 레벨별 marching → 끝점 인접 chain → θ 정렬 → 레벨 오름차순 근접 bridge. `render.renderPolylines`, `buildPolylines`(StrokePoint[][]). types StrokeSeg→StrokePoint/Polyline.
- **검증(구조)**: build tsc(17 modules). phasefield 무순서 ~25k → **정렬 폴리라인 322(aniso)/317(tone)**(78× 연속성↑, 평균 ~81점/폴리라인), 커버리지 유지, skeleton 1폴리라인. **한계: 완전 단일곡선 아님**(등위선 위상 분절) → 진짜 단일 나선은 #7 integrate. 시각 판단은 사용자.
- **신규 이슈 5건**(사용자 요청): #18 툴팁·그룹화, #19 주파수 필터(triage), #20 IQA, #21 before-after(세로/가로 분할 옵션), #22 4분할, #23 원본해상도 변환·다운로드(#9 밀접). 별도 트랙 작업순서 마련. 모두 #14와 독립(다른 계층)이라 미포함.

### 2026-07-12 — Slice 6 (alpha_source 버전 meanH·mixed)

- **Slice 6(#6) 구현**: `alpha_source` = grad/meanH/mixed. `derivatives.secondDerivatives`(σ 블러 후 유한차분), `curvature.ts`(meanCurvatureMag |H|, gaussCurvatureMag |K|; f=c·I), `alpha.computeAlpha`(소스별 스칼라→정규화→Perona-Malik). c(밝기→높이 스케일) 고급 파라미터. UI α 스위치.
- **검증(구조)**: build(tsc). 3소스 크래시 없이 렌더, 상호 diff grad↔meanH 4.8%·grad↔mixed 1.7%·meanH↔mixed 4.7% → 소스별 구별됨. 시각 우열은 사용자.
- **follow-up**: mixed 가중치(0.5/0.3/0.2) 고정 — 필요 시 노출.

### 2026-07-12 — #14 영향도 검토 + Slice 5 (전처리 옵션)

- **#14 cross-slice 영향도 검토**(사용자 요청): #14는 **phasefield 전용**(integrate/warp는 태생적 단일선). #5·#6 완전 독립(재작업 0), #8 상보적, **#9(SVG)는 렌더 프리미티브 세그먼트→폴리라인 파급 → #14를 #9 앞에**, #10은 #14 이후. 결론: 계획대로 진행하되 #14만 #9·#10 앞으로. 사용자 승인.
- **Slice 5(#5) 구현**: `preprocess` = luma_clahe(기본)/luma_only/user_adjust. `preprocess.ts`(CLAHE 타일 clip+bilinear, 대비·감마). raw luma vs 전처리본 분리 + dirtyPreprocess 지연 재계산(비-preproc 파라미터 변경 시 CLAHE 재계산 안 함). UI preprocess 스위치 + contrast/gamma 고급 슬라이더.
- **검증(구조/수치)**: build(tsc). 3모드 크래시 없이 렌더, CLAHE vs luma_only diff 8.4%, user_adjust(contrast 2.2) 11.5% → 전처리가 파이프라인 입력을 실제로 바꿈. 시각 우열은 사용자.

### 2026-07-12 — Slice 4 (파라미터 UI) + 작업 원칙 + phasefield seam 이슈(#14)

- **Slice 4(#4) 구현**: 기본(pitch·T_max·λ) + 고급 접이식(T_min·σ·ρ·diffIters·diffKappa·alongIters·alongStrength·alongReach) 파라미터를 슬라이더+수치 병행 컨트롤로 노출. auto_regenerate 토글(디바운스 200ms)+Render 버튼. center_mode=click(캔버스 클릭 중심). #4 범위를 확장해 그간 하드코딩하던 엔진 수치 전부 노출.
- **작업 원칙 확립**: AI는 수치·구조 검증만, 시각 품질 판단·수치 튜닝은 사용자 (memory: ai-verify-numeric-user-tunes-visual). 검증도 배선·값전달·크래시·커버리지만 확인.
- **검증(구조)**: build(tsc). 컨트롤 3기본+8고급 생성, pitch 변경→segs 반영(auto ON), auto OFF시 미갱신+Render로 반영, center 클릭 반영. 시각 평가는 사용자.
- **#14 신설(사용자 지적)**: anisotropic 사용 시 (a) +x축 seam 역방향·갭, (b) 동심 등고선(단일 연속선 아님, stitch 미구현), (c) 중간 끊김. 현재 계획에 없어 bug 이슈로 트래킹. 진짜 단일 연속선은 stitch(#14) 또는 integrate 모델(#7).

### 2026-07-12 — Slice 3 (이방성 워프 = along) + v2 문서 공식 정정

- **Slice 3(#3) 구현**: `warp_mode=anisotropic`. 구조텐서 고유분해(`orientation`: v₂·coherence) → `alongSmooth`(위상장을 v₂ 따라 방향성 평활, coherence 가중, reach 파라미터, seam guard) → 기본 조합 phasefield+grad+along 완성. UI에 warp_mode 스위치.
- **v2 문서 §5.A 공식 오류 정정**: 확산 텐서를 `v₁ 강`으로 적었으나 목표(∇n'∥v₁, 선∥v₂)엔 `v₂ 강`이 옳음. 문서·코드 교정.
- **검증**: build(tsc, 15 modules). 대각 그래디언트(coherence 전역≈1)에서 anisotropic이 선을 반대각(v₂)으로 전역 재정렬 확인 — 지배 grad각 tone_only −11.4°(무방향 spiral) → anisotropic **+47.6°**(선 −45°). 커버리지 코너 잉크 유지.
- **한계(정직)**: 얇은 고립 에지(수직 여유 부족)에선 효과 약함(국소 jog). 실사진의 넓은 구조에선 유효. 강도 튜닝은 #10(미학 캘리브레이션). reach/iters/strength 기본값은 커버리지-안전 범위로 잡음.
- **미비**: λ 상한(monotonicity gap cap) 여전히 미구현(#8에서).

### 2026-07-12 — Slice 2 (phasefield 톤 워프) + CI node24

- **Slice 2(#2) 구현**: 공통 전처리(Sobel `derivatives` + `structureTensor`) → `alpha`(grad, Perona-Malik 확산) → `phasefield`(턴 좌표 + tone_only 워프) → `marchingSquares`(정수 등위선) → 가변폭 렌더. deformation_model 스위치(skeleton/phasefield) + λ 컨트롤.
- **검증**: 빌드(tsc strict, 14 modules) + 브라우저. 커버리지 코너 전부 잉크, 두께=톤. **warp 기하 작동은 λ 의존**(λ1.5≈skeleton, λ5 에지 bunching 1.6→2.2) → 기본 λ 1.5→4 상향.
- **개념 정정(중요)**: `tone_only` 워프는 **에지 구동 간격 변조**(α가 에지에서 급증)이지, "어두운 영역 전역 조밀"이 아니다. 톤→밀도(dark=denser)는 `thickness_plus_spacing`(Slice 8, 주파수 분해)의 몫. #2 AC 문구 해석 시 유의.
- **미비/후속**: λ 상한(monotonicity gap cap) 미구현 → 과대 λ 시 자기교차 위험(Slice 3/8에서 보강). θ=0 seam 얇은 갭(marchingSquares 브랜치컷 skip).
- **CI**: node20 deprecation 해소(PR #11, checkout v7·setup-node v6·upload-pages-artifact v5·deploy-pages v5).

### 2026-07-11 — 티켓 분해 + Slice 1 구현·배포

- **티켓 분해(to-issues)**: v2를 tracer-bullet 수직 슬라이스 10개로 분해 → GitHub 이슈 #1~#10 생성(트래커=GitHub, needs-triage 라벨). 우선 경로 #1→#2→#3(기본 조합).
- **기술 스택**: Vite + TS + Canvas, GitHub Actions로 Pages 배포. (setup-matt-pocock-skills 미실행 — 트래커는 이번에 GitHub로 임시 확정. 정식 설정은 필요 시 그 스킬로.)
- **Slice 1 완료·배포**: 업로드→그레이스케일(Rec.709)→왜곡 없는 아르키메데스 나선→가변폭 Canvas 렌더. 로컬 검증(ink 비율 중심 0.748→코너 0.159, 어둠→굵기 단조) + 라이브 배포(HTTP 200). 커밋 805d716.
- **pipeline 모듈 구조**: grayscale/spiral/render/index 분리 — 후속 슬라이스에서 나선 자리에 deformation_model, 앞에 α·구조텐서 삽입.

### 2026-07-11 — 파이프라인 v2 설계 (grill 차수 3, 종료)

- **구현 세부 확정** (v2 §1·§5.A·§8 반영), 모두 옵션화:
  - `warp_mode`(phasefield): **anisotropic(along 실현, 구조텐서 이방성 확산으로 등위선 법선을 v₁ 정렬)** / tone_only. → phasefield+along 정합성 공백 해소.
  - `preprocess`: **luma_clahe(기본)** / luma_only / user_adjust(고급).
  - 파라미터 UI: 슬라이더 + 수치 입력 병행, `auto_regenerate` 토글(디바운스)로 렌더 폭주 방지.
  - 성능: **내부 다운샘플(장변 1024px 기본) + Web Worker** 오프로드. WASM은 구현비용 중대라 실시간 원해상도 요구 시에만 후속.
- **grill 종료**: 설계 트리 수렴, v2 문서가 단일 소스. 다음 단계는 구현 티켓 분해(#5).

### 2026-07-11 — 파이프라인 v2 설계 (grill 차수 2)

- **구현·전달 계층 확정** (v2 §6·§8 반영), 모두 옵션화 + 기본값:
  - `output_target`: **canvas(기본)** + svg 병행(렌더러 2종, 백엔드 공유).
  - `center_mode`: **click(기본)** + auto(검출, 폴백 이미지중심).
  - `tone_channels`: **thickness_only(기본)** + thickness_plus_spacing. 분담 기준 = **주파수 분해**(간격←D_low 저역, 두께←D_high 고역). 2차 나선 중첩 폐기, 단일선 준수.
  - `coverage_extent`: **diagonal(기본)** + fixed_turns.
- **핵심 발견**: **phasefield는 선 간격 변조가 이미지로부터 자동 발생**(간격 ≈ 1/|∇n'|, 워프가 간격을 구동). integrate/warp에는 없음 → 이 경우 두께/간격 분담 기준 필요. phasefield 우위 근거 추가.

### 2026-07-11 — 파이프라인 v2 설계 (grill 차수 1)

- **v1 심층 검토 → v2 모듈형 설계 확정** ([`claude_mellan_pipeline_v2.md`](claude_mellan_pipeline_v2.md)). 4개 교체축:
  - `deformation_model`: **phasefield**(권장·커버리지/비교차/부호문제 동시 해결) / integrate(+단조클램프) / warp — 3종 모두 구현 가능 검토 완료.
  - `alpha_source`: **grad(1안) / meanH(2안) / mixed(4안) 버전 분리 생성**. v1의 gaussK(|K|)는 원통형·평면음영 form 손실로 기본 제외(mixed 보조항만).
  - `line_orientation`: along(v₂, 기본) / across(v₁) / switch(β 정렬도 기반).
  - `sign_handling`(integrate/warp 전용, 사용자 선택): **tensorblend**(연속, 권장) / spiralalign(단순, ⊥지점 불연속). phasefield는 불필요.
- **확정 근거**: v1의 자유 적분은 반경 단조성 미보장(빈틈/자기교차), v₂ 부호 모호성(§5 벡터블렌딩 역주행 잠재). phasefield 등위선이 둘 다 구조적으로 해소.
- **v1 정합성 nit**: §1 K 공식 분자에 `c²` 누락(정규화로 무해) → v2에서 정정.

### 2026-07-11 — 스킬 인프라 정리 + 프로젝트 정의

- **워크플로우 스킬 4종 범용화**: `foldtheteam-*` 접두어 제거 → `plan-doc` / `pr-workflow` / `impact-analysis` / `session-handoff`. 프로젝트 고유 상수는 [`.claude/project.json`](../.claude/project.json)으로 외부화. FoldTheTeam 전용 경로·브랜치·문서명·도메인 예시 전부 제거.
- **`make-tests` 삭제**: 현재 테스트 불필요.
- **`check-and-verify` 범용화**: SKILL.md에서 FoldTheTeam 참조 제거. 스크립트(`checkbox_tool.py`)는 원래 프로젝트 중립.
- **프로젝트 정의 확정** (CLAUDE.md 반영): 이미지 → Claude Mellan 스타일 변환 알고리즘 + GitHub Pages 웹페이지 제공.

---

## 스킬 인프라 상태

- **범용 스킬 (설정 주입형)**: `plan-doc`, `pr-workflow`, `impact-analysis`, `session-handoff` — 동작을 바꾸려면 `.claude/project.json`만 수정.
- **`check-and-verify`**: 범용화 완료. 단, 자동 실행 분류가 **pytest + `test/`·`scripts/` 디렉토리 관행**을 전제한다. 이 프로젝트가 다른 테스트 러너·경로를 쓰게 되면 `scripts/checkbox_tool.py`의 `classify_command` 정규식을 조정해야 한다 (미결 #4).
- **프로젝트 무관 스킬**: `grill-me`, `grill-with-docs`, `to-prd`, `to-issues`, `triage`, `zoom-out`, `setup-matt-pocock-skills` — 그대로 사용.

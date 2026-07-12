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
| 3 | v2 알고리즘 구현 | 진행 중 (Slice 7/10) | Slice 1~7 + #14 완료. **integrate/warp = 진짜 단일 연속 나선**(#14 phasefield가 못 준 부분 해결). 다음: #8 |
| 7 | phasefield 단일연속선(#14) | 부분 완료 | 세그먼트→정렬 폴리라인 chain+bridge: ~25k조각→~320 폴리라인(78× 연속성↑), seam guard+bridge, 커버리지 유지. **완전 단일곡선은 아님**(워프 등위선 위상). 진짜 단일 나선은 #7 integrate |
| 4 | GitHub Pages 호스팅 | 동작 (라이브) | https://myplmy.github.io/mellanize/ · Actions 배포 파이프라인 그린 |
| 5 | 테스트 인프라 도입 시 `check-and-verify` 규약 정합 | 대기 | 아래 "스킬 인프라 상태" 참조 |
| 6 | CI Node 20 deprecation | 해결 | 액션 최신 메이저 pin(checkout v7·setup-node v6·upload-pages-artifact v5·deploy-pages v5, node-version 22) → node24 타깃. github changelog 2025-09-19 권장 해법(임시 env 회피 아님) |

---

## 작업 로그

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

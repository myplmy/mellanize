# Session Handoff — 2026-07-12 (core_pipeline_1to8)

> 이전 세션: 없음(첫 핸드오프). 본 파일 = 진행 상태 스냅샷. **정본 상태는 [`docs/DEV_REGISTRY.md`](../../docs/DEV_REGISTRY.md)** (작업 로그·TODO). 본 메모는 그 위의 세션 맥락·착수 가이드만 담는다(중복 최소화).

---

## § 1. 세션 요약

**기간**: 2026-07-11 ~ 2026-07-12

**최대 성과**:
1. `foldtheteam-*` 워크플로우 스킬 4종 **범용화** + [`.claude/project.json`](../project.json) 설정 외부화 + CLAUDE.md/DEV_REGISTRY 신설. `make-tests` 삭제, `check-and-verify` 범용화.
2. **v2 파이프라인 모듈형 설계** 확정(grill 3차수) → [`docs/claude_mellan_pipeline_v2.md`](../../docs/claude_mellan_pipeline_v2.md). 4 교체축(deformation_model / alpha_source / line_orientation·sign_handling / warp_mode) + 전처리·톤·커버리지.
3. **Slice 1~8 + #14·#26·#27 구현·배포**. 라이브: https://myplmy.github.io/mellanize/ (HTTP 200). 4 deformation 모델(phasefield/integrate/warp/skeleton) 동작.

**머지된 PR**: #11(CI node24), #12~#17(Slice2~6), #24(#14), #25(Slice7), #28(#26), #29(Slice8+#27) 등 — 상세는 DEV_REGISTRY 작업 로그.

---

## § 2. 현재까지 구현된 사항

### 코드 (main 병합·배포 완료)
- Vite+TS 정적 앱. `src/pipeline/` 모듈: `grayscale · spiral · derivatives · structureTensor · curvature · alpha · phasefield · anisoWarp · marchingSquares · vectorModels · tone · render · index`.
- deformation 4종, alpha 3종(grad/meanH/mixed), warp_mode 2종, 전처리 3종, tone_channels 2종, coverage_extent 2종, line_orientation 3종, sign_handling 2종, startAngle, 파라미터 UI(기본+고급 슬라이더·auto-regen·center 클릭), CI(Actions node24 → Pages).

### 문서
- **정본 상태**: `docs/DEV_REGISTRY.md`. **설계**: `docs/claude_mellan_pipeline_v2.md`(v1은 원안). CLAUDE.md 갱신 섹션: "이 리포는 무엇인가 / 파이프라인 아키텍처 / .claude/skills".

---

## § 3. 향후 수행 우선순위

### 1순위: #18 고급 설정 그룹화 + 툴팁 (즉시 착수)
- **상태**: 컨트롤이 많아져(4모델·수많은 셀렉트/슬라이더) UX 정리 필요 = 지금 우선순위 높음.
- **핵심 사실**: 각 파라미터를 영향 모드별 그룹으로, hover 툴팁으로 의미·영향 설명. 렌더 파이프라인 무관(컨트롤 UI 레이어).
- 이슈 body에 AC 완비(ready-for-agent).

### 2순위 이하 (권장 순서)
| 순위 | 이슈 | 의존 |
|-|-|-|
| 2 | #21 before-after 비교(세로/가로 분할) → #22 4분할 | 독립(디스플레이) |
| 3 | #9 SVG·성능(Web Worker·downsample) + #23 원본해상도(밀접) | #14 이후(완료) |
| 4 | #19 주파수 필터(needs-triage: 적용지점 a/b/c 결정) / #20 IQA(MSE·PSNR·SSIM) | 독립 |
| 5 | #10 미학 캘리브레이션(HITL) | 코어 완료 후, 마지막 |

- **보류/미결**: #19·#23 needs-triage(설계 결정 대기). 각 이슈 body가 상세 spec — **재작성 말고 그 body를 따를 것.**

---

## § 4. 사용자 성향 / 세션 운영 스타일 (이번 세션 확립)

- **매 슬라이스 고정 사이클**: 피처 브랜치(off main) → 구현 → `npm run build` → **브라우저 구조 검증** → PR(body에 `Closes #N`) → `pr-workflow/scripts/merge_and_sync.sh <PR>` → 배포 run 그린 확인 → 라이브 HTTP 200 → **이슈 해소 코멘트(## ✅ 해소 구조)**.
- **AI는 수치·구조 검증만, 시각 품질 판단·수치 튜닝은 사용자** — memory [[ai-verify-numeric-user-tunes-visual]]. 튜닝 수치는 하드코딩 말고 **고급 슬라이더로 노출**.
- 설계는 **grill**(다안 비교, AI 해석 선보고 후 결정)로. 발견한 문제·추가 아이디어는 **즉시 신규 이슈로 트래킹** + 작업순서 편입.
- **정직한 한계 기록** 요구(과장 금지). 착수 전 영향도/포함가능성 검토 선호.

---

## § 5. 이번 세션에서 학습·기억한 사항

- **deformation 모델 특성**: phasefield=등위선(동심 아크 ~320, 완전 단일선 아님), **integrate=단일 유선(진짜 단일 나선; 단 커버리지가 이미지 텐서 지배 → 중앙 시드 권장, off-center 불균등)**, warp=변위(단일선), skeleton=기본.
- **단일 소스 포인터**: 설계=`docs/claude_mellan_pipeline_v2.md`, 상태·결정 로그=`docs/DEV_REGISTRY.md`, 파라미터 기본값=`src/main.ts` `P{}` + SPECS.
- **미해결 근사(정직)**: tone_plus_spacing 간격은 phasefield dLow 워프 주입 근사(integrate/warp는 두께만); integrate startAngle=시드 회전 근사; integrate off-center 불균등(모델 특성).
- **세션 도구 팁**: 내부 처리 다운샘플 장변 1024px. CI 액션 node24(checkout v7·setup-node v6·upload-pages-artifact v5·deploy-pages v5). gh 경로 `command -v gh || '/c/Program Files/GitHub CLI/gh.exe'`. 브라우저 스크린샷 툴 타임아웃 잦음 → 픽셀 readback(javascript_tool)으로 검증. 파일 업로드는 DataTransfer로 주입.

---

## § 6. 다음 세션 착수 가이드

"핸드오프 확인" 지시 시 이 순서로:

1. **CLAUDE.md 읽기** (프로젝트 정의·아키텍처·스킬 설정).
2. **본 파일 읽기**.
3. **`docs/DEV_REGISTRY.md` 읽기** — 작업 로그·미결 TODO(정본 상태).
4. **열린 이슈 확인**: `gh issue list --state open`. 우선순위 = **#18** 부터(§3).
5. 착수할 이슈 body 정독 + `docs/claude_mellan_pipeline_v2.md` 관련 섹션.
6. **브랜치**: `git checkout -b <slice-branch> main`.
7. **구현 → build → 브라우저 구조검증 → PR(`Closes #N`) → merge_and_sync → 배포 그린·라이브 200 → 해소 코멘트** (§4 사이클).

### 주의사항
- ⚠️ **시각 품질 판단·수치 튜닝 금지**(사용자 몫). AI는 배선·값전달·크래시·커버리지·빌드/배포 그린만 검증.
- ⚠️ 매 슬라이스 위 고정 사이클 준수. `git add -A` 금지(명시 경로).
- ⚠️ 새 발견/아이디어는 신규 이슈로 트래킹.
- ⚠️ 이슈 body의 spec을 재해석/재작성 말 것.

---

## § 7. 참조 경로 치트시트

- 리포 루트: `Z:\mellanize`
- 라이브: https://myplmy.github.io/mellanize/
- 정본 상태: `Z:\mellanize\docs\DEV_REGISTRY.md`
- 설계: `Z:\mellanize\docs\claude_mellan_pipeline_v2.md` (원안: `_v1.md`)
- 파이프라인 코드: `Z:\mellanize\src\pipeline\`
- 파라미터 기본값: `Z:\mellanize\src\main.ts` (`P` 객체 + `SPECS`)
- 스킬 설정: `Z:\mellanize\.claude\project.json`
- PR 헬퍼: `Z:\mellanize\.claude\skills\pr-workflow\scripts\merge_and_sync.sh`
- memory: `C:\Users\Uranus\.claude\projects\Z--mellanize\memory\`
- 이 핸드오프: `Z:\mellanize\.claude\handoff\session_20260712_core_pipeline_1to8.md`

---

*생성: 2026-07-12*

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 이 리포는 무엇인가

**mellanize** 는 2D 평면 이미지를 **클로드 멜랑(Claude Mellan) 스타일 판화**(연속된 단일 선의 두께·왜곡만으로 명암과 3D 질감을 표현하는 기법)로 변환하는 프로젝트다. 두 가지 산출물을 목표로 한다:

1. **변환 알고리즘** — 이미지를 Mellan 스타일로 바꾸는 기하학·수학 파이프라인. **정본 설계는 [`docs/claude_mellan_pipeline_v2.md`](docs/claude_mellan_pipeline_v2.md)** (모듈형 교체축). [`v1`](docs/claude_mellan_pipeline_v1.md)은 원안(초기 단일 파이프라인)으로 보존.
2. **웹 서비스** — 위 알고리즘을 **GitHub Pages**로 호스팅. 정적 사이트이므로 **변환은 전부 클라이언트(브라우저) 실행**이다 — Vite + TypeScript(strict) + Canvas 2D, 무거운 파이프라인은 Web Worker 오프로드.

> **현재 상태: 구현·배포 완료.** 라이브 <https://myplmy.github.io/mellanize/> (`main` push → GitHub Actions 자동 배포). v2 설계의 전 교체축 + UI/출력/분석 기능이 구현돼 있다. 남은 것은 **미학 캘리브레이션(HITL — 사람의 시각 판단 필요)** 뿐이다. 진행 중 작업·결정 로그·미결 항목은 [`docs/DEV_REGISTRY.md`](docs/DEV_REGISTRY.md)가 정본이다.

## 빌드 · 실행

```bash
npm install
npm run dev      # Vite 개발 서버(기본 5173). Claude Code 는 .claude/launch.json 의 "mellanize-dev" 사용
npm run build    # tsc(strict) + vite build → dist/
npm run preview  # 빌드 산출물 미리보기
```

- **테스트 러너는 두지 않는다**(의도적). 검증은 `npm run build`(타입) + **브라우저 구조 검증**(렌더 수치·배선·크래시 확인)으로 한다.
- 배포: `main` push → [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) → GitHub Pages.

## 파이프라인 아키텍처 (정본: `docs/claude_mellan_pipeline_v2.md`)

핵심 착상은 v1과 같다: **α 필드가 "이미지 결을 따를지(구조 텐서) vs 기준 나선을 유지할지"를 픽셀별로 가중**한다. v2는 이를 **교체 가능한 축**으로 모듈화했다. 어느 축을 건드리든 하류(선 생성·렌더 출력)에 파급됨을 전제로 변경할 것.

```
입력 → [전처리 preprocess] → [입력 주파수필터] → [α 소스 alpha_source]
                                                     │
                   ┌─────────────────────────────────┴──┐
                   │  deformation_model (4택 1)         │
                   │   phasefield  등위선 (기본)         │
                   │   integrate   RK4 단일 유선         │
                   │   warp        기준나선 + 변위       │
                   │   skeleton    순수 나선             │
                   └─────────────────────────────────┬──┘
                                                     │
        → 폴리라인 → [톤→두께 tone_channels] → 렌더 (canvas / SVG 아웃라인 폴리곤)
```

| 교체축 | 값 | 주 구현 모듈 |
|---|---|---|
| `deformation_model` | phasefield / integrate / warp / skeleton | `phasefield`·`marchingSquares` / `vectorModels` |
| `alpha_source` | grad / meanH / mixed | `alpha`·`curvature` |
| `line_orientation` · `sign_handling` | along·across·switch / tensorblend·spiralalign | `vectorModels` |
| `warp_mode` | tone_only / anisotropic | `anisoWarp` |
| `tone_channels` | thickness_only / thickness_plus_spacing | `tone` |
| `coverage_extent` | diagonal / fixed_turns | `index` |

**모듈 맵** (`src/pipeline/`): `grayscale · preprocess · freqFilter · fft · derivatives · structureTensor · curvature · alpha · phasefield · anisoWarp · marchingSquares · spiral · vectorModels · tone · render · svg · iqa · index`. 무거운 `buildPolylines` 는 [`src/worker.ts`](src/worker.ts)에서 실행(UI 논블로킹, 최신-우선 토큰).

**앱 셸** ([`src/main.ts`](src/main.ts)): 뷰 모드(단일 / 비교 절취선 / 4분할 패널 스냅샷), 파라미터 컨트롤(기본 + 고급 그룹·툴팁), 출력(canvas PNG / SVG 벡터), 원본 해상도 내보내기, 주파수 필터(입력 a / 분석 b), IQA 표시.

**파라미터 단일 소스**: 기본값은 `src/main.ts` 의 `P{}` + `SPECS` 배열 **한 곳**에서 정의한다 — 하드코딩 산재 금지. 튜닝 대상 수치는 반드시 **슬라이더로 노출**한다(사용자가 시각 판단으로 조정).

## 문서 작성 규약

- **한글 본문 · 영문 식별자**: 설계 문서와 스킬 전반이 이 규약을 따른다. 섹션 제목·설명은 한글, 변수·파일명·수식 기호는 영문/수학 기호. 새 문서도 이 규약을 유지.
- 수식은 LaTeX(`$...$`, `$$...$$`) 로 표기한다(`docs/claude_mellan_pipeline_v1.md` 참조).

## `.claude/skills/` — 워크플로우 스킬

`.claude/skills/` 에는 다수의 작업 스킬이 있다. 이 중 4종(`plan-doc`, `pr-workflow`, `impact-analysis`, `session-handoff`)은 별도 프로젝트(FoldTheTeam)에서 이식된 뒤 **범용화**되었다 — 프로젝트 고유 상수는 스킬에서 분리하여 [`.claude/project.json`](.claude/project.json) 한 곳에서 읽는다.

**스킬을 다른 프로젝트에 이식하거나 이 리포에서 동작을 바꾸려면 `.claude/project.json`만 수정한다.** 주요 키:

| 키 | 사용 스킬 | 의미 |
|---|---|---|
| `excludedPaths` | pr-workflow | PR staging에서 영구 제외할 경로 (기본: 개인 설정·`.env`) |
| `baseBranch` | pr-workflow | PR base 고정값. `null`이면 자동 감지 |
| `planDir` / `planDoneDir` | plan-doc | 기획 문서 위치 (이 리포: `docs/`) |
| `handoffDir` | session-handoff | 세션 핸드오프 메모 위치 |
| `domainAxes` | impact-analysis | 범용 5축 외 프로젝트 고유 영향 축 |
| `docImpactTargets` | pr-workflow | PR "Doc Impact" 평가 대상 정본 문서 (비면 섹션 생략) |
| `singleSource` | plan-doc | 하위 문서에서 재정의 금지할 정본 수치·enum·수식 |

`check-and-verify`(PR/Issue Test plan 체크박스 검증)도 범용이다. 프로젝트 무관 범용 스킬(`grill-me`, `grill-with-docs`, `to-prd`, `to-issues`, `triage`, `zoom-out` 등)은 그대로 사용 가능하다.

> 세션 핸드오프 메모(`.claude/handoff/session_YYYYMMDD_<topic>.md`)는 **git 추적 대상**이다 — 작성 후 명시 경로로 staging 하여 PR에 포함한다. 효력이 끝난 메모는 후속 PR에서 정리한다.

> 스킬 인프라의 진행 상태·잔여 조정 항목은 [`docs/DEV_REGISTRY.md`](docs/DEV_REGISTRY.md) 참조.

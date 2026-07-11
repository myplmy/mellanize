# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 이 리포는 무엇인가

**mellanize** 는 2D 평면 이미지를 **클로드 멜랑(Claude Mellan) 스타일 판화**(연속된 단일 선의 두께·왜곡만으로 명암과 3D 질감을 표현하는 기법)로 변환하는 프로젝트다. 두 가지 산출물을 목표로 한다:

1. **변환 알고리즘** — 이미지를 Mellan 스타일로 바꾸는 기하학·수학 파이프라인 ([`docs/claude_mellan_pipeline_v1.md`](docs/claude_mellan_pipeline_v1.md)).
2. **웹 서비스** — 위 알고리즘을 **GitHub Pages**로 호스팅하여, 사용자가 이미지를 올리면 변환해 주는 웹페이지 제공. (정적 사이트이므로 변환은 클라이언트 측 실행이 전제 — 구현 시 JS/WASM 등 방식 결정 필요.)

> **현재 상태: 설계(spec) 단계.** 구현 코드·빌드 시스템·테스트가 아직 없다(빈 `main`). 유일한 실질 산출물은 위 설계 명세다. "빌드/린트/테스트 실행법" 은 아직 존재하지 않는다 — 구현 착수 시 이 파일에 추가할 것. 진행 중 작업·미결 항목·결정 로그는 [`docs/DEV_REGISTRY.md`](docs/DEV_REGISTRY.md)에 기록한다.

## 파이프라인 아키텍처 (`docs/claude_mellan_pipeline_v1.md`)

명세의 핵심은 **국소 에지에 치우치지 않고 전역 기하 구조를 반영하는 가변 가중치 벡터장 블렌딩**이다. 6단계가 다음 순서로 의존한다:

```
입력 이미지 I(x,y)
  │
  ├─[1] 몽주 패치 → 가우시안 곡률 K → 초기 알파 α₀ = Normalize(|K|)
  │
  ├─[2] 푸아송/이방성 확산 스무딩 → 전이 영역 매끈한 α(x,y)
  │        (Dirichlet BC: 고곡률=1, 배경=0)
  │
  ├─[3] 구조 텐서 J → 최소 고유벡터 v₂ → V_tensor   (에지 흐름 방향)
  ├─[4] 아르키메데스 나선 r=aθ         → V_spiral   (기준 회전 방향)
  │
  ├─[5] 블렌딩 V_final = Normalize((1-α)·V_spiral + α·V_tensor)
  │        → RK4 유선 적분 → 궤적 점집합 P (선의 중심축/skeleton)
  │
  └─[6] 음영→두께 사상 t_k = T_min + (1-I)·(T_max-T_min)
           → 가변 두께 스트로크 래스터화
           → 겹침 방지 피드백: 인접 선이 충돌 위험이면 해당 α 상한을 감쇄해
             V_spiral 복원력을 높임 (§6 예외 연산)
```

핵심 설계 의도: **α 필드가 "이미지 결을 따를지(tensor)" vs "기준 나선을 유지할지(spiral)" 를 픽셀별로 가중**한다. 1~2단계가 α 를, 3~4단계가 두 벡터장을 만들고, 5단계가 결합·적분, 6단계가 렌더링한다. 어느 단계를 건드리든 이 의존 사슬의 하류(특히 5·6단계 출력)에 파급됨을 전제로 변경할 것.

전역 파라미터(§0): `a`(나선 피치), `T_max`/`T_min`(선 두께 범위), `h`(적분 스텝), `σ`(가우시안 커널), `c`(밝기→높이 스케일). 이 값들은 명세 §0 이 단일 소스다 — 구현 시 하드코딩 산재를 피하고 한 곳에서 관리할 것.

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

> 스킬 인프라의 진행 상태·잔여 조정 항목은 [`docs/DEV_REGISTRY.md`](docs/DEV_REGISTRY.md) 참조.

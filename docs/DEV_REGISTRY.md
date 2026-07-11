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
| 5 | v2 구현 계획 수립 (to-issues/plan) | 미착수 | v2 §7 버전 목록·교체축을 구현 티켓으로 분해 예정 |
| 2 | v2 알고리즘 구현 | 미착수 | [`claude_mellan_pipeline_v2.md`](claude_mellan_pipeline_v2.md) §7 초기 버전 목록: α 3버전(grad/meanH/mixed) + deformation 3종(phasefield/integrate/warp) |
| 3 | GitHub Pages 호스팅 + 이미지 변환 웹페이지 | 미착수 | 정적 사이트 → 클라이언트 측 실행 전제. 출력 표현(SVG vs Canvas)·성능 차수 2에서 확정 |
| 4 | 테스트 인프라 도입 시 `check-and-verify` 규약 정합 | 대기 | 아래 "스킬 인프라 상태" 참조 |

---

## 작업 로그

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

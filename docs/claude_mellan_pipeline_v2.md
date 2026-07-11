# Claude Mellan 스타일 변환 파이프라인 v2 — 모듈형(교체축) 설계

본 문서는 [`claude_mellan_pipeline_v1.md`](claude_mellan_pipeline_v1.md)의 단일 경로 파이프라인을, 2026-07-11 설계 검토(grill 차수 1)로 도출한 **4개 교체축(pluggable axis)** 기반 모듈형 구조로 재설계한 것이다.

- **v1 → v2 핵심 변경**: (a) 커버리지·자기교차·부호 모호성 문제를 해결하기 위한 `deformation_model` **3종** 도입, (b) α 구동 신호를 **버전 분리**(1안/2안/4안), (c) 선 방향·부호 처리를 **옵션화**.
- **v1의 위치**: v1은 v2의 `deformation_model=integrate`, `alpha_source=gaussK`, `line_orientation=along`, `sign_handling` 미명시 조합의 **특수 케이스**다. v1의 §6 겹침 방지도 v2 §6에 계승·확장된다.
- **표기 규약**: 한글 본문, 영문 식별자, 수식은 LaTeX.

---

## §0 전역 파라미터 · 설정 스키마

v1 §0 파라미터를 계승하고 교체축 스위치를 추가한다. 단일 소스는 본 절이다.

| 기호/키 | 의미 |
|---|---|
| $a$ | 아르키메데스 나선 피치 인자 ($r=a\theta$). 인접 턴 간 반경 간격 $p = 2\pi a$ |
| $T_{\min}, T_{\max}$ | 선 최소·최대 두께 |
| $h$ | 유선 적분 스텝 (integrate 모델 전용) |
| $\sigma$ | 도함수 안정화용 가우시안 커널 표준편차 |
| $\rho$ | 구조 텐서 적분(평활) 커널 표준편차 |
| $c$ | 밝기→높이 스케일 (meanH/gaussK 곡률 계산용) |
| $(x_0, y_0)$ | 나선 중심 (차수 2에서 선정 방식 확정 예정) |
| $\lambda$ | 위상장 워프 강도 (phasefield 전용) |
| $\mu$ | 변위 워프 강도 (warp 전용) |

```jsonc
// 파이프라인 설정 (교체축)
{
  "deformation_model": "phasefield",       // phasefield | integrate | warp
  "alpha_source":      "grad",             // grad(1안) | meanH(2안) | mixed(4안)
  "line_orientation":  "along",            // along(v2) | across(v1) | switch(β)
  "sign_handling":     "tensorblend",      // tensorblend | spiralalign  (integrate/warp 전용)

  "center_mode":       "click",            // click(기본) | auto(얼굴/saliency, 실패 시 이미지중심 폴백)
  "tone_channels":     "thickness_only",   // thickness_only(1안) | thickness_plus_spacing(2안)
  "coverage_extent":   "diagonal",         // diagonal(기본) | fixed_turns
  "output_target":     "canvas",           // canvas(기본, 래스터) | svg(가변폭 채움 도형, 인쇄용)

  "warp_mode":         "anisotropic",      // phasefield 전용: anisotropic(along 실현) | tone_only
  "preprocess":        "luma_clahe",       // luma_clahe(기본) | luma_only | user_adjust(고급)
  "downsample_max":    1024,               // 내부 처리 장변 상한(px). 출력은 재샘플/벡터
  "auto_regenerate":   false               // 수치 변경 시 자동 재렌더(debounce). off면 Render 버튼
}
```

---

## §1 공통 전처리 (모든 조합 공유)

1. **그레이스케일·정규화** — `preprocess` (옵션 선택):
   - **`luma_clahe` (기본)**: 지각 광도 $I = 0.2126R + 0.7152G + 0.0722B$ (Rec.709) + CLAHE 국소 대비 정규화. 얼굴·음영 디테일 강화, 다양한 입력에 강건.
   - **`luma_only`**: Rec.709 luma만, 대비 정규화 없음. 단순·예측적(저대비 이미지 약함).
   - **`user_adjust` (고급)**: 웹 UI 대비·감마 슬라이더 수동 조절. `luma_clahe`/`luma_only` 위에 얹어 병행 가능.
   결과는 $I(x,y)\in[0,1]$.
2. **평활·도함수**: $I$에 가우시안($\sigma$) 적용 후 Sobel/Scharr로 $I_x, I_y$ 산출. `meanH`/`mixed`는 2차 도함수 $I_{xx}, I_{yy}, I_{xy}$도 산출.
3. **구조 텐서**: $J = K_\rho * \begin{pmatrix} I_x^2 & I_xI_y \\ I_xI_y & I_y^2 \end{pmatrix}$. 고유분해 →
   - $\lambda_1 \ge \lambda_2$, 고유벡터 $\mathbf{v}_1$(major, 그래디언트≈에지 가로지름), $\mathbf{v}_2$(minor, 에지 흐름 방향).
   - 이방성 $A = \dfrac{\lambda_1-\lambda_2}{\lambda_1+\lambda_2+\varepsilon} \in [0,1]$ (등방점에서 0).
4. **α 필드**: `alpha_source`로 스칼라 $s(x,y)$ 선택(§2) → $\alpha_0 = \text{Normalize}(s)$ → v1 §2 이방성 확산 평활(Dirichlet: 고신호=1, 배경=0) → $\alpha(x,y)\in[0,1]$.
5. **기준 나선**: 중심 $(x_0,y_0)$, $r=a\theta$.

$\mathbf{v}_1, \mathbf{v}_2$는 **부호 없는 orientation**(§4에서 처리), $\alpha$는 "이미지를 얼마나 따를지"의 스칼라 가중이다. **방향(축 B)과 가중(축 α)은 직교하는 독립 노브**다.

---

## §2 교체축 α — `alpha_source` (버전 분리: 1안/2안/4안)

`α₀`를 구동하는 스칼라 신호 $s(x,y)$만 다르고 하류는 공유한다. 세 버전을 각각 생성한다.

### (1안) `grad` — 그래디언트 크기
$$s_{\text{grad}} = \lVert \nabla I \rVert = \sqrt{I_x^2 + I_y^2}$$
톤 경사가 있는 모든 곳(음영 흐름)을 따름. 저비용(1차 도함수), 이미지-공간 직접적.

### (2안) `meanH` — 평균곡률 크기
$f = c\cdot I$의 몽주 패치 평균곡률:
$$H = \frac{(1+f_y^2)f_{xx} - 2 f_x f_y f_{xy} + (1+f_x^2)f_{yy}}{2\,(1+f_x^2+f_y^2)^{3/2}}, \qquad s_{\text{meanH}} = |H|$$
단일 곡률(원통형 뺨·이마 등 $K=0$이나 form 존재)까지 포착. 기하-공간 충실, $c$ 민감·2차 도함수 비용.

### (4안) `mixed` — 혼합 스칼라
$$s_{\text{mixed}} = \text{Normalize}\big(w_g\,\hat{s}_{\text{grad}} + w_H\,\hat{s}_{\text{meanH}} + w_K\,|\hat{K}|\big)$$
($\hat{\cdot}$은 각 항 개별 정규화. 기본 가중 $w_g{=}0.5, w_H{=}0.3, w_K{=}0.2$ — 튜닝 대상.) $K$는 v1 §1의 가우시안 곡률(분자 $c^2(I_{xx}I_{yy}-I_{xy}^2)$ — v1의 $c^2$ 누락은 정규화로 무해하나 v2에서 정정).

> **참고**: v1의 `gaussK`($|K|$)는 원통형·평면 음영에서 0이 되어 form을 놓치는 한계가 있어 v2 기본 3버전에서 제외. `mixed`에 보조항으로만 잔존.

---

## §3 교체축 B — `line_orientation`

선이 따를 orientation $D(x,y)$ (부호 미정 방향). `integrate`/`warp`에서 직접 사용, `phasefield`에서는 워프 이방성으로 반영(§5.A).

- **`along` (v₂, 권장 기본)**: $D = \mathbf{v}_2$. 에지 흐름(등고선)을 따라 — Mellan의 윤곽 추종.
- **`across` (v₁)**: $D = \mathbf{v}_1$. 명암 경사를 가로지름 — 해칭 미감.
- **`switch` (β 기반)**: 나선 진행 방향과 에지 방향의 각 $\beta = \angle(\mathbf{V}_{\text{spiral}}, \mathbf{v}_2)$, 정렬도 $w=|\cos\beta| = |\mathbf{V}_{\text{spiral}}\cdot\mathbf{v}_2|$.
  - 나선이 에지와 **평행**($w\to1$): $\mathbf{v}_2$ 사용(윤곽을 감싸며 진행 방해 적음).
  - 나선이 에지와 **수직**($w\to0$): $\mathbf{v}_2$를 강제하면 90° 꺾여 진행 붕괴 → $\mathbf{v}_1$ 사용(또는 $\alpha$ 감쇄).
  - 구현: 하드 선택 $D=\mathbf{v}_2\ (w\ge0.5)\ \text{else}\ \mathbf{v}_1$, 또는 **부드러운 α 변조** $\alpha_{\text{eff}} = \alpha\cdot g(w)$ ($g$ 단조증가). 후자를 기본 권장.

---

## §4 교체축 C — `sign_handling` (경로 연속성 해법; integrate/warp 전용, 사용자 선택)

$\mathbf{v}_1,\mathbf{v}_2$는 부호 모호($\pm$)한 선장이다. 방향 있는 $\mathbf{V}_{\text{spiral}}$과 결합하려면 부호를 일관 고정해야 하며, 방식에 따라 연속성 특성이 다르므로 **옵션으로 선택**한다.

### `spiralalign` — V_spiral 정렬 (단순)
$$\mathbf{V}_{\text{tensor}} = \text{sign}(D\cdot\mathbf{V}_{\text{spiral}})\;D$$
나선 진행 방향과 일관. **한계**: $D\perp\mathbf{V}_{\text{spiral}}$인 지점에서 부호 불연속 반전 → 경로에 꺾임. 해당 지점 $\alpha$가 크면 불연속 심각.

### `tensorblend` — 텐서 공간 블렌드 (연속, 권장 기본)
고유벡터를 섞지 않고 **orientation을 double-angle로 표현해 텐서를 보간**한다.
$$\phi_D = \tfrac{1}{2}\text{atan2}(2J_{xy}, J_{xx}-J_{yy}), \quad \phi_S = \angle\mathbf{V}_{\text{spiral}}$$
$$\phi^* = \tfrac{1}{2}\,\text{arg}\big((1-\alpha)e^{i\,2\phi_S} + \alpha\, e^{i\,2\phi_D}\big)$$
$\phi^*$에서 방향 벡터를 만들되, **직전 스텝 접선과 예각이 되도록 부호 선택**. 부호 모호성이 원천 소거되며, 미정은 진짜 등방점($A\to0$, 가중 자연 소멸)에서만 발생.

> `phasefield`는 벡터 블렌딩이 없어 본 축이 **불필요**하다(§5.A).

---

## §5 교체축 D — `deformation_model` (생성 알고리즘 3종)

세 방식 모두 **작성 가능**하며, 커버리지·성능·미감 트레이드오프가 다르다.

### §5.A `phasefield` — 위상장 등위선 (권장 기본)

나선을 스칼라 **턴 좌표**의 정수 등위선으로 정의한다. 극좌표 $(\rho,\theta),\ \theta\in[0,2\pi)$, 피치 $p=2\pi a$:
$$n(x,y) = \frac{\rho}{p} - \frac{\theta}{2\pi}$$
기준 나선의 각 턴 = $\{n = k\},\ k\in\mathbb{Z}$ (branch-cut을 건너면 $\theta/2\pi$가 $1\to0$, $n$이 $+1$ 되어 다음 턴으로 **연속** 이어짐).

**워프** — `warp_mode` (옵션 선택):
- **`tone_only` (2안)**: 톤 구동 반경 이동.
  $$n'(x,y) = n(x,y) + \frac{\lambda}{p}\,\alpha(x,y)\,\big(I(x,y) - \bar{I}\big)$$
  $\alpha$ 높고 밝기 변화가 있는 곳에서 턴 경계를 국소 이동·부풀림 → Mellan식 톤 구동. 단, 선이 에지를 **따라 굴곡하지는 않음**(`line_orientation=along` 미실현).
- **`anisotropic` (1안, along 실현)**: 위 톤 워프에 더해, $n'$을 **구조 텐서로 이방성 확산/워핑**하여 등위선 법선 $\nabla n'$을 $\mathbf{v}_1$에 정렬 → 등위선(=선)이 $\mathbf{v}_2$(에지)를 **따라 굴곡**. 조향 항: 확산 텐서를 $D_{\text{tensor}} = \mathbf{v}_1\mathbf{v}_1^\top + \eta\,\mathbf{v}_2\mathbf{v}_2^\top$ ($\eta<1$)로 두어 $\mathbf{v}_2$ 방향 확산을 억제, $\nabla n'$이 $\mathbf{v}_1$로 서도록 유도. phasefield의 비교차·커버리지·자동간격 성질을 유지한 채 `along` 실현.

**렌더**: $n'$의 정수 레벨을 marching-squares로 추출 → 각 등위선이 한 턴, 이어 붙이면 단일 연속 곡선.

- **커버리지**: $n'$이 $\rho$에 대해 단조($\partial n'/\partial\rho>0$)면 전역 타일링 자명. $\lambda$ 상한이 gap cap.
- **자기교차**: 등위선은 서로 교차 불가 → **원천 소거**.
- **부호 모호성**: 벡터 블렌딩 없음 → **없음**.
- **간격 자동 변조 (톤 채널 무상 획득)**: 인접 턴 간격 $\approx 1/\lVert\nabla n'\rVert$, $\nabla n' = \nabla n + \tfrac{\lambda}{p}\nabla[\alpha(I-\bar I)]$ → **이미지가 선 간격을 자동 변조**(어두운 곳 조밀). integrate/warp에는 이 성질이 없다(§6 참조).
- **성능**: 픽셀 병렬 + marching-squares. 웹 친화.

### §5.B `integrate` — 속도장 적분 (+ 단조성 클램프)

$$\mathbf{V}_{\text{final}} = \text{Normalize}\big((1-\alpha)\mathbf{V}_{\text{spiral}} + \alpha\,\mathbf{V}_{\text{tensor}}\big)$$
$\mathbf{V}_{\text{tensor}}$는 §3 `line_orientation`의 $D$에 §4 `sign_handling` 적용해 생성.

**단조성 클램프 (커버리지 보장)**: 각 스텝에서 나선 진행(각속도 $\dot\theta$)의 부호가 유지되도록 $\mathbf{V}_{\text{final}}$을 투영/회전. 반경 성분 $\mathbf{V}_{\text{final}}\cdot\hat{r} < \varepsilon$이면 $\mathbf{V}_{\text{spiral}}$ 쪽으로 회전시켜 내향 붕괴·역주행 차단.

RK4 적분($h$)으로 $\mathbf{p}_{k+1}$ 추적(v1 §5 계승). 종료: $\rho(\mathbf{p}_k) > R_{\max}$(이미지 전역 덮음) 또는 스텝 예산 초과.

- **장점**: 흐름을 접선으로 길게 추종(Mellan다운 스윕). **단점**: 드리프트·비용(순차 RK4·픽셀 보간). `sign_handling` 필요.

### §5.C `warp` — 변위 워핑

기준 나선을 해석적으로 미세 샘플 $S_i = (x_0+a\theta_i\cos\theta_i,\ y_0+a\theta_i\sin\theta_i)$. 각 점을 변위:
$$\boldsymbol\delta_i = \text{clamp}\Big(\mu\,\alpha(S_i)\,d(S_i),\ \lVert\boldsymbol\delta_i\rVert < \tfrac{p}{2}\Big), \qquad P_i = S_i + \boldsymbol\delta_i$$
$d$는 변위 방향: 나선 법선(기본) / $\nabla I$ / $\mathbf{v}_1$ (§3 연동). $|\boldsymbol\delta|<p/2$ 클램프로 인접 턴 교차 방지.

- **장점**: 최저 비용·최고 안정(해석 샘플 + 독립 오프셋), 커버리지·비교차 자명. **단점**: form을 길게 못 감쌈(국소 밀림). `sign_handling` 필요(방향 $d$가 $\mathbf{v}$ 계열일 때).

---

## §6 렌더링 (두께 + 겹침·빈틈 cap)

각 궤적 점에서 두께(v1 §6 계승):
$$t_k = T_{\min} + \big(1 - I(\mathbf{p}_k)\big)(T_{\max}-T_{\min})$$
가변폭 스트로크 래스터화.

**겹침·빈틈 cap (v1 확장)**: 인접 턴 간격 $d_{\text{adj}}$를 $[t_k,\ p]$ 범위로 유지.
- $d_{\text{adj}} < t_k + \varepsilon$ (겹침): 국소 두께 또는 $\alpha$ 감쇄.
- $d_{\text{adj}} > p(1+\tau)$ (빈틈): integrate/warp는 $\alpha$ 감쇄로 나선 복원, phasefield는 $\lambda$ 상한으로 사전 방지.

### 톤 채널 — `tone_channels`

명암을 어느 채널로 낼지 선택. **단일 연속선 원칙 유지** (2차 나선 중첩 없음).

- **`thickness_only` (1안, 기본)**: 톤은 두께 $t_k$만. 간격은 pitch로 고정(단, phasefield는 §5.A 워프로 간격이 자동 변조되므로 두께+자동간격이 동시 작동).
- **`thickness_plus_spacing` (2안)**: 두께 + 선 간격 동시. **분담 기준 = 주파수 분해**: 목표 어둠 $D = 1-I$를 $D_{\text{low}}$(pitch의 수 배 스케일 저역통과)와 $D_{\text{high}} = D - D_{\text{low}}$로 나눠 —
  - **간격 채널 ← $D_{\text{low}}$** (넓은 영역 명암; 간격은 pitch보다 큰 스케일만 표현 가능).
  - **두께 채널 ← $D_{\text{high}}$** (국소 디테일; 점별 급변 표현).
  - phasefield: 간격 성분은 §5.A 워프 강도 $\lambda$에 $D_{\text{low}}$를 실어 구현(자연 연동). integrate/warp: 간격은 자동으로 안 생기므로 pitch 국소 변조 필요(커버리지 cap과 함께 신중히).

---

## §7 조합·호환성 매트릭스 + 초기 버전 생성 목록

| 축 | phasefield | integrate | warp |
|---|---|---|---|
| `alpha_source` (grad/meanH/mixed) | ✓ | ✓ | ✓ |
| `line_orientation` | 워프 이방성으로 반영 | ✓ | ✓ |
| `sign_handling` | 불필요 | ✓ (선택) | ✓ (선택) |

**초기 실물 비교용 버전(조합 폭발 방지)**:
- **α 비교 3버전**: `phasefield` 고정 × `alpha_source ∈ {grad, meanH, mixed}` → 1안/2안/4안 버전.
- **deformation 비교 3버전**: `alpha_source=grad` 고정 × `deformation_model ∈ {phasefield, integrate, warp}`.
- `line_orientation`·`sign_handling`은 토글로 노출해 위 버전 위에서 전환.

---

## §8 웹 실행·입출력 (차수 2 확정)

GitHub Pages 정적 호스팅 → 변환은 **클라이언트 측 실행** 전제. 세 축을 옵션으로 노출한다.

### 출력 표현 — `output_target`
동일 궤적 점집합 $P$ + 두께 $t_k$를 입력으로 받는 **렌더러 2종**(백엔드 공유):
- **`canvas` (기본)**: 세그먼트별 `lineWidth`로 가변폭 래스터. 세 deformation 모델 모두 호환, 경량.
- **`svg`**: 각 턴을 오프셋 아웃라인 폴리곤으로 채운 가변폭 벡터. 인쇄·무한 확대·다운로드용. 노드 수 관리 필요.

### 중심 선정 — `center_mode`
- **`click` (기본)**: 웹 UI에서 사용자가 $(x_0,y_0)$ 클릭. 결정론적·인터랙티브.
- **`auto`**: 얼굴/피사체 검출 또는 saliency map 중심. 검출 실패 시 이미지 기하 중심으로 폴백.

### 커버리지 범위 — `coverage_extent`
- **`diagonal` (기본)**: $R_{\max}$ = 중심에서 가장 먼 코너 거리 → 전 이미지 덮음. 턴 수 $N = R_{\max}/p$ 자동.
- **`fixed_turns`**: 사용자 지정 턴 수 $N$. 이미지 크기와 불일치 시 과대/과소 커버리지 가능.

### 파라미터 컨트롤 — 슬라이더 + 수치 입력
`a`(pitch)·$T_{\min}/T_{\max}$·$\lambda$ 등 미학 파라미터는 이미지 크기 기반 **기본값** 제공 + 웹 UI 조절:
- **슬라이더 + 수치 입력 병행**: `range`와 `number`를 같은 상태에 양방향 바인딩(드래그=탐색, 타이핑=정밀).
- **`auto_regenerate` 토글**: off면 변경은 대기값만 갱신 → "Render" 버튼으로 일괄 적용. on이면 디바운스(150~300ms) 자동 재렌더. 슬라이더 드래그 중 렌더 폭주 방지.

### 성능 — `downsample_max` (차수 3 확정)
- **기본: 내부 처리 다운샘플** — 장변 `downsample_max`(기본 1024px)로 축소해 처리, 출력은 고해상도 재샘플(canvas) 또는 벡터(svg). 무거운 연산(가우시안·Sobel·2×2 고유분해·이방성 확산·marching-squares)은 typed array 순수 JS로 1024px에서 수십~수백 ms/1회 — 일회성 변환에 충분.
- **UI 프리즈 방지**: 파이프라인을 **Web Worker**에서 실행(메인 스레드 밖). 비용 거의 0, 응답성 확보.
- **후속 최적화(선택)**: 원해상도 실시간 프리뷰가 요구되면 WASM(Rust/wasm-pack)·WebGL 가속. **구현 비용 중대**(툴체인 + 빌드 스텝 + 수치코어 재작성 + JS 바인딩)이므로, 그 요구가 실제로 생기기 전에는 도입하지 않는다.

---

## §9 타당성 결론

- `phasefield`: 구현 가능. 커버리지·비교차·부호모호성을 구조적으로 동시 해결. **기본 권장.**
- `integrate`: 구현 가능. 단조성 클램프 + `sign_handling`으로 v1 취약점 보강.
- `warp`: 구현 가능. 최저 비용·최고 안정, form 추종력은 낮음.

세 모델 모두 클라이언트 측(JS/WASM) 실행 가능하며, phasefield·warp는 병렬·경량, integrate는 순차이나 단일 나선 규모에서 실용적이다.

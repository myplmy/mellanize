# Claude Mellan 스타일 변환을 위한 기하학적·수학적 파이프라인

본 문서는 2D 평면 이미지를 클로드 멜랑(Claude Mellan)의 독창적인 판화 스타일(연속된 단일 선의 왜곡과 두께 변화를 통한 명암 및 3D 질감 표현)로 변환하기 위한 수학적 알고리즘 파이프라인을 정의합니다. 본 알고리즘은 국소적 에지(Edge)에 치우치지 않고, 몽주 패치와 푸아송 방정식을 활용하여 전역적인 기하 구조를 반영하는 가변 가중치 벡터장 블렌딩 기법을 핵심으로 합니다.

---

## 0. 핵심 전역 변수 (System Parameters)

알고리즘을 제어하기 위해 정의해야 하는 전역 파라미터 리스트입니다.

- $a$: 아르키메데스 나선의 간격(피치) 제어 인자 ($r = a\theta$)
- $T_{\max}, T_{\min}$: 최종 렌더링 시 선의 최대 및 최소 두께 (명암 표현용)
- $h$: 유선 적분(Streamline Integration) 시의 오일러 또는 RK4 걸음 크기(Step size)
- $\sigma$: 구조 텐서 및 곡률 계산 시 고주파 노이즈를 억제하기 위한 가우시안 커널의 표준편차
- $c$: 몽주 패치 임베딩 시 이미지 밝기 값을 높이 차원으로 투영할 때 사용하는 스케일링 인자

---

## 1단계: 몽주 패치 기반 자동 알파($\alpha$) 필드 생성

**목적:** 이미지의 기하학적 굴곡(눈, 코, 입 등의 전역 구조)을 자동으로 감지하여, 나선이 이미지 흐름을 따를 영역과 원본 나선 형태를 유지할 영역의 초기 가중치 맵을 계산합니다.

### 1) 수학적 공식
입력 그레이스케일 이미지 $I(x, y) \in [0, 1]$를 3차원 공간상의 곡면 함수(Monge Patch) $\mathbf{r}(x, y)$로 임베딩합니다.
$$\mathbf{r}(x, y) = \big(x, y, c \cdot I(x, y)\big)$$

이 곡면의 **가우시안 곡률(Gaussian Curvature, $K$)**을 미분기하학적으로 도출합니다.
$$K(x, y) = \frac{I_{xx}I_{yy} - I_{xy}^2}{(1 + c^2 I_x^2 + c^2 I_y^2)^2}$$
*(여기서 $I_x, I_y$는 1차 편미분, $I_{xx}, I_{yy}, I_{xy}$는 2차 편미분 값입니다.)*

### 2) 알고리즘 단계
1. 입력 이미지에 가우시안 필터($\sigma$)를 적용하여 미세 노이즈를 제거합니다.
2. Sobel 또는 Scharr 커널을 조합하여 $I_x, I_y, I_{xx}, I_{yy}, I_{xy}$ 미분 맵을 각각 계산합니다.
3. 위 가우시안 곡률 공식을 픽셀 단위로 적용하여 전역 곡률 맵 $K(x, y)$를 도출합니다.
4. 곡률의 절대값을 기반으로 초기 알파 맵을 $[0, 1]$ 범위로 정규화합니다.
   $$\alpha_0(x, y) = \text{Normalize}(|K(x, y)|)$$

---

## 2단계: 푸아송 방정식을 이용한 알파 필드 스무딩 (전이 영역 최적화)

**목적:** 나선의 특정 스텝($n \sim n+x$) 및 특정 각도 구간에서 알파 값이 급격하게 변해 선이 요동치거나 뚝뚝 끊기는 불연속성(Discontinuity) 문제를 방지하고, 전역적으로 매끄러운 전이 영역을 형성합니다.

### 1) 수학적 공식
초기 알파 맵 $\alpha_0$의 주요 특징점 경계를 보존하면서 주변 평탄 영역으로 가중치를 매끄럽게 확산(Diffusion)시키기 위해, 이방성 확산(Anisotropic Diffusion, Perona-Malik) 또는 다음 라플라스 방정식을 제약 조건 하에 풉니다.
$$\nabla^2 \alpha(x, y) = \Delta \alpha(x, y) = 0$$
또는 에지를 고려한 확산 방정식:
$$\frac{\partial \alpha}{\partial t} = \nabla \cdot \left( g(|\nabla I|) \nabla \alpha \right), \quad \alpha(x,y,0) = \alpha_0(x,y)$$

### 2) 알고리즘 단계
1. 곡률이 매우 높은 영역(중요 기하 구조)은 $\alpha = 1$, 배경 및 평탄 구역은 $\alpha = 0$으로 고정(Dirichlet boundary condition)합니다.
2. 내부 전이 구역(나선의 인접 스텝 영역)에 대해 수치해석적 반복법(Jacobi, Gauss-Seidel 등)을 수행하여 라플라스 방정식을 만족하는 전역 최적화 필드 $\alpha(x, y)$를 완성합니다.

---

## 3단계: 구조 텐서(Structure Tensor) 가이드 벡터장 생성

**목적:** 이미지의 로컬 명암 결 및 윤곽선 흐름을 전역적으로 추종하기 위한 단위 방향 벡터장을 추출합니다.

### 1) 수학적 공식
각 픽셀 좌표에서의 구조 텐서(Structure Tensor) 행렬 $J$를 정의합니다.
$$J = K_\rho * \begin{pmatrix} I_x^2 & I_x I_y \\ I_x I_y & I_y^2 \end{pmatrix}$$
*(여기서 $K_\rho$는 로컬 방향성을 통합·평활화하기 위한 가우시안 윈도우 함수입니다.)*

행렬 $J$의 고유값 분해(Eigenvalue Decomposition)를 통해 최소 고유값 $\lambda_2$에 대응하는 단위 고유벡터 $\mathbf{v}_2(x, y)$를 구합니다. 이 벡터는 명암의 변화가 가장 적은 방향, 즉 에지의 흐름 방향을 가리킵니다.
$$\mathbf{V}_{\text{tensor}}(x, y) = \mathbf{v}_2(x, y) = \begin{pmatrix} v_x \\ v_y \end{pmatrix}$$

---

## 4단계: 기준 아르키메데스 나선 벡터장 생성

**목적:** 왜곡의 기준점이 되는, 원점 중심의 전역 회전 아르키메데스 나선 벡터장을 정의합니다.

### 1) 수학적 공식
이미지의 중심 좌표를 $(x_0, y_0)$라 할 때, 임의의 점 $(x, y)$에 대한 극좌표 매개변수는 다음과 같습니다.
$$\theta = \text{atan2}(y-y_0, x-x_0), \quad r = \sqrt{(x-x_0)^2 + (y-y_0)^2}$$
기본 아르키메데스 나선 공식 $r = a\theta$의 진행 방향을 나타내는 단위 접선 벡터장 $\mathbf{V}_{\text{spiral}}(x, y)$는 다음과 같이 표현됩니다.
$$\mathbf{V}_{\text{spiral}}(x, y) = \frac{1}{\sqrt{a^2 + r^2}} \begin{pmatrix} -r\sin\theta + a\cos\theta \\ r\cos\theta + a\sin\theta \end{pmatrix}$$

---

## 5단계: 가중치 벡터장 블렌딩 및 유선 적분 (2D → 4D 매핑의 수학적 구현)

**목적:** 2단계에서 도출한 가변 알파 필드 $\alpha(x, y)$를 활용하여 두 벡터장을 선형 보간(LERP)하고, 이를 바탕으로 나선의 최종 물리적 궤적 좌표군을 적분해 나갑니다. 이는 질문자가 제시한 $(\theta, r, t, d)$ 4차원 공간의 2D 사상(Mapping)을 완벽하게 구현하는 단계입니다.

### 1) 수학적 공식
최종 매끄럽게 결합된 가이드 벡터장 $\mathbf{V}_{\text{final}}$을 정의합니다.
$$\mathbf{V}_{\text{final}}(x, y) = \text{Normalize}\Big( (1 - \alpha(x, y))\mathbf{V}_{\text{spiral}}(x, y) + \alpha(x, y)\mathbf{V}_{\text{tensor}}(x, y) \Big)$$

초기 출발점 $\mathbf{p}_0 = (x_0, y_0)$에서 시작하여, 높은 정확도를 확보하기 위해 **Runge-Kutta 4차(RK4) 알고리즘**을 통해 다음 유선 궤적 점 $\mathbf{p}_{k+1}$을 적분 추적합니다.
$$\mathbf{k}_1 = \mathbf{V}_{\text{final}}(\mathbf{p}_k)$$
$$\mathbf{k}_2 = \mathbf{V}_{\text{final}}\left(\mathbf{p}_k + \frac{h}{2}\mathbf{k}_1\right)$$
$$\mathbf{k}_3 = \mathbf{V}_{\text{final}}\left(\mathbf{p}_k + \frac{h}{2}\mathbf{k}_2\right)$$
$$\mathbf{k}_4 = \mathbf{V}_{\text{final}}(\mathbf{p}_k + h\mathbf{k}_3)$$
$$\mathbf{p}_{k+1} = \mathbf{p}_k + \frac{h}{6}(\mathbf{k}_1 + 2\mathbf{k}_2 + 2\mathbf{k}_3 + \mathbf{k}_4)$$

추적된 이산 점들의 집합 $\mathcal{P} = \{\mathbf{p}_0, \mathbf{p}_1, \mathbf{p}_2, \dots\}$가 변형된 판화 선의 중심축(Skeleton)이 됩니다.

---

## 6단계: 음영 기반 두께 사상 및 래스터화 (최종 판화 출력)

**목적:** 계산된 나선 궤적 위에 원본 이미지의 로컬 휘도(밝기)를 선의 두께로 사상하여 2D 그리드 화면에 최종적으로 렌더링합니다.

### 1) 수학적 공식
궤적 상의 각 점 $\mathbf{p}_k = (x_k, y_k)$ 위치에서 원본 그레이스케일 이미지의 밝기 값 $I(x_k, y_k) \in [0, 1]$을 샘플링한 후, 선의 물리적 두께 $t_k$를 결정합니다. 어두운 영역일수록 선이 두꺼워집니다.
$$t_k = T_{\min} + \big(1 - I(x_k, y_k)\big) \cdot (T_{\max} - T_{\min})$$

### 2) 알고리즘 및 겹침 방지(Overlap Cap) 예외 처리
1. 동일 크기의 백색 디지털 캔버스 $I_{\text{final}}$을 할당합니다.
2. 적분된 궤적 점 집합 $\mathcal{P}$를 순회하며 두께 $t_k$를 가지는 가변 두께 스트로크(Variable-width stroke)를 순차적으로 렌더링합니다.
3. **안전성 제약 조건 피드백:** 특정 영역에서 강한 구조 텐서 흐름에 의해 나선이 과도하게 압착되는 경우를 방지하기 위해 다음 제약 조건을 검사합니다.
   $$r'(\theta + 2\pi) > r'(\theta) + t$$
   만약 두 인접 선의 예측 간격이 두께의 합보다 작아질 위험이 감지되면, 해당 좌표의 $\alpha(x, y)$ 상한선(Cap)을 강제로 감쇄시켜 원본 아르키메데스 나선 방향($\mathbf{V}_{\text{spiral}}$)의 복원력을 높여주는 예외 연산을 적용합니다.
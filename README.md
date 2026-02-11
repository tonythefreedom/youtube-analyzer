# YT-TRENDSCOPE

YouTube 트렌드를 분석하고 Gemini AI 기반 콘텐츠 전략을 제시하는 웹 애플리케이션

## 기술 스택

| 영역 | 기술 |
|------|------|
| UI | React 18, Tailwind CSS 3 |
| 번들러 | Vite 5 |
| 시각화 | Recharts (Treemap) |
| AI 분석 | Google Generative AI (Gemini 3 Flash) |
| 데이터 | YouTube Data API v3 |
| 아이콘 | Lucide React |
| 배포 | Firebase Hosting |

## 프로젝트 구조

```
src/
├── App.jsx                      # 메인 애플리케이션 (레이아웃, 필터, 상태 관리)
├── useTrendData.js              # YouTube & Gemini API 통합 훅
├── main.jsx                     # React 진입점
├── index.css                    # Tailwind 전역 스타일
├── authConfig.json              # 인증 해시 (빌드 시 자동 생성)
├── components/
│   ├── Login.jsx                # SHA-256 기반 로그인 화면
│   ├── TrendChart.jsx           # 트렌드 키워드 Treemap 시각화
│   ├── VideoList.jsx            # 비디오 목록 렌더링
│   └── SavedAnglesPanel.jsx     # 저장된 Angle 사이드 패널
├── hooks/
│   └── useSavedAngles.js        # Saved Angles localStorage 관리 훅
└── utils/
    └── auth.js                  # SHA-256 해싱 유틸리티

scripts/
└── secure-auth.js               # 빌드 전 인증 해시 생성 스크립트
```

## 주요 기능

### 트렌드 데이터 수집
- 7개 국가 지원 (KR, US, JP, GB, AU, CA, SG)
- 복수 국가 동시 선택 가능
- Long-form / Shorts 콘텐츠 타입 필터
- 날짜 범위 및 순위 구간 필터 (Top 50 ~ 200)

### AI 분석 (Gemini)
- 6개 다양한 Angle 기반 콘텐츠 전략 생성
- 각 Angle별 15슬라이드 강의 시나리오
- 월간 트렌드 인사이트 요약
- 벤치마크 비디오 추천

### 키워드 검색
- YouTube Search API 기반 키워드 검색
- 국가 변경 시 자동 재검색
- 트렌드 맵에서 다중 키워드 선택 후 검색

### Saved Angles
- Angle 저장/삭제 (localStorage, 최대 100개)
- 사이드 패널에서 저장된 Angle 확인
- 클립보드 복사 지원

### 보안 및 세션
- SHA-256 해싱 기반 로그인
- 30분 세션 자동 만료
- API 키 환경 변수 관리

## 실행 방법

### 사전 요구사항

- Node.js 18+
- npm
- YouTube Data API v3 키
- Google Generative AI (Gemini) API 키

### 환경 변수 설정

프로젝트 루트에 `.env` 파일 생성:

```env
VITE_YOUTUBE_API_KEY=your_youtube_api_key
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_AUTH_ID=your_login_id
VITE_AUTH_PW=your_login_password
```

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
```

### Firebase 배포

```bash
npm run build
firebase deploy --only hosting
```

## 데이터 흐름

```
국가/날짜/타입 선택
    ↓
YouTube Data API v3 (mostPopular / search)
    ↓
데이터 처리 (중복 제거, Shorts 판정, 정렬)
    ↓
필터링 (순위 구간 → 날짜 범위)
    ↓
UI 렌더링 (좌측: AI 분석 + Treemap / 우측: 비디오 목록)
    ↓
RUN DEEP ANALYSIS 클릭
    ↓
Gemini API (6개 Angle + 15슬라이드 시나리오 생성)
    ↓
AI 분석 결과 렌더링
```

## 버전 히스토리

| 버전 | 주요 변경사항 |
|------|-------------|
| v4.4.0 | Saved Angles 저장/삭제 기능 추가 |
| v4.3.0 | 키워드 맵 다중 선택 및 검색 |
| v4.2.0 | 키워드 검색 기능 (Search API) |
| v4.0.0 | Shorts 지원, 15슬라이드 강의 형식 |
| v3.8.0 | Long-form / Shorts 콘텐츠 타입 필터 |
| v3.5.0 | 복수 국가 선택 지원 |
| v3.4.0 | 세션 관리 (30분 만료) |
| v3.3.0 | SHA-256 해싱 보안 인증 |

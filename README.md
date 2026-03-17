# eerspot

**Plan your time. Save your spots.**

`eerspot`은 **장소 기반 일정 관리 앱**입니다.  
단순한 시간 기록을 넘어, 사용자가 발견한 장소를 저장하고 일정으로 연결한 뒤 방문 경험까지 기록할 수 있도록 설계되었습니다.

---

## ✨ Why eerspot?

대부분의 일정 앱은 시간 중심으로 동작합니다.  
하지만 실제 일상과 여행의 계획은 대부분 **장소**에서 시작됩니다.

예를 들면:

- 친구와 저녁 약속
- 주말 카페 방문
- 여행 동선 계획
- 새로운 맛집 탐방

또한 많은 사용자가 Instagram에서 장소를 발견하지만,

- 저장만 해두고 다시 찾기 어렵고,
- 실제 방문 일정으로 이어지지 않으며,
- 방문 기록이 남지 않는 문제를 겪습니다.

**eerspot은 시간 + 장소 + 발견을 하나의 흐름으로 연결합니다.**

---

## 🧭 Core Concept

eerspot은 아래의 사용자 흐름을 중심으로 만들어졌습니다.

**Discover → Save → Plan → Visit → Remember**

1. 장소를 발견하고
2. 저장한 뒤
3. 일정으로 연결하고
4. 실제 방문 후
5. 경험을 기록합니다.

---

## 🚀 Key Features

### 1) Smart Calendar
기본적인 일정 관리 기능을 제공하며, 일정에 장소를 연결할 수 있습니다.

- 일정 생성
- 날짜별 일정 보기
- 캘린더 기반 일정 관리
- 일정 메모 작성

---

### 2) Place-Based Scheduling
일정 생성 시 장소를 함께 등록하여 실제 행동 중심의 계획을 만듭니다.

예시:

- 토요일 18:00
- 성수 미도인 방문

지원 기능:

- 장소 연결
- 지도 열기
- 일정 메모
- 방문 여부 체크

---

### 3) Place Search
원하는 장소를 직접 검색하고 저장해 일정과 연결할 수 있습니다.

- 장소 이름 검색
- 지도 기반 장소 검색
- 검색 결과 저장
- 일정 연결

<<<<<<< ours
<<<<<<< ours
지원 지도(provider 인터페이스, v1에서는 1개만 활성화):
=======
지원 지도(확장 가능):
>>>>>>> theirs
=======
지원 지도(확장 가능):
>>>>>>> theirs

- Naver Map
- Kakao Map
- Google Places

---

<<<<<<< ours
<<<<<<< ours
### 4) Instagram Place Capture (v1.1+)
=======
### 4) Instagram Place Capture
>>>>>>> theirs
=======
### 4) Instagram Place Capture
>>>>>>> theirs
Instagram에서 발견한 장소를 빠르게 수집하고 정리합니다.

- Instagram 링크 입력
- 게시물 속 장소 추출
- 장소 리스트 정리
- 원하는 장소 저장

<<<<<<< ours
<<<<<<< ours
> v1에서는 Discover 화면만 placeholder로 두고, 자동 추출은 v1.1+ 범위로 둡니다.
=======
> 장소 탐색의 시작점을 Instagram으로 확장하는 기능입니다.
>>>>>>> theirs
=======
> 장소 탐색의 시작점을 Instagram으로 확장하는 기능입니다.
>>>>>>> theirs

---

### 5) Map Integration
저장한 장소를 지도 앱으로 바로 열 수 있습니다.

<<<<<<< ours
<<<<<<< ours
- v1: 선택한 단일 지도 provider 딥링크 열기
- v1.1+: 추가 provider 확장
=======
- 네이버 지도 열기
- 카카오맵 열기
>>>>>>> theirs
=======
- 네이버 지도 열기
- 카카오맵 열기
>>>>>>> theirs

예시:

```text
nmap://search?query=성수미도인
```

---

### 6) Personal Place Archive
개인 장소 아카이브를 구성해 나만의 장소 리스트를 관리합니다.

- 장소 저장
- 지역별 정리
- 방문 여부 체크
- 즐겨찾기 관리

---

### 7) Visit Notes & Feedback
방문 이후의 경험까지 기록합니다.

- 방문 메모
- 별점 기록
- 재방문 여부 체크

---

## 🔐 Account System

eerspot은 계정 기반 서비스로 동작하며, 사용자 데이터를 안전하게 관리합니다.

<<<<<<< ours
<<<<<<< ours
- v1: 회원가입, 로그인, 로그아웃, 세션 자동 갱신
- v1.1+: 비밀번호 찾기, 회원탈퇴
=======
=======
>>>>>>> theirs
- 회원가입
- 로그인
- 로그아웃
- 비밀번호 찾기
- 회원탈퇴
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs

계정을 통해 제공되는 가치:

- 일정 데이터 클라우드 저장
- 장소 리스트 동기화
- 여러 기기에서 동일 데이터 사용
- 개인 방문 기록 관리

---

## 🔄 User Flow

### 방법 1: 장소 검색 기반

장소 검색  
→ 장소 저장  
→ 일정 등록

<<<<<<< ours
<<<<<<< ours
### 방법 2: Instagram 발견 기반 (v1.1+)
=======
### 방법 2: Instagram 발견 기반
>>>>>>> theirs
=======
### 방법 2: Instagram 발견 기반
>>>>>>> theirs

Instagram 링크 입력  
→ 장소 추출  
→ 장소 저장  
→ 일정 등록

---

## 🧱 App Structure

- **Calendar**: 일정 관리 중심 화면
- **Places**: 저장한 장소 리스트
<<<<<<< ours
<<<<<<< ours
- **Discover**: v1 placeholder, v1.1+ Instagram 기반 장소 수집
=======
- **Discover**: Instagram 기반 장소 수집
>>>>>>> theirs
=======
- **Discover**: Instagram 기반 장소 수집
>>>>>>> theirs

---

## 🛠 Tech Stack

### Mobile

- React Native (CLI)
- TypeScript
- React Navigation
- TanStack React Query
- Zustand / Redux Toolkit

### Local Storage

<<<<<<< ours
<<<<<<< ours
- Secure Storage (Keychain / Keystore-backed)
=======
>>>>>>> theirs
=======
>>>>>>> theirs
- react-native-mmkv
- SQLite

### Backend

- Node.js (Express / Fastify)
- REST API

백엔드 역할:

- 사용자 인증
- 일정 데이터 관리
- 장소 데이터 관리
<<<<<<< ours
<<<<<<< ours
- v1.1+: Instagram 링크 분석
- 지도 API 검색

### AI Integration (v1.1+)
=======
=======
>>>>>>> theirs
- Instagram 링크 분석
- 지도 API 검색

### AI Integration
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs

Instagram 콘텐츠에서 장소를 추출하기 위해 AI 모델을 활용할 수 있습니다.

예시:

- OpenAI
- Claude
- Gemini

---

## 📌 Vision

eerspot은 단순한 일정 앱이 아니라,

- 발견한 장소를 놓치지 않고,
- 실제 일정으로 연결하며,
- 방문 경험까지 축적하는

**장소 중심 라이프로그 플랫폼**을 지향합니다.

---

## ✅ Build Before You Build (개발 전 필수 확인 사항)

React Native 공식 문서를 기준으로 개발을 시작하기 전에, 아래 항목을 먼저 확정하세요.

### 1) Product & Scope

- [ ] **MVP 범위 확정**: v1에 꼭 들어갈 기능만 고정
<<<<<<< ours
<<<<<<< ours
  - 권장 v1: Calendar + Places + Place Search + Visit Note + 기본 계정
  - v1.1 후보: Instagram 자동 추출, 다중 지도 provider, 고급 추천, 고급 통계
=======
  - 권장 v1: Calendar + Places + Place Search + 기본 계정
  - v1.1 후보: Instagram 자동 추출, 고급 추천, 고급 통계
>>>>>>> theirs
=======
  - 권장 v1: Calendar + Places + Place Search + 기본 계정
  - v1.1 후보: Instagram 자동 추출, 고급 추천, 고급 통계
>>>>>>> theirs
- [ ] 플랫폼 우선순위 결정 (Android 먼저 / iOS 동시)
- [ ] 출시 목표와 성공 지표 정의
  - 예: 첫 주 일정 생성률, 장소 저장률, 재방문 체크율

### 2) UX / IA

- [ ] 앱 네비게이션 구조 확정
  - Bottom Tab: `Calendar / Places / Discover`
  - Stack: 상세 화면(일정 생성, 장소 상세, 방문 기록)
- [ ] 핵심 사용자 흐름 와이어 확정
  - 흐름 A: 검색 → 저장 → 일정 연결
<<<<<<< ours
<<<<<<< ours
  - 흐름 B: Discover(placeholder) → 저장 → 일정 연결
=======
  - 흐름 B: Discover → 저장 → 일정 연결
>>>>>>> theirs
=======
  - 흐름 B: Discover → 저장 → 일정 연결
>>>>>>> theirs
- [ ] 실패/빈 상태 UX 정의
  - 검색 결과 없음, 네트워크 오류, 장소 추출 실패 등

### 3) Data Model (앱/서버 공통)

- [ ] 엔티티 스키마 확정
  - `User`
  - `Place` (provider, placeId, 좌표, 주소)
  - `Schedule` (dateTime, placeId, memo, visitStatus)
  - `VisitNote` (rating, memo, revisit)
- [ ] ID 정책 및 시간대(Timezone) 정책 확정
- [ ] 삭제/복구 정책 확정 (soft delete 여부)

### 4) API & Auth

- [ ] 인증 방식 결정 (이메일/비밀번호, 소셜 로그인 포함 여부)
- [ ] 토큰 정책 확정 (만료/갱신/로그아웃)
- [ ] REST API 초안 작성
<<<<<<< ours
<<<<<<< ours
  - 인증: `/auth/signup`, `/auth/login`, `/auth/refresh`, `/auth/logout`
  - 일정: `/schedules`
  - 장소: `/places`, `/places/search`
  - 방문 기록: `/schedules/{id}/visit`
=======
=======
>>>>>>> theirs
  - 인증: `/auth/signup`, `/auth/login`, `/auth/logout`
  - 일정: `/schedules`
  - 장소: `/places`, `/places/search`
  - 방문 기록: `/visits`
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
- [ ] 에러 코드 규약 확정

### 5) Maps & External Integration

- [ ] 지도 Provider 우선순위 결정
  - Naver / Kakao / Google 중 v1 1개 우선 권장
- [ ] 딥링크 규격 검증
  - 예: `nmap://search?query=...`
- [ ] API 키 관리 전략
  - `.env` 분리, 환경별(dev/staging/prod) 키 분리

### 6) Instagram Capture 정책

- [ ] 구현 방식 확정
  - 공식 API / 링크 분석 / 사용자 수동 보정
- [ ] 정책/약관/개인정보 검토
- [ ] 추출 실패 fallback UX 정의

### 7) React Native Engineering Baseline

- [ ] RN CLI 환경 구축 확인 (iOS/Android 빌드 성공)
- [ ] TypeScript strict 모드 사용 여부 확정
- [ ] 상태관리 1개 우선 선택 (Zustand 또는 RTK)
- [ ] 서버 상태 관리: TanStack React Query 표준화
- [ ] 로컬 저장 전략 확정
<<<<<<< ours
<<<<<<< ours
  - Secure Storage: refresh token 등 민감 정보
  - MMKV: 비민감 설정/캐시
=======
  - MMKV: 세션/설정
>>>>>>> theirs
=======
  - MMKV: 세션/설정
>>>>>>> theirs
  - SQLite: 일정/장소/방문 데이터

### 8) Sync / Offline

- [ ] 오프라인 작성 지원 여부 결정
- [ ] 동기화 충돌 규칙 정의 (LWW 등)
- [ ] 재시도 큐/백오프 정책 정의

### 9) Observability & Quality

- [ ] 분석 이벤트 정의
  - `place_saved`, `schedule_created`, `visit_completed`
- [ ] 크래시/로그 수집 도구 결정
- [ ] 테스트 범위 확정
  - 단위 테스트(도메인)
  - 통합 테스트(API)
  - E2E(핵심 플로우)

---

## 🧪 Recommended MVP (실행 가능한 초기 범위)

아래 범위로 시작하면 개발 속도와 품질 균형을 맞추기 쉽습니다.

### In Scope (v1)

<<<<<<< ours
<<<<<<< ours
- 계정: 회원가입/로그인/로그아웃/세션 자동 갱신
- 캘린더: 일정 생성/조회/수정/삭제
- 장소: 검색/저장/상세
- 일정-장소 연결
- 방문 체크 + 일정당 방문 메모 1개
=======
=======
>>>>>>> theirs
- 계정: 회원가입/로그인/로그아웃
- 캘린더: 일정 생성/조회/수정/삭제
- 장소: 검색/저장/상세
- 일정-장소 연결
- 방문 체크 + 간단 메모
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs

### Out of Scope (v1.1+)

- Instagram 자동 장소 추출 고도화(Discover 화면은 v1 placeholder, 자동 추출은 v1.1+)
- 다중 지도 provider 동시 지원
<<<<<<< ours
<<<<<<< ours
- 비밀번호 찾기 / 회원탈퇴 / 수동 장소 입력
=======
>>>>>>> theirs
=======
>>>>>>> theirs
- 고급 추천/리포트/개인화

---

## 🗺 Suggested Milestones

- **M1**: 프로젝트 세팅 + 인증 + 기본 네비게이션
- **M2**: 장소 검색/저장 + 장소 상세
- **M3**: 캘린더 일정 CRUD + 장소 연결
- **M4**: 방문 기록 + 동기화 안정화
<<<<<<< ours
<<<<<<< ours
- **M5**: v1.1 Discover(Instagram) 최소 기능 추가
=======
- **M5**: Discover(Instagram) 최소 기능 추가
>>>>>>> theirs
=======
- **M5**: Discover(Instagram) 최소 기능 추가
>>>>>>> theirs


---

## 📚 Documentation Map

개발 시 아래 문서 순서로 보면 의사결정이 자연스럽게 연결됩니다.

1. 제품/범위: `README.md`, `docs/mvp-spec.md`
2. 데이터 구조: `docs/data-model-v1.md`
<<<<<<< ours
<<<<<<< ours
3. 기술 아키텍처: `docs/architecture-v1.md`
4. API 계약: `docs/api-contract-v1.md`, `docs/api-guidelines.md`
5. 보안/인증: `docs/auth-security.md`
6. 동기화 정책: `docs/sync-conflict-policy.md`
7. 구현 가이드: `docs/implementation-guide-v1.md`
8. 분석 이벤트: `docs/analytics-events.md`
9. 실행 계획: `docs/sprint-1-backlog.md`
10. 배포/환경: `docs/release-environment.md`
=======
=======
>>>>>>> theirs
3. API 계약: `docs/api-contract-v1.md`, `docs/api-guidelines.md`
4. 보안/인증: `docs/auth-security.md`
5. 동기화 정책: `docs/sync-conflict-policy.md`
6. 분석 이벤트: `docs/analytics-events.md`
7. 실행 계획: `docs/sprint-1-backlog.md`
8. 배포/환경: `docs/release-environment.md`
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs

### 빠른 시작 추천 순서

- Step 1: `docs/mvp-spec.md`에서 v1 Scope/DoD 확정
- Step 2: `docs/data-model-v1.md`로 스키마 합의
<<<<<<< ours
<<<<<<< ours
- Step 3: `docs/architecture-v1.md`로 모바일/서버 책임과 저장소 경계 확정
- Step 4: `docs/api-contract-v1.md` + `docs/api-guidelines.md`로 API 확정
- Step 5: `docs/implementation-guide-v1.md`와 `docs/sprint-1-backlog.md`를 이슈/티켓으로 분해

---

## 🧩 Workspace Quick Start

현재 저장소는 `mobile/` React Native 앱과 `server/` Fastify API를 포함한 npm workspace 구조입니다.

```bash
npm install
npm run server:dev
npm run mobile:start
```

유용한 검증 명령:

```bash
npm run lint
npm run typecheck
npm run mobile:test -- --runInBand
```

현재 기본 확인 endpoint:

- `GET /health`
- `GET /api/v1/health`
=======
- Step 3: `docs/api-contract-v1.md` + `docs/api-guidelines.md`로 API 확정
- Step 4: `docs/sprint-1-backlog.md`를 이슈/티켓으로 분해

>>>>>>> theirs
=======
- Step 3: `docs/api-contract-v1.md` + `docs/api-guidelines.md`로 API 확정
- Step 4: `docs/sprint-1-backlog.md`를 이슈/티켓으로 분해

>>>>>>> theirs

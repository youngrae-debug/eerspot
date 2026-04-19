# eerspot

**Plan your time. Save your spots.**

`eerspot`은 장소를 저장하고, 일정으로 연결하고, 방문 경험까지 남기는 **장소 기반 일정 관리 앱**입니다.

---

## 제품 방향

대부분의 일정 앱은 시간 중심으로 계획을 세우지만, 실제 행동은 장소에서 시작되는 경우가 많습니다.

예시:
- 친구와 저녁 약속 잡기
- 주말 카페 방문 계획
- 여행 동선 구성
- 저장해둔 맛집 다시 찾기

`eerspot`은 아래 흐름을 하나로 연결하는 것을 목표로 합니다.

**Discover → Save → Plan → Visit → Remember**

---

## 현재 v1 범위

### 1) Account
- 이메일/비밀번호 회원가입
- 로그인
- 로그아웃
- 리프레시 토큰 기반 세션 갱신

### 2) Place Search
- 장소 키워드 검색
- Kakao Local API 기반 검색
- 검색 결과 저장
- 저장 장소 상세 조회

### 3) Scheduling
- 일정 생성
- 날짜 범위 기준 일정 조회
- 일정 수정 / 삭제
- 일정에 장소 연결
- 방문 상태 관리 (`planned`, `visited`, `skipped`)

### 4) Personal Archive
- 저장한 장소 목록 확인
- 일정과 장소를 연결해 개인 아카이브 구성

### 5) Discover
- v1에서는 placeholder 화면만 유지
- Instagram 기반 자동 추출은 v1.1+ 후보

---

## 지도 전략

v1 기본 지도 provider는 **Kakao**입니다.

- 서버 장소 검색: Kakao Local API
- 장소 provider 값: `kakao`
- 향후 필요 시 Naver / Google 확장 가능

---

## 현재 앱 구조

### Mobile
- `Calendar`: 일정 확인
- `Places`: 장소 검색 / 저장 / 상세 확인
- `Discover`: placeholder
- `My`: 언어 설정 / 세션 관리

### Server
- `Auth`: 회원가입 / 로그인 / 리프레시 / 로그아웃
- `Places`: 검색 / 저장 / 목록 / 상세
- `Schedules`: 생성 / 목록 / 상세 / 수정 / 삭제
- `Health`: 상태 확인

---

## 기술 스택

### Mobile
- React Native (CLI)
- TypeScript
- react-native-keychain
- react-native-safe-area-context

### Server
- Node.js
- Fastify
- TypeScript
- Zod

### Storage
- 서버는 기본적으로 SQLite(`server/data/eerspot.sqlite`)에 영속 저장
- 테스트 환경에서는 기존처럼 in-memory 저장소 사용

---

## 환경 변수

### Server

`server/.env.example`

```env
HOST=0.0.0.0
PORT=3000
APP_ENV=dev
MAP_PROVIDER=kakao
KAKAO_REST_API_KEY=your_kakao_rest_api_key
LOG_LEVEL=info
CORS_ORIGIN=*
DATABASE_PATH=./server/data/eerspot.sqlite
```

### Mobile

`mobile/.env.example`

```env
API_BASE_URL=http://localhost:3000/api/v1
APP_ENV=dev
MAP_PROVIDER=kakao
FEATURE_DISCOVER_ENABLED=false
ANALYTICS_WRITE_KEY=
```

---

## 실행 방법

### 1) 의존성 설치

```bash
npm install
```

### 2) 서버 실행

```bash
npm run server:start
```

### 3) 모바일 실행

```bash
npm run mobile:start
```

Android:

```bash
npm run mobile:android
```

iOS:

```bash
npm run mobile:ios
```

---

## 다음 작업 우선순위

- README/기획 문서 지속 정리
- Kakao 검색 실패 UX 개선
- 모바일 env 하드코딩 축소
- Discover 기능 구체화
- 영구 저장소(DB) 연동
- Places → Schedule 연결 UX 보강

---

## Vision

`eerspot`은 단순히 시간을 적는 앱이 아니라,

- 발견한 장소를 저장하고
- 실제 일정으로 연결하며
- 방문 이후의 경험까지 쌓아가는

**장소 중심 라이프로그 플랫폼**을 지향합니다.

# Sprint 1 Backlog (2주)

연결 문서:
- 범위/DoD: `docs/mvp-spec.md`
- 데이터 모델: `docs/data-model-v1.md`
- API 계약: `docs/api-contract-v1.md`
- API 공통 규약: `docs/api-guidelines.md`

## 목표
- 로그인 가능한 앱 골격 완성
- 장소 검색/저장 흐름 1차 완성
- 일정 생성 및 장소 연결까지 동작


## 운영 필드 (실행 관리)
티켓 생성 시 아래 필드를 함께 기록합니다.

| field | 설명 | 예시 |
|---|---|---|
| priority | 우선순위 | P0 / P1 / P2 |
| owner | 담당자 | @mobile-a |
| estimate | 예상 소요 | 0.5d / 1d / 2d |
| dependency | 선행 작업 | B-1 완료 후 D-1 진행 |

## Epic A. App Foundation

### A-1 프로젝트 기본 세팅
- [ ] RN CLI 프로젝트 구조 정리
- [ ] TypeScript strict 설정
- [ ] ESLint/Prettier 설정
- [ ] 환경변수(.env) 로딩

### A-2 네비게이션
- [ ] Bottom Tab(Calendar/Places/Discover)
- [ ] 공통 Stack 라우팅
- [ ] Auth 게이트 구성

## Epic B. Auth

### B-1 인증 API 연동
- [ ] signup/login/logout API client
- [ ] 토큰 저장(MMKV)
- [ ] 토큰 만료 시 로그아웃 처리

### B-2 인증 화면
- [ ] LoginScreen
- [ ] SignUpScreen
- [ ] 에러/로딩 UI

## Epic C. Place

### C-1 장소 검색
- [ ] 검색 입력/디바운스
- [ ] 검색 결과 목록 표시
- [ ] 빈 상태/에러 상태 처리

### C-2 장소 저장/조회
- [ ] 저장 API 연동
- [ ] Places 목록 조회
- [ ] PlaceDetail 화면 기초

## Epic D. Schedule

### D-1 일정 CRUD
- [ ] 일정 생성 폼
- [ ] 일정 목록(일/월 뷰 최소 1개)
- [ ] 일정 수정/삭제

### D-2 일정-장소 연결
- [ ] 일정 생성 시 저장된 장소 선택
- [ ] 일정 상세에 장소 정보 표시

## QA / Done Criteria
- [ ] 핵심 플로우 E2E 점검
  - 로그인 → 장소 검색/저장 → 일정 생성(장소 연결) → 일정 조회
- [ ] 크래시 없이 Android 디버그 빌드 동작
- [ ] 주요 API 실패 케이스 처리 확인

## 예상 일정(예시)
- Week 1: A + B + C-1
- Week 2: C-2 + D + QA

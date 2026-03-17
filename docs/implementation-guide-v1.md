# eerspot Implementation Guide v1

관련 문서:
- 아키텍처: `docs/architecture-v1.md`
- 범위/DoD: `docs/mvp-spec.md`
- 스프린트 계획: `docs/sprint-1-backlog.md`

## 1) 목적
문서 기준안을 실제 구현 작업으로 옮길 때, 어떤 순서로 저장소를 만들고 무엇을 먼저 검증해야 하는지 정리한다.

## 2) 권장 저장소 구조

```text
.
├─ README.md
├─ docs/
├─ mobile/
│  ├─ src/
│  └─ package.json
└─ server/
   ├─ src/
   └─ package.json
```

모노레포가 아니어도 되지만, 현재 문서가 모바일/서버를 함께 다루므로 초기에는 위 구조가 가장 관리하기 쉽다.

## 3) Milestone별 구현 순서

### M0. Bootstrap
- `mobile/` React Native 프로젝트 생성
- `server/` Node.js API 프로젝트 생성
- TypeScript strict, lint, format, env loading 설정
- dev/staging/prod `.env` 템플릿 분리

완료 기준:
- 모바일 앱이 실행된다.
- 서버 헬스체크 endpoint가 동작한다.

### M1. Auth Foundation
- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- mobile secure storage 연동
- API client 401 interceptor 또는 refresh wrapper 구현

완료 기준:
- access token 만료를 강제로 만들어도 refresh 후 세션 유지가 된다.
- refresh 실패 시 로그인 화면으로 안전하게 복귀한다.

### M2. Places
- 단일 지도 provider 검색 API 연동
- `POST /places`
- `GET /places`
- `GET /places/{id}`
- 중복 저장 409 처리

완료 기준:
- 검색 결과 저장 후 Places 목록과 상세에서 바로 확인된다.

### M3. Schedules
- `POST /schedules`
- `GET /schedules`
- `GET /schedules/{id}`
- `PATCH /schedules/{id}`
- `DELETE /schedules/{id}`
- 장소 연결 UI

완료 기준:
- 저장된 장소를 일정에 연결하고 수정/삭제까지 가능하다.

### M4. VisitNote
- `POST /schedules/{id}/visit`
- `GET /schedules/{id}/visit`
- `PATCH /schedules/{id}/visit`
- 일정당 1건 제약 UI/서버 처리

완료 기준:
- 방문 완료와 방문 메모 수정이 일정 상세에서 일관되게 보인다.

### M5. Sync Hardening
- SQLite 저장
- `syncStatus` 반영
- 재시도 큐
- 실패 배지 / 수동 재시도

완료 기준:
- 네트워크를 끊은 상태에서 작성 후 복구 시 데이터가 서버로 반영된다.

## 4) 구현 체크포인트

### API 타입
- 응답 타입은 항상 `data` envelope 기준으로 생성한다.
- 에러 타입은 공통 `ApiError`로 통일한다.

### 시간 처리
- 서버 저장은 UTC
- 모바일 표시는 로컬 타임존
- 날짜 필터는 UTC 변환 기준이 섞이지 않도록 adapter를 둔다.

### ID 처리
- 클라이언트는 ID 포맷을 추론하지 않는다.
- 문자열 UUID로만 취급한다.

### VisitNote 제약
- 생성 전에 상세 조회를 시도하거나 schedule 상태를 함께 본다.
- 409가 오면 생성이 아니라 수정 흐름으로 전환한다.

## 5) 권장 초기 이슈 분해

### Mobile
- auth storage adapter
- api client + refresh retry
- places list/search/detail screens
- schedule form + list
- visit note form
- sqlite schema + sync status fields

### Server
- auth module + refresh rotation storage
- place repository + unique constraint
- schedule repository + soft delete
- visit note repository + `(scheduleId)` unique constraint
- request logging + requestId middleware

## 6) 테스트 최소 기준

### Server
- auth refresh rotation 테스트
- place duplicate 409 테스트
- schedule soft delete 제외 조회 테스트
- visit note 1:1 제약 테스트

### Mobile
- 로그인 성공/실패
- token refresh 성공/실패
- 장소 저장 후 목록 반영
- 일정 생성 후 장소 연결 표시
- 방문 메모 생성 후 상세 반영

## 7) 첫 구현에서 미루지 말아야 할 것
- secure storage 분리
- 공통 API envelope 처리
- requestId 포함 에러 처리
- UUID/UTC 기준 고정
- VisitNote 1:1 제약

## 8) 권장 시작 순서
1. `mobile/`, `server/` 프로젝트 생성
2. auth API와 refresh 흐름 구현
3. place/schedule/visit 엔티티와 DB 스키마 생성
4. 화면 연결
5. sync hardening

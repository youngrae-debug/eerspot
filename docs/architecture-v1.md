# eerspot Architecture v1

관련 문서:
- 범위/DoD: `docs/mvp-spec.md`
- 데이터 모델: `docs/data-model-v1.md`
- API 계약: `docs/api-contract-v1.md`
- 인증/보안: `docs/auth-security.md`
- 동기화 정책: `docs/sync-conflict-policy.md`

## 1) 목표
v1 아키텍처의 목표는 아래 3가지를 안정적으로 만족하는 것이다.
- 로그인 후 세션이 자연스럽게 유지된다.
- 장소 저장과 일정 연결이 오프라인/불안정 네트워크에서도 복구 가능하다.
- 문서 기준(API, 데이터 모델, 보안 정책)이 모바일/서버에 동일하게 반영된다.

## 2) 시스템 구성

### Mobile App (React Native)
- 화면, 상태관리, API 호출, 로컬 저장, 동기화 큐를 담당한다.
- 네트워크가 불안정해도 사용자가 작성한 데이터를 먼저 로컬에 반영한다.

### API Server
- 인증, 장소 저장, 일정 CRUD, 방문 메모 CRUD를 담당한다.
- 최종 정합성 기준은 서버 DB와 서버 `updatedAt`이다.

### Database
- 서버 DB는 `User`, `Place`, `Schedule`, `VisitNote`를 저장한다.
- 모바일 SQLite는 동일 엔티티 + 로컬 전용 sync 메타데이터를 저장한다.

### External Services
- 지도 provider API: v1에서는 1개만 활성화한다.
- Analytics: 핵심 이벤트만 수집한다.
- v1.1+: Instagram 분석, AI 추출 기능 추가

## 3) 책임 분리

### Mobile 책임
- access token 만료 감지 및 `POST /auth/refresh` 호출
- refresh token 회전 시 secure storage 값 즉시 교체
- SQLite 기반 list/detail 캐시 유지
- 로컬 작성 데이터의 `syncStatus` 관리

### Server 책임
- UUID 발급 및 UTC timestamp 생성
- unique constraint 보장
- refresh token rotation 보장
- conflict 최종 판정

## 4) 인증 아키텍처

### Token 저장 원칙
- refresh token: OS secure storage
- access token: 메모리 우선
- MMKV: 비민감 설정값만 저장

### 세션 흐름
1. `POST /auth/login` 성공 시 access/refresh token 수신
2. refresh token을 secure storage에 저장
3. access token 만료로 401 발생 시 1회 refresh 시도
4. `POST /auth/refresh` 성공 시 새 access/refresh token으로 교체
5. refresh 실패 시 secure storage 정리 후 로그아웃

### 금지 사항
- refresh token을 SQLite 또는 일반 로그에 저장하지 않는다.
- access token을 영속 저장소 기본값으로 두지 않는다.

## 5) 데이터 저장 전략

### Secure Storage
- refresh token
- 필요 시 device/session identifier

### MMKV
- 선택한 지도 provider
- feature flag 캐시
- 마지막 사용 탭, UI 설정

### SQLite
- `places`
- `schedules`
- `visit_notes`
- `sync_queue` 또는 엔티티별 `syncStatus` 필드

## 6) 동기화 모델

### Write Path
1. 사용자가 장소/일정/방문 메모를 생성 또는 수정
2. 모바일은 로컬 DB에 먼저 반영
3. `syncStatus=pending`
4. 네트워크 가능 시 서버 반영
5. 성공 시 `syncStatus=synced`, `lastSyncAt` 갱신

### Conflict Rule
- 기본 규칙: LWW
- 기준값: 서버가 관리하는 `updatedAt`
- VisitNote는 `scheduleId` 기준 1:1 제약을 유지한다.

### 실패 처리
- 재시도: 1s → 3s → 10s → 30s
- 최종 실패 시 UI에 수동 재시도 상태를 노출

## 7) API 클라이언트 원칙
- `200/201` 응답은 항상 `data`를 통해 읽는다.
- `204` 응답은 body 없이 처리한다.
- 에러는 `error.code`, `error.message`, `error.requestId` 기준으로 처리한다.
- 생성 API는 가능하면 `Idempotency-Key`를 사용한다.

## 8) 권장 모듈 구조

### Mobile
```text
mobile/
  src/
    app/
    navigation/
    screens/
    features/
      auth/
      places/
      schedules/
      visits/
    services/
      api/
      analytics/
      storage/
      sync/
    db/
    state/
    utils/
```

### Backend
```text
server/
  src/
    app/
    modules/
      auth/
      places/
      schedules/
      visits/
    db/
      migrations/
      repositories/
    middleware/
    utils/
```

## 9) 구현 우선순위
1. Auth + token refresh
2. Place search/save/list/detail
3. Schedule CRUD + place link
4. VisitNote 1:1 CRUD
5. Sync retry and failed badge

## 10) v1 제외 항목
- Instagram 자동 추출
- 다중 provider 동시 사용
- 수동 장소 입력
- 전체 기기 로그아웃
- 비밀번호 찾기 / 회원탈퇴

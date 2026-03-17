# Sync & Conflict Policy (v1)

오프라인/불안정 네트워크 환경에서의 동기화 기준입니다.

## 1) 기본 전략
- 로컬 우선 작성(Local-first write)
- 서버 동기화 성공 시 `syncStatus=synced`
- 실패 시 `syncStatus=failed` 후 재시도 큐 등록

## 2) Sync Status
- `pending`: 아직 서버 미반영
- `synced`: 서버 반영 완료
- `failed`: 반영 실패(재시도 대상)

## 3) Conflict Resolution
v1 기본 규칙: **LWW (Last Write Wins)**
- 비교 기준: `updatedAt`(UTC)
- 서버/클라이언트 시간이 크게 어긋난 경우를 대비해 서버 시간이 최종 기준

## 4) Entity별 규칙
- Place
  - `(userId, provider, providerPlaceId)` 충돌 시 기존 레코드 재사용
- Schedule
  - 동일 ID 수정 충돌 시 최신 `updatedAt` 승리
- VisitNote
<<<<<<< ours
<<<<<<< ours
  - v1에서는 `scheduleId` 당 1건만 허용
  - 동일 scheduleId 수정 충돌 시 최신 `updatedAt` 승리
=======
  - scheduleId 기준 다건 허용, 동일 noteId 충돌만 LWW
>>>>>>> theirs
=======
  - scheduleId 기준 다건 허용, 동일 noteId 충돌만 LWW
>>>>>>> theirs

## 5) Retry Policy
- 백오프: 1s → 3s → 10s → 30s (최대 4회)
- 4회 실패 후 사용자에게 수동 재시도 안내

## 6) 사용자 경험 규칙
- `failed` 항목은 UI에 "동기화 필요" 배지 표시
- 사용자가 수동 재시도 버튼으로 재동기화 가능

## 7) 예시 시나리오
1. 오프라인에서 일정 제목 수정
2. 온라인 복구 전 다른 기기에서 같은 일정 수정
3. 동기화 시 서버 `updatedAt`가 더 최신이면 서버 값 채택
4. 클라이언트에는 "최신 버전으로 갱신됨" 토스트 노출

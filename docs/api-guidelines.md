# API Guidelines

`eerspot` API를 일관되게 유지하기 위한 공통 규약입니다.

## 1) Versioning & Compatibility
- Base path: `/api/v1`
- **Non-breaking 변경**(필드 추가, optional 파라미터 추가)은 `v1` 유지
- **Breaking 변경**(필드 삭제/타입 변경/필수화)은 `v2`로 분리
- Deprecation 공지: 최소 90일 유지 후 제거

## 2) Response Envelope
성공 응답은 endpoint 성격에 따라 아래 중 하나를 사용합니다.
<<<<<<< ours
<<<<<<< ours
- `200` / `201` 응답은 항상 최상위 `data` 필드를 사용한다.
- `204` 응답은 body를 반환하지 않는다.
=======
>>>>>>> theirs
=======
>>>>>>> theirs

### Resource 응답
```json
{
  "data": {
<<<<<<< ours
<<<<<<< ours
    "id": "550e8400-e29b-41d4-a716-446655440000"
=======
    "id": "sch_123"
>>>>>>> theirs
=======
    "id": "sch_123"
>>>>>>> theirs
  }
}
```

### List 응답
```json
{
  "data": {
    "items": [],
    "pageInfo": {
      "nextCursor": null,
      "hasNext": false
    }
  }
}
```

<<<<<<< ours
<<<<<<< ours
- `pageInfo`는 pagination이 필요한 list endpoint에서만 포함한다.

=======
>>>>>>> theirs
=======
>>>>>>> theirs
## 3) Error Envelope
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "title is required",
<<<<<<< ours
<<<<<<< ours
    "requestId": "req_abc123",
    "details": {
      "field": "title"
    }
=======
    "requestId": "req_abc123"
>>>>>>> theirs
=======
    "requestId": "req_abc123"
>>>>>>> theirs
  }
}
```

- `message`: 사용자에게 바로 노출 가능한 문장
- 내부 디버그 정보는 서버 로그에만 기록
<<<<<<< ours
<<<<<<< ours
- 에러 응답에서는 success용 최상위 `data` 필드를 함께 사용하지 않는다.
=======
>>>>>>> theirs
=======
>>>>>>> theirs

## 4) Pagination / Sorting / Filtering
List API 공통 규칙:
- Cursor 기반 pagination 권장
  - `?limit=20&cursor=...`
- `limit` 기본값: 20, 최대값: 100
- 정렬 파라미터
  - `sortBy`, `order` (`asc`/`desc`)

예시:
- `GET /places?limit=20&cursor=...&sortBy=savedAt&order=desc`
- `GET /schedules?from=2026-03-01&to=2026-03-31&sortBy=scheduledAt&order=asc`

## 5) Idempotency
중복 생성 방지를 위해 생성 API는 선택적으로 `Idempotency-Key` 헤더를 지원합니다.
<<<<<<< ours
<<<<<<< ours
- 대상: `POST /places`, `POST /schedules`, `POST /schedules/{id}/visit`
=======
- 대상: `POST /places`, `POST /schedules`, `POST /visits`
>>>>>>> theirs
=======
- 대상: `POST /places`, `POST /schedules`, `POST /visits`
>>>>>>> theirs

## 6) Rate Limit
- 기본 제한: 사용자별 60 req/min (초안)
- 초과 시 `429 TOO_MANY_REQUESTS`
- 응답 헤더 예시:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `Retry-After`

## 7) Status Code Rules
- 200: 조회/수정 성공
- 201: 생성 성공
- 204: 삭제/로그아웃 성공(응답 body 없음)
- 400: 검증 실패
- 401: 인증 실패
- 403: 권한 없음
- 404: 리소스 없음
- 409: 충돌(중복 저장 등)
- 429: 요청 제한 초과
- 500: 서버 오류

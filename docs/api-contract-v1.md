# eerspot API Contract v1 (Draft)

Base URL: `/api/v1`

관련 문서:
- 공통 API 규약: `docs/api-guidelines.md`
- 인증/보안 정책: `docs/auth-security.md`

## 공통
- 응답 포맷은 `docs/api-guidelines.md`의 envelope 규칙을 따른다.
- Authorization: `Bearer <accessToken>`
- Content-Type: `application/json`
<<<<<<< ours
<<<<<<< ours
- 시간 필드는 UTC ISO-8601 문자열을 사용한다.
- ID는 UUID 문자열을 사용한다.
=======
>>>>>>> theirs
=======
>>>>>>> theirs
- 에러 포맷:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
<<<<<<< ours
<<<<<<< ours
    "message": "title is required",
    "requestId": "req_abc123"
=======
    "message": "title is required"
>>>>>>> theirs
=======
    "message": "title is required"
>>>>>>> theirs
  }
}
```

---

## 1) Auth

### POST /auth/signup
Request
```json
{
  "email": "user@example.com",
  "password": "Secret123!"
}
```
Response 201
```json
{
<<<<<<< ours
<<<<<<< ours
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com"
  }
=======
  "id": "usr_123",
  "email": "user@example.com"
>>>>>>> theirs
=======
  "id": "usr_123",
  "email": "user@example.com"
>>>>>>> theirs
}
```

### POST /auth/login
Request
```json
{
  "email": "user@example.com",
  "password": "Secret123!"
}
```
Response 200
```json
{
<<<<<<< ours
<<<<<<< ours
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com"
    }
  }
}
```

### POST /auth/refresh
Request
```json
{
  "refreshToken": "..."
}
```
Response 200
```json
{
  "data": {
    "accessToken": "...",
    "refreshToken": "..."
=======
=======
>>>>>>> theirs
  "accessToken": "...",
  "refreshToken": "...",
  "user": {
    "id": "usr_123",
    "email": "user@example.com"
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
  }
}
```

### POST /auth/logout
<<<<<<< ours
<<<<<<< ours
Request
```json
{
  "refreshToken": "..."
}
```
Response 204

동작 규칙:
- `signup`, `login`, `refresh`를 제외한 endpoint는 access token이 필요하다.
- `refresh`는 refresh token rotation을 수행하며, 응답의 새 refresh token으로 즉시 교체해야 한다.

=======
Response 204

>>>>>>> theirs
=======
Response 204

>>>>>>> theirs
---

## 2) Places

### GET /places/search?query={keyword}
Response 200
```json
{
<<<<<<< ours
<<<<<<< ours
  "data": {
    "items": [
      {
        "provider": "naver",
        "providerPlaceId": "abc",
        "name": "성수 미도인",
        "address": "서울 ...",
        "lat": 37.5,
        "lng": 127.0
      }
    ]
  }
}
```

동작 규칙:
- v1 클라이언트는 환경 설정으로 선택된 단일 지도 provider만 사용한다.

=======
=======
>>>>>>> theirs
  "items": [
    {
      "provider": "naver",
      "providerPlaceId": "abc",
      "name": "성수 미도인",
      "address": "서울 ...",
      "lat": 37.5,
      "lng": 127.0
    }
  ]
}
```

<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
### POST /places
Request
```json
{
  "provider": "naver",
  "providerPlaceId": "abc",
  "name": "성수 미도인",
  "address": "서울 ...",
  "lat": 37.5,
  "lng": 127.0
}
```
Response 201
```json
{
  "data": {
<<<<<<< ours
<<<<<<< ours
    "id": "8b4d9d7e-b2e1-4a3a-a1df-1f4d3e8f2b30"
=======
    "id": "plc_123"
>>>>>>> theirs
=======
    "id": "plc_123"
>>>>>>> theirs
  }
}
```

Duplicate (409)
```json
{
  "error": {
    "code": "PLACE_DUPLICATED",
    "message": "이미 저장된 장소입니다",
<<<<<<< ours
<<<<<<< ours
    "requestId": "req_abc123",
    "details": {
      "existingPlaceId": "8b4d9d7e-b2e1-4a3a-a1df-1f4d3e8f2b30"
    }
=======
=======
>>>>>>> theirs
    "requestId": "req_abc123"
  },
  "data": {
    "existingPlaceId": "plc_123"
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
  }
}
```

### GET /places
Response 200
```json
{
<<<<<<< ours
<<<<<<< ours
  "data": {
    "items": [
      {
        "id": "8b4d9d7e-b2e1-4a3a-a1df-1f4d3e8f2b30",
        "provider": "naver",
        "providerPlaceId": "abc",
        "name": "성수 미도인",
        "address": "서울 ...",
        "lat": 37.5,
        "lng": 127.0,
        "savedAt": "2026-03-15T10:00:00Z"
      }
    ],
    "pageInfo": {
      "nextCursor": null,
      "hasNext": false
    }
  }
}
```

### GET /places/{id}
Response 200
```json
{
  "data": {
    "id": "8b4d9d7e-b2e1-4a3a-a1df-1f4d3e8f2b30",
    "provider": "naver",
    "providerPlaceId": "abc",
    "name": "성수 미도인",
    "address": "서울 ...",
    "lat": 37.5,
    "lng": 127.0,
    "savedAt": "2026-03-15T10:00:00Z"
  }
=======
=======
>>>>>>> theirs
  "items": [
    {
      "id": "plc_123",
      "name": "성수 미도인"
    }
  ]
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
}
```

---

## 3) Schedules

### POST /schedules
Request
```json
{
  "title": "저녁 약속",
  "scheduledAt": "2026-03-21T09:00:00Z",
  "memo": "늦지 않기",
<<<<<<< ours
<<<<<<< ours
  "placeId": "8b4d9d7e-b2e1-4a3a-a1df-1f4d3e8f2b30"
=======
  "placeId": "plc_123"
>>>>>>> theirs
=======
  "placeId": "plc_123"
>>>>>>> theirs
}
```
Response 201
```json
{
<<<<<<< ours
<<<<<<< ours
  "data": {
    "id": "c12d5c77-60df-4f84-9648-cda5a61d1258"
  }
=======
  "id": "sch_123"
>>>>>>> theirs
=======
  "id": "sch_123"
>>>>>>> theirs
}
```

### GET /schedules?from=2026-03-01&to=2026-03-31
Response 200
```json
{
<<<<<<< ours
<<<<<<< ours
  "data": {
    "items": [
      {
        "id": "c12d5c77-60df-4f84-9648-cda5a61d1258",
        "title": "저녁 약속",
        "scheduledAt": "2026-03-21T09:00:00Z",
        "visitStatus": "planned",
        "placeId": "8b4d9d7e-b2e1-4a3a-a1df-1f4d3e8f2b30"
      }
    ]
  }
}
```

### GET /schedules/{id}
Response 200
```json
{
  "data": {
    "id": "c12d5c77-60df-4f84-9648-cda5a61d1258",
    "title": "저녁 약속",
    "scheduledAt": "2026-03-21T09:00:00Z",
    "memo": "늦지 않기",
    "visitStatus": "planned",
    "placeId": "8b4d9d7e-b2e1-4a3a-a1df-1f4d3e8f2b30"
  }
=======
=======
>>>>>>> theirs
  "items": [
    {
      "id": "sch_123",
      "title": "저녁 약속",
      "scheduledAt": "2026-03-21T09:00:00Z",
      "visitStatus": "planned"
    }
  ]
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
}
```

### PATCH /schedules/{id}
Request
```json
{
  "title": "저녁 약속(수정)",
  "visitStatus": "visited"
}
```
Response 200
```json
{
<<<<<<< ours
<<<<<<< ours
  "data": {
    "id": "c12d5c77-60df-4f84-9648-cda5a61d1258",
    "updated": true
  }
=======
  "id": "sch_123",
  "updated": true
>>>>>>> theirs
=======
  "id": "sch_123",
  "updated": true
>>>>>>> theirs
}
```

### DELETE /schedules/{id}
Response 204

동작 규칙:
- v1에서는 **soft delete**를 적용하며, `deletedAt`만 설정한다.
- 기본 조회 API(`GET /schedules`)에서는 `deletedAt != null` 항목을 제외한다.

---

<<<<<<< ours
<<<<<<< ours
## 4) Visit Note

### POST /schedules/{id}/visit
Request
```json
{
=======
=======
>>>>>>> theirs
## 4) Visit Notes

### POST /visits
Request
```json
{
  "scheduleId": "sch_123",
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
  "rating": 5,
  "memo": "분위기 좋음",
  "revisit": true,
  "visitedAt": "2026-03-21T11:30:00Z"
}
```
Response 201
```json
{
<<<<<<< ours
<<<<<<< ours
  "data": {
    "id": "14ac2bb9-7f8b-4e6d-b5ec-8d0c9b8a6f20",
    "scheduleId": "c12d5c77-60df-4f84-9648-cda5a61d1258"
  }
}
```

동작 규칙:
- v1에서는 schedule 1건당 VisitNote 1건만 허용한다.
- VisitNote 생성/수정 성공 시 해당 schedule의 `visitStatus`는 `visited`로 맞춘다.

### GET /schedules/{id}/visit
Response 200
```json
{
  "data": {
    "id": "14ac2bb9-7f8b-4e6d-b5ec-8d0c9b8a6f20",
    "scheduleId": "c12d5c77-60df-4f84-9648-cda5a61d1258",
    "rating": 5,
    "memo": "분위기 좋음",
    "revisit": true,
    "visitedAt": "2026-03-21T11:30:00Z"
  }
}
```

### PATCH /schedules/{id}/visit
Request
```json
{
  "memo": "분위기 좋고 재방문 예정",
  "revisit": true
}
```
Response 200
```json
{
  "data": {
    "id": "14ac2bb9-7f8b-4e6d-b5ec-8d0c9b8a6f20",
    "updated": true
  }
}
```

Duplicate create (409)
```json
{
  "error": {
    "code": "VISIT_ALREADY_EXISTS",
    "message": "이미 방문 메모가 존재합니다",
    "requestId": "req_abc123",
    "details": {
      "visitId": "14ac2bb9-7f8b-4e6d-b5ec-8d0c9b8a6f20"
    }
  }
}
```

없는 VisitNote 조회 (404)
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "visit note not found",
    "requestId": "req_abc123"
  }
=======
=======
>>>>>>> theirs
  "id": "vis_123"
}
```

### GET /visits?scheduleId=sch_123
Response 200
```json
{
  "items": [
    {
      "id": "vis_123",
      "rating": 5,
      "memo": "분위기 좋음",
      "revisit": true
    }
  ]
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
}
```

---

## 에러 코드 초안
- VALIDATION_ERROR (400)
- UNAUTHORIZED (401)
- FORBIDDEN (403)
- NOT_FOUND (404)
<<<<<<< ours
<<<<<<< ours
- PLACE_DUPLICATED (409)
- VISIT_ALREADY_EXISTS (409)
- TOO_MANY_REQUESTS (429)
=======
- CONFLICT (409)
>>>>>>> theirs
=======
- CONFLICT (409)
>>>>>>> theirs
- INTERNAL_ERROR (500)

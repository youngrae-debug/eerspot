# eerspot API Contract v1 (Draft)

Base URL: `/api/v1`

관련 문서:
- 공통 API 규약: `docs/api-guidelines.md`
- 인증/보안 정책: `docs/auth-security.md`

## 공통
- 응답 포맷은 `docs/api-guidelines.md`의 envelope 규칙을 따른다.
- Authorization: `Bearer <accessToken>`
- Content-Type: `application/json`
- 에러 포맷:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "title is required"
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
  "id": "usr_123",
  "email": "user@example.com"
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
  "accessToken": "...",
  "refreshToken": "...",
  "user": {
    "id": "usr_123",
    "email": "user@example.com"
  }
}
```

### POST /auth/logout
Response 204

---

## 2) Places

### GET /places/search?query={keyword}
Response 200
```json
{
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
    "id": "plc_123"
  }
}
```

Duplicate (409)
```json
{
  "error": {
    "code": "PLACE_DUPLICATED",
    "message": "이미 저장된 장소입니다",
    "requestId": "req_abc123"
  },
  "data": {
    "existingPlaceId": "plc_123"
  }
}
```

### GET /places
Response 200
```json
{
  "items": [
    {
      "id": "plc_123",
      "name": "성수 미도인"
    }
  ]
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
  "placeId": "plc_123"
}
```
Response 201
```json
{
  "id": "sch_123"
}
```

### GET /schedules?from=2026-03-01&to=2026-03-31
Response 200
```json
{
  "items": [
    {
      "id": "sch_123",
      "title": "저녁 약속",
      "scheduledAt": "2026-03-21T09:00:00Z",
      "visitStatus": "planned"
    }
  ]
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
  "id": "sch_123",
  "updated": true
}
```

### DELETE /schedules/{id}
Response 204

동작 규칙:
- v1에서는 **soft delete**를 적용하며, `deletedAt`만 설정한다.
- 기본 조회 API(`GET /schedules`)에서는 `deletedAt != null` 항목을 제외한다.

---

## 4) Visit Notes

### POST /visits
Request
```json
{
  "scheduleId": "sch_123",
  "rating": 5,
  "memo": "분위기 좋음",
  "revisit": true,
  "visitedAt": "2026-03-21T11:30:00Z"
}
```
Response 201
```json
{
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
}
```

---

## 에러 코드 초안
- VALIDATION_ERROR (400)
- UNAUTHORIZED (401)
- FORBIDDEN (403)
- NOT_FOUND (404)
- CONFLICT (409)
- INTERNAL_ERROR (500)

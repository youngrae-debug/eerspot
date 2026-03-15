# eerspot Data Model v1

## 원칙
- 동기화 상세 정책은 `docs/sync-conflict-policy.md`를 따른다.
- 서버 DB와 모바일 로컬 DB(캐시/오프라인)의 필드 이름을 최대한 일치시킨다.
- 시간은 UTC로 저장하고, 클라이언트에서 로컬 타임존으로 표시한다.

## Entities

## 1) User
| field | type | required | note |
|---|---|---|---|
| id | string(uuid) | Y | PK |
| email | string | Y | unique |
| passwordHash | string | Y | server only |
| createdAt | string(datetime) | Y | UTC |
| updatedAt | string(datetime) | Y | UTC |

## 2) Place
| field | type | required | note |
|---|---|---|---|
| id | string(uuid) | Y | PK |
| userId | string(uuid) | Y | owner |
| provider | enum(naver,kakao,google,manual) | Y | source provider |
| providerPlaceId | string | N | provider 원본 ID |
| name | string | Y | 장소명 |
| address | string | N | 주소 |
| lat | number | N | 위도 |
| lng | number | N | 경도 |
| savedAt | string(datetime) | Y | UTC |
| createdAt | string(datetime) | Y | UTC |
| updatedAt | string(datetime) | Y | UTC |

### unique constraint
- (userId, provider, providerPlaceId)

## 3) Schedule
| field | type | required | note |
|---|---|---|---|
| id | string(uuid) | Y | PK |
| userId | string(uuid) | Y | owner |
| title | string | Y | 일정 제목 |
| memo | string | N | 일정 메모 |
| scheduledAt | string(datetime) | Y | UTC 저장 |
| placeId | string(uuid) | N | Place FK |
| visitStatus | enum(planned,visited,skipped) | Y | default=planned |
| createdAt | string(datetime) | Y | UTC |
| updatedAt | string(datetime) | Y | UTC |
| deletedAt | string(datetime) | N | soft delete |

## 4) VisitNote
| field | type | required | note |
|---|---|---|---|
| id | string(uuid) | Y | PK |
| userId | string(uuid) | Y | owner |
| scheduleId | string(uuid) | Y | Schedule FK |
| rating | integer(1~5) | N | 별점 |
| memo | string | N | 방문 메모 |
| revisit | boolean | N | 재방문 의사 |
| visitedAt | string(datetime) | Y | 방문 시각 |
| createdAt | string(datetime) | Y | UTC |
| updatedAt | string(datetime) | Y | UTC |

## 인덱스 권장
- Place: (userId, name), (userId, savedAt desc)
- Schedule: (userId, scheduledAt), (userId, visitStatus)
- VisitNote: (userId, visitedAt), (scheduleId)

## 동기화 필드
오프라인 동기화를 위해 아래 필드를 로컬 전용으로 둘 수 있다.
- localOnly: boolean
- syncStatus: enum(pending,synced,failed)
- lastSyncAt: string(datetime)

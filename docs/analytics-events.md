# Analytics Events (v1)

핵심 사용자 행동 측정을 위한 이벤트 정의 문서입니다.

## 공통 필드
모든 이벤트에 공통 포함:
- `eventName`
- `occurredAt` (ISO-8601)
- `userId` (로그인 전이면 null)
- `platform` (`ios` | `android`)
- `appVersion`

## 1) place_saved
발생 조건: 장소 저장 성공 시

필드:
<<<<<<< ours
<<<<<<< ours
- `provider` (`naver` | `kakao` | `google`)
=======
- `provider` (`naver` | `kakao` | `google` | `manual`)
>>>>>>> theirs
=======
- `provider` (`naver` | `kakao` | `google` | `manual`)
>>>>>>> theirs
- `source` (`search` | `discover`)
- `hasCoordinates` (boolean)

## 2) schedule_created
발생 조건: 일정 생성 성공 시

필드:
- `hasPlaceLinked` (boolean)
- `scheduledDate` (`YYYY-MM-DD`)
- `source` (`calendar` | `place_detail`)

## 3) visit_completed
발생 조건: 방문 완료 체크 + 저장 성공 시

필드:
- `hasMemo` (boolean)
- `hasRating` (boolean)
- `revisit` (boolean)

## 운영 규칙
- 이벤트 전송 실패 시 로컬 큐에 저장 후 재전송
- 개인정보(이메일/전화번호/상세 주소)는 이벤트에 넣지 않음

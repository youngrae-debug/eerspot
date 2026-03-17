# Auth & Security Policy (v1)

## 1) Password Policy
- 최소 8자
- 영문 + 숫자 + 특수문자 중 2종 이상 권장
- 너무 단순한 패턴(12345678 등) 차단

## 2) Token Lifecycle
- Access Token: 15분
- Refresh Token: 14일
- Refresh Token Rotation 적용
  - refresh 호출 시 기존 토큰 폐기 후 새 토큰 발급
<<<<<<< ours
<<<<<<< ours
  - API 계약 기준: `POST /auth/refresh`

## 3) Session / Device
- v1은 현재 기기 세션 유지에 집중
=======

## 3) Session / Device
- 기기별 세션 관리(선택)
>>>>>>> theirs
=======

## 3) Session / Device
- 기기별 세션 관리(선택)
>>>>>>> theirs
- 로그아웃 시 현재 refresh token 폐기
- 전체 로그아웃(모든 기기) API는 v1.1 후보

## 4) Login Protection
- 로그인 실패 5회 초과 시 지연/잠금 정책 적용
- 의심 트래픽(IP/UA) rate limit 강화

## 5) Transport / Storage
- HTTPS 강제
<<<<<<< ours
<<<<<<< ours
- refresh token 등 장기 민감 토큰은 OS secure storage(Keychain / Keystore-backed)에 저장
- access token은 메모리 우선, 영속 저장이 필요하면 동일한 secure storage를 사용
- `MMKV`는 비민감 설정/캐시 용도로만 사용
=======
- 모바일 클라이언트 토큰 저장은 `MMKV` + 민감정보 최소화
>>>>>>> theirs
=======
- 모바일 클라이언트 토큰 저장은 `MMKV` + 민감정보 최소화
>>>>>>> theirs
- 서버는 비밀번호를 hash(Argon2/bcrypt)로만 저장

## 6) Account Lifecycle
- 탈퇴 시 soft delete 후 유예 기간(예: 30일) 운영 여부 결정
- 개인정보 파기 기준/시점을 운영정책에 명시
<<<<<<< ours
<<<<<<< ours
- 비밀번호 찾기 / 회원탈퇴 API는 v1.1 후보
=======
>>>>>>> theirs
=======
>>>>>>> theirs

## 7) Security Event Logging
다음 이벤트를 보안 로그로 기록:
- signup_success / signup_failed
- login_success / login_failed
- token_refreshed / refresh_failed
- logout

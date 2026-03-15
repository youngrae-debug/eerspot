# Release & Environment Guide

## 1) Environments
- `dev`: 개발용 API/키
- `staging`: QA/사전 검증
- `prod`: 운영

## 2) Environment Variables
예시:
- `API_BASE_URL`
- `MAP_PROVIDER`
- `NAVER_MAP_KEY` / `KAKAO_MAP_KEY` / `GOOGLE_MAPS_KEY`
- `ANALYTICS_WRITE_KEY`

## 3) Secret Management
- 시크릿은 저장소 커밋 금지
- CI Secret 또는 안전한 비밀 저장소 사용
- 키 로테이션 주기(예: 90일) 정의

## 4) Release Flow (초안)
1. feature branch 개발
2. staging 배포 + QA 체크
3. release tag 생성
4. prod 배포
5. 모니터링/롤백 확인

## 5) Rollback Policy
- 배포 후 치명 오류 시 이전 안정 버전으로 즉시 롤백
- DB 마이그레이션은 backward-compatible 우선

## 6) Minimum Release Checklist
- [ ] 주요 플로우 수동 테스트 완료
- [ ] 크래시/로그 경고 확인
- [ ] API 버전 호환성 확인
- [ ] .env/키 누락 여부 확인

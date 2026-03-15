# eerspot MVP Spec (v1)

## 목적
v1에서 반드시 제공해야 할 사용자 가치(장소 저장 → 일정 연결 → 방문 기록)를 빠르게 검증한다.

## 범위

### In Scope
1. 계정
   - 회원가입, 로그인, 로그아웃
2. 장소
   - 장소 검색, 장소 저장, 장소 상세 조회
3. 일정
   - 일정 생성/조회/수정/삭제
   - 일정과 장소 연결
4. 방문
   - 방문 완료 체크
   - 간단 메모 기록

### Out of Scope (v1.1+)
- Instagram 자동 추출 고도화
- 다중 지도 provider 동시 지원
- 고급 추천/리포트

## 화면 목록
1. Auth
   - LoginScreen
   - SignUpScreen
2. Main Tabs
   - CalendarScreen
   - PlacesScreen
   - DiscoverScreen(placeholder)
3. Detail / Form
   - ScheduleEditorScreen
   - PlaceSearchScreen
   - PlaceDetailScreen
   - VisitNoteScreen

## 기능별 완료 정의 (Definition of Done)

### A. 회원가입/로그인
- [ ] 이메일/비밀번호 유효성 검증
- [ ] 로그인 성공 시 메인 탭 진입
- [ ] 로그인 실패 시 에러 메시지 노출

### B. 장소 검색/저장
- [ ] 키워드 검색 결과 노출
- [ ] 장소 1건 저장 가능
- [ ] 저장 목록(Places)에서 즉시 확인 가능
- [ ] 중복 저장 방지(동일 provider+placeId)

### C. 일정 CRUD
- [ ] 일정 생성(제목, 날짜/시간 필수)
- [ ] 일정 수정/삭제 가능
- [ ] 날짜별 목록 조회 가능

### D. 일정-장소 연결
- [ ] 일정 생성/수정 시 저장된 장소 연결 가능
- [ ] 일정 상세에서 연결 장소 확인 가능

### E. 방문 기록
- [ ] 일정에 대해 방문 완료 체크 가능
- [ ] 방문 메모 1개 저장 가능

## 비기능 요구사항
- 앱 실행 후 주요 화면 진입 2초 이내(일반 네트워크)
- 치명적 크래시 없는 상태로 핵심 플로우 수행
- API 실패 시 재시도 또는 사용자 안내 제공

## 핵심 지표
- schedule_created
- place_saved
- visit_completed

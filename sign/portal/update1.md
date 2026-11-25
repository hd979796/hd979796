# 업무포탈 백엔드 수정 지시문 (Claude용) — 비밀번호 변경 + 코드 갱신

지금 연결된 크롬(구글 로그인된 것)에서 작업한다. 아이디·비밀번호는 절대 입력하지 않는다.

1. 새 탭에서 https://hd979796.github.io/hd979796/portal/Code.gs.txt 를 열고 본문 클릭 → Ctrl+A, Ctrl+C.
2. 새 탭에서 https://docs.google.com/spreadsheets/d/1lab_bOLUQ02S1SlXG_wIWMoejj0wnbLyNl89U1qrv-w/edit 을 열고 메뉴 확장 프로그램 > Apps Script.
3. 편집기에서 Code.gs 본문 클릭 → Ctrl+A → Ctrl+V → Ctrl+S. 맨 위 주석에 "박문철보험대리점 업무포탈 — 백엔드"가 보이고 `function auth` 안에 `auth_fails` 가 있으면 제대로 들어간 것.
4. 왼쪽 톱니(프로젝트 설정) > 스크립트 속성 > PASSCODE 값을 대표님이 알려준 새 비밀번호로 바꾸고 "스크립트 속성 저장".
5. 오른쪽 위 배포 > 배포 관리 > 연필(수정) > 버전: "새 버전" > 배포. (주소는 그대로 유지된다. 새 배포를 만들지 말 것.)
6. 확인: 새 탭에서 `https://script.google.com/macros/s/AKfycbyATdbsyJxqsp2X_wlQO5L5TvyYsTqF9RCIU26u6R_OBdTXWbXfuCe42NzoTJICpI5_/exec?action=list&col=cases&key=새비밀번호` 에 명단 10건이 나오면 성공.
7. https://hd979796.github.io/hd979796/portal/ 에서 로그아웃 후 새 비밀번호로 들어가지는지 확인하고, 결과를 알려 줘.

# 업무포탈 이전 (2026-11-09) — GitHub 대신 Apps Script가 화면까지 제공

GitHub 계정 정지로 hd979796.github.io 주소가 막혔다. 이미 쓰고 있는 백엔드(Apps Script 웹앱)가 주소만 열면 포탈 화면을 보여주도록 바꾼다.
설치 후 포탈 주소 = 백엔드 주소: https://script.google.com/macros/s/AKfycbyATdbsyJxqsp2X_wlQO5L5TvyYsTqF9RCIU26u6R_OBdTXWbXfuCe42NzoTJICpI5_/exec

## 설치 (Claude용 지시문 — 사무실 크롬, 구글 로그인된 상태. 아이디·비밀번호 입력 금지)
1. 구글 드라이브 「업무포탈_AppsScript」 폴더에서 `Code.gs.txt`, `portal.html` 두 파일을 연다(미리보기에서 Ctrl+A, Ctrl+C로 복사).
2. https://docs.google.com/spreadsheets/d/1lab_bOLUQ02S1SlXG_wIWMoejj0wnbLyNl89U1qrv-w/edit → 확장 프로그램 > Apps Script.
3. Code.gs: 본문 클릭 → Ctrl+A → `Code.gs.txt` 내용 Ctrl+V. doGet 안에 `createHtmlOutputFromFile("portal")` 이 보이면 정상.
4. 왼쪽 「파일」 옆 + → HTML → 이름 `portal` (확장자 없이). 기본 내용을 Ctrl+A로 지우고 `portal.html` 내용 Ctrl+V. 맨 위가 `<!doctype html>`.
5. Ctrl+S 저장 → 배포 > 배포 관리 > 연필 > 버전 「새 버전」 > 배포. (새 배포를 만들지 않는다. 주소 유지.)
6. 확인: 위 주소를 새 탭에서 열면 로그인 화면(가족사진)이 나오고, 비밀번호로 들어가 「연결됨」이 보이면 성공. `…/exec?action=ping` 도 그대로 {"ok":true} 여야 한다.
7. 휴대폰: 그 주소를 열고 공유 > 홈 화면에 추가.

## 참고
- 데이터·비밀번호·통화 자동 정리 작업은 그대로. 백엔드 주소가 같아 다른 작업 수정 불필요.
- 화면 위에 「이 애플리케이션은 Google Apps Script 사용자가 만들었습니다」 띠가 보이는 것은 정상.
- 동의서 서명은 claude.ai 페이지(https://claude.ai/artifact/RNyXhZptTUuRaCK9j73L8t)로 연결했다.

## 개편 7 (2026-11-09) — 역할별 메뉴 정리, 보험 폴더
- 대표 메뉴: 통화·할 일 · 고객 · 보상·청구 · 보험상담 · 멘트 (나머지 삭제). 접속하면 통화·할 일부터.
- 실장 메뉴: 현황 · 보험 · 발송 · 고객 · 요청함 · 카드결제. 장기는 실장 업무로 이동.
- 보험: 자동차·일반·장기를 폴더처럼 겹쳐 둔 화면. 연 폴더는 가운데, 나머지는 왼쪽에 접혀 쌓임(맥 스테이지 매니저처럼). 접힌 폴더를 누르면 그 폴더가 열림. 휴대폰에서는 접힌 폴더가 위쪽에 가로로.

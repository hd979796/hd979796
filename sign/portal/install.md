# 업무포탈 백엔드 설치 지시문 (Claude용)

업무포탈 백엔드(Google Apps Script 웹앱)를 내 대신 설치해 줘. 지금 연결된 크롬(구글 로그인된 것)에서 작업하고, 아이디·비밀번호는 절대 입력하지 마. 순서:

1. 새 탭에서 https://hd979796.github.io/hd979796/portal/Code.gs.txt 를 열고 본문을 클릭한 뒤 Ctrl+A, Ctrl+C로 전체 복사.
2. 새 탭에서 https://docs.google.com/spreadsheets/d/1lab_bOLUQ02S1SlXG_wIWMoejj0wnbLyNl89U1qrv-w/edit ("업무포탈 데이터" 시트)를 열고 메뉴 확장 프로그램 > Apps Script.
3. 편집기 본문 클릭 → Ctrl+A → Ctrl+V. 맨 위가 `/**`로 시작하고 "박문철보험대리점 업무포탈 — 백엔드" 문구가 보이는지, 맨 아래가 importSeed 함수인지 확인. 깨졌으면 Ctrl+A 후 다시 붙여넣기. Ctrl+S 저장. 프로젝트 이름을 "업무포탈 백엔드"로.
4. 왼쪽 톱니(프로젝트 설정) > 스크립트 속성 > 속성 추가: PASSCODE = (대표님이 알려준 비밀번호) → 저장.
5. 배포 > 새 배포 > 유형 선택 톱니 > 웹 앱. 설명 "업무포탈", 실행: 나, 액세스: 모든 사용자 → 배포. "액세스 승인" → 내 계정 선택 → "고급" → "업무포탈 백엔드(으)로 이동" → 허용.
6. 표시되는 웹 앱 URL(https://script.google.com/macros/s/.../exec)을 읽어 둬. 완료.
7. 확인: 새 탭에서 `웹앱URL?action=ping` 이 {"ok":true,...}인지, `웹앱URL?action=list&col=cases&key=(비밀번호)` 에 명단 10건이 나오는지.
8. https://hd979796.github.io/hd979796/portal/ 을 열어 웹 앱 URL과 대표님이 알려준 비밀번호 으로 로그인해서 "연결됨"이 보이는지 확인.
9. ArtifactData 도구로 https://claude.ai/artifact/FXBnNUcxg5rmiQcQkVRT1M 의 settings 컬렉션 backend 문서에 {"url":"웹앱URL","installedAt":"지금 시각","ping":true} 를 set 하고, 나에게 웹 앱 URL을 알려 줘.

시트의 데이터 탭은 수정·삭제하지 말고, 막히면 어디서 막혔는지만 말해 줘.

# 여보어디가TV 제작실 — Apps Script판 (2026-11-12)

claude.ai에서 쓰던 「여보어디가TV 제작실」(제작 라인 · 팀과 맡은 일 · 촬영장 조감독)을 업무포탈과 같은 Apps Script 웹앱으로 옮겼다.

- 화면: `sign/portal/studio.html` (원본이자 Apps Script에 올릴 파일)
  - GitHub: https://hd979796.github.io/hd979796/portal/studio.html
  - Apps Script: `…/exec?page=studio`
- 데이터: 업무포탈 데이터 시트의 탭 4개 `studio_team` `studio_eps` `studio_tasks` `studio_shots` (처음 저장할 때 자동 생성)
- 들어가는 곳: 업무포탈 > 「박문철 대표 업무」 > 맨 끝 **🎬 제작실**. 포탈에 로그인돼 있으면 비밀번호를 다시 묻지 않는다. 제작실 왼쪽 위 「← 업무포탈」로 돌아온다.

## claude.ai판과 달라진 점
- 저장: 누르면 화면에 바로 반영하고 서버에는 뒤에서 순서대로 보낸다. 촬영지에서 신호가 끊겨도 기기에 두었다가 연결되면 저장한다(위쪽에 「n건은 연결되면 저장됩니다」).
- 다른 기기에서 바꾼 내용은 20초마다 불러온다(claude.ai판은 즉시).
- 스태프 목소리: Claude 음성 대신 휴대폰 기기 음성(한국어).
- Claude 제작팀이 결과물을 직접 써 넣을 수 없다. Claude가 만든 JSON 파일을 제작실 맨 아래 「제작 데이터 가져오기」로 넣는다(같은 id는 덮어쓰고 없는 것은 추가).
- 휴대폰에서 제작 라인이 화면 전체를 넓히던 문제를 고쳤다(그 칸만 옆으로 밀림).

## 설치 (Claude용 지시문 — 사무실 크롬, 구글 로그인된 상태. 아이디·비밀번호 입력 금지)
업무포탈 데이터 시트 > 확장 프로그램 > Apps Script.

### 1. Code.gs 네 군데 고치기
**통째로 바꾸지 않는다.** 배포된 Code.gs에는 저장소의 `Code.gs.txt`에 없는 내용(사용 기록 `log` 등)이 있을 수 있다. 아래 네 곳만 고친다.

1. `var JSON_FIELDS =` 줄 바로 위에 한 줄 추가
   ```
   var STUDIO_COLS = ["studio_team", "studio_eps", "studio_tasks", "studio_shots"];
   ```
2. doGet 안 `var PAGES = { … game: "우당탕탕 요절복통" };` 를
   ```
   var PAGES = { portal: "박문철보험대리점 업무포탈", sign: "동의서 서명", game: "우당탕탕 요절복통", studio: "여보어디가TV 제작실" };
   ```
3. doGet 안 `if (p.action === "all") {` 바로 위에 추가
   ```
   if (p.action === "studio") {
     var st = {};
     STUDIO_COLS.forEach(function (c) { st[c] = readAll(c); });
     return out({ ok: true, data: st, time: new Date().toISOString() });
   }
   ```
4. `function sheet(col)` 첫 줄의 `if (COLS.indexOf(col) < 0) throw` 를
   ```
   if (COLS.indexOf(col) < 0 && STUDIO_COLS.indexOf(col) < 0) throw
   ```

### 2. 화면 파일 (Apps Script 주소로도 열려면. GitHub 주소만 쓰면 생략 가능)
왼쪽 「파일」 옆 + → HTML → 이름 `studio` → 내용을 지우고 `studio.html` 전체를 붙여넣기.

### 3. 배포
Ctrl+S → 배포 > 배포 관리 > 연필 > 버전 「새 버전」 > 배포. (새 배포 금지: 주소가 바뀜)

### 4. 확인
- `…/exec?action=ping` 이 그대로 `{"ok":true…}`.
- 업무포탈 > 대표 업무 > 🎬 제작실 → 「제작 데이터가 비어 있습니다 · 처음 데이터 넣기」가 보이면 정상.
- 「백엔드가 아직 제작실을 모릅니다」가 보이면 1번·3번이 안 된 것.

### 5. 처음 데이터 넣기
받은 `제작실_데이터.json`(2026-11-12 claude.ai판에서 꺼낸 팀 9 · 에피소드 5 · 업무 27 · 촬영 컷 13)을 「제작 데이터 가져오기」에서 고르고 「가져오기」.
이 파일은 저장소에 올리지 않는다(공개 저장소).

## 화면을 고칠 때
`sign/portal/studio.html`을 직접 고친다. 스크립트 안에 `//`를 쓰지 않는다(주석은 `/* */`, 주소는 `https:\/\/`). Apps Script가 `//` 뒤를 잘라 화면이 멈춘다. `python3 scripts/build_portal.py`가 검사한다.

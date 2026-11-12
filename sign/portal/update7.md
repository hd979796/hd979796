# 여보어디가TV 촬영장 — Apps Script판 (2026-11-12)

「여보어디가TV 제작실」을 둘로 나눴다.

| | claude.ai 제작실 | Apps Script 촬영장 |
|---|---|---|
| 용도 | 기획·편집 회의, 결과물 주고받기, 업로드 일정 | 촬영 당일 컷별 진행·체크 (슬레이트 · 카운트 · 컷) |
| 여는 곳 | claude.ai | 업무포탈 > 「박문철 대표 업무」 > 맨 끝 **🎬 촬영장** |

- 화면: `sign/portal/studio.html` (원본이자 Apps Script에 올릴 파일)
  - GitHub: https://hd979796.github.io/hd979796/portal/studio.html
  - Apps Script: `…/exec?page=studio`
- 데이터: 업무포탈 데이터 시트의 탭 2개 `studio_eps`(에피소드 이름) `studio_shots`(촬영 컷). 처음 저장할 때 자동 생성.
- 포탈에 로그인돼 있으면 비밀번호를 다시 묻지 않는다. 왼쪽 위 「← 업무포탈」로 돌아온다.

## 둘 사이를 오가는 것
1. **촬영 전** — Claude 제작팀이 만든 촬영지시서 파일(JSON)을 촬영장 맨 아래 「촬영지시서 가져오기」로 넣는다. 에피소드당 한 번. 다시 넣어도 찍은 기록(완료·테이크 수)은 남고 내용만 바뀐다.
2. **촬영 후** — 촬영장 아래 「촬영 결과 복사」를 눌러 Claude 제작실 대화에 붙여넣고, 제작실에서 촬영 업무를 완료로 바꾼다. 못 찍은 컷이 편집 제안에 반영된다.

촬영지시서 파일 모양:
```
{"episodes":[{"id":"e02","code":"E02","title":"첫 차박","upload":"2026-12-04"}],
 "shots":[{"id":"e02-01","ep":"e02","n":1,"must":true,"title":"…","frame":"car","cam":"oz","who":"…","line":"…","pd":"…","dp":"…","ready":["…"],"beats":["…"],"min":20,"max":60}]}
```
frame: wide · medium · close · car · walk · hand / cam: oz · gp · both · phone

## 촬영장의 저장 방식
- 누르면 화면에 바로 반영하고 서버에는 뒤에서 순서대로 보낸다. 신호가 끊기면 기기에 두었다가 연결되면 저장한다(위쪽에 「n건은 연결되면 저장됩니다」).
- 다른 기기에서 바꾼 내용은 20초마다 불러온다.
- 스태프 목소리는 휴대폰 기기 음성(한국어).

## 설치 (Claude용 지시문 — 사무실 크롬, 구글 로그인된 상태. 아이디·비밀번호 입력 금지)
업무포탈 데이터 시트 > 확장 프로그램 > Apps Script.

### 1. Code.gs 네 군데 고치기
**통째로 바꾸지 않는다.** 배포된 Code.gs에는 저장소의 `Code.gs.txt`에 없는 내용(사용 기록 `log` 등)이 있을 수 있다. 아래 네 곳만 고친다.

1. `var JSON_FIELDS =` 줄 바로 위에 한 줄 추가
   ```
   var STUDIO_COLS = ["studio_eps", "studio_shots"];
   ```
2. doGet 안 `var PAGES = { … game: "우당탕탕 요절복통" };` 를
   ```
   var PAGES = { portal: "박문철보험대리점 업무포탈", sign: "동의서 서명", game: "우당탕탕 요절복통", studio: "여보어디가TV 촬영장" };
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
- 업무포탈 > 대표 업무 > 🎬 촬영장 → 「촬영지시서가 없습니다 · 처음 넣기」가 보이면 정상.
- 「백엔드가 아직 촬영장을 모릅니다」가 보이면 1번·3번이 안 된 것.

### 5. 첫 촬영지시서 넣기
받은 `촬영지시서_E01.json`(E01 출고기 13컷, 2026-11-12 claude.ai 제작실에서 꺼냄)을 「촬영지시서 가져오기」에서 고르고 「가져오기」.
촬영지시서 파일은 저장소에 올리지 않는다(공개 저장소).

## 화면을 고칠 때
`sign/portal/studio.html`을 직접 고친다. 스크립트 안에 `//`를 쓰지 않는다(주석은 `/* */`, 주소는 `https:\/\/`). Apps Script가 `//` 뒤를 잘라 화면이 멈춘다. `python3 scripts/build_portal.py`가 검사한다.

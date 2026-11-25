# 업무포탈 개편 4 (2026-11-08) — 대표/실장 업무 전환, 보상·청구 단순화, 보험상담

## 바뀐 것
- 오른쪽 위 **「박문철 대표 업무」 / 「황혜정 실장 업무」** 버튼. 누르면 색이 들어오고 살짝 커지며(눌림 표시), 상단 탭과 현황이 그 사람 업무 중심으로 바뀝니다. 선택은 이 브라우저에 기억됩니다.
  - 대표: 현황 · 장기 · 보상·청구 · 보험상담 · 고객 · 통화·할 일 (나머지는 작게)
  - 실장: 현황 · 자동차 · 일반 · 발송 · 고객 · 요청함 · 카드결제 (나머지는 작게)
- 현황 맨 위 「○○ 업무」 띠: 실장 = 자동차 갱신설계·안내 / 일반 갱신설계·안내 / 증권출력 / 송장출력 / 우편발송 / 카드결제 / 요청함. 대표 = 장기 진행 중 / 장기 신규 상담 / 만기 지남·미갱신 상담 / 보상·청구 기록 / 할 일 / 요청함. 숫자를 누르면 그 명단으로 갑니다. 줄 카드는 「내 업무」가 먼저, 상대 업무는 아래에 참고로.
- **보상·청구**: 보험청구방·배상책임 사고접수방 링크, 고객 링크 복사, 청구 요청 올리기를 없앴습니다. 대신 **「사고접수」 버튼 하나**(배상책임·상해질병 통합 링크)와 보험금 검산방·동의서 서명·하이포탈만 둡니다.
- **보상청구 기록**(접수 완료 고객 확인용): 사고접수 화면에서 배상책임 접수 메일을 보내거나 상해·질병 청구 PDF를 만들면 자동으로 한 줄 남습니다(아래 연결 설치 필요). 고객명 검색·구분 필터, 「기록 직접 추가」.
- **보험공부방 → 보험상담**: 보험 공부방(약관 질문)·AI 사무실·갱신설계 매뉴얼·하이포탈 바로가기, 상담 정보 검색(검색어 강조, 분류 칩), 「정보 메모」(예: 대장용종 제거 — 퍼펙트플러스 종합보험 수술비 최대 200만원).

## 자동 기록 연결 설치 (Claude용 지시문 — 사무실 크롬에서)
사고접수 Apps Script 프로젝트를 열어 아래를 한 번 넣는다. 아이디·비밀번호는 입력하지 않는다.
1. https://script.google.com/home/projects/1simIeFD2mRXzcL8_OFeLVW6nUZ0q51unnBh-9-FnQP-UIFHaew-ROQrG/edit 를 연다.
2. 왼쪽 톱니(프로젝트 설정) > 스크립트 속성 > 속성 `PORTAL_KEY`, 값 = 업무포탈 비밀번호(대표님이 알려준 것) 저장.
3. Code.gs 맨 아래에 다음 함수를 붙여넣는다.
```js
/* 업무포탈 보상청구 기록 — 접수 메일 발송·청구 PDF 생성 뒤 한 줄 남긴다 (이름만 보내고 주민번호·계좌는 보내지 않는다) */
var PORTAL_URL = "https://script.google.com/macros/s/AKfycbyATdbsyJxqsp2X_wlQO5L5TvyYsTqF9RCIU26u6R_OBdTXWbXfuCe42NzoTJICpI5_/exec";
function logToPortal(kind, name, detail) {
  var key = PropertiesService.getScriptProperties().getProperty("PORTAL_KEY"); if (!key || !name) return;
  var now = new Date();
  try {
    UrlFetchApp.fetch(PORTAL_URL, { method: "post", contentType: "text/plain;charset=utf-8", muteHttpExceptions: true, followRedirects: true,
      payload: JSON.stringify({ key: key, action: "set", col: "requests", id: "cl" + now.getTime(), data: {
        kind: kind, name: String(name).slice(0, 20), detail: String(detail || "").slice(0, 120), at: Utilities.formatDate(now, "Asia/Seoul", "yyyy-MM-dd"),
        status: "done", from: "사고접수", createdAt: now.toISOString(), doneAt: now.toISOString(), result: "" } }) });
  } catch (e) {}
}
```
4. 호출 두 곳을 넣는다.
   - 배상책임 사고통보서 접수 메일을 보내는 코드(MailApp/GmailApp .send… 직후): `logToPortal("배상책임접수", 고객명변수, "현대해상 배상 · 사고일 " + 사고일변수 + " · 메일 발송");`
   - 상해·질병 청구서 PDF를 만드는 코드(PDF blob 생성/메일 첨부 직후): `logToPortal("상해질병접수", 고객명변수, 보험사명변수 + " · 사고일 " + 사고일변수 + " · 청구서 PDF");`
   변수 이름은 그 스크립트의 실제 변수에 맞춘다(고객명·보험사·사고일만, 주민번호·계좌는 절대 넣지 않는다).
5. 저장 > 배포 > 배포 관리 > 연필 > 버전 「새 버전」 > 배포. (주소는 그대로 둔다. 새 배포를 만들지 말 것.)
6. 확인: 업무포탈 보상·청구 탭에 테스트 접수가 한 줄 나타나면 성공. 테스트 줄은 「삭제」로 지운다.

## 데이터
- `requests`에 kind `배상책임접수` / `상해질병접수`, status done, from "사고접수", at(접수일). 포탈 백엔드 변경 없음.

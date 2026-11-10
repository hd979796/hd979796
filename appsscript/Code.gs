/**
 * 박문철보험대리점 · 개인정보처리 동의서 서명 (Apps Script 웹앱)
 * 배포: 배포 > 새 배포 > 웹 앱 > 실행: 나 / 액세스: 모든 사용자
 */
const FOLDER_NAME = '개인정보동의서';        // 서명 PDF가 저장될 드라이브 폴더 (없으면 자동 생성)
const SHEET_NAME  = '개인정보동의서 기록';    // 기록 스프레드시트 (없으면 자동 생성, 같은 폴더)
const FAX_EMAIL   = '';                       // 이메일→팩스 서비스 주소가 있으면 입력 (예: 05077746622@faxservice.co.kr). 비우면 팩스 자동발송 안 함
const PIN         = '';                       // 간단한 사용 비밀번호. 비우면 묻지 않음

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('동의서 서명')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** 설정값을 화면에 알려줌 */
function getConfig() {
  return { needPin: !!PIN, faxAuto: !!FAX_EMAIL, owner: Session.getEffectiveUser().getEmail() };
}

/**
 * 서명된 PDF 저장: 드라이브 저장 + 시트 기록 + 메일 발송(+ 설정 시 팩스 메일)
 * p = { b64, name, cust, fax, pages, pin }
 */
function saveSigned(p) {
  if (PIN && String(p.pin || '') !== PIN) throw new Error('비밀번호가 맞지 않습니다');
  if (!p || !p.b64) throw new Error('PDF 데이터가 없습니다');
  const name = String(p.name || '개인정보동의서.pdf').replace(/[\\/:*?"<>|]/g, '');
  const blob = Utilities.newBlob(Utilities.base64Decode(p.b64), 'application/pdf', name);

  const folder = getFolder_();
  const file = folder.createFile(blob);

  const sheet = getSheet_(folder);
  const owner = Session.getEffectiveUser().getEmail();
  let faxSent = false, faxError = '';
  if (FAX_EMAIL) {
    try {
      MailApp.sendEmail({ to: FAX_EMAIL, subject: String(p.fax || ''), body: '개인정보처리 동의서 ' + (p.cust || ''), attachments: [blob] });
      faxSent = true;
    } catch (e) { faxError = String(e && e.message || e); }
  }
  try {
    MailApp.sendEmail({
      to: owner,
      subject: '[동의서 서명] ' + (p.cust || '고객') + ' · ' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'M/d HH:mm'),
      htmlBody: '서명된 개인정보처리 동의서가 첨부되어 있습니다.<br>수신 팩스: <b>' + (p.fax || '-') + '</b><br>드라이브: <a href="' + file.getUrl() + '">' + file.getName() + '</a>'
        + (faxSent ? '<br>팩스 메일 발송 완료 (' + FAX_EMAIL + ')' : ''),
      attachments: [blob]
    });
  } catch (e) { /* 메일 실패해도 저장은 유지 */ }

  sheet.appendRow([new Date(), p.cust || '', p.fax || '', file.getName(), file.getUrl(), p.pages || '', faxSent ? '팩스메일 발송' : (FAX_EMAIL ? '팩스메일 실패: ' + faxError : '모바일팩스로 직접 발송'), owner]);

  return {
    id: file.getId(),
    url: file.getUrl(),
    download: 'https://drive.google.com/uc?export=download&id=' + file.getId(),
    name: file.getName(),
    faxSent: faxSent,
    mailedTo: owner
  };
}

function getFolder_() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

function getSheet_(folder) {
  const it = folder.getFilesByName(SHEET_NAME);
  let ss;
  if (it.hasNext()) ss = SpreadsheetApp.open(it.next());
  else {
    ss = SpreadsheetApp.create(SHEET_NAME);
    const f = DriveApp.getFileById(ss.getId());
    folder.addFile(f); DriveApp.getRootFolder().removeFile(f);
    ss.getActiveSheet().appendRow(['일시', '동의자', '수신 팩스', '파일명', '드라이브 링크', '쪽수', '발송 상태', '처리자']);
  }
  return ss.getActiveSheet();
}

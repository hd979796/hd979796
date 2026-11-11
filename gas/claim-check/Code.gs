/**
 * 보험금 검산방 (Apps Script 판)
 * - 화면: Index.html (scripts/build_claim_check.py 로 Claude 검산방에서 만든다)
 * - 검산 저장: 내 드라이브 「보험금 검산방_저장」 시트 (처음 저장할 때 자동으로 만든다)
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('보험금 검산방')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function sheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHEET_ID');
  var ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create('보험금 검산방_저장');
    ss.getSheets()[0].appendRow(['id', '고객', '수정일', '예상 보험금', 'json']);
    props.setProperty('SHEET_ID', ss.getId());
  }
  return ss.getSheets()[0];
}

/** 최근 저장한 검산 50건 (최신순) */
function listCases() {
  var sh = sheet_();
  var n = sh.getLastRow() - 1;
  if (n < 1) return [];
  var rows = sh.getRange(2, 1, n, 5).getValues();
  var out = [];
  rows.forEach(function (r) { try { var o = JSON.parse(r[4]); o.id = String(r[0]); out.push(o); } catch (e) {} });
  out.sort(function (a, b) { return String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')); });
  return out.slice(0, 50);
}

/** 같은 id 가 있으면 고치고, 없으면 새 줄로 */
function saveCase(id, json) {
  var obj = JSON.parse(json);
  var sh = sheet_();
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var n = sh.getLastRow() - 1;
    var ids = n > 0 ? sh.getRange(2, 1, n, 1).getValues().map(function (r) { return String(r[0]); }) : [];
    var row = [id, obj.cust || '', obj.updatedAt || new Date().toISOString(), obj.total == null ? '' : obj.total, json];
    var i = ids.indexOf(String(id));
    if (i >= 0) sh.getRange(i + 2, 1, 1, 5).setValues([row]); else sh.appendRow(row);
  } finally { lock.releaseLock(); }
  return true;
}

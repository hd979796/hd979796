/* ===================== 구글 시트 연결 (앱스크립트 전용) ===================== */
/**
 * 관리자: 화면에 표시되지 않고 권한만 갖습니다 (직책 임명, 관리 권한 주기, 비밀번호 초기화, 탈퇴 처리).
 * 여기 적힌 이름은 가입하면 늘 관리자입니다. 다른 사람은 웹페이지 운영 메뉴에서 관리 권한을 줄 수 있습니다.
 * 회장·부회장·총무 같은 직책은 가입 후 관리자가 웹페이지에서 정합니다.
 */
var ADMINS = ['박문철'];

/* 탭 구성. members 탭은 명부로 바로 볼 수 있게 칸을 나눕니다. */
var TABS = {
  members: ['이름', '전화번호', '생년월일', '주소', '급수', '직책', '가입일', 'data'],
  days: ['id', 'data', '수정시각'],
  payments: ['id', '날짜', '이름', '금액', '상태', 'data'],
  notices: ['id', '제목', '작성자', '작성일', 'data'],
  settings: ['id', 'data']
};

function doGet(e) { return run((e && e.parameter && e.parameter.action) || 'ping', (e && e.parameter) || {}); }
function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return out({ ok: false, error: '요청 형식이 올바르지 않습니다' }); }
  return run(body.action, body);
}
function run(action, body) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var store = sheetStore();
    var env = {
      now: function () { return Date.now(); },
      uuid: function () { return Utilities.getUuid(); },
      hash: function (s) { return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)); },
      config: { admins: ADMINS }
    };
    var res = WDTT.handle(action, body, store, env);
    res.ok = true;
    return out(res);
  } catch (err) {
    return out({ ok: false, error: String((err && err.message) || err), code: err && err.code });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function sheetStore() {
  var book = null;
  try { book = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  if (!book) book = SpreadsheetApp.openById(SHEET_ID);
  var cache = {};
  function sheet(col) {
    if (!TABS[col]) throw new Error('없는 탭: ' + col);
    var sh = book.getSheetByName(col);
    if (!sh) {
      sh = book.insertSheet(col);
      sh.getRange(1, 1, sh.getMaxRows(), TABS[col].length).setNumberFormat('@');
      sh.getRange(1, 1, 1, TABS[col].length).setValues([TABS[col]]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    return sh;
  }
  function rows(col) {
    if (cache[col]) return cache[col];
    var sh = sheet(col), n = sh.getLastRow() - 1, w = TABS[col].length;
    var vals = n > 0 ? sh.getRange(2, 1, n, w).getValues() : [];
    var di = TABS[col].indexOf('data');
    cache[col] = vals.map(function (r, i) {
      var obj = null; try { obj = JSON.parse(r[di] || 'null'); } catch (e) {}
      return { row: i + 2, id: String(r[0]), obj: obj };
    }).filter(function (x) { return x.id && x.obj; });
    return cache[col];
  }
  function flat(col, id, o) {
    var t = function (s) { return s ? new Date(Date.parse(s) + 9 * 3600 * 1000).toISOString().slice(0, 10) : ''; };
    var data = JSON.stringify(o);
    if (col === 'members') return [o.name, o.phone, o.birth, o.addr || '', o.grade + '조', o.role, t(o.joinedAt), data];
    if (col === 'days') return [id, data, new Date().toISOString()];
    if (col === 'payments') return [id, o.date, o.name, o.amount || 0, ({ none: '미입금', claimed: '입금했어요', confirmed: '확인완료' })[o.status] || o.status, data];
    if (col === 'notices') return [id, o.title, o.author, t(o.at), data];
    return [id, data];
  }
  return {
    get: function (col, id) {
      var hit = rows(col).filter(function (x) { return x.id === String(id); })[0];
      return hit ? JSON.parse(JSON.stringify(hit.obj)) : null;
    },
    list: function (col) { return rows(col).map(function (x) { return JSON.parse(JSON.stringify(x.obj)); }); },
    put: function (col, id, obj) {
      var sh = sheet(col), list = rows(col), hit = list.filter(function (x) { return x.id === String(id); })[0];
      var vals = [flat(col, id, obj)];
      if (hit) { sh.getRange(hit.row, 1, 1, vals[0].length).setNumberFormat('@').setValues(vals); hit.obj = obj; }
      else {
        var r = sh.getLastRow() + 1;
        sh.getRange(r, 1, 1, vals[0].length).setNumberFormat('@').setValues(vals);
        list.push({ row: r, id: String(id), obj: obj });
      }
    },
    del: function (col, id) {
      var sh = sheet(col), hit = rows(col).filter(function (x) { return x.id === String(id); })[0];
      if (hit) { sh.deleteRow(hit.row); delete cache[col]; }
    }
  };
}

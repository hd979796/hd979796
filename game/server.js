/**
 * 우당탕탕 요절복통 — 서버 규칙
 * 구글 앱스크립트(Code.gs)와 화면의 체험 모드가 같은 코드를 씁니다.
 * store: get(col,id) / put(col,id,obj) / del(col,id) / list(col)
 * env:   now() 밀리초, uuid(), hash(문자열), config { admins: [관리 권한을 늘 갖는 이름] }
 * 직책(회장·부회장·총무)은 화면에 표시되고, 관리자는 표시 없이 권한만 있습니다.
 * 앱스크립트 호환을 위해 ?. 와 ?? 는 쓰지 않습니다.
 */
var WDTT = (function () {
  var GRADES = ['S', 'A', 'B', 'C', 'D'];
  var ROLES = ['회장', '부회장', '총무', '임원', '일반', '인턴']; // 회칙 제6조: 집행부 3인 + 임원진 4인, 제3조: 인턴
  var OFFICER = { '회장': 1, '부회장': 1, '총무': 1 }; // 집행부: 입금 확인·결석·급수·마감
  var ADMIN_NAMES = []; // 코드에 적힌 관리자 (handle에서 채움)
  /* 회칙 제12조 ④ 지각비: 06:10 이후 도착. 강북권·의정부 밖에서 05:30 전에 출발 알림 → 06:30, 픽업 → 06:15 */
  var LATE_BASE = 6 * 60 + 10, LATE_PICKUP = 6 * 60 + 15, LATE_FAR = 6 * 60 + 30;
  var NEAR_RE = /의정부|강북구|도봉구|노원구/; // 서울 강북권·의정부
  var GUEST_FEE = 3000, MAX_MEMBERS = 50, MAX_EXEC = 4;
  function isFar(m) { return !!(m && m.addr) && !NEAR_RE.test(m.addr); }
  function lateMinOf(m, a, date) {
    var t = LATE_BASE;
    if (a && a.pickup) t = LATE_PICKUP;
    if (isFar(m) && a && a.departStamp && a.departStamp < date + ' 05:30') t = LATE_FAR;
    return t;
  }
  function isWeekend(date) { var w = new Date(date + 'T00:00:00Z').getUTCDay(); return w === 0 || w === 6; }
  function prevDate(d) { return new Date(Date.parse(d + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10); }
  var STATUS = ['rsvp', 'present', 'late', 'absent'];

  function UserError(msg) { var e = new Error(msg); e.user = true; return e; }
  function fail(msg) { throw UserError(msg); }
  function kst(env) {
    var ms = env.now(), d = new Date(ms + 9 * 3600 * 1000);
    var iso = d.toISOString();
    return { date: iso.slice(0, 10), h: d.getUTCHours(), m: d.getUTCMinutes(), iso: new Date(ms).toISOString(), stamp: iso.slice(0, 10) + ' ' + iso.slice(11, 16) };
  }
  function roleOf(m) { return ROLES.indexOf(m.role) >= 0 ? m.role : '일반'; }
  function isAdmin(m) { return !!m.admin || ADMIN_NAMES.indexOf(m.name) >= 0; }
  function isOff(m) { return !!OFFICER[roleOf(m)] || isAdmin(m); }
  var HOSTS = ['방장', '부방장']; // 벌금 강제 입력·조정 권한 (회장·관리자가 지정)
  function isReferee(m) { return isOff(m) || HOSTS.indexOf(m.host) >= 0; }
  function canApprove(m) { return isOff(m) || roleOf(m) === '임원'; } // 게스트 승인: 집행부·임원진
  function canNotice(m) { return roleOf(m) === '회장' || isAdmin(m); } // 공지: 회장·관리자
  function pub(m, full) {
    var o = { name: m.name, grade: m.grade, role: roleOf(m), title: roleOf(m) === '임원' ? (m.title || '') : '', host: HOSTS.indexOf(m.host) >= 0 ? m.host : '', joinedAt: m.joinedAt, gradeHistory: m.gradeHistory || [] };
    if (full) { o.phone = m.phone; o.birth = m.birth; o.addr = m.addr || ''; }
    if (full === 'admin') { o.admin = isAdmin(m); o.adminFixed = ADMIN_NAMES.indexOf(m.name) >= 0; }
    return o;
  }
  function newDay(date) { return { date: date, att: {}, marks: [], leagues: [], rate: 'auto', closed: false, ver: 0 }; }
  function hashPw(env, salt, pw) { var h = salt + '|' + pw; for (var i = 0; i < 200; i++) h = env.hash(salt + h); return h; }
  function cleanName(s) { return String(s || '').replace(/\s+/g, '').slice(0, 12); }
  function checkDate(d) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d || ''))) fail('날짜가 올바르지 않습니다'); return d; }
  function paymentsOf(store, prefix) {
    return store.list('payments').filter(function (p) { return String(p.date || '').indexOf(prefix) === 0; });
  }
  function settingsOf(store) {
    var s = store.get('settings', 'main') || {};
    return {
      bank: s.bank || '카카오뱅크', number: s.number || '3333353355877', holder: s.holder || '지승욱',
      kakaopay: s.kakaopay || '', lateTime: '18:15'
    };
  }

  /* ---------- 가입 · 로그인 ---------- */
  function signup(b, store, env) {
    var name = cleanName(b.name), phone = String(b.phone || '').replace(/\D/g, ''), birth = String(b.birth || '');
    var addr = String(b.addr || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!/^[가-힣A-Za-z]{2,12}$/.test(name)) fail('이름은 한글 또는 영문 2~12자로 넣어 주세요');
    if (!/^01\d{8,9}$/.test(phone)) fail('전화번호를 확인해 주세요 (예: 01012345678)');
    if (!/^(19|20)\d{2}-\d{2}-\d{2}$/.test(birth)) fail('생년월일을 확인해 주세요 (예: 1985-03-12)');
    if (addr.length < 5) fail('주소를 넣어 주세요 (예: 서울 강남구 역삼동 123)');
    if (String(b.password || '').length < 4) fail('비밀번호는 4자 이상으로 정해 주세요');
    if (GRADES.indexOf(b.grade) < 0) fail('급수를 골라 주세요');
    if (!b.agree) fail('개인정보 수집에 동의해 주세요');
    if (store.get('members', name)) fail('이미 가입된 이름입니다. 로그인해 주세요');
    if (store.list('members').length >= MAX_MEMBERS) fail('회원 정원(' + MAX_MEMBERS + '명)이 찼습니다. 운영진에게 문의해 주세요');
    var t = kst(env), role = '일반'; // 직책은 가입 후 관리자가 정합니다
    var salt = env.uuid();
    var m = {
      name: name, phone: phone, birth: birth, addr: addr, grade: b.grade, role: role, joinedAt: t.iso, agreeAt: t.iso,
      salt: salt, pw: hashPw(env, salt, String(b.password)), token: env.uuid(),
      gradeHistory: [{ to: b.grade, at: t.iso, by: name, note: '가입' }]
    };
    store.put('members', name, m);
    return { token: m.token, me: pub(m, 'admin') };
  }
  function login(b, store, env) {
    var m = store.get('members', cleanName(b.name));
    if (!m || hashPw(env, m.salt, String(b.password || '')) !== m.pw) fail('이름 또는 비밀번호가 맞지 않습니다');
    if (!m.token) { m.token = env.uuid(); store.put('members', m.name, m); }
    return { token: m.token, me: pub(m, 'admin') };
  }
  function authed(b, store) {
    var m = b.me ? store.get('members', cleanName(b.me)) : null;
    if (!m || !b.token || m.token !== b.token) { var e = UserError('다시 로그인해 주세요'); e.code = 'auth'; throw e; }
    return m;
  }

  /* ---------- 조회 ---------- */
  function bootstrap(me, b, store, env) {
    var full = isAdmin(me) ? 'admin' : isOff(me);
    return {
      me: pub(me, 'admin'),
      members: store.list('members').map(function (m) { return pub(m, full); }),
      notices: store.list('notices').sort(function (a, c) { return (c.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(c.at).localeCompare(String(a.at)); }),
      settings: settingsOf(store),
      today: kst(env).date
    };
  }
  function month(me, b, store) {
    var mon = String(b.month || ''); if (!/^\d{4}-\d{2}$/.test(mon)) fail('달이 올바르지 않습니다');
    return {
      days: store.list('days').filter(function (d) { return String(d.date).indexOf(mon) === 0; }),
      payments: paymentsOf(store, mon)
    };
  }

  /* ---------- 하루 현황판 ---------- */
  function dayOp(me, b, store, env) {
    var t = kst(env), date = checkDate(b.date), off = isOff(me);
    var D = store.get('days', date) || newDay(date);
    var target = b.name ? cleanName(b.name) : me.name, self = target === me.name;
    var op = b.op, a = D.att[target];
    var guestOfMine = !!(a && a.guest && a.by === me.name);
    var cutoff = t.stamp >= date + ' 05:30'; // 회칙 제10조 ②: 취소는 당일 05:30 전까지
    if (!off) {
      if (D.closed) fail('마감된 날입니다. 운영진에게 말해 주세요');
      if (date < t.date) fail('지난 날짜는 운영진만 고칠 수 있어요');
      if (['join', 'leave', 'checkin', 'depart', 'pickup'].indexOf(op) >= 0 && !self && !guestOfMine) fail('본인 자석만 움직일 수 있어요');
      if (['setStatus', 'close', 'reopen', 'lateReg'].indexOf(op) >= 0) fail('집행부(회장·부회장·총무)만 할 수 있어요');
      if (op === 'approveGuest' && !canApprove(me)) fail('게스트 승인은 집행부·임원진만 할 수 있어요');
      if (['mark', 'checkin', 'depart'].indexOf(op) >= 0 && date !== t.date) fail('오늘 날짜에서만 할 수 있어요');
    }
    switch (op) {
      case 'join':
        if (!store.get('members', target)) fail('가입한 멤버가 아닙니다');
        if (!a) {
          // 회칙 제10조 ①: 전날 23:00 이후 등록은 벌금 1,000원
          D.att[target] = { status: 'rsvp', rsvpAt: t.iso, lateReg: t.stamp >= prevDate(date) + ' 23:00' };
        }
        break;
      case 'leave':
        if (!a) break;
        if (!off && cutoff) { a.status = 'absent'; a.cancelAt = t.iso; a.lateCancel = true; break; } // 05:30 이후 취소 = 불참 5,000원
        delete D.att[target];
        D.marks = D.marks.filter(function (x) { return x.name !== target; });
        break;
      case 'depart':
        if (!a) fail('먼저 자석을 붙여 주세요');
        a.departAt = t.iso; a.departStamp = t.stamp; break;
      case 'pickup':
        if (!a) fail('먼저 자석을 붙여 주세요');
        a.pickup = !!b.value; break;
      case 'checkin': {
        if (!a) fail('먼저 자석을 붙여 주세요');
        if (a.pending) fail('승인 전 게스트입니다');
        if (a.status === 'present' || a.status === 'late') break;
        a.arrivedAt = t.iso;
        var limit = lateMinOf(a.guest ? null : store.get('members', target), a, date);
        a.lateLimit = limit;
        a.status = (date === t.date && t.h * 60 + t.m >= limit) ? 'late' : 'present';
        break;
      }
      case 'addGuest': {
        // 회칙 제11조: 평일 10명 미만, 주말 15명 미만일 때만. 집행부·임원진 승인
        var g = cleanName(b.guest);
        if (!/^[가-힣A-Za-z0-9]{1,12}$/.test(g)) fail('게스트 이름을 넣어 주세요');
        if (store.get('members', g)) fail('멤버 이름과 같아요. 다른 이름(예: ' + g + '친구)으로 넣어 주세요');
        if (D.att[g]) fail('이미 현황판에 있는 이름이에요');
        var cnt = Object.keys(D.att).filter(function (k) { return D.att[k].status !== 'absent'; }).length, max = isWeekend(date) ? 15 : 10;
        if (!off && cnt >= max) fail('오늘 참석이 ' + cnt + '명이라 게스트를 부를 수 없어요 (' + (isWeekend(date) ? '주말 15명' : '평일 10명') + ' 미만일 때만)');
        D.att[g] = { status: 'rsvp', guest: true, fee: GUEST_FEE, by: me.name, rsvpAt: t.iso, pending: !canApprove(me) };
        if (!D.att[g].pending) { D.att[g].approvedBy = me.name; }
        break;
      }
      case 'approveGuest':
        if (!a || !a.guest) fail('게스트를 찾을 수 없습니다');
        a.pending = false; a.approvedBy = me.name; break;
      case 'lateReg':
        if (!a) fail('참석자가 아닙니다');
        a.lateReg = !!b.value; break;
      case 'setStatus':
        if (STATUS.indexOf(b.status) < 0) fail('상태가 올바르지 않습니다');
        if (!a) a = D.att[target] = { rsvpAt: t.iso };
        a.status = b.status; a.by = me.name; a.at = t.iso;
        break;
      case 'mark': {
        if (!isReferee(me) && !self && !guestOfMine) fail('다른 사람 패는 방장·부방장·집행부가 기록해요');
        if (!a || a.status === 'absent') fail('오늘 참석한 사람만 표시할 수 있어요');
        var rate = t.h >= 7 ? 3000 : 2000; // 회칙 제12조 ③: 07:00 전 2,000원, 07:00부터 3,000원
        var kind = b.kind === 'dbl' || b.kind === 'deuce' ? b.kind : 'lose';
        D.marks.push({ id: env.uuid(), name: target, base: rate, amount: rate + (kind === 'lose' ? 0 : 1000), dbl: kind === 'dbl', deuce: kind === 'deuce', at: t.iso, by: me.name });
        break;
      }
      case 'undoMark': {
        if (!isReferee(me) && !self && !guestOfMine) fail('다른 사람 기록은 방장·부방장·집행부가 고쳐요');
        for (var i = D.marks.length - 1; i >= 0; i--) if (D.marks[i].name === target && !D.marks[i].adj) { D.marks.splice(i, 1); break; }
        break;
      }
      case 'adjust': { // 방장·부방장·집행부: 벌금 강제 입력·면제 (물리기 등)
        if (!isReferee(me)) fail('벌금 조정은 방장·부방장·집행부만 할 수 있어요');
        if (!a) fail('현황판에 없는 사람입니다');
        var amt = Math.round(Number(b.amount) || 0);
        if (!amt || Math.abs(amt) > 100000) fail('금액을 확인해 주세요');
        var memo = String(b.memo || '').trim().slice(0, 40);
        if (!memo) fail('사유를 적어 주세요 (예: 물리기 면제)');
        D.marks.push({ id: env.uuid(), name: target, amount: amt, adj: true, memo: memo, at: t.iso, by: me.name });
        break;
      }
      case 'delMark': {
        var mk = D.marks.filter(function (x) { return x.id === b.id; })[0];
        if (!mk) fail('기록을 찾을 수 없습니다');
        if (!isReferee(me)) fail('기록 삭제는 방장·부방장·집행부만 할 수 있어요');
        D.marks = D.marks.filter(function (x) { return x.id !== b.id; });
        break;
      }
      case 'setRate':
        if (['auto', '2000', '3000'].indexOf(b.rate) < 0) fail('요금이 올바르지 않습니다');
        D.rate = b.rate; break;
      case 'leagueCreate': {
        var L = b.league || {};
        if (!L.players || L.players.length < 2 || !L.matches || !L.matches.length) fail('대진표가 비어 있습니다');
        L.id = env.uuid(); L.by = me.name; L.at = t.iso;
        D.leagues.push(L); break;
      }
      case 'leagueScore': {
        var lg = D.leagues.filter(function (x) { return x.id === b.lid; })[0]; if (!lg) fail('리그를 찾을 수 없습니다');
        var mt = lg.matches.filter(function (x) { return x.id === b.mid; })[0]; if (!mt) fail('경기를 찾을 수 없습니다');
        mt.sa = String(b.sa === undefined ? mt.sa : b.sa).replace(/\D/g, '').slice(0, 2);
        mt.sb = String(b.sb === undefined ? mt.sb : b.sb).replace(/\D/g, '').slice(0, 2);
        break;
      }
      case 'leagueDelete': {
        var l2 = D.leagues.filter(function (x) { return x.id === b.lid; })[0];
        if (l2 && !off && l2.by !== me.name) fail('리그를 만든 사람이나 운영진만 지울 수 있어요');
        D.leagues = D.leagues.filter(function (x) { return x.id !== b.lid; });
        break;
      }
      case 'close': D.closed = true; D.closedBy = me.name; D.closedAt = t.iso; break;
      case 'reopen': D.closed = false; break;
      default: fail('알 수 없는 동작입니다');
    }
    D.ver = (D.ver || 0) + 1; D.updatedAt = t.iso;
    store.put('days', date, D);
    return { day: D, payments: paymentsOf(store, date) };
  }

  /* ---------- 입금 ---------- */
  function pay(me, b, store, env) {
    var date = checkDate(b.date), name = b.name ? cleanName(b.name) : me.name, t = kst(env);
    var id = date + '|' + name, p = store.get('payments', id) || { id: id, date: date, name: name, status: 'none' };
    if (b.op === 'claim') {
      if (name !== me.name && !isOff(me)) fail('본인 입금만 알릴 수 있어요');
      if (p.status !== 'confirmed') { p.status = 'claimed'; p.claimedAt = t.iso; }
      p.amount = Math.max(0, Number(b.amount) || 0);
    } else if (b.op === 'confirm' || b.op === 'reset') {
      if (!isOff(me)) fail('운영진만 입금 확인을 할 수 있어요');
      if (b.op === 'confirm') { p.status = 'confirmed'; p.confirmedAt = t.iso; p.by = me.name; if (b.amount !== undefined) p.amount = Math.max(0, Number(b.amount) || 0); }
      else { p.status = 'none'; delete p.confirmedAt; delete p.claimedAt; }
    } else fail('알 수 없는 동작입니다');
    store.put('payments', id, p);
    return { payment: p, payments: paymentsOf(store, date) };
  }

  /* ---------- 공지 ---------- */
  function noticeSave(me, b, store, env) {
    if (!canNotice(me)) fail('공지는 회장·관리자만 쓸 수 있어요');
    var title = String(b.title || '').trim().slice(0, 80), body = String(b.body || '').trim().slice(0, 3000);
    if (!title) fail('제목을 넣어 주세요');
    var t = kst(env), id = b.id || env.uuid(), old = store.get('notices', id) || {};
    var n = { id: id, kind: 'notice', title: title, body: body, pinned: !!b.pinned, author: old.author || me.name, authorRole: old.authorRole || roleOf(me), at: old.at || t.iso, editedAt: b.id ? t.iso : undefined };
    store.put('notices', id, n);
    return { notice: n };
  }
  function noticeDelete(me, b, store) {
    if (!canNotice(me)) fail('공지는 회장·관리자만 지울 수 있어요');
    store.del('notices', b.id); return {};
  }

  /* ---------- 가계부 (회계) ----------
   * 보기: 회장·부회장·총무·관리자 / 쓰기·고치기: 총무·관리자 */
  var LEDGER_IN = ['벌금', '게스트비', '연회비', '이월(시작 잔액)', '기타 수입'];
  var LEDGER_OUT = ['셔틀콕·비품', '체육관 대관', '대회·송년회 등 행사', '경조사', '분기 아침식사', '전국대회 참가비 지원', '단체티·굿즈', '기타 지출'];
  function canLedger(m) { return isOff(m); }
  function canWriteLedger(m) { return roleOf(m) === '총무' || isAdmin(m); }
  function ledgerList(me, b, store) {
    if (!canLedger(me)) fail('가계부는 회장·부회장·총무만 볼 수 있어요');
    return { entries: store.list('ledger').sort(function (a, c) { return String(a.date).localeCompare(String(c.date)) || String(a.at).localeCompare(String(c.at)); }), canWrite: canWriteLedger(me), categories: { in: LEDGER_IN, out: LEDGER_OUT } };
  }
  function ledgerSave(me, b, store, env) {
    if (!canWriteLedger(me)) fail('가계부 기록은 총무가 해요');
    var type = b.type === 'out' ? 'out' : 'in';
    var cats = type === 'in' ? LEDGER_IN : LEDGER_OUT;
    if (cats.indexOf(b.category) < 0) fail('항목을 골라 주세요');
    var amount = Math.round(Number(b.amount) || 0);
    if (amount <= 0 || amount > 100000000) fail('금액을 확인해 주세요');
    checkDate(b.date);
    var t = kst(env), id = b.id || env.uuid(), old = store.get('ledger', id) || {};
    var e = { id: id, date: b.date, type: type, category: b.category, amount: amount, memo: String(b.memo || '').trim().slice(0, 80), by: old.by || me.name, at: old.at || t.iso };
    if (b.id) { e.editedBy = me.name; e.editedAt = t.iso; }
    store.put('ledger', id, e);
    return ledgerList(me, b, store);
  }
  function ledgerDelete(me, b, store) {
    if (!canWriteLedger(me)) fail('가계부 기록은 총무가 해요');
    store.del('ledger', b.id);
    return ledgerList(me, b, store);
  }

  /* ---------- 멤버 관리 ---------- */
  function setRole(me, b, store) {
    // 회칙 제8조 ②: 회장 외 집행부·임원진은 회장이 임명 (관리자도 가능)
    if (!isAdmin(me) && roleOf(me) !== '회장') fail('직책은 회장·관리자만 정할 수 있어요');
    if (ROLES.indexOf(b.role) < 0) fail('직책이 올바르지 않습니다');
    var m = store.get('members', cleanName(b.name)); if (!m) fail('멤버를 찾을 수 없습니다');
    if (b.role === '회장' && !isAdmin(me)) fail('회장은 회원 추천·동의로 뽑습니다. 관리자가 바꿔 주세요');
    var all = store.list('members');
    if (OFFICER[b.role]) { // 회장·부회장·총무는 한 명씩
      all.forEach(function (x) { if (x.role === b.role && x.name !== m.name) { x.role = '일반'; store.put('members', x.name, x); } });
    }
    if (b.role === '임원' && m.role !== '임원' && all.filter(function (x) { return x.role === '임원'; }).length >= MAX_EXEC) fail('임원진은 ' + MAX_EXEC + '명까지예요');
    m.role = b.role;
    m.title = b.role === '임원' ? String(b.title || m.title || '임원').slice(0, 10) : '';
    store.put('members', m.name, m);
    return { member: pub(m, 'admin') };
  }
  function setHost(me, b, store) {
    if (!isAdmin(me) && roleOf(me) !== '회장') fail('방장·부방장은 회장·관리자가 정해요');
    var h = HOSTS.indexOf(b.host) >= 0 ? b.host : '';
    var m = store.get('members', cleanName(b.name)); if (!m) fail('멤버를 찾을 수 없습니다');
    m.host = h; store.put('members', m.name, m);
    return { member: pub(m, 'admin') };
  }
  function setAdmin(me, b, store) {
    if (!isAdmin(me)) fail('관리 권한은 관리자만 줄 수 있어요');
    var m = store.get('members', cleanName(b.name)); if (!m) fail('멤버를 찾을 수 없습니다');
    if (!b.admin && ADMIN_NAMES.indexOf(m.name) >= 0) fail('서버 코드에 적힌 관리자는 여기서 뺄 수 없어요');
    if (!b.admin && store.list('members').filter(isAdmin).length <= 1) fail('관리자가 한 명은 있어야 해요');
    m.admin = !!b.admin; store.put('members', m.name, m);
    return { member: pub(m, 'admin') };
  }
  function setGrade(me, b, store, env) {
    if (!isOff(me)) fail('급수는 운영진만 바꿀 수 있어요');
    if (GRADES.indexOf(b.grade) < 0) fail('급수가 올바르지 않습니다');
    var m = store.get('members', cleanName(b.name)); if (!m) fail('멤버를 찾을 수 없습니다');
    if (m.grade === b.grade) return { member: pub(m, 'admin') };
    var t = kst(env), from = m.grade, up = GRADES.indexOf(b.grade) < GRADES.indexOf(from);
    m.grade = b.grade; m.gradeHistory = (m.gradeHistory || []).concat([{ from: from, to: b.grade, at: t.iso, by: me.name }]);
    store.put('members', m.name, m);
    if (up) {
      var id = env.uuid();
      store.put('notices', id, { id: id, kind: 'promo', title: '🎉 ' + m.name + ' 승급! ' + from + '조 → ' + b.grade + '조', body: m.name + '님의 자석 색이 바뀌었습니다. 축하해 주세요!', pinned: false, author: me.name, authorRole: roleOf(me), at: t.iso, who: m.name, grade: b.grade });
    }
    return { member: pub(m, 'admin') };
  }
  function updateMe(me, b, store, env) {
    if (b.phone !== undefined) { var ph = String(b.phone).replace(/\D/g, ''); if (!/^01\d{8,9}$/.test(ph)) fail('전화번호를 확인해 주세요'); me.phone = ph; }
    if (b.birth !== undefined) { if (!/^(19|20)\d{2}-\d{2}-\d{2}$/.test(String(b.birth))) fail('생년월일을 확인해 주세요'); me.birth = b.birth; }
    if (b.addr !== undefined) { var ad = String(b.addr).replace(/\s+/g, ' ').trim().slice(0, 120); if (ad.length < 5) fail('주소를 확인해 주세요'); me.addr = ad; }
    if (b.newPassword) {
      if (hashPw(env, me.salt, String(b.oldPassword || '')) !== me.pw) fail('지금 비밀번호가 맞지 않습니다');
      if (String(b.newPassword).length < 4) fail('새 비밀번호는 4자 이상');
      me.salt = env.uuid(); me.pw = hashPw(env, me.salt, String(b.newPassword)); me.token = env.uuid();
    }
    store.put('members', me.name, me);
    return { me: pub(me, 'admin'), token: me.token };
  }
  function resetPassword(me, b, store, env) {
    if (!isAdmin(me)) fail('관리자만 비밀번호를 초기화할 수 있어요');
    var m = store.get('members', cleanName(b.name)); if (!m) fail('멤버를 찾을 수 없습니다');
    if (String(b.password || '').length < 4) fail('임시 비밀번호는 4자 이상');
    m.salt = env.uuid(); m.pw = hashPw(env, m.salt, String(b.password)); m.token = env.uuid();
    store.put('members', m.name, m); return {};
  }
  function deleteMember(me, b, store) {
    if (!isAdmin(me)) fail('관리자만 멤버를 내보낼 수 있어요');
    var name = cleanName(b.name); if (name === me.name) fail('본인은 내보낼 수 없어요');
    store.del('members', name); return {};
  }
  function settingsSave(me, b, store) {
    if (!isOff(me)) fail('운영진만 바꿀 수 있어요');
    var s = { bank: String(b.bank || '').slice(0, 20), number: String(b.number || '').replace(/[^\d-]/g, '').slice(0, 30), holder: String(b.holder || '').slice(0, 20), kakaopay: /^https:\/\/qr\.kakaopay\.com\//.test(b.kakaopay || '') ? b.kakaopay : '' };
    store.put('settings', 'main', s);
    return { settings: settingsOf(store) };
  }

  function handle(action, b, store, env) {
    b = b || {};
    ADMIN_NAMES = (env.config && env.config.admins) || [];
    if (action === 'ping') return { name: '우당탕탕 요절복통', time: kst(env).iso };
    if (action === 'signup') return signup(b, store, env);
    if (action === 'login') return login(b, store, env);
    var me = authed(b, store);
    switch (action) {
      case 'bootstrap': return bootstrap(me, b, store, env);
      case 'month': return month(me, b, store);
      case 'day': { var date = checkDate(b.date); return { day: store.get('days', date) || newDay(date), payments: paymentsOf(store, date) }; }
      case 'dayOp': return dayOp(me, b, store, env);
      case 'pay': return pay(me, b, store, env);
      case 'noticeSave': return noticeSave(me, b, store, env);
      case 'noticeDelete': return noticeDelete(me, b, store);
      case 'ledgerList': return ledgerList(me, b, store);
      case 'ledgerSave': return ledgerSave(me, b, store, env);
      case 'ledgerDelete': return ledgerDelete(me, b, store);
      case 'setRole': return setRole(me, b, store);
      case 'setHost': return setHost(me, b, store);
      case 'setAdmin': return setAdmin(me, b, store);
      case 'setGrade': return setGrade(me, b, store, env);
      case 'updateMe': return updateMe(me, b, store, env);
      case 'resetPassword': return resetPassword(me, b, store, env);
      case 'deleteMember': return deleteMember(me, b, store);
      case 'settingsSave': return settingsSave(me, b, store);
      default: fail('알 수 없는 요청입니다');
    }
  }

  return { handle: handle, GRADES: GRADES, ROLES: ROLES };
})();
if (typeof module !== 'undefined') module.exports = WDTT;

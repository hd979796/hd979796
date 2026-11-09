/**
 * 우당탕탕 요절복통 — 서버 규칙
 * 구글 앱스크립트(Code.gs)와 화면의 체험 모드가 같은 코드를 씁니다.
 * store: get(col,id) / put(col,id,obj) / del(col,id) / list(col)
 * env:   now() 밀리초, uuid(), hash(문자열), config { presets: {이름: 직책} }
 * 앱스크립트 호환을 위해 ?. 와 ?? 는 쓰지 않습니다.
 */
var WDTT = (function () {
  var GRADES = ['S', 'A', 'B', 'C', 'D'];
  var ROLES = ['회장', '총무', '관리자', '일반'];
  var OFFICER = { '회장': 1, '총무': 1, '관리자': 1 };
  var BOSS = { '회장': 1, '관리자': 1 }; // 공지·직책 임명
  var LATE_MIN = 18 * 60 + 15; // 18:15 이후 입장은 지각
  var STATUS = ['rsvp', 'present', 'late', 'absent'];

  function UserError(msg) { var e = new Error(msg); e.user = true; return e; }
  function fail(msg) { throw UserError(msg); }
  function kst(env) {
    var ms = env.now(), d = new Date(ms + 9 * 3600 * 1000);
    return { date: d.toISOString().slice(0, 10), h: d.getUTCHours(), m: d.getUTCMinutes(), iso: new Date(ms).toISOString() };
  }
  function isOff(m) { return !!OFFICER[m.role]; }
  function isBoss(m) { return !!BOSS[m.role]; }
  function pub(m, full) {
    var o = { name: m.name, grade: m.grade, role: m.role, joinedAt: m.joinedAt, gradeHistory: m.gradeHistory || [] };
    if (full) { o.phone = m.phone; o.birth = m.birth; o.addr = m.addr || ''; }
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
    var t = kst(env), all = store.list('members');
    var presets = (env.config && env.config.presets) || {};
    var role = presets[name] || '일반';
    if (role === '일반' && !all.some(function (m) { return isBoss(m); })) role = '관리자'; // 첫 가입자는 관리자
    var salt = env.uuid();
    var m = {
      name: name, phone: phone, birth: birth, addr: addr, grade: b.grade, role: role, joinedAt: t.iso, agreeAt: t.iso,
      salt: salt, pw: hashPw(env, salt, String(b.password)), token: env.uuid(),
      gradeHistory: [{ to: b.grade, at: t.iso, by: name, note: '가입' }]
    };
    store.put('members', name, m);
    return { token: m.token, me: pub(m, true) };
  }
  function login(b, store, env) {
    var m = store.get('members', cleanName(b.name));
    if (!m || hashPw(env, m.salt, String(b.password || '')) !== m.pw) fail('이름 또는 비밀번호가 맞지 않습니다');
    if (!m.token) { m.token = env.uuid(); store.put('members', m.name, m); }
    return { token: m.token, me: pub(m, true) };
  }
  function authed(b, store) {
    var m = b.me ? store.get('members', cleanName(b.me)) : null;
    if (!m || !b.token || m.token !== b.token) { var e = UserError('다시 로그인해 주세요'); e.code = 'auth'; throw e; }
    return m;
  }

  /* ---------- 조회 ---------- */
  function bootstrap(me, b, store, env) {
    var full = isOff(me);
    return {
      me: pub(me, true),
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
    var op = b.op;
    if (!off) {
      if (D.closed) fail('마감된 날입니다. 운영진에게 말해 주세요');
      if (date < t.date) fail('지난 날짜는 운영진만 고칠 수 있어요');
      if (!self && (op === 'join' || op === 'leave' || op === 'checkin')) fail('본인 자석만 움직일 수 있어요');
      if (op === 'setStatus' || op === 'close' || op === 'reopen') fail('운영진(회장·총무·관리자)만 할 수 있어요');
      if ((op === 'mark' || op === 'checkin') && date !== t.date) fail('오늘 날짜에서만 할 수 있어요');
    }
    var a = D.att[target];
    switch (op) {
      case 'join':
        if (!store.get('members', target)) fail('가입한 멤버가 아닙니다');
        if (!a) D.att[target] = { status: 'rsvp', rsvpAt: t.iso };
        break;
      case 'leave':
        delete D.att[target];
        D.marks = D.marks.filter(function (x) { return x.name !== target; });
        break;
      case 'checkin': {
        if (!a) fail('먼저 자석을 붙여 주세요');
        if (a.status === 'present' || a.status === 'late') break;
        a.arrivedAt = t.iso;
        a.status = (date === t.date && t.h * 60 + t.m > LATE_MIN) ? 'late' : 'present';
        break;
      }
      case 'setStatus':
        if (STATUS.indexOf(b.status) < 0) fail('상태가 올바르지 않습니다');
        if (!a) a = D.att[target] = { rsvpAt: t.iso };
        a.status = b.status; a.by = me.name; a.at = t.iso;
        break;
      case 'mark': {
        if (!a || a.status === 'absent') fail('오늘 참석한 사람만 표시할 수 있어요');
        var rate = D.rate === '2000' ? 2000 : D.rate === '3000' ? 3000 : (t.h >= 19 ? 3000 : 2000);
        var kind = b.kind === 'dbl' || b.kind === 'deuce' ? b.kind : 'lose';
        D.marks.push({ id: env.uuid(), name: target, base: rate, amount: rate + (kind === 'lose' ? 0 : 1000), dbl: kind === 'dbl', deuce: kind === 'deuce', at: t.iso, by: me.name });
        break;
      }
      case 'undoMark': {
        for (var i = D.marks.length - 1; i >= 0; i--) if (D.marks[i].name === target) { D.marks.splice(i, 1); break; }
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
    if (!isBoss(me)) fail('공지는 회장·관리자만 쓸 수 있어요');
    var title = String(b.title || '').trim().slice(0, 80), body = String(b.body || '').trim().slice(0, 3000);
    if (!title) fail('제목을 넣어 주세요');
    var t = kst(env), id = b.id || env.uuid(), old = store.get('notices', id) || {};
    var n = { id: id, kind: 'notice', title: title, body: body, pinned: !!b.pinned, author: old.author || me.name, authorRole: old.authorRole || me.role, at: old.at || t.iso, editedAt: b.id ? t.iso : undefined };
    store.put('notices', id, n);
    return { notice: n };
  }
  function noticeDelete(me, b, store) {
    if (!isBoss(me)) fail('공지는 회장·관리자만 지울 수 있어요');
    store.del('notices', b.id); return {};
  }

  /* ---------- 멤버 관리 ---------- */
  function setRole(me, b, store) {
    if (!isBoss(me)) fail('직책은 회장·관리자만 임명할 수 있어요');
    if (ROLES.indexOf(b.role) < 0) fail('직책이 올바르지 않습니다');
    var m = store.get('members', cleanName(b.name)); if (!m) fail('멤버를 찾을 수 없습니다');
    var all = store.list('members');
    if (BOSS[m.role] && !BOSS[b.role] && all.filter(function (x) { return BOSS[x.role]; }).length <= 1) fail('회장·관리자가 한 명은 있어야 해요');
    if (b.role === '회장' || b.role === '총무') {
      all.forEach(function (x) { if (x.role === b.role && x.name !== m.name) { x.role = '일반'; store.put('members', x.name, x); } });
    }
    m.role = b.role; store.put('members', m.name, m);
    return { member: pub(m, true) };
  }
  function setGrade(me, b, store, env) {
    if (!isOff(me)) fail('급수는 운영진만 바꿀 수 있어요');
    if (GRADES.indexOf(b.grade) < 0) fail('급수가 올바르지 않습니다');
    var m = store.get('members', cleanName(b.name)); if (!m) fail('멤버를 찾을 수 없습니다');
    if (m.grade === b.grade) return { member: pub(m, true) };
    var t = kst(env), from = m.grade, up = GRADES.indexOf(b.grade) < GRADES.indexOf(from);
    m.grade = b.grade; m.gradeHistory = (m.gradeHistory || []).concat([{ from: from, to: b.grade, at: t.iso, by: me.name }]);
    store.put('members', m.name, m);
    if (up) {
      var id = env.uuid();
      store.put('notices', id, { id: id, kind: 'promo', title: '🎉 ' + m.name + ' 승급! ' + from + '조 → ' + b.grade + '조', body: m.name + '님의 자석 색이 바뀌었습니다. 축하해 주세요!', pinned: false, author: me.name, authorRole: me.role, at: t.iso, who: m.name, grade: b.grade });
    }
    return { member: pub(m, true) };
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
    return { me: pub(me, true), token: me.token };
  }
  function resetPassword(me, b, store, env) {
    if (!isBoss(me)) fail('회장·관리자만 비밀번호를 초기화할 수 있어요');
    var m = store.get('members', cleanName(b.name)); if (!m) fail('멤버를 찾을 수 없습니다');
    if (String(b.password || '').length < 4) fail('임시 비밀번호는 4자 이상');
    m.salt = env.uuid(); m.pw = hashPw(env, m.salt, String(b.password)); m.token = env.uuid();
    store.put('members', m.name, m); return {};
  }
  function deleteMember(me, b, store) {
    if (!isBoss(me)) fail('회장·관리자만 멤버를 내보낼 수 있어요');
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
      case 'setRole': return setRole(me, b, store);
      case 'setGrade': return setGrade(me, b, store, env);
      case 'updateMe': return updateMe(me, b, store, env);
      case 'resetPassword': return resetPassword(me, b, store, env);
      case 'deleteMember': return deleteMember(me, b, store);
      case 'settingsSave': return settingsSave(me, b, store);
      default: fail('알 수 없는 요청입니다');
    }
  }

  return { handle: handle, GRADES: GRADES, ROLES: ROLES, LATE_MIN: LATE_MIN };
})();
if (typeof module !== 'undefined') module.exports = WDTT;

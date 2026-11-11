#!/usr/bin/env python3
"""보험금 검산방(Claude 아티팩트)을 Apps Script 웹앱용 Index.html 로 바꾼다.

- AI 서류 자동 읽기(Claude 전용)는 빼고 진료내역 직접 입력으로 쓴다. 서류 읽기는 Claude판 링크로 안내.
- 검산 저장(db)은 Apps Script 의 구글 시트(Code.gs listCases/saveCase)로, 파일 저장(downloads)은 브라우저 내려받기로 바꾼다.
사용: py scripts/build_claim_check.py <검산방 아티팩트 html>
"""
import pathlib, re, sys

CLAUDE_URL = "https://claude.ai/artifact/JFhBJgSRaiHtDum3oF4ZGB"
src = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
out = pathlib.Path(__file__).resolve().parent.parent / "gas" / "claim-check" / "Index.html"

def rep(s, old, new):
    assert s.count(old) == 1, old[:70]
    return s.replace(old, new)

SHIM = """<script>
/* Apps Script 판: Claude 전용 기능 대신 구글 시트 저장 + 브라우저 내려받기 */
(function(){
  const run=(fn,...a)=>new Promise((res,rej)=>google.script.run.withSuccessHandler(res).withFailureHandler(rej)[fn](...a));
  const subs=[];
  async function refresh(){try{const list=await run('listCases');const snap={docs:list.map(c=>({id:c.id,data:()=>c}))};subs.forEach(s=>s.cb(snap));}catch(e){subs.forEach(s=>s.err&&s.err(e));}}
  const coll=path=>({
    doc:id=>({set:async obj=>{if(path!=='cases')return;await run('saveCase',id,JSON.stringify(obj));refresh();},get:async()=>({data:()=>null}),delete:async()=>{}}),
    orderBy:()=>({limit:()=>({onSnapshot:(cb,err)=>{subs.push({cb,err});refresh();}})})
  });
  const DL={save:async({filename,data})=>{const blob=data instanceof Blob?data:new Blob([data],{type:'text/html;charset=utf-8'});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);}};
  window.claude={use:async c=>c==='db'?{collection:coll}:c==='downloads'?DL:null};
})();
</script>
"""
s = src
s = rep(s, "<script>\n/* 실손의료비 검산 엔진", SHIM + "<script>\n/* 실손의료비 검산 엔진")
NOTE = (f'<div class="callout"><b>서류 사진 자동 읽기</b>는 Claude판 검산방에서만 됩니다. 이 화면에서는 아래 3번 표에 진료 내역을 직접 넣으세요. '
        f'<a href="{CLAUDE_URL}" target="_blank" rel="noopener" style="color:var(--accent);font-weight:600">Claude판 검산방 열기 ↗</a></div>')
s = rep(s, '<div class="drop" id="drop">', NOTE + '\n    <div class="drop" id="drop" hidden>')
s = rep(s, '<div class="row"><button class="btn primary" id="readBtn"', '<div class="row" hidden><button class="btn primary" id="readBtn"')
s = rep(s, "저장 기능은 로그인한 편집자에게만 열립니다. 계산과 보고서는 그대로 쓸 수 있습니다.", "저장된 검산을 불러오지 못했습니다. 계산과 보고서는 그대로 쓸 수 있습니다.")
s = rep(s, "if(!db){note.textContent='로그인한 상태에서만 저장됩니다.';return;}", "if(!db){note.textContent='저장 기능을 쓸 수 없습니다.';return;}")
s = rep(s, "<summary class=\"note\" style=\"cursor:pointer\">포탈 담보 내용 붙여넣어 자동 채우기</summary>", "<summary class=\"note\" style=\"cursor:pointer\">포탈 담보 내용 붙여넣어 자동 채우기 (Claude판에서만)</summary>")
# Apps Script 는 스크립트 주석을 지울 때 "https://" 의 // 를 주석으로 잘라 문법 오류를 낸다 → 스크립트 안의 :// 를 :\/\/ 로
s = re.sub(r"(<script[^>]*>)(.*?)(</script>)", lambda m: m.group(1) + m.group(2).replace("://", r":\/\/") + m.group(3), s, flags=re.S)
assert "<?" not in s
out.write_text(s, encoding="utf-8")
print(out, len(s.encode()), "bytes")

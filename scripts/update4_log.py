#!/usr/bin/env python3
"""포탈 사용 기록(log 컬렉션)을 Apps Script에서 받아 update4.md 에 날짜별로 덧붙입니다.

환경변수:
  PORTAL_API   Apps Script 웹앱 URL (…/exec)
  PORTAL_KEY   포탈 비밀번호(key)
  UPDATE4_PATH 기록할 파일 (기본: update4.md)
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

API = os.environ["PORTAL_API"].strip()
KEY = os.environ["PORTAL_KEY"].strip()
PATH = os.environ.get("UPDATE4_PATH", "update4.md").strip() or "update4.md"
KST = timezone(timedelta(hours=9))
MARK = re.compile(r"<!-- update4-last: ([^ ]+) -->")

ACTION = {"set": "등록", "update": "수정", "delete": "삭제"}
COL = {
    "cases": "계약", "requests": "요청함", "templates": "멘트", "notes": "공부방",
    "calls": "통화", "todos": "할 일", "profiles": "고객정보", "portal": "포탈설정",
    "customers": "고객명부", "customers_meta": "고객명부",
}
DOW = "월화수목금토일"


def fetch_log():
    url = API + ("&" if "?" in API else "?") + urllib.parse.urlencode(
        {"action": "list", "col": "log", "key": KEY})
    with urllib.request.urlopen(url, timeout=60) as r:
        j = json.load(r)
    if not j.get("ok"):
        sys.exit("API 오류: " + str(j.get("error") or j))
    data = j.get("data") or []
    if isinstance(data, dict):           # {id: {...}} 형태일 때
        data = [dict(v, id=k) for k, v in data.items()]
    return [d for d in data if isinstance(d, dict) and d.get("at")]


def read_file():
    if not os.path.exists(PATH):
        return "# update4 — 업무포탈 사용 기록\n\n", None
    txt = open(PATH, encoding="utf-8").read()
    m = MARK.search(txt)
    return (MARK.sub("", txt).rstrip("\n") + "\n", m.group(1) if m else None)


def line(e):
    t = datetime.fromisoformat(e["at"].replace("Z", "+00:00")).astimezone(KST)
    parts = [t.strftime("%H:%M"), e.get("who") or "", COL.get(e.get("col"), e.get("col") or ""),
             ACTION.get(e.get("action"), e.get("action") or "")]
    body = " ".join(x for x in [e.get("name"), e.get("kind")] if x)
    if e.get("status") == "done":
        body = (body + " 완료").strip()
    if body:
        parts.append(body)
    if e.get("detail"):
        parts.append(str(e["detail"])[:80])
    return "- " + " · ".join(p for p in parts if p)


def main():
    log = fetch_log()
    txt, last = read_file()
    new = sorted((e for e in log if not last or e["at"] > last), key=lambda e: e["at"])
    if not new:
        print("새 기록 없음")
        return
    out, cur = [], None
    for e in new:
        d = datetime.fromisoformat(e["at"].replace("Z", "+00:00")).astimezone(KST)
        day = d.strftime("%Y-%m-%d") + f" ({DOW[d.weekday()]})"
        if day != cur:
            cur = day
            if f"## {day}" in txt or any(o == f"## {day}" for o in out):
                out.append("")          # 같은 날 이어쓰기
            else:
                out += ["", f"## {day}"]
        out.append(line(e))
    txt = txt.rstrip("\n") + "\n" + "\n".join(out) + "\n\n" + \
        f"<!-- update4-last: {new[-1]['at']} -->\n"
    open(PATH, "w", encoding="utf-8").write(txt)
    print(f"{len(new)}건 추가 → {PATH}")


if __name__ == "__main__":
    main()

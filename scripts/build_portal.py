#!/usr/bin/env python3
"""업무포탈 Apps Script용 한 파일(portal.html)을 만든다.

sign/portal/index.html(편집용 원본)에 아이콘·가족사진을 안에 넣어 sign/portal/portal.html로 저장한다.
만든 portal.html을 Apps Script 프로젝트의 portal 파일에 붙여넣고 「배포 관리 > 새 버전」으로 배포한다.
"""
import base64
import pathlib
import re

D = pathlib.Path(__file__).resolve().parent.parent / "sign" / "portal"


def uri(name, mime):
    return f"data:{mime};base64," + base64.b64encode((D / name).read_bytes()).decode()


s = (D / "index.html").read_text(encoding="utf-8")
s = s.replace('href="icon-192.png"', 'href="' + uri("icon-192.png", "image/png") + '"')
s = s.replace('href="icon-180.png"', 'href="' + uri("icon-180.png", "image/png") + '"')
s = re.sub(r'<link rel="manifest"[^>]*>\n?', "", s)
s = s.replace('src="family.jpg"', 'src="' + uri("family.jpg", "image/jpeg") + '"')
assert "family.jpg" not in s, "가족사진이 안에 들어가지 않았습니다"
(D / "portal.html").write_text(s, encoding="utf-8")
print("portal.html", len(s), "bytes")

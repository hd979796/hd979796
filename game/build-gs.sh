#!/bin/sh
# server.js(규칙) + gas-adapter.js(구글 시트 연결)를 합쳐 앱스크립트에 붙여넣을 Code.gs.txt를 만듭니다.
cd "$(dirname "$0")"
{
  echo "/* 우당탕탕 요절복통 — 구글 앱스크립트 서버 (build-gs.sh로 만든 파일입니다. 직접 고치지 말고 server.js·gas-adapter.js를 고치세요) */"
  grep -v "^if (typeof module" server.js
  echo
  cat gas-adapter.js
} > Code.gs.txt

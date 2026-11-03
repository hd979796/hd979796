"""GitHub Actions 매일 08:00 자동발송 테스트 설정 (한 번만 실행)

1. 소스 커밋 + GitHub 업로드
2. GitHub Secrets 등록 (.env의 알리고 정보 + 테스트 명단 엑셀의 수신자)
3. 이 PC에 GitHub Actions runner 설치·실행 (+ 로그인 시 자동 시작)
4. 테스트모드(문자 안 나감)로 워크플로를 한 번 실행해 검증

단계마다 결과를 확인하고, 하나라도 실패하면 그 자리에서 멈춘다.
"""
import hashlib
import json
import os
import re
import socket
import subprocess
import sys
import time
import urllib.request
import zipfile
from pathlib import Path

from dotenv import dotenv_values

from birthday_sms import load_customers, normalize_phone

BASE = Path(__file__).resolve().parent
REPO = "hd979796/hd979796"
WORKFLOW = "birthday-test.yml"
RUNNER_DIR = Path(os.environ["USERPROFILE"]) / "actions-runner"
RUNNER_NAME = f"{socket.gethostname()}-aligo"
STARTUP_BAT = (Path(os.environ["APPDATA"]) / "Microsoft/Windows/Start Menu/Programs/Startup"
               / "github-actions-runner.bat")


def step(title):
    print(f"\n=== {title} ===", flush=True)


def fail(msg):
    print(f"\n[실패] {msg}\n설정을 중단했습니다. 위 메시지를 확인하세요.", flush=True)
    sys.exit(1)


def run(args, check=True, capture=True, cwd=BASE):
    r = subprocess.run(args, cwd=cwd, capture_output=capture, text=True, encoding="utf-8")
    if check and r.returncode != 0:
        fail(f"명령 실패: {' '.join(args[:3])} ...\n{(r.stderr or r.stdout or '').strip()}")
    return r


def gh(*args, check=True):
    return run(["gh", *args], check=check)


# 1. 로그인 확인 ------------------------------------------------------------
step("1/6 GitHub 로그인 확인")
if gh("auth", "status", check=False).returncode != 0:
    fail("GitHub CLI 로그인이 필요합니다: gh auth login --web --scopes workflow")
print("로그인 OK")

# 2. 커밋 + 업로드 ------------------------------------------------------------
step("2/6 소스 GitHub 업로드")
run(["git", "add", "-A"])
staged = run(["git", "diff", "--cached", "--name-only"]).stdout.split()
leaked = [f for f in staged if f == ".env" or f.endswith((".xlsx", ".csv"))]
if leaked:
    fail(f"개인정보/비밀 파일이 업로드 대상에 포함됨: {leaked}")
if staged:
    run(["git", "commit", "-q", "-m",
         "GitHub Actions 매일 08:00 자동발송 테스트 (self-hosted runner), 로그 개인정보 가림\n\n"
         "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"])
run(["git", "push", "-q", "origin", "main"])
print("업로드 OK:", run(["git", "log", "--oneline", "-1"]).stdout.strip())

# 3. Secrets ---------------------------------------------------------------
step("3/6 GitHub Secrets 등록")
cfg = dotenv_values(BASE / ".env")
secrets = {k: (cfg.get(k) or "").strip() for k in ("ALIGO_API_KEY", "ALIGO_USER_ID", "ALIGO_SENDER")}
empty = [k for k, v in secrets.items() if not v]
if empty:
    fail(f".env 값이 비어 있음: {empty}")

test_file = (BASE / (cfg.get("TEST_CUSTOMER_FILE") or "../생일축하 문자 발송 테스트 문서.xlsx")).resolve()
customers, _ = load_customers(test_file)
recips = []
for c in customers:
    p = normalize_phone(c["phone"])
    if not p:
        fail(f"테스트 명단에 잘못된 번호: {c['name']}")
    recips.append(f"{c['name']}:{p}")
if not recips:
    fail("테스트 명단이 비어 있습니다.")
secrets["TEST_RECIPIENTS"] = ",".join(recips)

for name, value in secrets.items():
    gh("secret", "set", name, "--repo", REPO, "--body", value)
registered = {s["name"] for s in json.loads(gh("secret", "list", "--repo", REPO, "--json", "name").stdout)}
if not set(secrets) <= registered:
    fail(f"Secrets 등록 확인 실패: {set(secrets) - registered}")
print(f"Secrets OK: {', '.join(secrets)}  (수신자 {len(recips)}명)")

# 4. Runner 설치 -------------------------------------------------------------
step("4/6 이 PC에 GitHub Actions runner 설치")
if (RUNNER_DIR / ".runner").exists():
    print("이미 설치되어 있음:", RUNNER_DIR)
else:
    rel = json.loads(gh("api", "repos/actions/runner/releases/latest").stdout)
    ver = rel["tag_name"].lstrip("v")
    m = re.search(r"<!-- BEGIN SHA win-x64 -->([0-9a-f]{64})", rel["body"])
    if not m:
        fail("runner 파일 검증값(SHA256)을 찾지 못했습니다.")
    url = f"https://github.com/actions/runner/releases/download/v{ver}/actions-runner-win-x64-{ver}.zip"
    RUNNER_DIR.mkdir(exist_ok=True)
    zpath = RUNNER_DIR / f"actions-runner-win-x64-{ver}.zip"
    print("다운로드:", url)
    urllib.request.urlretrieve(url, zpath)
    if hashlib.sha256(zpath.read_bytes()).hexdigest() != m.group(1):
        zpath.unlink()
        fail("다운로드 파일 검증(SHA256) 불일치 - 설치 중단")
    print("파일 검증 OK (SHA256)")
    with zipfile.ZipFile(zpath) as z:
        z.extractall(RUNNER_DIR)
    zpath.unlink()

    token = json.loads(gh("api", "-X", "POST",
                          f"repos/{REPO}/actions/runners/registration-token").stdout)["token"]
    run(["cmd", "/c", "config.cmd", "--unattended", "--url", f"https://github.com/{REPO}",
         "--token", token, "--name", RUNNER_NAME, "--labels", "aligo",
         "--work", "_work", "--replace"], cwd=RUNNER_DIR)
    print("runner 등록 OK:", RUNNER_NAME)

# 로그인할 때 자동 시작
STARTUP_BAT.write_text(f'@echo off\r\nstart "GitHub Actions Runner" /min "{RUNNER_DIR / "run.cmd"}"\r\n',
                       encoding="ascii")
print("PC 로그인 시 자동 시작 등록 OK")

# 5. Runner 실행 + 온라인 확인 ----------------------------------------------
step("5/6 runner 실행")


def runner_status():
    data = json.loads(gh("api", f"repos/{REPO}/actions/runners").stdout)
    for r in data.get("runners", []):
        if r["name"] == RUNNER_NAME:
            return r["status"], {l["name"].lower() for l in r["labels"]}
    return None, set()


status, labels = runner_status()
if status != "online":
    subprocess.Popen(["cmd", "/c", "start", "GitHub Actions Runner", "/min", str(RUNNER_DIR / "run.cmd")],
                     cwd=RUNNER_DIR)
    for _ in range(30):
        time.sleep(3)
        status, labels = runner_status()
        if status == "online":
            break
if status != "online":
    fail("runner가 온라인 상태가 되지 않았습니다.")
if not {"self-hosted", "windows", "aligo"} <= labels:
    fail(f"runner 라벨 불일치: {labels}")
print("runner 온라인 OK, 라벨:", ", ".join(sorted(labels)))

# 6. 테스트모드로 워크플로 실행 검증 ---------------------------------------
step("6/6 워크플로 검증 실행 (알리고 테스트모드 - 문자 안 나감)")
before = json.loads(gh("run", "list", "--repo", REPO, "--workflow", WORKFLOW, "--limit", "1",
                       "--json", "databaseId").stdout)
before_id = before[0]["databaseId"] if before else 0
gh("workflow", "run", WORKFLOW, "--repo", REPO, "--ref", "main", "-f", "test_mode=Y")
run_id = None
for _ in range(20):
    time.sleep(3)
    runs = json.loads(gh("run", "list", "--repo", REPO, "--workflow", WORKFLOW, "--limit", "1",
                         "--json", "databaseId").stdout)
    if runs and runs[0]["databaseId"] != before_id:
        run_id = runs[0]["databaseId"]
        break
if not run_id:
    fail("워크플로 실행이 시작되지 않았습니다.")
print(f"실행 번호 {run_id} - 완료까지 기다리는 중...")
result = gh("run", "watch", str(run_id), "--repo", REPO, "--exit-status", check=False)
log = gh("run", "view", str(run_id), "--repo", REPO, "--log", check=False).stdout
for line in log.splitlines():
    if any(k in line for k in ("알리고 연결", "=====", "발송 성공", "발송 실패", "완료:")):
        print("  ", line.split("Z ", 1)[-1])
if result.returncode != 0:
    fail(f"워크플로 실패 - https://github.com/{REPO}/actions/runs/{run_id}")

print(f"""
==================================================
 설정 완료 - 모든 검증 통과
 매일 08:00(한국시간) 테스트 명단 {len(recips)}명에게 자동 발송됩니다.
 실행 기록: https://github.com/{REPO}/actions
==================================================""")

"""고객 생일 축하 문자 자동 발송 (알리고 SMS API)

사용법
  python birthday_sms.py              오늘 생일인 고객에게 발송
  python birthday_sms.py --dry-run    발송하지 않고 대상자만 확인
  python birthday_sms.py --date 2026-11-05 --dry-run   특정 날짜 기준으로 확인
  python birthday_sms.py --check      알리고 API 키 확인 + 잔여 건수 조회
"""
import argparse
import csv
import datetime as dt
import logging
import os
import re
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv
from openpyxl import load_workbook

BASE = Path(__file__).resolve().parent
load_dotenv(BASE / ".env")

ALIGO_SEND_URL = "https://apis.aligo.in/send/"
ALIGO_REMAIN_URL = "https://apis.aligo.in/remain/"

# 엑셀 머리글에서 찾을 열 이름 (앞에 있는 이름부터 찾음)
NAME_COLS = ("고객명", "이름", "성명")
BIRTH_COLS = ("생년월일", "생일")
PHONE_COLS = ("휴대폰", "휴대폰번호", "핸드폰", "전화번호", "연락처")
CONSENT_COLS = ("마케팅동의만료",)
OPTOUT_COLS = ("수신거부",)

# 정보통신망법: 21시~다음날 8시에는 발송하지 않음
SEND_START_HOUR, SEND_END_HOUR = 8, 21

SMS_MAX_BYTES = 90

log = logging.getLogger("birthday_sms")


def env(name, default=""):
    return os.getenv(name, default).strip()


def env_yes(name, default="Y"):
    return env(name, default).upper() in ("Y", "YES", "TRUE", "1")


def setup_logging():
    if log.handlers:
        return
    (BASE / "logs").mkdir(exist_ok=True)
    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%Y-%m-%d %H:%M:%S")
    fh = logging.FileHandler(BASE / "logs" / "birthday_sms.log", encoding="utf-8")
    fh.setFormatter(fmt)
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(fmt)
    log.setLevel(logging.INFO)
    log.addHandler(fh)
    log.addHandler(sh)


# ---------- 값 정리 ----------

def parse_birth(value):
    """생년월일 값에서 (월, 일)을 꺼낸다. 못 읽으면 None."""
    if value is None or value == "":
        return None
    if isinstance(value, (dt.datetime, dt.date)):
        return value.month, value.day
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    digits = re.sub(r"\D", "", str(value))
    if len(digits) in (7, 13):          # 주민번호 형태(앞 6자리 사용)
        digits = digits[:6]
    if len(digits) == 8:                # YYYYMMDD
        m, d = int(digits[4:6]), int(digits[6:8])
    elif len(digits) == 6:              # YYMMDD
        m, d = int(digits[2:4]), int(digits[4:6])
    elif len(digits) == 4:              # MMDD
        m, d = int(digits[:2]), int(digits[2:])
    else:
        return None
    try:
        dt.date(2000, m, d)             # 2000년은 윤년이라 2/29도 통과
    except ValueError:
        return None
    return m, d


def is_birthday(md, today):
    if md == (today.month, today.day):
        return True
    # 2월 29일생은 평년엔 2월 28일에 발송
    leap = today.year % 4 == 0 and (today.year % 100 != 0 or today.year % 400 == 0)
    return md == (2, 29) and not leap and (today.month, today.day) == (2, 28)


def normalize_phone(value):
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    digits = re.sub(r"\D", "", str(value))
    if digits.startswith("82"):
        digits = "0" + digits[2:]
    if len(digits) == 10 and digits.startswith("1"):  # 엑셀이 앞자리 0을 지운 경우
        digits = "0" + digits
    return digits if re.fullmatch(r"01[016789]\d{7,8}", digits) else None


def consent_valid(value, today):
    """마케팅동의만료일이 오늘 이후면 유효."""
    if value is None or value == "":
        return False
    if isinstance(value, dt.datetime):
        return value.date() >= today
    if isinstance(value, dt.date):
        return value >= today
    digits = re.sub(r"\D", "", str(value))
    if len(digits) != 8:
        return False
    try:
        return dt.date(int(digits[:4]), int(digits[4:6]), int(digits[6:])) >= today
    except ValueError:
        return False


# ---------- 고객 명단 ----------

def find_col(headers, candidates):
    for c in candidates:
        if c in headers:
            return headers.index(c)
    return None


def load_customers(path):
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows = ws.iter_rows(values_only=True)
    headers = [str(h).strip() if h is not None else "" for h in next(rows)]

    idx = {
        "name": find_col(headers, NAME_COLS),
        "birth": find_col(headers, BIRTH_COLS),
        "phone": find_col(headers, PHONE_COLS),
        "consent": find_col(headers, CONSENT_COLS),
        "optout": find_col(headers, OPTOUT_COLS),
    }
    missing = [k for k in ("name", "birth", "phone") if idx[k] is None]
    if missing:
        raise SystemExit(
            f"고객 명단에 필요한 열이 없습니다: {missing}\n"
            f"  필요한 머리글: 고객명 / 생년월일 / 휴대폰  (파일: {path})"
        )

    def cell(row, key):
        i = idx[key]
        return row[i] if i is not None and i < len(row) else None

    customers = []
    for row in rows:
        name = cell(row, "name")
        if not name:
            continue
        customers.append({
            "name": str(name).strip(),
            "birth": cell(row, "birth"),
            "phone": cell(row, "phone"),
            "consent": cell(row, "consent"),
            "optout": cell(row, "optout"),
        })
    wb.close()
    return customers, idx["consent"] is not None


# ---------- 발송 기록 (중복 발송 방지) ----------

SENT_LOG = BASE / "logs" / "sent_log.csv"
SENT_FIELDS = ["date", "time", "name", "phone", "result", "msg_id", "test_mode", "message"]


def already_sent(date_str):
    sent = set()
    if SENT_LOG.exists():
        with open(SENT_LOG, encoding="utf-8-sig", newline="") as f:
            for r in csv.DictReader(f):
                if r["date"] == date_str and r["result"] == "성공" and r["test_mode"] != "Y":
                    sent.add(r["phone"])
    return sent


def record_sent(row):
    new = not SENT_LOG.exists()
    with open(SENT_LOG, "a", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=SENT_FIELDS)
        if new:
            w.writeheader()
        w.writerow(row)


# ---------- 알리고 API ----------

def aligo_auth():
    key, user_id, sender = env("ALIGO_API_KEY"), env("ALIGO_USER_ID"), env("ALIGO_SENDER")
    missing = [n for n, v in (("ALIGO_API_KEY", key), ("ALIGO_USER_ID", user_id), ("ALIGO_SENDER", sender)) if not v]
    return key, user_id, re.sub(r"\D", "", sender), missing


def send_sms(phone, message, test_mode):
    key, user_id, sender, _ = aligo_auth()
    msg_type = "SMS" if len(message.encode("cp949", errors="replace")) <= SMS_MAX_BYTES else "LMS"
    data = {
        "key": key,
        "user_id": user_id,
        "sender": sender,
        "receiver": phone,
        "msg": message,
        "msg_type": msg_type,
        "testmode_yn": "Y" if test_mode else "N",
    }
    if msg_type == "LMS":
        data["title"] = env("SMS_TITLE", "생일 축하드립니다")
    r = requests.post(ALIGO_SEND_URL, data=data, timeout=30)
    r.raise_for_status()
    res = r.json()
    return str(res.get("result_code")) == "1", res


def check_api():
    key, user_id, sender, missing = aligo_auth()
    if missing:
        log.error(".env 파일에 값이 비어 있습니다: %s", ", ".join(missing))
        return 2
    r = requests.post(ALIGO_REMAIN_URL, data={"key": key, "user_id": user_id}, timeout=30)
    res = r.json()
    if str(res.get("result_code")) == "1":
        log.info("알리고 연결 성공 - 잔여: SMS %s건 / LMS %s건 / MMS %s건",
                 res.get("SMS_CNT"), res.get("LMS_CNT"), res.get("MMS_CNT"))
        log.info("발신번호: %s / 테스트모드: %s", sender, "켜짐" if env_yes("ALIGO_TEST_MODE") else "꺼짐(실제 발송)")
        return 0
    log.error("알리고 연결 실패: %s", res.get("message"))
    log.error("API 키·아이디가 맞는지, 이 PC의 IP가 알리고에 등록되어 있는지 확인하세요.")
    return 1


# ---------- 메인 ----------

def render(template, customer):
    return template.replace("{이름}", customer["name"]).strip()


def main():
    p = argparse.ArgumentParser(description="고객 생일 축하 문자 발송")
    p.add_argument("--date", help="기준 날짜 (YYYY-MM-DD), 기본값: 오늘")
    p.add_argument("--dry-run", action="store_true", help="발송하지 않고 대상자만 출력")
    p.add_argument("--check", action="store_true", help="알리고 API 연결 확인")
    args = p.parse_args()

    setup_logging()

    if args.check:
        return check_api()

    today = dt.date.fromisoformat(args.date) if args.date else dt.date.today()
    test_mode = env_yes("ALIGO_TEST_MODE")
    require_consent = env_yes("REQUIRE_MARKETING_CONSENT")
    dry = args.dry_run

    customer_file = BASE / env("CUSTOMER_FILE", "data/customers.xlsx")
    if not customer_file.exists():
        log.error("고객 명단 파일이 없습니다: %s", customer_file)
        log.error("make_customer_list.bat 을 실행해 명단을 먼저 만드세요.")
        return 2

    template_file = BASE / "message_template.txt"
    template = template_file.read_text(encoding="utf-8")

    customers, has_consent_col = load_customers(customer_file)
    if require_consent and not has_consent_col:
        log.warning("명단에 '마케팅동의만료' 열이 없어 동의 확인을 건너뜁니다.")

    targets, skipped = [], []
    for c in customers:
        md = parse_birth(c["birth"])
        if not md or not is_birthday(md, today):
            continue
        phone = normalize_phone(c["phone"])
        if not phone:
            skipped.append((c["name"], "휴대폰 번호 없음/오류"))
        elif c["optout"] not in (None, ""):
            skipped.append((c["name"], "수신거부"))
        elif require_consent and has_consent_col and not consent_valid(c["consent"], today):
            skipped.append((c["name"], "마케팅 동의 없음/만료"))
        else:
            targets.append({**c, "phone": phone})

    mode = "미리보기" if dry else ("테스트모드" if test_mode else "실제 발송")
    log.info("===== %s 생일 고객: 발송 %d명, 제외 %d명 [%s] =====", today, len(targets), len(skipped), mode)
    for name, reason in skipped:
        log.info("  제외: %s (%s)", name, reason)

    if dry:
        for c in targets:
            log.info("  대상: %s %s", c["name"], c["phone"])
        if targets:
            log.info("--- 문자 예시 ---\n%s", render(template, targets[0]))
        return 0

    if not targets:
        return 0

    _, _, _, missing = aligo_auth()
    if missing:
        log.error("알리고 정보가 .env 파일에 입력되지 않아 발송하지 못했습니다: %s", ", ".join(missing))
        return 2

    now = dt.datetime.now()
    if not args.date and not (SEND_START_HOUR <= now.hour < SEND_END_HOUR):
        log.warning("지금은 %d시입니다. 08~21시 사이에만 발송합니다.", now.hour)
        return 0

    sent = already_sent(today.isoformat())
    ok_cnt = fail_cnt = 0
    for c in targets:
        if c["phone"] in sent:
            log.info("  건너뜀(오늘 이미 발송): %s", c["name"])
            continue
        message = render(template, c)
        try:
            ok, res = send_sms(c["phone"], message, test_mode)
            detail = res.get("message", "")
            msg_id = res.get("msg_id", "")
        except Exception as e:  # 네트워크 오류 등
            ok, detail, msg_id = False, str(e), ""
        record_sent({
            "date": today.isoformat(), "time": dt.datetime.now().strftime("%H:%M:%S"),
            "name": c["name"], "phone": c["phone"], "result": "성공" if ok else "실패",
            "msg_id": msg_id, "test_mode": "Y" if test_mode else "N", "message": message,
        })
        if ok:
            ok_cnt += 1
            log.info("  발송 성공: %s %s", c["name"], c["phone"])
        else:
            fail_cnt += 1
            log.error("  발송 실패: %s %s - %s", c["name"], c["phone"], detail)

    log.info("완료: 성공 %d건, 실패 %d건", ok_cnt, fail_cnt)
    return 1 if fail_cnt else 0


if __name__ == "__main__":
    sys.exit(main())

"""영업포탈 '보유고객리스트' 엑셀로 발송용 명단(data/customers.xlsx)을 만든다.

- 생년월일이 있는 고객만 옮긴다.
- 이미 만든 명단이 있으면 입력해 둔 휴대폰·수신거부 값은 그대로 유지한다.
  (새 보유고객리스트를 받을 때마다 다시 실행해도 안전)

사용법
  python make_customer_list.py                      상위 폴더의 최신 *보유고객리스트*.xlsx 사용
  python make_customer_list.py 경로\\파일.xlsx
"""
import sys
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill

from birthday_sms import (BIRTH_COLS, CONSENT_COLS, NAME_COLS, OPTOUT_COLS, PHONE_COLS,
                          find_col, parse_birth)

BASE = Path(__file__).resolve().parent
OUT = BASE / "data" / "customers.xlsx"
HEADERS = ["고객명", "생년월일", "휴대폰", "마케팅동의만료", "수신거부"]


def read_rows(path):
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    it = ws.iter_rows(values_only=True)
    headers = [str(h).strip() if h is not None else "" for h in next(it)]
    cols = {k: find_col(headers, c) for k, c in
            (("name", NAME_COLS), ("birth", BIRTH_COLS), ("phone", PHONE_COLS),
             ("consent", CONSENT_COLS), ("optout", OPTOUT_COLS))}
    out = []
    for row in it:
        get = lambda k: row[cols[k]] if cols[k] is not None and cols[k] < len(row) else None
        if get("name"):
            out.append({k: get(k) for k in cols})
    wb.close()
    return out


def key(r):
    b = r["birth"]
    b = b.strftime("%Y-%m-%d") if hasattr(b, "strftime") else str(b or "").strip()
    return str(r["name"]).strip(), b


def main():
    if len(sys.argv) > 1:
        src = Path(sys.argv[1])
    else:
        found = sorted(BASE.parent.glob("*보유고객리스트*.xlsx"), key=lambda p: p.stat().st_mtime)
        if not found:
            sys.exit("보유고객리스트 엑셀을 찾지 못했습니다. 파일 경로를 직접 지정하세요.")
        src = found[-1]

    print(f"원본: {src}")
    src_rows = read_rows(src)

    keep = {}
    if OUT.exists():
        for r in read_rows(OUT):
            keep[key(r)] = r

    wb = Workbook()
    ws = wb.active
    ws.title = "고객명단"
    ws.append(HEADERS)
    for c in ws[1]:
        c.font = Font(bold=True)
        c.fill = PatternFill("solid", fgColor="DDEBF7")

    n = no_phone = 0
    for r in src_rows:
        if not parse_birth(r["birth"]):
            continue
        old = keep.get(key(r), {})
        phone = r["phone"] or old.get("phone")
        optout = old.get("optout")
        ws.append([r["name"], r["birth"], str(phone) if phone else None, r["consent"], optout])
        ws.cell(ws.max_row, 3).number_format = "@"   # 휴대폰은 텍스트(앞자리 0 유지)
        n += 1
        no_phone += 0 if phone else 1

    for col, w in zip("ABCDE", (14, 14, 16, 16, 10)):
        ws.column_dimensions[col].width = w
    ws.freeze_panes = "A2"

    OUT.parent.mkdir(exist_ok=True)
    wb.save(OUT)
    print(f"저장: {OUT}")
    print(f"생년월일 있는 고객 {n}명 (휴대폰 미입력 {no_phone}명)")
    if no_phone:
        print("→ 휴대폰 열을 채워야 해당 고객에게 문자가 발송됩니다.")


if __name__ == "__main__":
    main()

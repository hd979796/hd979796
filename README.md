# 고객 생일 축하 문자 자동 발송

매일 오전 10시, 고객 명단에서 **오늘 생일인 고객**을 찾아 [알리고](https://smartsms.aligo.in) 문자 API로 축하 문자를 보냅니다.

## 폴더 구성

| 파일 | 설명 |
|---|---|
| `.env` | **알리고 API 키 입력 위치** (GitHub에 올라가지 않음) |
| `message_template.txt` | 문자 내용. `{이름}` 자리에 고객명이 들어감 |
| `data/customers.xlsx` | 발송용 고객 명단 (GitHub에 올라가지 않음) |
| `make_customer_list.bat` | 영업포탈 보유고객리스트 → `data/customers.xlsx` 생성 |
| `check_aligo.bat` | 알리고 API 키 연결 확인 + 잔여 건수 조회 |
| `test_send.bat` | 발송 테스트: `TEST_CUSTOMER_FILE` 명단 전원에게 생일과 관계없이 발송 |
| `run_daily.bat` | 생일 문자 발송 실행 (예약 작업이 매일 실행) |
| `install_schedule.bat` | 매일 10:00 자동 실행 등록 (Windows 작업 스케줄러) |
| `uninstall_schedule.bat` | 자동 실행 해제 |
| `logs/` | 실행 로그(`birthday_sms.log`), 발송 기록(`sent_log.csv`) |

## 처음 설정

1. **Python 3.12** 설치 후 라이브러리 설치
   ```
   python -m pip install -r requirements.txt
   ```
2. **알리고 준비** (smartsms.aligo.in)
   - 발신번호 등록·인증
   - [문자API] → [신청/인증]에서 API Key 발급
   - **발송 서버 IP 등록**: 이 프로그램을 돌리는 PC의 공인 IP를 등록해야 발송됩니다
3. **`.env` 파일 입력** (`.env.example`을 복사해 `.env`로 만든 뒤 메모장으로 편집)
   ```
   ALIGO_API_KEY=발급받은키
   ALIGO_USER_ID=알리고아이디
   ALIGO_SENDER=등록한발신번호
   ALIGO_TEST_MODE=Y
   ```
4. `check_aligo.bat` 실행 → "알리고 연결 성공"이 나오면 OK
5. `make_customer_list.bat` 실행 → `data/customers.xlsx`의 **휴대폰 열 채우기**
6. `test_send.bat`으로 테스트 명단(`생일축하 문자 발송 테스트 문서.xlsx`)에 발송해 보기
   - `ALIGO_TEST_MODE=Y`면 알리고가 접수만 하고 실제 문자는 오지 않음 → 휴대폰으로 받아보려면 `N`
7. 테스트모드로 하루 돌려보고 `logs/birthday_sms.log` 확인 후, `.env`에서 `ALIGO_TEST_MODE=N`으로 바꾸면 실제 발송
8. `install_schedule.bat` 더블클릭 → 매일 10:00 자동 실행

## 고객 명단 (`data/customers.xlsx`)

| 고객명 | 생년월일 | 휴대폰 | 마케팅동의만료 | 수신거부 |
|---|---|---|---|---|
| 홍길동 | 1980-11-03 | 010-1234-5678 | 2027-06-30 | |

- 생년월일: `1980-11-03`, `19801103`, `801103` 모두 인식
- 수신거부 열에 아무 값(예: Y)이나 넣으면 발송 제외
- `REQUIRE_MARKETING_CONSENT=Y`(기본)이면 마케팅동의만료일이 지난 고객은 제외
- 새 보유고객리스트를 받아 `make_customer_list.bat`을 다시 실행해도 입력한 휴대폰·수신거부 값은 유지됨

## 동작 규칙

- 2월 29일생은 평년에 2월 28일 발송
- 같은 날 같은 번호로 두 번 보내지 않음 (`logs/sent_log.csv` 기준)
- 21시~08시에는 발송하지 않음 (PC가 꺼져 있었다면 켜진 뒤 실행)
- 문자 90바이트(한글 약 45자) 초과 시 장문(LMS)으로 발송

## GitHub Actions 매일 자동 발송 테스트 (08:00)

`.github/workflows/birthday-test.yml`이 매일 한국시간 08:00에 `TEST_RECIPIENTS` 명단 전원에게 문자를 보냅니다.

- 알리고는 **등록된 IP에서만** 발송을 허용하므로, GitHub 서버가 아니라 **사무실 PC에 설치한 self-hosted runner**(라벨 `aligo`)에서 실행됩니다.
  PC가 08:00에 꺼져 있으면 켜질 때 실행되고, 21시가 넘었으면 발송하지 않습니다.
- 저장소 Settings → Secrets and variables → Actions 에 등록할 값

  | 이름 | 값 |
  |---|---|
  | `ALIGO_API_KEY` | 알리고 API 키 |
  | `ALIGO_USER_ID` | 알리고 아이디 |
  | `ALIGO_SENDER` | 발신번호 |
  | `TEST_RECIPIENTS` | `홍길동:01012345678,김철수:01098765432` |
- Actions 실행 기록에는 이름·번호가 가려져서(`최*민 010-****-1945`) 표시됩니다.
- 수동 실행: Actions 탭 → "생일문자 자동발송 테스트" → Run workflow (Y = 테스트모드, N = 실제 발송)
- 발송 실패 시 워크플로가 실패로 표시되고 GitHub가 메일로 알려줍니다.
- 저장소에 60일간 변경이 없으면 GitHub가 예약 실행을 자동으로 멈춥니다(Actions 탭에서 다시 켜기).

## 직접 실행

```
python birthday_sms.py --dry-run                     # 오늘 대상자만 확인
python birthday_sms.py --date 2026-12-25 --dry-run   # 특정 날짜 대상자 확인
python birthday_sms.py --check                       # API 연결 확인
python birthday_sms.py                               # 발송
```

@echo off
rem Check Aligo API key and remaining balance
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"
set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if not exist "%PY%" set "PY=python"
"%PY%" birthday_sms.py --check
pause

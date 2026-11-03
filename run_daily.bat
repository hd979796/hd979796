@echo off
rem Birthday SMS - run by Windows Task Scheduler every day
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"
set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if not exist "%PY%" set "PY=python"
"%PY%" birthday_sms.py %*

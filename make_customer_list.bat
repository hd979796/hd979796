@echo off
rem Build data\customers.xlsx from the portal customer list
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"
set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if not exist "%PY%" set "PY=python"
"%PY%" make_customer_list.py %*
pause

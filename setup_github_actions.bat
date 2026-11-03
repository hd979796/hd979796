@echo off
rem One-time setup: GitHub Actions daily 08:00 birthday SMS test
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"
set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if not exist "%PY%" set "PY=python"
"%PY%" setup_github_actions.py
pause

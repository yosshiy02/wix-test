@echo off
setlocal

set PROJECT_ROOT=G:\GITHUB\wix-test\hd-origin-project
set WEB_DIR=G:\GITHUB\wix-test\hd-origin-project\web_receiver
set START_BAT=G:\GITHUB\wix-test\hd-origin-project\web_receiver\start_hd_origin.bat
set OLD_NODE_PID=%~1

echo ==============================
echo HD Origin Project Restart
echo ==============================
echo OLD_NODE_PID=%OLD_NODE_PID%
echo START_BAT=%START_BAT%
echo.

timeout /t 2 /nobreak >nul

if not "%OLD_NODE_PID%"=="" (
  taskkill /PID %OLD_NODE_PID% /T /F >nul 2>nul
)

timeout /t 1 /nobreak >nul

if not exist "%START_BAT%" (
  echo start_hd_origin.bat ‚ªŒ©‚Â‚©‚è‚Ü‚¹‚ñB
  echo %START_BAT%
  pause
  exit /b 1
)

cd /d "%WEB_DIR%"
start "HD Origin Project" "%START_BAT%"

exit /b 0

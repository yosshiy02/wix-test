@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

set "PROJECT_ROOT=%SCRIPT_DIR%"
set "WEB_DIR=%PROJECT_ROOT%\web_receiver"
set "START_BAT=%WEB_DIR%\start_hd_origin.bat"
set "PORT=3000"

set "OLD_NODE_PID=%~1"
set "OLD_CMD_PID=%~2"

title HD Origin Project Restart
echo ==============================
echo HD Origin Project Restart
echo ==============================
echo OLD_NODE_PID=%OLD_NODE_PID%
echo OLD_CMD_PID=%OLD_CMD_PID%
echo START_BAT=%START_BAT%
echo PORT=%PORT%
echo.

if defined OLD_NODE_PID (
  echo Stopping old Node process...
  taskkill /PID %OLD_NODE_PID% /T /F >nul 2>nul
)

if defined OLD_CMD_PID (
  echo Closing old launcher window...
  taskkill /PID %OLD_CMD_PID% /T /F >nul 2>nul
)

echo Waiting for port %PORT% to be released...
timeout /t 2 /nobreak >nul

if not exist "%START_BAT%" (
  echo start_hd_origin.bat ‚ªŒ©‚Â‚©‚è‚Ü‚¹‚ñB
  echo %START_BAT%
  pause
  exit /b 1
)

start "" cmd /k ""%START_BAT%""
exit /b 0

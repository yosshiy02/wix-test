@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "PROJECT_ROOT=%SCRIPT_DIR%"
set "WEB_DIR=%PROJECT_ROOT%\web_receiver"
set "START_BAT=%WEB_DIR%\start_hd_origin.bat"set "OLD_NODE_PID=%~1"
set "OLD_CMD_PID=%~2"
set "PORT=3000"

echo ==============================
echo HD Origin Project Restart
echo ==============================
echo OLD_NODE_PID=%OLD_NODE_PID%
echo OLD_CMD_PID=%OLD_CMD_PID%
echo START_BAT=%START_BAT%
echo PORT=%PORT%
echo.

if exist "%PROJECT_ROOT%\HD_ORIGIN_RESTARTING.flag" del "%PROJECT_ROOT%\HD_ORIGIN_RESTARTING.flag" >nul 2>nul

if not "%OLD_NODE_PID%"=="" (
  echo Stopping old Node process...
  taskkill /PID %OLD_NODE_PID% /T /F >nul 2>nul
)

if not "%OLD_CMD_PID%"=="" (
  echo Closing old launcher window...
  taskkill /PID %OLD_CMD_PID% /F >nul 2>nul
)

echo Waiting for port %PORT% to be released...
for /L %%i in (1,1,20) do (
  netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul
  if errorlevel 1 goto START_SERVER
  timeout /t 1 /nobreak >nul
)

:START_SERVER
if not exist "%START_BAT%" (
  echo start_hd_origin.bat Ç™å©Ç¬Ç©ÇËÇ‹ÇπÇÒÅB
  echo %START_BAT%
  pause
  exit /b 1
)

cd /d "%WEB_DIR%"
call "%START_BAT%"

exit /b 0


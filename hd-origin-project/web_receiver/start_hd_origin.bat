@echo off
setlocal

set "WEB_DIR=%~dp0"
if "%WEB_DIR:~-1%"=="\" set "WEB_DIR=%WEB_DIR:~0,-1%"

for %%I in ("%WEB_DIR%\..") do set "PROJECT_ROOT=%%~fI"
set "ENV_FILE=%PROJECT_ROOT%\.env"

set "PORT=3000"
set "NODE_EXE=node"
set "CHROME_EXE="

if exist "%ENV_FILE%" (
  for /f "usebackq tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
    if /I "%%A"=="PORT" set "PORT=%%B"
    if /I "%%A"=="NODE_PATH" set "NODE_EXE=%%B"
    if /I "%%A"=="CHROME_PATH" set "CHROME_EXE=%%B"
  )
)

echo.
echo HD Origin Project Launcher
echo.
echo WEB_DIR=%WEB_DIR%
echo PROJECT_ROOT=%PROJECT_ROOT%
echo PORT=%PORT%
echo NODE_EXE=%NODE_EXE%
echo.

cd /d "%WEB_DIR%"
if errorlevel 1 (
  echo Failed to move WEB_DIR.
  pause
  exit /b 1
)

echo Stopping old server on port %PORT%...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"

echo.
echo Starting server...
start "HD Origin Project Server" cmd /k "cd /d ""%WEB_DIR%"" && ""%NODE_EXE%"" server.js"

timeout /t 3 /nobreak >nul

set "URL=http://localhost:%PORT%"

echo.
echo Opening browser: %URL%
echo.

if defined CHROME_EXE (
  if exist "%CHROME_EXE%" (
    start "" "%CHROME_EXE%" "%URL%"
  ) else (
    start "" "%URL%"
  )
) else (
  start "" "%URL%"
)

echo.
echo Done.
echo.
exit /b 0
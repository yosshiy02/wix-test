@echo off
cd /d "%~dp0"

echo HD Origin Project .env initializer
echo.

where py >nul 2>nul
if %errorlevel%==0 (
    py -3 "%~dp0env_initializer.py"
    pause
    exit /b
)

where python >nul 2>nul
if %errorlevel%==0 (
    python "%~dp0env_initializer.py"
    pause
    exit /b
)

echo Python ?????????
echo Python???????????PATH??????????
pause

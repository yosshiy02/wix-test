@echo off
setlocal

set "WEB_DIR=%~dp0"
set "PROJECT_DIR=%~dp0.."
set "URL=http://localhost:3000"

cd /d "%PROJECT_DIR%"

echo.
echo ==============================
echo HD Origin Project Launcher
echo ==============================
echo.

if not exist "%PROJECT_DIR%\.env" (
    echo .env not found.
    echo Running env initializer...
    echo.

    if exist "%PROJECT_DIR%\run_env_initializer.bat" (
        call "%PROJECT_DIR%\run_env_initializer.bat"
    ) else (
        echo run_env_initializer.bat not found.
        pause
        exit /b 1
    )
) else (
    echo .env found.
)

if exist "%PROJECT_DIR%\.env" (
    for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%PROJECT_DIR%\.env") do (
        set "%%A=%%B"
    )
)

cd /d "%WEB_DIR%"

if not exist "%WEB_DIR%node_modules" (
    echo.
    echo node_modules not found.
    echo Running npm install...
    echo.

    npm install

    if errorlevel 1 (
        echo npm install failed.
        pause
        exit /b 1
    )
) else (
    echo node_modules found.
)

echo.
echo Starting server...
echo.

start "HD Origin Project Server" cmd /k "cd /d ""%WEB_DIR%"" && npm start"

timeout /t 3 /nobreak >nul

echo.
echo Opening browser...
echo.

if defined CHROME_PATH (
    if exist "%CHROME_PATH%" (
        start "" "%CHROME_PATH%" "%URL%"
        exit /b 0
    )
)

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%URL%"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%URL%"
) else (
    start "" "%URL%"
)

endlocal

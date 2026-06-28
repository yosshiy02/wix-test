@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

rem ==============================
rem HD Origin Project Launcher
rem Dynamic PC / Dynamic Drive version
rem ==============================

set "WEB_DIR=%~dp0"

for %%I in ("%WEB_DIR%..") do set "PROJECT_DIR=%%~fI"
for %%I in ("%PROJECT_DIR%") do set "PROJECT_DRIVE=%%~dI"

set "ENV_FILE=%PROJECT_DIR%\.env"
set "ENV_INIT=%PROJECT_DIR%\env_initializer.py"
set "URL=http://localhost:3000"

echo.
echo ==============================
echo HD Origin Project Launcher
echo ==============================
echo.
echo PROJECT_DIR:
echo %PROJECT_DIR%
echo.
echo WEB_DIR:
echo %WEB_DIR%
echo.

rem --------------------------------------------------
rem 1. Python を動的に探す
rem --------------------------------------------------

set "PYTHON_EXE="

for %%P in (
    "%PROJECT_DRIVE%\Apps\Python312\python.exe"
    "%PROJECT_DRIVE%\Apps\Python311\python.exe"
    "%PROJECT_DRIVE%\Apps\Python310\python.exe"
    "%PROJECT_DRIVE%\Apps\Python\python.exe"
    "%PROJECT_DRIVE%\Python312\python.exe"
    "%PROJECT_DRIVE%\Python311\python.exe"
    "%LocalAppData%\Programs\Python\Python312\python.exe"
    "%LocalAppData%\Programs\Python\Python311\python.exe"
    "%ProgramFiles%\Python312\python.exe"
    "%ProgramFiles%\Python311\python.exe"
) do (
    if exist %%~P (
        set "PYTHON_EXE=%%~P"
        goto :FOUND_PYTHON
    )
)

where py >nul 2>nul
if %errorlevel%==0 (
    set "PYTHON_EXE=py -3"
    goto :FOUND_PYTHON
)

where python >nul 2>nul
if %errorlevel%==0 (
    set "PYTHON_EXE=python"
    goto :FOUND_PYTHON
)

echo Python が見つかりません。
echo G:\Apps\Python312\python.exe などに Python を入れてください。
pause
exit /b 1

:FOUND_PYTHON
echo Python:
echo %PYTHON_EXE%
echo.

rem --------------------------------------------------
rem 2. .env は毎回作り直す
rem    PCが変わるため、NODE_PATH / PG_BIN_PATH を固定しない
rem --------------------------------------------------

if exist "%ENV_INIT%" (
    echo Running env initializer...
    echo.
    cd /d "%PROJECT_DIR%"
    %PYTHON_EXE% "%ENV_INIT%"

    if errorlevel 1 (
        echo.
        echo env_initializer.py failed.
        pause
        exit /b 1
    )
) else (
    echo env_initializer.py が見つかりません。
    echo %ENV_INIT%
    pause
    exit /b 1
)

if not exist "%ENV_FILE%" (
    echo .env が作成されていません。
    echo %ENV_FILE%
    pause
    exit /b 1
)

rem --------------------------------------------------
rem 3. .env 読み込み
rem --------------------------------------------------

for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
    set "%%A=%%B"
)

echo.
echo .env loaded.
echo NODE_PATH:
echo %NODE_PATH%
echo.
echo PG_BIN_PATH:
echo %PG_BIN_PATH%
echo.

rem --------------------------------------------------
rem 4. Node / npm を .env から決定
rem --------------------------------------------------

set "NODE_EXE="

if defined NODE_PATH (
    if exist "%NODE_PATH%" (
        set "NODE_EXE=%NODE_PATH%"
    )
)

if not defined NODE_EXE (
    for %%N in (
        "%PROJECT_DRIVE%\Apps\NodeJS\node.exe"
        "%PROJECT_DRIVE%\Apps\nodejs\node.exe"
        "%ProgramFiles%\nodejs\node.exe"
        "%ProgramFiles(x86)%\nodejs\node.exe"
    ) do (
        if exist %%~N (
            set "NODE_EXE=%%~N"
            goto :FOUND_NODE
        )
    )
)

where node >nul 2>nul
if not defined NODE_EXE (
    if %errorlevel%==0 (
        for /f "delims=" %%N in ('where node') do (
            set "NODE_EXE=%%N"
            goto :FOUND_NODE
        )
    )
)

:FOUND_NODE

if not defined NODE_EXE (
    echo node.exe が見つかりません。
    echo Node.js を入れてください。
    pause
    exit /b 1
)

for %%I in ("%NODE_EXE%") do set "NODE_DIR=%%~dpI"

set "NPM_CMD=%NODE_DIR%npm.cmd"

if not exist "%NPM_CMD%" (
    where npm >nul 2>nul
    if %errorlevel%==0 (
        for /f "delims=" %%N in ('where npm') do (
            set "NPM_CMD=%%N"
            goto :FOUND_NPM
        )
    )
)

:FOUND_NPM

if not exist "%NPM_CMD%" (
    echo npm.cmd が見つかりません。
    echo NODE_DIR:
    echo %NODE_DIR%
    pause
    exit /b 1
)

echo.
echo Node:
echo %NODE_EXE%
echo.
echo npm:
echo %NPM_CMD%
echo.

rem --------------------------------------------------
rem 5. node_modules 確認
rem --------------------------------------------------

cd /d "%WEB_DIR%"

if not exist "%WEB_DIR%package.json" (
    echo package.json が見つかりません。
    echo %WEB_DIR%package.json
    pause
    exit /b 1
)

if not exist "%WEB_DIR%node_modules" (
    echo.
    echo node_modules not found.
    echo Running npm install...
    echo.

    call "%NPM_CMD%" install

    if errorlevel 1 (
        echo npm install failed.
        pause
        exit /b 1
    )
) else (
    echo node_modules found.
)

rem --------------------------------------------------
rem 6. サーバー起動
rem --------------------------------------------------

echo.
echo Starting server...
echo.

start "HD Origin Project Server" cmd /k "cd /d ""%WEB_DIR%"" && ""%NPM_CMD%"" start"

timeout /t 3 /nobreak >nul

rem --------------------------------------------------
rem 7. ブラウザ起動
rem --------------------------------------------------

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
exit /b 0

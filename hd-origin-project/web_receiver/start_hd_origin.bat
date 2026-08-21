@echo off
chcp 932 >nul
setlocal EnableExtensions EnableDelayedExpansion

title HD Origin Project Launcher

echo.
echo ==============================
echo HD Origin Project Launcher
echo ==============================
echo.

rem --------------------------------
rem 0. Resolve PC first
rem --------------------------------
set "COMPUTER_NAME=%COMPUTERNAME%"
set "USER_NAME=%USERNAME%"

rem --------------------------------
rem 1. Temporary project paths
rem --------------------------------
set "TEMP_WEB_DIR=%~dp0"
set "TEMP_WEB_DIR=%TEMP_WEB_DIR:~0,-1%"

for %%I in ("%TEMP_WEB_DIR%\..") do set "TEMP_PROJECT_ROOT=%%~fI"
for %%I in ("%TEMP_PROJECT_ROOT%") do set "TEMP_PROJECT_DRIVE=%%~dI"

set "PC_RULES_FILE=%TEMP_PROJECT_ROOT%\HD_ORIGIN_PC_RULES.txt"
set "RUNTIME_PATHS_FILE=%TEMP_PROJECT_ROOT%\HD_ORIGIN_RUNTIME_PATHS.txt"
rem HD_ORIGIN_STARTUP_GIT_SYNC_20260715_START
rem GitHubのソースを全PCで一致させてから通常起動する。
rem 同期後は最新のstart_hd_origin.batを読み直すため一度だけ再実行する。
if not defined HD_ORIGIN_STARTUP_GIT_SYNC_DONE (
    echo.
    echo ============================================================
    echo HD Origin Project GitHub source synchronization
    echo ============================================================
    echo PROJECT_ROOT = !TEMP_PROJECT_ROOT!
    echo.

    where git >nul 2>nul

    if errorlevel 1 (
        echo ERROR: git command was not found.
        echo GitHub source synchronization was cancelled.
        echo.
        pause
        exit /b 1
    )

    git -C "!TEMP_PROJECT_ROOT!" rev-parse --is-inside-work-tree >nul 2>nul

    if errorlevel 1 (
        echo ERROR: PROJECT_ROOT is not a Git repository.
        echo !TEMP_PROJECT_ROOT!
        echo.
        pause
        exit /b 1
    )

    set "HD_ORIGIN_GIT_BRANCH="

    for /f "delims=" %%B in ('git -C "!TEMP_PROJECT_ROOT!" branch --show-current') do (
        set "HD_ORIGIN_GIT_BRANCH=%%B"
    )

    if not defined HD_ORIGIN_GIT_BRANCH (
        echo ERROR: Current Git branch could not be resolved.
        echo.
        pause
        exit /b 1
    )

    echo BRANCH = !HD_ORIGIN_GIT_BRANCH!
    echo Fetching GitHub...
    echo.

    git -C "!TEMP_PROJECT_ROOT!" fetch origin

    if errorlevel 1 (
        echo ERROR: git fetch failed.
        echo Startup was cancelled to prevent PC state divergence.
        echo.
        pause
        exit /b 1
    )

    echo Pulling latest source from GitHub...
    echo.

    git -C "!TEMP_PROJECT_ROOT!" pull --rebase --autostash origin "!HD_ORIGIN_GIT_BRANCH!"

    if errorlevel 1 (
        git -C "!TEMP_PROJECT_ROOT!" rebase --abort >nul 2>nul
        echo ERROR: git pull --rebase failed.
        echo Startup was cancelled to prevent PC state divergence.
        echo.
        pause
        exit /b 1
    )

    echo Publishing existing local commits...
    echo.

    git -C "!TEMP_PROJECT_ROOT!" push -u origin "!HD_ORIGIN_GIT_BRANCH!"

    if errorlevel 1 (
        echo ERROR: git push failed.
        echo Startup was cancelled to prevent PC state divergence.
        echo.
        pause
        exit /b 1
    )

    git -C "!TEMP_PROJECT_ROOT!" fetch origin

    if errorlevel 1 (
        echo ERROR: Final git fetch failed.
        echo.
        pause
        exit /b 1
    )

    set "HD_ORIGIN_REMOTE_ONLY="
    set "HD_ORIGIN_LOCAL_ONLY="

    for /f "tokens=1,2" %%A in ('git -C "!TEMP_PROJECT_ROOT!" rev-list --left-right --count "origin/!HD_ORIGIN_GIT_BRANCH!...!HD_ORIGIN_GIT_BRANCH!"') do (
        set "HD_ORIGIN_REMOTE_ONLY=%%A"
        set "HD_ORIGIN_LOCAL_ONLY=%%B"
    )

    if not "!HD_ORIGIN_REMOTE_ONLY!"=="0" (
        echo ERROR: GitHub has commits that are not present locally.
        echo REMOTE_ONLY=!HD_ORIGIN_REMOTE_ONLY!
        echo LOCAL_ONLY=!HD_ORIGIN_LOCAL_ONLY!
        echo.
        pause
        exit /b 1
    )

    if not "!HD_ORIGIN_LOCAL_ONLY!"=="0" (
        echo ERROR: Local commits have not been published.
        echo REMOTE_ONLY=!HD_ORIGIN_REMOTE_ONLY!
        echo LOCAL_ONLY=!HD_ORIGIN_LOCAL_ONLY!
        echo.
        pause
        exit /b 1
    )

    echo GitHub source synchronization completed.
    echo REMOTE_ONLY=0
    echo LOCAL_ONLY=0
    echo.

    set "HD_ORIGIN_STARTUP_GIT_SYNC_DONE=1"

    echo Reloading the synchronized launcher...
    echo.

    call "%~f0"

    set "HD_ORIGIN_STARTUP_RELAUNCH_EXIT=!ERRORLEVEL!"
    exit /b !HD_ORIGIN_STARTUP_RELAUNCH_EXIT!
)
rem HD_ORIGIN_STARTUP_GIT_SYNC_20260715_END

rem --------------------------------
rem 1-1. Select launch mode
rem --------------------------------
set "HD_ORIGIN_LAUNCH_MODE="
set "HD_ORIGIN_SERVER_MODE="

:HD_ORIGIN_SELECT_LAUNCH_MODE
echo.
echo ============================================================
echo HD Origin Project 起動モード
echo ============================================================
echo [1] 通常起動しますか？
echo [2] サーバー起動しますか？
echo.
set "HD_ORIGIN_LAUNCH_CHOICE="
set /p "HD_ORIGIN_LAUNCH_CHOICE=選択してください [1-2]: "

if "%HD_ORIGIN_LAUNCH_CHOICE%"=="1" (
    set "HD_ORIGIN_LAUNCH_MODE=NORMAL"
    goto HD_ORIGIN_LAUNCH_MODE_SELECTED
)

if "%HD_ORIGIN_LAUNCH_CHOICE%"=="2" (
    set "HD_ORIGIN_LAUNCH_MODE=SERVER"
    goto HD_ORIGIN_LAUNCH_MODE_SELECTED
)

echo.
echo ERROR: 1 または 2 を入力してください。
goto HD_ORIGIN_SELECT_LAUNCH_MODE

:HD_ORIGIN_LAUNCH_MODE_SELECTED
echo.
echo HD_ORIGIN_LAUNCH_MODE = %HD_ORIGIN_LAUNCH_MODE%
if defined HD_ORIGIN_SERVER_MODE echo HD_ORIGIN_SERVER_MODE = %HD_ORIGIN_SERVER_MODE%
echo.

echo COMPUTER_NAME = %COMPUTER_NAME%
echo USER_NAME     = %USER_NAME%
echo PC_RULES_FILE = %PC_RULES_FILE%
echo.

rem --------------------------------
rem 2. Read PC rules into temporary data before writing paths
rem --------------------------------
set "TEMP_EXCLUDE_DROPBOX_ROOTS=|"
call :ENSURE_PC_RULE_SECTION
call :LOAD_PC_RULES

echo Loaded PC rule exclude list:
echo(!TEMP_EXCLUDE_DROPBOX_ROOTS!
echo.

rem --------------------------------
rem 3. Default runtime config
rem --------------------------------
set "PORT=3000"
set "APP_NAME=HD Origin Project"

if /I "%HD_ORIGIN_LAUNCH_MODE%"=="NORMAL" (
    set "DB_HOST=10.250.0.1"
) else (
    set "DB_HOST=127.0.0.1"
)
set "DB_PORT=5432"
set "DB_NAME=hd_origin_project"
set "DB_USER=postgres"

set "VPN_DDNS_HOST=vpn393944390.softether.net"
set "VPN_PORT=443"
set "VPN_HUB=DEFAULT"
set "VPN_USER=hdorigin_vpn01"
set "VPN_ACCOUNT=HDORIGIN_REMOTE_TEST"
set "VPN_SERVER_IP=10.250.0.1"
set "VPN_CLIENT_IP="
set "VPNCMD_PATH="
set "VPN_SERVER_CERT_PATH="

set "BACKUP_KEEP_NORMAL=10"
set "BACKUP_KEEP_BEFORE_RESTORE=3"
set "PROJECT_BACKUP_KEEP=5"

set "OPENAI_MODEL=gpt-4.1-mini"

rem --------------------------------
rem 4. Find Dropbox after PC rules
rem --------------------------------
set "DROPBOX_DRIVE="
set "DROPBOX_ROOT="
set "DROPBOX_PATH="
set "HDDBTEST_ROOT="
set "HD_ORIGIN_ENV_PATH="

echo Searching drive-root Dropbox that contains HDDBTEST project env...
echo.

for %%D in (A B C D E F G H I J K L M N O P Q R S T U V W X Y Z) do (
    if exist "%%D:\" (
        for /d %%P in ("%%D:\*") do (
            if /I "%%~nxP"=="Dropbox" (
                call :IS_DROPBOX_EXCLUDED "%%~fP"

                if defined IS_DROPBOX_EXCLUDED (
                    echo Skipped by PC rule: %%~fP
                ) else (
                    call :TRY_DROPBOX_ROOT "%%~fP"
                    if defined HDDBTEST_ROOT goto :DROPBOX_TARGET_FOUND
                )
            )
        )
    )
)

:DROPBOX_TARGET_FOUND

if not defined HDDBTEST_ROOT (
    echo ERROR: Valid Dropbox was not found.
    echo Required:
    echo Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\.env
    echo.
    pause
    exit /b 1
)

set "HD_ORIGIN_ENV_PATH=%HDDBTEST_ROOT%\HDDB_PROJECT\ORIGIN\.env"

set "VPN_SERVER_CERT_PATH=%HDDBTEST_ROOT%\HDDB_PROJECT\ORIGIN\VPN\HDORIGIN-VPN-Server-Public.cer"
set "VPN_IP_REGISTRY_PATH=%HDDBTEST_ROOT%\HDDB_PROJECT\ORIGIN\VPN\HD_ORIGIN_VPN_CLIENT_IPS.txt"

if exist "%TEMP_PROJECT_DRIVE%\SoftEther VPN Client\vpncmd.exe" set "VPNCMD_PATH=%TEMP_PROJECT_DRIVE%\SoftEther VPN Client\vpncmd.exe"
if not defined VPNCMD_PATH if exist "C:\Program Files\SoftEther VPN Client\vpncmd.exe" set "VPNCMD_PATH=C:\Program Files\SoftEther VPN Client\vpncmd.exe"
if not defined VPNCMD_PATH if exist "C:\Program Files (x86)\SoftEther VPN Client\vpncmd.exe" set "VPNCMD_PATH=C:\Program Files (x86)\SoftEther VPN Client\vpncmd.exe"
set "DROPBOX_PATH=%DROPBOX_ROOT%"

if /I "%HD_ORIGIN_LAUNCH_MODE%"=="NORMAL" (
    call :RESOLVE_NORMAL_VPN_CLIENT_IP
    if errorlevel 1 (
        echo ERROR: VPN_CLIENT_IP could not be resolved from PC rules.
        exit /b 1
    )
)

rem --------------------------------
rem 5. Finalize project paths
rem --------------------------------
set "PROJECT_ROOT=%TEMP_PROJECT_ROOT%"
set "PROJECT_DIR=%TEMP_PROJECT_ROOT%"
set "WEB_DIR=%TEMP_WEB_DIR%"
set "PROJECT_DRIVE=%TEMP_PROJECT_DRIVE%"

rem --------------------------------
rem 6. Find tools dynamically
rem --------------------------------
set "NODE_PATH="
set "NPM_PATH="
set "PG_BIN_PATH="
set "CHROME_PATH="

call :FIND_NODE_PATH
call :FIND_NPM_PATH
call :FIND_PG_BIN_PATH
call :FIND_CHROME_PATH

call :RESOLVE_BACKUP_DIR
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%" >nul 2>nul

rem --------------------------------
rem 7. Show resolved paths
rem --------------------------------
echo.
echo COMPUTER_NAME      = %COMPUTER_NAME%
echo USER_NAME          = %USER_NAME%
echo PROJECT_ROOT       = %PROJECT_ROOT%
echo WEB_DIR            = %WEB_DIR%
echo PROJECT_DRIVE      = %PROJECT_DRIVE%
echo.
echo DROPBOX_DRIVE      = %DROPBOX_DRIVE%
echo DROPBOX_ROOT       = %DROPBOX_ROOT%
echo HDDBTEST_ROOT      = %HDDBTEST_ROOT%
echo HD_ORIGIN_ENV_PATH = %HD_ORIGIN_ENV_PATH%
echo.
echo NODE_PATH          = %NODE_PATH%
echo NPM_PATH           = %NPM_PATH%
echo PG_BIN_PATH        = %PG_BIN_PATH%
echo CHROME_PATH        = %CHROME_PATH%
echo BACKUP_DIR         = %BACKUP_DIR%
echo.

rem --------------------------------
rem 8. Write runtime path information after rules and resolution
rem --------------------------------
call :WRITE_RUNTIME_PATHS

if errorlevel 1 (
    echo ERROR: Failed to write runtime paths file.
    echo %RUNTIME_PATHS_FILE%
    echo.
    pause
    exit /b 1
)

echo Runtime paths file was written.
echo %RUNTIME_PATHS_FILE%
echo.

rem --------------------------------
rem 9. Run env initializer after runtime paths were resolved
rem --------------------------------
echo Running env_initializer.py...
echo.

set "HD_ORIGIN_ENV_PATH=%HD_ORIGIN_ENV_PATH%"

python "%PROJECT_ROOT%\env_initializer.py"

if errorlevel 1 (
    echo ERROR: env_initializer.py failed.
    echo.
    pause
    exit /b 1
)

echo env_initializer.py completed.
echo.

rem --------------------------------
rem 10. Reload runtime path information as environment variables
rem --------------------------------
echo Reloading runtime paths...
call :LOAD_RUNTIME_PATHS

if errorlevel 1 (
    echo ERROR: Failed to reload runtime paths.
    echo.
    pause
    exit /b 1
)

echo Runtime paths reloaded.
echo.

echo ACTIVE CONFIG
echo PROJECT_ROOT       = %PROJECT_ROOT%
echo WEB_DIR            = %WEB_DIR%
echo PORT               = %PORT%
echo DB_HOST            = %DB_HOST%
echo DB_PORT            = %DB_PORT%
echo DB_NAME            = %DB_NAME%
echo DB_USER            = %DB_USER%
echo NODE_PATH          = %NODE_PATH%
echo NPM_PATH           = %NPM_PATH%
echo PG_BIN_PATH        = %PG_BIN_PATH%
echo BACKUP_DIR         = %BACKUP_DIR%
echo HD_ORIGIN_ENV_PATH = %HD_ORIGIN_ENV_PATH%
echo.

rem --------------------------------
rem 11. Load secret .env values as environment variables
rem --------------------------------
echo Loading secret .env...
call :LOAD_SECRET_ENV

if errorlevel 1 (
    echo ERROR: Failed to load secret .env.
    echo.
    pause
    exit /b 1
)

echo Secret .env loaded.
echo.

if /I not "%HD_ORIGIN_LAUNCH_MODE%"=="SERVER" goto HD_ORIGIN_SERVER_MODE_DONE

if not defined DB_PASSWORD (
    echo ERROR: DB_PASSWORD was not found in .env.
    echo.
    pause
    exit /b 1
)

powershell -NoProfile -Command "$p = Read-Host '?T?[?o?[?N???p?X???[?h' -AsSecureString; $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($p); try { $v = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b); if ($v -ceq $env:DB_PASSWORD) { exit 0 } else { exit 1 } } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }"

if errorlevel 1 (
    echo.
    echo ERROR: ?p?X???[?h????????B
    echo.
    pause
    exit /b 1
)

:HD_ORIGIN_SELECT_SERVER_MODE
echo.
echo ============================================================
echo ?T?[?o?[?N?????[?h
echo ============================================================
echo [1] ?T?[?o?[???[?h
echo [2] ?T?[?o?[?????z???N??
echo.
set "HD_ORIGIN_SERVER_CHOICE="
set /p "HD_ORIGIN_SERVER_CHOICE=?I???????????? [1-2]: "

if "%HD_ORIGIN_SERVER_CHOICE%"=="1" (
    set "HD_ORIGIN_SERVER_MODE=SERVER"
    goto HD_ORIGIN_SERVER_MODE_DONE
)

if "%HD_ORIGIN_SERVER_CHOICE%"=="2" (
    set "HD_ORIGIN_SERVER_MODE=MIGRATION"
    goto HD_ORIGIN_SERVER_MODE_DONE
)

echo.
echo ERROR: 1 ????? 2 ????????????????B
goto HD_ORIGIN_SELECT_SERVER_MODE

:HD_ORIGIN_SERVER_MODE_DONE

rem --------------------------------
rem 12. Start Node server
rem --------------------------------
cd /d "%WEB_DIR%"


rem PROJECT_STATUS_AUTOGEN_START
echo Writing PROJECT_STATUS_FOR_GPT.txt...
echo.

if defined NODE_PATH (
    "%NODE_PATH%" -e "require('./src/projectStatus').writeProjectStatus('start_hd_origin.bat startup regeneration')"
) else (
    node -e "require('./src/projectStatus').writeProjectStatus('start_hd_origin.bat startup regeneration')"
)

if errorlevel 1 (
    echo WARNING: PROJECT_STATUS_FOR_GPT.txt generation failed.
    echo.
) else (
    echo PROJECT_STATUS_FOR_GPT.txt was regenerated.
    echo %PROJECT_ROOT%\PROJECT_STATUS_FOR_GPT.txt
    echo Opening memo window...
    start "" notepad "%PROJECT_ROOT%\PROJECT_STATUS_FOR_GPT.txt"
    echo.
)
rem PROJECT_STATUS_AUTOGEN_END


if not exist "%WEB_DIR%\package.json" (
    echo ERROR: package.json was not found.
    echo %WEB_DIR%\package.json
    echo.
    pause
    exit /b 1
)

if not exist "%WEB_DIR%\node_modules" (
    echo node_modules was not found.
    echo Running npm install...
    echo.

    if defined NPM_PATH (
        call "%NPM_PATH%" install
    ) else (
        call npm install
    )

    if errorlevel 1 (
        echo ERROR: npm install failed.
        echo.
        pause
        exit /b 1
    )
)

if /I "%HD_ORIGIN_LAUNCH_MODE%"=="NORMAL" (
    call :ENSURE_NORMAL_VPN_DB
    if errorlevel 1 (
        echo.
        echo ERROR: NORMAL mode could not reach PostgreSQL through VPN.
        echo DB_HOST=%DB_HOST%
        echo DB_PORT=%DB_PORT%
        echo.
        exit /b 1
    )
)

echo Starting server.js...
echo URL: http://localhost:%PORT%
echo.

rem Project screen is opened by server.js after backup restore confirmation.
echo Project screen will open after backup restore confirmation.
echo.rem ==============================
rem HD Origin server loop
rem exit code 100 = restart in same window
rem ==============================
:HD_ORIGIN_SERVER_LOOP
if defined NODE_PATH (
    "%NODE_PATH%" server.js
) else (
    node server.js
)
set "HD_ORIGIN_EXIT_CODE=%ERRORLEVEL%"
if "%HD_ORIGIN_EXIT_CODE%"=="100" (
    echo.
    echo Restart requested. Restarting server in the same window...
    echo.
    goto HD_ORIGIN_SERVER_LOOP
)

echo.
echo Server stopped.

if exist "%PROJECT_ROOT%\HD_ORIGIN_RESTARTING.flag" (
    del "%PROJECT_ROOT%\HD_ORIGIN_RESTARTING.flag" >nul 2>nul
    exit /b 0
)
pause
exit /b 0






:RESOLVE_BACKUP_DIR
set "BACKUP_DIR="

if defined HD_ORIGIN_ENV_PATH (
    for %%I in ("%HD_ORIGIN_ENV_PATH%") do set "BACKUP_DIR=%%~dpIBackup"
)

if not defined BACKUP_DIR if defined HDDBTEST_ROOT (
    set "BACKUP_DIR=%HDDBTEST_ROOT%\HDDB_PROJECT\ORIGIN\Backup"
)

if not defined BACKUP_DIR (
    set "BACKUP_DIR=%PROJECT_ROOT%\backup"
)

exit /b 0
:WRITE_RUNTIME_PATHS
> "%RUNTIME_PATHS_FILE%" echo COMPUTER_NAME=!COMPUTER_NAME!
>> "%RUNTIME_PATHS_FILE%" echo USER_NAME=!USER_NAME!
>> "%RUNTIME_PATHS_FILE%" echo PROJECT_ROOT=!PROJECT_ROOT!
>> "%RUNTIME_PATHS_FILE%" echo PROJECT_DIR=!PROJECT_DIR!
>> "%RUNTIME_PATHS_FILE%" echo WEB_DIR=!WEB_DIR!
>> "%RUNTIME_PATHS_FILE%" echo PROJECT_DRIVE=!PROJECT_DRIVE!
>> "%RUNTIME_PATHS_FILE%" echo RUNTIME_PATHS_FILE=!RUNTIME_PATHS_FILE!
>> "%RUNTIME_PATHS_FILE%" echo PC_RULES_FILE=!PC_RULES_FILE!
>> "%RUNTIME_PATHS_FILE%" echo DROPBOX_DRIVE=!DROPBOX_DRIVE!
>> "%RUNTIME_PATHS_FILE%" echo DROPBOX_ROOT=!DROPBOX_ROOT!
>> "%RUNTIME_PATHS_FILE%" echo DROPBOX_PATH=!DROPBOX_PATH!
>> "%RUNTIME_PATHS_FILE%" echo HDDBTEST_ROOT=!HDDBTEST_ROOT!
>> "%RUNTIME_PATHS_FILE%" echo HD_ORIGIN_ENV_PATH=!HD_ORIGIN_ENV_PATH!
>> "%RUNTIME_PATHS_FILE%" echo PORT=!PORT!
>> "%RUNTIME_PATHS_FILE%" echo APP_NAME=!APP_NAME!
>> "%RUNTIME_PATHS_FILE%" echo HD_ORIGIN_LAUNCH_MODE=!HD_ORIGIN_LAUNCH_MODE!
>> "%RUNTIME_PATHS_FILE%" echo HD_ORIGIN_SERVER_MODE=!HD_ORIGIN_SERVER_MODE!
>> "%RUNTIME_PATHS_FILE%" echo DB_HOST=!DB_HOST!
>> "%RUNTIME_PATHS_FILE%" echo DB_PORT=!DB_PORT!
>> "%RUNTIME_PATHS_FILE%" echo DB_NAME=!DB_NAME!
>> "%RUNTIME_PATHS_FILE%" echo DB_USER=!DB_USER!
>> "%RUNTIME_PATHS_FILE%" echo VPN_DDNS_HOST=!VPN_DDNS_HOST!
>> "%RUNTIME_PATHS_FILE%" echo VPN_PORT=!VPN_PORT!
>> "%RUNTIME_PATHS_FILE%" echo VPN_HUB=!VPN_HUB!
>> "%RUNTIME_PATHS_FILE%" echo VPN_USER=!VPN_USER!
>> "%RUNTIME_PATHS_FILE%" echo VPN_ACCOUNT=!VPN_ACCOUNT!
>> "%RUNTIME_PATHS_FILE%" echo VPN_SERVER_IP=!VPN_SERVER_IP!
>> "%RUNTIME_PATHS_FILE%" echo VPN_CLIENT_IP=!VPN_CLIENT_IP!
>> "%RUNTIME_PATHS_FILE%" echo VPNCMD_PATH=!VPNCMD_PATH!
>> "%RUNTIME_PATHS_FILE%" echo VPN_SERVER_CERT_PATH=!VPN_SERVER_CERT_PATH!
>> "%RUNTIME_PATHS_FILE%" echo PG_BIN_PATH=!PG_BIN_PATH!
>> "%RUNTIME_PATHS_FILE%" echo BACKUP_DIR=!BACKUP_DIR!
>> "%RUNTIME_PATHS_FILE%" echo BACKUP_KEEP_NORMAL=!BACKUP_KEEP_NORMAL!
>> "%RUNTIME_PATHS_FILE%" echo BACKUP_KEEP_BEFORE_RESTORE=!BACKUP_KEEP_BEFORE_RESTORE!
>> "%RUNTIME_PATHS_FILE%" echo PROJECT_BACKUP_KEEP=!PROJECT_BACKUP_KEEP!
>> "%RUNTIME_PATHS_FILE%" echo NODE_PATH=!NODE_PATH!
>> "%RUNTIME_PATHS_FILE%" echo NPM_PATH=!NPM_PATH!
>> "%RUNTIME_PATHS_FILE%" echo CHROME_PATH=!CHROME_PATH!
>> "%RUNTIME_PATHS_FILE%" echo OPENAI_MODEL=!OPENAI_MODEL!
exit /b 0
:LOAD_SECRET_ENV
if not exist "%HD_ORIGIN_ENV_PATH%" (
    echo ERROR: Secret .env was not found.
    echo %HD_ORIGIN_ENV_PATH%
    exit /b 1
)

for /f "usebackq tokens=1,* delims==" %%A in ("%HD_ORIGIN_ENV_PATH%") do (
    set "SECRET_KEY=%%A"
    set "SECRET_VALUE=%%B"

    if not "!SECRET_KEY!"=="" (
        if not "!SECRET_KEY:~0,1!"=="#" (
            set "!SECRET_KEY!=!SECRET_VALUE!"
        )
    )
)

exit /b 0
:LOAD_RUNTIME_PATHS
if not exist "%RUNTIME_PATHS_FILE%" (
    echo ERROR: Runtime paths file was not found.
    echo %RUNTIME_PATHS_FILE%
    exit /b 1
)

for /f "usebackq tokens=1,* delims==" %%A in ("%RUNTIME_PATHS_FILE%") do (
    set "RUNTIME_KEY=%%A"
    set "RUNTIME_VALUE=%%B"

    if not "!RUNTIME_KEY!"=="" (
        if not "!RUNTIME_KEY:~0,1!"=="#" (
            set "!RUNTIME_KEY!=!RUNTIME_VALUE!"
        )
    )
)

exit /b 0
:ENSURE_PC_RULE_SECTION
if not exist "%PC_RULES_FILE%" (
    echo # HD Origin Project PC Rules>"%PC_RULES_FILE%"
    echo # This file is read before Dropbox path resolution.>>"%PC_RULES_FILE%"
)

findstr /I /C:"[%COMPUTER_NAME%]" "%PC_RULES_FILE%" >nul 2>nul
if errorlevel 1 (
    echo.>>"%PC_RULES_FILE%"
    echo [%COMPUTER_NAME%]>>"%PC_RULES_FILE%"
    echo # New PC. Add rules here if needed.>>"%PC_RULES_FILE%"
)

exit /b 0


:LOAD_PC_RULES
set "TEMP_EXCLUDE_DROPBOX_ROOTS=|"
set "TEMP_IN_PC_RULE="
set "TEMP_PC_RULE_VPN_CLIENT_IP="
set "TEMP_PC_RULE_VPN_CLIENT_IP_CONFLICT="

for /f "usebackq tokens=* delims=" %%L in ("%PC_RULES_FILE%") do (
    set "TEMP_LINE=%%L"

    if not "!TEMP_LINE!"=="" (
        if "!TEMP_LINE:~0,1!"=="[" (
            set "TEMP_IN_PC_RULE="
            if /I "!TEMP_LINE!"=="[%COMPUTER_NAME%]" set "TEMP_IN_PC_RULE=1"
        ) else (
            if defined TEMP_IN_PC_RULE (
                if not "!TEMP_LINE:~0,1!"=="#" (
                    for /f "tokens=1,* delims==" %%A in ("!TEMP_LINE!") do (
                        if /I "%%A"=="EXCLUDE_DROPBOX_ROOT" (
                            set "TEMP_RULE_DROPBOX=%%B"
                            call :NORMALIZE_PATH_VAR TEMP_RULE_DROPBOX TEMP_RULE_DROPBOX_NORMAL
                            set "TEMP_EXCLUDE_DROPBOX_ROOTS=!TEMP_EXCLUDE_DROPBOX_ROOTS!!TEMP_RULE_DROPBOX_NORMAL!|"
                        )
                        if /I "%%A"=="VPN_CLIENT_IP" (
                            if defined TEMP_PC_RULE_VPN_CLIENT_IP (
                                if /I not "!TEMP_PC_RULE_VPN_CLIENT_IP!"=="%%B" set "TEMP_PC_RULE_VPN_CLIENT_IP_CONFLICT=1"
                            ) else (
                                set "TEMP_PC_RULE_VPN_CLIENT_IP=%%B"
                            )
                        )
                    )
                )
            )
        )
    )
)

exit /b 0
:IS_DROPBOX_EXCLUDED
set "IS_DROPBOX_EXCLUDED="
set "TEMP_CHECK_DROPBOX=%~1"
call :NORMALIZE_PATH_VAR TEMP_CHECK_DROPBOX TEMP_CHECK_DROPBOX_NORMAL

set "TEMP_SEARCH=|%TEMP_CHECK_DROPBOX_NORMAL%|"

if not "!TEMP_EXCLUDE_DROPBOX_ROOTS:%TEMP_SEARCH%=!"=="!TEMP_EXCLUDE_DROPBOX_ROOTS!" (
    set "IS_DROPBOX_EXCLUDED=1"
)

exit /b 0


:NORMALIZE_PATH_VAR
set "NP_RAW=!%~1!"
set "NP_RAW=!NP_RAW:"=!"

for %%I in ("!NP_RAW!") do set "NP_OUT=%%~fI"

if "!NP_OUT:~-1!"=="\" set "NP_OUT=!NP_OUT:~0,-1!"

set "%~2=!NP_OUT!"
exit /b 0


:TRY_DROPBOX_ROOT
set "CANDIDATE_DROPBOX_ROOT=%~1"
set "CANDIDATE_HDDBTEST_ROOT="

if exist "%CANDIDATE_DROPBOX_ROOT%\HDDBTEST\HDDB_PROJECT\ORIGIN\.env" (
    set "CANDIDATE_HDDBTEST_ROOT=%CANDIDATE_DROPBOX_ROOT%\HDDBTEST"
    goto :TRY_DROPBOX_OK
)

if exist "%CANDIDATE_DROPBOX_ROOT%\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\.env" (
    set "CANDIDATE_HDDBTEST_ROOT=%CANDIDATE_DROPBOX_ROOT%\Dropbox\HDDBTEST"
    goto :TRY_DROPBOX_OK
)

if exist "%CANDIDATE_DROPBOX_ROOT%\Dropbox\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\.env" (
    set "CANDIDATE_HDDBTEST_ROOT=%CANDIDATE_DROPBOX_ROOT%\Dropbox\Dropbox\HDDBTEST"
    goto :TRY_DROPBOX_OK
)

for /d /r "%CANDIDATE_DROPBOX_ROOT%" %%H in (*) do (
    if /I "%%~nxH"=="HDDBTEST" (
        if exist "%%~fH\HDDB_PROJECT\ORIGIN\.env" (
            set "CANDIDATE_HDDBTEST_ROOT=%%~fH"
            goto :TRY_DROPBOX_OK
        )
    )
)

exit /b 0


:TRY_DROPBOX_OK
set "DROPBOX_ROOT=%CANDIDATE_DROPBOX_ROOT%"
for %%I in ("%DROPBOX_ROOT%") do set "DROPBOX_DRIVE=%%~dI"
set "HDDBTEST_ROOT=%CANDIDATE_HDDBTEST_ROOT%"
exit /b 0


:FIND_NODE_PATH
for /f "delims=" %%N in ('where node.exe 2^>nul') do (
    if not defined NODE_PATH set "NODE_PATH=%%N"
)

if defined NODE_PATH exit /b 0

for %%D in (A B C D E F G H I J K L M N O P Q R S T U V W X Y Z) do (
    if not defined NODE_PATH if exist "%%D:\Apps\NodeJS\node.exe" set "NODE_PATH=%%D:\Apps\NodeJS\node.exe"
    if not defined NODE_PATH if exist "%%D:\Apps\nodejs\node.exe" set "NODE_PATH=%%D:\Apps\nodejs\node.exe"
    if not defined NODE_PATH if exist "%%D:\NodeJS\node.exe" set "NODE_PATH=%%D:\NodeJS\node.exe"
    if not defined NODE_PATH if exist "%%D:\nodejs\node.exe" set "NODE_PATH=%%D:\nodejs\node.exe"
    if not defined NODE_PATH if exist "%%D:\Program Files\nodejs\node.exe" set "NODE_PATH=%%D:\Program Files\nodejs\node.exe"
    if not defined NODE_PATH if exist "%%D:\Program Files (x86)\nodejs\node.exe" set "NODE_PATH=%%D:\Program Files (x86)\nodejs\node.exe"
)

exit /b 0


:FIND_NPM_PATH
if defined NODE_PATH (
    for %%I in ("%NODE_PATH%") do set "NODE_DIR=%%~dpI"
    set "NODE_DIR=!NODE_DIR:~0,-1!"

    if exist "!NODE_DIR!\npm.cmd" set "NPM_PATH=!NODE_DIR!\npm.cmd"
    if not defined NPM_PATH if exist "!NODE_DIR!\npm" set "NPM_PATH=!NODE_DIR!\npm"
)

if defined NPM_PATH exit /b 0

for /f "delims=" %%N in ('where npm.cmd 2^>nul') do (
    if not defined NPM_PATH set "NPM_PATH=%%N"
)

exit /b 0



:RESOLVE_NORMAL_VPN_CLIENT_IP
if /I not "%HD_ORIGIN_LAUNCH_MODE%"=="NORMAL" exit /b 0

set "VPN_CLIENT_IP="
call :READ_CURRENT_VPN_IP_REGISTRY
if errorlevel 1 exit /b 1

if defined TEMP_PC_RULE_VPN_CLIENT_IP_CONFLICT (
    echo ERROR: PC rules has conflicting VPN_CLIENT_IP values for [%COMPUTER_NAME%].
    exit /b 1
)

if defined TEMP_REGISTRY_VPN_CLIENT_IP_CONFLICT (
    echo ERROR: VPN IP registry has conflicting VPN_CLIENT_IP values for [%COMPUTER_NAME%].
    exit /b 1
)

if defined TEMP_PC_RULE_VPN_CLIENT_IP (
    call :VALIDATE_NORMAL_VPN_CLIENT_IP "%TEMP_PC_RULE_VPN_CLIENT_IP%"
    if errorlevel 1 (
        echo ERROR: PC rules VPN_CLIENT_IP is invalid for [%COMPUTER_NAME%].
        echo VPN_CLIENT_IP=%TEMP_PC_RULE_VPN_CLIENT_IP%
        exit /b 1
    )
)

if defined TEMP_REGISTRY_VPN_CLIENT_IP (
    call :VALIDATE_NORMAL_VPN_CLIENT_IP "%TEMP_REGISTRY_VPN_CLIENT_IP%"
    if errorlevel 1 (
        echo ERROR: VPN IP registry VPN_CLIENT_IP is invalid for [%COMPUTER_NAME%].
        echo VPN_CLIENT_IP=%TEMP_REGISTRY_VPN_CLIENT_IP%
        exit /b 1
    )
)

if defined TEMP_REGISTRY_VPN_CLIENT_IP if defined TEMP_PC_RULE_VPN_CLIENT_IP (
    if /I not "%TEMP_REGISTRY_VPN_CLIENT_IP%"=="%TEMP_PC_RULE_VPN_CLIENT_IP%" (
        echo ERROR: VPN IP registry and PC rules conflict for [%COMPUTER_NAME%].
        echo VPN IP registry=%TEMP_REGISTRY_VPN_CLIENT_IP%
        echo PC rules      =%TEMP_PC_RULE_VPN_CLIENT_IP%
        echo The files were not changed to protect the existing assignment.
        exit /b 1
    )
)

call :FIND_CURRENT_VPN2_CLIENT_IP
if errorlevel 1 exit /b 1

if defined TEMP_CURRENT_VPN2_UNEXPECTED_IPV4 (
    echo ERROR: VPN2 has an unexpected IPv4 address: %TEMP_CURRENT_VPN2_UNEXPECTED_IPV4%
    echo It was not changed to protect the existing network configuration.
    exit /b 1
)

if defined TEMP_REGISTRY_VPN_CLIENT_IP (
    set "TEMP_RESOLVED_VPN_CLIENT_IP=%TEMP_REGISTRY_VPN_CLIENT_IP%"
) else if defined TEMP_PC_RULE_VPN_CLIENT_IP (
    set "TEMP_RESOLVED_VPN_CLIENT_IP=%TEMP_PC_RULE_VPN_CLIENT_IP%"
) else if defined TEMP_CURRENT_VPN2_CLIENT_IP (
    set "TEMP_RESOLVED_VPN_CLIENT_IP=%TEMP_CURRENT_VPN2_CLIENT_IP%"
) else (
    set "TEMP_RESOLVED_VPN_CLIENT_IP="
    for /l %%I in (2,1,254) do (
        if not defined TEMP_RESOLVED_VPN_CLIENT_IP (
            set "TEMP_CANDIDATE_VPN_CLIENT_IP=10.250.0.%%I"
            call :IS_VPN_CLIENT_IP_RESERVED_BY_OTHER_PC "!TEMP_CANDIDATE_VPN_CLIENT_IP!"
            if not defined TEMP_VPN_CLIENT_IP_RESERVED set "TEMP_RESOLVED_VPN_CLIENT_IP=!TEMP_CANDIDATE_VPN_CLIENT_IP!"
        )
    )
)

if not defined TEMP_RESOLVED_VPN_CLIENT_IP (
    echo ERROR: No free VPN client IP address was found in 10.250.0.2-254.
    exit /b 1
)

call :IS_VPN_CLIENT_IP_RESERVED_BY_OTHER_PC "%TEMP_RESOLVED_VPN_CLIENT_IP%"
if defined TEMP_VPN_CLIENT_IP_RESERVED (
    echo ERROR: VPN_CLIENT_IP=%TEMP_RESOLVED_VPN_CLIENT_IP% is reserved by another PC.
    echo The existing assignment was not changed.
    exit /b 1
)

if defined TEMP_CURRENT_VPN2_CLIENT_IP if /I not "%TEMP_CURRENT_VPN2_CLIENT_IP%"=="%TEMP_RESOLVED_VPN_CLIENT_IP%" (
    echo ERROR: VPN2 currently uses %TEMP_CURRENT_VPN2_CLIENT_IP%, not %TEMP_RESOLVED_VPN_CLIENT_IP%.
    echo It was not changed to protect the existing network configuration.
    exit /b 1
)

set "VPN_CLIENT_IP=%TEMP_RESOLVED_VPN_CLIENT_IP%"
call :SYNC_VPN_IP_REGISTRY
if errorlevel 1 exit /b 1
call :SYNC_VPN_CLIENT_IP_FILE "%PC_RULES_FILE%" "%VPN_CLIENT_IP%"
if errorlevel 1 exit /b 1
exit /b 0


:READ_CURRENT_VPN_IP_REGISTRY
set "TEMP_REGISTRY_VPN_CLIENT_IP="
set "TEMP_REGISTRY_VPN_CLIENT_IP_CONFLICT="
for %%I in ("%VPN_IP_REGISTRY_PATH%") do set "TEMP_VPN_IP_REGISTRY_DIR=%%~dpI"

if not exist "%VPN_IP_REGISTRY_PATH%" (
    if not exist "%TEMP_VPN_IP_REGISTRY_DIR%" (
        echo ERROR: VPN IP registry directory was not found.
        echo %TEMP_VPN_IP_REGISTRY_DIR%
        exit /b 1
    )
    > "%VPN_IP_REGISTRY_PATH%" echo # HD Origin VPN Client IP Registry
    >> "%VPN_IP_REGISTRY_PATH%" echo # COMPUTER_NAME=10.250.0.x
    if errorlevel 1 (
        echo ERROR: VPN IP registry could not be created.
        echo %VPN_IP_REGISTRY_PATH%
        exit /b 1
    )
)

for /f "usebackq tokens=1,* delims==" %%A in ("%VPN_IP_REGISTRY_PATH%") do (
    if /I "%%A"=="%COMPUTER_NAME%" (
        if defined TEMP_REGISTRY_VPN_CLIENT_IP (
            set "TEMP_REGISTRY_VPN_CLIENT_IP_CONFLICT=1"
        ) else (
            set "TEMP_REGISTRY_VPN_CLIENT_IP=%%B"
        )
    )
)

exit /b 0


:VALIDATE_NORMAL_VPN_CLIENT_IP
set "TEMP_VPN_IP_TO_VALIDATE=%~1"
if not defined TEMP_VPN_IP_TO_VALIDATE exit /b 1
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "if($env:TEMP_VPN_IP_TO_VALIDATE -match '^10\.250\.0\.(?:[2-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-4])$'){exit 0}else{exit 1}"
exit /b %ERRORLEVEL%


:IS_VPN_CLIENT_IP_RESERVED_BY_OTHER_PC
set "TEMP_VPN_CLIENT_IP_RESERVED="
set "TEMP_VPN_CLIENT_IP_TO_CHECK=%~1"
if not defined TEMP_VPN_CLIENT_IP_TO_CHECK exit /b 1
call :CHECK_VPN_IP_REGISTRY_RESERVATION
call :CHECK_VPN_CLIENT_IP_RESERVATION_IN_FILE "%PC_RULES_FILE%"
exit /b 0


:CHECK_VPN_IP_REGISTRY_RESERVATION
if not exist "%VPN_IP_REGISTRY_PATH%" exit /b 0
for /f "usebackq tokens=1,* delims==" %%A in ("%VPN_IP_REGISTRY_PATH%") do (
    if /I not "%%A"=="%COMPUTER_NAME%" if /I "%%B"=="%TEMP_VPN_CLIENT_IP_TO_CHECK%" set "TEMP_VPN_CLIENT_IP_RESERVED=1"
)
exit /b 0

:CHECK_VPN_CLIENT_IP_RESERVATION_IN_FILE
if not exist "%~1" exit /b 0
set "TEMP_VPN_RESERVATION_SECTION="

for /f "usebackq tokens=* delims=" %%L in ("%~1") do (
    set "TEMP_VPN_RESERVATION_LINE=%%L"
    if not "!TEMP_VPN_RESERVATION_LINE!"=="" (
        if "!TEMP_VPN_RESERVATION_LINE:~0,1!"=="[" (
            set "TEMP_VPN_RESERVATION_SECTION=!TEMP_VPN_RESERVATION_LINE!"
        ) else (
            if defined TEMP_VPN_RESERVATION_SECTION if /I not "!TEMP_VPN_RESERVATION_SECTION!"=="[%COMPUTER_NAME%]" (
                if not "!TEMP_VPN_RESERVATION_LINE:~0,1!"=="#" (
                    for /f "tokens=1,* delims==" %%A in ("!TEMP_VPN_RESERVATION_LINE!") do (
                        if /I "%%A"=="VPN_CLIENT_IP" if /I "%%B"=="!TEMP_VPN_CLIENT_IP_TO_CHECK!" set "TEMP_VPN_CLIENT_IP_RESERVED=1"
                    )
                )
            )
        )
    )
)

exit /b 0


:SYNC_VPN_IP_REGISTRY
set "TEMP_VPN_REGISTRY_SYNC_RESULT="
set "TEMP_VPN_REGISTRY_SYNC_ERROR_TYPE="
set "TEMP_VPN_REGISTRY_SYNC_ERROR_MESSAGE="
set "TEMP_VPN_REGISTRY_SYNC_ERROR_PATH="
for /f "tokens=1,* delims==" %%A in ('powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop';$p=$env:VPN_IP_REGISTRY_PATH;$ip=$env:VPN_CLIENT_IP;$pc=$env:COMPUTER_NAME;$rules=$env:PC_RULES_FILE;$enc=[Text.Encoding]::GetEncoding(932);$fs=$null;try{$fs=New-Object IO.FileStream($p,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$reader=New-Object IO.StreamReader($fs,$enc,$false,1024,$true);$text=$reader.ReadToEnd();$reader.Dispose();$registryLines=@();if($text.Length -gt 0){$registryLines=[regex]::Split($text,'\r?\n')};$currentCount=0;$currentIp='';foreach($line in $registryLines){$m=[regex]::Match($line,'^\s*([^#=\s][^=]*?)\s*=\s*(.*?)\s*$');if($m.Success){$name=$m.Groups[1].Value.Trim();$value=$m.Groups[2].Value.Trim();if($name -ieq $pc){$currentCount++;$currentIp=$value}elseif($value -ieq $ip){throw ('VPN_CLIENT_IP is already reserved by another PC: '+$ip)}}};if($currentCount -gt 1){throw ('VPN IP registry has duplicate registrations for '+$pc)};if($currentCount -eq 1 -and $currentIp -ine $ip){throw ('VPN IP registry changed for '+$pc+' while resolving VPN_CLIENT_IP')};if(Test-Path -LiteralPath $rules){$ruleLines=[IO.File]::ReadAllLines($rules,$enc);$inRule=$false;$ruleCount=0;$ruleIp='';foreach($line in $ruleLines){if($line -match '^\s*\[(.+)\]\s*$'){$inRule=($Matches[1].Trim() -ieq $pc);continue};if($inRule){$m=[regex]::Match($line,'^\s*VPN_CLIENT_IP\s*=\s*(.*?)\s*$');if($m.Success){$ruleCount++;$ruleIp=$m.Groups[1].Value.Trim()}}};if($ruleCount -gt 1){throw ('PC_RULES has duplicate VPN_CLIENT_IP values for '+$pc)};if($ruleCount -eq 1 -and $ruleIp -ine $ip){throw ('PC_RULES conflicts with VPN IP registry for '+$pc)}};$out=New-Object 'System.Collections.Generic.List[string]';$written=$false;foreach($line in $registryLines){$m=[regex]::Match($line,'^\s*([^#=\s][^=]*?)\s*=\s*(.*?)\s*$');if($m.Success -and $m.Groups[1].Value.Trim() -ieq $pc){if(-not $written){[void]$out.Add($pc+'='+$ip);$written=$true};continue};[void]$out.Add($line)};if(-not $written){if($out.Count -gt 0 -and $out[$out.Count-1] -ne ''){[void]$out.Add('')};[void]$out.Add($pc+'='+$ip)};$newText=[string]::Join([Environment]::NewLine,$out);if($newText.Length -gt 0){$newText+=[Environment]::NewLine};$fs.Position=0;$fs.SetLength(0);$writer=New-Object IO.StreamWriter($fs,$enc,1024,$true);$writer.Write($newText);$writer.Flush();$writer.Dispose();$fs.Flush($true);'SYNC_RESULT=OK'}catch{$message=$_.Exception.Message -replace '[\r\n]+',' ';'ERROR_TYPE='+$_.Exception.GetType().FullName;'ERROR_MESSAGE='+$message;'VPN_IP_REGISTRY_PATH='+$p;'SYNC_RESULT=ERROR'}finally{if($null -ne $fs){$fs.Dispose()}}"') do (
    if /I "%%A"=="SYNC_RESULT" set "TEMP_VPN_REGISTRY_SYNC_RESULT=%%B"
    if /I "%%A"=="ERROR_TYPE" set "TEMP_VPN_REGISTRY_SYNC_ERROR_TYPE=%%B"
    if /I "%%A"=="ERROR_MESSAGE" set "TEMP_VPN_REGISTRY_SYNC_ERROR_MESSAGE=%%B"
    if /I "%%A"=="VPN_IP_REGISTRY_PATH" set "TEMP_VPN_REGISTRY_SYNC_ERROR_PATH=%%B"
)
if /I "%TEMP_VPN_REGISTRY_SYNC_RESULT%"=="OK" exit /b 0
echo ERROR: VPN IP registry synchronization failed.
echo ERROR_TYPE=%TEMP_VPN_REGISTRY_SYNC_ERROR_TYPE%
echo ERROR_MESSAGE=%TEMP_VPN_REGISTRY_SYNC_ERROR_MESSAGE%
echo VPN_IP_REGISTRY_PATH=%TEMP_VPN_REGISTRY_SYNC_ERROR_PATH%
exit /b 1


:SYNC_VPN_CLIENT_IP_FILE
set "TEMP_VPN_SYNC_PATH=%~1"
set "TEMP_VPN_SYNC_IP=%~2"
if not defined TEMP_VPN_SYNC_PATH exit /b 1
if not defined TEMP_VPN_SYNC_IP exit /b 1
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop';$p=$env:TEMP_VPN_SYNC_PATH;$ip=$env:TEMP_VPN_SYNC_IP;$enc=[Text.Encoding]::GetEncoding(932);$lines=if(Test-Path -LiteralPath $p){[IO.File]::ReadAllLines($p,$enc)}else{@()};$section='['+$env:COMPUTER_NAME+']';$out=New-Object 'System.Collections.Generic.List[string]';$inSection=$false;$foundSection=$false;$written=$false;foreach($line in $lines){if($line -match '^\s*\[.*\]\s*$'){if($inSection -and -not $written){[void]$out.Add('VPN_CLIENT_IP='+$ip);$written=$true};$inSection=($line -ieq $section);if($inSection){$foundSection=$true};[void]$out.Add($line);continue};if($inSection -and $line -match '^\s*VPN_CLIENT_IP\s*='){if(-not $written){[void]$out.Add('VPN_CLIENT_IP='+$ip);$written=$true};continue};[void]$out.Add($line)};if($inSection -and -not $written){[void]$out.Add('VPN_CLIENT_IP='+$ip);$written=$true};if(-not $foundSection){if($out.Count -gt 0 -and $out[$out.Count-1] -ne ''){[void]$out.Add('')};[void]$out.Add($section);[void]$out.Add('VPN_CLIENT_IP='+$ip)};[IO.File]::WriteAllLines($p,$out,$enc)"
if errorlevel 1 (
    echo ERROR: VPN_CLIENT_IP could not be synchronized to PC_RULES.
    echo %TEMP_VPN_SYNC_PATH%
    exit /b 1
)
exit /b 0
:FIND_CURRENT_VPN2_CLIENT_IP
set "TEMP_CURRENT_VPN2_CLIENT_IP="
set "TEMP_CURRENT_VPN2_UNEXPECTED_IPV4="
set "TEMP_CURRENT_VPN2_CLIENT_IP_CONFLICT="

for /f "tokens=1,* delims==" %%A in ('powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ips=@(Get-NetIPAddress -InterfaceAlias 'VPN2 - VPN Client' -AddressFamily IPv4 -ErrorAction SilentlyContinue ^| ForEach-Object {$_.IPAddress});$valid=@($ips ^| Where-Object {$_ -match '^10\.250\.0\.(?:[2-9]^|[1-9]\d^|1\d\d^|2[0-4]\d^|25[0-4])$'});$unexpected=@($ips ^| Where-Object {$_ -notmatch '^169\.254\.' -and $_ -notmatch '^10\.250\.0\.(?:[2-9]^|[1-9]\d^|1\d\d^|2[0-4]\d^|25[0-4])$'});if($valid.Count -gt 1){'CONFLICT=1'}elseif($valid.Count -eq 1){'CURRENT='+$valid[0]};if($unexpected.Count -gt 0){'UNEXPECTED='+($unexpected -join ',')}"') do (
    if /I "%%A"=="CURRENT" set "TEMP_CURRENT_VPN2_CLIENT_IP=%%B"
    if /I "%%A"=="UNEXPECTED" set "TEMP_CURRENT_VPN2_UNEXPECTED_IPV4=%%B"
    if /I "%%A"=="CONFLICT" set "TEMP_CURRENT_VPN2_CLIENT_IP_CONFLICT=1"
)

if defined TEMP_CURRENT_VPN2_CLIENT_IP_CONFLICT (
    echo ERROR: VPN2 has multiple 10.250.0.x IPv4 addresses.
    exit /b 1
)

exit /b 0
:ENSURE_NORMAL_VPN_DB
if /I not "%HD_ORIGIN_LAUNCH_MODE%"=="NORMAL" exit /b 0

call :ENSURE_NORMAL_VPN_CLIENT
if errorlevel 1 exit /b 1

echo.
echo Checking NORMAL mode PostgreSQL connection...
echo TARGET=%DB_HOST%:%DB_PORT%

call :TEST_NORMAL_VPN_DB

if not errorlevel 1 (
    echo PostgreSQL connection = OK
    exit /b 0
)

echo PostgreSQL connection = NOT REACHABLE
echo SoftEther VPN connection will be attempted.
echo VPN_ACCOUNT=%VPN_ACCOUNT%
echo VPN_SERVER=%VPN_DDNS_HOST%:%VPN_PORT%

"%VPNCMD_PATH%" localhost /CLIENT /CMD AccountConnect "%VPN_ACCOUNT%"

if errorlevel 1 (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$a=Get-NetAdapter -Name 'VPN2 - VPN Client' -ErrorAction SilentlyContinue;if($null -ne $a -and $a.Status -eq 'Up'){exit 0}else{exit 1}"

    if errorlevel 1 (
        echo ERROR: SoftEther AccountConnect failed.
        echo VPN_ACCOUNT=%VPN_ACCOUNT%
        exit /b 1
    )
)

echo Waiting for VPN2 link...

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false;for($i=0;$i -lt 30;$i++){$a=Get-NetAdapter -Name 'VPN2 - VPN Client' -ErrorAction SilentlyContinue;if($null -ne $a -and $a.Status -eq 'Up'){$ok=$true;break};Start-Sleep -Milliseconds 500};if($ok){exit 0}else{exit 1}"

if errorlevel 1 (
    echo ERROR: VPN2 did not become connected.
    exit /b 1
)

echo VPN2 link = UP

call :ENSURE_VPN2_IPV4

if errorlevel 1 (
    echo ERROR: VPN2 IPv4 configuration failed.
    exit /b 1
)

echo.
echo Checking PostgreSQL through VPN...
echo TARGET=%DB_HOST%:%DB_PORT%

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false;for($i=0;$i -lt 20;$i++){$c=New-Object System.Net.Sockets.TcpClient;try{$a=$c.BeginConnect('%DB_HOST%',%DB_PORT%,$null,$null);if($a.AsyncWaitHandle.WaitOne(800,$false)){try{$c.EndConnect($a);$ok=$true}catch{}}}catch{}finally{$c.Close()};if($ok){break};Start-Sleep -Milliseconds 500};if($ok){exit 0}else{exit 1}"

if errorlevel 1 (
    echo ERROR: VPN connected, but PostgreSQL is still unreachable.
    echo TARGET=%DB_HOST%:%DB_PORT%
    exit /b 1
)

echo PostgreSQL connection through VPN = OK
exit /b 0


:TEST_NORMAL_VPN_DB
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$c=New-Object System.Net.Sockets.TcpClient;try{$a=$c.BeginConnect('%DB_HOST%',%DB_PORT%,$null,$null);if(-not $a.AsyncWaitHandle.WaitOne(800,$false)){exit 1};$c.EndConnect($a);exit 0}catch{exit 1}finally{$c.Close()}"
exit /b %ERRORLEVEL%


:ENSURE_NORMAL_VPN_CLIENT
sc query "sevpnclient" >nul 2>nul

if errorlevel 1 (
    echo ERROR: SoftEther VPN Client service was not found.
    echo NORMAL mode requires SoftEther VPN Client.
    exit /b 1
)

if not defined VPNCMD_PATH (
    echo ERROR: VPNCMD_PATH was not found.
    exit /b 1
)

if not exist "%VPNCMD_PATH%" (
    echo ERROR: vpncmd.exe was not found.
    echo VPNCMD_PATH=%VPNCMD_PATH%
    exit /b 1
)

"%VPNCMD_PATH%" localhost /CLIENT /CMD NicGetSetting VPN2 >nul 2>nul

if errorlevel 1 (
    echo Creating SoftEther virtual LAN card: VPN2

    "%VPNCMD_PATH%" localhost /CLIENT /CMD NicCreate VPN2

    if errorlevel 1 (
        echo ERROR: SoftEther virtual LAN card VPN2 could not be created.
        exit /b 1
    )
)

"%VPNCMD_PATH%" localhost /CLIENT /CMD AccountGet "%VPN_ACCOUNT%" >nul 2>nul

if not errorlevel 1 exit /b 0

if not exist "%VPN_SERVER_CERT_PATH%" (
    echo ERROR: VPN server public certificate was not found.
    echo VPN_SERVER_CERT_PATH=%VPN_SERVER_CERT_PATH%
    exit /b 1
)

set "VPN_CERT_SHA1="

for /f "delims=" %%H in ('powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "(New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($env:VPN_SERVER_CERT_PATH)).Thumbprint"') do (
    set "VPN_CERT_SHA1=%%H"
)

if /I not "%VPN_CERT_SHA1%"=="3D9419248C89796365654A26589ADD51823A5230" (
    echo ERROR: VPN server public certificate SHA1 did not match the confirmed value.
    exit /b 1
)

echo Creating SoftEther account: %VPN_ACCOUNT%

"%VPNCMD_PATH%" localhost /CLIENT /CMD AccountCreate "%VPN_ACCOUNT%" /SERVER:"%VPN_DDNS_HOST%:%VPN_PORT%" /HUB:"%VPN_HUB%" /USERNAME:"%VPN_USER%" /NICNAME:VPN2

if errorlevel 1 exit /b 1

"%VPNCMD_PATH%" localhost /CLIENT /CMD AccountEncryptEnable "%VPN_ACCOUNT%"

if errorlevel 1 exit /b 1

"%VPNCMD_PATH%" localhost /CLIENT /CMD AccountServerCertEnable "%VPN_ACCOUNT%"

if errorlevel 1 exit /b 1

"%VPNCMD_PATH%" localhost /CLIENT /CMD AccountServerCertSet "%VPN_ACCOUNT%" /LOADCERT:"%VPN_SERVER_CERT_PATH%"

if errorlevel 1 exit /b 1

echo.
echo VPN user password is required for first-time account setup.
echo The entered value is not written to the project files.

"%VPNCMD_PATH%" localhost /CLIENT /CMD AccountPasswordSet "%VPN_ACCOUNT%" /TYPE:standard

if errorlevel 1 (
    echo ERROR: VPN password was not accepted by SoftEther Client.
    exit /b 1
)

exit /b 0


:ENSURE_VPN2_IPV4
if not defined VPN_CLIENT_IP (
    echo ERROR: VPN_CLIENT_IP was not resolved.
    exit /b 1
)

echo Checking VPN2 IPv4...
echo EXPECTED=%VPN_CLIENT_IP%/24

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$i=Get-NetIPInterface -InterfaceAlias 'VPN2 - VPN Client' -AddressFamily IPv4 -ErrorAction SilentlyContinue;$a=Get-NetIPAddress -InterfaceAlias 'VPN2 - VPN Client' -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object {$_.IPAddress -eq $env:VPN_CLIENT_IP -and $_.PrefixLength -eq 24 -and $_.AddressState -eq 'Preferred'};if($null -ne $i -and $i.Dhcp -eq 'Disabled' -and $null -ne $a){exit 0}else{exit 1}"

if not errorlevel 1 (
    echo VPN2 IPv4 configuration = ALREADY OK
    echo VPN_CLIENT_IP=%VPN_CLIENT_IP%/24
    exit /b 0
)

call :FIND_CURRENT_VPN2_CLIENT_IP

if errorlevel 1 exit /b 1

if defined TEMP_CURRENT_VPN2_UNEXPECTED_IPV4 (
    echo ERROR: VPN2 has an unexpected IPv4 address:
    echo %TEMP_CURRENT_VPN2_UNEXPECTED_IPV4%
    echo It was not changed to protect the existing network configuration.
    exit /b 1
)

if defined TEMP_CURRENT_VPN2_CLIENT_IP (
    if /I not "%TEMP_CURRENT_VPN2_CLIENT_IP%"=="%VPN_CLIENT_IP%" (
        echo ERROR: VPN2 currently uses another HD Origin VPN IPv4 address.
        echo CURRENT=%TEMP_CURRENT_VPN2_CLIENT_IP%
        echo EXPECTED=%VPN_CLIENT_IP%
        echo It was not changed to protect the existing assignment.
        exit /b 1
    )
)

echo Configuring VPN2 IPv4 address: %VPN_CLIENT_IP%/24
echo Administrator approval is required only for VPN2 IPv4 configuration.

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop';try{$adapter=Get-NetAdapter -Name 'VPN2 - VPN Client' -ErrorAction Stop;if($adapter.Status -ne 'Up'){throw 'VPN2 is not connected.'};$ifIndex=$adapter.ifIndex;$arg='interface ipv4 set address name='+$ifIndex+' source=static address='+$env:VPN_CLIENT_IP+' mask=255.255.255.0 gateway=none store=persistent';$p=Start-Process -FilePath ($env:SystemRoot+'\System32\netsh.exe') -ArgumentList $arg -Verb RunAs -Wait -PassThru;if($null -eq $p){exit 1};exit $p.ExitCode}catch{Write-Host ('ERROR: '+$_.Exception.Message);exit 1}"

if errorlevel 1 (
    echo ERROR: VPN2 IPv4 configuration failed or administrator approval was cancelled.
    exit /b 1
)

echo Waiting for VPN2 IPv4 to become Preferred...

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false;$dup=$false;for($i=0;$i -lt 30;$i++){$iface=Get-NetIPInterface -InterfaceAlias 'VPN2 - VPN Client' -AddressFamily IPv4 -ErrorAction SilentlyContinue;$ips=@(Get-NetIPAddress -InterfaceAlias 'VPN2 - VPN Client' -AddressFamily IPv4 -ErrorAction SilentlyContinue);$target=@($ips | Where-Object {$_.IPAddress -eq $env:VPN_CLIENT_IP -and $_.PrefixLength -eq 24});if(@($target | Where-Object {$_.AddressState -eq 'Duplicate'}).Count -gt 0){$dup=$true;break};if($null -ne $iface -and $iface.Dhcp -eq 'Disabled' -and @($target | Where-Object {$_.AddressState -eq 'Preferred'}).Count -gt 0){$ok=$true;break};Start-Sleep -Milliseconds 500};if($dup){exit 2};if($ok){exit 0}else{exit 1}"

if errorlevel 2 (
    echo ERROR: Duplicate VPN_CLIENT_IP was detected.
    echo VPN_CLIENT_IP=%VPN_CLIENT_IP%
    exit /b 1
)

if errorlevel 1 (
    echo ERROR: VPN2 IPv4 did not become ready.
    echo EXPECTED=%VPN_CLIENT_IP%/24
    exit /b 1
)

echo VPN2 IPv4 configuration = OK
echo VPN_CLIENT_IP=%VPN_CLIENT_IP%/24
exit /b 0


:FIND_PG_BIN_PATH
for /f "delims=" %%P in ('where psql.exe 2^>nul') do (
    if not defined PG_BIN_PATH (
        for %%I in ("%%P") do call :TRY_PG_BIN "%%~dpI"
    )
)

if defined PG_BIN_PATH exit /b 0

for %%D in (A B C D E F G H I J K L M N O P Q R S T U V W X Y Z) do (
    for %%V in (17 16 15 14) do (
        call :TRY_PG_BIN "%%D:\Apps\PostgreSQL\%%V\bin"
        call :TRY_PG_BIN "%%D:\PostgreSQL\%%V\bin"
        call :TRY_PG_BIN "%%D:\Program Files\PostgreSQL\%%V\bin"
        call :TRY_PG_BIN "%%D:\Program Files (x86)\PostgreSQL\%%V\bin"
    )
)

exit /b 0


:TRY_PG_BIN
if defined PG_BIN_PATH exit /b 0

set "CANDIDATE_PG_BIN=%~1"

if exist "%CANDIDATE_PG_BIN%\psql.exe" (
    if exist "%CANDIDATE_PG_BIN%\pg_dump.exe" (
        if exist "%CANDIDATE_PG_BIN%\pg_restore.exe" (
            set "PG_BIN_PATH=%CANDIDATE_PG_BIN%"
        )
    )
)

exit /b 0


:FIND_CHROME_PATH
for /f "delims=" %%C in ('where chrome.exe 2^>nul') do (
    if not defined CHROME_PATH set "CHROME_PATH=%%C"
)

if defined CHROME_PATH exit /b 0

for %%D in (A B C D E F G H I J K L M N O P Q R S T U V W X Y Z) do (
    if not defined CHROME_PATH if exist "%%D:\Program Files\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%%D:\Program Files\Google\Chrome\Application\chrome.exe"
    if not defined CHROME_PATH if exist "%%D:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "CHROME_PATH=%%D:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)

exit /b 0













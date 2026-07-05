@echo off
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

set "DB_HOST=127.0.0.1"
set "DB_PORT=5432"
set "DB_NAME=hd_origin_project"
set "DB_USER=postgres"

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
set "DROPBOX_PATH=%DROPBOX_ROOT%"

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

set "BACKUP_DIR=%PROJECT_ROOT%\backup"
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

echo Starting server.js...
echo URL: http://localhost:%PORT%
echo.

if defined CHROME_PATH (
    start "" "%CHROME_PATH%" "http://localhost:%PORT%"
) else (
    start "" "http://localhost:%PORT%"
)

if defined NODE_PATH (
    "%NODE_PATH%" server.js
) else (
    node server.js
)

echo.
echo Server stopped.

if exist "%PROJECT_ROOT%\HD_ORIGIN_RESTARTING.flag" (
    del "%PROJECT_ROOT%\HD_ORIGIN_RESTARTING.flag" >nul 2>nul
    exit /b 0
)
pause
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
>> "%RUNTIME_PATHS_FILE%" echo DB_HOST=!DB_HOST!
>> "%RUNTIME_PATHS_FILE%" echo DB_PORT=!DB_PORT!
>> "%RUNTIME_PATHS_FILE%" echo DB_NAME=!DB_NAME!
>> "%RUNTIME_PATHS_FILE%" echo DB_USER=!DB_USER!
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










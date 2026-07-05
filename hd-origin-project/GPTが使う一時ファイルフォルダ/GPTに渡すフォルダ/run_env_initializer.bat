@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

cd /d "%~dp0"

echo ==============================
echo HD Origin Project .env initializer
echo ==============================
echo.

set "PROJECT_ROOT=%~dp0"
set "PROJECT_DRIVE=%~d0"
set "INIT_PY=%PROJECT_ROOT%env_initializer.py"

if not exist "%INIT_PY%" (
    echo env_initializer.py が見つかりません。
    echo %INIT_PY%
    pause
    exit /b 1
)

echo Project root:
echo %PROJECT_ROOT%
echo.

call :RESOLVE_DROPBOX_ENV
if errorlevel 1 exit /b 1

rem --------------------------------------------------
rem Python を探す
rem --------------------------------------------------
set "PYTHON_EXE="
set "PYTHON_KIND="

for %%P in (
    "%PROJECT_DRIVE%\Apps\Python312\python.exe"
    "%PROJECT_DRIVE%\Apps\Python311\python.exe"
    "%PROJECT_DRIVE%\Apps\Python310\python.exe"
    "%PROJECT_DRIVE%\Apps\Python\python.exe"
    "%PROJECT_DRIVE%\Python312\python.exe"
    "%PROJECT_DRIVE%\Python311\python.exe"
    "%PROJECT_DRIVE%\Python310\python.exe"
) do (
    if exist %%~P (
        set "PYTHON_EXE=%%~P"
        set "PYTHON_KIND=EXE"
        goto :FOUND_PYTHON
    )
)

where py >nul 2>nul
if not errorlevel 1 (
    set "PYTHON_EXE=py"
    set "PYTHON_KIND=PY"
    goto :FOUND_PYTHON
)

where python >nul 2>nul
if not errorlevel 1 (
    set "PYTHON_EXE=python"
    set "PYTHON_KIND=CMD"
    goto :FOUND_PYTHON
)

for %%P in (
    "%LocalAppData%\Programs\Python\Python312\python.exe"
    "%LocalAppData%\Programs\Python\Python311\python.exe"
    "%ProgramFiles%\Python312\python.exe"
    "%ProgramFiles%\Python311\python.exe"
) do (
    if exist %%~P (
        set "PYTHON_EXE=%%~P"
        set "PYTHON_KIND=EXE"
        goto :FOUND_PYTHON
    )
)

echo Python が見つかりません。
echo.
pause
exit /b 1

:FOUND_PYTHON
echo Python:
echo %PYTHON_EXE%
echo.

if /I "%PYTHON_KIND%"=="EXE" (
    "%PYTHON_EXE%" "%INIT_PY%"
) else if /I "%PYTHON_KIND%"=="PY" (
    py -3 "%INIT_PY%"
) else (
    python "%INIT_PY%"
)

if errorlevel 1 (
    echo.
    echo env_initializer.py が失敗しました。
    pause
    exit /b 1
)

echo.
echo .env initializer 完了。
pause
exit /b 0


:RESOLVE_DROPBOX_ENV
set "DROPBOX_DRIVE="
set "DROPBOX_ROOT="
set "HDDBTEST_ROOT="
set "HD_ORIGIN_ENV_PATH="

echo Searching drive-root Dropbox...

for %%D in (A B C D E F G H I J K L M N O P Q R S T U V W X Y Z) do (
    if exist "%%D:\" (
        for /d %%P in ("%%D:\*") do (
            if /I "%%~nxP"=="Dropbox" (
                set "DROPBOX_DRIVE=%%D:"
                set "DROPBOX_ROOT=%%~fP"
                goto :DROPBOX_ROOT_FOUND
            )
        )
    )
)

:DROPBOX_ROOT_FOUND

if not defined DROPBOX_ROOT (
    echo ERROR: ドライブ直下の Dropbox が見つかりません。
    echo 例: D:\Dropbox / G:\DROPBOX / C:\DropBox
    echo.
    pause
    exit /b 1
)

echo DROPBOX_DRIVE = %DROPBOX_DRIVE%
echo DROPBOX_ROOT  = %DROPBOX_ROOT%

if exist "%DROPBOX_ROOT%\HDDBTEST\" (
    set "HDDBTEST_ROOT=%DROPBOX_ROOT%\HDDBTEST"
    goto :HDDBTEST_FOUND
)

if exist "%DROPBOX_ROOT%\Dropbox\HDDBTEST\" (
    set "HDDBTEST_ROOT=%DROPBOX_ROOT%\Dropbox\HDDBTEST"
    goto :HDDBTEST_FOUND
)

if exist "%DROPBOX_ROOT%\Dropbox\Dropbox\HDDBTEST\" (
    set "HDDBTEST_ROOT=%DROPBOX_ROOT%\Dropbox\Dropbox\HDDBTEST"
    goto :HDDBTEST_FOUND
)

for /d /r "%DROPBOX_ROOT%" %%H in (*) do (
    if /I "%%~nxH"=="HDDBTEST" (
        set "HDDBTEST_ROOT=%%~fH"
        goto :HDDBTEST_FOUND
    )
)

:HDDBTEST_FOUND

if not defined HDDBTEST_ROOT (
    echo ERROR: %DROPBOX_ROOT% の中に HDDBTEST が見つかりません。
    echo.
    pause
    exit /b 1
)

set "DROPBOX_PATH=%DROPBOX_ROOT%"
set "DROPBOX_ROOT=%DROPBOX_ROOT%"
set "HD_ORIGIN_ENV_PATH=%HDDBTEST_ROOT%\HDDB_PROJECT\ORIGIN\.env"

echo HDDBTEST_ROOT      = %HDDBTEST_ROOT%
echo HD_ORIGIN_ENV_PATH = %HD_ORIGIN_ENV_PATH%
echo.
exit /b 0
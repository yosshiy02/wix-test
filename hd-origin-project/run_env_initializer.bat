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

rem --------------------------------------------------
rem 1. プロジェクトと同じドライブ上の Python を優先して探す
rem    例：G:\Apps\Python312\python.exe
rem --------------------------------------------------

set "PYTHON_EXE="

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
        goto :FOUND_PYTHON
    )
)

rem --------------------------------------------------
rem 2. Windows標準の py ランチャーを見る
rem --------------------------------------------------

where py >nul 2>nul
if %errorlevel%==0 (
    set "PYTHON_EXE=py -3"
    goto :FOUND_PYTHON
)

rem --------------------------------------------------
rem 3. PATH上の python を見る
rem --------------------------------------------------

where python >nul 2>nul
if %errorlevel%==0 (
    set "PYTHON_EXE=python"
    goto :FOUND_PYTHON
)

rem --------------------------------------------------
rem 4. よくあるインストール先を見る
rem --------------------------------------------------

for %%P in (
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

echo Python が見つかりません。
echo.
echo 対応：
echo  1. Pythonをこのドライブの Apps に入れる
echo     例：%PROJECT_DRIVE%\Apps\Python312\python.exe
echo.
echo  2. または Python を PATH に通す
echo.
pause
exit /b 1

:FOUND_PYTHON
echo Python:
echo %PYTHON_EXE%
echo.

%PYTHON_EXE% "%INIT_PY%"

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

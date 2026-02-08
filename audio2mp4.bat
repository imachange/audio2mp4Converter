@echo off
cd /d "%~dp0"

:: ■ 設定エリア --------------------------
:: 実行するPythonファイル名
set "SCRIPT_NAME=audio2mp4.py"
:: ---------------------------------------

:: Pythonがインストールされているかチェック
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [エラー] Pythonが見つかりません。
    echo Pythonをインストールするか、PATHを通してください。
    pause
    exit /b
)

:: スクリプトファイルがあるかチェック
if not exist "%SCRIPT_NAME%" (
    echo [エラー] "%SCRIPT_NAME%" が見つかりません。
    echo このバッチファイルと同じ場所に置いてください。
    pause
    exit /b
)

:: Pythonスクリプトを実行
python "%SCRIPT_NAME%"

:: スクリプト側でエラー落ちした場合などのためにPauseを入れる
if %errorlevel% neq 0 (
    pause
)
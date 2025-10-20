@echo off
REM ================================================================
REM User-Feedback Web Launcher
REM 使用者反饋收集器啟動器
REM ================================================================

setlocal enabledelayedexpansion

REM 設定顏色和符號
set "CHECK=[✓]"
set "CROSS=[✗]"
set "ARROW=[→]"

echo.
echo ================================================================
echo  🚀 User-Feedback Web Launcher
echo ================================================================
echo.

REM 檢查 Node.js 是否安裝
echo %ARROW% 檢查 Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo %CROSS% 錯誤：找不到 Node.js
    echo.
    echo 請從以下位置下載並安裝 Node.js 18 或以上版本：
    echo   https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo %CHECK% Node.js 已安裝
for /f "tokens=*" %%i in ('node --version') do set "NODE_VERSION=%%i"
echo   版本：%NODE_VERSION%
echo.

REM 檢查 npm 是否安裝
echo %ARROW% 檢查 npm...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo %CROSS% 錯誤：找不到 npm
    pause
    exit /b 1
)

echo %CHECK% npm 已安裝
for /f "tokens=*" %%i in ('npm --version') do set "NPM_VERSION=%%i"
echo   版本：%NPM_VERSION%
echo.

REM 設定當前目錄
cd /d "%~dp0"
echo %ARROW% 工作目錄：%CD%
echo.

REM 如果 node_modules 不存在，則安裝依賴
if not exist "node_modules\" (
    echo %ARROW% 首次啟動，正在安裝依賴...
    echo   這可能需要幾分鐘時間...
    echo.
    call npm install --production
    if %errorlevel% neq 0 (
        echo %CROSS% 安裝依賴失敗
        echo.
        pause
        exit /b 1
    )
    echo %CHECK% 依賴安裝完成
    echo.
) else (
    echo %CHECK% 依賴已安裝
    echo.
)

REM 如果 dist 不存在，則構建項目
if not exist "dist\" (
    echo %ARROW% 首次啟動，正在構建項目...
    call npm run build
    if %errorlevel% neq 0 (
        echo %CROSS% 構建失敗
        echo.
        pause
        exit /b 1
    )
    echo %CHECK% 構建完成
    echo.
) else (
    echo %CHECK% 項目已構建
    echo.
)

REM 啟動系統
echo ================================================================
echo  🚀 正在啟動 User-Feedback Web...
echo ================================================================
echo.
echo 💡 提示：
echo   - 系統將在 http://localhost:3000 啟動
echo   - 按 Ctrl+C 停止運行
echo.

timeout /t 2 /nobreak

node dist/cli.js start

echo.
echo ================================================================
echo  已停止
echo ================================================================
pause

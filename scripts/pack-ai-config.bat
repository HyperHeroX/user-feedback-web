@echo off
REM ==============================================================================
REM 打包批次 - 打包 AI 可遵守的設定與文件
REM 功能：將指令文件和配置依照目錄結構進行打包
REM ==============================================================================

setlocal enabledelayedexpansion
cd /d "%~dp0.."

set "PACK_DIR=.ai-config-pack"
set "PACK_NAME=ai-config-%date:~0,4%%date:~5,2%%date:~8,2%-%time:~0,2%%time:~3,2%%time:~6,2%"
set "OUTPUT_FILE=!PACK_NAME!.zip"

echo.
echo ============================================================
echo AI 設定與文件打包工具
echo ============================================================
echo.
echo 打包目錄: !PACK_DIR!
echo 輸出文件: !OUTPUT_FILE!
echo.

REM 清除舊的臨時打包目錄
if exist !PACK_DIR! (
    echo 清除舊的打包目錄...
    rmdir /s /q !PACK_DIR!
)

REM 創建打包目錄結構
echo 創建目錄結構...
mkdir !PACK_DIR!\.github\instructions
mkdir !PACK_DIR!\.vscode
mkdir !PACK_DIR!\openspec\specs
mkdir !PACK_DIR!\openspec\changes
mkdir !PACK_DIR!\docs

REM 複製核心指令文件
echo 複製核心指令文件...
copy /Y "copilot-instructions.md" "!PACK_DIR!\copilot-instructions.md"
copy /Y "AGENTS.md" "!PACK_DIR!\AGENTS.md"
copy /Y "CLAUDE.md" "!PACK_DIR!\CLAUDE.md"

REM 複製 .github 下的指令文件
echo 複製 .github 指令文件...
copy /Y ".github\copilot-instructions.md" "!PACK_DIR!\.github\copilot-instructions.md"
copy /Y ".github\instructions\code-quality.instructions.md" "!PACK_DIR!\.github\instructions\code-quality.instructions.md"
copy /Y ".github\instructions\mcp-communication.instructions.md" "!PACK_DIR!\.github\instructions\mcp-communication.instructions.md"
copy /Y ".github\instructions\serena-exploration.instructions.md" "!PACK_DIR!\.github\instructions\serena-exploration.instructions.md"

REM 複製 .vscode AI 設定
echo 複製 .vscode AI 設定...
if not exist "!PACK_DIR!\.vscode" mkdir "!PACK_DIR!\.vscode"
if exist ".vscode\settings.json" (
    copy /Y ".vscode\settings.json" "!PACK_DIR!\.vscode\settings.json"
)

REM 複製配置文件
echo 複製配置文件...
if exist "openspec\specs" (
    for /r "openspec\specs" %%F in (*.*) do (
        if exist "%%F" (
            copy /Y "%%F" "!PACK_DIR!\openspec\specs\%%~nxF"
        )
    )
)

if exist "openspec\changes" (
    for /r "openspec\changes" %%F in (*.*) do (
        if exist "%%F" (
            copy /Y "%%F" "!PACK_DIR!\openspec\changes\%%~nxF"
        )
    )
)

REM 複製文檔
echo 複製文檔...
if exist "docs\MCP_SERVER_GUIDE.md" (
    copy /Y "docs\MCP_SERVER_GUIDE.md" "!PACK_DIR!\docs\MCP_SERVER_GUIDE.md"
)

REM 複製配置文件
echo 複製配置文件...
copy /Y "tsconfig.json" "!PACK_DIR!\tsconfig.json"
copy /Y "jest.config.js" "!PACK_DIR!\jest.config.js"
if exist "package.json" (
    copy /Y "package.json" "!PACK_DIR!\package.json"
)

REM 複製解包腳本供後續使用
echo 複製解包腳本...
copy /Y "scripts\unpack-ai-config.bat" "!PACK_DIR!\unpack-ai-config.bat"

REM 創建 PACK_MANIFEST.json
echo 創建打包清單...
(
    echo {
    echo   "name": "AI Configuration Package",
    echo   "version": "1.0",
    echo   "created": "%date% %time%",
    echo   "description": "AI 可遵守的設定與文件打包",
    echo   "contents": {
    echo     "root": [
    echo       "copilot-instructions.md",
    echo       "AGENTS.md",
    echo       "CLAUDE.md"
    echo     ],
    echo     ".github": [
    echo       "copilot-instructions.md",
    echo       "instructions/code-quality.instructions.md",
    echo       "instructions/mcp-communication.instructions.md",
    echo       "instructions/serena-exploration.instructions.md"
    echo     ],
    echo     ".vscode": [
    echo       "settings.json"
    echo     ],
    echo     "openspec": [
    echo       "specs/*",
    echo       "changes/*"
    echo     ],
    echo     "docs": [
    echo       "MCP_SERVER_GUIDE.md"
    echo     ],
    echo     "config": [
    echo       "tsconfig.json",
    echo       "jest.config.js",
    echo       "package.json"
    echo     ]
    echo   }
    echo }
) > "!PACK_DIR!\PACK_MANIFEST.json"

REM 進行壓縮（如果存在 7z 或 winrar）
echo.
echo 嘗試壓縮文件...

if exist "C:\Program Files\7-Zip\7z.exe" (
    echo 使用 7-Zip 進行壓縮...
    "C:\Program Files\7-Zip\7z.exe" a -tzip "!OUTPUT_FILE!" "!PACK_DIR!"
    set "COMPRESSED=1"
) else if exist "C:\Program Files (x86)\7-Zip\7z.exe" (
    echo 使用 7-Zip 進行壓縮...
    "C:\Program Files (x86)\7-Zip\7z.exe" a -tzip "!OUTPUT_FILE!" "!PACK_DIR!"
    set "COMPRESSED=1"
) else (
    echo 7-Zip 未找到，嘗試使用 PowerShell 進行壓縮...
    powershell -nologo -noprofile -command "Compress-Archive -Path '!PACK_DIR!' -DestinationPath '!OUTPUT_FILE!' -Force"
    set "COMPRESSED=1"
)

REM 驗證打包結果
echo.
if exist "!OUTPUT_FILE!" (
    for /F "usebackq" %%A in ('!OUTPUT_FILE!') do set "SIZE=%%~zA"
    echo.
    echo ============================================================
    echo ✓ 打包成功
    echo ============================================================
    echo 打包文件: !OUTPUT_FILE!
    echo 文件大小: !SIZE! 字節
    echo 打包內容:
    echo   - 核心指令文件 (copilot-instructions.md, AGENTS.md, CLAUDE.md^)
    echo   - .github 下的指令文件
    echo   - openspec 規範文件
    echo   - 配置文件
    echo   - 解包腳本
    echo.
    echo 使用方式:
    echo   1. 將 !OUTPUT_FILE! 複製到目標位置
    echo   2. 執行 unpack-ai-config.bat 進行解包
    echo.
) else (
    echo.
    echo ============================================================
    echo ✗ 打包失敗
    echo ============================================================
    echo 臨時文件已保留在: !PACK_DIR!
    echo 請檢查壓縮工具是否正確安裝
    echo.
)

REM 清理
echo 清理臨時文件...
if defined COMPRESSED (
    if "!COMPRESSED!"=="1" (
        rmdir /s /q !PACK_DIR!
        echo 臨時打包目錄已刪除
    )
)

echo.
pause

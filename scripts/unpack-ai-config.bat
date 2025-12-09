@echo off
REM ==============================================================================
REM 解包批次 - 解包 AI 可遵守的設定與文件
REM 功能：將打包文件解包並依序存放到目標位置
REM ==============================================================================

setlocal enabledelayedexpansion
cd /d "%~dp0.."

set "PACK_FILE="
set "TARGET_DIR=."

echo.
echo ============================================================
echo AI 設定與文件解包工具
echo ============================================================
echo.

REM 檢查命令行參數
if "%~1"=="" (
    echo 用法: unpack-ai-config.bat ^<pack-file^> [target-directory]
    echo.
    echo 示例:
    echo   unpack-ai-config.bat ai-config-20250210-120000.zip
    echo   unpack-ai-config.bat ai-config-20250210-120000.zip C:\target\path
    echo.
    
    REM 搜索最新的打包文件
    echo 搜索最新的打包文件...
    for /f "delims=" %%F in ('dir /b /o-d ai-config-*.zip 2^>nul') do (
        set "PACK_FILE=%%F"
        goto found_pack
    )
    
    :not_found
    echo ✗ 未找到打包文件！
    echo 請指定打包文件路徑
    echo.
    pause
    exit /b 1
    
    :found_pack
    echo 找到: !PACK_FILE!
) else (
    set "PACK_FILE=%~1"
    if not exist "!PACK_FILE!" (
        echo ✗ 文件不存在: !PACK_FILE!
        echo.
        pause
        exit /b 1
    )
)

REM 檢查目標目錄參數
if not "%~2"=="" (
    set "TARGET_DIR=%~2"
    if not exist "!TARGET_DIR!" (
        echo 創建目標目錄: !TARGET_DIR!
        mkdir "!TARGET_DIR!"
    )
)

echo.
echo 打包文件: !PACK_FILE!
echo 目標目錄: !TARGET_DIR!
echo.

REM 創建臨時解包目錄
set "TEMP_UNPACK=%TEMP%\ai-config-unpack-tmp"
if exist "!TEMP_UNPACK!" (
    rmdir /s /q "!TEMP_UNPACK!"
)
mkdir "!TEMP_UNPACK!"

REM 進行解壓
echo 解壓文件...
if exist "C:\Program Files\7-Zip\7z.exe" (
    echo 使用 7-Zip 進行解壓...
    "C:\Program Files\7-Zip\7z.exe" x "!PACK_FILE!" -o"!TEMP_UNPACK!" -y
) else if exist "C:\Program Files (x86)\7-Zip\7z.exe" (
    echo 使用 7-Zip 進行解壓...
    "C:\Program Files (x86)\7-Zip\7z.exe" x "!PACK_FILE!" -o"!TEMP_UNPACK!" -y
) else (
    echo 使用 PowerShell 進行解壓...
    powershell -nologo -noprofile -command "Expand-Archive -Path '!PACK_FILE!' -DestinationPath '!TEMP_UNPACK!' -Force"
)

if not exist "!TEMP_UNPACK!\ai-config-*" (
    set "PACK_CONTENT_DIR=!TEMP_UNPACK!"
) else (
    REM 如果解壓出現了目錄包裝，調整路徑
    for /d %%D in ("!TEMP_UNPACK!\ai-config-*") do (
        set "PACK_CONTENT_DIR=%%D"
        goto found_content
    )
    :found_content
)

REM 驗證打包清單
if exist "!PACK_CONTENT_DIR!\PACK_MANIFEST.json" (
    echo ✓ 驗證打包清單
) else (
    echo ⚠ 警告: 未找到打包清單
)

REM 開始複製文件到目標位置
echo.
echo 解包文件到目標位置...

REM 複製根目錄文件
if exist "!PACK_CONTENT_DIR!\copilot-instructions.md" (
    echo 複製 copilot-instructions.md
    copy /Y "!PACK_CONTENT_DIR!\copilot-instructions.md" "!TARGET_DIR!\copilot-instructions.md"
)

if exist "!PACK_CONTENT_DIR!\AGENTS.md" (
    echo 複製 AGENTS.md
    copy /Y "!PACK_CONTENT_DIR!\AGENTS.md" "!TARGET_DIR!\AGENTS.md"
)

if exist "!PACK_CONTENT_DIR!\CLAUDE.md" (
    echo 複製 CLAUDE.md
    copy /Y "!PACK_CONTENT_DIR!\CLAUDE.md" "!TARGET_DIR!\CLAUDE.md"
)

REM 複製 .github 目錄結構
if exist "!PACK_CONTENT_DIR!\.github" (
    echo 複製 .github 目錄結構...
    if not exist "!TARGET_DIR!\.github" mkdir "!TARGET_DIR!\.github"
    if not exist "!TARGET_DIR!\.github\instructions" mkdir "!TARGET_DIR!\.github\instructions"
    
    if exist "!PACK_CONTENT_DIR!\.github\copilot-instructions.md" (
        echo   複製 .github/copilot-instructions.md
        copy /Y "!PACK_CONTENT_DIR!\.github\copilot-instructions.md" "!TARGET_DIR!\.github\copilot-instructions.md"
    )
    
    for %%F in ("!PACK_CONTENT_DIR!\.github\instructions\*.md") do (
        echo   複製 .github/instructions/%%~nxF
        copy /Y "%%F" "!TARGET_DIR!\.github\instructions\%%~nxF"
    )
)

REM 複製 .vscode 設定
if exist "!PACK_CONTENT_DIR!\.vscode" (
    echo 複製 .vscode AI 設定...
    if not exist "!TARGET_DIR!\.vscode" mkdir "!TARGET_DIR!\.vscode"
    
    for %%F in ("!PACK_CONTENT_DIR!\.vscode\*.*") do (
        echo   複製 .vscode/%%~nxF
        copy /Y "%%F" "!TARGET_DIR!\.vscode\%%~nxF"
    )
)

REM 複製 openspec 目錄結構
if exist "!PACK_CONTENT_DIR!\openspec" (
    echo 複製 openspec 目錄結構...
    if not exist "!TARGET_DIR!\openspec" mkdir "!TARGET_DIR!\openspec"
    if not exist "!TARGET_DIR!\openspec\specs" mkdir "!TARGET_DIR!\openspec\specs"
    if not exist "!TARGET_DIR!\openspec\changes" mkdir "!TARGET_DIR!\openspec\changes"
    
    for %%F in ("!PACK_CONTENT_DIR!\openspec\specs\*.*") do (
        echo   複製 openspec/specs/%%~nxF
        copy /Y "%%F" "!TARGET_DIR!\openspec\specs\%%~nxF"
    )
    
    for %%F in ("!PACK_CONTENT_DIR!\openspec\changes\*.*") do (
        echo   複製 openspec/changes/%%~nxF
        copy /Y "%%F" "!TARGET_DIR!\openspec\changes\%%~nxF"
    )
)

REM 複製 docs 目錄
if exist "!PACK_CONTENT_DIR!\docs" (
    echo 複製 docs 目錄...
    if not exist "!TARGET_DIR!\docs" mkdir "!TARGET_DIR!\docs"
    
    for %%F in ("!PACK_CONTENT_DIR!\docs\*.*") do (
        echo   複製 docs/%%~nxF
        copy /Y "%%F" "!TARGET_DIR!\docs\%%~nxF"
    )
)

REM 複製配置文件
if exist "!PACK_CONTENT_DIR!\tsconfig.json" (
    echo 複製 tsconfig.json
    copy /Y "!PACK_CONTENT_DIR!\tsconfig.json" "!TARGET_DIR!\tsconfig.json"
)

if exist "!PACK_CONTENT_DIR!\jest.config.js" (
    echo 複製 jest.config.js
    copy /Y "!PACK_CONTENT_DIR!\jest.config.js" "!TARGET_DIR!\jest.config.js"
)

if exist "!PACK_CONTENT_DIR!\package.json" (
    echo 複製 package.json
    copy /Y "!PACK_CONTENT_DIR!\package.json" "!TARGET_DIR!\package.json"
)

REM 複製打包清單
if exist "!PACK_CONTENT_DIR!\PACK_MANIFEST.json" (
    echo 複製 PACK_MANIFEST.json
    copy /Y "!PACK_CONTENT_DIR!\PACK_MANIFEST.json" "!TARGET_DIR!\PACK_MANIFEST.json"
)

REM 清理臨時目錄
echo.
echo 清理臨時文件...
rmdir /s /q "!TEMP_UNPACK!"

REM 完成
echo.
echo ============================================================
echo ✓ 解包成功
echo ============================================================
echo 解包完成！文件已還原到:
echo   !TARGET_DIR!
echo.
echo 已解包的文件:
echo   - 核心指令文件
echo   - .github 指令文件
echo   - .vscode AI 設定
echo   - openspec 規範文件
echo   - 配置文件
echo   - 打包清單
echo.
pause

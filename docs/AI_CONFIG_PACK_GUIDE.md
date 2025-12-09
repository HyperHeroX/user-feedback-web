# AI 設定與文件打包工具

本工具用於打包和解包 AI 可遵守的設定與文件，便於跨環境部署和管理。

## 📦 打包內容

打包工具將收集以下文件和目錄結構：

### 核心指令文件

- `copilot-instructions.md` - Copilot 指令
- `AGENTS.md` - AI 代理指令
- `CLAUDE.md` - Claude 開發憲法

### .github 指令文件

- `.github/copilot-instructions.md`
- `.github/instructions/code-quality.instructions.md`
- `.github/instructions/mcp-communication.instructions.md`
- `.github/instructions/serena-exploration.instructions.md`

### OpenSpec 規範
- `openspec/specs/*` - 規範文件
- `openspec/changes/*` - 變更文件

### VS Code 設定
- `.vscode/settings.json` - Copilot 和 Chat 相關 AI 設定

### 配置文件
- `tsconfig.json` - TypeScript 配置
- `jest.config.js` - Jest 測試配置
- `package.json` - NPM 配置

### 文檔
- `docs/MCP_SERVER_GUIDE.md`

### 打包清單
- `PACK_MANIFEST.json` - 打包清單和元數據

---

## 🚀 使用方式

### 方案 1: 使用 Batch 腳本 (Windows CMD)

#### 打包

```batch
cd scripts
pack-ai-config.bat
```

腳本會：
1. 創建臨時打包目錄
2. 複製所有指定文件
3. 創建打包清單
4. 使用 7-Zip 或 PowerShell 進行壓縮
5. 輸出 `ai-config-YYYYMMDD-HHMMSS.zip`

#### 解包

```batch
cd scripts
unpack-ai-config.bat ai-config-YYYYMMDD-HHMMSS.zip
```

或自動查找最新打包文件：

```batch
cd scripts
unpack-ai-config.bat
```

指定目標目錄：

```batch
cd scripts
unpack-ai-config.bat ai-config-YYYYMMDD-HHMMSS.zip C:\target\path
```

---

### 方案 2: 使用 PowerShell 腳本

#### 打包

```powershell
.\scripts\pack-ai-config.ps1
```

選項：

```powershell
# 指定輸出文件名
.\scripts\pack-ai-config.ps1 -OutputName "custom-name.zip"

# 只準備目錄，不壓縮
.\scripts\pack-ai-config.ps1 -NoCompress
```

#### 解包

```powershell
.\scripts\unpack-ai-config.ps1 -PackFile ai-config-YYYYMMDD-HHMMSS.zip
```

指定目標目錄：

```powershell
.\scripts\unpack-ai-config.ps1 -PackFile ai-config-YYYYMMDD-HHMMSS.zip -TargetDir C:\target\path
```

自動查找最新打包文件：

```powershell
.\scripts\unpack-ai-config.ps1
```

---

## 📋 工具特性

### 打包工具特性

✅ **自動化打包**
- 按照目錄結構組織文件
- 自動檢測文件存在性
- 創建詳細的打包清單

✅ **壓縮選項**
- 優先使用 7-Zip（更好的壓縮率）
- 回退到 PowerShell 壓縮
- Batch 和 PowerShell 版本均支持

✅ **打包清單**
- 記錄打包時間和版本
- 列出所有打包文件
- 便於驗證和審計

### 解包工具特性

✅ **自動解包**
- 自動檢測打包格式
- 恢復原始目錄結構
- 依序複製所有文件

✅ **靈活部署**
- 支持指定目標目錄
- 自動創建缺失的目錄
- 自動查找最新打包文件

✅ **完整性驗證**
- 驗證打包清單
- 追蹤複製進度
- 清理臨時文件

---

## 🔄 工作流範例

### 場景 1: 本地開發環境設定

```batch
REM 在 user-feedback-web 目錄執行
scripts\pack-ai-config.bat
REM 生成 ai-config-YYYYMMDD-HHMMSS.zip

REM 在另一個環境中
scripts\unpack-ai-config.bat ai-config-YYYYMMDD-HHMMSS.zip
```

### 場景 2: 跨項目共享設定

```powershell
# 在源項目中打包
.\scripts\pack-ai-config.ps1 -OutputName "shared-ai-config.zip"

# 在目標項目中解包
.\scripts\unpack-ai-config.ps1 -PackFile shared-ai-config.zip -TargetDir .
```

### 場景 3: Docker/容器部署

```dockerfile
# 在容器構建中使用
COPY ai-config-*.zip .
RUN powershell -NoProfile -Command "Expand-Archive -Path 'ai-config-*.zip' -DestinationPath ."
```

---

## 🛠️ 故障排除

### 問題: 找不到壓縮工具

**Batch 版本:**
- 確保已安裝 7-Zip 或使用帶 PowerShell 的 Windows 10+
- 腳本會自動回退到 PowerShell 壓縮

**PowerShell 版本:**
- PowerShell 5.0+ 內置 `Compress-Archive` 和 `Expand-Archive`
- 確保執行策略允許運行腳本

### 問題: 解包文件不完整

- 檢查 `PACK_MANIFEST.json` 驗證打包內容
- 確保目標目錄有寫入權限
- 嘗試使用 `-Force` 參數覆蓋現有文件

### 問題: 權限錯誤

**Batch:**
```batch
REM 以管理員身份運行
runas /user:Administrator "scripts\pack-ai-config.bat"
```

**PowerShell:**
```powershell
# 以管理員身份運行 PowerShell
Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File scripts\pack-ai-config.ps1"
```

---

## 📝 打包清單格式 (PACK_MANIFEST.json)

```json
{
  "name": "AI Configuration Package",
  "version": "1.0",
  "created": "2025-12-10 12:00:00",
  "description": "AI 可遵守的設定與文件打包",
  "contents": {
    "root": [
      "copilot-instructions.md",
      "AGENTS.md",
      "CLAUDE.md"
    ],
    "github": [
      "copilot-instructions.md",
      "instructions/code-quality.instructions.md",
      "instructions/mcp-communication.instructions.md",
      "instructions/serena-exploration.instructions.md"
    ],
    "openspec": [
      "specs/*",
      "changes/*"
    ],
    "docs": [
      "MCP_SERVER_GUIDE.md"
    ],
    "config": [
      "tsconfig.json",
      "jest.config.js",
      "package.json"
    ]
  }
}
```

---

## ⚙️ 高級用法

### Batch: 批量打包

```batch
REM 創建多個備份
for /l %%i in (1,1,5) do (
    scripts\pack-ai-config.bat
    timeout /t 5
)
```

### PowerShell: 定期自動打包

```powershell
# 每天自動打包
$trigger = New-JobTrigger -Daily -At "2:00 AM"
Register-ScheduledJob -Name "AI-Config-Pack-Daily" `
    -ScriptBlock { & ".\scripts\pack-ai-config.ps1" } `
    -Trigger $trigger
```

### 結合 Git 進行版本管理

```powershell
# 打包並記錄到 Git
.\scripts\pack-ai-config.ps1 -OutputName "ai-config-v$(Get-Date -Format 'yyyyMMdd').zip"
git add ai-config-v*.zip
git commit -m "Update AI configuration package"
```

---

## 📞 支持

如需幫助：
1. 檢查腳本輸出的錯誤信息
2. 驗證源文件存在
3. 確保有足夠的磁盤空間
4. 檢查文件系統權限

---

## 📄 許可證

與項目主許可證相同。

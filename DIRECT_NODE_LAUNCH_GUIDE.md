# 🚀 直接 Node.js 啟動指南

本指南說明如何讓其他人在不使用 npm 的情況下，直接用 Node.js 啟動這個系統。

---

## 📋 前置要求

- **Node.js 18+**（使用者需要安裝）
- **Git**（可選，用於克隆倉庫）

---

## 方案一：直接克隆倉庫後啟動（推薦）

### 第 1 步：克隆倉庫

```bash
git clone https://github.com/HyperHeroX/user-feedback-web.git
cd user-feedback-web
```

### 第 2 步：安裝依賴

```bash
npm install --production
```

> **說明**：`--production` 標籤只安裝生產依賴，跳過開發依賴（減小體積）

### 第 3 步：構建項目

```bash
npm run build
```

### 第 4 步：啟動系統

```bash
node dist/cli.js
```

或使用特定命令：

```bash
# 啟動 MCP 伺服器
node dist/cli.js start

# 檢查健康狀態
node dist/cli.js health

# 查看版本
node dist/cli.js --version
```

---

## 方案二：打包為獨立應用（無需 npm）

### 第 1 步：在你的開發機器上準備

```bash
npm run build
npm run copy-static
```

### 第 2 步：創建發行包

創建一個 `release.zip` 包含：

```
user-feedback-web/
├── dist/                    # 編譯後的 JS 文件
├── node_modules/            # 依賴（可選但推薦）
├── src/static/              # 靜態文件
├── package.json
├── README.md
└── START.sh                 # 啟動腳本（見下方）
```

### 第 3 步：創建啟動腳本

**在 Windows 上**（`START.bat`）：

```batch
@echo off
REM User-Feedback Web Feedback Collector Launcher
REM 使用者反饋收集器啟動器

setlocal enabledelayedexpansion

REM 檢查 Node.js 是否安裝
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 錯誤：找不到 Node.js
    echo 請從 https://nodejs.org 下載並安裝 Node.js 18 或以上版本
    pause
    exit /b 1
)

REM 設定當前目錄
cd /d "%~dp0"

REM 如果 node_modules 不存在，則安裝依賴
if not exist "node_modules\" (
    echo 📦 首次啟動，正在安裝依賴...
    call npm install --production
    if %errorlevel% neq 0 (
        echo ❌ 安裝依賴失敗
        pause
        exit /b 1
    )
)

REM 如果 dist 不存在，則構建項目
if not exist "dist\" (
    echo 🔨 首次啟動，正在構建項目...
    call npm run build
    if %errorlevel% neq 0 (
        echo ❌ 構建失敗
        pause
        exit /b 1
    )
)

REM 啟動系統
echo 🚀 正在啟動 User-Feedback Web...
node dist/cli.js start

pause
```

**在 Linux/macOS 上**（`START.sh`）：

```bash
#!/bin/bash

# User-Feedback Web Feedback Collector Launcher
# 使用者反饋收集器啟動器

# 設定顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 檢查 Node.js 是否安裝
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 錯誤：找不到 Node.js${NC}"
    echo "請從 https://nodejs.org 下載並安裝 Node.js 18 或以上版本"
    exit 1
fi

# 設定當前目錄
cd "$(dirname "$0")"

# 如果 node_modules 不存在，則安裝依賴
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 首次啟動，正在安裝依賴...${NC}"
    npm install --production
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ 安裝依賴失敗${NC}"
        exit 1
    fi
fi

# 如果 dist 不存在，則構建項目
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}🔨 首次啟動，正在構建項目...${NC}"
    npm run build
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ 構建失敗${NC}"
        exit 1
    fi
fi

# 啟動系統
echo -e "${GREEN}🚀 正在啟動 User-Feedback Web...${NC}"
node dist/cli.js start
```

### 第 4 步：使用者啟動步驟

**Windows**：
1. 解壓 `release.zip`
2. 雙擊 `START.bat`

**Linux/macOS**：
```bash
unzip release.zip
cd user-feedback-web
chmod +x START.sh
./START.sh
```

---

## 方案三：Docker 容器化（最便攜）

### Dockerfile

```dockerfile
FROM node:18-alpine

# 設定工作目錄
WORKDIR /app

# 複製項目文件
COPY . .

# 安裝生產依賴並構建
RUN npm install --production && \
    npm run build

# 暴露埠
EXPOSE 3000 5555

# 啟動應用
CMD ["node", "dist/cli.js", "start"]
```

### .dockerignore

```
node_modules
dist
.git
.gitignore
README.md
CHANGELOG.md
```

### 使用者啟動步驟

```bash
# 構建 Docker 鏡像
docker build -t user-feedback-web .

# 啟動容器
docker run -p 3000:3000 -p 5555:5555 user-feedback-web
```

---

## 方案四：GitHub Releases 發行二進制版本

### 步驟：

1. **在本地構建**
   ```bash
   npm run clean
   npm run build
   npm run copy-static
   ```

2. **創建發行包**
   ```bash
   # Windows 版本
   tar -czf user-feedback-web-win-x64.tar.gz dist/ node_modules/ package.json README.md
   
   # macOS/Linux 版本
   tar -czf user-feedback-web-darwin-x64.tar.gz dist/ node_modules/ package.json README.md
   ```

3. **在 GitHub 上發布**
   - 建立新的 Release
   - 上傳壓縮文件
   - 使用者下載後解壓即可運行

---

## 方案五：在線啟動腳本（一鍵下載+運行）

### 創建 `quick-start.sh`（Linux/macOS）

```bash
#!/bin/bash

# 檢查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 需要 Node.js 18+"
    exit 1
fi

# 建立臨時目錄
mkdir -p ~/user-feedback-web
cd ~/user-feedback-web

# 克隆倉庫
git clone https://github.com/HyperHeroX/user-feedback-web.git . --depth 1

# 安裝依賴
npm install --production

# 構建
npm run build

# 啟動
node dist/cli.js start
```

### 一鍵啟動命令

```bash
curl -sSL https://raw.githubusercontent.com/HyperHeroX/user-feedback-web/main/quick-start.sh | bash
```

---

## 常見問題

### Q：使用者沒有安裝 Node.js 怎麼辦？

**A**：提供以下解決方案：

1. **使用 nvm 安裝**（推薦開發者）
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 18
   ```

2. **使用 Docker**（推薦非技術用戶）
   ```bash
   docker run user-feedback-web
   ```

3. **使用 Portable Node.js**
   - 從 [portable-node](https://github.com/npm/node-gyp/wiki/Compiling-native-modules-on-Windows) 下載
   - 或包含 Node.js 在發行包中

### Q：如何在後台運行？

**A**：使用 PM2

```bash
npm install -g pm2
pm2 start dist/cli.js --name "user-feedback"
pm2 startup
pm2 save
```

### Q：如何設定自動開機啟動？

**A**：

**Windows**：
```batch
@echo off
REM 添加到任務計劃
schtasks /create /tn "UserFeedbackWeb" /tr "node d:\path\to\dist\cli.js" /sc onlogon
```

**Linux**：
```bash
# 編輯 crontab
crontab -e

# 添加以下行
@reboot /home/user/user-feedback-web/START.sh
```

---

## 發行清單

為了提供最佳的用戶體驗，確保包含以下文件：

- [ ] `dist/` - 編譯的 JavaScript 文件
- [ ] `src/static/` - 靜態文件（HTML、CSS、JS）
- [ ] `node_modules/` - 依賴（可選）
- [ ] `package.json` - 項目配置
- [ ] `README.md` - 使用說明
- [ ] `START.bat` 或 `START.sh` - 啟動腳本
- [ ] `Dockerfile` - Docker 支援
- [ ] `LICENSE` - MIT 許可證
- [ ] `.env.example` - 環境變數範例

---

## 總結

| 方案 | 優點 | 缺點 | 適用場景 |
|------|------|------|--------|
| **直接克隆** | 簡單，體積小 | 需要 Git、npm | 開發者用戶 |
| **打包應用** | 獨立，易發行 | 體積大 | 所有用戶 |
| **Docker** | 完全隔離 | 需要 Docker | 伺服器環境 |
| **GitHub Release** | 版本管理清晰 | 需要下載 | 企業級 |
| **一鍵腳本** | 最簡單 | 需要網絡 | 初級用戶 |

**推薦選擇**：
- 開發者 → 方案一（直接克隆）
- 普通用戶 → 方案二（打包應用）+ 方案五（一鍵腳本）
- 伺服器 → 方案三（Docker）
- 企業級 → 方案四（GitHub Releases）

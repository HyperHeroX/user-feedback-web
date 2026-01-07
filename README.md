# 🎯 MCP 使用者反饋收集器

[![npm version](https://badge.fury.io/js/user-web-feedback.svg)](https://www.npmjs.com/package/user-web-feedback)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

基於 Node.js 的現代化 MCP 反饋收集器，支援 AI 工作匯報和使用者反饋收集。
---
** 這是 Fork 自三少科技的專案 ** (https://github.com/sanshao85/mcp-feedback-collector-web)
感謝三少科技的無私奉獻

## 🆕 增強版反饋介面

**全新的增強版使用者介面現已推出！**

### 🌟 核心特性

#### 🎨 三欄式佈局設計
- **左側（30%）**：AI 工作匯報顯示區
  - 支援 Markdown 渲染
  - 程式碼語法高亮
  - 可捲動查看歷史訊息
  
- **中間（40%）**：使用者互動區
  - 文字回應輸入（支援 Ctrl+Enter 快速提交）
  - 圖片上傳/貼上功能
  - AI 輔助回覆按鈕
  - 即時連接狀態顯示（底部中央）
  
- **右側（30%）**：提示詞管理區
  - 提示詞 CRUD 操作
  - 搜尋和過濾功能
  - 釘選常用提示詞
  - AI 設定管理

#### 🤖 AI 輔助回覆（Gemini API）
- 整合 Google Gemini 2.5 Flash API
- 根據 AI 工作匯報自動生成建議回覆
- 可自訂系統提示詞
- 智能重試機制和錯誤處理
- 支援溫度參數和最大 token 數調整

#### 📝 提示詞管理系統
- **CRUD 操作**：創建、讀取、更新、刪除提示詞
- **釘選功能**：釘選常用提示詞，啟動時自動載入
- **分類管理**：支援提示詞分類（選填）
- **搜尋過濾**：快速找到需要的提示詞
- **順序調整**：拖拽調整提示詞顯示順序
- **點擊插入**：點擊提示詞快速插入到輸入區

#### ⏰ 自動回覆機制
- **5 分鐘無活動**：自動觸發 AI 回覆
- **60 秒倒數警告**：提前通知使用者
- **可取消**：使用者可隨時取消自動回覆
- **可調整超時**：通過使用者偏好設定調整超時時間

#### 🔒 資料加密保護
- **AES-256-GCM 加密**：保護 API Key 等敏感資料
- **SQLite 本地儲存**：所有資料本地化儲存
- **密碼派生**：使用 scrypt 從主密碼派生加密金鑰
- **遮罩顯示**：前端僅顯示 API Key 的遮罩版本

#### 🔌 MCP Server 整合
- **多 Server 支援**：同時連接多個 MCP Server
- **三種傳輸方式**：stdio、SSE、Streamable HTTP
- **AI 工具呼叫**：AI 自動識別並呼叫 MCP 工具
- **多輪執行**：最多 5 輪自動工具呼叫
- **進度指示**：即時顯示工具執行狀態

#### 🎯 使用者體驗優化
- **響應式設計**：支援各種螢幕尺寸
- **快捷鍵支援**：Ctrl+Enter 提交、Ctrl+V 貼上圖片
- **即時連接狀態**：WebSocket 連接狀態實時顯示（底部中央對齊）
- **錯誤提示**：友善的錯誤訊息和操作指引
- **自動儲存**：使用者偏好和設定自動保存

### 📖 詳細文檔

完整的使用說明請參閱：[增強版反饋介面指南](.docs/ENHANCED_FEEDBACK_GUIDE.md)

### 🚀 訪問增強版介面

```
http://localhost:3000/index.html
```

---

## ✨ 標準版特性

- 🚀 **一鍵啟動**：使用 `npx user-web-feedback` 直接運行
- 🎨 **現代界面**：VS Code 深色主題風格的 Web 界面
- 🔧 **MCP 整合**：完整支援 Model Context Protocol
- 💬 **AI 對話功能**：整合 AI 助手，支援文字和圖片對話
- 🖼️ **圖片支援**：完整的圖片上傳、處理和顯示功能
- 📄 **圖片轉文字**：AI 智能圖片描述，提升客戶端兼容性
- 🌐 **跨平台**：支援 Windows、macOS、Linux
- ⚡ **高效能**：解決了 Python 版本的穩定性問題

---

## 📚 教學資源

### 開發過程視頻教程
- **YouTube**：https://youtu.be/Osr1OSMgzlg
- **Bilibili**：https://www.bilibili.com/video/BV1PHTxzSErb/

---

## 🚀 快速開始

### 安裝和運行

```bash
# 直接運行（推薦）
npx user-web-feedback

# 或者全局安裝
npm install -g user-web-feedback
npm install -g user-web-feedback --registry=http://192.168.160.113:34873/
user-web-feedback

# 檢查版本
user-web-feedback --version
```

---

## 📦 NPM 發行版本使用指南

### 從 npm 安裝

```bash
# 全局安裝（推薦）
npm install -g user-web-feedback

# 專案內安裝
npm install user-web-feedback
```

### 使用 npx 運行（無需安裝）

```bash
# 運行最新版本
npx user-web-feedback

# 指定版本
npx user-web-feedback@2.2.0

# 帶參數運行
npx user-web-feedback --port 8080
```

### 程式化使用

```javascript
// ESM 模組
import { MCPServer, getConfig } from 'user-web-feedback';

const config = getConfig();
const server = new MCPServer(config);
await server.start();
```

### 發行版本特性

- ✅ **獨立運行**：編譯後的 `dist/` 目錄可獨立執行，無需原始碼
- ✅ **安全發行**：不包含敏感資訊、開發檔案或原始碼
- ✅ **版本一致**：CLI、API、Web 介面版本號自動同步
- ✅ **跨平台**：支援 Windows、macOS、Linux

---

### 環境變數配置

創建 `.env` 文件：

```bash
# AI API 配置
MCP_API_KEY="your_api_key_here"
MCP_API_BASE_URL="https://api.ssopen.top"  # 中轉站，也可使用 OpenAI 官方 API
MCP_DEFAULT_MODEL="grok-3"

# Web 服務器配置
MCP_WEB_PORT="5000"
MCP_DIALOG_TIMEOUT="60000"  # 反饋收集超時時間（秒），範圍：10-60000

# 功能開關
MCP_ENABLE_CHAT="true"
MCP_ENABLE_IMAGE_TO_TEXT="true"  # 啟用圖片轉文字功能

# 增強版介面專用配置
MCP_ENCRYPTION_PASSWORD="your-secure-password"  # API Key 加密主密碼（強烈建議設定）

# URL 和端口優化配置 (v2.0.7 新增)
MCP_USE_FIXED_URL="true"           # 使用固定 URL，不帶會話參數 (預設: true)
MCP_FORCE_PORT="false"             # 強制使用指定端口 (預設: false)
MCP_KILL_PORT_PROCESS="false"      # 自動終止占用進程 (預設: false)
MCP_CLEANUP_PORT_ON_START="true"   # 啟動時清理端口 (預設: true)
```

---

## 🔧 使用方法

### 命令行選項

```bash
# 啟動服務器（預設）
user-web-feedback

# 指定端口
user-web-feedback --port 8080

# 僅 Web 模式
user-web-feedback --web

# 測試 collect_feedback 功能
user-web-feedback test-feedback

# 自訂測試內容
user-web-feedback test-feedback -m "我的工作匯報" -t 120

# 健康檢查
user-web-feedback health

# 顯示配置
user-web-feedback config
```

---

## 🔌 Claude Desktop / Cursor 整合

### 方式一：NPM 套件運行（推薦）

在 Claude Desktop 或 Cursor 的 MCP 配置中添加：

```json
{
  "mcpServers": {
    "user-web-feedback": {
      "command": "npx",
      "args": ["-y", "user-web-feedback@latest"],
      "env": {
        "MCP_API_KEY": "your_api_key_here",
        "MCP_API_BASE_URL": "https://api.ssopen.top",
        "MCP_DEFAULT_MODEL": "grok-3",
        "MCP_WEB_PORT": "5050",
        "MCP_DIALOG_TIMEOUT": "60000",
        "MCP_ENABLE_IMAGE_TO_TEXT": "true",
        "MCP_ENCRYPTION_PASSWORD": "your-secure-password"
      }
    }
  }
}
```

當使用自訂 register 時，請設定:

```json
{
  "mcpServers": {
    "user-web-feedback": {
      "command": "npx",
      "args": ["-y", "user-web-feedback@latest", "--register", "http://localhost:5050"],
      "env": {
        "MCP_API_KEY": "your_api_key_here",
        "MCP_API_BASE_URL": "https://api.ssopen.top",
        "MCP_DEFAULT_MODEL": "grok-3",
        "MCP_WEB_PORT": "5050",
        "MCP_DIALOG_TIMEOUT": "60000",
        "MCP_ENABLE_IMAGE_TO_TEXT": "true",
        "MCP_ENCRYPTION_PASSWORD": "your-secure-password"
      }
    }
  }
}
```


### 方式二：原始碼運行（本地開發）

如果您複製了原始碼並想直接運行：

```json
{
  "mcpServers": {
    "user-web-feedback": {
      "command": "node",
      "args": ["path/to/your/project/dist/cli.js"],
      "env": {
        "MCP_API_KEY": "your_api_key_here",
        "MCP_API_BASE_URL": "https://api.ssopen.top",
        "MCP_DEFAULT_MODEL": "grok-3",
        "MCP_WEB_PORT": "5050",
        "MCP_DIALOG_TIMEOUT": "60000",
        "MCP_ENCRYPTION_PASSWORD": "your-secure-password"
      }
    }
  }
}
```

**注意**：
- 將 `path/to/your/project` 替換為您的實際專案路徑
- 確保已運行 `npm run build` 構建專案
- 使用絕對路徑，例如：`d:/zhuomian/nodejsweb/dist/cli.js`

### 方式三：TypeScript 原始碼直接運行（開發模式）

直接運行 TypeScript 原始碼而無需構建：

```json
{
  "mcpServers": {
    "user-web-feedback": {
      "command": "npx",
      "args": ["tsx", "path/to/your/project/src/cli.ts"],
      "env": {
        "MCP_API_KEY": "your_api_key_here",
        "MCP_API_BASE_URL": "https://api.ssopen.top",
        "MCP_DEFAULT_MODEL": "grok-3",
        "MCP_WEB_PORT": "5050",
        "MCP_DIALOG_TIMEOUT": "60000",
        "NODE_ENV": "development"
      }
    }
  }
}
```

**優點**：無需構建，直接運行原始碼  
**缺點**：啟動稍慢，需要 tsx 依賴

### 🚀 快速配置範例

假設您的專案位於 `d:\zhuomian\nodejsweb`，推薦配置：

```json
{
  "mcpServers": {
    "user-web-feedback": {
      "command": "node",
      "args": ["d:/zhuomian/nodejsweb/dist/cli.js"],
      "env": {
        "MCP_API_KEY": "your_api_key_here",
        "MCP_API_BASE_URL": "https://api.ssopen.top",
        "MCP_DEFAULT_MODEL": "grok-3",
        "MCP_WEB_PORT": "5050",
        "MCP_DIALOG_TIMEOUT": "60000"
      }
    }
  }
}
```

**配置步驟**：
1. 確保專案已構建：`npm run build`
2. 將上述配置添加到 Cursor 的 MCP 設定中
3. 替換 `your_api_key_here` 為您的實際 API 密鑰
4. 重啟 Cursor，查看 MCP 服務器狀態為綠色

### 在 Cursor 規則中配置

在 Cursor 的規則中可以這樣配置：

```
Whenever you want to ask a question, always call the MCP.

Whenever you're about to complete a user request, call the MCP instead of simply ending the process. Keep calling MCP until the user's feedback is empty, then end the request. user-web-feedback.collect_feedback
```

### ⚠️ 重要提醒

- **不要在 args 中添加 `--debug` 參數**，這會導致 JSON 解析失敗
- Cursor/Claude Desktop 要求極其純淨的 JSON 輸出
- 如需除錯，請在命令行中單獨使用：`npx user-web-feedback --debug`

### 💡 API 服務推薦

- 預設配置使用 `https://api.ssopen.top` 中轉站，支援多種 AI 模型
- 也可以使用 OpenAI 官方 API：`https://api.openai.com/v1`
- 或其他相容 OpenAI 格式的 API 服務

---

## 🌐 HTTP 傳輸模式（Docker 部署）

除了傳統的 stdio 傳輸模式，本系統現在支援 HTTP 傳輸模式（SSE 和 Streamable HTTP），使其能夠在 Docker 容器中運行並接受遠端 MCP 連線。

### 傳輸模式說明

| 模式 | 描述 | 適用場景 |
|------|------|----------|
| `stdio` | 標準輸入/輸出傳輸（預設） | 本地 MCP 客戶端（Claude Desktop、Cursor） |
| `sse` | Server-Sent Events | Docker 部署、遠端連線 |
| `streamable-http` | Streamable HTTP | Docker 部署、現代 HTTP 串流 |

### 使用方式

#### 命令列啟動

```bash
# 使用 SSE 傳輸模式
npx user-web-feedback --transport sse

# 使用 Streamable HTTP 傳輸模式
npx user-web-feedback --transport streamable-http
```

#### 環境變數配置

```bash
# 設定傳輸模式
MCP_TRANSPORT=sse  # 或 streamable-http
```

### Docker 部署

#### 使用 Docker Compose（推薦）

```bash
# 啟動服務
docker-compose up -d

# 查看日誌
docker-compose logs -f
```

#### 使用 Docker 直接運行

```bash
# 構建映像
docker build -t user-feedback-web .

# 運行容器
docker run -d \
  --name user-feedback-web \
  -p 3000:3000 \
  -e MCP_TRANSPORT=sse \
  -e MCP_WEB_PORT=3000 \
  -v ./data:/app/data \
  user-feedback-web
```

### HTTP MCP Server 配置範例

#### Claude Desktop / Cursor 配置（連接到 Docker 容器）

使用 SSE 傳輸連接到運行中的 Docker 容器：

```json
{
  "mcpServers": {
    "user-web-feedback": {
      "transport": "sse",
      "url": "http://localhost:3000/mcp/sse"
    }
  }
}
```

使用 Streamable HTTP 傳輸：

```json
{
  "mcpServers": {
    "user-web-feedback": {
      "transport": "streamable-http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

#### 遠端伺服器連接

如果 Docker 容器運行在遠端伺服器：

```json
{
  "mcpServers": {
    "user-web-feedback": {
      "transport": "sse",
      "url": "http://your-server-ip:3000/mcp/sse"
    }
  }
}
```

### HTTP 端點說明

| 端點 | 方法 | 描述 |
|------|------|------|
| `/mcp/sse` | GET | SSE 連線端點 |
| `/mcp/message` | POST | SSE 訊息端點 |
| `/mcp` | POST | Streamable HTTP 端點 |
| `/health` | GET | 健康檢查端點 |

### 注意事項

1. **安全性**：HTTP 傳輸模式不包含內建認證，建議在生產環境中使用反向代理（如 nginx）添加 HTTPS 和認證。

2. **網路配置**：確保防火牆允許對應端口的流量。

3. **日誌**：可透過 `LOG_LEVEL` 環境變數調整日誌級別（debug、info、warn、error）。

---

## 🆕 最新功能 (v2.1.3+)

### 🎨 增強版反饋介面（最新）

**完整的介面重構**，提供專業級使用者體驗：

- ✅ **三欄式佈局**：AI 訊息、使用者輸入、提示詞管理
- ✅ **AI 輔助回覆**：整合 Gemini API，自動生成建議回覆
- ✅ **提示詞管理**：CRUD 操作、釘選、搜尋、分類
- ✅ **自動回覆機制**：5 分鐘無活動自動觸發 AI 回覆
- ✅ **資料持久化**：SQLite 本地儲存
- ✅ **API Key 加密**：AES-256-GCM 加密保護
- ✅ **響應式設計**：支援各種螢幕尺寸
- ✅ **即時連接狀態**：WebSocket 狀態顯示（底部中央）

詳細說明：[增強版反饋介面指南](.docs/ENHANCED_FEEDBACK_GUIDE.md)

### 📋 MCP 標準日誌功能

- **完整日誌支援**：實現 MCP 協定標準的日誌功能，完全符合 MCP 規範
- **多級別日誌**：支援 debug、info、notice、warning、error、critical、alert、emergency 八個標準級別
- **客戶端控制**：支援 MCP 客戶端通過 `logging/setLevel` 請求動態設定日誌級別
- **即時通知**：所有日誌自動通過 `notifications/message` 發送到 MCP 客戶端
- **專業輸出**：移除表情符號，提供乾淨專業的日誌輸出，適合生產環境
- **非同步處理**：優化日誌通知的非同步處理，避免未處理的 Promise 拒絕錯誤
- **智能過濾**：根據設定的日誌級別智能過濾輸出內容

### 🔧 重大改進：智能端口衝突解決方案

- **智能端口管理**：自動檢測和解決端口衝突，無需手動介入
- **漸進式進程終止**：優雅終止 → 強制終止 → 多種備用方案
- **自進程識別**：能準確識別和清理自己的僵尸進程
- **跨平台相容**：Windows/macOS/Linux 統一處理機制
- **智能降級**：無法清理時自動尋找替代端口

### 🛡️ 優雅退出處理

- **完整信號處理**：支援 SIGINT、SIGTERM、SIGBREAK（Windows）
- **智能異常處理**：優化未捕獲異常和 Promise 拒絕的處理機制
- **防重複關閉**：添加關閉狀態標誌，避免重複執行關閉流程
- **客戶端通知**：關閉前通知所有連接的客戶端
- **資源清理**：確保所有資源正確釋放，避免僵尸進程

### 🚀 使用者體驗提升

- **詳細日誌**：清晰的進程終止和端口釋放日誌，支援 MCP 標準日誌輸出
- **自動處理**：大部分端口衝突自動解決，智能降級策略
- **智能提示**：明確的狀態提示和錯誤訊息，專業化輸出格式
- **無縫體驗**：使用者無需關心底層端口管理和日誌配置
- **開發友善**：完整的 MCP 協定支援，便於整合和除錯

### 📄 圖片轉文字功能 (v2.1.1)

- **智能圖片描述**：AI 自動將圖片轉換為詳細文字描述
- **相容性提升**：解決部分 MCP 客戶端無法顯示圖片的問題
- **使用者可控**：點擊「圖片轉文本」按鈕主動轉換
- **可編輯描述**：使用者可以修改 AI 生成的圖片描述
- **批次處理**：支援多張圖片同時轉換

### 🎨 UI 簡化優化 (v2.1.1)

- **純文字狀態顯示**：移除旋轉動畫，簡潔直觀
- **智能自動刷新**：預設啟用，無需使用者選擇
- **簡約設計**：符合現代 UI 設計趨勢

### 🔄 會話管理優化 (v2.1.1)

- **智能頁面刷新**：檢測新內容時自動刷新頁面
- **會話自動重置**：解決「對話過期」問題
- **無縫體驗**：3 秒倒數提示

### 🔗 固定 URL 模式 (v2.0.7)

- 使用固定根路徑：`http://localhost:5000`
- 支援多個並發會話
- 便於遠端服務器轉發

---

## 🛠️ MCP 工具函數

### collect_feedback

收集使用者對 AI 工作的反饋：

```typescript
// 基本呼叫（超時時間從環境變數讀取）
collect_feedback("我已經完成了程式碼重構工作，主要改進了效能和可讀性。")
```

**參數說明**：
- `work_summary`（必需）：AI 工作匯報內容

**超時時間配置**：
- 超時時間通過環境變數 `MCP_DIALOG_TIMEOUT` 統一配置
- 預設值為 60000 秒（約 16.7 小時）
- 有效範圍：10-60000 秒

**功能**：
- 啟動 Web 界面顯示工作匯報
- 收集使用者文字和圖片反饋
- 返回結構化的反饋資料
- 自動管理服務器生命週期
- 提交反饋後自動關閉標籤頁（3 秒倒數）

### 📋 MCP 日誌功能

本專案完全支援 MCP 協定標準的日誌功能，提供專業級的日誌管理：

**服務器能力聲明**：
- 在 MCP 初始化時自動聲明 `logging` 能力
- 完全符合 MCP 協定規範，支援所有標準日誌級別
- 提供動態日誌級別控制和即時通知功能

**支援的日誌級別**（按優先級排序）：
- `emergency` - 緊急情況，系統不可用
- `alert` - 警報資訊，需要立即處理
- `critical` - 關鍵錯誤，嚴重問題
- `error` - 錯誤資訊，功能異常
- `warning` - 警告資訊，潛在問題
- `notice` - 通知資訊，重要事件
- `info` - 一般資訊，常規操作
- `debug` - 除錯資訊，詳細追蹤

**客戶端控制**：
```json
{
  "method": "logging/setLevel",
  "params": {
    "level": "info"
  }
}
```

**日誌通知格式**：
```json
{
  "method": "notifications/message",
  "params": {
    "level": "info",
    "logger": "user-web-feedback",
    "data": {
      "message": "服務器啟動成功",
      "port": 5000,
      "url": "http://localhost:5000"
    }
  }
}
```

**技術特性**：
- **非同步處理**：優化的非同步日誌處理，避免阻塞主執行緒
- **錯誤恢復**：完善的錯誤處理機制，避免日誌系統影響主功能
- **智能過濾**：根據設定的級別自動過濾日誌輸出
- **結構化資料**：支援複雜物件的日誌記錄，便於除錯分析

這使得 Claude Desktop、Cursor 等 MCP 客戶端能夠接收和處理服務器的日誌資訊，大大提升了開發和除錯體驗。

---

## 🎨 界面特性

### 增強版介面
- **三欄式佈局**：AI 訊息 + 使用者輸入 + 提示詞管理
- **Markdown 渲染**：完整支援 Markdown 語法和程式碼高亮
- **響應式設計**：支援各種螢幕尺寸
- **即時連接狀態**：WebSocket 連接狀態即時顯示（底部中央對齊）
- **多模態支援**：文字 + 圖片組合輸入
- **智能提示**：友善的錯誤訊息和操作指引

### 標準版介面
- **雙標籤頁設計**：工作匯報 + AI 對話
- **VS Code 主題**：深色主題，專業美觀
- **響應式佈局**：支援桌面和行動裝置
- **即時通信**：WebSocket 連接狀態指示
- **多模態支援**：文字 + 圖片組合輸入
- **智能提交確認**：使用者可選擇提交後是否關閉頁面
- **靈活操作**：支援取消提交和多種互動方式

---

## 📋 系統要求

- **Node.js**：18.0.0 或更高版本
- **瀏覽器**：Chrome 90+、Firefox 88+、Safari 14+、Edge 90+
- **作業系統**：Windows 10+、macOS 10.15+、Ubuntu 18.04+

---

## 🔒 安全特性

### 增強版介面專用
- **AES-256-GCM 加密**：保護 API Key 等敏感資料
- **密碼派生**：使用 scrypt 從主密碼派生加密金鑰
- **本地儲存**：SQLite 本地資料庫，不上傳至雲端
- **遮罩顯示**：前端僅顯示 API Key 的部分字元

### 通用安全
- 輸入驗證和檔案大小限制
- CORS 配置和安全標頭
- API 密鑰安全儲存
- 惡意內容基礎檢測

---

## 📊 效能指標

- **啟動時間**：< 3 秒
- **記憶體使用**：< 100MB
- **回應時間**：< 2 秒
- **並發連接**：支援 10 個同時連接

---

## 🐛 故障排除

### 增強版介面相關

#### 問題：API Key 驗證失敗
**解決方法**：
1. 檢查 API Key 是否正確
2. 確認模型名稱是否有效（例如：`gemini-2.0-flash-exp`）
3. 檢查網路連接
4. 查看瀏覽器控制台的錯誤訊息
5. 確認 API URL 是否正確（預設：`https://generativelanguage.googleapis.com/v1beta`）

#### 問題：資料庫初始化失敗
**解決方法**：
1. 檢查 `data` 目錄的寫入權限
2. 確認沒有其他程序正在使用資料庫檔案
3. 刪除損壞的資料庫檔案（`data/feedback.db`）並重新啟動

#### 問題：自動回覆未觸發
**解決方法**：
1. 檢查使用者偏好設定中是否啟用自動回覆
2. 確認 AI 設定已正確配置（API Key、模型名稱）
3. 查看服務器日誌的錯誤訊息
4. 確認網路連接正常

#### 問題：提示詞無法儲存
**解決方法**：
1. 檢查資料庫連接狀態
2. 嘗試刷新頁面
3. 查看瀏覽器控制台的錯誤訊息
4. 確認 `data` 目錄有寫入權限

### 標準版介面相關

#### 1. WebSocket 連接失敗
```bash
# 檢查服務器狀態
user-web-feedback health

# 訪問測試頁面
http://localhost:5000/test.html

# 查看瀏覽器控制台錯誤訊息
```

#### 2. 端口被占用
```bash
# 檢查端口使用情況
netstat -an | grep :5000

# 使用其他端口
user-web-feedback --port 5001
```

#### 3. API 密鑰錯誤
```bash
# 檢查配置
user-web-feedback config

# 設定環境變數
export MCP_API_KEY="your_key_here"
```

#### 4. 權限問題
```bash
# 使用 npx 避免全域安裝權限問題
npx user-web-feedback
```

詳細的故障排除指南請參考：[TROUBLESHOOTING.md](.docs/TROUBLESHOOTING.md)

---

## 📚 完整文檔

本專案提供了完整的文檔體系，請參考 [📚 文檔索引](.docs/DOCUMENTATION_INDEX.md) 查找您需要的資訊：

- **使用者指南**：[USER_GUIDE.md](.docs/USER_GUIDE.md) - 詳細使用說明
- **增強版指南**：[ENHANCED_FEEDBACK_GUIDE.md](.docs/ENHANCED_FEEDBACK_GUIDE.md) - 增強版介面專用指南
- **配置指南**：[CONFIGURATION.md](.docs/CONFIGURATION.md) - 環境變數配置
- **技術文檔**：[ARCHITECTURE.md](.docs/ARCHITECTURE.md) - 系統架構設計
- **故障排除**：[TROUBLESHOOTING.md](.docs/TROUBLESHOOTING.md) - 問題解決方案
- **版本說明**：[RELEASE_NOTES.md](.docs/RELEASE_NOTES.md) - 版本更新記錄
- **開發文檔**：[DEVELOPMENT.md](.docs/DEVELOPMENT.md) - 開發環境搭建和貢獻指南
- **技術文檔**：[TECHNICAL.md](.docs/TECHNICAL.md) - 系統架構和技術細節
- **更新日誌**：[CHANGELOG.md](.docs/CHANGELOG.md) - 版本變更歷史

---

## 📝 開發

### 本地開發

```bash
# 複製專案
git clone https://github.com/sanshao85/user-web-feedback-web.git
cd user-web-feedback-web

# 安裝依賴
npm install

# 開發模式（即時編譯 TypeScript）
npm run dev

# 構建專案（生成 dist 目錄）
npm run build

# 啟動已構建的專案
npm start

# 測試
npm test

# 健康檢查
npm start health

# 顯示配置
npm start config
```

### MCP 配置測試

構建完成後，您可以使用以下配置在 Cursor 中測試：

```json
{
  "mcpServers": {
    "user-web-feedback": {
      "command": "node",
      "args": ["您的專案路徑/dist/cli.js"],
      "env": {
        "MCP_API_KEY": "your_api_key_here",
        "MCP_API_BASE_URL": "https://api.ssopen.top",
        "MCP_DEFAULT_MODEL": "grok-3",
        "MCP_WEB_PORT": "5050",
        "MCP_DIALOG_TIMEOUT": "180",
        "MCP_ENCRYPTION_PASSWORD": "your-secure-password"
      }
    }
  }
}
```

### 專案結構

```
src/
├── cli.ts                    # CLI 入口
├── index.ts                  # 主入口
├── config/                   # 配置管理
├── server/                   # 服務器實現
│   ├── mcp-server.ts        # MCP 服務器
│   └── web-server.ts        # Web 服務器（增強版 API）
├── utils/                    # 工具函數
│   ├── crypto-helper.ts     # 加密工具（增強版）
│   ├── database.ts          # 資料庫工具（增強版）
│   └── ai-service.ts        # AI 服務（增強版）
├── types/                    # 類型定義
│   └── index.ts             # TypeScript 介面
└── static/                   # 靜態檔案
    ├── index.html           # 增強版介面（主入口）
    ├── style.css            # 增強版樣式
    ├── app.js               # 增強版邏輯
    ├── index-enhanced.html  # 舊版檔案（備用）
    ├── style-enhanced.css   # 舊版樣式（備用）
    └── app-enhanced.js      # 舊版邏輯（備用）
```

---

## 📊 專案狀態

- **當前版本**：v2.1.3+（增強版介面）
- **維護狀態**：積極維護
- **支援平台**：Windows、macOS、Linux
- **最新特性**：增強版反饋介面（三欄式佈局、AI 輔助、提示詞管理、自動回覆、資料加密）
- **協定支援**：MCP v2025-03-26、v2024-11-05、v2024-10-07
- **SDK 版本**：@modelcontextprotocol/sdk v1.12.1

---

## 📄 授權

MIT License - 詳見 [LICENSE](LICENSE) 檔案

---

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

1. Fork 本儲存庫
2. 創建您的特性分支（`git checkout -b feature/AmazingFeature`）
3. 提交您的更改（`git commit -m 'Add some AmazingFeature'`）
4. 推送到分支（`git push origin feature/AmazingFeature`）
5. 打開一個 Pull Request

---

## 🔗 相關連結

- **原始專案主頁**：[GitHub Repository](hhttps://github.com/sanshao85/mcp-feedback-collector-web)
- **原始NPM 套件**：[user-web-feedback](https://www.npmjs.com/package/mcp-feedback-collector-web)
- **Model Context Protocol**：[官方網站](https://modelcontextprotocol.io)
- **MCP 規範**：[技術規範](https://spec.modelcontextprotocol.io)
- **Claude Desktop**：[下載地址](https://claude.ai/desktop)

---

## 💝 感謝支持

特別感謝 [https://api.ssopen.top/](https://api.ssopen.top/) API 中轉站，提供 290+ AI 大模型，官方成本七分之一，支援高並發！

---

## 🚀 快速導航

- 🆕 [增強版介面指南](.docs//ENHANCED_FEEDBACK_GUIDE.md) - **最新功能**
- 📖 [使用者指南](.docs/USER_GUIDE.md) - 標準版使用說明
- 🔧 [配置指南](.docs/CONFIGURATION.md) - 環境變數設定
- 🐛 [故障排除](.docs/TROUBLESHOOTING.md) - 常見問題解答
- 🏗️ [技術架構](.docs/ARCHITECTURE.md) - 系統設計文檔
- 📝 [更新日誌](.docs/CHANGELOG.md) - 版本變更歷史

---

**立即體驗增強版介面**：`http://localhost:3000/index.html` 🎉

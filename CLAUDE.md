# AI 開發憲法 - user-feedback-web

本文件定義了所有 AI 助手在此專案中必須遵守的核心規則。

---

## 🚨 Non-Negotiable 核心指令

### 1. 強制使用 Serena MCP 工具進行原始碼探索

- **所有源代碼探索和分析必須優先使用 Serena MCP 工具箱**
- **僅當 Serena MCP 無相關可用工具時，才可嘗試其他工具**
- 優先使用符號管理工具而非直接讀取完整檔案
- 使用 `get_symbols_overview` 獲取檔案結構概覽
- 使用 `find_symbol` 進行精確的符號查詢
- 使用 `search_for_pattern` 進行模式搜尋
- 每次新任務開始使用 `/speckit.implement` 進行結構化開發

### 2. 任何詢問與報告之前都必須使用 User Feedback 通知並等待回應

**重要：在提交任何詢問、報告或建議前，必須使用 `mcp_user-feedback_collect_feedback` 工具通知用戶並等待回應**

適用場景：

- 源代碼修改建議
- 架構變更方案
- API 設計改進
- 效能優化建議
- 安全性改進方案
- 任何可能影響現有功能的改動
- 重大進度（里程碑或任務完成）
- 遇到攔截者或錯誤
- 需要用戶決策或澄清

### 3. 通訊協議: MCP 專用且必須嚴格遵守

- 所有通訊必須**獨家使用 user feedback MCP**
- 必須確認通道是 MCP 後再進行任何輸出
- 中間步驟應靜默執行，不報告

### 4. 自主工作流: 持續執行

- 發送 MCP 後，收到 'continue' 或類似命令時立即恢復任務
- 只有明確指示暫停時才中斷
- **任務完成且無報告條件時自動進行下一個任務**
- **任務完成後立即開始下一個待辦項，除非遇到攔截者**

### 5. 行動導向: 立即行動

- 收到 user feedback MCP 回復後**立即執行具體任務相關行動**
- **每次用戶 MCP 回復後，必須在發送下一個 MCP 前執行至少一個代碼倉庫操作**
- 確保每次交換都有具體進度

### 6. Commit 前置檢查 (必須全部通過)

**進行任何 Git Commit 之前，必須確認以下所有條件均已達成：**

1. ✅ **編譯無錯誤** - 後端 `dotnet build` 和前端 `npm run build` 均成功
2. ✅ **單元測試無錯誤** - 所有後端單元測試通過
3. ✅ **前端 UI 測試無錯誤** - 前端元件測試通過
4. ✅ **瀏覽器 UI 測試無錯誤** - 使用 Browser Automation Tools 進行 E2E 測試

### 7. 程式碼品質規範 (禁止事項)

**以下行為嚴禁出現：**

- ❌ **不要添加多餘註解** - 不增加人類不會添加或與文件其餘部分風格不一致的註解
- ❌ **不要過度防禦性編碼** - 不在已驗證路徑添加不必要的 try/catch 區塊或防禦性檢查
- ❌ **不要強制轉型繞過類型問題** - 不為了解決類型錯誤而進行不安全的強制轉換
- ❌ **不要破壞程式碼風格一致性** - 不提交與當前文件風格不一致的程式碼

---

## 📚 專案特定指南

### 技術堆疊

- **後端**: Node.js + TypeScript + Express
- **資料庫**: SQLite (better-sqlite3)
- **前端**: 原生 HTML/CSS/JavaScript
- **通訊**: Socket.IO (WebSocket)
- **MCP**: Model Context Protocol SDK

### 開發指令

```bash
# 開發模式
npm run dev

# 構建
npm run build

# 測試
npm test

# 啟動
npm start
```

### 注意事項

1. **資料庫模組**: 使用 `better-sqlite3`，已配置 `postinstall` 腳本自動重建以適應不同 Node.js 版本
2. **加密**: API Key 使用 AES-256-GCM 加密存儲
3. **靜態文件**: 位於 `src/static/`，構建時自動複製到 `dist/static/`

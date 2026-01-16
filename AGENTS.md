<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

---

## 🚨 Non-Negotiable 核心指令

### 0.強制優先使用Skills進行開發

- **所有開發必須優先使用Skills進行開發**
- **僅當Skills無相關可用工具時，才可嘗試其他工具**

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
**當User Feedback無法使用時，請使用相關MCP重新啟動工具**
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

1. ✅ **版本號必須增加** - **每次簽入必須增加版本尾號（patch version）**，例如 `2.6.0` → `2.6.1`
2. ✅ **編譯無錯誤** - 後端 `dotnet build` 和前端 `npm run build` 均成功
3. ✅ **單元測試無錯誤** - 所有後端單元測試通過
4. ✅ **前端 UI 測試無錯誤** - 前端元件測試通過
5. ✅ **瀏覽器 UI 測試無錯誤** - 使用 Browser Automation Tools 進行 E2E 測試
6. ✅ **Jest 測試無異步洩漏** - 測試完成後不得出現 `Jest did not exit one second after the test run has completed` 警告，若出現必須立即修復

### 7. 程式碼品質規範 (禁止事項)

**以下行為嚴禁出現：**

- ❌ **不要添加多餘註解** - 不增加人類不會添加或與文件其餘部分風格不一致的註解
- ❌ **不要過度防禦性編碼** - 不在已驗證路徑添加不必要的 try/catch 區塊或防禦性檢查
- ❌ **不要強制轉型繞過類型問題** - 不為了解決類型錯誤而進行不安全的強制轉換
- ❌ **不要破壞程式碼風格一致性** - 不提交與當前文件風格不一致的程式碼

### 8. 當 MCP Tools 無法使用時，但該工具存在於列表中，請關閉後再重新啟動 MCP Server

- 當 MCP Tools 無法使用時，但該工具存在於列表中，請關閉後再重新啟動 MCP Server
- 請使用 `mcp_server_restart` 工具關閉後再重新啟動 MCP Server

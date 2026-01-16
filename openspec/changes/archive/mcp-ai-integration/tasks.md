# Tasks: MCP AI Integration

## Task List

### T1: 建立 MCP 工具呼叫解析器
**狀態**: 未開始
**檔案**: `src/utils/mcp-tool-parser.ts`

**描述**:
建立工具呼叫 JSON 解析器，能夠從 AI 回覆中提取 `tool_calls` 結構。

**驗收標準**:
- [ ] 解析完整 JSON 格式的 tool_calls
- [ ] 從 markdown code block 中提取 JSON
- [ ] 處理無效格式不崩潰（容錯）
- [ ] 返回解析結果和訊息文字

---

### T2: 修改 ai-service.ts 支援工具描述注入
**狀態**: 未開始
**檔案**: `src/utils/ai-service.ts`

**描述**:
修改 `buildPrompt` 和 `generateAIReply` 函數，支援注入 MCP 工具描述。

**驗收標準**:
- [ ] `buildPrompt` 接受 `mcpTools` 參數
- [ ] 正確格式化工具描述（名稱、描述、inputSchema）
- [ ] 包含 JSON 呼叫格式範例
- [ ] `generateAIReply` 支援 `includeMCPTools` 選項
- [ ] 支援 `toolResults` 參數用於後續輪處理

---

### T3: 新增工具執行 API 端點（單個）
**狀態**: 未開始
**檔案**: `src/server/web-server.ts`

**描述**:
新增 `/api/mcp/execute-tool` 端點，用於執行單個 MCP 工具呼叫。

**驗收標準**:
- [ ] 端點正確路由 POST /api/mcp/execute-tool
- [ ] 驗證請求參數（toolName, arguments）
- [ ] 調用 `mcpClientManager.callTool`
- [ ] 正確返回結果或錯誤

---

### T4: 新增批次工具執行 API 端點
**狀態**: 未開始
**檔案**: `src/server/web-server.ts`

**描述**:
新增 `/api/mcp/execute-tools` 端點，用於批次執行多個 MCP 工具呼叫。

**驗收標準**:
- [ ] 端點正確路由 POST /api/mcp/execute-tools
- [ ] 接受 `calls` 陣列
- [ ] 並行執行多個工具呼叫
- [ ] 返回所有結果（包含成功和失敗）

---

### T5: 修改 /api/ai-reply 端點
**狀態**: 未開始
**檔案**: `src/server/web-server.ts`

**描述**:
修改現有 `/api/ai-reply` 端點，支援 `includeMCPTools` 和 `toolResults` 參數。

**驗收標準**:
- [ ] 接受新參數
- [ ] 當 `includeMCPTools=true` 時獲取並注入工具描述
- [ ] 當有 `toolResults` 時注入工具執行結果到 prompt

---

### T6: 前端執行迴圈實作
**狀態**: 未開始
**檔案**: `src/static/app.js`

**描述**:
實現 `generateAIReplyWithTools` 函數，支援多輪工具呼叫執行。

**驗收標準**:
- [ ] 解析 AI 回覆中的 tool_calls JSON
- [ ] 執行工具呼叫（調用 /api/mcp/execute-tools）
- [ ] 將結果回傳 AI 進行下一輪
- [ ] 最多執行 5 輪
- [ ] 第 5 輪時顯示確認對話框
- [ ] 正確處理錯誤

---

### T7: 進度 UI 組件實作
**狀態**: 未開始
**檔案**: `src/static/app.js`, `src/static/index.html`, `src/static/style.css`

**描述**:
實現工具執行進度指示器和確認對話框。

**內容**:
- [ ] 進度 UI HTML 結構
- [ ] CSS 樣式
- [ ] 顯示當前輪數 (1-5)
- [ ] 顯示工具執行狀態（執行中/成功/失敗）
- [ ] 第 5 輪確認對話框

---

### T8: 瀏覽器 UI 測試
**狀態**: 未開始
**工具**: Browser Automation Tools

**描述**:
使用瀏覽器自動化工具測試完整流程。

**測試案例**:
- [ ] 連接 MCP Server（如 time-server）
- [ ] 觸發 AI 回覆
- [ ] 驗證工具描述已注入到 prompt
- [ ] 驗證 tool_calls JSON 被正確解析
- [ ] 驗證工具呼叫被執行
- [ ] 驗證進度 UI 正確顯示
- [ ] 測試第 5 輪確認對話框

---

### T9: 更新 README 和文檔
**狀態**: 未開始
**檔案**: `README.md`, `docs/MCP_SERVER_GUIDE.md`

**描述**:
更新文檔，說明 MCP AI 整合功能的使用方式。

**內容**:
- [ ] README 新增 MCP AI 整合章節
- [ ] MCP_SERVER_GUIDE 新增 AI 呼叫說明
- [ ] 提供工具呼叫格式說明
- [ ] 提供使用範例

---

## 依賴關係

```
T1 (解析器) ─────┐
                 ├──▶ T6 (前端迴圈) ──┬──▶ T8 (測試)
T2 (ai-service) ─┤                    │
                 │                    │
T3 (execute-tool)┤                    │
                 │                    │
T4 (execute-tools)                    │
                 │                    │
T5 (ai-reply API)┘                    │
                                      │
                          T7 (UI組件) ┘
                                        
                                        ▼
                                  T9 (文檔)
```

## 執行順序建議

1. **Phase 1 - 後端**
   - T1 (解析器)
   - T2 (ai-service)
   - T3 (execute-tool API)
   - T4 (execute-tools API)
   - T5 (ai-reply API 修改)

2. **Phase 2 - 前端**
   - T6 (執行迴圈)
   - T7 (UI 組件)

3. **Phase 3 - 驗證**
   - T8 (瀏覽器測試)
   - T9 (文檔更新)

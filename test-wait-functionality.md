# 測試 MCP Server 等待用戶反饋功能

## ✅ 功能確認

**您需要的功能已經實現！** MCP Client 調用 `collect_feedback` 後會等待用戶提交反饋，不會立即斷開。

## 🔍 實現原理

### 1. Promise 機制
```typescript
// web-server.ts 第 1119 行
return new Promise((resolve, reject) => {
  // 創建會話，保存 resolve 和 reject
  const session: SessionData = {
    resolve,  // ← Promise 的 resolve 保存在這裡
    reject,
    // ...
  };
});
```

### 2. 等待用戶提交
- MCP Client 調用後，Promise 處於 **pending 狀態**
- 只有用戶在瀏覽器中提交反饋後，才會調用 `session.resolve()`
- 這時 Promise 才會 resolve，MCP Client 才收到結果

### 3. 超時處理
- 默認超時：60 秒（可通過 `MCP_DIALOG_TIMEOUT` 配置）
- 超時後 SessionStorage 會自動清理會話並 reject Promise

## 🧪 如何測試

### 方法 1: 使用 Claude Desktop

1. **配置 MCP Server**:
```json
{
  "mcpServers": {
    "user-web-feedback": {
      "command": "npx",
      "args": ["-y", "user-web-feedback@latest"],
      "env": {
        "MCP_DIALOG_TIMEOUT": "300"  // 5 分鐘超時
      }
    }
  }
}
```

2. **重啟 Claude Desktop**

3. **測試對話**:
```
你: 請使用 collect_feedback 工具收集我的反饋

Claude: [調用 collect_feedback]
        ⏳ 這裡會等待...
        
[瀏覽器打開反饋頁面]
[您提交反饋]

Claude: ✅ 收到您的反饋: "..."
        [繼續處理]
```

### 方法 2: 直接運行查看日誌

```bash
# 設置環境變數
set MCP_DIALOG_TIMEOUT=300
set MCP_LOG_LEVEL=debug

# 啟動服務器
npx user-web-feedback
```

**預期日誌輸出**:
```
🔄 MCP Server 開始等待用戶反饋... (超時: 300秒)
📌 注意: collect_feedback 調用會阻塞直到用戶提交反饋或超時
🔄 創建 Promise 等待用戶提交反饋...
📋 會話 ID: abc123
⏱️  超時設置: 300 秒
🔗 反饋頁面將在瀏覽器中打開

[等待中...]

✅ 單次模式會話 abc123: 用戶已提交反饋，準備 resolve Promise
🎯 調用 session.resolve()，MCP Client 將收到結果並繼續執行
✅ 反馈收集完成，收到 1 条反馈
```

## 🐛 可能的問題排查

### 問題 1: "MCP Client 立即斷開連接"

**可能原因**:
1. **超時設置太短**: 默認 60 秒可能不夠
   - **解決**: 增加 `MCP_DIALOG_TIMEOUT` 到 300 或更高

2. **MCP Client 自身超時**: Claude Desktop 可能有獨立的超時限制
   - **解決**: 查看 Claude Desktop 日誌

3. **瀏覽器未打開**: 如果打開失敗，用戶無法提交
   - **解決**: 檢查系統預設瀏覽器設置

### 問題 2: "Promise 沒有 resolve"

**檢查點**:
```typescript
// 確認會話中有 resolve 函數
if (!session.resolve) {
  console.error("⚠️ 會話沒有 resolve 函數！");
}
```

查看日誌中是否有這個警告。

### 問題 3: "超時過早觸發"

**檢查**:
- SessionStorage 的清理邏輯（`session-storage.ts` 的 `cleanupExpiredSessions()`）
- 確認 timeout 值正確傳遞

## 📊 增強的日誌輸出

現在代碼包含詳細日誌，幫助診斷問題：

### 開始等待
```
🔄 MCP Server 開始等待用戶反饋... (超時: 300秒)
📌 注意: collect_feedback 調用會阻塞直到用戶提交反饋或超時
```

### Promise 創建
```
🔄 創建 Promise 等待用戶提交反饋...
📋 會話 ID: abc123
⏱️  超時設置: 300 秒
🔗 反饋頁面將在瀏覽器中打開
```

### 用戶提交
```
✅ 單次模式會話 abc123: 用戶已提交反饋，準備 resolve Promise
🎯 調用 session.resolve()，MCP Client 將收到結果並繼續執行
```

### 完成
```
✅ 反馈收集完成，收到 1 条反馈
```

## 🎯 結論

**功能已經正確實現**！如果您遇到問題：

1. ✅ 檢查超時設置（建議 300 秒或更高）
2. ✅ 查看增強的日誌輸出
3. ✅ 確認瀏覽器能正常打開
4. ✅ 檢查 MCP Client 的超時設置

如果問題持續，請分享完整的日誌輸出以便進一步診斷。

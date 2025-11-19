## 修復摘要：MCP 伺服器靜態文件路徑問題

### 問題描述
當使用 MCP 從 Claude Desktop 或其他應用程式調用時，Web 伺服器出現以下錯誤：
```
{"error":"Internal Server Error","message":"ENOENT: no such file or directory, stat 'C:\\Users\\Hiro\\static\\index.html'"}
```

這是因為 MCP 在啟動時的工作目錄 (`process.cwd()`) 不一定是項目根目錄，導致靜態文件路徑解析錯誤。

### 根本原因
在 `src/server/web-server.ts` 中的 `getStaticAssetsPath()` 方法使用 `process.cwd()` 來構建靜態文件的路徑。當 MCP 從非項目目錄啟動時（例如從用戶主目錄），這會導致路徑不正確。

### 解決方案
修改 `getStaticAssetsPath()` 方法，使用模塊的實際位置（通過 `import.meta.url` 和 `fileURLToPath`）而不是 `process.cwd()` 來確定項目根目錄。

#### 具體變更
1. 在 `web-server.ts` 中引入 `fileURLToPath`：
   ```typescript
   import { fileURLToPath } from 'url';
   ```

2. 更新 `getStaticAssetsPath()` 方法：
   - 使用 `import.meta.url` 獲取當前模塊的完整 URL
   - 通過 `fileURLToPath` 轉換為文件路徑
   - 計算正確的項目根目錄（向上 2 級：server → src/dist → 項目根）
   - 保留 `process.cwd()` 作為備選方案

#### 新的路徑解析邏輯
```typescript
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

// 檢查路徑候選項：
// 1. {projectRoot}/dist/static (優先)
// 2. {projectRoot}/src/static
// 3. {process.cwd()}/dist/static (備選)
// 4. {process.cwd()}/src/static (備選)
```

### 驗證修復
在不同的工作目錄中啟動 MCP 伺服器時，靜態文件現在可以正確定位：
- ✓ 從項目目錄啟動：找到 `dist/static`
- ✓ 從其他目錄啟動：仍然正確解析項目根目錄

### 影響
- **向前兼容**：完全向後相容，不破壞現有功能
- **改進**：MCP 現在可以從任何目錄啟動而不會出現路徑問題
- **デバッグ**：新增了調試日誌來追蹤靜態文件目錄的發現

### 文件變更
- `src/server/web-server.ts` - 修改 `getStaticAssetsPath()` 方法
- 構建後自動更新 `dist/server/web-server.js`

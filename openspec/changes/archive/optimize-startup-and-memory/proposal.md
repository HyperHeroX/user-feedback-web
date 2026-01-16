# Change: Optimize MCP Startup Time and Memory Usage

## Why

使用 `npx -y @hiro-tools/user-web-feedback@latest` 啟動 MCP Server 時存在兩個關鍵問題：

1. **啟動時間過長**：由於 tsup 將大量套件打包為 `noExternal`（如 jimp ~800KB、socket.io、marked 等），每次透過 npx 執行時都需要完整解析超過 5MB 的打包檔案，導致 Cursor/VSCode MCP 客戶端啟動超時。

2. **記憶體使用量過高**：所有功能模組（圖片處理、資料庫、MCP 客戶端管理等）在 WebServer 建構時即同步初始化，無論是否使用，造成不必要的記憶體消耗。

## What Changes

### 1. 套件外部化 (Externalization)
- 將大型套件從 `noExternal` 移至 `external`，減少打包體積
- 調整 npm 發布策略，確保預編譯產物包含在發布內容中

### 2. 延遲載入 (Lazy Loading)
- 圖片處理模組 (Jimp) 改為延遲載入，僅在實際呼叫圖片處理功能時才載入
- MCP 客戶端管理器改為按需初始化
- 資料庫初始化改為延遲執行（非 MCP 核心功能時）

### 3. 輕量啟動模式 (Lightweight Mode)
- 新增 MCP Server 輕量模式，僅載入核心 MCP 功能
- Web 伺服器功能按需啟動

## Impact

- Affected specs: 無現有 spec 需修改
- Affected code:
  - `tsup.config.ts` - 打包配置調整
  - `src/server/web-server.ts` - 延遲載入實作
  - `src/utils/image-processor.ts` - 延遲載入 Jimp
  - `src/utils/database.ts` - 延遲初始化
  - `package.json` - 依賴分類調整

## Success Criteria

1. `npx -y @hiro-tools/user-web-feedback@latest` 啟動時間 < 5 秒
2. MCP 客戶端（如 Cursor）不再出現啟動超時
3. 基礎記憶體使用量降低至少 30%

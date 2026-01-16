# Tasks: prepare-npm-release

## Phase 1: 機密清理

- [ ] **1.1** 掃描所有檔案中的機密內容
  - 檔案：全專案
  - 驗證：`grep -r "sk-[a-zA-Z0-9]\{20,\}" . --exclude-dir=node_modules --exclude="logger.ts"`

- [ ] **1.2** 清理 `.docs/CONFIGURATION.md` 中的真實 API Key
  - 檔案：`.docs/CONFIGURATION.md`
  - 動作：將 `sk-zhdAJNyzSg1vAeoGhAaY5cnaMgDuvs0Q9H5LirPUuWW7hQGr` 替換為 `your-api-key-here`
  - 驗證：檔案不包含真實金鑰

- [ ] **1.3** 確認 `.npmignore` 排除敏感目錄
  - 檔案：`.npmignore`
  - 驗證：確認 `.docs/` 已被排除

## Phase 2: 版本機制建立

- [ ] **2.1** 修改 `src/index.ts` 從 package.json 動態讀取版本
  - 檔案：`src/index.ts`
  - 動作：使用 `createRequire` 或 `fs` 讀取 package.json 版本
  - 驗證：版本號與 package.json 一致

- [ ] **2.2** 同步 `src/server/mcp-server.ts` 版本引用
  - 檔案：`src/server/mcp-server.ts`
  - 動作：從 `index.ts` 導入 VERSION
  - 驗證：MCP server info 顯示正確版本

## Phase 3: 前端版本顯示

- [ ] **3.1** 在首頁新增版本顯示元素
  - 檔案：`src/static/index.html`
  - 動作：在連接狀態旁新增版本顯示區塊
  - 驗證：HTML 包含 `id="version-display"` 元素

- [ ] **3.2** 實作前端版本載入邏輯
  - 檔案：`src/static/app.js`
  - 動作：在 `loadInitialData()` 中調用 `/api/version` 並更新 UI
  - 驗證：瀏覽器顯示版本號

## Phase 4: 測試驗證

- [ ] **4.1** 瀏覽器 UI 測試
  - 動作：使用瀏覽器自動化工具測試首頁版本顯示
  - 驗證：版本號正確顯示在頁面上

- [ ] **4.2** 打包發行模擬測試
  - 動作：執行 `npm pack` 並在隔離環境安裝測試
  - 驗證：
    - tarball 不包含原始碼 (src/)
    - tarball 不包含機密檔案 (.docs/, .env)
    - 安裝後可正常執行 `npx user-web-feedback --version`

## Phase 5: 文檔更新

- [ ] **5.1** 更新 README.md 發行版本使用說明
  - 檔案：`README.md`
  - 動作：新增 npm 發行版本使用章節
  - 驗證：包含完整的安裝和使用指南

## Dependencies

```
1.1 ─┬─▶ 1.2 ─▶ 1.3
     │
2.1 ─┴─▶ 2.2
     │
3.1 ─┴─▶ 3.2
     │
     └───▶ 4.1 ─▶ 4.2 ─▶ 5.1
```

## Validation Checklist

- [ ] `npm run build` 成功
- [ ] `npm test` 通過
- [ ] 瀏覽器 UI 測試通過
- [ ] `npm pack` 驗證通過
- [ ] 機密掃描通過

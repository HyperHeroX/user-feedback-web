## 1. 套件配置調整

- [x] 1.1 修改 `tsup.config.ts`，將 jimp 從 noExternal 移除
- [x] 1.2 修改 `package.json`，將 jimp 從 devDependencies 移至 optionalDependencies
- [x] 1.3 驗證建置後的打包檔案大小降低 (5.2MB -> 3.6MB, 減少 ~30%)

## 2. 延遲載入實作

- [x] 2.1 建立 `src/utils/lazy-loader.ts` 延遲載入工具
- [x] 2.2 修改 `ImageProcessor` 為延遲載入模式 (動態 import jimp)
- [x] 2.3 修改 `WebServer` 建構子，移除同步初始化
- [x] 2.4 實作 jimp 載入失敗的優雅降級

## 3. 資料庫延遲初始化

- [x] 3.1 修改 `initDatabase()` 為延遲呼叫模式
- [x] 3.2 確保首次資料庫存取時自動初始化 (WebServer.start() 觸發)
- [x] 3.3 新增資料庫連線狀態檢查 (dbInitialized flag)

## 4. 靜態資源路徑修正

- [x] 4.1 修正 `getStaticAssetsPath()` 支援 tsup 打包模式
- [ ] 4.2 新增路徑解析除錯日誌

## 5. 測試與驗證

- [x] 5.1 更新現有單元測試以適應延遲載入
- [ ] 5.2 新增啟動時間效能測試
- [ ] 5.3 新增記憶體使用量測試
- [x] 5.4 執行 `pnpm test` 確保所有測試通過 (199/199 passed)
- [x] 5.5 執行 `pnpm build` 確保建置成功
- [ ] 5.6 使用 `npx` 模擬安裝測試啟動時間

## 6. 文件更新

- [ ] 6.1 更新 README.md 說明記憶體優化
- [ ] 6.2 新增效能調校說明（如有需要）

## Dependencies

- Task 2.x 依賴 Task 1.x（需先完成套件調整）
- Task 5.x 依賴 Task 2.x, 3.x（需先完成實作）
- Task 4.1 已完成（靜態資源路徑修正）

## Parallelizable Work

- Task 1.x 和 Task 3.x 可並行
- Task 6.x 可在任何時間點執行

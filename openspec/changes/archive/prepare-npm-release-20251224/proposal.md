# Change Proposal: prepare-npm-release

## Summary

準備 npm 發行版本，確保編譯後的檔案可獨立執行、移除機密內容、建立版本機制，並在首頁顯示版本資訊。

## Motivation

當前專案存在以下問題需要解決：

1. **機密洩漏風險**：`.docs/CONFIGURATION.md` 中包含真實的 API Key (`sk-zhdAJNyzSg1vAeoGhAaY5cnaMgDuvs0Q9H5LirPUuWW7hQGr`)
2. **版本不一致**：`package.json` 版本 (2.1.4) 與原始碼中的 VERSION 常數 (2.1.3) 不同步
3. **前端無版本顯示**：首頁 (index.html) 沒有顯示當前版本號
4. **缺乏發行自動化**：沒有版本同步機制和發行前檢查

## Scope

### In Scope

- 移除所有文檔中的機密金鑰（替換為佔位符）
- 建立單一版本來源機制（從 `package.json` 讀取）
- 在首頁 UI 顯示版本號
- 建立打包發行模擬測試
- 更新 README 文檔說明 npm 發行版本使用方式
- 確保 `.npmignore` 正確排除敏感檔案

### Out of Scope

- CI/CD 自動發行流程
- 自動化 changelog 生成

## Success Criteria

1. ✅ 機密掃描通過：`grep -r "sk-[a-zA-Z0-9]\{20,\}" .` 無結果（排除 logger.ts 中的過濾規則）
2. ✅ 版本一致性：package.json、index.ts、mcp-server.ts 版本相同
3. ✅ 前端版本顯示：首頁可見版本號
4. ✅ 瀏覽器 UI 測試通過
5. ✅ 打包模擬測試通過：`npm pack` 後的 tarball 可正常安裝並執行
6. ✅ README 包含完整的 npm 發行版本使用說明

## Related Specs

- 無現有規格需要修改

## References

- [package.json](../../../package.json) - 當前版本 2.1.4
- [src/index.ts](../../../src/index.ts) - VERSION 常數 2.1.3
- [.docs/CONFIGURATION.md](../../../.docs/CONFIGURATION.md) - 含機密金鑰

---
name: code-quality-standards
description: 程式碼品質規範和禁止事項
applyTo: "**/*.{ts,js,tsx,jsx,css,html}"
---

# 程式碼品質規範

## 禁止事項

- ❌ **不要添加多餘註解** - 不增加人類不會添加或與文件其餘部分風格不一致的註解
- ❌ **不要過度防禦性編碼** - 不在已驗證路徑添加不必要的 try/catch 區塊或防禦性檢查
- ❌ **不要強制轉型繞過類型問題** - 不為了解決類型錯誤而進行不安全的強制轉換
- ❌ **不要破壞程式碼風格一致性** - 不提交與當前文件風格不一致的程式碼

## Commit 前置檢查

進行任何 Git Commit 之前，必須確認以下所有條件均已達成：

1. ✅ **編譯無錯誤** - 後端 `dotnet build` 和前端 `npm run build` 均成功
2. ✅ **單元測試無錯誤** - 所有後端單元測試通過
3. ✅ **前端 UI 測試無錯誤** - 前端元件測試通過
4. ✅ **瀏覽器 UI 測試無錯誤** - 使用 Browser Automation Tools 進行 E2E 測試

## 測試要求

- 所有前端/瀏覽器測試必須使用 "Browser Automation Tools"

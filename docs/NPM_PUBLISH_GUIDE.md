# 📦 npm 發行指南

本文件說明如何準備和發行 npm 套件。

## ⚠️ npm 令牌重大變更（2025/12/9）

根據 [GitHub 公告](https://github.blog/changelog/2025-12-09-npm-classic-tokens-revoked-session-based-auth-and-cli-token-management-now-available/)，npm 經典令牌（Classic Token）已永久作廢。

### 新的認證方式

| 使用場景 | 認證方式 | 有效期 |
|----------|----------|--------|
| 本地開發 | `npm login` (Session Token) | 2 小時 |
| CI/CD 自動化 | Granular Access Token | 最長 90 天 |
| CI/CD 最安全 | OIDC Trusted Publishing | 無需令牌 |

## 📋 發行前準備（人工操作）

### 1. 建立 Granular Access Token（CI/CD 用）

1. 登入 [npmjs.com](https://www.npmjs.com/)
2. 前往 **Settings** → **Access Tokens** 或直接訪問 [tokens 頁面](https://www.npmjs.com/settings/~/tokens)
3. 點擊 **Generate New Token** → **Granular Access Token**
4. 設定選項：
   - **Token name**: `github-actions-user-web-feedback`
   - **Expiration**: 最長 90 天（建議定期更新）
   - **Packages**: 選擇 `user-web-feedback` 或 **Read and write**
   - **Organizations**: 如需要，選擇相關組織
   - ⚠️ **Bypass 2FA**: 啟用此選項（CI/CD 自動化必須）
5. 複製生成的令牌

### 2. 設定 GitHub Secrets

1. 前往 GitHub 倉庫 → **Settings** → **Secrets and variables** → **Actions**
2. 點擊 **New repository secret**
3. 名稱：`NPM_TOKEN`
4. 值：貼上步驟 1 複製的 Token

### 3. （選用）設定 OIDC Trusted Publishing

這是最安全的方式，完全無需管理令牌：

1. 前往 npmjs.com 套件設定頁面
2. 在 **Trusted publishing** 區塊中設定：
   - **Repository owner**: 你的 GitHub 用戶名或組織
   - **Repository name**: `user-feedback-web`
   - **Workflow filename**: `publish.yml`
3. 啟用後，workflow 使用 `id-token: write` 權限自動獲取發行憑證

### 4. 確認 package.json 資訊

確保以下欄位正確：

```json
{
  "name": "user-web-feedback",
  "version": "2.2.0",
  "author": "...",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/HyperHeroX/user-feedback-web.git"
  }
}
```

## 🚀 發行流程

### 方式一：透過 GitHub Release（推薦）

1. 前往 GitHub 倉庫 → **Releases** → **Create a new release**
2. 建立新 Tag（格式：`v2.2.0`）
3. 填寫 Release Notes
4. 點擊 **Publish release**
5. GitHub Actions 會自動觸發 `publish.yml` 發行到 npm

### 方式二：手動發行

```bash
# 1. 確保已登入 npm
npm login

# 2. 確保在 main 分支且為最新版本
git checkout main
git pull origin main

# 3. 清理並重新建置
npm run clean
npm run build

# 4. 執行測試
npm test

# 5. 預覽將發行的檔案
npm pack --dry-run

# 6. 發行到 npm
npm publish
```

## ✅ 發行檢查清單

發行前請確認：

- [ ] 版本號已更新（package.json）
- [ ] 所有測試通過（`npm test`）
- [ ] 編譯成功（`npm run build`）
- [ ] 無機密資訊洩漏
- [ ] CHANGELOG/Release Notes 已更新
- [ ] README 文檔已更新

## 🔄 版本更新流程

```bash
# 修補版本 (2.2.0 → 2.2.1)
npm version patch

# 次版本 (2.2.0 → 2.3.0)
npm version minor

# 主版本 (2.2.0 → 3.0.0)
npm version major
```

## 🔍 驗證發行

發行後驗證：

```bash
# 檢查 npm 上的版本
npm view user-web-feedback version

# 測試安裝
npx user-web-feedback@latest --version
```

## ⚠️ 注意事項

1. **發行後無法刪除**：npm 不允許刪除已發行的版本（24 小時內可 unpublish）
2. **版本號唯一**：同一版本號無法重複發行
3. **權限確認**：確保 npm Token 有發行權限

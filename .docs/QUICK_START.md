# ⚡ 快速啟動參考卡

## 最簡單的方式（推薦）

### Windows 用戶
```
1. 解壓文件夾
2. 雙擊 START.bat
3. 等待啟動完成
```

### macOS / Linux 用戶
```bash
chmod +x START.sh
./START.sh
```

---

## 手動啟動（開發者）

### 第一次
```bash
# 克隆
git clone https://github.com/HyperHeroX/user-feedback-web.git
cd user-feedback-web

# 安裝依賴
npm install --production

# 構建
npm run build

# 啟動
node dist/cli.js start
```

### 以後每次
```bash
cd user-feedback-web
node dist/cli.js start
```

---

## 常用命令

| 命令 | 說明 |
|------|------|
| `node dist/cli.js start` | 啟動系統 |
| `node dist/cli.js health` | 檢查健康狀態 |
| `node dist/cli.js --version` | 查看版本 |
| `npm run build` | 重新構建 |
| `npm run clean` | 清除構建文件 |

---

## Docker 方式

```bash
# 構建
docker build -t user-feedback-web .

# 運行
docker run -p 3000:3000 -p 5555:5555 user-feedback-web

# 或使用 docker-compose
docker-compose up
```

---

## 一鍵启动（全自動）

```bash
curl -sSL https://raw.githubusercontent.com/HyperHeroX/user-feedback-web/main/quick-start.sh | bash
```

---

## 訪問系統

- **Web 介面**：http://localhost:3000
- **MCP 伺服器**：ws://localhost:5555

---

## 常見問題

**Q: 缺少 Node.js？**
- 下載：https://nodejs.org (選擇 LTS 版本)

**Q: npm install 很慢？**
- 試試這個：`npm install --production --registry https://registry.npmmirror.com`

**Q: 埠 3000 被佔用？**
- 編輯 `.env` 文件修改 `PORT` 變數

**Q: 想要後台運行？**
- 使用 PM2：`npm install -g pm2 && pm2 start dist/cli.js`

---

## 支援的系統

✅ Windows 10+
✅ macOS 10.15+
✅ Ubuntu 18.04+
✅ 任何支援 Node.js 18+ 的系統

---

## 獲得幫助

- GitHub Issues: https://github.com/HyperHeroX/user-feedback-web/issues
- 詳細文檔: 查看 DIRECT_NODE_LAUNCH_GUIDE.md

## Context

### 問題分析

#### 啟動時間問題
當使用 `npx -y @hiro-tools/user-web-feedback@latest` 時：
1. npm 下載套件（已優化，有快取）
2. Node.js 解析 5MB+ 的打包檔案（主要瓶頸）
3. 同步初始化所有模組（次要瓶頸）

打包檔案過大的原因是 `tsup.config.ts` 中將大量套件設為 `noExternal`：
- jimp (~800KB) - 圖片處理
- socket.io - WebSocket
- marked - Markdown 渲染
- express 全家桶

#### 記憶體問題
WebServer 建構子同步執行：
- `new ImageProcessor()` - 立即載入 Jimp
- `new ImageToTextService()` - AI 服務初始化
- `initDatabase()` - SQLite 初始化
- `new SocketIOServer()` - WebSocket 伺服器

大部分 MCP 使用情境不需要圖片處理和 AI 服務。

### 約束條件
- 必須保持 npx 一行指令啟動的簡潔性
- 不能破壞現有 API 和行為
- 必須向後兼容現有配置

## Goals / Non-Goals

### Goals
1. 將 MCP 啟動時間優化至 5 秒內
2. 降低基礎記憶體使用量 30%+
3. 保持功能完整性

### Non-Goals
- 不重構核心架構
- 不移除任何現有功能
- 不改變 npm 套件的使用方式

## Decisions

### Decision 1: 套件外部化策略

**選擇**: 將 jimp 改為 optional dependencies，其他大型套件保持 noExternal

**原因**: 
- jimp 是最大的單一套件（~800KB），但不是核心功能
- socket.io、express 等是核心功能，需保留在 bundle 中
- optional dependencies 允許功能降級而非失敗

**替代方案考量**:
- 全部外部化：需要用戶安裝依賴，破壞 npx 體驗 ❌
- 動態 import 全部：增加複雜度，可能引入競態條件 ❌

### Decision 2: 延遲載入實作

**選擇**: 使用 Proxy 模式實現延遲載入

```typescript
// 概念範例
class LazyImageProcessor {
  private _instance: ImageProcessor | null = null;
  
  private getInstance() {
    if (!this._instance) {
      const { ImageProcessor } = require('./image-processor');
      this._instance = new ImageProcessor(config);
    }
    return this._instance;
  }
  
  async processImage(...args) {
    return this.getInstance().processImage(...args);
  }
}
```

**原因**:
- 零成本抽象 - 未使用時不佔用資源
- API 不變 - 調用方無需修改
- 錯誤隔離 - jimp 載入失敗不影響其他功能

### Decision 3: 資料庫延遲初始化

**選擇**: 將 `initDatabase()` 從建構子移至首次存取時

**原因**:
- stdio MCP 模式可能不需要 Web 功能
- 資料庫初始化涉及檔案 I/O，有可測量的延遲

## Risks / Trade-offs

| 風險 | 機率 | 影響 | 緩解措施 |
|------|------|------|----------|
| 延遲載入引入競態條件 | 低 | 中 | 使用 singleton 模式和鎖 |
| jimp 載入失敗 | 低 | 低 | 優雅降級，返回錯誤而非崩潰 |
| 首次使用延遲增加 | 確定 | 低 | 可接受的延遲（< 500ms） |

## Migration Plan

此變更為內部優化，無需用戶遷移步驟。

## Open Questions

1. ~~是否需要新增 `--lightweight` CLI 參數？~~ → 決定：暫不新增，自動偵測
2. ~~jimp 應該是 optional 還是完全移除？~~ → 決定：保留為 optional

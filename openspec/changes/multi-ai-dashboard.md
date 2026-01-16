# Multi-AI Dashboard 變更提案

## 概述

將 user-feedback 從單次呼叫系統轉型為多 AI 儀表板系統，支援多個 AI 同時呼叫，並在首頁 Dashboard 顯示多個 AI 的即時狀態。

## 背景

目前系統設計為單一 session 模式：
- 每次 MCP `collect_feedback` 呼叫創建一個 session
- 首頁僅顯示當前 session 的 work summary
- 提交後頁面自動關閉

需求變更：
- 多個 AI（可能來自不同專案）可同時呼叫 user-feedback
- Dashboard 按專案分組顯示所有活躍 session
- 點擊 Dashboard 元素進入詳細視圖（原首頁功能）
- 新首頁不自動關閉

## 參考架構

參考 Serena 的 Dashboard 設計：
- Flask REST API + 前端輪詢（1000ms）
- 支援多專案切換
- Task Execution 監控佇列
- 即時日誌串流

## 設計原則

- **低耦合、高內聚**：Dashboard 模組獨立於現有 session 邏輯
- **SOLID 原則**：
  - SRP: 分離 Dashboard、Session、Project 責任
  - OCP: 現有 API 保持不變，擴充新功能
  - LSP: 相容舊有單一 session 行為
  - ISP: 客戶端可選擇性使用 Dashboard 或直接 session
  - DIP: 依賴抽象接口而非具體實作

---

## 技術規格

### 1. 新增 Project 概念

#### 1.1 MCP Tool 參數擴充

```typescript
// src/types/index.ts - 擴充 CollectFeedbackParams
interface CollectFeedbackParams {
  work_summary: string;
  project_name?: string;  // 新增：專案名稱
  project_path?: string;  // 新增：專案路徑
}
```

#### 1.2 新增 Project 類型

```typescript
// src/types/index.ts
interface Project {
  id: string;           // 專案唯一識別碼 (hash of path or name)
  name: string;         // 顯示名稱
  path?: string;        // 專案路徑（可選）
  createdAt: string;    // 首次呼叫時間
  lastActiveAt: string; // 最後活動時間
}

interface ProjectSession {
  projectId: string;
  sessionId: string;
  workSummary: string;
  status: 'waiting' | 'active' | 'completed' | 'timeout';
  createdAt: string;
  lastActivityAt: string;
}
```

### 2. 新增 ProjectManager

```typescript
// src/utils/project-manager.ts
class ProjectManager {
  private projects: Map<string, Project>;
  
  getOrCreateProject(name: string, path?: string): Project;
  getProject(id: string): Project | undefined;
  getAllProjects(): Project[];
  updateLastActive(id: string): void;
  getProjectSessions(id: string): ProjectSession[];
}
```

### 3. Session Storage 擴充

```typescript
// src/utils/session-storage.ts - SessionData 擴充
interface SessionData {
  // 現有欄位...
  projectId?: string;    // 新增：關聯的專案 ID
  projectName?: string;  // 新增：專案名稱（快取）
}
```

### 4. Dashboard REST API

```typescript
// src/server/web-server.ts - 新增端點

// GET /api/dashboard/overview
// 返回所有專案的 session 概覽
interface DashboardOverview {
  projects: Array<{
    project: Project;
    sessions: Array<{
      sessionId: string;
      status: string;
      workSummary: string;
      createdAt: string;
    }>;
    totalSessions: number;
    activeSessions: number;
  }>;
}

// GET /api/dashboard/project/:projectId
// 返回特定專案的詳細資訊

// WebSocket 事件擴充
interface DashboardEvents {
  'dashboard:session_created': { projectId: string; sessionId: string };
  'dashboard:session_updated': { projectId: string; sessionId: string; status: string };
  'dashboard:project_activity': { projectId: string; lastActivityAt: string };
}
```

### 5. 前端架構

#### 5.1 新增 Dashboard 頁面

```
src/static/
├── index.html          # 改為 Dashboard 首頁
├── session.html        # 新增：Session 詳細頁面（原 index.html 功能）
├── dashboard.js        # 新增：Dashboard 邏輯
├── dashboard.css       # 新增：Dashboard 樣式
├── app.js             # 保留：Session 詳細頁邏輯
└── style.css          # 保留：共用樣式
```

#### 5.2 Dashboard UI 元件

```
┌─────────────────────────────────────────────────────────────┐
│  User Feedback Dashboard                            Settings│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ Project: MyApp   │  │ Project: Backend │                │
│  │ ────────────────│  │ ────────────────│                │
│  │ ● Active (2)    │  │ ● Active (1)    │                │
│  │ ○ Waiting (1)   │  │ ○ Waiting (0)   │                │
│  │                  │  │                  │                │
│  │ Latest:         │  │ Latest:         │                │
│  │ "Implementing   │  │ "Database       │                │
│  │  feature X..."  │  │  migration..."  │                │
│  │                  │  │                  │                │
│  │    [View All]   │  │    [View All]   │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6. 行為變更

#### 6.1 Dashboard 首頁行為
- **不自動關閉**：Dashboard 持續運行監控所有專案
- **輪詢更新**：每秒輪詢 `/api/dashboard/overview`
- **點擊互動**：點擊專案卡片開啟 Session 詳細頁

#### 6.2 Session 頁面行為
- **保留自動關閉邏輯**：提交後可選擇關閉（不影響 Dashboard）
- **回退功能**：可返回 Dashboard 而非關閉

#### 6.3 向後相容性
- 不帶 `project_name` 的呼叫歸類至 "Default" 專案
- 單一 session 場景行為不變

---

## 實作任務清單

### Phase 1: 後端基礎 (T1-T4)

- [ ] **T1**: 擴充 Types - 新增 Project、ProjectSession 等類型
- [ ] **T2**: 實作 ProjectManager 類別
- [ ] **T3**: 擴充 SessionStorage - 支援 projectId 關聯
- [ ] **T4**: 擴充 MCP Tool - collect_feedback 接受 project 參數

### Phase 2: API 端點 (T5-T7)

- [ ] **T5**: 新增 Dashboard REST API 端點
- [ ] **T6**: 擴充 WebSocket 事件支援 Dashboard 通知
- [ ] **T7**: 整合測試 - 多專案 session 場景

### Phase 3: 前端 Dashboard (T8-T11)

- [ ] **T8**: 新增 Dashboard HTML/CSS 結構
- [ ] **T9**: 實作 Dashboard.js - 專案卡片、輪詢、互動
- [ ] **T10**: 重構 Session 頁面 - 分離至 session.html
- [ ] **T11**: 端到端測試 - Browser UI 測試

### Phase 4: 整合完善 (T12-T14)

- [ ] **T12**: 向後相容性測試 - 無 project_name 呼叫
- [ ] **T13**: 效能測試 - 多 AI 同時呼叫
- [ ] **T14**: 文檔更新 - MCP_SERVER_GUIDE.md

---

## 風險評估

| 風險 | 可能性 | 影響 | 緩解策略 |
|------|--------|------|----------|
| 多 session 同時操作競爭 | 中 | 中 | 使用 Map + 適當鎖定機制 |
| Dashboard 輪詢效能 | 低 | 低 | 僅在頁面可見時輪詢 |
| 向後相容性破壞 | 低 | 高 | 所有新參數設為可選 |
| 前端狀態同步問題 | 中 | 中 | WebSocket 即時推送 + 輪詢雙重保障 |

---

## 驗收標準

1. ✅ 多個 AI 可同時呼叫 collect_feedback 並傳入不同 project_name
2. ✅ Dashboard 正確按專案分組顯示
3. ✅ 點擊專案進入詳細頁面能正常提交 feedback
4. ✅ Dashboard 不會因單一 session 關閉而關閉
5. ✅ 現有無 project_name 的呼叫行為不變
6. ✅ 所有既有測試通過
7. ✅ 新增 E2E 測試覆蓋多專案場景

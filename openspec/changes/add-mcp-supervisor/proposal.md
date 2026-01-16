# Proposal: MCP Supervisor (Always-Alive Architecture)

## Status: Draft

## Problem Statement

### 現有問題

1. **MCP 服務中斷風險**
   - MCP Server 進程可能因各種原因異常終止（未捕獲例外、記憶體洩漏、系統資源不足）
   - 一旦 MCP 進程終止，Cursor IDE 會失去連線，需要手動重新啟動
   - 長時間運行的任務可能因此中斷

2. **缺乏自動恢復機制**
   - 目前沒有自動重啟機制
   - 服務掛掉後需要人工介入
   - AI 助手無法自主診斷和恢復服務

3. **連線狀態對用戶不透明**
   - 用戶難以判斷服務是否健康
   - 缺乏主動的健康監控和通知

## Proposed Solution

### 核心概念：Supervisor Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MCP Transport Layer                      │
│  (Always Running - Handles Cursor Communication)             │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Supervisor Process                       │    │
│  │  • Health Monitor                                     │    │
│  │  • Auto-Restart Logic                                 │    │
│  │  • MCP Request Proxy                                  │    │
│  └─────────────────┬───────────────────────────────────┘    │
│                    │                                         │
└────────────────────┼────────────────────────────────────────┘
                     │ spawn/monitor
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Worker Process                              │
│  (Can Crash & Restart)                                       │
│                                                              │
│  • Web Server (Express + Socket.IO)                          │
│  • Business Logic                                            │
│  • Database Operations                                       │
│  • MCP Client Manager                                        │
└─────────────────────────────────────────────────────────────┘
```

### 主要功能

1. **Supervisor Process (長期存活)**
   - 作為 MCP Transport 的入口點
   - 維持與 Cursor IDE 的連線
   - 代理 MCP 請求到 Worker Process
   - 監控 Worker Process 健康狀態
   - 自動重啟失敗的 Worker

2. **Worker Process (可重啟)**
   - 執行實際業務邏輯
   - 可以安全地崩潰和重啟
   - 通過 IPC 與 Supervisor 通訊

3. **AI 自主診斷工具**
   - `self_test`: 執行健康檢查，若 Worker 失效則自動重啟，返回完整健康與診斷資訊

## Scope

### In Scope

- Supervisor Process 實現
- Worker Process 分離
- IPC 通訊機制
- 自動重啟邏輯
- 健康檢查機制
- MCP 工具擴展（self_test, restart_worker, get_diagnostics）
- 設定頁面 UI 整合

### Out of Scope

- 多 Worker 負載均衡（Phase 2）
- 遠端進程監控（Phase 2）
- 容器化部署（Phase 2）

## Success Criteria

1. MCP Transport 進程在 Worker 崩潰時保持連線
2. Worker Process 崩潰後在 5 秒內自動重啟
3. AI 助手可以通過 MCP 工具執行健康檢查和重啟
4. 用戶在設定頁面可以查看 Supervisor 狀態
5. 所有現有功能保持相容

## Related Capabilities

- Self-Probe (Keep-Alive) - 可整合到 Supervisor 監控
- MCP Client Manager - 需要遷移到 Worker Process
- Web Server - 需要遷移到 Worker Process

## Risks & Mitigations

| 風險 | 影響 | 緩解策略 |
|------|------|----------|
| IPC 通訊延遲 | 性能下降 | 使用高效 IPC 機制（stdio streams） |
| 狀態同步問題 | 資料不一致 | 設計無狀態或最小狀態的代理層 |
| 複雜度增加 | 維護困難 | 清晰的模組邊界和文檔 |

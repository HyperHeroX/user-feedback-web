# Spec: Version Management

## Overview

定義版本資訊的單一來源機制和跨系統一致性要求。

## ADDED Requirements

### Requirement: Single Version Source

版本號必須從 `package.json` 作為唯一來源，所有其他位置應引用此來源。

#### Scenario: Backend version export

**Given** 應用程式啟動時
**When** `src/index.ts` 被載入
**Then** `VERSION` 常數應等於 `package.json` 中的 `version` 欄位

#### Scenario: MCP server version info

**Given** MCP 伺服器初始化時
**When** 伺服器資訊被查詢
**Then** 回傳的版本號應與 `package.json` 一致

#### Scenario: CLI version display

**Given** 使用者執行 `user-web-feedback --version`
**When** 版本資訊被輸出
**Then** 顯示的版本號應與 `package.json` 一致

### Requirement: Frontend Version Display

首頁必須顯示當前應用程式版本號。

#### Scenario: Version visible on page load

**Given** 使用者訪問首頁
**When** 頁面完全載入後
**Then** 版本號應顯示在連接狀態指示器附近
**And** 版本格式為 `v{major}.{minor}.{patch}`

#### Scenario: Version API endpoint

**Given** 前端需要獲取版本資訊
**When** 調用 `GET /api/version`
**Then** 回應應包含 `version` 欄位
**And** 值與 `package.json` 版本一致

## MODIFIED Requirements

無

## REMOVED Requirements

無

## Cross-References

- [src/index.ts](../../../../src/index.ts) - VERSION 常數定義
- [src/server/web-server.ts](../../../../src/server/web-server.ts) - /api/version 端點
- [package.json](../../../../package.json) - 版本來源

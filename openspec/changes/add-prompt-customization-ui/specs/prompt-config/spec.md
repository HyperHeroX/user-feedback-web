# Specification: Prompt Config

## ADDED Requirements

### Requirement: PROMPT-001 - Prompt Configuration Storage

提示詞配置必須持久化儲存在 SQLite 資料庫中。

#### Scenario: 首次啟動初始化預設配置

**Given** 資料庫中不存在 prompt_configs 表
**When** 應用程式啟動
**Then** 系統創建表並插入預設配置

#### Scenario: 獲取所有提示詞配置

**Given** 資料庫中存在提示詞配置
**When** 呼叫 GET /api/settings/prompts
**Then** 返回所有配置的陣列

### Requirement: PROMPT-002 - Prompt Order Configuration

用戶可以配置提示詞組件的順序。

#### Scenario: 設定第一次呼叫順序

**Given** 用戶在設定頁面
**When** 修改 "第一次順序" 欄位並儲存
**Then** firstOrder 值更新到資料庫

#### Scenario: 設定第二次呼叫順序

**Given** 用戶在設定頁面
**When** 修改 "第二次順序" 欄位並儲存
**Then** secondOrder 值更新到資料庫

### Requirement: PROMPT-003 - Dynamic Prompt Aggregation

PromptAggregator 根據配置動態組合提示詞。

#### Scenario: 首次 AI 呼叫使用 firstOrder

**Given** isFirstCall = true
**When** 調用 aggregate()
**Then** 使用 firstOrder 排序，過濾 order > 0 的組件

#### Scenario: 後續 AI 呼叫使用 secondOrder

**Given** isFirstCall = false
**When** 調用 aggregate()
**Then** 使用 secondOrder 排序，過濾 order > 0 的組件

### Requirement: PROMPT-004 - Reset to Default

用戶可以重置提示詞配置為預設值。

#### Scenario: 重置配置

**Given** 用戶修改了提示詞配置
**When** 點擊 "恢復預設" 並確認
**Then** 所有配置恢復為初始預設值

## ADDED UI Requirements

### Requirement: UI-001 - Prompt Config Section

設定頁面必須包含提示詞配置區塊。

#### Scenario: 顯示配置列表

**Given** 用戶訪問設定頁面
**When** 頁面載入完成
**Then** 顯示所有提示詞組件的配置項目

### Requirement: UI-002 - Extended API Provider Section

設定頁面必須包含擴展 API 提供商區塊。

#### Scenario: NVIDIA 設定標籤

**Given** 用戶訪問設定頁面
**When** 點擊 NVIDIA 標籤
**Then** 顯示 NVIDIA API 配置表單

#### Scenario: Z.AI 設定標籤

**Given** 用戶訪問設定頁面
**When** 點擊 Z.AI 標籤
**Then** 顯示 Z.AI API 配置表單

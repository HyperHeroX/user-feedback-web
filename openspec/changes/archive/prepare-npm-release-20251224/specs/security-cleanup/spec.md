# Spec: Security Cleanup

## Overview

確保所有文檔和原始碼中不包含真實的機密金鑰或敏感資訊。

## ADDED Requirements

### Requirement: No Hardcoded Secrets

所有文檔範例中的 API Key 必須使用佔位符而非真實值。

#### Scenario: Configuration documentation

**Given** `.docs/CONFIGURATION.md` 文件
**When** 檢查 MCP 配置範例
**Then** API Key 值應為 `your-api-key-here` 或類似佔位符
**And** 不應包含以 `sk-` 開頭的真實金鑰（長度超過 20 字元）

#### Scenario: README examples

**Given** `README.md` 文件
**When** 檢查環境變數配置範例
**Then** 不應包含真實的 API Key
**And** 應使用明顯的佔位符如 `your_api_key_here`

### Requirement: NPM Package Exclusions

npm 發行包不應包含敏感文檔和開發檔案。

#### Scenario: Package contents validation

**Given** 執行 `npm pack` 生成的 tarball
**When** 檢查包內容
**Then** 不應包含 `.docs/` 目錄
**And** 不應包含 `.env` 或 `.env.*` 檔案
**And** 不應包含 `src/` 目錄（原始碼）
**And** 應包含 `dist/` 目錄（編譯後程式碼）

## MODIFIED Requirements

無

## REMOVED Requirements

無

## Cross-References

- [.npmignore](../../../../.npmignore) - npm 包排除規則
- [.gitignore](../../../../.gitignore) - Git 忽略規則
- [.docs/CONFIGURATION.md](../../../../.docs/CONFIGURATION.md) - 配置文檔

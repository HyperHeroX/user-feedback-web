/**
 * CLI API 單元測試
 * 測試 CLI 相關的資料庫 API
 */

import {
  getCLISettings,
  updateCLISettings,
  createCLITerminal,
  getCLITerminals,
  getCLITerminalById,
  deleteCLITerminal,
  insertCLIExecutionLog,
  getCLIExecutionLogs,
  cleanupOldCLIExecutionLogs
} from '../utils/database.js';
import type { CLITerminal, CLITerminalStatus, CLIToolType } from '../types/index.js';
import { randomUUID } from 'crypto';

describe('CLI Database API', () => {
  const testProjectPath = '/test/cli-api-project';

  describe('CLI Settings', () => {
    it('應該返回設定物件', () => {
      const settings = getCLISettings();
      
      expect(settings).not.toBeNull();
      expect(settings).toHaveProperty('aiMode');
      expect(settings).toHaveProperty('cliTool');
      expect(settings).toHaveProperty('cliTimeout');
      expect(settings).toHaveProperty('cliFallbackToApi');
    });

    it('應該可以更新 AI 模式', () => {
      updateCLISettings({ aiMode: 'cli' });
      const settings = getCLISettings();
      expect(settings?.aiMode).toBe('cli');

      // 還原
      updateCLISettings({ aiMode: 'api' });
    });

    it('應該可以更新 CLI 工具', () => {
      updateCLISettings({ cliTool: 'claude' });
      const settings = getCLISettings();
      expect(settings?.cliTool).toBe('claude');

      // 還原
      updateCLISettings({ cliTool: 'gemini' });
    });

    it('應該可以更新超時設定', () => {
      const originalSettings = getCLISettings();
      const originalTimeout = originalSettings?.cliTimeout ?? 120000;

      updateCLISettings({ cliTimeout: 60000 });
      const settings = getCLISettings();
      expect(settings?.cliTimeout).toBe(60000);

      // 還原
      updateCLISettings({ cliTimeout: originalTimeout });
    });
  });

  describe('CLI Terminals', () => {
    let terminalId: string;

    beforeAll(() => {
      terminalId = randomUUID();
    });

    afterAll(() => {
      // 清理測試資料
      deleteCLITerminal(terminalId);
    });

    it('應該可以建立終端機', () => {
      const terminal = createCLITerminal({
        id: terminalId,
        projectPath: testProjectPath,
        projectName: 'Test Project',
        tool: 'claude' as CLIToolType,
        status: 'idle' as CLITerminalStatus
      });

      expect(terminal).not.toBeNull();
      expect(terminal?.id).toBe(terminalId);
      expect(terminal?.projectPath).toBe(testProjectPath);
      expect(terminal?.projectName).toBe('Test Project');
      expect(terminal?.tool).toBe('claude');
      expect(terminal?.status).toBe('idle');
      expect(terminal).toHaveProperty('startedAt');
      expect(terminal).toHaveProperty('lastActivityAt');
    });

    it('應該可以取得單一終端機', () => {
      const terminal = getCLITerminalById(terminalId);
      
      expect(terminal).not.toBeNull();
      expect(terminal?.id).toBe(terminalId);
      expect(terminal?.projectPath).toBe(testProjectPath);
    });

    it('應該可以取得所有終端機', () => {
      const terminals = getCLITerminals();
      
      expect(Array.isArray(terminals)).toBe(true);
      
      const found = terminals.find(t => t.id === terminalId);
      expect(found).toBeDefined();
    });

    it('應該可以刪除終端機', () => {
      const newId = randomUUID();
      createCLITerminal({
        id: newId,
        projectPath: testProjectPath + '-delete',
        projectName: 'Delete Test',
        tool: 'gemini' as CLIToolType,
        status: 'idle' as CLITerminalStatus
      });

      const result = deleteCLITerminal(newId);
      expect(result).toBe(true);

      const terminal = getCLITerminalById(newId);
      expect(terminal).toBeNull();
    });

    it('刪除不存在的終端機應返回 false', () => {
      const result = deleteCLITerminal('non-existent-id-' + randomUUID());
      expect(result).toBe(false);
    });
  });

  describe('CLI Execution Logs', () => {
    let terminalId: string;

    beforeAll(() => {
      terminalId = randomUUID();
      createCLITerminal({
        id: terminalId,
        projectPath: testProjectPath + '-logs',
        projectName: 'Log Test Project',
        tool: 'gemini' as CLIToolType,
        status: 'idle' as CLITerminalStatus
      });
    });

    afterAll(() => {
      deleteCLITerminal(terminalId);
    });

    it('應該可以新增成功的執行日誌', () => {
      const logId = insertCLIExecutionLog({
        terminalId,
        prompt: 'Test prompt',
        response: 'Test response',
        success: true,
        executionTime: 1500
      });

      expect(logId).toBeGreaterThan(0);
    });

    it('應該可以新增失敗的執行日誌', () => {
      const logId = insertCLIExecutionLog({
        terminalId,
        prompt: 'Failed prompt',
        response: null,
        success: false,
        executionTime: 500,
        error: 'Connection timeout'
      });

      expect(logId).toBeGreaterThan(0);
    });

    it('應該可以取得終端機的執行日誌', () => {
      const logs = getCLIExecutionLogs(terminalId);
      
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThanOrEqual(2);
      
      // 日誌應該按時間倒序排列
      if (logs.length >= 2) {
        const firstDate = new Date(logs[0].createdAt);
        const secondDate = new Date(logs[1].createdAt);
        expect(firstDate.getTime()).toBeGreaterThanOrEqual(secondDate.getTime());
      }
    });

    it('應該可以限制返回的日誌數量', () => {
      const logs = getCLIExecutionLogs(terminalId, 1);
      expect(logs.length).toBe(1);
    });

    it('日誌應該包含正確的欄位', () => {
      const logs = getCLIExecutionLogs(terminalId, 1);
      
      expect(logs[0]).toHaveProperty('id');
      expect(logs[0]).toHaveProperty('terminalId');
      expect(logs[0]).toHaveProperty('prompt');
      expect(logs[0]).toHaveProperty('response');
      expect(logs[0]).toHaveProperty('executionTime');
      expect(logs[0]).toHaveProperty('success');
      expect(logs[0]).toHaveProperty('createdAt');
      expect(typeof logs[0].success).toBe('boolean');
    });
  });

  describe('Log Cleanup', () => {
    it('應該可以清理舊日誌', () => {
      // 清理 365 天前的日誌（不會影響新建的測試資料）
      const deleted = cleanupOldCLIExecutionLogs(365);
      expect(typeof deleted).toBe('number');
      expect(deleted).toBeGreaterThanOrEqual(0);
    });
  });
});

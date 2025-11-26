/**
 * 設定管理模組測試
 */

import { createDefaultConfig, validateConfig } from '../config/index.js';
import { MCPError } from '../types/index.js';

describe('設定管理', () => {
  beforeEach(() => {
    // 清理環境變數
    delete process.env.MCP_WEB_PORT;
    delete process.env.MCP_DIALOG_TIMEOUT;
    delete process.env.MCP_API_BASE_URL;
    delete process.env.LOG_LEVEL;
  });

  describe('createDefaultConfig', () => {
    test('應該建立預設設定', () => {
      const config = createDefaultConfig();

      expect(config).toMatchObject({
        apiBaseUrl: 'https://api.ssopen.top',
        defaultModel: 'gpt-4o-mini',
        webPort: 5050,
        dialogTimeout: 60,
        enableChat: true,
        corsOrigin: '*',
        maxFileSize: 10485760,
        logLevel: 'info'
      });

      expect(config.apiKey).toBeUndefined();
    });

    test('應該使用環境變數覆蓋預設值', () => {
      process.env.MCP_WEB_PORT = '8080';
      process.env.MCP_DIALOG_TIMEOUT = '600';
      process.env.MCP_API_BASE_URL = 'https://custom.api.com';
      process.env.LOG_LEVEL = 'debug';

      const config = createDefaultConfig();

      expect(config.webPort).toBe(8080);
      expect(config.dialogTimeout).toBe(600);
      expect(config.apiBaseUrl).toBe('https://custom.api.com');
      expect(config.logLevel).toBe('debug');
    });

    test('應該處理無效的數字環境變數', () => {
      process.env.MCP_WEB_PORT = 'invalid';
      process.env.MCP_DIALOG_TIMEOUT = 'not-a-number';

      const config = createDefaultConfig();

      expect(config.webPort).toBe(5050); // 回退到預設值
      expect(config.dialogTimeout).toBe(60); // 回退到預設值 (秒)
    });
  });

  describe('validateConfig', () => {
    test('應該驗證有效設定', () => {
      const config = createDefaultConfig();

      expect(() => validateConfig(config)).not.toThrow();
    });

    test('應該拒絕無效連接埠', () => {
      const config = createDefaultConfig();
      config.webPort = 80; // 小於1024

      expect(() => validateConfig(config)).toThrow(MCPError);
      expect(() => validateConfig(config)).toThrow('Invalid port number');
    });

    test('應該拒絕過大連接埠', () => {
      const config = createDefaultConfig();
      config.webPort = 70000; // 大於65535

      expect(() => validateConfig(config)).toThrow(MCPError);
      expect(() => validateConfig(config)).toThrow('Invalid port number');
    });

    test('應該拒絕無效逾時時間', () => {
      const config = createDefaultConfig();
      config.dialogTimeout = 5; // 小於10秒

      expect(() => validateConfig(config)).toThrow(MCPError);
      expect(() => validateConfig(config)).toThrow('Invalid timeout');
    });

    test('應該拒絕過長逾時時間', () => {
      const config = createDefaultConfig();
      config.dialogTimeout = 70000; // 大於60000秒

      expect(() => validateConfig(config)).toThrow(MCPError);
      expect(() => validateConfig(config)).toThrow('Invalid timeout');
    });

    test('應該拒絕無效檔案大小', () => {
      const config = createDefaultConfig();
      config.maxFileSize = 500; // 小於1KB

      expect(() => validateConfig(config)).toThrow(MCPError);
      expect(() => validateConfig(config)).toThrow('Invalid max file size');
    });

    test('應該拒絕過大檔案大小', () => {
      const config = createDefaultConfig();
      config.maxFileSize = 200 * 1024 * 1024; // 大於100MB

      expect(() => validateConfig(config)).toThrow(MCPError);
      expect(() => validateConfig(config)).toThrow('Invalid max file size');
    });

    test('應該拒絕無效API URL', () => {
      const config = createDefaultConfig();
      config.apiBaseUrl = 'not-a-valid-url';

      expect(() => validateConfig(config)).toThrow(MCPError);
      expect(() => validateConfig(config)).toThrow('Invalid API base URL');
    });

    test('應該拒絕無效日誌級別', () => {
      const config = createDefaultConfig();
      config.logLevel = 'invalid-level';

      expect(() => validateConfig(config)).toThrow(MCPError);
      expect(() => validateConfig(config)).toThrow('Invalid log level');
    });

    test('應該接受有效日誌級別', () => {
      const config = createDefaultConfig();
      const validLevels = ['error', 'warn', 'info', 'debug'];

      for (const level of validLevels) {
        config.logLevel = level;
        expect(() => validateConfig(config)).not.toThrow();
      }
    });
  });
});

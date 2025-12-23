/**
 * 整合測試 - 完整的回饋收集流程
 */

import { MCPServer } from '../server/mcp-server.js';
import { createDefaultConfig } from '../config/index.js';

describe('整合測試', () => {
  let mcpServer: MCPServer;
  let config: any;

  beforeAll(async () => {
    config = createDefaultConfig();
    config.webPort = 0; // 使用隨機連接埠
    config.logLevel = 'error'; // 減少測試日誌
    mcpServer = new MCPServer(config);
  });

  afterAll(async () => {
    if (mcpServer) {
      await mcpServer.stop();
    }
  });

  describe('Web伺服器啟動', () => {
    test('應該能夠啟動Web伺服器', async () => {
      await mcpServer.startWebOnly();

      const status = mcpServer.getStatus();
      expect(status.webRunning).toBe(true);
      expect(status.webPort).toBeGreaterThan(0);
    }, 10000);

    test('應該能夠取得伺服器狀態', () => {
      const status = mcpServer.getStatus();

      expect(status).toMatchObject({
        webRunning: true,
        webPort: expect.any(Number),
        mcpRunning: false
      });
    });
  });

  describe('API端點測試', () => {
    test('健康檢查端點應該正常運作', async () => {
      const status = mcpServer.getStatus();
      const response = await fetch(`http://localhost:${status.webPort}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number)
      });
    });

    test('設定端點應該回傳設定資訊', async () => {
      const status = mcpServer.getStatus();
      const response = await fetch(`http://localhost:${status.webPort}/api/config`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        api_key: null,
        api_base_url: expect.any(String),
        model: expect.any(String),
        enable_chat: expect.any(Boolean),
        max_file_size: expect.any(Number)
      });
    });

    test('測試會話建立端點', async () => {
      const status = mcpServer.getStatus();
      const testData = {
        work_summary: '這是一個整合測試的工作匯報',
        timeout_seconds: 60
      };

      const response = await fetch(`http://localhost:${status.webPort}/api/test-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testData)
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        session_id: expect.any(String),
        feedback_url: expect.any(String)
      });

      // 驗證會話ID格式
      expect(data.session_id).toMatch(/^feedback_\d+_[a-z0-9]+$/);

      // 驗證回饋URL格式
      expect(data.feedback_url).toContain(`localhost:${status.webPort}`);
      expect(data.feedback_url).toContain(`session=${data.session_id}`);
    });
  });

  describe('靜態檔案服務', () => {
    test('應該能夠存取主頁', async () => {
      const status = mcpServer.getStatus();
      const response = await fetch(`http://localhost:${status.webPort}/`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
    });

    test('應該能夠存取JavaScript檔案', async () => {
      const status = mcpServer.getStatus();
      const response = await fetch(`http://localhost:${status.webPort}/app.js`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('javascript');
    });

    test('應該能夠存取CSS檔案', async () => {
      const status = mcpServer.getStatus();
      const response = await fetch(`http://localhost:${status.webPort}/style.css`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('css');
    });

    test('應該能夠存取測試頁面', async () => {
      const status = mcpServer.getStatus();
      const response = await fetch(`http://localhost:${status.webPort}/test.html`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
    });
  });

  describe('錯誤處理', () => {
    test('不存在的路徑應該回傳404', async () => {
      const status = mcpServer.getStatus();
      const response = await fetch(`http://localhost:${status.webPort}/nonexistent`);

      expect(response.status).toBe(404);
    });

    test('無效的API請求應該回傳錯誤', async () => {
      const status = mcpServer.getStatus();
      const response = await fetch(`http://localhost:${status.webPort}/api/test-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}) // 缺少必要欄位
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toMatchObject({
        error: expect.any(String)
      });
    });
  });

  describe('效能測試', () => {
    test('伺服器啟動時間應該合理', async () => {
      const startTime = Date.now();

      const newConfig = createDefaultConfig();
      newConfig.webPort = 0;
      newConfig.logLevel = 'error';
      const testServer = new MCPServer(newConfig);

      await testServer.startWebOnly();

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // 5秒內啟動

      await testServer.stop();
    }, 10000);

    test('API回應時間應該合理', async () => {
      const status = mcpServer.getStatus();
      const startTime = Date.now();

      const response = await fetch(`http://localhost:${status.webPort}/health`);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // 1秒內回應
      expect(response.status).toBe(200);
    });

    test('並行請求處理', async () => {
      const status = mcpServer.getStatus();
      const requests = [];

      // 建立10個並行請求
      for (let i = 0; i < 10; i++) {
        requests.push(
          fetch(`http://localhost:${status.webPort}/health`)
        );
      }

      const responses = await Promise.all(requests);

      // 所有請求都應該成功
      for (const response of responses) {
        expect(response.status).toBe(200);
      }
    });
  });

  describe('記憶體和資源管理', () => {
    test('多次啟動停止不應該造成記憶體洩漏', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // 多次啟動停止伺服器
      for (let i = 0; i < 3; i++) {
        const testConfig = createDefaultConfig();
        testConfig.webPort = 0;
        testConfig.logLevel = 'error';
        const testServer = new MCPServer(testConfig);

        await testServer.startWebOnly();
        await testServer.stop();
      }

      // 強制埒圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // 記憶體增長應該在合理範圍內（小於50MB）
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    }, 30000);
  });

  describe('MCP 工具 API 測試', () => {
    test('獲取 MCP 工具列表應該回傳空陣列（無連接）', async () => {
      const status = mcpServer.getStatus();
      const response = await fetch(`http://localhost:${status.webPort}/api/mcp-tools`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        tools: expect.any(Array)
      });
    });

    test('批次執行工具應該處理不存在的工具', async () => {
      const status = mcpServer.getStatus();
      const response = await fetch(`http://localhost:${status.webPort}/api/mcp/execute-tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolCalls: [{ name: 'nonexistent_tool', arguments: {} }]
        })
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results).toHaveLength(1);
      expect(data.results[0]).toMatchObject({
        name: 'nonexistent_tool',
        success: false,
        error: expect.stringContaining('不存在')
      });
    });

    test('AI 回覆 API 應該支援 includeMCPTools 參數', async () => {
      const status = mcpServer.getStatus();
      const response = await fetch(`http://localhost:${status.webPort}/api/ai-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '測試',
          context: '測試上下文',
          includeMCPTools: true
        })
      });
      const data = await response.json();

      // 可能因為沒有 API key 而失敗，但應該是預期的錯誤格式
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
    });
  });
});
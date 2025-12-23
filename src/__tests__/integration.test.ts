/**
 * 整合測試 - 完整的回饋收集流程
 */

import { MCPServer } from '../server/mcp-server.js';
import { createDefaultConfig } from '../config/index.js';
import { projectManager } from '../utils/project-manager.js';

describe('整合測試', () => {
  let mcpServer: MCPServer;
  let config: any;

  beforeAll(async () => {
    config = createDefaultConfig();
    config.webPort = 0; // 使用隨機連接埠
    config.logLevel = 'error'; // 減少測試日誌
    config.dialogTimeout = 1; // 測試時設定短超時
    mcpServer = new MCPServer(config);
  });

  afterAll(async () => {
    if (mcpServer) {
      await mcpServer.stop();
    }
    // 清理 ProjectManager 單例狀態
    projectManager.clear();
  }, 60000);

  describe('Web伺服器啟動', () => {
    test('應該能夠啟動Web伺服器', async () => {
      await mcpServer.startWebOnly();

      const status = mcpServer.getStatus();
      expect(status.running).toBe(true);
      expect(status.webPort).toBeGreaterThan(0);
    }, 10000);

    test('應該能夠取得伺服器狀態', () => {
      const status = mcpServer.getStatus();

      expect(status).toMatchObject({
        running: true,
        webPort: expect.any(Number)
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
      expect(data).toHaveProperty('api_base_url');
      expect(data).toHaveProperty('model');
      expect(data).toHaveProperty('enable_chat');
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

    test('不存在的檔案應該回傳404', async () => {
      const status = mcpServer.getStatus();
      const response = await fetch(`http://localhost:${status.webPort}/test.html`);

      expect(response.status).toBe(404);
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
      expect(Array.isArray(data.tools)).toBe(true);
    });

    test('批次執行工具應該驗證請求格式', async () => {
      const status = mcpServer.getStatus();
      const response = await fetch(`http://localhost:${status.webPort}/api/mcp/execute-tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();

      // 沒有提供 toolCalls 應該回傳錯誤
      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    test('AI 回覆 API 應該驗證必要參數', async () => {
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

      // 缺少 sessionId 應該回傳 400 錯誤
      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe('Dashboard API 測試', () => {
    test('Dashboard 總覽應該回傳專案和會話資訊', async () => {
      const status = mcpServer.getStatus();
      const response = await fetch(`http://localhost:${status.webPort}/api/dashboard/overview`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.projects)).toBe(true);
      expect(typeof data.totalProjects).toBe('number');
      expect(typeof data.totalActiveSessions).toBe('number');
    });

    test('建立帶專案的測試會話應該成功', async () => {
      const status = mcpServer.getStatus();
      const testData = {
        work_summary: '這是一個帶專案的測試工作匯報',
        timeout_seconds: 60,
        project_name: 'test-project',
        project_path: '/test/path'
      };

      const response = await fetch(`http://localhost:${status.webPort}/api/test-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(typeof data.session_id).toBe('string');
      expect(typeof data.feedback_url).toBe('string');
      expect(typeof data.project_id).toBe('string');
      expect(data.project_name).toBe('test-project');
    });

    test('Dashboard 總覽應該包含新建立的專案', async () => {
      const status = mcpServer.getStatus();
      const response = await fetch(`http://localhost:${status.webPort}/api/dashboard/overview`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalProjects).toBeGreaterThanOrEqual(1);
      
      // 專案資訊包含在 project 物件中
      const testProject = data.projects.find((p: { project: { name: string } }) => p.project.name === 'test-project');
      expect(testProject).toBeDefined();
      expect(testProject.activeSessions).toBeGreaterThanOrEqual(1);
    });

    test('取得專案詳情應該回傳會話列表', async () => {
      const status = mcpServer.getStatus();
      
      // 先取得專案 ID
      const overviewResponse = await fetch(`http://localhost:${status.webPort}/api/dashboard/overview`);
      const overview = await overviewResponse.json();
      const testProject = overview.projects.find((p: { project: { name: string } }) => p.project.name === 'test-project');
      
      expect(testProject).toBeDefined();

      // 取得專案詳情
      const response = await fetch(`http://localhost:${status.webPort}/api/dashboard/projects/${testProject.project.id}`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.project.id).toBe(testProject.project.id);
      expect(data.project.name).toBe('test-project');
      expect(Array.isArray(data.sessions)).toBe(true);
      expect(data.sessions.length).toBeGreaterThanOrEqual(1);
    });

    test('取得會話詳情應該回傳完整資訊', async () => {
      const status = mcpServer.getStatus();
      
      // 先建立一個新會話
      const testData = {
        work_summary: '會話詳情測試',
        timeout_seconds: 60,
        project_name: 'session-detail-test'
      };

      const createResponse = await fetch(`http://localhost:${status.webPort}/api/test-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      });
      const createData = await createResponse.json();

      // 取得會話詳情
      const response = await fetch(`http://localhost:${status.webPort}/api/dashboard/sessions/${createData.session_id}`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.session.id).toBe(createData.session_id);
      expect(data.session.workSummary).toBe('會話詳情測試');
      expect(data.session.status).toBe('active');
      expect(data.session.projectName).toBe('session-detail-test');
    });

    test('取得不存在的專案應該回傳 404', async () => {
      const status = mcpServer.getStatus();
      const response = await fetch(`http://localhost:${status.webPort}/api/dashboard/projects/nonexistent-id`);

      expect(response.status).toBe(404);
    });

    test('取得不存在的會話應該回傳 404', async () => {
      const status = mcpServer.getStatus();
      const response = await fetch(`http://localhost:${status.webPort}/api/dashboard/sessions/nonexistent-session`);

      expect(response.status).toBe(404);
    });

    test('無專案名稱的會話應該使用預設專案', async () => {
      const status = mcpServer.getStatus();
      const testData = {
        work_summary: '無專案名稱測試',
        timeout_seconds: 60
      };

      const response = await fetch(`http://localhost:${status.webPort}/api/test-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.project_name).toBe('Default');
      expect(data.project_id).toBeDefined();
    });
  });
});
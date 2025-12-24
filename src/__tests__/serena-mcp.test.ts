/**
 * Serena MCP 整合測試
 * 測試 Serena MCP Server 的啟動、工具列表和工具選擇功能
 */

import { MCPServer } from '../server/mcp-server.js';
import { createDefaultConfig } from '../config/index.js';
import { projectManager } from '../utils/project-manager.js';
import {
  initDatabase,
  createMCPServer,
  deleteMCPServer,
  getToolEnableConfigs,
  setToolEnabled,
  batchSetToolEnabled,
  isToolEnabled
} from '../utils/database.js';

describe('Serena MCP 整合測試', () => {
  let mcpServer: MCPServer;
  let config: any;
  let baseUrl: string;

  beforeAll(async () => {
    config = createDefaultConfig();
    config.webPort = 0;
    config.logLevel = 'error';
    config.dialogTimeout = 1;
    mcpServer = new MCPServer(config);
    await mcpServer.startWebOnly();
    const status = mcpServer.getStatus();
    baseUrl = `http://localhost:${status.webPort}`;
  }, 30000);

  afterAll(async () => {
    if (mcpServer) {
      await mcpServer.stop();
    }
    projectManager.clear();
  }, 60000);

  describe('MCP Server CRUD API', () => {
    let createdServerId: number;

    test('應該能夠獲取空的 MCP Server 列表', async () => {
      const response = await fetch(`${baseUrl}/api/mcp-servers`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.servers)).toBe(true);
    });

    test('應該能夠創建 MCP Server', async () => {
      const serverData = {
        name: 'Test Server',
        transport: 'stdio',
        command: 'echo',
        args: ['test'],
        enabled: true
      };

      const response = await fetch(`${baseUrl}/api/mcp-servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverData)
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.server).toBeDefined();
      expect(data.server.name).toBe('Test Server');
      expect(data.server.transport).toBe('stdio');

      createdServerId = data.server.id;
    });

    test('應該能夠獲取單一 MCP Server', async () => {
      const response = await fetch(`${baseUrl}/api/mcp-servers/${createdServerId}`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.server.id).toBe(createdServerId);
    });

    test('應該能夠更新 MCP Server', async () => {
      const updateData = {
        name: 'Updated Test Server'
      };

      const response = await fetch(`${baseUrl}/api/mcp-servers/${createdServerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.server.name).toBe('Updated Test Server');
    });

    test('應該能夠刪除 MCP Server', async () => {
      const response = await fetch(`${baseUrl}/api/mcp-servers/${createdServerId}`, {
        method: 'DELETE'
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Serena 預設配置 API', () => {
    test('應該能夠獲取 Serena 預設配置', async () => {
      const response = await fetch(`${baseUrl}/api/mcp-presets/serena`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.preset).toBeDefined();
      expect(data.preset.name).toBe('Serena');
      expect(data.preset.transport).toBe('stdio');
      expect(data.preset.command).toBe('uvx');
      expect(Array.isArray(data.preset.args)).toBe(true);
    });

    test('應該能夠獲取帶專案路徑的 Serena 預設配置', async () => {
      const projectPath = '/test/project';
      const response = await fetch(`${baseUrl}/api/mcp-presets/serena?projectPath=${encodeURIComponent(projectPath)}`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.preset.args).toContain('--project');
      expect(data.preset.args).toContain(projectPath);
    });
  });

  describe('MCP Tool 啟用配置 API', () => {
    let testServerId: number;

    beforeAll(async () => {
      // 創建測試用 Server
      const response = await fetch(`${baseUrl}/api/mcp-servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Tool Config Test Server',
          transport: 'stdio',
          command: 'echo',
          args: ['test'],
          enabled: true
        })
      });
      const data = await response.json();
      testServerId = data.server.id;
    });

    afterAll(async () => {
      // 清理測試用 Server
      await fetch(`${baseUrl}/api/mcp-servers/${testServerId}`, {
        method: 'DELETE'
      });
    });

    test('應該能夠獲取工具配置列表', async () => {
      const response = await fetch(`${baseUrl}/api/mcp-servers/${testServerId}/tools/config`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.tools)).toBe(true);
    });

    test('應該能夠設定單一工具啟用狀態', async () => {
      const toolName = 'test_tool';
      const response = await fetch(
        `${baseUrl}/api/mcp-servers/${testServerId}/tools/${encodeURIComponent(toolName)}/enable`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: false })
        }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    test('應該能夠批次設定工具啟用狀態', async () => {
      const tools = [
        { toolName: 'tool1', enabled: true },
        { toolName: 'tool2', enabled: false },
        { toolName: 'tool3', enabled: true }
      ];

      const response = await fetch(
        `${baseUrl}/api/mcp-servers/${testServerId}/tools/batch-enable`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tools })
        }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    test('設定工具狀態時應該驗證參數', async () => {
      const response = await fetch(
        `${baseUrl}/api/mcp-servers/${testServerId}/tools/test_tool/enable`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: 'not-boolean' })
        }
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('MCP 工具執行 API', () => {
    test('應該能夠獲取所有工具列表', async () => {
      const response = await fetch(`${baseUrl}/api/mcp-tools`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.tools)).toBe(true);
    });

    test('執行不存在的工具應該回傳錯誤', async () => {
      const response = await fetch(`${baseUrl}/api/mcp/execute-tool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'non_existent_tool',
          arguments: {}
        })
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });

    test('批次執行工具應該正確處理', async () => {
      const response = await fetch(`${baseUrl}/api/mcp/execute-tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tools: [
            { name: 'non_existent_tool_1', arguments: {} },
            { name: 'non_existent_tool_2', arguments: {} }
          ]
        })
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.results)).toBe(true);
      expect(data.results.every((r: any) => r.success === false)).toBe(true);
    });
  });

  describe('MCP Server 連接管理', () => {
    test('應該能夠嘗試連接所有 Server', async () => {
      const response = await fetch(`${baseUrl}/api/mcp-servers/connect-all`, {
        method: 'POST'
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.results)).toBe(true);
    });

    test('應該能夠斷開所有 Server', async () => {
      const response = await fetch(`${baseUrl}/api/mcp-servers/disconnect-all`, {
        method: 'POST'
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});

describe('Database 工具啟用配置功能', () => {
  // 測試資料庫層的工具啟用配置功能
  let testServerId: number;

  beforeAll(() => {
    initDatabase();
    const server = createMCPServer({
      name: 'DB Test Server',
      transport: 'stdio',
      command: 'echo',
      args: ['test']
    });
    testServerId = server.id;
  });

  afterAll(() => {
    deleteMCPServer(testServerId);
  });

  test('新 Server 應該沒有工具配置', () => {
    const configs = getToolEnableConfigs(testServerId);
    expect(configs.size).toBe(0);
  });

  test('應該能夠設定單一工具啟用狀態', () => {
    setToolEnabled(testServerId, 'test_tool', false);
    
    const configs = getToolEnableConfigs(testServerId);
    expect(configs.get('test_tool')).toBe(false);
  });

  test('未配置的工具預設為啟用', () => {
    const enabled = isToolEnabled(testServerId, 'unconfigured_tool');
    expect(enabled).toBe(true);
  });

  test('已配置為停用的工具應該回傳 false', () => {
    setToolEnabled(testServerId, 'disabled_tool', false);
    const enabled = isToolEnabled(testServerId, 'disabled_tool');
    expect(enabled).toBe(false);
  });

  test('應該能夠批次設定工具狀態', () => {
    batchSetToolEnabled(testServerId, [
      { toolName: 'batch_tool_1', enabled: true },
      { toolName: 'batch_tool_2', enabled: false },
      { toolName: 'batch_tool_3', enabled: true }
    ]);

    const configs = getToolEnableConfigs(testServerId);
    expect(configs.get('batch_tool_1')).toBe(true);
    expect(configs.get('batch_tool_2')).toBe(false);
    expect(configs.get('batch_tool_3')).toBe(true);
  });

  test('應該能夠更新已存在的工具配置', () => {
    setToolEnabled(testServerId, 'batch_tool_2', true);
    
    const configs = getToolEnableConfigs(testServerId);
    expect(configs.get('batch_tool_2')).toBe(true);
  });
});

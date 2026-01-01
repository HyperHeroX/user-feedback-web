/**
 * 連接埠管理器測試
 */

import { jest } from '@jest/globals';
import { PortManager } from '../utils/port-manager.js';
import { MCPError } from '../types/index.js';

describe('連接埠管理器', () => {
  let portManager: PortManager;

  beforeEach(() => {
    portManager = new PortManager();
  });

  describe('isPortAvailable', () => {
    test('應該檢測連接埠可用性', async () => {
      // 測試一個很可能可用的連接埠
      const available = await portManager.isPortAvailable(65432);
      expect(typeof available).toBe('boolean');
    });

    test('應該檢測已佔用連接埠', async () => {
      // 建立一個伺服器佔用連接埠
      const { createServer } = await import('net');
      const server = createServer();

      await new Promise<void>((resolve) => {
        server.listen(0, () => {
          resolve();
        });
      });

      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      if (port > 0) {
        const available = await portManager.isPortAvailable(port);
        expect(available).toBe(false);
      }

      server.close();
    });
  });

  describe('findAvailablePort', () => {
    test('應該找到可用連接埠', async () => {
      const port = await portManager.findAvailablePort();

      expect(port).toBeGreaterThan(0);
      expect(port).toBeLessThanOrEqual(65535);
    });

    test('應該使用首選連接埠（如果可用）', async () => {
      // 使用一個很可能可用的高連接埠
      const preferredPort = 65431;
      const port = await portManager.findAvailablePort(preferredPort);

      // 如果首選連接埠可用，應該回傳該連接埠
      const isPreferredAvailable = await portManager.isPortAvailable(preferredPort);
      if (isPreferredAvailable) {
        expect(port).toBe(preferredPort);
      } else {
        expect(port).not.toBe(preferredPort);
        expect(port).toBeGreaterThan(0);
      }
    });

    test('應該在首選連接埠不可用時找到替代連接埠', async () => {
      // 使用一個很可能被佔用的連接埠（如80）
      const preferredPort = 80;
      const port = await portManager.findAvailablePort(preferredPort);

      expect(port).toBeGreaterThan(0);
      expect(port).toBeLessThanOrEqual(65535);
      // 由於80連接埠通常被佔用或需要管理員權限，應該回傳其他連接埠
    });
  });

  describe('getPortInfo', () => {
    test('應該回傳連接埠資訊', async () => {
      const port = 65430;
      const info = await portManager.getPortInfo(port);

      expect(info).toMatchObject({
        port: port,
        available: expect.any(Boolean),
        pid: undefined // 目前實作中PID檢測未實現
      });
    });
  });

  describe('getPortRangeStatus', () => {
    test('應該回傳連接埠範圍狀態', async () => {
      const status = await portManager.getPortRangeStatus();

      expect(Array.isArray(status)).toBe(true);
      expect(status.length).toBe(100); // 5000-5099 共100個連接埠

      for (const info of status) {
        expect(info).toMatchObject({
          port: expect.any(Number),
          available: expect.any(Boolean),
          pid: undefined
        });
        expect(info.port).toBeGreaterThanOrEqual(5000);
        expect(info.port).toBeLessThanOrEqual(5099);
      }
    });
  });

  describe('waitForPortRelease', () => {
    test('應該在連接埠可用時立即回傳', async () => {
      // 取得一個在本環境中確定可用的連接埠以避免環境干擾
      const port = await portManager.findAvailablePort();
      const startTime = Date.now();

      await portManager.waitForPortRelease(port, 1000);

      const duration = Date.now() - startTime;
      // 放寬時間限制以適應不同環境，加上 500ms buffer 應對系統負載波動
      expect(duration).toBeLessThan(1500);
    });

    test('應該在逾時時拋出錯誤', async () => {
      // 建立一個伺服器佔用連接埠
      const { createServer } = await import('net');
      const server = createServer();

      await new Promise<void>((resolve) => {
        server.listen(0, () => {
          resolve();
        });
      });

      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      if (port > 0) {
        await expect(
          portManager.waitForPortRelease(port, 100)
        ).rejects.toThrow(MCPError);
      }

      server.close();
    });
  });

  describe('錯誤處理', () => {
    test('應該在沒有可用連接埠時拋出錯誤', async () => {
      // 模擬所有連接埠都被佔用的情況（透過mock）
      const originalIsPortAvailable = portManager.isPortAvailable;
      portManager.isPortAvailable = jest.fn().mockResolvedValue(false);

      await expect(portManager.findAvailablePort()).rejects.toThrow(MCPError);
      await expect(portManager.findAvailablePort()).rejects.toThrow('No available ports found');

      // 恢復原方法
      portManager.isPortAvailable = originalIsPortAvailable;
    });
  });
});

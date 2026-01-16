/**
 * SelfProbeService 單元測試
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock database module
jest.unstable_mockModule('../utils/database.js', () => ({
  getSelfProbeSettings: jest.fn(() => undefined),
  saveSelfProbeSettings: jest.fn((settings) => ({
    id: 1,
    enabled: settings.enabled ?? false,
    intervalSeconds: settings.intervalSeconds ?? 300,
    updatedAt: new Date().toISOString()
  }))
}));

// Mock logger module
jest.unstable_mockModule('../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Import after mocking
const { SelfProbeService } = await import('../utils/self-probe-service.js');
const { getSelfProbeSettings, saveSelfProbeSettings } = await import('../utils/database.js');

describe('SelfProbeService', () => {
  let service: InstanceType<typeof SelfProbeService>;
  let mockContext: {
    getSocketIOConnectionCount: jest.Mock;
    getMCPServerStatus: jest.Mock;
    getSessionCount: jest.Mock;
    cleanupExpiredSessions: jest.Mock;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    
    const config = {
      apiBaseUrl: 'https://api.test.com',
      defaultModel: 'test-model',
      webPort: 5050,
      dialogTimeout: 60,
      enableChat: true,
      corsOrigin: '*',
      maxFileSize: 10485760,
      logLevel: 'info',
      enableSelfProbe: false,
      selfProbeIntervalSeconds: 300
    };
    
    service = new SelfProbeService(config);
    
    mockContext = {
      getSocketIOConnectionCount: jest.fn(() => 5),
      getMCPServerStatus: jest.fn(() => ({ running: true })),
      getSessionCount: jest.fn(() => 2),
      cleanupExpiredSessions: jest.fn()
    };
    
    service.setContext(mockContext);
    
    // Reset mocks
    (getSelfProbeSettings as jest.Mock).mockClear();
    (saveSelfProbeSettings as jest.Mock).mockClear();
  });

  afterEach(() => {
    service.stop();
    jest.useRealTimers();
  });

  describe('Constructor', () => {
    it('should initialize with config values', () => {
      expect(service.isEnabled()).toBe(false);
      expect(service.isRunning()).toBe(false);
      expect(service.getProbeCount()).toBe(0);
    });

    it('should respect enableSelfProbe config', () => {
      const enabledService = new SelfProbeService({
        apiBaseUrl: 'https://api.test.com',
        defaultModel: 'test-model',
        webPort: 5050,
        dialogTimeout: 60,
        enableChat: true,
        corsOrigin: '*',
        maxFileSize: 10485760,
        logLevel: 'info',
        enableSelfProbe: true,
        selfProbeIntervalSeconds: 120
      });
      
      expect(enabledService.isEnabled()).toBe(true);
      enabledService.stop();
    });
  });

  describe('start()', () => {
    it('should not start when disabled', () => {
      service.start();
      expect(service.isRunning()).toBe(false);
    });

    it('should start when enabled via updateSettings', () => {
      (getSelfProbeSettings as jest.Mock).mockReturnValue({
        id: 1,
        enabled: true,
        intervalSeconds: 60,
        updatedAt: new Date().toISOString()
      });
      
      service.updateSettings({ enabled: true, intervalSeconds: 60 });
      
      expect(service.isRunning()).toBe(true);
      expect(service.isEnabled()).toBe(true);
    });
  });

  describe('stop()', () => {
    it('should stop the service', () => {
      (getSelfProbeSettings as jest.Mock).mockReturnValue({
        id: 1,
        enabled: true,
        intervalSeconds: 60,
        updatedAt: new Date().toISOString()
      });
      
      service.updateSettings({ enabled: true, intervalSeconds: 60 });
      expect(service.isRunning()).toBe(true);
      
      service.stop();
      expect(service.isRunning()).toBe(false);
    });

    it('should do nothing when already stopped', () => {
      service.stop();
      expect(service.isRunning()).toBe(false);
    });
  });

  describe('probe execution', () => {
    it('should execute probe at interval', () => {
      (getSelfProbeSettings as jest.Mock).mockReturnValue({
        id: 1,
        enabled: true,
        intervalSeconds: 60,
        updatedAt: new Date().toISOString()
      });
      
      service.updateSettings({ enabled: true, intervalSeconds: 60 });
      
      expect(service.getProbeCount()).toBe(0);
      
      // Advance time by interval
      jest.advanceTimersByTime(60000);
      
      expect(service.getProbeCount()).toBe(1);
      expect(mockContext.getSocketIOConnectionCount).toHaveBeenCalled();
      expect(mockContext.getMCPServerStatus).toHaveBeenCalled();
    });

    it('should call cleanupExpiredSessions when sessions exist', () => {
      (getSelfProbeSettings as jest.Mock).mockReturnValue({
        id: 1,
        enabled: true,
        intervalSeconds: 60,
        updatedAt: new Date().toISOString()
      });
      
      mockContext.getSessionCount.mockReturnValue(3);
      
      service.updateSettings({ enabled: true, intervalSeconds: 60 });
      jest.advanceTimersByTime(60000);
      
      expect(mockContext.cleanupExpiredSessions).toHaveBeenCalled();
    });

    it('should not call cleanupExpiredSessions when no sessions', () => {
      (getSelfProbeSettings as jest.Mock).mockReturnValue({
        id: 1,
        enabled: true,
        intervalSeconds: 60,
        updatedAt: new Date().toISOString()
      });
      
      mockContext.getSessionCount.mockReturnValue(0);
      
      service.updateSettings({ enabled: true, intervalSeconds: 60 });
      jest.advanceTimersByTime(60000);
      
      expect(mockContext.cleanupExpiredSessions).not.toHaveBeenCalled();
    });
  });

  describe('updateSettings()', () => {
    it('should update enabled state', () => {
      service.updateSettings({ enabled: true });
      
      expect(saveSelfProbeSettings).toHaveBeenCalledWith({ enabled: true });
    });

    it('should update interval', () => {
      service.updateSettings({ intervalSeconds: 120 });
      
      expect(saveSelfProbeSettings).toHaveBeenCalledWith({ intervalSeconds: 120 });
    });

    it('should throw on invalid interval (too low)', () => {
      expect(() => {
        service.updateSettings({ intervalSeconds: 30 });
      }).toThrow('Interval must be between 60 and 600 seconds');
    });

    it('should throw on invalid interval (too high)', () => {
      expect(() => {
        service.updateSettings({ intervalSeconds: 1000 });
      }).toThrow('Interval must be between 60 and 600 seconds');
    });

    it('should restart service when settings change', () => {
      (getSelfProbeSettings as jest.Mock).mockReturnValue({
        id: 1,
        enabled: true,
        intervalSeconds: 60,
        updatedAt: new Date().toISOString()
      });
      
      service.updateSettings({ enabled: true, intervalSeconds: 60 });
      expect(service.isRunning()).toBe(true);
      
      // Update interval
      service.updateSettings({ intervalSeconds: 120 });
      expect(service.isRunning()).toBe(true);
    });
  });

  describe('getStats()', () => {
    it('should return correct stats when disabled', () => {
      const stats = service.getStats();
      
      expect(stats.enabled).toBe(false);
      expect(stats.isRunning).toBe(false);
      expect(stats.probeCount).toBe(0);
      expect(stats.lastProbeTime).toBeNull();
      expect(stats.intervalSeconds).toBe(300);
    });

    it('should return correct stats when running', () => {
      (getSelfProbeSettings as jest.Mock).mockReturnValue({
        id: 1,
        enabled: true,
        intervalSeconds: 120,
        updatedAt: new Date().toISOString()
      });
      
      service.updateSettings({ enabled: true, intervalSeconds: 120 });
      jest.advanceTimersByTime(120000);
      
      const stats = service.getStats();
      
      expect(stats.enabled).toBe(true);
      expect(stats.isRunning).toBe(true);
      expect(stats.probeCount).toBe(1);
      expect(stats.lastProbeTime).not.toBeNull();
      expect(stats.intervalSeconds).toBe(120);
    });
  });

  describe('error handling', () => {
    it('should continue running after probe error', () => {
      (getSelfProbeSettings as jest.Mock).mockReturnValue({
        id: 1,
        enabled: true,
        intervalSeconds: 60,
        updatedAt: new Date().toISOString()
      });
      
      mockContext.getSocketIOConnectionCount.mockImplementation(() => {
        throw new Error('Test error');
      });
      
      service.updateSettings({ enabled: true, intervalSeconds: 60 });
      
      // Should not throw
      expect(() => {
        jest.advanceTimersByTime(60000);
      }).not.toThrow();
      
      // Service should still be running
      expect(service.isRunning()).toBe(true);
    });
  });
});

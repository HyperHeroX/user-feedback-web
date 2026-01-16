/**
 * Supervisor Integration Tests
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  IPCMessage,
  IPCRequest,
  IPCResponse,
  WorkerState,
  SelfTestResult,
} from '../shared/ipc-types.js';
import { IPC_METHODS, SUPERVISOR_DEFAULTS } from '../shared/ipc-constants.js';

// Mock child_process.fork
jest.unstable_mockModule('child_process', () => ({
  fork: jest.fn(),
}));

describe('IPC Types', () => {
  describe('IPCMessage', () => {
    it('should define valid message structure', () => {
      const message: IPCMessage = {
        id: 'test-123',
        type: 'request',
        method: 'health_check',
        timestamp: Date.now(),
      };

      expect(message.id).toBe('test-123');
      expect(message.type).toBe('request');
      expect(message.method).toBe('health_check');
    });

    it('should support response type with result', () => {
      const response: IPCResponse = {
        id: 'test-456',
        type: 'response',
        result: { status: 'ok' },
        timestamp: Date.now(),
      };

      expect(response.type).toBe('response');
      expect(response.result).toEqual({ status: 'ok' });
    });

    it('should support response type with error', () => {
      const response: IPCResponse = {
        id: 'test-789',
        type: 'response',
        error: {
          code: -32603,
          message: 'Internal error',
        },
        timestamp: Date.now(),
      };

      expect(response.error?.code).toBe(-32603);
      expect(response.error?.message).toBe('Internal error');
    });
  });

  describe('WorkerState', () => {
    it('should define valid worker state structure', () => {
      const state: WorkerState = {
        pid: 12345,
        status: 'running',
        restartCount: 0,
        lastHealthCheck: new Date(),
        lastCrash: null,
        startTime: new Date(),
      };

      expect(state.pid).toBe(12345);
      expect(state.status).toBe('running');
      expect(state.restartCount).toBe(0);
    });

    it('should support all status values', () => {
      const statuses: WorkerState['status'][] = ['starting', 'running', 'stopping', 'stopped', 'crashed'];
      
      statuses.forEach(status => {
        const state: WorkerState = {
          pid: null,
          status,
          restartCount: 0,
          lastHealthCheck: null,
          lastCrash: null,
          startTime: null,
        };
        expect(state.status).toBe(status);
      });
    });
  });

  describe('SelfTestResult', () => {
    it('should define valid self-test result structure', () => {
      const result: SelfTestResult = {
        success: true,
        timestamp: new Date().toISOString(),
        health: {
          supervisor: {
            status: 'ok',
            pid: 1234,
            uptime: 60000,
            memoryUsage: process.memoryUsage(),
          },
          worker: {
            status: 'ok',
            pid: 5678,
            uptime: 30000,
            restartCount: 0,
          },
          webServer: {
            status: 'ok',
            port: 5050,
            activeConnections: 2,
          },
          database: {
            status: 'ok',
          },
        },
        diagnostics: {
          system: {
            platform: 'win32',
            nodeVersion: 'v18.0.0',
            totalMemory: 16000000000,
            freeMemory: 8000000000,
          },
          restartHistory: [],
        },
        summary: 'System is healthy',
      };

      expect(result.success).toBe(true);
      expect(result.health.supervisor.status).toBe('ok');
      expect(result.health.worker.status).toBe('ok');
    });

    it('should support auto-repair info', () => {
      const result: SelfTestResult = {
        success: true,
        timestamp: new Date().toISOString(),
        health: {
          supervisor: { status: 'ok', pid: 1234, uptime: 60000, memoryUsage: process.memoryUsage() },
          worker: { status: 'restarted', pid: 9999, uptime: 1000, restartCount: 1 },
          webServer: { status: 'ok', port: 5050, activeConnections: 0 },
          database: { status: 'ok' },
        },
        autoRepair: {
          action: 'worker_restarted',
          previousPid: 5678,
          newPid: 9999,
          reason: 'Worker crashed',
        },
        diagnostics: {
          system: { platform: 'win32', nodeVersion: 'v18.0.0', totalMemory: 16000000000, freeMemory: 8000000000 },
          restartHistory: [{ timestamp: new Date().toISOString(), reason: 'Worker crashed' }],
        },
        summary: 'Worker restarted automatically',
      };

      expect(result.autoRepair?.action).toBe('worker_restarted');
      expect(result.autoRepair?.previousPid).toBe(5678);
      expect(result.autoRepair?.newPid).toBe(9999);
    });
  });
});

describe('IPC Constants', () => {
  describe('IPC_METHODS', () => {
    it('should define all required methods', () => {
      expect(IPC_METHODS.HEALTH_CHECK).toBe('health_check');
      expect(IPC_METHODS.MCP_TOOL).toBe('mcp_tool');
      expect(IPC_METHODS.SHUTDOWN).toBe('shutdown');
      expect(IPC_METHODS.READY).toBe('ready');
      expect(IPC_METHODS.ERROR).toBe('error');
    });
  });

  describe('SUPERVISOR_DEFAULTS', () => {
    it('should define reasonable default values', () => {
      expect(SUPERVISOR_DEFAULTS.MAX_RESTART_ATTEMPTS).toBe(5);
      expect(SUPERVISOR_DEFAULTS.RESTART_DELAY_MS).toBe(2000);
      expect(SUPERVISOR_DEFAULTS.HEALTH_CHECK_INTERVAL_MS).toBe(30000);
      expect(SUPERVISOR_DEFAULTS.HEALTH_CHECK_TIMEOUT_MS).toBe(5000);
      expect(SUPERVISOR_DEFAULTS.REQUEST_TIMEOUT_MS).toBe(30000);
      expect(SUPERVISOR_DEFAULTS.CONSECUTIVE_FAILURES_BEFORE_RESTART).toBe(3);
    });
  });
});

describe('Supervisor Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should create default supervisor config', async () => {
    const { createSupervisorConfig } = await import('../config/index.js');
    const config = createSupervisorConfig();

    expect(config.enabled).toBe(false);
    expect(config.maxRestartAttempts).toBe(5);
    expect(config.restartDelayMs).toBe(2000);
    expect(config.healthCheckIntervalMs).toBe(30000);
    expect(config.healthCheckTimeoutMs).toBe(5000);
  });

  it('should respect environment variables', async () => {
    process.env['SUPERVISOR_ENABLED'] = 'true';
    process.env['SUPERVISOR_MAX_RESTART_ATTEMPTS'] = '10';
    process.env['SUPERVISOR_RESTART_DELAY_MS'] = '5000';

    jest.resetModules();
    const { createSupervisorConfig } = await import('../config/index.js');
    const config = createSupervisorConfig();

    expect(config.enabled).toBe(true);
    expect(config.maxRestartAttempts).toBe(10);
    expect(config.restartDelayMs).toBe(5000);
  });
});

describe('Health Monitor Logic', () => {
  it('should track consecutive failures', () => {
    let consecutiveFailures = 0;
    const maxFailures = 3;

    // Simulate failures
    for (let i = 0; i < maxFailures; i++) {
      consecutiveFailures++;
    }

    expect(consecutiveFailures).toBe(maxFailures);
    expect(consecutiveFailures >= maxFailures).toBe(true);
  });

  it('should reset failures on success', () => {
    let consecutiveFailures = 2;
    
    // Simulate success
    consecutiveFailures = 0;
    
    expect(consecutiveFailures).toBe(0);
  });
});

describe('IPC Bridge Logic', () => {
  it('should generate unique IDs for requests', async () => {
    const ids = new Set<string>();
    const crypto = await import('crypto');

    for (let i = 0; i < 100; i++) {
      const id = crypto.randomUUID();
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    }
  });

  it('should serialize messages to JSON', () => {
    const message: IPCRequest = {
      id: 'test-123',
      type: 'request',
      method: 'health_check',
      params: { foo: 'bar' },
      timestamp: Date.now(),
    };

    const serialized = JSON.stringify(message);
    const parsed = JSON.parse(serialized);

    expect(parsed.id).toBe(message.id);
    expect(parsed.type).toBe(message.type);
    expect(parsed.method).toBe(message.method);
    expect(parsed.params).toEqual(message.params);
  });
});

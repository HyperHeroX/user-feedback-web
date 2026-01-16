/**
 * Supervisor Entry Point
 * Main entry for the MCP Server when running in supervisor mode
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { SupervisorService, SupervisorServiceConfig } from './supervisor-service.js';
import { MCPProxyHandler } from './mcp-proxy.js';
import { getConfig, createSupervisorConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function startSupervisorMode(): Promise<void> {
  logger.info('Starting in Supervisor mode...');

  const config = getConfig();
  const supervisorConfig = createSupervisorConfig();

  // Resolve worker script path
  const workerScript = path.resolve(__dirname, '../worker/index.js');

  const serviceConfig: SupervisorServiceConfig = {
    ...supervisorConfig,
    workerScript,
    workerArgs: [],
  };

  // Create MCP Server
  const mcpServer = new Server(
    {
      name: 'user-feedback-supervisor',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Create Supervisor Service
  const supervisor = new SupervisorService(serviceConfig);

  // Create MCP Proxy Handler
  const mcpProxy = new MCPProxyHandler(supervisor, mcpServer);

  // Setup event handlers
  setupSupervisorEvents(supervisor);

  // Setup graceful shutdown
  setupGracefulShutdown(supervisor);

  // Create transport
  const transport = new StdioServerTransport();

  // Connect MCP server
  await mcpServer.connect(transport);
  logger.info('MCP transport connected');

  // Start supervisor (which spawns worker)
  await supervisor.start();
  logger.info('Supervisor started successfully');

  // Keep process alive
  process.stdin.resume();
}

function setupSupervisorEvents(supervisor: SupervisorService): void {
  supervisor.on('worker:starting', () => {
    logger.info('Worker starting...');
  });

  supervisor.on('worker:ready', ({ pid }) => {
    logger.info(`Worker ready (PID: ${pid})`);
  });

  supervisor.on('worker:exited', ({ code, signal, wasRunning }) => {
    if (wasRunning) {
      logger.warn(`Worker exited unexpectedly (code: ${code}, signal: ${signal})`);
    } else {
      logger.info(`Worker exited (code: ${code}, signal: ${signal})`);
    }
  });

  supervisor.on('worker:restarted', ({ previousPid, newPid, reason }) => {
    logger.info(`Worker restarted: ${previousPid} -> ${newPid} (reason: ${reason})`);
  });

  supervisor.on('worker:error', (error) => {
    logger.error('Worker error:', error);
  });

  supervisor.on('worker:max-restarts-reached', ({ restartCount, maxAttempts }) => {
    logger.error(`Max restart attempts reached (${restartCount}/${maxAttempts}). Worker will not be restarted.`);
  });

  supervisor.on('health:ok', () => {
    logger.debug('Worker health check passed');
  });
}

function setupGracefulShutdown(supervisor: SupervisorService): void {
  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}, shutting down...`);

    try {
      await supervisor.stop();
      logger.info('Supervisor stopped');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  if (process.platform === 'win32') {
    process.on('SIGBREAK', () => shutdown('SIGBREAK'));
  }

  process.on('uncaughtException', async (error) => {
    logger.error('Uncaught exception in supervisor:', error);
    await shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection in supervisor:', reason);
    // Don't exit on unhandled rejection, just log it
  });
}

// Export for CLI usage
export { SupervisorService, MCPProxyHandler };

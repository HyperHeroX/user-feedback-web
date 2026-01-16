/**
 * Worker Entry Point
 * Entry point for worker process when spawned by supervisor
 */

import { WorkerService } from './worker-service.js';
import { logger } from '../utils/logger.js';

// Only run as worker if spawned by supervisor
const isWorkerProcess = process.env.IS_WORKER_PROCESS === 'true';

if (!isWorkerProcess) {
  console.error('This module should only be run as a worker process');
  process.exit(1);
}

const worker = new WorkerService();

// Setup error handlers
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in worker:', error);
  worker.stop().finally(() => process.exit(1));
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection in worker:', reason);
  // Don't exit on unhandled rejection
});

// Start worker
worker.start().catch((error) => {
  logger.error('Failed to start worker:', error);
  process.exit(1);
});

export { WorkerService };

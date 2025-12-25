/**
 * CLI Executor - 執行 CLI 工具的非互動模式命令
 */

import { spawn } from 'child_process';
import type { CLIToolType, CLIExecuteOptions, CLIExecuteResult, CLIErrorCode } from '../types/index.js';
import { logger } from './logger.js';

// 預設超時時間 (2分鐘)
const DEFAULT_TIMEOUT = 120000;

// CLI 命令配置
const CLI_COMMAND_CONFIG: Record<CLIToolType, { args: (prompt: string, outputFormat: string) => string[] }> = {
  gemini: {
    args: (prompt, outputFormat) => ['-p', prompt, '--output-format', outputFormat]
  },
  claude: {
    args: (prompt, outputFormat) => ['-p', prompt, '--output-format', outputFormat]
  }
};

/**
 * CLI 執行錯誤類別
 */
export class CLIError extends Error {
  constructor(
    public code: CLIErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

/**
 * 建構 CLI 命令參數
 */
export function buildCommandArgs(options: CLIExecuteOptions): string[] {
  const config = CLI_COMMAND_CONFIG[options.tool];
  if (!config) {
    throw new CLIError('CLI_NOT_INSTALLED' as CLIErrorCode, `Unknown CLI tool: ${options.tool}`);
  }

  const outputFormat = options.outputFormat || 'text';
  return config.args(options.prompt, outputFormat);
}

/**
 * 清理 CLI 輸出
 */
export function parseOutput(rawOutput: string, tool: CLIToolType): string {
  if (!rawOutput) return '';

  let output = rawOutput;

  // 移除 ANSI 轉義碼
  output = output.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
  output = output.replace(/\x1B\].*?\x07/g, '');

  // 移除前後空白
  output = output.trim();

  // 針對不同工具的特殊處理
  if (tool === 'gemini') {
    // Gemini CLI 可能有額外的狀態訊息需要移除
    const lines = output.split('\n');
    const filteredLines = lines.filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('Using model:') && 
             !trimmed.startsWith('Thinking...') &&
             !trimmed.startsWith('Loading');
    });
    output = filteredLines.join('\n').trim();
  }

  if (tool === 'claude') {
    // Claude CLI 可能有額外的狀態訊息
    const lines = output.split('\n');
    const filteredLines = lines.filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('⠋') && 
             !trimmed.startsWith('⠙') &&
             !trimmed.startsWith('⠹');
    });
    output = filteredLines.join('\n').trim();
  }

  return output;
}

/**
 * 執行 CLI 命令
 */
export async function executeCLI(options: CLIExecuteOptions): Promise<CLIExecuteResult> {
  const startTime = Date.now();
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  logger.info(`Executing CLI: ${options.tool}`, {
    promptLength: options.prompt.length,
    timeout,
    workingDirectory: options.workingDirectory
  });

  return new Promise((resolve) => {
    const args = buildCommandArgs(options);
    
    const spawnOptions: { cwd?: string; shell: boolean; timeout: number } = {
      shell: true,
      timeout
    };

    if (options.workingDirectory) {
      spawnOptions.cwd = options.workingDirectory;
    }

    const child = spawn(options.tool, args, spawnOptions);

    let stdout = '';
    let stderr = '';
    let killed = false;

    // 設定超時處理
    const timeoutHandle = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
      logger.warn(`CLI execution timeout: ${options.tool}`);
    }, timeout);

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timeoutHandle);
      const executionTime = Date.now() - startTime;
      
      logger.error(`CLI execution error: ${options.tool}`, { error: error.message });
      
      resolve({
        success: false,
        output: '',
        error: error.message,
        exitCode: -1,
        executionTime
      });
    });

    child.on('close', (code) => {
      clearTimeout(timeoutHandle);
      const executionTime = Date.now() - startTime;

      if (killed) {
        resolve({
          success: false,
          output: '',
          error: `Execution timeout after ${timeout}ms`,
          exitCode: -1,
          executionTime
        });
        return;
      }

      const exitCode = code ?? 0;
      const success = exitCode === 0;

      // 合併輸出（某些工具可能將內容輸出到 stderr）
      const rawOutput = stdout || stderr;
      const parsedOutput = parseOutput(rawOutput, options.tool);

      if (success) {
        logger.info(`CLI execution completed: ${options.tool}`, {
          exitCode,
          outputLength: parsedOutput.length,
          executionTime
        });
      } else {
        logger.warn(`CLI execution failed: ${options.tool}`, {
          exitCode,
          error: stderr || 'Unknown error',
          executionTime
        });
      }

      resolve({
        success,
        output: parsedOutput,
        error: success ? undefined : (stderr || 'Execution failed'),
        exitCode,
        executionTime
      });
    });
  });
}

/**
 * 快速測試 CLI 工具是否可正常執行
 */
export async function testCLIExecution(tool: CLIToolType): Promise<boolean> {
  try {
    const result = await executeCLI({
      tool,
      prompt: 'Say "OK" if you can receive this message.',
      timeout: 30000,
      outputFormat: 'text'
    });
    return result.success && result.output.length > 0;
  } catch {
    return false;
  }
}

/**
 * CLI Executor - 執行 CLI 工具的非互動模式命令
 */
import { spawn } from 'child_process';
import { logger } from './logger.js';
// 預設超時時間 (2分鐘)
const DEFAULT_TIMEOUT = 120000;
// CLI 命令配置 - 使用 stdin 傳遞 prompt 避免命令行長度限制
const CLI_COMMAND_CONFIG = {
    gemini: {
        // Gemini CLI: echo "prompt" | gemini --output-format <format>
        // 使用 stdin 傳遞 prompt 避免 ENAMETOOLONG 錯誤
        args: (outputFormat) => ['--output-format', outputFormat],
        useStdin: true
    },
    claude: {
        // Claude CLI: echo "prompt" | claude -p --output-format <format>
        // -p 是 --print 標誌（非互動模式）
        args: (outputFormat) => ['-p', '--output-format', outputFormat],
        useStdin: true
    }
};
/**
 * CLI 執行錯誤類別
 */
export class CLIError extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'CLIError';
    }
}
/**
 * 建構 CLI 命令參數（不包含 prompt，因為 prompt 透過 stdin 傳遞）
 */
export function buildCommandArgs(options) {
    const config = CLI_COMMAND_CONFIG[options.tool];
    if (!config) {
        throw new CLIError('CLI_NOT_INSTALLED', `Unknown CLI tool: ${options.tool}`);
    }
    const outputFormat = options.outputFormat || 'text';
    return config.args(outputFormat);
}
/**
 * 清理 CLI 輸出
 */
export function parseOutput(rawOutput, tool) {
    if (!rawOutput)
        return '';
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
 * 執行 CLI 命令（使用 stdin 傳遞 prompt）
 */
export async function executeCLI(options) {
    const startTime = Date.now();
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    logger.info(`[CLI] 開始執行: ${options.tool}`, {
        promptLength: options.prompt.length,
        promptKB: (options.prompt.length / 1024).toFixed(2) + ' KB',
        timeout: timeout + 'ms',
        timeoutSec: (timeout / 1000) + '秒',
        workingDirectory: options.workingDirectory
    });
    return new Promise((resolve) => {
        const args = buildCommandArgs(options);
        logger.info(`[CLI] 命令參數: ${options.tool} ${args.join(' ')}`);
        const spawnOptions = {
            shell: true,
            timeout
        };
        if (options.workingDirectory) {
            spawnOptions.cwd = options.workingDirectory;
        }
        const child = spawn(options.tool, args, spawnOptions);
        logger.info(`[CLI] 進程已啟動, PID: ${child.pid}`);
        let stdout = '';
        let stderr = '';
        let killed = false;
        // 透過 stdin 傳遞 prompt（避免命令行長度限制 ENAMETOOLONG）
        if (child.stdin) {
            logger.info(`[CLI] 正在透過 stdin 傳送 prompt (${options.prompt.length} 字元)...`);
            child.stdin.write(options.prompt);
            child.stdin.end();
            logger.info(`[CLI] stdin 傳送完成，等待回應...`);
        }
        // 設定超時處理
        const timeoutHandle = setTimeout(() => {
            killed = true;
            child.kill('SIGKILL');
            logger.warn(`[CLI] 執行超時: ${options.tool}`, {
                elapsed: Date.now() - startTime,
                timeout,
                stdoutLength: stdout.length,
                stderrLength: stderr.length
            });
        }, timeout);
        // 進度追蹤
        let lastProgressLog = Date.now();
        const progressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            logger.info(`[CLI] 執行中... ${(elapsed / 1000).toFixed(1)}s 已過`, {
                stdoutLength: stdout.length,
                stderrLength: stderr.length
            });
        }, 10000); // 每 10 秒記錄一次
        child.stdout?.on('data', (data) => {
            stdout += data.toString();
            logger.debug(`[CLI] stdout 收到 ${data.length} 字元`);
        });
        child.stderr?.on('data', (data) => {
            stderr += data.toString();
            logger.debug(`[CLI] stderr 收到 ${data.length} 字元`);
        });
        child.on('error', (error) => {
            clearTimeout(timeoutHandle);
            clearInterval(progressInterval);
            const executionTime = Date.now() - startTime;
            logger.error(`[CLI] 執行錯誤: ${options.tool}`, { error: error.message });
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
            clearInterval(progressInterval);
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
                logger.info(`[CLI] 執行完成: ${options.tool}`, {
                    exitCode,
                    outputLength: parsedOutput.length,
                    outputKB: (parsedOutput.length / 1024).toFixed(2) + ' KB',
                    executionTime: executionTime + 'ms',
                    executionSec: (executionTime / 1000).toFixed(1) + '秒'
                });
            }
            else {
                logger.warn(`[CLI] 執行失敗: ${options.tool}`, {
                    exitCode,
                    error: stderr || 'Unknown error',
                    executionTime: executionTime + 'ms'
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
export async function testCLIExecution(tool) {
    try {
        const result = await executeCLI({
            tool,
            prompt: 'Say "OK" if you can receive this message.',
            timeout: 30000,
            outputFormat: 'text'
        });
        return result.success && result.output.length > 0;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=cli-executor.js.map
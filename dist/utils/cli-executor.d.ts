/**
 * CLI Executor - 執行 CLI 工具的非互動模式命令
 */
import type { CLIToolType, CLIExecuteOptions, CLIExecuteResult, CLIErrorCode } from '../types/index.js';
/**
 * CLI 執行錯誤類別
 */
export declare class CLIError extends Error {
    code: CLIErrorCode;
    details?: unknown | undefined;
    constructor(code: CLIErrorCode, message: string, details?: unknown | undefined);
}
/**
 * 建構 CLI 命令參數（不包含 prompt，因為 prompt 透過 stdin 傳遞）
 */
export declare function buildCommandArgs(options: CLIExecuteOptions): string[];
/**
 * 清理 CLI 輸出
 */
export declare function parseOutput(rawOutput: string, tool: CLIToolType): string;
/**
 * 執行 CLI 命令（使用 stdin 傳遞 prompt）
 */
export declare function executeCLI(options: CLIExecuteOptions): Promise<CLIExecuteResult>;
/**
 * 快速測試 CLI 工具是否可正常執行
 */
export declare function testCLIExecution(tool: CLIToolType): Promise<boolean>;
//# sourceMappingURL=cli-executor.d.ts.map
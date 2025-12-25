/**
 * CLI Detector - 檢測系統上已安裝的 CLI 工具
 */
import type { CLIToolInfo, CLIToolType, CLIDetectionResult } from '../types/index.js';
/**
 * 檢查單一 CLI 工具是否已安裝
 */
export declare function checkToolInstalled(toolName: CLIToolType): Promise<CLIToolInfo>;
/**
 * 取得 CLI 工具版本
 */
export declare function getToolVersion(toolName: CLIToolType): Promise<string | null>;
/**
 * 檢測所有支援的 CLI 工具
 */
export declare function detectCLITools(forceRefresh?: boolean): Promise<CLIDetectionResult>;
/**
 * 取得已安裝的 CLI 工具列表
 */
export declare function getInstalledTools(): Promise<CLIToolInfo[]>;
/**
 * 檢查特定工具是否可用
 */
export declare function isToolAvailable(toolName: CLIToolType): Promise<boolean>;
/**
 * 清除檢測快取
 */
export declare function clearDetectionCache(): void;
//# sourceMappingURL=cli-detector.d.ts.map
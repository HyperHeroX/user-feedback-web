/**
 * CLI Detector - 檢測系統上已安裝的 CLI 工具
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { CLIToolInfo, CLIToolType, CLIDetectionResult } from '../types/index.js';
import { logger } from './logger.js';

const execAsync = promisify(exec);

// 快取設定
const CACHE_TTL = 5 * 60 * 1000; // 5 分鐘
let detectionCache: CLIDetectionResult | null = null;
let cacheTimestamp = 0;

// 支援的 CLI 工具配置
const CLI_TOOLS_CONFIG: Record<CLIToolType, { versionArg: string }> = {
  gemini: { versionArg: '--version' },
  claude: { versionArg: '--version' }
};

/**
 * 判斷是否為 Windows 系統
 */
function isWindows(): boolean {
  return process.platform === 'win32';
}

/**
 * 取得定位命令的系統命令
 */
function getLocateCommand(toolName: string): string {
  return isWindows() ? `where ${toolName}` : `which ${toolName}`;
}

/**
 * 執行命令並取得輸出
 */
async function executeCommand(command: string, timeout = 5000): Promise<{ stdout: string; stderr: string } | null> {
  try {
    const result = await execAsync(command, { timeout });
    return result;
  } catch {
    return null;
  }
}

/**
 * 檢查單一 CLI 工具是否已安裝
 */
export async function checkToolInstalled(toolName: CLIToolType): Promise<CLIToolInfo> {
  const result: CLIToolInfo = {
    name: toolName,
    installed: false,
    version: null,
    path: null,
    command: toolName
  };

  try {
    // 定位工具路徑
    const locateCommand = getLocateCommand(toolName);
    const locateResult = await executeCommand(locateCommand);

    if (!locateResult || !locateResult.stdout.trim()) {
      logger.debug(`CLI tool not found: ${toolName}`);
      return result;
    }

    // 取得路徑（Windows 可能回傳多行，取第一行）
    const paths = locateResult.stdout.trim().split('\n');
    const toolPath = paths[0]?.trim() ?? null;
    result.path = toolPath;
    result.command = toolPath ?? toolName;

    // 取得版本
    const version = await getToolVersion(toolName);
    if (version) {
      result.installed = true;
      result.version = version;
      logger.info(`CLI tool detected: ${toolName} v${version} at ${result.path}`);
    }
  } catch (error) {
    logger.debug(`Error checking tool ${toolName}: ${error}`);
  }

  return result;
}

/**
 * 取得 CLI 工具版本
 */
export async function getToolVersion(toolName: CLIToolType): Promise<string | null> {
  const config = CLI_TOOLS_CONFIG[toolName];
  if (!config) return null;

  try {
    const versionCommand = `${toolName} ${config.versionArg}`;
    const result = await executeCommand(versionCommand);

    if (!result) return null;

    // 從輸出中提取版本號
    const output = result.stdout || result.stderr;
    const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
    
    return versionMatch?.[1] ?? output.trim().split('\n')[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * 檢測所有支援的 CLI 工具
 */
export async function detectCLITools(forceRefresh = false): Promise<CLIDetectionResult> {
  // 檢查快取
  const now = Date.now();
  if (!forceRefresh && detectionCache && (now - cacheTimestamp) < CACHE_TTL) {
    logger.debug('Returning cached CLI detection result');
    return detectionCache;
  }

  logger.info('Detecting CLI tools...');

  const toolNames = Object.keys(CLI_TOOLS_CONFIG) as CLIToolType[];
  const tools = await Promise.all(toolNames.map(name => checkToolInstalled(name)));

  const result: CLIDetectionResult = {
    tools,
    timestamp: new Date().toISOString()
  };

  // 更新快取
  detectionCache = result;
  cacheTimestamp = now;

  const installedCount = tools.filter(t => t.installed).length;
  logger.info(`CLI detection complete: ${installedCount}/${tools.length} tools installed`);

  return result;
}

/**
 * 取得已安裝的 CLI 工具列表
 */
export async function getInstalledTools(): Promise<CLIToolInfo[]> {
  const result = await detectCLITools();
  return result.tools.filter(t => t.installed);
}

/**
 * 檢查特定工具是否可用
 */
export async function isToolAvailable(toolName: CLIToolType): Promise<boolean> {
  const result = await detectCLITools();
  const tool = result.tools.find(t => t.name === toolName);
  return tool?.installed ?? false;
}

/**
 * 清除檢測快取
 */
export function clearDetectionCache(): void {
  detectionCache = null;
  cacheTimestamp = 0;
  logger.debug('CLI detection cache cleared');
}

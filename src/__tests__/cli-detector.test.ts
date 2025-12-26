/**
 * CLI Detector 單元測試
 * 測試 CLI 工具偵測功能
 */

import {
    detectCLITools,
    checkToolInstalled,
    isToolAvailable,
    clearDetectionCache,
    getInstalledTools
} from '../utils/cli-detector.js';
import type { CLIToolInfo, CLIToolType, CLIDetectionResult } from '../types/index.js';

describe('CLI Detector', () => {
    beforeEach(() => {
        clearDetectionCache();
    });

    describe('checkToolInstalled', () => {
        it('應該對不存在的工具返回 installed: false', async () => {
            // 使用一個不太可能存在的工具名稱
            const result = await checkToolInstalled('nonexistent-tool-xyz' as CLIToolType);
            expect(result.installed).toBe(false);
            expect(result.name).toBe('nonexistent-tool-xyz');
        }, 10000);

        it('應該返回 CLIToolInfo 結構', async () => {
            const result = await checkToolInstalled('gemini');

            expect(result).toHaveProperty('name');
            expect(result).toHaveProperty('installed');
            expect(result).toHaveProperty('version');
            expect(result).toHaveProperty('path');
            expect(result).toHaveProperty('command');
            expect(typeof result.installed).toBe('boolean');
        }, 10000);
    });

    describe('detectCLITools', () => {
        it('應該返回 CLIDetectionResult 結構', async () => {
            const result = await detectCLITools();

            expect(result).toHaveProperty('tools');
            expect(result).toHaveProperty('timestamp');
            expect(Array.isArray(result.tools)).toBe(true);
            expect(typeof result.timestamp).toBe('string');
        }, 15000);

        it('應該包含 gemini 和 claude 工具資訊', async () => {
            const result = await detectCLITools();

            const gemini = result.tools.find(t => t.name === 'gemini');
            const claude = result.tools.find(t => t.name === 'claude');

            expect(gemini).toBeDefined();
            expect(claude).toBeDefined();
        }, 15000);

        it('每個工具應有必要屬性', async () => {
            const result = await detectCLITools();

            result.tools.forEach((tool: CLIToolInfo) => {
                expect(tool).toHaveProperty('name');
                expect(tool).toHaveProperty('installed');
                expect(tool).toHaveProperty('version');
                expect(tool).toHaveProperty('path');
                expect(tool).toHaveProperty('command');
                expect(typeof tool.installed).toBe('boolean');
            });
        }, 15000);

        it('應該使用快取避免重複偵測', async () => {
            const startTime1 = Date.now();
            const result1 = await detectCLITools();
            const duration1 = Date.now() - startTime1;

            const startTime2 = Date.now();
            const result2 = await detectCLITools();
            const duration2 = Date.now() - startTime2;

            // 第二次呼叫應該快很多（使用快取）
            expect(duration2).toBeLessThanOrEqual(duration1);
            // 結果應該相同
            expect(result1.timestamp).toBe(result2.timestamp);
        }, 20000);

        it('強制刷新應該重新偵測', async () => {
            const result1 = await detectCLITools();

            // 等待一小段時間確保時間戳會不同
            await new Promise(resolve => setTimeout(resolve, 100));

            const result2 = await detectCLITools(true);

            // 強制刷新應該產生新的時間戳
            expect(result2.timestamp).not.toBe(result1.timestamp);
        }, 20000);
    });

    describe('isToolAvailable', () => {
        it('應該返回布林值', async () => {
            const result = await isToolAvailable('gemini');
            expect(typeof result).toBe('boolean');
        }, 10000);

        it('應該對不支援的工具類型返回 false', async () => {
            const result = await isToolAvailable('unknown-tool' as CLIToolType);
            expect(result).toBe(false);
        }, 10000);
    });

    describe('getInstalledTools', () => {
        it('應該只返回已安裝的工具', async () => {
            const tools = await getInstalledTools();

            expect(Array.isArray(tools)).toBe(true);
            tools.forEach((tool: CLIToolInfo) => {
                expect(tool.installed).toBe(true);
            });
        }, 15000);
    });

    describe('clearDetectionCache', () => {
        it('應該成功清除快取', async () => {
            // 先載入快取
            const result1 = await detectCLITools();

            // 清除應該不會拋出錯誤
            expect(() => clearDetectionCache()).not.toThrow();

            // 等待一小段時間
            await new Promise(resolve => setTimeout(resolve, 100));

            // 清除後重新偵測應該產生新的時間戳
            const result2 = await detectCLITools();
            expect(result2.timestamp).not.toBe(result1.timestamp);
        }, 20000);
    });
});


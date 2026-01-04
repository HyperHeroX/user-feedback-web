/**
 * Prompt Aggregator 整合測試
 */
import { getPromptPreview, generateAIReply } from '../utils/ai-service.js';
import { getPromptAggregator, PromptAggregator } from '../utils/prompt-aggregator/index.js';
import type { AIReplyRequest } from '../types/index.js';

jest.mock('../utils/database.js', () => ({
    getAISettings: jest.fn(() => ({
        systemPrompt: 'You are a helpful assistant.',
        temperature: 0.7,
        maxTokens: 1000
    })),
    getCLISettings: jest.fn(() => ({
        cliTool: 'gemini',
        cliTimeout: 60000,
        aiMode: 'api'
    })),
    getCLITerminalById: jest.fn(),
    createCLITerminal: jest.fn(),
    updateCLITerminal: jest.fn(),
    insertCLIExecutionLog: jest.fn()
}));

jest.mock('../utils/mcp-client-manager.js', () => ({
    mcpClientManager: {
        getAllTools: jest.fn(() => []),
        callTool: jest.fn()
    }
}));

describe('Prompt Aggregator Integration', () => {
    describe('getPromptPreview', () => {
        it('should return preview result with success', async () => {
            const request: AIReplyRequest = {
                aiMessage: 'Test AI message',
                projectName: 'TestProject',
                projectPath: '/test/path'
            };

            const result = await getPromptPreview(request);

            expect(result.success).toBe(true);
            expect(result.prompt).toBeDefined();
            expect(result.prompt.length).toBeGreaterThan(0);
            expect(result.mode).toBe('api');
        });

        it('should include AI message in preview', async () => {
            const request: AIReplyRequest = {
                aiMessage: 'This is my work summary',
                projectName: 'TestProject',
                projectPath: '/test/path'
            };

            const result = await getPromptPreview(request);

            expect(result.success).toBe(true);
            expect(result.prompt).toContain('This is my work summary');
        });

        it('should include user context when provided', async () => {
            const request: AIReplyRequest = {
                aiMessage: 'Summary',
                userContext: 'Additional user context',
                projectName: 'TestProject',
                projectPath: '/test/path'
            };

            const result = await getPromptPreview(request);

            expect(result.success).toBe(true);
            expect(result.prompt).toContain('Additional user context');
        });

        it('should include tool results when provided', async () => {
            const request: AIReplyRequest = {
                aiMessage: 'Summary',
                toolResults: 'Previous tool execution output',
                projectName: 'TestProject',
                projectPath: '/test/path'
            };

            const result = await getPromptPreview(request);

            expect(result.success).toBe(true);
            expect(result.prompt).toContain('Previous tool execution output');
        });

        it('should handle errors gracefully', async () => {
            jest.doMock('../utils/prompt-aggregator/index.js', () => {
                throw new Error('Module error');
            });

            const request: AIReplyRequest = {
                aiMessage: 'Test',
                projectName: 'TestProject',
                projectPath: '/test/path'
            };

            const result = await getPromptPreview(request);
            expect(result.success).toBeDefined();
        });
    });

    describe('PromptAggregator consistency', () => {
        it('should produce consistent output for same input', () => {
            const aggregator = new PromptAggregator();
            const context = {
                request: {
                    aiMessage: 'Consistent test message',
                    projectName: 'TestProject',
                    projectPath: '/test'
                },
                settings: {
                    systemPrompt: 'System prompt',
                    temperature: 0.7,
                    maxTokens: 1000
                },
                cliSettings: null,
                mode: 'api' as const,
                mcpTools: []
            };

            const result1 = aggregator.aggregate(context);
            const result2 = aggregator.aggregate(context);

            expect(result1.fullPrompt).toBe(result2.fullPrompt);
            expect(result1.sections.length).toBe(result2.sections.length);
        });

        it('should maintain component order across calls', () => {
            const aggregator = new PromptAggregator();
            const context = {
                request: {
                    aiMessage: 'Test message',
                    userContext: 'Context',
                    projectName: 'TestProject',
                    projectPath: '/test'
                },
                settings: {
                    systemPrompt: 'System',
                    temperature: 0.7,
                    maxTokens: 1000
                },
                cliSettings: null,
                mode: 'api' as const,
                mcpTools: []
            };

            const result = aggregator.aggregate(context);
            const sectionNames = result.sections.map(s => s.name);

            const systemIndex = sectionNames.indexOf('SystemPrompt');
            const aiMessageIndex = sectionNames.indexOf('AIMessage');
            const userContextIndex = sectionNames.indexOf('UserContext');
            const closingIndex = sectionNames.indexOf('ClosingPrompt');

            if (systemIndex !== -1 && aiMessageIndex !== -1) {
                expect(systemIndex).toBeLessThan(aiMessageIndex);
            }
            if (userContextIndex !== -1 && aiMessageIndex !== -1) {
                expect(userContextIndex).toBeLessThan(aiMessageIndex);
            }
            if (aiMessageIndex !== -1 && closingIndex !== -1) {
                expect(aiMessageIndex).toBeLessThan(closingIndex);
            }
        });
    });

    describe('Mode-specific behavior', () => {
        it('should handle API mode correctly', async () => {
            const request: AIReplyRequest = {
                aiMessage: 'API mode test',
                projectName: 'TestProject',
                projectPath: '/test/path'
            };

            const result = await getPromptPreview(request);
            expect(result.mode).toBe('api');
        });

        it('should generate different metadata for different modes', () => {
            const aggregator = new PromptAggregator();

            const apiContext = {
                request: { aiMessage: 'Test', projectName: 'Test', projectPath: '/test' },
                settings: { systemPrompt: '', temperature: 0.7, maxTokens: 1000 },
                cliSettings: null,
                mode: 'api' as const,
                mcpTools: []
            };

            const cliContext = {
                ...apiContext,
                mode: 'cli' as const,
                cliSettings: { cliTool: 'gemini' as const, cliTimeout: 60000, aiMode: 'cli' as const }
            };

            const apiResult = aggregator.aggregate(apiContext);
            const cliResult = aggregator.aggregate(cliContext);

            expect(apiResult.metadata.mode).toBe('api');
            expect(cliResult.metadata.mode).toBe('cli');
        });
    });

    describe('buildContextSync', () => {
        it('should build context synchronously', () => {
            const aggregator = getPromptAggregator();
            const request: AIReplyRequest = {
                aiMessage: 'Sync test',
                projectName: 'TestProject',
                projectPath: '/test/path'
            };

            const context = aggregator.buildContextSync(
                request,
                { systemPrompt: 'Test', temperature: 0.7, maxTokens: 1000 },
                null,
                []
            );

            expect(context.request).toBe(request);
            expect(context.settings).toBeDefined();
            expect(context.mode).toBeDefined();
        });

        it('should include MCP tools when provided', () => {
            const aggregator = getPromptAggregator();
            const request: AIReplyRequest = {
                aiMessage: 'Test',
                projectName: 'TestProject',
                projectPath: '/test/path'
            };

            const mcpTools = [
                { name: 'tool1', description: 'Tool 1' },
                { name: 'tool2', description: 'Tool 2' }
            ];

            const context = aggregator.buildContextSync(
                request,
                null,
                null,
                mcpTools
            );

            expect(context.mcpTools).toEqual(mcpTools);
        });
    });

    describe('Token estimation', () => {
        it('should estimate tokens based on prompt length', () => {
            const aggregator = new PromptAggregator();
            const shortContext = {
                request: { aiMessage: 'Short', projectName: 'Test', projectPath: '/test' },
                settings: { systemPrompt: '', temperature: 0.7, maxTokens: 1000 },
                cliSettings: null,
                mode: 'api' as const,
                mcpTools: []
            };

            const longContext = {
                ...shortContext,
                request: {
                    aiMessage: 'A'.repeat(1000),
                    projectName: 'Test',
                    projectPath: '/test'
                },
                settings: {
                    systemPrompt: 'B'.repeat(500),
                    temperature: 0.7,
                    maxTokens: 1000
                }
            };

            const shortResult = aggregator.aggregate(shortContext);
            const longResult = aggregator.aggregate(longContext);

            expect(longResult.metadata.tokenEstimate).toBeGreaterThan(
                shortResult.metadata.tokenEstimate
            );
        });
    });
});

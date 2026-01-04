/**
 * Prompt Aggregator 單元測試
 */
import {
    PromptAggregator,
    getPromptAggregator,
    SystemPromptComponent,
    MCPToolsPromptComponent,
    UserContextComponent,
    ToolResultsComponent,
    AIMessageComponent,
    ClosingPromptComponent
} from '../utils/prompt-aggregator/index.js';
import type { PromptContext, IPromptComponent } from '../types/ai-provider.js';
import type { AIReplyRequest } from '../types/index.js';

describe('Prompt Aggregator', () => {
    describe('PromptAggregator class', () => {
        it('should be a singleton when using getInstance', () => {
            const instance1 = PromptAggregator.getInstance();
            const instance2 = PromptAggregator.getInstance();
            expect(instance1).toBe(instance2);
        });

        it('should return instance from getPromptAggregator factory', () => {
            const instance = getPromptAggregator();
            expect(instance).toBeInstanceOf(PromptAggregator);
        });

        it('should have default components registered when using getInstance', () => {
            const aggregator = PromptAggregator.getInstance();
            const componentCount = aggregator.getComponentCount();
            expect(componentCount).toBeGreaterThan(0);
        });

        it('should return component names', () => {
            const aggregator = PromptAggregator.getInstance();
            const names = aggregator.getComponentNames();
            expect(names).toContain('SystemPrompt');
            expect(names).toContain('MCPTools');
            expect(names).toContain('UserContext');
            expect(names).toContain('ToolResults');
            expect(names).toContain('AIMessage');
            expect(names).toContain('Closing');
        });

        it('should aggregate components in order', () => {
            const aggregator = PromptAggregator.getInstance();
            const context = createMockContext({
                aiMessage: 'Test AI message',
                userContext: 'Test user context'
            });
            context.settings = {
                systemPrompt: 'Test system prompt',
                temperature: 0.7,
                maxTokens: 1000
            };

            const result = aggregator.aggregate(context);

            expect(result.fullPrompt).toContain('Test system prompt');
            expect(result.fullPrompt).toContain('Test AI message');
            expect(result.fullPrompt).toContain('Test user context');
            expect(result.sections.length).toBeGreaterThan(0);
            expect(result.metadata.componentCount).toBeGreaterThan(0);
        });

        it('should sort sections by order', () => {
            const aggregator = PromptAggregator.getInstance();
            const context = createMockContext({
                aiMessage: 'Test message',
                userContext: 'Test context'
            });
            context.settings = {
                systemPrompt: 'System',
                temperature: 0.7,
                maxTokens: 1000
            };

            const result = aggregator.aggregate(context);
            const orders = result.sections.map(s => s.order);

            for (let i = 1; i < orders.length; i++) {
                expect(orders[i]).toBeGreaterThanOrEqual(orders[i - 1]);
            }
        });

        it('should include metadata in aggregation result', () => {
            const aggregator = PromptAggregator.getInstance();
            const context = createMockContext({ aiMessage: 'Test' });
            const result = aggregator.aggregate(context);

            expect(result.metadata).toBeDefined();
            expect(result.metadata.mode).toBe('api');
            expect(result.metadata.tokenEstimate).toBeGreaterThan(0);
            expect(result.metadata.componentCount).toBeGreaterThan(0);
            expect(result.metadata.timestamp).toBeDefined();
        });
    });

    describe('SystemPromptComponent', () => {
        let component: SystemPromptComponent;

        beforeEach(() => {
            component = new SystemPromptComponent();
        });

        it('should have correct name and order', () => {
            expect(component.getName()).toBe('SystemPrompt');
            expect(component.getOrder()).toBe(10);
        });

        it('should return system prompt from settings', () => {
            const context = createMockContext({});
            context.settings = {
                systemPrompt: 'You are a helpful assistant.',
                temperature: 0.7,
                maxTokens: 1000
            };

            const result = component.build(context);
            expect(result).toBe('You are a helpful assistant.');
        });

        it('should return null when no system prompt', () => {
            const context = createMockContext({});
            context.settings = {
                systemPrompt: '',
                temperature: 0.7,
                maxTokens: 1000
            };

            const result = component.build(context);
            expect(result).toBeNull();
        });

        it('should return null when settings is null', () => {
            const context = createMockContext({});
            context.settings = null;

            const result = component.build(context);
            expect(result).toBeNull();
        });
    });

    describe('UserContextComponent', () => {
        let component: UserContextComponent;

        beforeEach(() => {
            component = new UserContextComponent();
        });

        it('should have correct name and order', () => {
            expect(component.getName()).toBe('UserContext');
            expect(component.getOrder()).toBe(30);
        });

        it('should format user context', () => {
            const context = createMockContext({
                userContext: 'Additional context from user'
            });

            const result = component.build(context);
            expect(result).toContain('使用者上下文');
            expect(result).toContain('Additional context from user');
        });

        it('should return null when no user context', () => {
            const context = createMockContext({});
            const result = component.build(context);
            expect(result).toBeNull();
        });
    });

    describe('AIMessageComponent', () => {
        let component: AIMessageComponent;

        beforeEach(() => {
            component = new AIMessageComponent();
        });

        it('should have correct name and order', () => {
            expect(component.getName()).toBe('AIMessage');
            expect(component.getOrder()).toBe(50);
        });

        it('should format AI message', () => {
            const context = createMockContext({
                aiMessage: 'This is the AI work summary'
            });

            const result = component.build(context);
            expect(result).toContain('AI 工作匯報');
            expect(result).toContain('This is the AI work summary');
        });

        it('should return null when no AI message', () => {
            const context = createMockContext({});
            const result = component.build(context);
            expect(result).toBeNull();
        });
    });

    describe('ToolResultsComponent', () => {
        let component: ToolResultsComponent;

        beforeEach(() => {
            component = new ToolResultsComponent();
        });

        it('should have correct name and order', () => {
            expect(component.getName()).toBe('ToolResults');
            expect(component.getOrder()).toBe(40);
        });

        it('should format tool results', () => {
            const context = createMockContext({
                toolResults: 'Tool execution output'
            });

            const result = component.build(context);
            expect(result).toContain('先前工具執行結果');
            expect(result).toContain('Tool execution output');
        });

        it('should return null when no tool results', () => {
            const context = createMockContext({});
            const result = component.build(context);
            expect(result).toBeNull();
        });
    });

    describe('ClosingPromptComponent', () => {
        let component: ClosingPromptComponent;

        beforeEach(() => {
            component = new ClosingPromptComponent();
        });

        it('should have correct name and order', () => {
            expect(component.getName()).toBe('Closing');
            expect(component.getOrder()).toBe(100);
        });

        it('should return closing prompt for API mode', () => {
            const context = createMockContext({});
            context.mode = 'api';

            const result = component.build(context);
            expect(result).toBeDefined();
            expect(result!.length).toBeGreaterThan(0);
        });

        it('should return closing prompt for CLI mode', () => {
            const context = createMockContext({});
            context.mode = 'cli';

            const result = component.build(context);
            expect(result).toBeDefined();
            expect(result!.length).toBeGreaterThan(0);
        });
    });

    describe('MCPToolsPromptComponent', () => {
        let component: MCPToolsPromptComponent;

        beforeEach(() => {
            component = new MCPToolsPromptComponent();
        });

        it('should have correct name and order', () => {
            expect(component.getName()).toBe('MCPTools');
            expect(component.getOrder()).toBe(20);
        });

        it('should return null when no MCP tools', () => {
            const context = createMockContext({});
            context.mcpTools = [];

            const result = component.build(context);
            expect(result).toBeNull();
        });

        it('should return null when includeMCPTools is false', () => {
            const context = createMockContext({ includeMCPTools: false });
            context.mcpTools = [
                { name: 'test_tool', description: 'A test tool' }
            ];

            const result = component.build(context);
            expect(result).toBeNull();
        });
    });

    describe('Component ordering', () => {
        it('should have correct relative ordering', () => {
            const system = new SystemPromptComponent();
            const mcpTools = new MCPToolsPromptComponent();
            const userContext = new UserContextComponent();
            const toolResults = new ToolResultsComponent();
            const aiMessage = new AIMessageComponent();
            const closing = new ClosingPromptComponent();

            expect(system.getOrder()).toBeLessThan(mcpTools.getOrder());
            expect(mcpTools.getOrder()).toBeLessThan(userContext.getOrder());
            expect(userContext.getOrder()).toBeLessThan(toolResults.getOrder());
            expect(toolResults.getOrder()).toBeLessThan(aiMessage.getOrder());
            expect(aiMessage.getOrder()).toBeLessThan(closing.getOrder());
        });
    });

    describe('Empty/missing data handling', () => {
        it('should handle all empty data gracefully', () => {
            const aggregator = PromptAggregator.getInstance();
            const context = createMockContext({});
            context.settings = null;
            context.mcpTools = [];

            const result = aggregator.aggregate(context);
            expect(result.fullPrompt).toBeDefined();
        });

        it('should skip components that return null', () => {
            const aggregator = PromptAggregator.getInstance();
            const context = createMockContext({});
            context.settings = null;

            const result = aggregator.aggregate(context);
            const systemSection = result.sections.find(s => s.name === 'SystemPrompt');
            expect(systemSection).toBeUndefined();
        });
    });

    describe('Prompt size analysis', () => {
        it('should calculate prompt size in bytes and KB', () => {
            const aggregator = PromptAggregator.getInstance();
            const context = createMockContext({
                aiMessage: 'A'.repeat(1000), // 1000 bytes
                userContext: 'B'.repeat(500) // 500 bytes
            });
            context.settings = {
                systemPrompt: 'C'.repeat(200), // 200 bytes
                temperature: 0.7,
                maxTokens: 1000
            };

            const result = aggregator.aggregate(context);

            expect(result.fullPrompt.length).toBeGreaterThan(1700);
            expect(result.metadata.totalLength).toBe(result.fullPrompt.length);

            const sizeKB = result.fullPrompt.length / 1024;
            expect(sizeKB).toBeGreaterThan(1.5); // 至少 1.5 KB
        });

        it('should handle large MCP tools definition', () => {
            const aggregator = PromptAggregator.getInstance();
            const context = createMockContext({
                aiMessage: 'Test message',
                includeMCPTools: true
            });

            // 模擬大量 MCP 工具
            context.mcpTools = Array.from({ length: 50 }, (_, i) => ({
                name: `tool_${i}`,
                description: 'D'.repeat(100), // 100 bytes per tool
                inputSchema: {
                    type: 'object',
                    properties: {
                        param1: { type: 'string', description: 'E'.repeat(50) },
                        param2: { type: 'number', description: 'F'.repeat(50) }
                    }
                }
            }));

            const result = aggregator.aggregate(context);

            // 50 tools * ~200 bytes = ~10KB for tools alone
            expect(result.metadata.mcpToolsSize).toBeGreaterThan(5000);
        });

        it('should provide detailed metadata for debugging', () => {
            const aggregator = PromptAggregator.getInstance();
            const context = createMockContext({
                aiMessage: 'Test AI message',
                userContext: 'Test user context'
            });
            context.settings = {
                systemPrompt: 'Test system prompt',
                temperature: 0.7,
                maxTokens: 1000
            };

            const result = aggregator.aggregate(context);

            expect(result.metadata).toHaveProperty('componentCount');
            expect(result.metadata).toHaveProperty('totalLength');
            expect(result.metadata.componentCount).toBeGreaterThan(0);
            expect(result.metadata.totalLength).toBeGreaterThan(0);
        });
    });
});

function createMockContext(request: Partial<AIReplyRequest>): PromptContext {
    return {
        request: {
            aiMessage: request.aiMessage || '',
            userContext: request.userContext,
            toolResults: request.toolResults,
            projectName: request.projectName || 'TestProject',
            projectPath: request.projectPath || '/test/path',
            includeMCPTools: request.includeMCPTools ?? false
        },
        settings: null,
        cliSettings: null,
        mode: 'api',
        mcpTools: []
    };
}

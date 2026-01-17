/**
 * 提示詞聚合器核心類別
 * 統一管理所有提示詞的組合、預覽和紀錄
 */
import type {
    IPromptComponent,
    PromptContext,
    AggregatedPrompt,
    PromptSection,
    PromptMetadata,
    PromptPreviewResult,
    AIProviderMode,
    McpTool
} from '../../types/ai-provider.js';
import type { AIReplyRequest, AISettings, CLISettings } from '../../types/index.js';
import {
    SystemPromptComponent,
    PinnedPromptsComponent,
    MCPToolsPromptComponent,
    MCPToolsDetailedComponent,
    UserContextComponent,
    ToolResultsComponent,
    AIMessageComponent,
    ClosingPromptComponent
} from './components/index.js';
import { getAISettings, getCLISettings, getPromptConfigs } from '../database.js';
import { mcpClientManager } from '../mcp-client-manager.js';
import { logger } from '../logger.js';
import type { PromptConfig } from '../../types/ai-provider.js';

const COMPONENT_NAME_MAP: Record<string, string> = {
    'system_prompt': 'SystemPrompt',
    'mcp_tools': 'MCPToolsPrompt',
    'mcp_tools_detailed': 'MCPToolsDetailed',
    'user_context': 'UserContext',
    'tool_results': 'ToolResults',
    'closing': 'ClosingPrompt'
};

export class PromptAggregator {
    private static instance: PromptAggregator;
    private components: IPromptComponent[] = [];
    private initialized = false;

    private constructor() { }

    static getInstance(): PromptAggregator {
        if (!PromptAggregator.instance) {
            PromptAggregator.instance = new PromptAggregator();
            PromptAggregator.instance.initDefaultComponents();
        }
        return PromptAggregator.instance;
    }

    private initDefaultComponents(): void {
        if (this.initialized) return;

        this.register(new SystemPromptComponent());
        this.register(new PinnedPromptsComponent());
        this.register(new MCPToolsPromptComponent());
        this.register(new MCPToolsDetailedComponent());
        this.register(new UserContextComponent());
        this.register(new ToolResultsComponent());
        this.register(new AIMessageComponent());
        this.register(new ClosingPromptComponent());

        this.initialized = true;
        logger.debug('[PromptAggregator] 已初始化預設組件');
    }

    register(component: IPromptComponent): void {
        this.components.push(component);
        this.components.sort((a, b) => a.getOrder() - b.getOrder());
        logger.debug(`[PromptAggregator] 註冊組件: ${component.getName()} (order: ${component.getOrder()})`);
    }

    aggregate(context: PromptContext): AggregatedPrompt {
        const sections: PromptSection[] = [];
        const promptParts: string[] = [];

        const configs = this.getPromptConfigsWithDefaults();
        const isFirstCall = (context as { isFirstCall?: boolean }).isFirstCall !== false;

        const configuredComponents = this.components
            .map(component => {
                const configId = Object.entries(COMPONENT_NAME_MAP).find(
                    ([, name]) => name === component.getName()
                )?.[0];
                const config = configId ? configs.find(c => c.id === configId) : null;
                const order = config
                    ? (isFirstCall ? config.firstOrder : config.secondOrder)
                    : component.getOrder();
                const enabled = config ? config.enabled : true;
                return { component, order, enabled };
            })
            .filter(item => item.enabled && item.order > 0)
            .sort((a, b) => a.order - b.order);

        for (const { component, order } of configuredComponents) {
            const content = component.build(context);
            if (content) {
                sections.push({ name: component.getName(), content, order });
                promptParts.push(content);
            }
        }

        const fullPrompt = promptParts.join('\n\n');

        // 計算 MCP 工具大小
        let mcpToolsSize = 0;
        const mcpToolsCount = context.mcpTools?.length ?? 0;
        if (context.mcpTools && context.mcpTools.length > 0) {
            try {
                mcpToolsSize = JSON.stringify(context.mcpTools).length;
            } catch {
                mcpToolsSize = 0;
            }
        }

        const metadata: PromptMetadata = {
            mode: context.mode,
            tokenEstimate: this.estimateTokens(fullPrompt),
            componentCount: sections.length,
            timestamp: new Date().toISOString(),
            totalLength: fullPrompt.length,
            mcpToolsSize,
            mcpToolsCount
        };
        if (context.cliSettings?.cliTool) {
            metadata.cliTool = context.cliSettings.cliTool;
        }

        return { fullPrompt, sections, metadata };
    }

    async preview(request: AIReplyRequest): Promise<PromptPreviewResult> {
        try {
            const context = await this.buildContext(request);
            const aggregated = this.aggregate(context);

            const result: PromptPreviewResult = {
                success: true,
                prompt: aggregated.fullPrompt,
                mode: context.mode,
                sections: aggregated.sections,
                metadata: aggregated.metadata
            };
            if (context.cliSettings?.cliTool) {
                result.cliTool = context.cliSettings.cliTool;
            }
            return result;
        } catch (error) {
            logger.error('[PromptAggregator] 預覽失敗:', error);
            return {
                success: false,
                prompt: '',
                mode: 'api',
                error: error instanceof Error ? error.message : '獲取提示詞失敗'
            };
        }
    }

    async buildContext(request: AIReplyRequest): Promise<PromptContext> {
        const settings = getAISettings();
        const cliSettings = getCLISettings();
        const mode: AIProviderMode = cliSettings?.aiMode === 'cli' ? 'cli' : 'api';

        let mcpTools: McpTool[] = [];
        if (request.includeMCPTools) {
            try {
                const allTools = mcpClientManager.getAllTools();
                mcpTools = allTools.map(tool => ({
                    name: tool.name,
                    description: tool.description,
                    inputSchema: tool.inputSchema as Record<string, unknown>
                }));
            } catch {
                logger.warn('[PromptAggregator] 無法獲取 MCP 工具');
            }
        }

        return {
            request,
            settings: settings ?? null,
            cliSettings,
            mode,
            mcpTools
        };
    }

    buildContextSync(
        request: AIReplyRequest,
        settings: AISettings | null,
        cliSettings: CLISettings | null,
        mcpTools: McpTool[] = []
    ): PromptContext {
        const mode: AIProviderMode = cliSettings?.aiMode === 'cli' ? 'cli' : 'api';
        return { request, settings, cliSettings, mode, mcpTools };
    }

    private estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }

    getComponentCount(): number {
        return this.components.length;
    }

    getComponentNames(): string[] {
        return this.components.map(c => c.getName());
    }

    private getPromptConfigsWithDefaults(): PromptConfig[] {
        try {
            const configs = getPromptConfigs();
            if (configs.length > 0) return configs;
        } catch {
            logger.warn('[PromptAggregator] 無法從資料庫獲取提示詞配置，使用預設值');
        }
        return [
            { id: 'system_prompt', name: 'System Prompt', displayName: '系統提示詞', content: null, firstOrder: 10, secondOrder: 10, enabled: true, editable: false, createdAt: '', updatedAt: '' },
            { id: 'mcp_tools', name: 'MCP Tools', displayName: 'MCP 工具說明', content: null, firstOrder: 20, secondOrder: 0, enabled: true, editable: true, createdAt: '', updatedAt: '' },
            { id: 'user_context', name: 'User Context', displayName: '用戶上下文', content: null, firstOrder: 30, secondOrder: 20, enabled: true, editable: true, createdAt: '', updatedAt: '' },
            { id: 'tool_results', name: 'Tool Results', displayName: '工具執行結果', content: null, firstOrder: 0, secondOrder: 30, enabled: true, editable: false, createdAt: '', updatedAt: '' },
            { id: 'closing', name: 'Closing', displayName: '結尾提示', content: null, firstOrder: 40, secondOrder: 40, enabled: true, editable: true, createdAt: '', updatedAt: '' }
        ];
    }
}

export function getPromptAggregator(): PromptAggregator {
    return PromptAggregator.getInstance();
}

/**
 * 提示詞聚合器核心類別
 * 統一管理所有提示詞的組合、預覽和紀錄
 */
import type { IPromptComponent, PromptContext, AggregatedPrompt, PromptPreviewResult, McpTool } from '../../types/ai-provider.js';
import type { AIReplyRequest, AISettings, CLISettings } from '../../types/index.js';
export declare class PromptAggregator {
    private static instance;
    private components;
    private initialized;
    private constructor();
    static getInstance(): PromptAggregator;
    private initDefaultComponents;
    register(component: IPromptComponent): void;
    aggregate(context: PromptContext): AggregatedPrompt;
    preview(request: AIReplyRequest): Promise<PromptPreviewResult>;
    buildContext(request: AIReplyRequest): Promise<PromptContext>;
    buildContextSync(request: AIReplyRequest, settings: AISettings | null, cliSettings: CLISettings | null, mcpTools?: McpTool[]): PromptContext;
    private estimateTokens;
    getComponentCount(): number;
    getComponentNames(): string[];
}
export declare function getPromptAggregator(): PromptAggregator;
//# sourceMappingURL=prompt-aggregator.d.ts.map
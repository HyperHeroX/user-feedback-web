/**
 * CLI Provider
 * 使用 CLI 工具 (gemini/claude) 生成 AI 回覆
 */
import type { IAIProvider, AIProviderMode } from '../types/ai-provider.js';
import type { AIReplyRequest, AIReplyResponse, CLISettings } from '../types/index.js';
export declare class CLIProvider implements IAIProvider {
    private cliSettings;
    constructor(cliSettings: CLISettings);
    getName(): string;
    getMode(): AIProviderMode;
    isAvailable(): Promise<boolean>;
    generateReply(request: AIReplyRequest): Promise<AIReplyResponse>;
    private buildCLIPrompt;
}
//# sourceMappingURL=cli-provider.d.ts.map
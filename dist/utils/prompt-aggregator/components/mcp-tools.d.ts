/**
 * MCP 工具提示詞組件
 */
import type { PromptContext } from '../../../types/ai-provider.js';
import { BasePromptComponent } from './base-component.js';
export declare class MCPToolsPromptComponent extends BasePromptComponent {
    constructor();
    build(context: PromptContext): string | null;
    private buildToolsList;
}
//# sourceMappingURL=mcp-tools.d.ts.map
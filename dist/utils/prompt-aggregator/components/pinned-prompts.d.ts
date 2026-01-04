/**
 * 釘選提示詞組件 - 在系統提示詞之後、MCP 工具之前插入釘選的提示詞
 */
import type { PromptContext } from '../../../types/ai-provider.js';
import { BasePromptComponent } from './base-component.js';
export declare class PinnedPromptsComponent extends BasePromptComponent {
    constructor();
    build(context: PromptContext): string | null;
}
//# sourceMappingURL=pinned-prompts.d.ts.map
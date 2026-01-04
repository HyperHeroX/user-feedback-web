/**
 * 釘選提示詞組件 - 在系統提示詞之後、MCP 工具之前插入釘選的提示詞
 */
import type { PromptContext } from '../../../types/ai-provider.js';
import { BasePromptComponent } from './base-component.js';
import { getPinnedPrompts } from '../../database.js';

export class PinnedPromptsComponent extends BasePromptComponent {
    constructor() {
        // order 15: 在 SystemPrompt (10) 之後，MCPTools (20) 之前
        super('PinnedPrompts', 15);
    }

    build(context: PromptContext): string | null {
        const pinnedPrompts = getPinnedPrompts();

        if (!pinnedPrompts || pinnedPrompts.length === 0) {
            return null;
        }

        const contents = pinnedPrompts
            .map(p => p.content)
            .filter((c): c is string => !!c)
            .join('\n\n');

        if (!contents) {
            return null;
        }

        if (context.mode === 'cli') {
            return `## 釘選提示詞\n${contents}`;
        }

        return `釘選提示詞：\n${contents}`;
    }
}

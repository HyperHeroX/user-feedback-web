import { BasePromptComponent } from './base-component.js';
import { getPinnedPrompts } from '../../database.js';
export class PinnedPromptsComponent extends BasePromptComponent {
    constructor() {
        // order 15: 在 SystemPrompt (10) 之後，MCPTools (20) 之前
        super('PinnedPrompts', 15);
    }
    build(context) {
        const pinnedPrompts = getPinnedPrompts();
        if (!pinnedPrompts || pinnedPrompts.length === 0) {
            return null;
        }
        const contents = pinnedPrompts
            .map(p => p.content)
            .filter((c) => !!c)
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
//# sourceMappingURL=pinned-prompts.js.map
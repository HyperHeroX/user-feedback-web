/**
 * 系統提示詞組件
 */
import type { PromptContext } from '../../../types/ai-provider.js';
import { BasePromptComponent } from './base-component.js';

export class SystemPromptComponent extends BasePromptComponent {
    constructor() {
        super('SystemPrompt', 10);
    }

    build(context: PromptContext): string | null {
        const { settings, mode } = context;

        if (!settings?.systemPrompt) {
            return null;
        }

        if (mode === 'cli') {
            return `## 系統指令\n${settings.systemPrompt}`;
        }

        return settings.systemPrompt;
    }
}

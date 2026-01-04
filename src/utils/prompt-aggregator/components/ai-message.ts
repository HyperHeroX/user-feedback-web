/**
 * AI 訊息組件
 */
import type { PromptContext } from '../../../types/ai-provider.js';
import { BasePromptComponent } from './base-component.js';

export class AIMessageComponent extends BasePromptComponent {
    constructor() {
        super('AIMessage', 50);
    }

    build(context: PromptContext): string | null {
        const { request, mode } = context;

        if (!request.aiMessage) {
            return null;
        }

        if (mode === 'cli') {
            return `## AI 工作匯報\n${request.aiMessage}`;
        }

        return `AI 工作匯報：\n${request.aiMessage}`;
    }
}

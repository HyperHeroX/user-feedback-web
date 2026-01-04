/**
 * 使用者上下文組件
 */
import type { PromptContext } from '../../../types/ai-provider.js';
import { BasePromptComponent } from './base-component.js';

export class UserContextComponent extends BasePromptComponent {
    constructor() {
        super('UserContext', 30);
    }

    build(context: PromptContext): string | null {
        const { request, mode } = context;

        if (!request.userContext) {
            return null;
        }

        if (mode === 'cli') {
            return `## 使用者上下文\n${request.userContext}`;
        }

        return `使用者上下文：\n${request.userContext}`;
    }
}

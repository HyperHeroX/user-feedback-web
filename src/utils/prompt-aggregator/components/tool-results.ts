/**
 * 工具結果組件
 */
import type { PromptContext } from '../../../types/ai-provider.js';
import { BasePromptComponent } from './base-component.js';

export class ToolResultsComponent extends BasePromptComponent {
    constructor() {
        super('ToolResults', 40);
    }

    build(context: PromptContext): string | null {
        const { request, mode } = context;

        if (!request.toolResults) {
            return null;
        }

        if (mode === 'cli') {
            return `## 工具執行結果\n${request.toolResults}`;
        }

        return `先前工具執行結果：\n${request.toolResults}`;
    }
}

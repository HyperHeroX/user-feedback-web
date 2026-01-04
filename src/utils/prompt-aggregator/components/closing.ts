/**
 * 結尾提示詞組件
 */
import type { PromptContext } from '../../../types/ai-provider.js';
import { BasePromptComponent } from './base-component.js';

export class ClosingPromptComponent extends BasePromptComponent {
    constructor() {
        super('Closing', 100);
    }

    build(context: PromptContext): string | null {
        const { mode } = context;

        if (mode === 'cli') {
            return '請根據以上內容提供簡潔的回覆或建議。';
        }

        return '請生成一個簡潔、專業的回應：';
    }
}

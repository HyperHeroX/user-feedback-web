import { BasePromptComponent } from './base-component.js';
export class AIMessageComponent extends BasePromptComponent {
    constructor() {
        super('AIMessage', 50);
    }
    build(context) {
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
//# sourceMappingURL=ai-message.js.map
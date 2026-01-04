import { BasePromptComponent } from './base-component.js';
export class ToolResultsComponent extends BasePromptComponent {
    constructor() {
        super('ToolResults', 40);
    }
    build(context) {
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
//# sourceMappingURL=tool-results.js.map
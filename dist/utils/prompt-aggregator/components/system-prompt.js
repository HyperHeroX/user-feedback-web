import { BasePromptComponent } from './base-component.js';
export class SystemPromptComponent extends BasePromptComponent {
    constructor() {
        super('SystemPrompt', 10);
    }
    build(context) {
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
//# sourceMappingURL=system-prompt.js.map
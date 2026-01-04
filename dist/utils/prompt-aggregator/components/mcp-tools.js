import { BasePromptComponent } from './base-component.js';
export class MCPToolsPromptComponent extends BasePromptComponent {
    constructor() {
        super('MCPTools', 20);
    }
    build(context) {
        const { request, settings, mode, mcpTools } = context;
        if (!request.includeMCPTools) {
            return null;
        }
        let mcpPrompt = settings?.mcpToolsPrompt || '';
        if (mcpPrompt) {
            mcpPrompt = mcpPrompt
                .replace(/\{project_name\}/g, request.projectName || '未命名專案')
                .replace(/\{project_path\}/g, request.projectPath || '');
        }
        if (mcpTools && mcpTools.length > 0) {
            const toolsList = this.buildToolsList(mcpTools);
            if (mcpPrompt) {
                mcpPrompt += '\n\n' + toolsList;
            }
            else {
                mcpPrompt = toolsList;
            }
        }
        if (!mcpPrompt) {
            return null;
        }
        if (mode === 'cli') {
            return `## MCP 工具指令\n${mcpPrompt}`;
        }
        return mcpPrompt;
    }
    buildToolsList(tools) {
        if (!tools || tools.length === 0) {
            return '';
        }
        let result = '## 可用工具列表\n\n';
        for (const tool of tools) {
            result += `### ${tool.name}\n`;
            if (tool.description) {
                result += `${tool.description}\n`;
            }
            if (tool.inputSchema) {
                result += '\n參數格式:\n```json\n';
                result += JSON.stringify(tool.inputSchema, null, 2);
                result += '\n```\n';
            }
            result += '\n';
        }
        return result;
    }
}
//# sourceMappingURL=mcp-tools.js.map
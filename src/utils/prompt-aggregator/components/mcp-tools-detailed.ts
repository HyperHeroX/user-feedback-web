/**
 * MCP 工具詳細列表組件
 * 當啟用時，動態獲取所有 MCP 工具的詳細說明和 JSON 格式
 */
import type { PromptContext } from '../../../types/ai-provider.js';
import { BasePromptComponent } from './base-component.js';
import { mcpClientManager } from '../../mcp-client-manager.js';

export class MCPToolsDetailedComponent extends BasePromptComponent {
    constructor() {
        super('MCPToolsDetailed', 25);
    }

    build(context: PromptContext): string | null {
        const { request } = context;

        if (!request.includeMCPTools) {
            return null;
        }

        try {
            const allTools = mcpClientManager.getAllTools();

            if (!allTools || allTools.length === 0) {
                return null;
            }

            let result = '## MCP 工具詳細使用說明\n\n';
            result += '以下是所有可用的 MCP 工具及其詳細使用方式：\n\n';

            for (const tool of allTools) {
                result += `### ${tool.name}\n\n`;

                if (tool.description) {
                    result += `**說明**: ${tool.description}\n\n`;
                }

                if (tool.inputSchema) {
                    result += '**參數格式**:\n```json\n';
                    result += JSON.stringify(tool.inputSchema, null, 2);
                    result += '\n```\n\n';

                    const schema = tool.inputSchema as Record<string, unknown>;
                    if (schema.properties && typeof schema.properties === 'object') {
                        result += '**參數說明**:\n';
                        const props = schema.properties as Record<string, { type?: string; description?: string }>;
                        const required = (schema.required as string[]) || [];

                        for (const [propName, propDef] of Object.entries(props)) {
                            const isRequired = required.includes(propName);
                            result += `- \`${propName}\``;
                            if (propDef.type) result += ` (${propDef.type})`;
                            if (isRequired) result += ' **必填**';
                            if (propDef.description) result += `: ${propDef.description}`;
                            result += '\n';
                        }
                        result += '\n';
                    }
                }

                result += '**調用範例**:\n```json\n';
                result += JSON.stringify({
                    tool_calls: [{
                        name: tool.name,
                        arguments: this.generateExampleArgs(tool.inputSchema as Record<string, unknown>)
                    }]
                }, null, 2);
                result += '\n```\n\n---\n\n';
            }

            return result;
        } catch {
            return null;
        }
    }

    private generateExampleArgs(schema: Record<string, unknown> | null): Record<string, unknown> {
        if (!schema || !schema.properties) {
            return {};
        }

        const result: Record<string, unknown> = {};
        const props = schema.properties as Record<string, { type?: string }>;

        for (const [propName, propDef] of Object.entries(props)) {
            switch (propDef.type) {
                case 'string':
                    result[propName] = '<字串值>';
                    break;
                case 'number':
                case 'integer':
                    result[propName] = 0;
                    break;
                case 'boolean':
                    result[propName] = true;
                    break;
                case 'array':
                    result[propName] = [];
                    break;
                case 'object':
                    result[propName] = {};
                    break;
                default:
                    result[propName] = '<值>';
            }
        }

        return result;
    }
}

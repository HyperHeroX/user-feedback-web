/**
 * MCP Tool Call Parser
 * 解析 AI 回覆中的 tool_calls JSON 格式
 */

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallResult {
  hasToolCalls: boolean;
  toolCalls: ToolCall[];
  message: string | null;
}

export interface ToolExecutionResult {
  name: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * 從 AI 回覆中提取 JSON 內容
 * 支援 markdown code block 格式
 */
function extractJSON(text: string): string | null {
  const jsonBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    return jsonBlockMatch[1].trim();
  }

  const jsonMatch = text.match(/\{[\s\S]*"tool_calls"[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return null;
}

/**
 * 驗證 tool_calls 結構
 */
function validateToolCalls(data: unknown): data is { tool_calls: ToolCall[]; message?: string } {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj['tool_calls'])) {
    return false;
  }

  for (const call of obj['tool_calls']) {
    if (typeof call !== 'object' || call === null) {
      return false;
    }
    const toolCall = call as Record<string, unknown>;
    if (typeof toolCall['name'] !== 'string') {
      return false;
    }
    if (typeof toolCall['arguments'] !== 'object' || toolCall['arguments'] === null) {
      return false;
    }
  }

  return true;
}

/**
 * 解析 AI 回覆中的工具呼叫
 * @param aiResponse AI 的原始回覆文字
 * @returns ToolCallResult 解析結果
 */
export function parseToolCalls(aiResponse: string): ToolCallResult {
  const jsonContent = extractJSON(aiResponse);

  if (!jsonContent) {
    return {
      hasToolCalls: false,
      toolCalls: [],
      message: aiResponse,
    };
  }

  try {
    const parsed = JSON.parse(jsonContent);

    if (!validateToolCalls(parsed)) {
      return {
        hasToolCalls: false,
        toolCalls: [],
        message: aiResponse,
      };
    }

    return {
      hasToolCalls: parsed.tool_calls.length > 0,
      toolCalls: parsed.tool_calls,
      message: parsed.message ?? null,
    };
  } catch {
    return {
      hasToolCalls: false,
      toolCalls: [],
      message: aiResponse,
    };
  }
}

/**
 * 格式化工具執行結果為 AI 可讀的訊息
 * @param results 工具執行結果陣列
 * @returns 格式化的訊息字串
 */
export function formatToolResults(results: ToolExecutionResult[]): string {
  const lines: string[] = ['Tool execution results:'];

  for (const result of results) {
    if (result.success) {
      lines.push(`- ${result.name}: SUCCESS`);
      if (result.result !== undefined) {
        const resultStr = typeof result.result === 'string' 
          ? result.result 
          : JSON.stringify(result.result, null, 2);
        lines.push(`  Result: ${resultStr}`);
      }
    } else {
      lines.push(`- ${result.name}: FAILED`);
      if (result.error) {
        lines.push(`  Error: ${result.error}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * 建構包含工具描述的 system prompt 片段
 * @param tools 可用的 MCP 工具列表
 * @returns system prompt 片段
 */
export function buildToolsPrompt(tools: Array<{ name: string; description?: string; inputSchema?: unknown }>): string {
  if (tools.length === 0) {
    return '';
  }

  const lines: string[] = [
    '',
    '## Available MCP Tools',
    'You can call the following tools by responding with a JSON object containing a "tool_calls" array.',
    'Format:',
    '```json',
    '{',
    '  "tool_calls": [',
    '    { "name": "tool_name", "arguments": { "param1": "value1" } }',
    '  ],',
    '  "message": "Optional message to show while executing"',
    '}',
    '```',
    '',
    'Available tools:',
  ];

  for (const tool of tools) {
    lines.push(`### ${tool.name}`);
    if (tool.description) {
      lines.push(tool.description);
    }
    if (tool.inputSchema) {
      lines.push('Input schema:');
      lines.push('```json');
      lines.push(JSON.stringify(tool.inputSchema, null, 2));
      lines.push('```');
    }
    lines.push('');
  }

  return lines.join('\n');
}

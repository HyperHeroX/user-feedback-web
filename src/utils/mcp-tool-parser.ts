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
 * @param projectName 專案名稱（可選）
 * @param projectPath 專案路徑（可選）
 * @returns system prompt 片段
 */
export function buildToolsPrompt(
  tools: Array<{ name: string; description?: string; inputSchema?: unknown }>,
  projectName?: string,
  projectPath?: string
): string {
  if (tools.length === 0) {
    return '';
  }

  const lines: string[] = [];

  // 專案背景資訊
  if (projectName || projectPath) {
    lines.push('');
    lines.push('## 專案背景資訊');
    lines.push(`當前專案: ${projectName || '未命名專案'}`);
    if (projectPath) {
      lines.push(`專案路徑: ${projectPath}`);
    }
    lines.push('');
    lines.push('**重要指示**: 在回覆之前，你應該先使用 MCP 工具來查詢專案的背景資訊：');
    lines.push('1. 專案的架構和結構（如使用 get_symbols_overview, list_dir 等）');
    lines.push('2. 專案的開發計劃和規範（如讀取 openspec 目錄中的文件）');
    lines.push('3. 當前的任務和進度');
    lines.push('');
    lines.push('**請務必先調用工具查詢專案資訊**，然後根據查詢結果提供精確的回覆。');
  }

  // 工具使用說明
  lines.push('');
  lines.push('## MCP 工具使用說明');
  lines.push('');
  lines.push('當你需要使用工具時，請回覆一個 JSON 格式的工具調用請求（不要有其他文字）：');
  lines.push('');
  lines.push('```json');
  lines.push('{');
  lines.push('  "tool_calls": [');
  lines.push('    { "name": "工具名稱", "arguments": { "參數名": "參數值" } }');
  lines.push('  ],');
  lines.push('  "message": "說明你正在做什麼（可選）"');
  lines.push('}');
  lines.push('```');
  lines.push('');
  lines.push('工具執行後，結果會回傳給你。你可以繼續調用更多工具，或根據結果提供最終回覆。');
  lines.push('當你不需要調用工具時，直接以純文字回覆即可。');
  lines.push('');
  lines.push('## 可用工具列表');
  lines.push('');

  for (const tool of tools) {
    lines.push(`### ${tool.name}`);
    if (tool.description) {
      lines.push(tool.description);
    }
    if (tool.inputSchema) {
      lines.push('');
      lines.push('參數格式:');
      lines.push('```json');
      lines.push(JSON.stringify(tool.inputSchema, null, 2));
      lines.push('```');
    }
    lines.push('');
  }

  return lines.join('\n');
}

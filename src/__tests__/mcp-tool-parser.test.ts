import { parseToolCalls, formatToolResults, buildToolsPrompt, ToolExecutionResult } from '../utils/mcp-tool-parser';

describe('mcp-tool-parser', () => {
  describe('parseToolCalls', () => {
    it('should parse valid JSON with tool_calls', () => {
      const response = `\`\`\`json
{
  "tool_calls": [
    { "name": "list_files", "arguments": { "path": "/src" } }
  ],
  "message": "Listing files..."
}
\`\`\``;

      const result = parseToolCalls(response);
      expect(result.hasToolCalls).toBe(true);
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('list_files');
      expect(result.toolCalls[0].arguments).toEqual({ path: '/src' });
      expect(result.message).toBe('Listing files...');
    });

    it('should parse JSON without code block', () => {
      const response = `{"tool_calls": [{"name": "read_file", "arguments": {"file": "test.txt"}}]}`;

      const result = parseToolCalls(response);
      expect(result.hasToolCalls).toBe(true);
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('read_file');
    });

    it('should handle multiple tool calls', () => {
      const response = `\`\`\`json
{
  "tool_calls": [
    { "name": "tool1", "arguments": {} },
    { "name": "tool2", "arguments": { "x": 1 } }
  ]
}
\`\`\``;

      const result = parseToolCalls(response);
      expect(result.hasToolCalls).toBe(true);
      expect(result.toolCalls).toHaveLength(2);
    });

    it('should return plain message for non-JSON response', () => {
      const response = 'This is a plain text response without any tool calls.';

      const result = parseToolCalls(response);
      expect(result.hasToolCalls).toBe(false);
      expect(result.toolCalls).toHaveLength(0);
      expect(result.message).toBe(response);
    });

    it('should handle invalid JSON gracefully', () => {
      const response = '```json\n{invalid json}\n```';

      const result = parseToolCalls(response);
      expect(result.hasToolCalls).toBe(false);
      expect(result.toolCalls).toHaveLength(0);
      expect(result.message).toBe(response);
    });

    it('should handle empty tool_calls array', () => {
      const response = '{"tool_calls": [], "message": "No tools needed"}';

      const result = parseToolCalls(response);
      expect(result.hasToolCalls).toBe(false);
      expect(result.toolCalls).toHaveLength(0);
      expect(result.message).toBe('No tools needed');
    });

    it('should reject invalid tool_calls structure', () => {
      const response = '{"tool_calls": [{"invalid": "structure"}]}';

      const result = parseToolCalls(response);
      expect(result.hasToolCalls).toBe(false);
      expect(result.message).toBe(response);
    });
  });

  describe('formatToolResults', () => {
    it('should format successful results', () => {
      const results: ToolExecutionResult[] = [
        { name: 'list_files', success: true, result: ['file1.txt', 'file2.txt'] },
      ];

      const formatted = formatToolResults(results);
      expect(formatted).toContain('list_files: SUCCESS');
      expect(formatted).toContain('file1.txt');
    });

    it('should format failed results', () => {
      const results: ToolExecutionResult[] = [
        { name: 'read_file', success: false, error: 'File not found' },
      ];

      const formatted = formatToolResults(results);
      expect(formatted).toContain('read_file: FAILED');
      expect(formatted).toContain('File not found');
    });

    it('should format mixed results', () => {
      const results: ToolExecutionResult[] = [
        { name: 'tool1', success: true, result: 'ok' },
        { name: 'tool2', success: false, error: 'error' },
      ];

      const formatted = formatToolResults(results);
      expect(formatted).toContain('tool1: SUCCESS');
      expect(formatted).toContain('tool2: FAILED');
    });
  });

  describe('buildToolsPrompt', () => {
    it('should build prompt with tools', () => {
      const tools = [
        { name: 'list_files', description: 'List files in directory', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
      ];

      const prompt = buildToolsPrompt(tools);
      expect(prompt).toContain('Available MCP Tools');
      expect(prompt).toContain('list_files');
      expect(prompt).toContain('List files in directory');
      expect(prompt).toContain('tool_calls');
    });

    it('should return empty string for no tools', () => {
      const prompt = buildToolsPrompt([]);
      expect(prompt).toBe('');
    });
  });
});

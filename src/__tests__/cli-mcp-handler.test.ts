/**
 * CLI MCP Handler 單元測試
 * 測試不依賴外部 mock 的功能
 */
import { CLIMCPResponseHandler, createCLIMCPHandler } from '../utils/prompt-aggregator/handlers/cli-mcp-handler.js';

describe('CLI MCP Handler', () => {
    let handler: CLIMCPResponseHandler;

    beforeEach(() => {
        handler = new CLIMCPResponseHandler(10);
    });

    describe('createCLIMCPHandler factory', () => {
        it('should create handler with default max iterations', () => {
            const h = createCLIMCPHandler();
            expect(h).toBeInstanceOf(CLIMCPResponseHandler);
            expect(h.getMaxIterations()).toBe(10);
        });

        it('should create handler with custom max iterations', () => {
            const h = createCLIMCPHandler(5);
            expect(h.getMaxIterations()).toBe(5);
        });
    });

    describe('parseToolCallsFromResponse', () => {
        it('should return empty array when no tool calls detected', () => {
            const response = 'This is a normal response without any tool calls.';
            const result = handler.parseToolCallsFromResponse(response);
            expect(result).toEqual([]);
        });

        it('should detect tool calls in JSON format', () => {
            const response = `\`\`\`json
{
  "tool_calls": [
    { "name": "read_file", "arguments": { "path": "/test/file.txt" } }
  ]
}
\`\`\``;

            const result = handler.parseToolCallsFromResponse(response);
            expect(result.length).toBe(1);
            expect(result[0].toolName).toBe('read_file');
        });

        it('should detect tool calls without code block', () => {
            const response = `{"tool_calls": [{"name": "list_directory", "arguments": {"path": "/test"}}]}`;

            const result = handler.parseToolCallsFromResponse(response);
            expect(result.length).toBe(1);
            expect(result[0].toolName).toBe('list_directory');
        });

        it('should detect multiple tool calls', () => {
            const response = `\`\`\`json
{
  "tool_calls": [
    { "name": "read_file", "arguments": { "path": "/test/a.txt" } },
    { "name": "write_file", "arguments": { "path": "/test/b.txt", "content": "hello" } }
  ]
}
\`\`\``;

            const result = handler.parseToolCallsFromResponse(response);
            expect(result.length).toBe(2);
            expect(result[0].toolName).toBe('read_file');
            expect(result[1].toolName).toBe('write_file');
        });

        it('should extract server name from tool name with double underscore', () => {
            const response = `{"tool_calls": [{"name": "filesystem__read_file", "arguments": {"path": "/test"}}]}`;

            const result = handler.parseToolCallsFromResponse(response);
            expect(result.length).toBe(1);
            expect(result[0].serverName).toBe('filesystem');
        });

        it('should use default server name when no double underscore', () => {
            const response = `{"tool_calls": [{"name": "read_file", "arguments": {"path": "/test"}}]}`;

            const result = handler.parseToolCallsFromResponse(response);
            expect(result.length).toBe(1);
            expect(result[0].serverName).toBe('default');
        });
    });

    describe('formatResultsPrompt', () => {
        it('should return empty string for empty results', () => {
            const result = handler.formatResultsPrompt([]);
            expect(result).toBe('');
        });

        it('should format successful results', () => {
            const results = [{
                toolName: 'test_tool',
                serverName: 'default',
                success: true,
                output: 'Tool output content',
                executionTime: 100
            }];

            const formatted = handler.formatResultsPrompt(results);
            expect(formatted).toContain('test_tool');
        });

        it('should format error results', () => {
            const results = [{
                toolName: 'failed_tool',
                serverName: 'default',
                success: false,
                error: 'Tool execution failed',
                executionTime: 50
            }];

            const formatted = handler.formatResultsPrompt(results);
            expect(formatted).toContain('failed_tool');
        });
    });

    describe('setMaxIterations', () => {
        it('should update max iterations', () => {
            handler.setMaxIterations(5);
            expect(handler.getMaxIterations()).toBe(5);
        });
    });

    describe('handleResponse without tool calls', () => {
        it('should return original response when no tool calls', async () => {
            const response = 'This is a simple response.';
            const result = await handler.handleResponse(response);

            expect(result.finalResponse).toBe(response);
            expect(result.toolCallsDetected).toBe(false);
            expect(result.toolResults).toEqual([]);
            expect(result.iterations).toBe(0);
        });
    });
});

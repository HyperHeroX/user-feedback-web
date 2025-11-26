/**
 * user-feedback MCP Tools - 類型定義
 */
// 錯誤類型
export class MCPError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'MCPError';
    }
}
//# sourceMappingURL=index.js.map
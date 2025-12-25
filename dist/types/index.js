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
// CLI 錯誤碼
export var CLIErrorCode;
(function (CLIErrorCode) {
    CLIErrorCode["NOT_INSTALLED"] = "CLI_NOT_INSTALLED";
    CLIErrorCode["TIMEOUT"] = "CLI_TIMEOUT";
    CLIErrorCode["EXECUTION_FAILED"] = "CLI_EXECUTION_FAILED";
    CLIErrorCode["PARSE_ERROR"] = "CLI_PARSE_ERROR";
    CLIErrorCode["PERMISSION_DENIED"] = "CLI_PERMISSION_DENIED";
})(CLIErrorCode || (CLIErrorCode = {}));
//# sourceMappingURL=index.js.map
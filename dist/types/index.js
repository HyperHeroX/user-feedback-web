/**
 * user-feedback MCP Tools - 类型定义
 */
// 会话状态枚举
export var SessionStatus;
(function (SessionStatus) {
    SessionStatus["CREATED"] = "created";
    SessionStatus["ACTIVE"] = "active";
    SessionStatus["AWAITING_CONTINUATION"] = "awaiting_continuation";
    SessionStatus["COMPLETED"] = "completed";
    SessionStatus["EXPIRED"] = "expired";
})(SessionStatus || (SessionStatus = {}));
// 错误类型
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
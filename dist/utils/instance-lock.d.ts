/**
 * user-feedback MCP Tools - 實例鎖定管理工具
 * 確保系統中只有一個 User Feedback 實例運行
 */
export interface LockFileData {
    pid: number;
    port: number;
    startTime: string;
    version: string;
}
export interface InstanceCheckResult {
    running: boolean;
    port?: number;
    pid?: number;
    lockData?: LockFileData;
}
export declare class InstanceLock {
    private static lockFilePath;
    static getLockFilePath(): string;
    static setLockFilePath(filePath: string): void;
    static check(healthCheckTimeout?: number): Promise<InstanceCheckResult>;
    static acquire(port: number): Promise<boolean>;
    static release(): Promise<void>;
    static verifyInstance(port: number, timeout?: number): Promise<boolean>;
    private static isProcessRunning;
    private static cleanupStaleLock;
    static forceCleanup(): Promise<void>;
}
//# sourceMappingURL=instance-lock.d.ts.map
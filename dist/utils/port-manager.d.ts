/**
 * user-feedback MCP Tools - 連接埠管理工具
 */
import { PortInfo } from '../types/index.js';
/**
 * 連接埠管理器
 */
export declare class PortManager {
    private readonly PORT_RANGE_START;
    private readonly PORT_RANGE_END;
    private readonly MAX_RETRIES;
    /**
     * 檢查連接埠是否可用（增強版本）
     */
    isPortAvailable(port: number): Promise<boolean>;
    /**
     * 深度檢查連接埠是否真正可用（包括處理程序偵測）
     */
    isPortTrulyAvailable(port: number): Promise<boolean>;
    /**
     * 智慧連接埠衝突解決
     */
    resolvePortConflict(port: number): Promise<number>;
    /**
     * 尋找替代連接埠
     */
    findAlternativePort(preferredPort: number): Promise<number>;
    /**
     * 查找可用連接埠（傳統方法）
     */
    findAvailablePort(preferredPort?: number): Promise<number>;
    /**
     * 取得連接埠資訊
     */
    getPortInfo(port: number): Promise<PortInfo>;
    /**
     * 取得連接埠範圍內的所有連接埠狀態
     */
    getPortRangeStatus(): Promise<PortInfo[]>;
    /**
     * 清理僵屍處理程序（跨平台實作）
     */
    cleanupZombieProcesses(): Promise<void>;
    /**
     * 強制使用指定連接埠
     */
    forcePort(port: number, killProcess?: boolean): Promise<number>;
    /**
     * 等待連接埠釋放（增強版本）
     */
    waitForPortRelease(port: number, timeoutMs?: number): Promise<void>;
    /**
     * 清理指定連接埠（強制釋放並等待）
     */
    cleanupPort(port: number): Promise<void>;
    /**
     * 強制釋放連接埠（終止佔用處理程序）
     */
    forceReleasePort(port: number): Promise<void>;
}
//# sourceMappingURL=port-manager.d.ts.map
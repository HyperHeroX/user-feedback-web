/**
 * API Key 加密/解密工具
 * 使用 AES-256-GCM 進行加密
 */
/**
 * 加密文字
 * @param text 要加密的文字
 * @returns 加密後的文字（格式：iv:authTag:encrypted）
 */
export declare function encrypt(text: string): string;
/**
 * 解密文字
 * @param encryptedText 加密的文字（格式：iv:authTag:encrypted）
 * @returns 解密後的文字
 */
export declare function decrypt(encryptedText: string): string;
/**
 * 遮罩 API Key（顯示前綴和最後4位）
 * @param apiKey 完整的 API Key
 * @returns 遮罩後的 API Key
 */
export declare function maskApiKey(apiKey: string): string;
/**
 * 驗證加密金鑰是否已設定
 * @returns 如果使用預設金鑰則返回 false
 */
export declare function isEncryptionKeyConfigured(): boolean;
/**
 * 生成隨機 API Key（用於測試）
 * @param length 金鑰長度
 * @returns 隨機生成的 API Key
 */
export declare function generateRandomKey(length?: number): string;
//# sourceMappingURL=crypto-helper.d.ts.map
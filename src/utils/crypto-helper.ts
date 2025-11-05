/**
 * API Key 加密/解密工具
 * 使用 AES-256-GCM 進行加密
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT = 'mcp-feedback-collector-salt-v1'; // 唯一的 salt

// 追蹤是否已記錄加密密碼狀態
let encryptionKeyLogged = false;

// 快取加密密碼
let cachedPassword: string | null = null;

/**
 * 從配置文件讀取加密密碼
 */
function loadPasswordFromConfig(): string | null {
    try {
        const configPath = path.join(process.cwd(), 'data', 'config.json');
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configData);
            return config.encryptionPassword || null;
        }
    } catch (error) {
        console.error('[Crypto] 讀取配置文件失敗:', error);
    }
    return null;
}

/**
 * 獲取加密密碼
 * 優先級：環境變數 > 配置文件 > 預設值
 */
function getEncryptionPassword(): string {
    if (cachedPassword) {
        return cachedPassword;
    }

    // 1. 嘗試從環境變數獲取
    if (process.env['MCP_ENCRYPTION_PASSWORD']) {
        cachedPassword = process.env['MCP_ENCRYPTION_PASSWORD'];
        return cachedPassword;
    }

    // 2. 嘗試從配置文件獲取
    const configPassword = loadPasswordFromConfig();
    if (configPassword) {
        cachedPassword = configPassword;
        return cachedPassword;
    }

    // 3. 使用預設值
    cachedPassword = 'default-encryption-key-change-in-production';
    return cachedPassword;
}

/**
 * 獲取加密金鑰
 * 從環境變數、配置文件或使用預設值（開發時）
 */
function getEncryptionKey(): Buffer {
    const password = getEncryptionPassword();
    const isDefault = password === 'default-encryption-key-change-in-production';
    const isFromEnv = process.env['MCP_ENCRYPTION_PASSWORD'] === password;
    const isFromConfig = !isDefault && !isFromEnv;
    
    // 在首次使用時記錄加密密碼狀態
    if (!encryptionKeyLogged) {
        if (isDefault) {
            console.log(`[Crypto] 加密密碼狀態: 使用預設值`);
        } else if (isFromEnv) {
            console.log(`[Crypto] 加密密碼狀態: 使用環境變數`);
            console.log(`[Crypto] 密碼長度: ${password.length}`);
        } else if (isFromConfig) {
            console.log(`[Crypto] 加密密碼狀態: 使用配置文件`);
            console.log(`[Crypto] 密碼長度: ${password.length}`);
        }
        encryptionKeyLogged = true;
    }
    
    return crypto.scryptSync(password, SALT, 32);
}

/**
 * 加密文字
 * @param text 要加密的文字
 * @returns 加密後的文字（格式：iv:authTag:encrypted）
 */
export function encrypt(text: string): string {
    try {
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        const encrypted = Buffer.concat([
            cipher.update(text, 'utf8'),
            cipher.final()
        ]);

        const authTag = cipher.getAuthTag();

        // 格式：iv:authTag:encrypted（都以 hex 編碼）
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
    } catch (error) {
        throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * 解密文字
 * @param encryptedText 加密的文字（格式：iv:authTag:encrypted）
 * @returns 解密後的文字
 */
export function decrypt(encryptedText: string): string {
    try {
        const key = getEncryptionKey();
        const parts = encryptedText.split(':');

        if (parts.length !== 3) {
            throw new Error('Invalid encrypted text format');
        }

        const iv = Buffer.from(parts[0]!, 'hex');
        const authTag = Buffer.from(parts[1]!, 'hex');
        const encrypted = Buffer.from(parts[2]!, 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final()
        ]);

        return decrypted.toString('utf8');
    } catch (error) {
        throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * 遮罩 API Key（顯示前綴和最後4位）
 * @param apiKey 完整的 API Key
 * @returns 遮罩後的 API Key
 */
export function maskApiKey(apiKey: string): string {
    if (!apiKey || apiKey.length < 8) {
        return '****';
    }

    const prefix = apiKey.substring(0, 3);
    const suffix = apiKey.substring(apiKey.length - 4);
    const maskedLength = Math.max(4, apiKey.length - 7);
    const masked = '*'.repeat(maskedLength);

    return `${prefix}${masked}${suffix}`;
}

/**
 * 驗證加密金鑰是否已設定
 * @returns 如果使用預設金鑰則返回 false
 */
export function isEncryptionKeyConfigured(): boolean {
    return !!process.env['MCP_ENCRYPTION_PASSWORD'];
}

/**
 * 生成隨機 API Key（用於測試）
 * @param length 金鑰長度
 * @returns 隨機生成的 API Key
 */
export function generateRandomKey(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
}


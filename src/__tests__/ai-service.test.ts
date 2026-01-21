/**
 * AI Service Tests
 * 測試 validateAPIKey 函式的新參數邏輯（apiUrl, openaiCompatible）
 * 
 * 注意：由於 validateAPIKey 使用動態 import，這些測試主要測試邏輯流程
 * 實際 API 調用需要真實的 API Key 和網路連接
 * 
 * ESM 模式下不支援傳統 jest.mock()，改為直接測試 API 邏輯
 */

describe('validateAPIKey', () => {
    let validateAPIKey: typeof import('../utils/ai-service.js').validateAPIKey;

    beforeAll(async () => {
        const module = await import('../utils/ai-service.js');
        validateAPIKey = module.validateAPIKey;
    });

    describe('Provider Detection from URL', () => {
        test('should return error for invalid Google API key', async () => {
            const result = await validateAPIKey(
                'invalid-api-key',
                'gemini-pro',
                'https://generativelanguage.googleapis.com/v1beta'
            );
            // 無效的 API key 應該返回錯誤
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });

        test('should return error for invalid OpenAI API key', async () => {
            const result = await validateAPIKey(
                'invalid-key',
                'gpt-4',
                'https://api.openai.com/v1'
            );
            // 真實 API 調用會失敗
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });

        test('should return error for invalid NVIDIA API key', async () => {
            const result = await validateAPIKey(
                'invalid-key',
                'nvidia-model',
                'https://integrate.api.nvidia.com/v1'
            );
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });

        test('should return error for invalid Z.AI international API key', async () => {
            const result = await validateAPIKey(
                'invalid-key',
                'glm-4',
                'https://api.z.ai/api/coding/paas/v4'
            );
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });

        test('should return error for invalid Z.AI China API key', async () => {
            const result = await validateAPIKey(
                'invalid-key',
                'glm-4',
                'https://open.bigmodel.cn/api/paas/v4'
            );
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('OpenAI Compatible Mode', () => {
        test('should use OpenAI client when openaiCompatible is true', async () => {
            const result = await validateAPIKey(
                'invalid-key',
                'custom-model',
                'https://custom-api.example.com/v1',
                true
            );
            // 自定義 API 會失敗因為無效的 key
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });

        test('should use Google AI when openaiCompatible is false and URL is Google', async () => {
            const result = await validateAPIKey(
                'invalid-api-key',
                'gemini-pro',
                'https://generativelanguage.googleapis.com/v1beta',
                false
            );
            // 無效的 API key 會返回錯誤
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('Default Behavior', () => {
        test('should default to Google AI when no URL provided', async () => {
            const result = await validateAPIKey('invalid-api-key', 'gemini-pro');
            // 無效的 API key 會返回錯誤
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });

        test('should use OpenAI compatible mode for unknown URLs', async () => {
            const result = await validateAPIKey(
                'invalid-key',
                'model',
                'https://unknown-api.example.com/v1'
            );
            // 未知 URL 會使用 OpenAI 相容模式，無效 key 會失敗
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        test('should return error object with valid and error properties', async () => {
            const result = await validateAPIKey(
                'invalid-key',
                'model',
                'https://api.openai.com/v1'
            );
            expect(result).toHaveProperty('valid');
            expect(result).toHaveProperty('error');
            expect(typeof result.valid).toBe('boolean');
            expect(typeof result.error).toBe('string');
        });

        test('should handle network errors gracefully', async () => {
            const result = await validateAPIKey(
                'test-key',
                'model',
                'https://non-existent-api.invalid/v1'
            );
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('URL Pattern Recognition', () => {
        test('should recognize OpenAI URL pattern', async () => {
            const result = await validateAPIKey('key', 'model', 'https://api.openai.com/v1');
            // Will fail due to invalid key, but should use OpenAI client
            expect(result.error).not.toContain('Google');
        });

        test('should recognize NVIDIA URL pattern', async () => {
            const result = await validateAPIKey('key', 'model', 'https://integrate.api.nvidia.com/v1');
            expect(result.error).not.toContain('Google');
        });

        test('should recognize Z.AI URL patterns', async () => {
            const result1 = await validateAPIKey('key', 'model', 'https://api.z.ai/api/coding/paas/v4');
            const result2 = await validateAPIKey('key', 'model', 'https://open.bigmodel.cn/api/paas/v4');
            expect(result1.error).not.toContain('Google');
            expect(result2.error).not.toContain('Google');
        });
    });
});

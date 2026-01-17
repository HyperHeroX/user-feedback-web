/**
 * AI Service Tests
 * 測試 validateAPIKey 函式的新參數邏輯（apiUrl, openaiCompatible）
 * 
 * 注意：由於 validateAPIKey 使用動態 import，這些測試主要測試邏輯流程
 * 實際 API 調用需要真實的 API Key 和網路連接
 */

// Mock @google/generative-ai
jest.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue({
            generateContent: jest.fn().mockResolvedValue({
                response: {
                    text: () => 'test response'
                }
            })
        })
    }))
}));

describe('validateAPIKey', () => {
    let validateAPIKey: typeof import('../utils/ai-service.js').validateAPIKey;

    beforeAll(async () => {
        const module = await import('../utils/ai-service.js');
        validateAPIKey = module.validateAPIKey;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Provider Detection from URL', () => {
        test('should use Google AI for google API URL', async () => {
            const result = await validateAPIKey(
                'test-api-key',
                'gemini-pro',
                'https://generativelanguage.googleapis.com/v1beta'
            );
            // Google mock 會返回成功
            expect(result.valid).toBe(true);
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
                'test-api-key',
                'gemini-pro',
                'https://generativelanguage.googleapis.com/v1beta',
                false
            );
            // Google mock 會返回成功
            expect(result.valid).toBe(true);
        });
    });

    describe('Default Behavior', () => {
        test('should default to Google AI when no URL provided', async () => {
            const result = await validateAPIKey('test-api-key', 'gemini-pro');
            // 沒有 URL 時預設使用 Google，mock 會成功
            expect(result.valid).toBe(true);
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

/**
 * 圖片轉文字服務
 */
import { logger } from './logger.js';
function getRuntimeFetch() {
    if (typeof fetch === 'function') {
        return fetch.bind(globalThis);
    }
    throw new Error('Fetch API is not available in this environment');
}
export class ImageToTextService {
    config;
    constructor(config) {
        this.config = config;
    }
    /**
     * 將圖片轉換為文字描述
     */
    async convertImageToText(imageData, mimeType) {
        if (!this.config.enableImageToText) {
            throw new Error('圖片轉文字功能未啟用');
        }
        if (!this.config.apiKey) {
            throw new Error('API金鑰未設定');
        }
        try {
            logger.debug('開始轉換圖片為文字', { mimeType });
            // 清理base64資料，移除data URL前綴
            const cleanBase64 = imageData.replace(/^data:image\/[^;]+;base64,/, '');
            const runtimeFetch = getRuntimeFetch();
            const response = await runtimeFetch(`${this.config.apiBaseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.config.defaultModel,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: this.config.imageToTextPrompt || '請詳細描述這張圖片的內容，包括主要元素、顏色、佈局、文字等資訊。'
                                },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: `data:${mimeType};base64,${cleanBase64}`
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens: 500,
                    temperature: 0.7
                })
            });
            if (!response.ok) {
                const errorText = await response.text();
                logger.error('API呼叫失敗', { status: response.status, error: errorText });
                throw new Error(`API呼叫失敗: ${response.status} ${errorText}`);
            }
            const result = await response.json();
            if (!result.choices || !result.choices[0] || !result.choices[0].message) {
                logger.error('API回應格式錯誤', { result });
                throw new Error('API回應格式錯誤');
            }
            const description = result.choices[0].message.content;
            if (!description || typeof description !== 'string') {
                throw new Error('未能取得有效的圖片描述');
            }
            logger.debug('圖片轉文字成功', { descriptionLength: description.length });
            return description.trim();
        }
        catch (error) {
            logger.error('圖片轉文字失敗:', error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('圖片轉文字處理失敗');
        }
    }
    /**
     * 批量轉換圖片為文字
     */
    async convertMultipleImages(images) {
        const descriptions = [];
        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            if (!image) {
                descriptions.push('轉換失敗: 圖片資料無效');
                continue;
            }
            try {
                logger.info(`正在轉換第 ${i + 1}/${images.length} 張圖片: ${image.name}`);
                const description = await this.convertImageToText(image.data, image.type);
                descriptions.push(description);
            }
            catch (error) {
                logger.error(`轉換圖片 ${image.name} 失敗:`, error);
                descriptions.push(`轉換失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
            }
        }
        return descriptions;
    }
    /**
     * 檢查是否支援圖片轉文字功能
     */
    isEnabled() {
        return Boolean(this.config.enableImageToText && this.config.apiKey);
    }
    /**
     * 取得設定資訊
     */
    getConfig() {
        return {
            enabled: this.isEnabled(),
            model: this.config.defaultModel,
            prompt: this.config.imageToTextPrompt || '請詳細描述這張圖片的內容，包括主要元素、顏色、佈局、文字等資訊。'
        };
    }
}
//# sourceMappingURL=image-to-text-service.js.map
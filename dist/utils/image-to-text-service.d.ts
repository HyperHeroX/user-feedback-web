/**
 * 圖片轉文字服務
 */
import { Config } from '../types/index.js';
export declare class ImageToTextService {
    private config;
    constructor(config: Config);
    /**
     * 將圖片轉換為文字描述
     */
    convertImageToText(imageData: string, mimeType: string): Promise<string>;
    /**
     * 批量轉換圖片為文字
     */
    convertMultipleImages(images: Array<{
        name: string;
        type: string;
        data: string;
    }>): Promise<string[]>;
    /**
     * 檢查是否支援圖片轉文字功能
     */
    isEnabled(): boolean;
    /**
     * 取得設定資訊
     */
    getConfig(): {
        enabled: boolean;
        model: string;
        prompt: string;
    };
}
//# sourceMappingURL=image-to-text-service.d.ts.map
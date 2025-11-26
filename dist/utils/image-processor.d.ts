/**
 * user-feedback MCP Tools - 圖片處理工具
 * 使用 Jimp 庫進行圖片處理和最佳化
 */
import { ImageData } from '../types/index.js';
/**
 * 圖片處理器類別
 */
export declare class ImageProcessor {
    private maxFileSize;
    private maxWidth;
    private maxHeight;
    constructor(options?: {
        maxFileSize?: number;
        maxWidth?: number;
        maxHeight?: number;
    });
    /**
     * 驗證圖片格式
     */
    validateImageFormat(filename: string, mimeType: string): boolean;
    /**
     * 驗證圖片大小
     */
    validateImageSize(size: number): boolean;
    /**
     * 從Base64資料中擷取圖片資訊
     */
    getImageInfoFromBase64(base64Data: string): Promise<{
        format: string;
        width: number;
        height: number;
        size: number;
        hasAlpha: boolean;
    }>;
    /**
     * 壓縮圖片
     */
    compressImage(base64Data: string, options?: {
        maxWidth?: number;
        maxHeight?: number;
        quality?: number;
        format?: 'jpeg' | 'png' | 'webp';
    }): Promise<string>;
    /**
     * 驗證和處理圖片資料
     */
    validateAndProcessImage(imageData: ImageData): Promise<ImageData>;
    /**
     * 批量處理圖片
     */
    processImages(images: ImageData[]): Promise<ImageData[]>;
    /**
     * 產生圖片縮圖
     */
    generateThumbnail(base64Data: string, size?: number): Promise<string>;
    /**
     * 取得圖片統計資訊
     */
    getImageStats(images: ImageData[]): {
        totalCount: number;
        totalSize: number;
        averageSize: number;
        formats: Record<string, number>;
    };
}
//# sourceMappingURL=image-processor.d.ts.map
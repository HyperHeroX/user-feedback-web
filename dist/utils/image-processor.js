/**
 * user-feedback MCP Tools - 圖片處理工具
 * 使用 Jimp 庫進行圖片處理和最佳化
 */
import Jimp from 'jimp';
import { MCPError } from '../types/index.js';
import { logger } from './logger.js';
/**
 * 支援的圖片格式
 */
const SUPPORTED_FORMATS = ['jpeg', 'jpg', 'png', 'gif', 'webp', 'bmp', 'tiff'];
/**
 * 圖片處理器類別
 */
export class ImageProcessor {
    maxFileSize;
    maxWidth;
    maxHeight;
    constructor(options = {}) {
        this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
        this.maxWidth = options.maxWidth || 2048;
        this.maxHeight = options.maxHeight || 2048;
    }
    /**
     * 驗證圖片格式
     */
    validateImageFormat(filename, mimeType) {
        // 檢查檔案副檔名
        const ext = filename.toLowerCase().split('.').pop();
        if (!ext || !SUPPORTED_FORMATS.includes(ext)) {
            return false;
        }
        // 檢查MIME類型
        const validMimeTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/bmp',
            'image/tiff'
        ];
        return validMimeTypes.includes(mimeType.toLowerCase());
    }
    /**
     * 驗證圖片大小
     */
    validateImageSize(size) {
        return size > 0 && size <= this.maxFileSize;
    }
    /**
     * 從Base64資料中擷取圖片資訊
     */
    async getImageInfoFromBase64(base64Data) {
        try {
            // 移除Base64前綴
            const base64Content = base64Data.replace(/^data:image\/[^;]+;base64,/, '');
            const buffer = Buffer.from(base64Content, 'base64');
            // 使用 Jimp 讀取圖片資訊
            const image = await Jimp.read(buffer);
            // 從 MIME 類型推斷格式
            const mimeType = image.getMIME();
            const format = mimeType.split('/')[1] || 'unknown';
            return {
                format: format,
                width: image.getWidth(),
                height: image.getHeight(),
                size: buffer.length,
                hasAlpha: image.hasAlpha()
            };
        }
        catch (error) {
            logger.error('取得圖片資訊失敗:', error);
            throw new MCPError('Failed to get image information', 'IMAGE_INFO_ERROR', error);
        }
    }
    /**
     * 壓縮圖片
     */
    async compressImage(base64Data, options = {}) {
        try {
            const base64Content = base64Data.replace(/^data:image\/[^;]+;base64,/, '');
            const buffer = Buffer.from(base64Content, 'base64');
            const { maxWidth = this.maxWidth, maxHeight = this.maxHeight, quality = 85, format = 'jpeg' } = options;
            // 使用 Jimp 读取图片
            let image = await Jimp.read(buffer);
            // 調整尺寸
            const originalWidth = image.getWidth();
            const originalHeight = image.getHeight();
            if (originalWidth > maxWidth || originalHeight > maxHeight) {
                // 計算縮放比例，保持寬高比
                const widthRatio = maxWidth / originalWidth;
                const heightRatio = maxHeight / originalHeight;
                const ratio = Math.min(widthRatio, heightRatio);
                const newWidth = Math.floor(originalWidth * ratio);
                const newHeight = Math.floor(originalHeight * ratio);
                image = image.resize(newWidth, newHeight);
            }
            // 設定品質
            image = image.quality(quality);
            // 轉換格式和取得buffer
            let outputBuffer;
            let mimeType;
            switch (format) {
                case 'jpeg':
                    outputBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);
                    mimeType = Jimp.MIME_JPEG;
                    break;
                case 'png':
                    outputBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
                    mimeType = Jimp.MIME_PNG;
                    break;
                case 'webp':
                    // Jimp 可能不支援 WebP，降級到 JPEG
                    outputBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);
                    mimeType = Jimp.MIME_JPEG;
                    break;
                default:
                    outputBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);
                    mimeType = Jimp.MIME_JPEG;
            }
            // 轉換回Base64
            const compressedBase64 = `data:${mimeType};base64,${outputBuffer.toString('base64')}`;
            logger.debug(`圖片壓縮完成: ${buffer.length} -> ${outputBuffer.length} bytes`);
            return compressedBase64;
        }
        catch (error) {
            logger.error('圖片壓縮失敗:', error);
            throw new MCPError('Failed to compress image', 'IMAGE_COMPRESSION_ERROR', error);
        }
    }
    /**
     * 驗證和處理圖片資料
     */
    async validateAndProcessImage(imageData) {
        try {
            // 驗證基本資訊
            if (!imageData.name || !imageData.data || !imageData.type) {
                throw new MCPError('Invalid image data: missing required fields', 'INVALID_IMAGE_DATA');
            }
            // 驗證格式
            if (!this.validateImageFormat(imageData.name, imageData.type)) {
                throw new MCPError(`Unsupported image format: ${imageData.type}`, 'UNSUPPORTED_FORMAT');
            }
            // 驗證大小
            if (!this.validateImageSize(imageData.size)) {
                throw new MCPError(`Image size ${imageData.size} exceeds limit ${this.maxFileSize}`, 'IMAGE_TOO_LARGE');
            }
            // 取得圖片詳細資訊
            const info = await this.getImageInfoFromBase64(imageData.data);
            // 檢查圖片尺寸
            if (info.width > this.maxWidth || info.height > this.maxHeight) {
                logger.info(`圖片尺寸過大 (${info.width}x${info.height})，正在壓縮...`);
                const compressedData = await this.compressImage(imageData.data, {
                    maxWidth: this.maxWidth,
                    maxHeight: this.maxHeight,
                    quality: 85
                });
                const compressedInfo = await this.getImageInfoFromBase64(compressedData);
                return {
                    ...imageData,
                    data: compressedData,
                    size: compressedInfo.size,
                    type: `image/${compressedInfo.format}`
                };
            }
            return imageData;
        }
        catch (error) {
            if (error instanceof MCPError) {
                throw error;
            }
            logger.error('圖片驗證和處理失敗:', error);
            throw new MCPError('Failed to validate and process image', 'IMAGE_PROCESSING_ERROR', error);
        }
    }
    /**
     * 批量處理圖片
     */
    async processImages(images) {
        const results = [];
        for (let i = 0; i < images.length; i++) {
            try {
                logger.debug(`處理圖片 ${i + 1}/${images.length}: ${images[i]?.name}`);
                const processedImage = await this.validateAndProcessImage(images[i]);
                results.push(processedImage);
            }
            catch (error) {
                logger.error(`處理圖片 ${images[i]?.name} 失敗:`, error);
                // 繼續處理其他圖片，但記錄錯誤
                throw error;
            }
        }
        logger.info(`成功處理 ${results.length}/${images.length} 張圖片`);
        return results;
    }
    /**
     * 產生圖片縮圖
     */
    async generateThumbnail(base64Data, size = 150) {
        try {
            const base64Content = base64Data.replace(/^data:image\/[^;]+;base64,/, '');
            const buffer = Buffer.from(base64Content, 'base64');
            // 使用 Jimp 產生縮圖
            const image = await Jimp.read(buffer);
            // 裁剪為正方形並調整大小
            const thumbnail = image
                .cover(size, size) // 類似 Sharp 的 fit: 'cover'
                .quality(80);
            const thumbnailBuffer = await thumbnail.getBufferAsync(Jimp.MIME_JPEG);
            return `data:image/jpeg;base64,${thumbnailBuffer.toString('base64')}`;
        }
        catch (error) {
            logger.error('產生縮圖失敗:', error);
            throw new MCPError('Failed to generate thumbnail', 'THUMBNAIL_ERROR', error);
        }
    }
    /**
     * 取得圖片統計資訊
     */
    getImageStats(images) {
        const stats = {
            totalCount: images.length,
            totalSize: 0,
            averageSize: 0,
            formats: {}
        };
        for (const image of images) {
            stats.totalSize += image.size;
            const format = image.type.split('/')[1] || 'unknown';
            stats.formats[format] = (stats.formats[format] || 0) + 1;
        }
        stats.averageSize = stats.totalCount > 0 ? stats.totalSize / stats.totalCount : 0;
        return stats;
    }
}
//# sourceMappingURL=image-processor.js.map
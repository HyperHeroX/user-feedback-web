/**
 * user-feedback MCP Tools - 圖片處理工具
 * 使用 Jimp 庫進行圖片處理和最佳化
 * 採用延遲載入模式以減少啟動時間
 */

import { MCPError, ImageData } from '../types/index.js';
import { logger } from './logger.js';

/**
 * 支援的圖片格式
 */
const SUPPORTED_FORMATS = ['jpeg', 'jpg', 'png', 'gif', 'webp', 'bmp', 'tiff'];

// Jimp 模組延遲載入
let JimpModule: typeof import('jimp') | null = null;
let jimpLoadPromise: Promise<typeof import('jimp')> | null = null;

async function getJimp(): Promise<typeof import('jimp')> {
  if (JimpModule) {
    return JimpModule;
  }

  if (jimpLoadPromise) {
    return jimpLoadPromise;
  }

  jimpLoadPromise = (async () => {
    try {
      logger.debug('延遲載入 Jimp 模組...');
      const module = await import('jimp');
      JimpModule = module;
      logger.debug('Jimp 模組載入完成');
      return module;
    } catch (error) {
      jimpLoadPromise = null;
      logger.warn('Jimp 模組載入失敗，圖片處理功能將不可用:', error);
      throw new MCPError(
        'Jimp module not available. Image processing is disabled.',
        'JIMP_NOT_AVAILABLE',
        error
      );
    }
  })();

  return jimpLoadPromise;
}

/**
 * 檢查 Jimp 是否可用（不會觸發載入）
 */
export function isJimpAvailable(): boolean {
  return JimpModule !== null;
}

/**
 * 圖片處理器類別
 */
export class ImageProcessor {
  private maxFileSize: number;
  private maxWidth: number;
  private maxHeight: number;

  constructor(options: {
    maxFileSize?: number;
    maxWidth?: number;
    maxHeight?: number;
  } = {}) {
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxWidth = options.maxWidth || 2048;
    this.maxHeight = options.maxHeight || 2048;
  }

  /**
   * 驗證圖片格式
   */
  validateImageFormat(filename: string, mimeType: string): boolean {
    const ext = filename.toLowerCase().split('.').pop();
    if (!ext || !SUPPORTED_FORMATS.includes(ext)) {
      return false;
    }

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
  validateImageSize(size: number): boolean {
    return size > 0 && size <= this.maxFileSize;
  }

  /**
   * 從Base64資料中擷取圖片資訊
   */
  async getImageInfoFromBase64(base64Data: string): Promise<{
    format: string;
    width: number;
    height: number;
    size: number;
    hasAlpha: boolean;
  }> {
    try {
      const Jimp = await getJimp();
      
      const base64Content = base64Data.replace(/^data:image\/[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Content, 'base64');

      const image = await Jimp.default.read(buffer);

      const mimeType = image.getMIME();
      const format = mimeType.split('/')[1] || 'unknown';

      return {
        format: format,
        width: image.getWidth(),
        height: image.getHeight(),
        size: buffer.length,
        hasAlpha: image.hasAlpha()
      };
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }
      logger.error('取得圖片資訊失敗:', error);
      throw new MCPError(
        'Failed to get image information',
        'IMAGE_INFO_ERROR',
        error
      );
    }
  }

  /**
   * 壓縮圖片
   */
  async compressImage(base64Data: string, options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
  } = {}): Promise<string> {
    try {
      const Jimp = await getJimp();
      
      const base64Content = base64Data.replace(/^data:image\/[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Content, 'base64');

      const {
        maxWidth = this.maxWidth,
        maxHeight = this.maxHeight,
        quality = 85,
        format = 'jpeg'
      } = options;

      let image = await Jimp.default.read(buffer);

      const originalWidth = image.getWidth();
      const originalHeight = image.getHeight();

      if (originalWidth > maxWidth || originalHeight > maxHeight) {
        const widthRatio = maxWidth / originalWidth;
        const heightRatio = maxHeight / originalHeight;
        const ratio = Math.min(widthRatio, heightRatio);

        const newWidth = Math.floor(originalWidth * ratio);
        const newHeight = Math.floor(originalHeight * ratio);

        image = image.resize(newWidth, newHeight);
      }

      image = image.quality(quality);

      let outputBuffer: Buffer;
      let mimeType: string;

      switch (format) {
        case 'jpeg':
          outputBuffer = await image.getBufferAsync(Jimp.default.MIME_JPEG);
          mimeType = Jimp.default.MIME_JPEG;
          break;
        case 'png':
          outputBuffer = await image.getBufferAsync(Jimp.default.MIME_PNG);
          mimeType = Jimp.default.MIME_PNG;
          break;
        case 'webp':
          outputBuffer = await image.getBufferAsync(Jimp.default.MIME_JPEG);
          mimeType = Jimp.default.MIME_JPEG;
          break;
        default:
          outputBuffer = await image.getBufferAsync(Jimp.default.MIME_JPEG);
          mimeType = Jimp.default.MIME_JPEG;
      }

      const compressedBase64 = `data:${mimeType};base64,${outputBuffer.toString('base64')}`;

      logger.debug(`圖片壓縮完成: ${buffer.length} -> ${outputBuffer.length} bytes`);

      return compressedBase64;
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }
      logger.error('圖片壓縮失敗:', error);
      throw new MCPError(
        'Failed to compress image',
        'IMAGE_COMPRESSION_ERROR',
        error
      );
    }
  }

  /**
   * 驗證和處理圖片資料
   */
  async validateAndProcessImage(imageData: ImageData): Promise<ImageData> {
    try {
      if (!imageData.name || !imageData.data || !imageData.type) {
        throw new MCPError(
          'Invalid image data: missing required fields',
          'INVALID_IMAGE_DATA'
        );
      }

      if (!this.validateImageFormat(imageData.name, imageData.type)) {
        throw new MCPError(
          `Unsupported image format: ${imageData.type}`,
          'UNSUPPORTED_FORMAT'
        );
      }

      if (!this.validateImageSize(imageData.size)) {
        throw new MCPError(
          `Image size ${imageData.size} exceeds limit ${this.maxFileSize}`,
          'IMAGE_TOO_LARGE'
        );
      }

      const info = await this.getImageInfoFromBase64(imageData.data);

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
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }

      logger.error('圖片驗證和處理失敗:', error);
      throw new MCPError(
        'Failed to validate and process image',
        'IMAGE_PROCESSING_ERROR',
        error
      );
    }
  }

  /**
   * 批量處理圖片
   */
  async processImages(images: ImageData[]): Promise<ImageData[]> {
    const results: ImageData[] = [];

    for (let i = 0; i < images.length; i++) {
      try {
        logger.debug(`處理圖片 ${i + 1}/${images.length}: ${images[i]?.name}`);
        const processedImage = await this.validateAndProcessImage(images[i]!);
        results.push(processedImage);
      } catch (error) {
        logger.error(`處理圖片 ${images[i]?.name} 失敗:`, error);
        throw error;
      }
    }

    logger.info(`成功處理 ${results.length}/${images.length} 張圖片`);
    return results;
  }

  /**
   * 產生圖片縮圖
   */
  async generateThumbnail(base64Data: string, size: number = 150): Promise<string> {
    try {
      const Jimp = await getJimp();
      
      const base64Content = base64Data.replace(/^data:image\/[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Content, 'base64');

      const image = await Jimp.default.read(buffer);

      const thumbnail = image
        .cover(size, size)
        .quality(80);

      const thumbnailBuffer = await thumbnail.getBufferAsync(Jimp.default.MIME_JPEG);

      return `data:image/jpeg;base64,${thumbnailBuffer.toString('base64')}`;
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }
      logger.error('產生縮圖失敗:', error);
      throw new MCPError(
        'Failed to generate thumbnail',
        'THUMBNAIL_ERROR',
        error
      );
    }
  }

  /**
   * 取得圖片統計資訊
   */
  getImageStats(images: ImageData[]): {
    totalCount: number;
    totalSize: number;
    averageSize: number;
    formats: Record<string, number>;
  } {
    const stats = {
      totalCount: images.length,
      totalSize: 0,
      averageSize: 0,
      formats: {} as Record<string, number>
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

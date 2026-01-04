/**
 * 日誌 API 測試
 */
import { queryLogs, insertLogs, deleteLogs, getLogSources } from '../utils/database.js';
import { logger } from '../utils/logger.js';

describe('日誌 API', () => {
  const testLogs = [
    { level: 'info' as const, message: 'Test log 1', source: 'test', createdAt: new Date().toISOString() },
    { level: 'warn' as const, message: 'Test log 2', source: 'test', createdAt: new Date().toISOString() },
    { level: 'error' as const, message: 'Test log 3', source: 'test', createdAt: new Date().toISOString() },
  ];

  beforeAll(() => {
    // 插入測試日誌
    insertLogs(testLogs);
  });

  afterAll(() => {
    // 清理測試日誌
    deleteLogs({ level: 'info' });
    deleteLogs({ level: 'warn' });
    deleteLogs({ level: 'error' });
    // 停止 Logger 的計時器以避免 Jest 警告
    logger.destroy();
  });

  describe('queryLogs', () => {
    it('應該使用 limit 參數限制返回結果數量', () => {
      const result = queryLogs({ limit: 2 });
      expect(result.logs.length).toBeLessThanOrEqual(2);
      expect(result.pagination.limit).toBe(2);
    });

    it('應該使用 page 參數進行分頁', () => {
      const page1 = queryLogs({ page: 1, limit: 1 });
      const page2 = queryLogs({ page: 2, limit: 1 });
      
      expect(page1.pagination.page).toBe(1);
      expect(page2.pagination.page).toBe(2);
      
      // 如果有足夠的日誌，頁面應該包含不同的日誌
      if (page1.logs.length > 0 && page2.logs.length > 0) {
        expect(page1.logs[0]?.id).not.toBe(page2.logs[0]?.id);
      }
    });

    it('應該正確計算總頁數', () => {
      const result = queryLogs({ limit: 10 });
      const expectedTotalPages = Math.ceil(result.pagination.total / 10);
      expect(result.pagination.totalPages).toBe(expectedTotalPages);
    });

    it('應該能按 level 篩選日誌', () => {
      const result = queryLogs({ level: 'error', limit: 100 });
      result.logs.forEach(log => {
        expect(log.level).toBe('error');
      });
    });

    it('應該能按 source 篩選日誌', () => {
      const result = queryLogs({ source: 'test', limit: 100 });
      result.logs.forEach(log => {
        expect(log.source).toBe('test');
      });
    });

    it('應該限制 limit 最大值為 200', () => {
      const result = queryLogs({ limit: 500 });
      expect(result.pagination.limit).toBeLessThanOrEqual(200);
    });
  });

  describe('getLogSources', () => {
    it('應該返回不重複的日誌來源列表', () => {
      const sources = getLogSources();
      expect(Array.isArray(sources)).toBe(true);
      // 檢查是否有重複
      const uniqueSources = [...new Set(sources)];
      expect(sources.length).toBe(uniqueSources.length);
    });
  });
});

/**
 * InstanceLock 模組單元測試
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import path from 'path';
import { InstanceLock, LockFileData } from '../utils/instance-lock.js';

const TEST_LOCK_DIR = path.resolve(process.cwd(), 'data', 'test-locks');
const TEST_LOCK_FILE = path.join(TEST_LOCK_DIR, '.test-instance.lock');

describe('InstanceLock', () => {
  beforeAll(() => {
    if (!existsSync(TEST_LOCK_DIR)) {
      mkdirSync(TEST_LOCK_DIR, { recursive: true });
    }
  });

  beforeEach(() => {
    InstanceLock.setLockFilePath(TEST_LOCK_FILE);
    if (existsSync(TEST_LOCK_FILE)) {
      unlinkSync(TEST_LOCK_FILE);
    }
  });

  afterEach(async () => {
    if (existsSync(TEST_LOCK_FILE)) {
      unlinkSync(TEST_LOCK_FILE);
    }
  });

  afterAll(() => {
    InstanceLock.setLockFilePath(path.join(process.cwd(), 'data', '.user-feedback.lock'));
  });

  describe('check()', () => {
    test('應該在沒有鎖定檔案時回傳 running: false', async () => {
      const result = await InstanceLock.check();
      expect(result.running).toBe(false);
      expect(result.port).toBeUndefined();
      expect(result.pid).toBeUndefined();
    });

    test('應該在鎖定檔案無效時清理並回傳 running: false', async () => {
      writeFileSync(TEST_LOCK_FILE, 'invalid json content');

      const result = await InstanceLock.check();
      expect(result.running).toBe(false);
      expect(existsSync(TEST_LOCK_FILE)).toBe(false);
    });

    test('應該在鎖定檔案缺少必要欄位時清理並回傳 running: false', async () => {
      writeFileSync(TEST_LOCK_FILE, JSON.stringify({ pid: 12345 }));

      const result = await InstanceLock.check();
      expect(result.running).toBe(false);
      expect(existsSync(TEST_LOCK_FILE)).toBe(false);
    });

    test('應該在進程不存在時清理陳舊鎖定', async () => {
      const staleLock: LockFileData = {
        pid: 999999999,
        port: 5050,
        startTime: new Date().toISOString(),
        version: '1.0.0'
      };
      writeFileSync(TEST_LOCK_FILE, JSON.stringify(staleLock));

      const result = await InstanceLock.check();
      expect(result.running).toBe(false);
      expect(existsSync(TEST_LOCK_FILE)).toBe(false);
    });
  });

  describe('acquire()', () => {
    test('應該成功獲取鎖定並寫入檔案', async () => {
      const port = 5050;
      const result = await InstanceLock.acquire(port);

      expect(result).toBe(true);
      expect(existsSync(TEST_LOCK_FILE)).toBe(true);

      const content = readFileSync(TEST_LOCK_FILE, 'utf-8');
      const lockData = JSON.parse(content) as LockFileData;

      expect(lockData.pid).toBe(process.pid);
      expect(lockData.port).toBe(port);
      expect(lockData.startTime).toBeDefined();
      expect(lockData.version).toBeDefined();
    });

    test('應該覆蓋現有的鎖定檔案', async () => {
      const oldLock: LockFileData = {
        pid: 12345,
        port: 3000,
        startTime: new Date().toISOString(),
        version: '0.9.0'
      };
      writeFileSync(TEST_LOCK_FILE, JSON.stringify(oldLock));

      const newPort = 5050;
      const result = await InstanceLock.acquire(newPort);

      expect(result).toBe(true);

      const content = readFileSync(TEST_LOCK_FILE, 'utf-8');
      const lockData = JSON.parse(content) as LockFileData;

      expect(lockData.pid).toBe(process.pid);
      expect(lockData.port).toBe(newPort);
    });
  });

  describe('release()', () => {
    test('應該成功釋放自己的鎖定', async () => {
      await InstanceLock.acquire(5050);
      expect(existsSync(TEST_LOCK_FILE)).toBe(true);

      await InstanceLock.release();
      expect(existsSync(TEST_LOCK_FILE)).toBe(false);
    });

    test('應該在沒有鎖定檔案時安全執行', async () => {
      await expect(InstanceLock.release()).resolves.not.toThrow();
    });

    test('不應該釋放其他進程的鎖定', async () => {
      const otherLock: LockFileData = {
        pid: 999999,
        port: 5050,
        startTime: new Date().toISOString(),
        version: '1.0.0'
      };
      writeFileSync(TEST_LOCK_FILE, JSON.stringify(otherLock));

      await InstanceLock.release();

      expect(existsSync(TEST_LOCK_FILE)).toBe(true);
      const content = readFileSync(TEST_LOCK_FILE, 'utf-8');
      const lockData = JSON.parse(content) as LockFileData;
      expect(lockData.pid).toBe(999999);
    });
  });

  describe('forceCleanup()', () => {
    test('應該強制刪除任何鎖定檔案', async () => {
      const anyLock: LockFileData = {
        pid: 999999,
        port: 5050,
        startTime: new Date().toISOString(),
        version: '1.0.0'
      };
      writeFileSync(TEST_LOCK_FILE, JSON.stringify(anyLock));

      await InstanceLock.forceCleanup();
      expect(existsSync(TEST_LOCK_FILE)).toBe(false);
    });
  });

  describe('verifyInstance()', () => {
    test('應該在無法連接時回傳 false', async () => {
      const result = await InstanceLock.verifyInstance(59999, 500);
      expect(result).toBe(false);
    }, 10000);
  });

  describe('getLockFilePath()', () => {
    test('應該回傳設定的路徑', () => {
      const lockPath = InstanceLock.getLockFilePath();
      expect(lockPath).toBe(TEST_LOCK_FILE);
    });
  });
});

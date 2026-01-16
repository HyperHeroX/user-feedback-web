/**
 * 版本工具函式
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// 在 ES 模組中獲取 __dirname 的等效值
function getDirname(): string {
  try {
    // 嘗試使用 import.meta.url（ES 模組）
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      return dirname(fileURLToPath(import.meta.url));
    }
  } catch {
    // 如果失敗，繼續嘗試其他方法
  }
  
  // 回退到 CommonJS 的 __dirname（如果可用）
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  
  // 最後回退到 process.cwd()
  return process.cwd();
}

/**
 * 向上查找 package.json
 */
function findPackageJson(startPath: string): string | null {
  let currentPath = startPath;
  const root = process.platform === 'win32' ? currentPath.split('\\')[0] + '\\' : '/';
  
  while (currentPath !== root) {
    const pkgPath = join(currentPath, 'package.json');
    if (existsSync(pkgPath)) {
      return pkgPath;
    }
    const parentPath = dirname(currentPath);
    if (parentPath === currentPath) {
      break;
    }
    currentPath = parentPath;
  }
  
  return null;
}

export function getPackageVersion(): string {
  try {
    // 策略 1: 從當前文件位置向上查找
    const currentDir = getDirname();
    const pkgPath1 = findPackageJson(currentDir);
    if (pkgPath1) {
      try {
        const pkgContent = readFileSync(pkgPath1, 'utf-8');
        const pkg = JSON.parse(pkgContent);
        if (pkg.version) {
          return pkg.version;
        }
      } catch {
        // 繼續嘗試其他方法
      }
    }
    
    // 策略 2: 從 process.cwd() 向上查找
    const cwd = process.cwd();
    if (cwd !== currentDir) {
      const pkgPath2 = findPackageJson(cwd);
      if (pkgPath2) {
        try {
          const pkgContent = readFileSync(pkgPath2, 'utf-8');
          const pkg = JSON.parse(pkgContent);
          if (pkg.version) {
            return pkg.version;
          }
        } catch {
          // 繼續嘗試其他方法
        }
      }
    }
    
    // 策略 3: 嘗試常見的路徑
    const possiblePaths = [
      join(currentDir, '..', '..', 'package.json'),
      join(currentDir, '..', 'package.json'),
      join(process.cwd(), 'package.json'),
    ];
    
    for (const pkgPath of possiblePaths) {
      if (existsSync(pkgPath)) {
        try {
          const pkgContent = readFileSync(pkgPath, 'utf-8');
          const pkg = JSON.parse(pkgContent);
          if (pkg.version) {
            return pkg.version;
          }
        } catch {
          continue;
        }
      }
    }
    
    return '0.0.0';
  } catch {
    return '0.0.0';
  }
}

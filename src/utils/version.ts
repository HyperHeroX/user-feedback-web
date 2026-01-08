/**
 * 版本工具函式
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';

export function getPackageVersion(): string {
  try {
    // Try multiple strategies to find package.json
    const possiblePaths = [
      join(__dirname, '..', '..', 'package.json'),
      join(process.cwd(), 'package.json'),
    ];
    
    for (const pkgPath of possiblePaths) {
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
    
    return '0.0.0';
  } catch {
    return '0.0.0';
  }
}

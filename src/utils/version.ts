/**
 * 版本工具函式
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function getPackageVersion(): string {
  try {
    // Try multiple strategies to find package.json
    const possiblePaths = [
      // ESM: __dirname = .../src/utils or .../dist/utils
      join(__dirname, '..', '..', 'package.json'),
      // tsup bundled: __dirname = .../dist
      join(__dirname, '..', 'package.json'),
      // Current working directory
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

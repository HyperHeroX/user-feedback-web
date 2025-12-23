/**
 * 版本工具函式
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
export function getPackageVersion() {
    try {
        const pkg = require(join(__dirname, '..', '..', 'package.json'));
        return pkg.version || '0.0.0';
    }
    catch {
        return '0.0.0';
    }
}
//# sourceMappingURL=version.js.map
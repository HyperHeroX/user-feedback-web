#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const distDir = path.join(process.cwd(), 'dist');

if (!fs.existsSync(distDir)) {
  console.log('dist directory does not exist, skipping source map removal');
  process.exit(0);
}

function removeSourceMaps(dir) {
  const files = fs.readdirSync(dir);
  let removedCount = 0;

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      removedCount += removeSourceMaps(filePath);
    } else if (file.endsWith('.map')) {
      fs.unlinkSync(filePath);
      removedCount++;
      console.log(`Removed: ${path.relative(process.cwd(), filePath)}`);
    }
  }

  return removedCount;
}

const count = removeSourceMaps(distDir);
console.log(`✅ Removed ${count} source map file(s)`);

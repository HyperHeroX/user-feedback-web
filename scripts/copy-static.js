const fs = require('fs');
const cp = require('child_process');
const path = require('path');

function runCmd(cmd) {
  try {
    cp.execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (e) {
    return false;
  }
}

try {
  const dest = path.resolve(__dirname, '..', 'dist', 'static');
  const src = path.resolve(__dirname, '..', 'src', 'static');

  if (fs.existsSync(dest)) {
    try {
      fs.rmSync(dest, { recursive: true, force: true });
    } catch (e) {
      // fallback to OS command
      if (process.platform === 'win32') {
        const cmd = `cmd /c rd /s /q "${dest}"`;
        if (!runCmd(cmd)) {
          console.error('Failed to remove dist/static via rd');
          process.exit(1);
        }
      } else {
        const cmd = `rm -rf "${dest}"`;
        if (!runCmd(cmd)) {
          console.error('Failed to remove dist/static via rm');
          process.exit(1);
        }
      }
    }
  }

  if (fs.existsSync(src)) {
    try {
      fs.cpSync(src, dest, { recursive: true });
    } catch (e) {
      // fallback to OS copy
      if (process.platform === 'win32') {
        // xcopy semantics: create dest, copy files
        const cmd = `cmd /c xcopy "${src}" "${dest}" /E /I /Y`;
        if (!runCmd(cmd)) {
          console.error('Failed to copy src/static via xcopy');
          process.exit(1);
        }
      } else {
        const cmd = `cp -a "${src}/." "${dest}/"`;
        if (!runCmd(cmd)) {
          console.error('Failed to copy src/static via cp');
          process.exit(1);
        }
      }
    }
  }
} catch (err) {
  console.error(err);
  process.exit(1);
}

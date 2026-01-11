import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  format: ['cjs'],
  target: 'node18',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  shims: true,
  external: [
    'better-sqlite3',
  ],
  noExternal: [
    '@modelcontextprotocol/sdk',
    'commander',
    'compression',
    'cors',
    'dotenv',
    'engine.io',
    'engine.io-parser',
    'express',
    'find-free-port',
    'helmet',
    'jimp',
    'marked',
    'open',
    'socket.io',
    'sql.js',
    'tslib',
    'zod',
  ],
  onSuccess: async () => {
    console.log('Copying static files...');
    const { cpSync, existsSync, copyFileSync } = await import('fs');
    const { join } = await import('path');

    const staticSrc = join(process.cwd(), 'src', 'static');
    const staticDest = join(process.cwd(), 'dist', 'static');

    if (existsSync(staticSrc)) {
      cpSync(staticSrc, staticDest, { recursive: true });
      console.log('✅ Static files copied');
    }

    // Copy Socket.IO client from node_modules to static folder
    const socketIOClientSrc = join(process.cwd(), 'node_modules', 'socket.io', 'client-dist', 'socket.io.min.js');
    const socketIOClientDest = join(staticDest, 'socket.io.min.js');
    if (existsSync(socketIOClientSrc)) {
      copyFileSync(socketIOClientSrc, socketIOClientDest);
      console.log('✅ Socket.IO client copied');
    }
  },
});

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export function patchViteDevClient() {
  const targets = [
    path.join(rootDir, 'node_modules/vite/dist/client/client.mjs'),
    path.join(rootDir, 'node_modules/vite/dist/client/bundledDevClient.mjs'),
    path.join(rootDir, 'node_modules/vite/dist/node/module-runner.js'),
  ];

  let patchedCount = 0;

  for (const file of targets) {
    if (!fs.existsSync(file)) continue;

    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    // 1. Replace WebSocket closed without opened reject with resolve()
    const errorPattern1 = 'reject(/* @__PURE__ */ new Error("WebSocket closed without opened."))';
    if (content.includes(errorPattern1)) {
      content = content.replaceAll(errorPattern1, 'resolve()');
      changed = true;
    }

    const errorPattern2 = 'reject(/* @__PURE__ */ Error("WebSocket closed without opened."))';
    if (content.includes(errorPattern2)) {
      content = content.replaceAll(errorPattern2, 'resolve()');
      changed = true;
    }

    // 2. Suppress failed to connect to websocket error throw
    const throwPattern1 = 'console.error(`[vite] failed to connect to websocket (${e}). `);';
    if (content.includes(throwPattern1)) {
      content = content.replaceAll(throwPattern1, '/* suppressed benign hmr disconnect */');
      changed = true;
    }

    const throwPattern2 = 'throw e;';
    if (content.includes(throwPattern2)) {
      // In connect() block: "throw e;" right after catch
      content = content.replaceAll('console.error(`[vite] failed to connect to websocket (${e}). `);\n\t\t\t\tthrow e;', '/* suppressed benign hmr error */');
      content = content.replaceAll('console.error(`[vite] failed to connect to websocket (${e}). `); throw e;', '/* suppressed benign hmr error */');
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(file, content, 'utf8');
      patchedCount++;
    }
  }

  console.log(`[HMR Patch] Verified and patched ${patchedCount} Vite client/module-runner files.`);
}

// Auto-run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  patchViteDevClient();
}

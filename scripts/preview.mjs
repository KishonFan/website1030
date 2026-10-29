import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
import { build } from './build.mjs';

const { handleCms } = createRequire(import.meta.url)('../lib/cms-auth.cjs');
const output = resolve('public');
await build();
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.pdf': 'application/pdf' };
http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname.startsWith('/api/cms/')) {
    try { await handleCms(request, response); } catch { response.statusCode = 500; response.end('CMS unavailable'); }
    return;
  }
  try {
    let path = resolve(output, '.' + decodeURIComponent(url.pathname));
    if (path !== output && !path.startsWith(output + sep)) throw new Error('Outside public directory');
    const info = await stat(path);
    if (info.isDirectory()) path = resolve(path, 'index.html');
    response.setHeader('Content-Type', types[extname(path).toLowerCase()] || 'application/octet-stream');
    response.setHeader('Cache-Control', 'no-store');
    const stream = createReadStream(path);
    stream.on('error', () => { response.statusCode = 404; response.end('Not found'); });
    stream.pipe(response);
  } catch { response.statusCode = 404; response.end('Not found'); }
}).listen(4174, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4174 — Ctrl+C to stop.'));

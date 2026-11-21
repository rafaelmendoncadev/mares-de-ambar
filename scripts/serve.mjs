import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist', import.meta.url));
const port = Number(process.env.PORT ?? 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

await stat(resolve(root, 'index.html')).catch(() => {
  console.error('Build local ausente. Execute npm run build primeiro.');
  process.exit(1);
});

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const file = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root + sep) || !['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(403).end();
      return;
    }
    const entry = await stat(file);
    if (!entry.isFile()) throw new Error('Arquivo ausente');
    response.writeHead(200, {
      'Content-Type': types[extname(file)] ?? 'application/octet-stream',
      'Content-Length': entry.size,
      'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(file).on('error', () => response.destroy()).pipe(response);
  } catch {
    response.writeHead(404).end('Arquivo ausente');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Marés de Âmbar · http://127.0.0.1:${server.address().port}/`);
});

const { app, BrowserWindow, protocol, session } = require('electron');
const { readFile } = require('node:fs/promises');
const { extname, relative, resolve, sep } = require('node:path');

const scheme = 'mares:';
const entry = scheme + '//jogo/';
const bundle = resolve(__dirname, 'dist');
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};
const headers = {
  'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
};

function isGameUrl(url) {
  return url.protocol === scheme && url.hostname === 'jogo' && !url.port && !url.username && !url.password;
}

async function serveFile(request) {
  try {
    const url = new URL(request.url);
    if (!isGameUrl(url) || request.method !== 'GET') return new Response(null, { status: 403 });
    const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = resolve(bundle, '.' + pathname);
    const subpath = relative(bundle, file);
    if (!subpath || subpath === '..' || subpath.startsWith('..' + sep)) return new Response(null, { status: 403 });
    const type = contentTypes[extname(file)];
    if (!type) return new Response(null, { status: 404 });
    return new Response(await readFile(file), { headers: { ...headers, 'Content-Type': type } });
  } catch {
    return new Response(null, { status: 404 });
  }
}

app.setName('Marés de Âmbar');
app.setDesktopName('mares-de-ambar.desktop');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('no-pings');
app.enableSandbox();
protocol.registerSchemesAsPrivileged([{ scheme: 'mares', privileges: { standard: true, secure: true } }]);

let gameWindow;

app.whenReady().then(async () => {
  const gameSession = session.defaultSession;
  gameSession.webRequest.onBeforeRequest(({ url }, respond) => {
    const target = new URL(url);
    respond({ cancel: !isGameUrl(target) && !['data:', 'blob:'].includes(target.protocol) });
  });
  gameSession.setPermissionRequestHandler((_contents, _permission, respond) => respond(false));
  gameSession.setPermissionCheckHandler(() => false);
  gameSession.protocol.handle('mares', serveFile);

  gameWindow = new BrowserWindow({
    title: 'Marés de Âmbar',
    icon: resolve(__dirname, 'selo.png'),
    width: 1440,
    height: 900,
    minWidth: 840,
    minHeight: 610,
    backgroundColor: '#111a1b',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  gameWindow.setMenu(null);
  gameWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  gameWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  gameWindow.webContents.on('will-redirect', (event) => event.preventDefault());
  gameWindow.once('ready-to-show', () => gameWindow.show());
  await gameWindow.loadURL(entry);
}).catch((error) => {
  console.error('Não foi possível abrir Marés de Âmbar:', error);
  app.exit(1);
});

app.on('window-all-closed', () => app.quit());

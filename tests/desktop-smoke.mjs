import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { _electron } from 'playwright';

export const desktopUrl = 'mares://jogo/';

export async function openDesktop(executablePath) {
  const profile = await mkdtemp(join(tmpdir(), 'mares-playwright-'));
  try {
    const electron = await _electron.launch({
      executablePath,
      args: [
        '--user-data-dir=' + profile,
        '--host-resolver-rules=MAP * ~NOTFOUND',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
      ],
      chromiumSandbox: true,
      timeout: 30000,
    });
    return {
      electron,
      async close() {
        try { await electron.close(); }
        finally { await rm(profile, { recursive: true, force: true }); }
      },
    };
  } catch (error) {
    await rm(profile, { recursive: true, force: true });
    throw error;
  }
}

export async function reloadDesktopWithMonitoring(page) {
  await page.waitForURL(desktopUrl);
  await page.waitForLoadState('load');
  // Chromium exposes timings after Playwright has attached to the page.
  await page.reload({ waitUntil: 'load' });
}

export async function checkDesktopResources(page) {
  const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(({ name }) => name));
  const local = resources.filter((url) => url.startsWith(desktopUrl));
  const external = resources.filter((url) => /^(https?|wss?):/.test(url));
  assert.deepEqual(external, []);
  assert.ok(local.some((url) => url.endsWith('.woff2')), 'O aplicativo precisa carregar fontes empacotadas.');
  return local.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const binary = process.argv[2];
  assert.ok(binary, 'Informe o caminho para o executável Electron empacotado.');
  const desktop = await openDesktop(binary);
  try {
    const page = await desktop.electron.firstWindow();
    const externalRequests = [];
    page.on('request', (request) => {
      if (/^(https?|wss?):/.test(request.url())) externalRequests.push(request.url());
    });
    await reloadDesktopWithMonitoring(page);
    const canvas = page.locator('#battlefield canvas');
    await canvas.waitFor({ timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.title(), 'Marés de Âmbar · Escaramuça local');
    assert.equal(await page.evaluate(() => typeof globalThis.require), 'undefined');
    assert.equal(await page.evaluate(() => typeof globalThis.process), 'undefined');
    await page.keyboard.press('W');
    assert.equal(await page.locator('#selection-name').innerText(), '3 unidades');
    const board = await canvas.boundingBox();
    assert.ok(board);
    await page.mouse.click(board.x + 7.5 * board.width / 50, board.y + 6.5 * board.height / 28, { button: 'right' });
    await page.locator('#objective-wood.done').waitFor({ timeout: 17000 });
    const count = await checkDesktopResources(page);
    assert.deepEqual(externalRequests, []);
    const localOnly = await page.evaluate(async () => {
      try {
        await fetch('https://example.invalid/mares-de-ambar');
        return false;
      } catch {
        return true;
      }
    });
    assert.equal(localOnly, true, 'O aplicativo precisa bloquear conexões externas.');
    console.log(`Aplicativo Linux validado · coleta e depósito · ${count} recursos internos e 0 externos.`);
  } finally {
    await desktop.close();
  }
}

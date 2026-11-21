import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const origin = new URL(process.env.GAME_URL ?? 'http://127.0.0.1:4173/').origin;
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(origin).hostname), 'O teste aceita apenas localhost.');
const chrome = process.env.CHROME_PATH ?? (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
const output = new URL('../test-results/', import.meta.url);
await mkdir(output, { recursive: true });

function snapshot(page, name) {
  return page.screenshot({ path: fileURLToPath(new URL(name + '.png', output)), fullPage: true });
}

async function run(name, scenario) {
  const browser = await chromium.launch({
    executablePath: chrome,
    args: [
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE ' + new URL(origin).hostname,
    ],
  });
  const requests = new Set();
  const blocked = [];
  const faults = [];

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
    // Deny external URLs even if a future version of the game tries to request one.
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin === origin) {
        requests.add(url.pathname);
        return route.continue();
      }
      blocked.push(url.href);
      return route.abort();
    });
    await context.routeWebSocket('**/*', (socket) => {
      blocked.push(socket.url());
      socket.close();
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => faults.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') faults.push(message.text());
    });
    page.on('response', (response) => {
      if (response.status() >= 400) faults.push(response.status() + ' ' + response.url());
    });

    const canvas = page.locator('#battlefield canvas');
    const checkText = (selector, expression, timeout = 4000) => page.waitForFunction(
      ([query, source]) => new RegExp(source).test(document.querySelector(query)?.textContent ?? ''),
      [selector, expression.source], { timeout },
    );
    const selectName = (expression, timeout) => checkText('#selection-name', expression, timeout);
    const ready = (id, timeout = 26000) => page.locator('#' + id + ':enabled').waitFor({ timeout });
    const done = (id, timeout = 24000) => page.locator('#objective-' + id + '.done').waitFor({ timeout });
    const coords = async (x, y, offsetY = 0) => {
      const box = await canvas.boundingBox();
      assert.ok(box, 'O tabuleiro precisa estar visível.');
      return {
        x: box.x + (x + .5) * box.width / 50,
        y: box.y + ((y + .5) * 32 + offsetY) * box.height / 896,
      };
    };
    const click = async (x, y, button = 'left', offsetY = 0) => {
      const cursor = await coords(x, y, offsetY);
      await page.mouse.click(cursor.x, cursor.y, { button });
    };

    await page.goto(origin, { waitUntil: 'networkidle' });
    await canvas.waitFor();
    await page.evaluate(() => document.fonts.ready);

    try {
      await scenario({ page, click, coords, checkText, selectName, ready, done });
      assert.deepEqual(blocked, [], 'Nenhum recurso externo deve ser solicitado.');
      assert.deepEqual(faults, [], 'Nenhum erro deve ocorrer no navegador.');
      const remoteEntries = await page.evaluate(() => performance.getEntriesByType('resource')
        .map(({ name }) => name)
        .map((name) => new URL(name))
        .filter((url) => ['http:', 'https:'].includes(url.protocol) && url.origin !== location.origin)
        .map((url) => url.href));
      assert.deepEqual(remoteEntries, []);
      assert.ok([...requests].some((url) => url.endsWith('.woff2')), 'O teste precisa carregar fontes locais.');
      console.log(`OK ${name} · ${requests.size} caminhos locais e 0 externos`);
    } catch (error) {
      await snapshot(page, 'falha-' + name);
      console.error(name, await page.locator('#journal').innerText(), faults, blocked);
      throw error;
    }
  } finally {
    await browser.close();
  }
}

const victory = run('vitoria', async ({ page, click, checkText, selectName, ready, done }) => {
  await click(8, 10, 'left', -15);
  await selectName(/^Trabalhador$/);
  await page.keyboard.down('Shift');
  await click(9, 10, 'left', -15);
  await page.keyboard.up('Shift');
  await selectName(/^2 unidades$/);
  await page.keyboard.press('W');
  await selectName(/^3 unidades$/);
  await click(7, 6, 'right');
  await checkText('#selection-detail', /Coletando madeira/);
  await done('wood');
  await ready('build');

  await page.locator('#build').click();
  await click(24, 13);
  await checkText('#notice', /espaço livre/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#build').getAttribute('aria-pressed'), 'false');
  await page.keyboard.press('B');
  await click(13, 10);
  await done('build');

  await page.keyboard.press('W');
  await click(7, 6, 'right');
  await click(13, 10, 'left', -10);
  await selectName(/^Quartel$/);
  for (let guard = 0; guard < 6; guard++) {
    await ready('train');
    if (!guard) await page.locator('#train').click();
    else await page.keyboard.press('T');
  }
  await done('train');
  await checkText('#population', /^11\s*\/ 18/, 48000);

  await page.keyboard.press('A');
  await selectName(/^8 unidades$/);
  await snapshot(page, 'escaramuca');
  await click(40, 13, 'right', 10);
  await checkText('#selection-detail', /Em combate/);
  await done('win', 65000);
  await checkText('#veil-title', /O estreito é seu/);
  await snapshot(page, 'vitoria');
  console.log('Tempo da vitória na partida:', await page.locator('#clock').innerText());
  await page.getByRole('button', { name: 'Jogar novamente' }).click();
  await checkText('#match-state', /Em andamento/);
  await checkText('#wood', /^100$/);
  await checkText('#population', /^05\s*\/ 18/);
  assert.equal(await page.locator('.objectives .done').count(), 0);
});

const movement = run('movimento', async ({ page, click, coords, checkText, selectName }) => {
  const upper = await coords(11.3, 12.1);
  const lower = await coords(12.65, 14.55);
  await page.mouse.move(upper.x, upper.y);
  await page.mouse.down();
  await page.mouse.move(lower.x, lower.y, { steps: 8 });
  await page.mouse.up();
  await selectName(/^2 unidades$/);
  await click(25, 15, 'right');
  await checkText('#notice', /não pode ser atravessado/);

  await click(32, 8, 'right');
  await checkText('#selection-detail', /Em marcha/);
  await checkText('#selection-detail', /^2 guardas$/, 19000);
  await click(32, 8, 'left', -14);
  await selectName(/^Guarda$/);
  await page.keyboard.down('Shift');
  await click(31, 7, 'left', -14);
  await page.keyboard.up('Shift');
  await selectName(/^2 unidades$/);

  await page.getByRole('button', { name: 'Pausar' }).click();
  await checkText('#veil-title', /Partida pausada/);
  const paused = await page.locator('#clock').innerText();
  await page.waitForTimeout(1200);
  assert.equal(await page.locator('#clock').innerText(), paused);
  await page.getByRole('button', { name: 'Retomar partida' }).click();
  await checkText('#match-state', /Em andamento/);
  await page.getByRole('button', { name: 'Reiniciar partida' }).click();
  await checkText('#selection-name', /Selecione uma unidade/);
});

const defeat = run('derrota', async ({ page, checkText }) => {
  await checkText('#journal', /iniciou a construção de um quartel/, 35000);
  await checkText('#journal', /quartel da Casa de Ardósia está em operação/, 40000);
  await checkText('#journal', /coluna de Ardósia/, 110000);
  await checkText('#veil-title', /O cais caiu/, 95000);
  await snapshot(page, 'derrota');
  console.log('Tempo da derrota na partida:', await page.locator('#clock').innerText());
});

const results = await Promise.allSettled([victory, movement, defeat]);
for (const result of results) {
  if (result.status === 'rejected') {
    console.error(result.reason);
    process.exitCode = 1;
  }
}

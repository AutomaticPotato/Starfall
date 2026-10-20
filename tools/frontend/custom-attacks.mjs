/** Synthetic browser regression. Run against an isolated Vite preview, never production. */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { fixture, CHARACTER_ID } from './fixtures.mjs';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base = process.env.FRONTEND_URL ?? 'http://127.0.0.1:55162';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local isolated preview');
const output = process.env.SCREENSHOT_DIR ?? '/tmp/starfall-custom-attacks';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [320, 390, 1440]) {
    const data = fixture();
    let fail = false;
    let inventory = { revision: 1, items: [], coins: {}, customAttacks: [{ id: 'aurora-1', name: 'Thunder Gauntlets', damage: '1d8+3 thunder', toHit: '+6 vs AC', place: 1 }] };
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await context.route(u => u.pathname.startsWith('/api/'), async route => {
      const request = route.request();
      if (request.url().endsWith('/inventory')) {
        if (request.method() === 'PUT') {
          if (fail) return route.fulfill({ status: 503, json: { message: 'Synthetic save failure' } });
          inventory = { ...request.postDataJSON(), revision: inventory.revision + 1 };
          return route.fulfill({ json: { revision: inventory.revision } });
        }
        return route.fulfill({ json: inventory });
      }
      return route.fulfill({ json: data.resolve(request.url(), request.method(), request.postDataJSON()) });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/characters/${CHARACTER_ID}`);
    await page.getByRole('tab', { name: /^Equipment/ }).click();
    const section = page.getByRole('region', { name: 'Custom attacks' });
    await section.getByRole('button', { name: 'Edit Thunder Gauntlets', exact: true }).click();
    await page.getByLabel('Damage', { exact: true }).fill('2d8+4 cold');
    await page.getByRole('button', { name: 'Save attack', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(inventory.customAttacks[0].edited, true);
    assert.equal(inventory.customAttacks[0].damage, '2d8+4 cold');
    await section.getByRole('button', { name: 'Add attack', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill('Tail');
    await page.getByLabel('Damage', { exact: true }).fill('1d6 bludgeoning');
    fail = true;
    await page.getByRole('button', { name: 'Save attack', exact: true }).click();
    await page.getByRole('dialog').getByRole('alert').waitFor();
    assert.equal(inventory.customAttacks.length, 1);
    fail = false;
    await page.getByRole('button', { name: 'Save attack', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await section.getByRole('button', { name: 'Move Tail up', exact: true }).focus();
    const reordered = page.waitForResponse(r => r.url().endsWith('/inventory') && r.request().method() === 'PUT');
    await page.keyboard.press('Enter');
    await reordered;
    await page.waitForFunction(() => document.querySelector('[aria-label="Custom attacks"] li')?.textContent?.includes('Tail'));
    assert.equal(inventory.customAttacks[0].name, 'Tail');
    await page.screenshot({ path: `${output}/custom-attacks-${width}.png`, fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}`);
    await section.getByRole('button', { name: 'Delete Thunder Gauntlets', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete attack', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.deepEqual(inventory.removedAttackIds, ['aurora-1']);
    await page.reload();
    await page.getByRole('tab', { name: /^Equipment/ }).click();
    await section.getByRole('button', { name: 'Edit Tail', exact: true }).waitFor();
    assert.equal(await section.getByText('Thunder Gauntlets', { exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS custom attack editing, failure/retry, keyboard reorder, delete/reload at ${width}px`);
  }
} finally { await browser.close(); }

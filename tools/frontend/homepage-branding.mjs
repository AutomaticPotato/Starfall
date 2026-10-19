/**
 * Homepage artwork per theme. Run against a local server of the built app (VITE_API_BASE=""); every API request is
 * answered by the synthetic fixture. For each theme and width: the hero shows that theme's Starfall picture, loaded,
 * whole (its box keeps 512 × 870 and fits the page), without horizontal overflow or layout shift. Then the theme is
 * changed through the theme dialog (the picture follows at once) and the choice survives a reload.
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { fixture } from "./fixtures.mjs";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
const base = process.env.FRONTEND_URL || "http://127.0.0.1:55052";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Use a local test server");
const output = process.env.SCREENSHOT_DIR || "/tmp/starfall-branding-shots";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

async function open(viewport, theme) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  await context.addInitScript((theme) => {
    if (theme && !localStorage.getItem("starlights-ui-theme")) localStorage.setItem("starlights-ui-theme", theme);
    // layout shifts from the first paint on, read back by hero()
    window.__shift = 0;
    new PerformanceObserver((list) => list.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__shift += e.value; })).observe({ type: "layout-shift", buffered: true });
  }, theme);
  const data = fixture();
  await context.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const req = route.request();
    let body = {};
    try { body = data.resolve(req.url(), req.method(), req.postDataJSON()); } catch { /* the homepage needs none */ }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`));
  return { context, page, errors };
}

const hero = (page) => page.locator("header h1 img").evaluate(async (img) => {
  await img.decode().catch(() => {});
  const box = img.getBoundingClientRect();
  const frame = img.parentElement.getBoundingClientRect();
  return {
    src: new URL(img.currentSrc || img.src).pathname, alt: img.alt, loaded: img.complete && img.naturalWidth > 0,
    natural: [img.naturalWidth, img.naturalHeight], box: [box.width, box.height], frame: [frame.width, frame.height],
    left: box.left, right: box.right, vw: innerWidth, theme: document.documentElement.dataset.theme,
    overflow: document.documentElement.scrollWidth - innerWidth, shift: window.__shift,
  };
});

function check(h, theme, label) {
  assert.equal(h.theme, theme, `${label}: page theme`);
  assert.equal(h.src, `/branding/starfall/starfall-${theme}.webp`, `${label}: artwork`);
  assert.ok(h.loaded, `${label}: artwork did not load`);
  assert.deepEqual(h.natural, [512, 870], `${label}: artwork size`);
  assert.equal(h.alt, "Starfall", `${label}: alternative text`);
  assert.ok(Math.abs(h.box[1] / h.box[0] - 870 / 512) < 0.01, `${label}: stretched ${h.box}`);
  assert.ok(Math.abs(h.frame[0] - h.box[0]) < 1 && Math.abs(h.frame[1] - h.box[1]) < 1, `${label}: cropped by its frame ${h.frame} vs ${h.box}`);
  assert.ok(h.left >= 0 && h.right <= h.vw + 0.5, `${label}: off screen ${h.left}..${h.right} of ${h.vw}`);
  assert.ok(h.overflow <= 1, `${label}: horizontal overflow ${h.overflow}`);
  assert.ok(h.shift < 0.02, `${label}: layout shift ${h.shift.toFixed(3)}`);
}

try {
  for (const theme of ["porcelain", "slate", "midnight"])
    for (const width of [320, 375, 768, 1024, 1440]) {
      const { context, page, errors } = await open({ width, height: 900 }, theme);
      await page.goto(base + "/");
      await page.locator("header h1 img").waitFor();
      await page.waitForLoadState("networkidle");
      const h = await hero(page);
      check(h, theme, `${theme}/${width}`);
      assert.deepEqual(errors, [], `${theme}/${width}: ${errors.join("; ")}`);
      await page.screenshot({ path: `${output}/home-${theme}-${width}.png` });
      results.push({ theme, width, box: h.box.map(Math.round), shift: Number(h.shift.toFixed(4)) });
      await context.close();
    }

  // switching through the theme dialog, at a phone and a desktop width, then reloading
  for (const width of [375, 1440]) {
    const { context, page } = await open({ width, height: 900 }, "porcelain");
    await page.goto(base + "/");
    await page.locator("header h1 img").waitFor();
    for (const [name, theme] of [["Midnight", "midnight"], ["Slate", "slate"], ["Porcelain", "porcelain"], ["Midnight", "midnight"]]) {
      await page.getByRole("button", { name: "Choose theme" }).first().click();
      await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
      // the preview already shows the artwork of the theme being tried
      await page.waitForFunction((t) => document.querySelector("header h1 img")?.getAttribute("src")?.endsWith(`starfall-${t}.webp`), theme);
      await page.getByRole("button", { name: "Save theme" }).click();
      const h = await hero(page);
      assert.equal(h.src, `/branding/starfall/starfall-${theme}.webp`, `switch to ${theme} at ${width}`);
      assert.ok(h.loaded, `switch to ${theme} at ${width}: not loaded`);
    }
    await page.reload();
    await page.locator("header h1 img").waitFor();
    check(await hero(page), "midnight", `reload at ${width}`);
    results.push({ switched: width, reload: "midnight" });
    await context.close();
  }

  // the favicons and the navigation emblem stay as they were
  const { context, page } = await open({ width: 1280, height: 900 }, "slate");
  await page.goto(base + "/");
  const icons = await page.evaluate(() => [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')].map((l) => new URL(l.href).pathname));
  assert.ok(icons.includes("/branding/favicon.ico") && icons.includes("/branding/apple-touch-icon.png"), `favicons ${icons}`);
  assert.equal(await page.locator('img[src="/branding/starlights-emblem.webp"]').count() > 0, true, "navigation emblem");
  await context.close();
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(`homepage branding: ${results.length} checks passed`);
} finally {
  await browser.close();
}

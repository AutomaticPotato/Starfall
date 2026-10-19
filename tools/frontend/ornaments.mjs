/**
 * The theme ornaments (public/ornaments/<theme>/) across the app. Run ONLY against a local, disposable install
 * (built app + API with test data); it reads, never writes. Env: FRONTEND_URL, TOKEN (an admin token of that
 * install), SCREENSHOT_DIR; SHOTS_ONLY=1 takes the screenshots without the ornament checks (for a build without them).
 * For each page, theme and width: no horizontal overflow, no page errors, only the current theme's ornaments loaded
 * (all found), decorations hidden from assistive technology and not clickable, page corners clear of the page column,
 * keyboard focus never covered by a decoration. Then: theme switching without reload, print, and every ornament
 * file missing (the pages must look and work the same, minus the pictures).
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
const base = process.env.FRONTEND_URL || "http://127.0.0.1:8198";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Use a local, disposable install");
const token = process.env.TOKEN ?? "";
const shotsOnly = process.env.SHOTS_ONLY === "1";
const output = process.env.SCREENSHOT_DIR || "/tmp/starfall-ornament-shots";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

async function open(viewport, theme, { missing = false } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  await context.addInitScript(({ theme, token }) => {
    localStorage.setItem("starlights-ui-theme", theme);
    localStorage.setItem("starlights.player", "Mk2 Tester");
    if (token) localStorage.setItem("starlights.player-tokens", JSON.stringify({ "*admin*": token }));
  }, { theme, token });
  if (missing) await context.route((url) => url.pathname.startsWith("/ornaments/"), (route) => route.abort());
  const page = await context.newPage();
  const errors = [];
  const ornaments = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  page.on("response", (r) => {
    const path = new URL(r.url()).pathname;
    if (path.startsWith("/ornaments/")) ornaments.push({ path, status: r.status() });
    else if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${path}`);
  });
  return { context, page, errors, ornaments };
}

// what the page shows of the ornaments, measured in the page
const inspect = (page) => page.evaluate(() => {
  const vis = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0; };
  const column = document.querySelector("body .container > main")?.parentElement;
  const col = column?.getBoundingClientRect();
  const corners = [...document.querySelectorAll(".page-corner")].filter(vis).map((el) => {
    const r = el.getBoundingClientRect();
    return { hidden: el.getAttribute("aria-hidden") === "true", pe: getComputedStyle(el).pointerEvents, left: r.left, right: r.right, clear: !col || r.right <= col.left + parseFloat(getComputedStyle(column).paddingLeft) || r.left >= col.right - parseFloat(getComputedStyle(column).paddingRight) };
  });
  const dividers = [...document.querySelectorAll(".celestial-divider")].filter(vis).map((el) => ({ hidden: el.getAttribute("aria-hidden") === "true", pe: getComputedStyle(el).pointerEvents }));
  const pseudo = [...document.querySelectorAll("[data-ornament]")].filter(vis).map((el) => getComputedStyle(el, "::before").pointerEvents);
  const nav = document.querySelector(".nav-active");
  return {
    overflow: document.documentElement.scrollWidth - innerWidth, height: document.documentElement.scrollHeight,
    corners, dividers, pseudo, navUnderline: nav ? getComputedStyle(nav).backgroundImage : null, theme: document.documentElement.dataset.theme,
  };
});

// tab through the first controls: what is focused must be what is on top at its centre
async function focusClear(page, presses = 12) {
  const covered = [];
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press("Tab");
    const hit = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return null;
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !top || el === top || el.contains(top) || top.contains(el) ? null : `${el.tagName} covered by ${top.className || top.tagName}`;
    });
    if (hit) covered.push(hit);
  }
  return covered;
}

const list = token ? await (await fetch(`${base}/api/characters`, { headers: { "X-Player-Token": token } })).json() : { characters: [] };
const id = process.env.CHARACTER_ID || list.characters?.[0]?.characterId;
const pages = [
  ["home", "/"], ["characters", "/characters"], ["builder", `/characters/${id}`], ["sheet", `/characters/${id}/play`],
  ["campaigns", "/campaigns"], ["battle", `/battle/${id}`], ["compendium", "/compendium"], ["homebrew", "/homebrew"], ["lore", "/lore"],
];
const heights = {};

try {
  for (const theme of ["porcelain", "slate", "midnight"])
    for (const width of [390, 1440, 1920]) {
      for (const [name, path] of pages) {
        if (width === 1920 && !["home", "compendium", "homebrew"].includes(name)) continue;
        const { context, page, errors, ornaments } = await open({ width, height: 900 }, theme);
        await page.goto(base + path);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${output}/${name}-${theme}-${width}.png` });
        const m = await inspect(page);
        heights[`${name}/${theme}/${width}`] = m.height;
        const label = `${name}/${theme}/${width}`;
        assert.ok(m.overflow <= 1, `${label}: horizontal overflow ${m.overflow}`);
        assert.deepEqual(errors, [], `${label}: ${errors.join("; ")}`);
        if (!shotsOnly) {
          assert.equal(m.theme, theme, `${label}: theme`);
          assert.ok(ornaments.every((o) => o.path.startsWith(`/ornaments/${theme}/`)), `${label}: other themes' ornaments loaded ${ornaments.map((o) => o.path)}`);
          assert.ok(ornaments.every((o) => o.status === 200 || o.status === 304), `${label}: ornament missing ${JSON.stringify(ornaments)}`);
          assert.ok(m.corners.every((c) => c.hidden && c.pe === "none" && c.clear), `${label}: page corner ${JSON.stringify(m.corners)}`);
          if (width < 1440) assert.equal(m.corners.length, 0, `${label}: page corners on a narrow screen`);
          assert.ok(m.dividers.every((d) => d.hidden && d.pe === "none"), `${label}: divider ${JSON.stringify(m.dividers)}`);
          assert.ok(m.pseudo.every((pe) => pe === "none"), `${label}: corner takes clicks`);
          if (m.navUnderline) assert.ok(m.navUnderline.includes(`/ornaments/${theme}/nav-active-underline.svg`), `${label}: nav underline ${m.navUnderline}`);
          const covered = await focusClear(page);
          assert.deepEqual(covered, [], `${label}: focus covered: ${covered.join("; ")}`);
        }
        results.push({ page: name, theme, width, corners: m.corners.length, dividers: m.dividers.length, ornaments: [...new Set(ornaments.map((o) => o.path.split("/").pop()))] });
        await context.close();
      }
    }

  if (!shotsOnly) {
    // the theme dialog ("settings"): switching changes the ornaments at once, no reload; the dialog's own corners too
    const { context, page, ornaments } = await open({ width: 1440, height: 900 }, "porcelain");
    await page.goto(base + "/characters");
    await page.waitForLoadState("networkidle");
    for (const [name, theme] of [["Midnight", "midnight"], ["Slate", "slate"], ["Porcelain", "porcelain"]]) {
      await page.getByRole("button", { name: "Choose theme" }).first().click();
      const dialog = page.getByRole("dialog");
      const corner = await dialog.evaluate((el) => getComputedStyle(el, "::before").backgroundImage);
      assert.ok(corner.includes("/panel-corner.svg"), `dialog corner ${corner}`);
      await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
      await page.getByRole("button", { name: "Save theme" }).click();
      await page.waitForFunction((t) => getComputedStyle(document.querySelector(".nav-active")).backgroundImage.includes(`/ornaments/${t}/`), theme);
      if (name === "Midnight") await page.screenshot({ path: `${output}/settings-dialog-midnight.png` });
    }
    assert.ok(["midnight", "slate"].every((t) => ornaments.some((o) => o.path.startsWith(`/ornaments/${t}/`))), "ornaments followed the theme");
    results.push({ switched: "porcelain→midnight→slate→porcelain", reload: false });

    // printing hides them
    await page.goto(base + "/");
    await page.emulateMedia({ media: "print" });
    const printed = await page.evaluate(() => [...document.querySelectorAll(".page-corner, .celestial-divider")].filter((el) => getComputedStyle(el).display !== "none").length);
    assert.equal(printed, 0, "ornaments in print");
    await context.close();

    // every ornament file missing: same layout, no errors
    for (const [name, path] of pages)
      for (const width of [390, 1440]) {
        const { context, page, errors } = await open({ width, height: 900 }, "midnight", { missing: true });
        await page.goto(base + path);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(500);
        const m = await inspect(page);
        assert.ok(m.overflow <= 1, `missing/${name}/${width}: overflow`);
        assert.deepEqual(errors, [], `missing/${name}/${width}: ${errors.join("; ")}`);
        assert.ok(Math.abs(m.height - heights[`${name}/midnight/${width}`]) <= 2, `missing/${name}/${width}: height ${m.height} vs ${heights[`${name}/midnight/${width}`]}`);
        await context.close();
      }
    results.push({ missingAssets: "same height, no errors" });
  }
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(`ornaments: ${results.length} checks passed${shotsOnly ? " (screenshots only)" : ""}`);
} finally {
  await browser.close();
}

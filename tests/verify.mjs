import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const frame = async () =>
  Buffer.from(
    (await page.evaluate(() => window.nocturne.canvas.toDataURL())).split(
      ",",
    )[1],
    "base64",
  );
try {
  await page.goto("http://127.0.0.1:5173/");
  await page.waitForFunction(
    () => window.nocturne?.ready,
    {},
    { timeout: 120000 },
  );
  assert.equal(await page.locator("button:visible").count(), 1);
  assert.equal(await page.locator("input,header,footer,aside,nav").count(), 0);
  assert.equal(await page.evaluate(() => window.nocturne.time), 0);
  assert.equal(
    await page.evaluate(() => {
      const c = window.nocturne.canvas;
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      for (let i = 0; i < d.length; i += 4)
        if (d[i] !== 2 || d[i + 1] !== 8 || d[i + 2] !== 23 || d[i + 3] !== 255)
          return false;
      return true;
    }),
    true,
  );
  await page.screenshot({ path: "test-results/minimal-start.png" });
  const start = hash(await frame());
  const stats = await page.evaluate(() => window.nocturne.stats);
  assert.equal(stats.stars, 6800);
  assert.equal(stats.width, 1080);
  assert.equal(stats.height, 1920);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  assert.equal(await page.locator("button:visible").count(), 0);
  await page.waitForTimeout(1500);
  assert.notEqual(hash(await frame()), start);
  await page.waitForFunction(
    () => window.nocturne.time === 20 && !window.nocturne.playing,
    {},
    { timeout: 30000 },
  );
  const final = await frame();
  assert.equal(
    hash(final),
    hash(await readFile("exports/nocturne-731204.png")),
    "Artwork must remain identical to the original exported PNG",
  );
  await page.waitForTimeout(1800);
  assert.equal(hash(await frame()), hash(final));
  assert.equal(await page.locator("button:visible").count(), 0);
  await page.screenshot({ path: "test-results/minimal-finished.png" });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    const box = await page.locator("canvas").boundingBox();
    assert.ok(Math.abs(box.width / box.height - 9 / 16) < 0.001);
    assert.ok(
      box.x >= -1 &&
        box.y >= -1 &&
        box.x + box.width <= viewport.width + 1 &&
        box.y + box.height <= viewport.height + 1,
    );
    assert.equal(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight,
      ),
      true,
    );
  }
  await page.keyboard.press("Space");
  await page.waitForTimeout(300);
  assert.ok(
    await page.evaluate(
      () => window.nocturne.playing && window.nocturne.time < 2,
    ),
  );
  assert.equal(await page.locator("button:visible").count(), 0);
  await page.evaluate(() => window.nocturne.seek(20));
  assert.equal(hash(await frame()), hash(final));
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.evaluate(() => window.nocturne.exportPNG()),
  ]);
  await download.saveAs("test-results/minimal-export.png");
  assert.equal(
    hash(await readFile("test-results/minimal-export.png")),
    hash(final),
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        result: "PASS",
        stats,
        checks: [
          "dark initial canvas",
          "single Play button",
          "20-second playback",
          "no overlays after Play",
          "original artwork pixel equality",
          "indefinite hold",
          "desktop/mobile/landscape aspect ratio",
          "no scrolling",
          "Space restart",
          "PNG export",
          "no page errors",
        ],
      },
      null,
      2,
    ),
  );
} catch (error) {
  await page.screenshot({ path: "test-results/minimal-failure.png" });
  throw error;
} finally {
  await browser.close();
}

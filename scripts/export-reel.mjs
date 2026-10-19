import { chromium } from "playwright";
import { createServer } from "vite";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

const out = resolve("exports/reel");
await mkdir(out, { recursive: true });
const server = await createServer({
  server: { host: "127.0.0.1", port: 5190 },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: "msedge", headless: false });
  const page = await browser.newPage({
    viewport: { width: 540, height: 960 },
    acceptDownloads: true,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    `http://127.0.0.1:${server.httpServer.address().port}/reel.html?export`,
  );
  await page.waitForFunction(() => window.reel?.ready, {}, { timeout: 120000 });
  const snippets = await page.evaluate(() => window.reel.snippets);
  const provenance = {
    intro: "src/sky.js",
    ground: "src/animation.js",
    clouds: "src/animation.js",
    stars: "src/animation.js",
    palms: "src/animation.js",
    fronds: "src/palmTrees.js",
    glow: "src/animation.js",
  };
  const normalize = (text) =>
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .join("\n")
      .trim();
  const audit = [];
  for (const [id, file] of Object.entries(provenance)) {
    const source = await readFile(file, "utf8");
    assert.ok(
      normalize(source).includes(normalize(snippets[id])),
      `Non-source text in ${id}`,
    );
    new Function(snippets[id].replace(/^export\s+/, ""));
    audit.push({
      section: id,
      source: file,
      exactSourceExcerptIgnoringIndentation: true,
      syntacticallyComplete: true,
    });
  }
  const frames = await page.evaluate(() =>
    Array.from({ length: 600 }, (_, frame) => ({
      frame,
      t: frame / 30,
      paintingTime: window.reel.paintingTime(frame / 30),
      code: window.reel.codeState(frame / 30)?.id ?? null,
    })),
  );
  for (const f of frames) {
    const expected =
      f.t < 2
        ? null
        : f.t < 5
          ? "intro"
          : f.paintingTime < 3
            ? "ground"
            : f.paintingTime < 7
              ? "clouds"
              : f.paintingTime < 10
                ? "stars"
                : f.t < 12.55
                  ? "palms"
                  : f.paintingTime < 16
                    ? "fronds"
                    : f.t < 18
                      ? "glow"
                      : null;
    assert.equal(
      f.code,
      expected,
      `Code/painting mismatch at frame ${f.frame}`,
    );
  }
  // Confirm the detailed frond section starts after trunks and coconuts finish.
  const { createPalms } = await import("../src/palmTrees.js");
  const operations = createPalms(731204);
  assert.ok(
    operations
      .filter((o) => o.points || o.coconut)
      .every((o) => o.time < 13.075),
  );
  assert.ok(operations.some((o) => o.leaf && o.time < 13.075));
  await writeFile(
    resolve(out, "source-audit.json"),
    JSON.stringify(
      {
        result: "PASS",
        checkedFrames: frames.length,
        excerpts: audit,
        timeline: frames,
      },
      null,
      2,
    ),
  );
  assert.ok(
    !/nocturne|flawtoon|\.js|https?:|www\./i.test(
      Object.values(snippets).join("\n"),
    ),
  );
  for (const t of [1, 4.8, 6.4, 7, 9.8, 11.8, 13.8, 14.8, 16.5, 18, 19.9]) {
    const image = await page.evaluate((t) => {
      window.reel.render(t);
      return window.reel.canvas.toDataURL();
    }, t);
    await writeFile(
      resolve(out, `frame-${t}.png`),
      Buffer.from(image.split(",")[1], "base64"),
    );
  }
  const a = await page.evaluate(() => {
    window.reel.render(18);
    return window.reel.canvas.toDataURL();
  });
  const b = await page.evaluate(() => {
    window.reel.render(20);
    return window.reel.canvas.toDataURL();
  });
  assert.equal(a, b, "Final hold must remain still");
  console.log("Encoding 600 procedural reel frames…");
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 300000 }),
    page.evaluate(() => window.reel.exportVideo()),
  ]);
  await download.saveAs(resolve(out, "creative-coding-reel.webm"));
  assert.deepEqual(errors, []);
  console.log("Converting to MP4…");
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-v",
      "error",
      "-i",
      resolve(out, "creative-coding-reel.webm"),
      "-vf",
      "fps=30,format=yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "18",
      "-movflags",
      "+faststart",
      "-an",
      resolve(out, "creative-coding-reel.mp4"),
    ],
    { stdio: "inherit", timeout: 300000 },
  );
  const probe = JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-count_frames",
        "-show_entries",
        "stream=width,height,r_frame_rate,nb_read_frames",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        resolve(out, "creative-coding-reel.mp4"),
      ],
      { encoding: "utf8" },
    ),
  );
  assert.equal(probe.streams[0].width, 1080);
  assert.equal(probe.streams[0].height, 1920);
  assert.equal(probe.streams[0].nb_read_frames, "600");
  assert.equal(probe.streams[0].r_frame_rate, "30/1");
  assert.equal(Number(probe.format.duration), 20);
  await writeFile(
    resolve(out, "verification.json"),
    JSON.stringify({ result: "PASS", ...probe }, null, 2),
  );
  console.log(JSON.stringify(probe, null, 2));
} finally {
  await browser?.close();
  await server.close();
}

import { chromium } from "playwright";
import { createServer } from "vite";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const option = (name, fallback) =>
  process.argv
    .find((a) => a.startsWith(`--${name}=`))
    ?.split("=")
    .slice(1)
    .join("=") ?? fallback;
const seed = Number(option("seed", "731204"));
if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295)
  throw new Error("Seed must be an unsigned 32-bit integer");
const directory = resolve(option("out", "exports"));
await mkdir(directory, { recursive: true });
const server = await createServer({ server: { host: "127.0.0.1", port: 0 } });
let browser;
try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  await server.listen();
  const address = server.httpServer.address();
  browser = await chromium.launch({
    channel: option("browser", "msedge"),
    headless: false,
  });
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`http://127.0.0.1:${address.port}/?seed=${seed}`);
  await page.waitForFunction(
    () => window.nocturne?.ready,
    {},
    { timeout: 120000 },
  );
  for (const [method, extension] of [
    ["exportPNG", "png"],
    ["exportVideo", "webm"],
  ]) {
    console.log(`Exporting ${extension.toUpperCase()} for seed ${seed}…`);
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 300000 }),
      page.evaluate((method) => window.nocturne[method](), method),
    ]);
    if (!download.suggestedFilename().endsWith(`.${extension}`))
      throw new Error("This browser does not support the WebM export path");
    await download.saveAs(resolve(directory, `nocturne-${seed}.${extension}`));
  }
  console.log("Converting to H.264 MP4…");
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-v",
      "error",
      "-i",
      resolve(directory, `nocturne-${seed}.webm`),
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
      resolve(directory, `nocturne-${seed}.mp4`),
    ],
    { stdio: "inherit", timeout: 300000 },
  );
  console.log(`Saved PNG, WebM and MP4 to ${directory}`);
} finally {
  await browser?.close();
  await server.close();
}

import { CONFIG, clamp, smooth, layer } from "./config.js";
import { Painting } from "./animation.js";
import { Muxer, ArrayBufferTarget } from "webm-muxer";
import skySource from "./sky.js?raw";
import palmSource from "./palmTrees.js?raw";
import animationSource from "./animation.js?raw";

const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const art = layer(),
  artCtx = art.getContext("2d");
const seed =
  Number(
    new URLSearchParams(location.search).get("seed") ?? CONFIG.defaultSeed,
  ) >>> 0;
let painting,
  ready = false,
  exporting = false;

// Excerpts are taken directly from source at build time, never recreated as mock code.
function excerpt(source, start, end) {
  const a = source.indexOf(start),
    b = source.indexOf(end, a);
  if (a < 0 || b < a)
    throw new Error("Source excerpt no longer matches the renderer");
  const lines = source.slice(a, b).trimEnd().split("\n");
  const indent = Math.min(
    ...lines
      .slice(1)
      .filter((l) => l.trim())
      .map((l) => l.match(/^ */)[0].length),
  );
  return lines
    .map((line, i) =>
      i ? line.slice(Math.min(indent, line.match(/^ */)[0].length)) : line,
    )
    .join("\n");
}
const snippets = {
  intro: skySource
    .slice(skySource.indexOf("export function skyField("))
    .trim(),
  ground: excerpt(animationSource, "this.brush(this.ground", "\n"),
  clouds: excerpt(animationSource, "this.brush(this.cloud", "\n"),
  stars: excerpt(
    animationSource,
    "const stars = this.starLayer",
    "    let n3 =",
  ),
  palms: excerpt(animationSource, "let n3 = this.counts[3];", "    const n4 ="),
  fronds: excerpt(palmSource, "if (o.leaf) {", "  if (o.coconut)"),
  glow: excerpt(animationSource, "const n4 =", "    this.counts ="),
};
const colors = {
  keyword: "#c586c0",
  number: "#b5cea8",
  string: "#ce9178",
  function: "#dcdcaa",
  identifier: "#9cdcfe",
  punctuation: "#d4d4d4",
};
const tokenPattern =
  /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:const|let|function|return|for|if|export|while|continue|new)\b|\b\d+(?:\.\d+)?\b|[A-Za-z_$][\w$]*|\s+|.)/g;
function drawCode(
  text,
  progress,
  y,
  maxHeight,
  fontSize = 26,
  lineHeight = 34,
) {
  const visible = text.slice(0, Math.floor(text.length * clamp(progress)));
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, y - 34, 1080, maxHeight);
  ctx.clip();
  ctx.font = `${fontSize}px Consolas, "Courier New", monospace`;
  ctx.textBaseline = "alphabetic";
  let x = 70,
    row = y;
  const tokens = visible.match(tokenPattern) ?? [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.includes("\n")) {
      for (const part of token.split("")) {
        if (part === "\n") {
          x = 70;
          row += lineHeight;
        } else x += ctx.measureText(part).width;
      }
      continue;
    }
    const width = ctx.measureText(token).width;
    const closingPunctuation = /^[,.;:)\]}]/.test(token);
    if (x + width > 1010 && !closingPunctuation) {
      x = 104;
      row += lineHeight;
    }
    let next = i + 1;
    while (next < tokens.length && /^\s+$/.test(tokens[next])) next++;
    const type =
      /^(const|let|function|return|for|if|export|while|continue|new)$/.test(
        token,
      )
        ? "keyword"
        : /^\d/.test(token)
          ? "number"
          : /^["']/.test(token)
            ? "string"
            : /^[A-Za-z_$]/.test(token)
              ? tokens[next] === "(" && !/^(this|Math)$/.test(token)
                ? "function"
                : "identifier"
              : "punctuation";
    ctx.fillStyle = colors[type];
    ctx.fillText(token, x, row);
    x += width;
  }
  if (progress < 1) {
    ctx.fillStyle = "#d4d4d4";
    ctx.fillRect(x + 3, row - 25, 2, 30);
  }
  ctx.restore();
}
export function paintingTime(t) {
  if (t < 5) return 0;
  if (t < 8.5) return ((t - 5) / 3.5) * 7;
  if (t < 10.5) return 7 + ((t - 8.5) / 2) * 3;
  if (t < 14.5) return 10 + ((t - 10.5) / 4) * 6;
  if (t < 15) return 16 + ((t - 14.5) / 0.5) * 2;
  return 20;
}
// The same mapping drives display and export verification.
function codeState(t) {
  if (t < 2 || t >= 18) return null;
  if (t < 5) return { id: "intro", progress: (t - 2) / 2.5 };
  if (t < 6.5) return { id: "ground", progress: 0.25 + (t - 5) / 1.1 };
  if (t < 8.5) return { id: "clouds", progress: 0.2 + (t - 6.5) / 1.5 };
  if (t < 10.5) return { id: "stars", progress: 0.25 + (t - 8.5) / 1.5 };
  if (t < 12.55) return { id: "palms", progress: 0.3 + (t - 10.5) / 1.4 };
  if (t < 14.5) return { id: "fronds", progress: 0.25 + (t - 12.55) / 1.3 };
  return { id: "glow", progress: 1 };
}
function render(t) {
  ctx.fillStyle = "#080b10";
  ctx.fillRect(0, 0, 1080, 1920);
  if (t < 2) {
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '48px "Segoe UI", sans-serif';
    ctx.fillText("When you see art,", 540, 902);
    ctx.fillText("even in code… 🌌", 540, 974);
    ctx.textAlign = "left";
    return;
  }
  if (t < 5) {
    drawCode(snippets.intro, (t - 2) / 2.5, 430, 1500, 34, 42);
    return;
  }
  painting.render(artCtx, paintingTime(t));
  const code = codeState(t);
  const transition = smooth((t - 15) / 3);
  if (code) {
    ctx.save();
    ctx.globalAlpha = t < 15 ? 1 : 1 - transition;
    drawCode(snippets[code.id], code.progress, 70, 610, 40, 50);
    ctx.restore();
  }
  // Preserve the entire portrait while moving/scaling it out of the split layout.
  const height = 1260 + (1920 - 1260) * transition,
    width = (height * 9) / 16;
  ctx.drawImage(art, (1080 - width) / 2, 660 * (1 - transition), width, height);
}
async function exportVideo() {
  if (!ready || exporting) throw new Error("Renderer is not ready");
  exporting = true;
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "V_VP9", width: 1080, height: 1920, frameRate: 30 },
    firstTimestampBehavior: "offset",
  });
  let failure;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      failure = e;
    },
  });
  try {
    encoder.configure({
      codec: "vp09.00.10.08",
      width: 1080,
      height: 1920,
      bitrate: 14000000,
      framerate: 30,
    });
    for (let frame = 0; frame < 600; frame++) {
      render(frame / 30);
      const image = new VideoFrame(canvas, {
        timestamp: Math.round((frame * 1e6) / 30),
        duration:
          Math.round(((frame + 1) * 1e6) / 30) - Math.round((frame * 1e6) / 30),
      });
      encoder.encode(image, { keyFrame: frame % 60 === 0 });
      image.close();
      while (encoder.encodeQueueSize > 4) {
        await new Promise((resolve) => setTimeout(resolve, 5));
        if (failure) throw failure;
      }
      if (frame % 30 === 0)
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await encoder.flush();
    muxer.finalize();
    const url = URL.createObjectURL(
      new Blob([target.buffer], { type: "video/webm" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "creative-coding-reel.webm";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } finally {
    encoder.close();
    exporting = false;
    render(20);
  }
}
render(0);
const worker = new Worker(new URL("./sky.worker.js", import.meta.url), {
  type: "module",
});
worker.onmessage = ({ data }) => {
  if (data.error) throw new Error(data.error);
  painting = new Painting(seed, data);
  worker.terminate();
  ready = true;
  if (!new URLSearchParams(location.search).has("export")) {
    const start = performance.now();
    let last = -1;
    function tick(now) {
      const frame = Math.min(600, Math.floor(((now - start) * 30) / 1000));
      if (frame !== last) {
        render(frame / 30);
        last = frame;
      }
      if (frame < 600 && !exporting) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
};
worker.onerror = (e) => console.error(e.message);
worker.postMessage({ seed });
window.reel = {
  get ready() {
    return ready;
  },
  canvas,
  render,
  exportVideo,
  snippets,
  paintingTime,
  codeState,
};

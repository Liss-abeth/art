import p5 from "p5";
import "./style.css";
import { CONFIG } from "./config.js";
import { Painting } from "./animation.js";
import { Muxer, ArrayBufferTarget } from "webm-muxer";

const playButton = document.getElementById("play");
let painting, canvas, ctx, sketch, worker;
let playing = false,
  recording = false,
  time = 0,
  last = 0;
let preparation,
  pendingPlay = false,
  message = "Preparing";
const status = (text) => {
  message = text;
};

function generate(seed = CONFIG.defaultSeed) {
  if (recording) throw new Error("An export is in progress");
  playing = false;
  sketch.noLoop();
  seed = Number.isFinite(Number(seed))
    ? Math.min(4294967295, Math.max(0, Math.floor(Number(seed))))
    : CONFIG.defaultSeed;
  time = 0;
  ctx.fillStyle = "#020817";
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
  preparation = new Promise((resolve, reject) => {
    worker = new Worker(new URL("./sky.worker.js", import.meta.url), {
      type: "module",
    });
    const fail = (error) => {
      worker.terminate();
      status(error.message);
      reject(error);
    };
    worker.onmessage = ({ data }) => {
      if (data.error) return fail(new Error(data.error));
      painting = new Painting(seed, data);
      painting.render(ctx, 0);
      worker.terminate();
      status("Ready");
      resolve();
    };
    worker.onerror = (event) => fail(new Error(event.message));
    worker.postMessage({ seed });
  });
  return preparation;
}

async function play() {
  if (recording || pendingPlay) return;
  pendingPlay = true;
  playButton.hidden = true;
  try {
    await preparation;
    seek(0);
    playing = true;
    last = performance.now();
    sketch.loop();
  } catch (error) {
    console.error(error);
    // Allow a retry without introducing an error panel into the artwork.
    playButton.hidden = false;
    preparation = generate();
    preparation.catch(console.error);
  } finally {
    pendingPlay = false;
  }
}

function seek(t) {
  if (!painting) throw new Error("Artwork is not ready");
  playing = false;
  sketch.noLoop();
  time = Math.max(0, Math.min(CONFIG.duration, t));
  painting.render(ctx, time);
}

new p5((p) => {
  sketch = p;
  p.setup = () => {
    p.pixelDensity(1);
    canvas = p.createCanvas(CONFIG.width, CONFIG.height).elt;
    canvas.setAttribute("aria-label", "Cosmic night sky, painted with code");
    canvas.setAttribute("role", "img");
    ctx = canvas.getContext("2d");
    p.frameRate(CONFIG.fps);
    p.noLoop();
    const seed = new URLSearchParams(location.search).get("seed");
    generate(seed === null ? CONFIG.defaultSeed : seed).catch(console.error);
  };
  p.draw = () => {
    if (!painting || !playing || recording) return;
    const now = performance.now();
    time = Math.min(CONFIG.duration, time + (now - last) / 1000);
    last = now;
    painting.render(ctx, time);
    if (time >= CONFIG.duration) {
      playing = false;
      p.noLoop();
    }
  };
});
playButton.addEventListener("click", play);
window.addEventListener("keydown", (event) => {
  if (event.code === "Space" && !event.repeat) {
    event.preventDefault();
    play();
  }
});
// Do not skip the drawing process after switching away from the tab.
document.addEventListener("visibilitychange", () => {
  last = performance.now();
});

function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
async function exportPNG() {
  await preparation;
  if (recording) throw new Error("An export is in progress");
  const output = document.createElement("canvas");
  output.width = CONFIG.width;
  output.height = CONFIG.height;
  const previous = time;
  painting.render(output.getContext("2d"), CONFIG.duration);
  painting.render(ctx, previous);
  const blob = await new Promise((resolve) =>
    output.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("PNG export failed");
  download(blob, `nocturne-${painting.seed}.png`);
}
async function exportVideo() {
  if (!painting) return;
  if (window.VideoEncoder) {
    const config = {
      codec: "vp09.00.10.08",
      width: CONFIG.width,
      height: CONFIG.height,
      bitrate: 12000000,
      framerate: CONFIG.fps,
    };
    const support = await VideoEncoder.isConfigSupported(config).catch(() => ({
      supported: false,
    }));
    if (support.supported) {
      playing = false;
      recording = true;

      const oldTime = time;
      let encoder;
      try {
        const target = new ArrayBufferTarget(),
          muxer = new Muxer({
            target,
            video: {
              codec: "V_VP9",
              width: CONFIG.width,
              height: CONFIG.height,
              frameRate: CONFIG.fps,
            },
            firstTimestampBehavior: "offset",
          });
        let encodingError;
        encoder = new VideoEncoder({
          output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
          error: (error) => {
            encodingError = error;
          },
        });
        encoder.configure(config);
        for (let frame = 0; frame < CONFIG.duration * CONFIG.fps; frame++) {
          if (encodingError) throw encodingError;
          time = frame / CONFIG.fps;
          painting.render(ctx, time);
          const videoFrame = new VideoFrame(canvas, {
            timestamp: Math.round((frame * 1000000) / CONFIG.fps),
            duration:
              Math.round(((frame + 1) * 1000000) / CONFIG.fps) -
              Math.round((frame * 1000000) / CONFIG.fps),
          });
          encoder.encode(videoFrame, { keyFrame: frame % 60 === 0 });
          videoFrame.close();
          while (encoder.encodeQueueSize > 4) {
            await new Promise((resolve) => setTimeout(resolve, 5));
            if (encodingError) throw encodingError;
          }
          if (frame % 5 === 0) {
            status(
              `Exporting ${Math.round(frame / 6)}% · Rendering all 600 frames.`,
            );
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }
        await encoder.flush();
        muxer.finalize();
        download(
          new Blob([target.buffer], { type: "video/webm" }),
          `nocturne-${painting.seed}.webm`,
        );
        status("Video saved: 600 frames · 20 seconds · 1080 × 1920.");
      } catch (error) {
        status(`Video export failed: ${error.message}`);
        throw error;
      } finally {
        if (encoder && encoder.state !== "closed") encoder.close();
        recording = false;

        seek(oldTime);
      }
      return;
    }
  }
  if (!window.MediaRecorder || !canvas.captureStream) {
    status(
      "Video recording is unavailable in this browser. Use Chrome or Edge.",
    );
    return;
  }
  const mime = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ].find((m) => MediaRecorder.isTypeSupported(m));
  if (!mime) {
    status("No supported video encoder. Use Chrome or Edge.");
    return;
  }
  playing = false;
  recording = true;

  const oldTime = time;
  let stream, recorder;
  try {
    seek(0);
    stream = canvas.captureStream(CONFIG.fps);
    const chunks = [];
    recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 12000000,
    });
    const done = new Promise((resolve, reject) => {
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onstop = resolve;
      recorder.onerror = (e) => reject(e.error || new Error("Encoder error"));
    });
    recorder.start();
    const start = performance.now();
    let frame = 0;
    await new Promise((resolve) => {
      const tick = () => {
        const now = performance.now();
        while (frame < 600 && now - start >= (frame * 1000) / 30) {
          time = frame / 30;
          painting.render(ctx, time);
          frame++;
        }

        status(
          `Recording ${Math.min(100, Math.round(frame / 6))}% · Keep this tab visible.`,
        );
        if (frame < 600)
          setTimeout(
            tick,
            Math.max(0, start + (frame * 1000) / 30 - performance.now()),
          );
        else
          setTimeout(resolve, Math.max(0, start + 20000 - performance.now()));
      };
      tick();
    });
    recorder.stop();
    await done;
    const blob = new Blob(chunks, { type: mime });
    download(
      blob,
      `nocturne-${painting.seed}.${mime.includes("mp4") ? "mp4" : "webm"}`,
    );
    status(
      "20-second video saved. MP4 conversion instructions are in README.md.",
    );
  } catch (error) {
    if (recorder?.state === "recording") recorder.stop();
    status(`Video export failed: ${error.message}`);
    throw error;
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
    recording = false;

    seek(oldTime);
  }
}

// Internal automation/export API; none of these controls are rendered in the page.
window.nocturne = {
  get ready() {
    return !!painting;
  },
  get seed() {
    return painting?.seed;
  },
  get time() {
    return time;
  },
  get playing() {
    return playing;
  },
  get recording() {
    return recording;
  },
  get status() {
    return message;
  },
  get stats() {
    return painting
      ? {
          stars: painting.stars.length,
          palmOperations: painting.palms.length,
          width: canvas.width,
          height: canvas.height,
        }
      : null;
  },
  get canvas() {
    return canvas;
  },
  seek,
  play,
  generate,
  exportPNG,
  exportVideo,
};

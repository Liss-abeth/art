import { CONFIG, layer, random, clamp } from "./config.js";
import { createStars, paintStar } from "./stars.js";
import { createPalms, paintPalmOp } from "./palmTrees.js";
export class Painting {
  constructor(seed, data) {
    this.seed = seed;
    this.base = layer();
    this.nebula = layer();
    for (const [target, pixels] of [
      [this.base, data.base],
      [this.nebula, data.clouds],
    ]) {
      const small = document.createElement("canvas");
      small.width = data.w;
      small.height = data.h;
      small
        .getContext("2d")
        .putImageData(new ImageData(pixels, data.w, data.h), 0, 0);
      target
        .getContext("2d")
        .drawImage(small, 0, 0, CONFIG.width, CONFIG.height);
    }
    const r = random(seed ^ 0x119);
    this.marks = [];
    for (let y = 0; y < CONFIG.height; y += CONFIG.brushSize)
      for (let x = 0; x < CONFIG.width; x += CONFIG.brushSize)
        this.marks.push({
          x,
          y,
          rank:
            r() * 0.65 +
            0.35 * (1 - y / CONFIG.height + 0.2 * Math.sin(x / 210)),
          angle: Math.sin(y / 190 + x / 240) * 0.8,
        });
    this.stamp = document.createElement("canvas");
    this.stamp.width = 128;
    this.stamp.height = 128;
    const brush = this.stamp.getContext("2d");
    for (let i = 0; i < 20; i++) {
      const x = 22 + i * 4.3,
        y = 64 + Math.sin(i * 0.22) * 10 + (r() - 0.5) * 13,
        rad = 16 + r() * 14,
        g = brush.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, "#ffffff33");
      g.addColorStop(0.4, "#ffffff20");
      g.addColorStop(1, "#ffffff00");
      brush.fillStyle = g;
      brush.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    this.marks.sort((a, b) => a.rank - b.rank);
    this.stars = createStars(seed);
    this.palms = createPalms(seed);
    this.reset();
  }
  reset() {
    this.ground = layer();
    this.cloud = layer();
    this.groundMask = layer();
    this.cloudMask = layer();
    this.starLayer = layer();
    this.treeLayer = layer();
    this.detail = layer();
    this.counts = [0, 0, 0, 0, 0];
    this.previous = -1;
  }
  brush(target, source, mask, index, end) {
    if (index === end) return;
    const ctx = target.getContext("2d"),
      mctx = mask.getContext("2d"),
      size = CONFIG.brushSize;
    for (let i = index; i < end; i++) {
      const m = this.marks[i];
      mctx.save();
      mctx.translate(m.x + size * 0.5, m.y + size * 0.5);
      mctx.rotate(m.angle);
      mctx.drawImage(this.stamp, -64, -64);
      mctx.restore();
    }
    ctx.clearRect(0, 0, CONFIG.width, CONFIG.height);
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(source, 0, 0);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }
  render(ctx, time) {
    time = clamp(time, 0, 20);
    if (time < this.previous) this.reset();
    const total = this.marks.length,
      n0 = Math.floor(clamp(time / 3) * total),
      n1 = Math.floor(clamp((time - 3) / 4) * total),
      n2 = Math.floor(clamp((time - 7) / 3) * this.stars.length);
    this.brush(this.ground, this.base, this.groundMask, this.counts[0], n0);
    this.brush(this.cloud, this.nebula, this.cloudMask, this.counts[1], n1);
    const stars = this.starLayer.getContext("2d");
    for (let i = this.counts[2]; i < n2; i++) paintStar(stars, this.stars[i]);
    let n3 = this.counts[3];
    const tree = this.treeLayer.getContext("2d");
    while (n3 < this.palms.length && this.palms[n3].time <= time)
      paintPalmOp(tree, this.palms[n3++]);
    const n4 = Math.floor(clamp((time - 16) / 2) * this.stars.length);
    const detail = this.detail.getContext("2d");
    for (let i = this.counts[4]; i < n4; i++)
      if (this.stars[i].glow) paintStar(detail, this.stars[i], true);
    this.counts = [n0, n1, n2, n3, n4];
    this.previous = time;
    ctx.fillStyle = "#020817";
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
    ctx.globalAlpha = clamp((time - 2.4) / 0.6);
    ctx.drawImage(this.base, 0, 0);
    ctx.globalAlpha = 1;
    if (time < 3) ctx.drawImage(this.ground, 0, 0);
    ctx.globalAlpha = clamp((time - 6.2) / 0.8);
    ctx.drawImage(this.nebula, 0, 0);
    ctx.globalAlpha = 1;
    if (time < 7) ctx.drawImage(this.cloud, 0, 0);
    ctx.drawImage(this.starLayer, 0, 0);
    ctx.drawImage(this.detail, 0, 0);
    ctx.drawImage(this.treeLayer, 0, 0);
  }
}

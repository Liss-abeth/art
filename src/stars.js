import { CONFIG, random } from "./config.js";
import { makeNoise } from "./sky.js";
export function createStars(seed) {
  const r = random(seed ^ 0x51a7),
    n = makeNoise(seed),
    stars = [];
  while (stars.length < CONFIG.stars) {
    let x = r() * CONFIG.width,
      y = r() * CONFIG.height;
    // Rejection sampling creates faint clustered regions without a regular grid.
    if (r() > 0.6 + 0.6 * n.fbm(x / 210, y / 210, 3)) continue;
    const z = r(),
      radius =
        z < 0.84
          ? 0.3 + r() * 0.52
          : z < 0.985
            ? 0.65 + r() * 0.8
            : 1.3 + r() * 1.1;
    stars.push({
      x,
      y,
      r: radius,
      a: 0.2 + r() * 0.65,
      glow: z > 0.989,
      spike: z > 0.998,
      time: 7 + r() * 3,
    });
  }
  stars.sort((a, b) => a.time - b.time);
  return stars;
}
export function paintStar(ctx, s, extra = false) {
  if (s.glow) {
    const radius = s.r * (extra ? 10 : 7),
      g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, radius);
    g.addColorStop(0, "#c2f5ffbb");
    g.addColorStop(0.1, "#6fe8ffa0");
    g.addColorStop(0.3, "#14baff35");
    g.addColorStop(1, "#087bd100");
    ctx.fillStyle = g;
    ctx.fillRect(s.x - radius, s.y - radius, radius * 2, radius * 2);
  }
  ctx.fillStyle = `rgba(210,242,255,${s.a})`;
  ctx.beginPath();
  ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
  ctx.fill();
  if (s.spike) {
    ctx.strokeStyle = "#b2ecff70";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(s.x - s.r * 4, s.y);
    ctx.lineTo(s.x + s.r * 4, s.y);
    ctx.moveTo(s.x, s.y - s.r * 6);
    ctx.lineTo(s.x, s.y + s.r * 6);
    ctx.stroke();
  }
}

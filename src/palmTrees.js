import { random } from "./config.js";
const mix = (a, b, t) => a + (b - a) * t;
function bez(a, b, c, d, t) {
  const s = 1 - t;
  return {
    x:
      s * s * s * a.x +
      3 * s * s * t * b.x +
      3 * s * t * t * c.x +
      t * t * t * d.x,
    y:
      s * s * s * a.y +
      3 * s * s * t * b.y +
      3 * s * t * t * c.y +
      t * t * t * d.y,
  };
}
// Every shape is a tiny paint operation; the order models trunk → rachis → leaflets.
export function createPalms(seed) {
  const r = random(seed ^ 0x7a13),
    ops = [];
  const trees = [
    [100, 1960, 106, 1640, 0.35, 0],
    [299, 1980, 279, 1495, 0.58, 0],
    [564, 1990, 579, 1530, 0.62, 0],
    [901, 1990, 873, 1660, 0.53, 0],
    [333, 1980, 382, 1155, 0.87, 1],
    [1045, 1990, 913, 1100, 1.0, 1],
    [3, 1960, 2, 1310, 0.78, 1],
    [5, 1980, 65, 875, 1.1, 2],
    [780, 1980, 494, 797, 1.36, 2],
    [1135, 1980, 1009, 665, 1.21, 2],
    [-70, 500, -62, 92, 0.84, 2],
  ];
  trees.forEach(([bx, by, cx, cy, scale, depth], index) => {
    const color = depth === 0 ? "#031226" : depth === 1 ? "#020b1c" : "#010713",
      start = 10 + index * 0.065;
    const a = { x: bx, y: by },
      b = { x: mix(bx, cx, 0.25) + 22 * scale, y: mix(by, cy, 0.38) },
      c = { x: mix(bx, cx, 0.8) - 14 * scale, y: mix(by, cy, 0.83) },
      d = { x: cx, y: cy };
    for (let k = 0; k < 100; k++) {
      const t = k / 100,
        t2 = (k + 1.5) / 100,
        p = bez(a, b, c, d, t),
        q = bez(a, b, c, d, Math.min(1, t2)),
        w = (18 * (1 - t) + 6) * scale * (0.97 + r() * 0.06),
        v = (18 * (1 - t2) + 6) * scale;
      ops.push({
        time: start + t * 1.5,
        color,
        points: [
          p.x - w / 2,
          p.y,
          q.x - v / 2,
          q.y,
          q.x + v / 2,
          q.y,
          p.x + w / 2,
          p.y,
        ],
      });
    }
    const count = 11 + Math.floor(r() * 3);
    for (let f = 0; f < count; f++) {
      const angle =
        -Math.PI + (f / (count - 1)) * Math.PI * 2 + (r() - 0.5) * 0.3;
      const len = (155 + r() * 95) * scale,
        dx = Math.cos(angle) * len,
        dy = Math.sin(angle) * len * 0.65;
      const p0 = {
        x: cx + (r() - 0.5) * 10 * scale,
        y: cy + (r() - 0.5) * 12 * scale,
      };
      const p1 = { x: cx + dx * 0.33, y: cy + dy * 0.7 - 36 * scale };
      const p2 = { x: cx + dx * 0.76, y: cy + dy - 25 * scale };
      const p3 = { x: cx + dx, y: cy + dy + 45 * scale };
      const begin = start + 1.45 + f * 0.06;
      const leaflets = 30 + Math.floor(r() * 12);
      for (let j = 0; j < leaflets; j++) {
        const t = j / leaflets,
          u = (j + 1) / leaflets,
          p = bez(p0, p1, p2, p3, t),
          q = bez(p0, p1, p2, p3, u),
          theta = Math.atan2(q.y - p.y, q.x - p.x);
        ops.push({
          time: begin + t * 1.2,
          color,
          stroke: [p.x, p.y, q.x, q.y],
          width: (1 - t) * 3.7 * scale + 0.35,
        });
        if (j < 2) continue;
        for (const side of [-1, 1]) {
          const l =
            Math.pow(Math.sin(Math.PI * t), 0.65) * (38 + r() * 28) * scale;
          const bend = theta + side * (0.85 + r() * 0.3),
            tip = {
              x: p.x + Math.cos(bend) * l + dx * 0.07,
              y: p.y + Math.sin(bend) * l + 18 * scale * t,
            };
          const width = (5 + r() * 5.5) * scale * Math.pow(1 - t, 0.3);
          ops.push({
            time: begin + t * 1.2 + 0.1 + r() * 0.17,
            color,
            leaf: [
              p.x,
              p.y,
              p.x + Math.cos(bend) * l * 0.38 - Math.sin(bend) * width,
              p.y + Math.sin(bend) * l * 0.38 + Math.cos(bend) * width,
              tip.x,
              tip.y,
              p.x + Math.cos(bend) * l * 0.52 + Math.sin(bend) * width * 0.5,
              p.y + Math.sin(bend) * l * 0.52 - Math.cos(bend) * width * 0.5,
            ],
          });
        }
      }
    }
    for (let k = 0; k < 4; k++)
      ops.push({
        time: start + 1.5,
        color,
        coconut: [
          cx + (r() - 0.5) * 18 * scale,
          cy + r() * 14 * scale,
          5 * scale,
          7 * scale,
        ],
      });
  });
  const end = Math.max(...ops.map((o) => o.time));
  for (const op of ops) op.time = 10 + ((op.time - 10) * 5.9) / (end - 10);
  return ops.sort((a, b) => a.time - b.time);
}
export function paintPalmOp(ctx, o) {
  ctx.fillStyle = o.color;
  ctx.strokeStyle = o.color;
  ctx.beginPath();
  if (o.points) {
    ctx.moveTo(o.points[0], o.points[1]);
    for (let i = 2; i < o.points.length; i += 2)
      ctx.lineTo(o.points[i], o.points[i + 1]);
    ctx.closePath();
    ctx.fill();
  }
  if (o.stroke) {
    ctx.lineWidth = o.width;
    ctx.lineCap = "round";
    ctx.moveTo(o.stroke[0], o.stroke[1]);
    ctx.lineTo(o.stroke[2], o.stroke[3]);
    ctx.stroke();
  }
  if (o.leaf) {
    const p = o.leaf;
    ctx.moveTo(p[0], p[1]);
    ctx.quadraticCurveTo(p[2], p[3], p[4], p[5]);
    ctx.quadraticCurveTo(p[6], p[7], p[0], p[1]);
    ctx.fill();
  }
  if (o.coconut) (ctx.ellipse(...o.coconut, 0, 0, Math.PI * 2), ctx.fill());
}

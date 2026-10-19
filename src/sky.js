import { random } from "./config.js";
// Seeded gradient Perlin noise. No textures or photographic inputs.
export function makeNoise(seed) {
  const rng = random(seed),
    p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint16Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10),
    mix = (a, b, t) => a + (b - a) * t;
  const grad = (h, x, y) => {
    switch (h & 7) {
      case 0:
        return x + y;
      case 1:
        return -x + y;
      case 2:
        return x - y;
      case 3:
        return -x - y;
      case 4:
        return x;
      case 5:
        return -x;
      case 6:
        return y;
      default:
        return -y;
    }
  };
  function noise(x, y) {
    const X = Math.floor(x),
      Y = Math.floor(y);
    x -= X;
    y -= Y;
    const u = fade(x),
      v = fade(y),
      a = perm[X & 255] + (Y & 255),
      b = perm[(X + 1) & 255] + (Y & 255);
    return mix(
      mix(grad(perm[a], x, y), grad(perm[b], x - 1, y), u),
      mix(grad(perm[a + 1], x, y - 1), grad(perm[b + 1], x - 1, y - 1), u),
      v,
    );
  }
  function fbm(x, y, octaves = 6) {
    let s = 0,
      a = 0.5;
    for (let i = 0; i < octaves; i++) {
      s += a * noise(x, y);
      x = x * 2.03 + 17.1;
      y = y * 2.03 + 9.2;
      a *= 0.52;
    }
    return s;
  }
  return { noise, fbm };
}
export function skyField(x, y, n) {
  const warpX = n.fbm(x * 2.3 + 20, y * 2.3, 3),
    warpY = n.fbm(x * 2.3, y * 2.3 + 40, 3);
  const u = x * 9 + warpX * 0.65,
    v = y * 16 + warpY * 0.65;
  const f = n.fbm(u, v, 7),
    detail = n.fbm(u * 3.3 + 50, v * 3.3, 5);
  const center = 0.52 + 0.13 * Math.sin(y * 5.7) + 0.14 * n.noise(y * 3, 91);
  const band = Math.exp(-Math.pow((x - center) / 0.34, 2));
  const micro = n.fbm(u * 9 + 71, v * 9 + 34, 4);
  const cloud = Math.max(
    0,
    Math.min(1, 0.45 + f * 0.85 + band * 0.16 + detail * 0.7 + micro * 0.3),
  );
  const dust = Math.max(0, n.fbm(u * 1.5 + 100, v * 1.5 + 100, 5) + 0.04);
  const light =
    Math.pow(cloud, 1.7) *
    (0.5 + 0.6 * y + band * 0.45) *
    Math.max(0.2, 1 - dust * 2.1);
  return { light, cloud, band, detail };
}

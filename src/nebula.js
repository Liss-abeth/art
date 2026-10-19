import { CONFIG, random } from "./config.js";
import { makeNoise, skyField } from "./sky.js";
// Worker calculates the expensive field once. Playback only composites caches.
export function buildNebula(seed, scale = CONFIG.skyScale) {
  const w = Math.round(CONFIG.width * scale),
    h = Math.round(CONFIG.height * scale),
    base = new Uint8ClampedArray(w * h * 4),
    clouds = new Uint8ClampedArray(w * h * 4);
  const n = makeNoise(seed),
    r = random(seed ^ 0xab13);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const X = x / w,
        Y = y / h,
        { light, cloud, band, detail } = skyField(X, Y, n),
        i = (y * w + x) * 4;
      const vignette = 1 - 0.29 * Math.pow(Math.abs(X - 0.5) * 1.5, 2),
        grain = (r() - 0.5) * 2.8;
      base[i] = 2 + cloud * 3;
      base[i + 1] = 8 + cloud * 15 + Y * 10;
      base[i + 2] = 23 + cloud * 33 + Y * 14;
      base[i + 3] = 255;
      const t =
        (1 - Math.exp(-light * 1.8)) *
        vignette *
        (0.65 + 0.35 * Math.min(1, Y / 0.5));
      clouds[i] = 2 + t * 9 + Math.pow(t, 5) * 80 + grain;
      clouds[i + 1] = 14 + t * 122 + Math.pow(t, 3) * 65 + grain;
      clouds[i + 2] = 40 + t * 174 + grain;
      clouds[i + 3] = 255;
    }
  return { w, h, base, clouds };
}

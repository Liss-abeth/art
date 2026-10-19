export const CONFIG = {
  width: 1080,
  height: 1920,
  fps: 30,
  duration: 20,
  defaultSeed: 731204,
  stars: 6800,
  skyScale: 0.65,
  brushSize: 32,
};
export function random(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
export const smooth = (t) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};
export function layer() {
  const c = document.createElement("canvas");
  c.width = CONFIG.width;
  c.height = CONFIG.height;
  c.getContext("2d", { willReadFrequently: true });
  return c;
}

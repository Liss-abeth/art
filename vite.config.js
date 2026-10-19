import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  build: {
    rollupOptions: {
      input: { artwork: resolve("index.html"), reel: resolve("reel.html") },
    },
  },
});

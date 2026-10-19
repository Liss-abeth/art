# Third-party notices

This file records the direct npm dependencies and external encoding tools used by this project. Their license texts for direct npm dependencies are included in `licenses/`. The lockfile also installs transitive dependencies; this notice does not inventory those packages individually. Review the package metadata and applicable notices before redistributing a bundled copy of the dependency tree.

## Direct npm dependencies

- **p5.js 1.11.11 — LGPL-2.1.** Used by the standalone artwork page to initialize the canvas and animation loop. The reel page uses the browser Canvas 2D API directly and does not import p5.js. See [`licenses/p5-LGPL-2.1.txt`](licenses/p5-LGPL-2.1.txt).
- **webm-muxer 5.1.4 — MIT.** Used with browser WebCodecs to mux timed reel frames into WebM. See [`licenses/webm-muxer-MIT.txt`](licenses/webm-muxer-MIT.txt).

## Development and verification tools

- **Vite 6.4.4 — MIT.** Development server and production build tool. Its package notice also includes license and attribution text for bundled dependencies. See [`licenses/vite-MIT.txt`](licenses/vite-MIT.txt).
- **Playwright 1.56.1 — Apache-2.0.** Browser automation used by the export and verification scripts. See [`licenses/playwright-Apache-2.0.txt`](licenses/playwright-Apache-2.0.txt).

These tools are dependencies of the project repository; they are not rendered into the artwork or reel.

The Vite notice is preserved verbatim from the installed Vite 6.4.4 package and was compared byte-for-byte with the official `v6.4.4` source notice. It includes upstream contributor attributions. Those attributions belong to third-party dependency notices, not to the project creator.

## External encoder

The export scripts call the locally installed `ffmpeg` and `ffprobe` commands. FFmpeg converts WebM to H.264 MP4 using `libx264`. Neither FFmpeg nor libx264 is bundled in this repository, and no specific FFmpeg build is distributed with the project. The license and codec availability depend on the build installed by the user.

## Original project material

The procedural JavaScript source and the included generated preview artwork/video are original project material. The reel contains no third-party images, footage, audio, logos, watermarks, or captured editor interface; its visible code excerpts are drawn from this project's source files. The opening typography uses browser/system fonts.

No project-level license has been selected. The dependency notices above do not grant permission to reuse the project's own source or artwork. See the README's licensing section for the pending license decision.

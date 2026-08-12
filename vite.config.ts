import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

// ESAT Atlas ships as a single static bundle: `static/index.html` is the only entry,
// `public/` is copied verbatim (question bank, crops, mock data) and every path is
// relative so the site works from a repository sub-path on GitHub Pages.
export default defineConfig({
  root: fileURLToPath(new URL("./static", import.meta.url)),
  base: "./",
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
    // Source maps are a 3 MB debugging artefact; they are not published.
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 5173,
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: {
        client: "src/client.jsx",
        config: "src/builder/config/index.js",
        analytics: "src/analytics/index.js",
        finalization: "src/finalization/index.js",
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "@discovery-box/catalog",
        "html-to-image",
      ],
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "[name][extname]",
      },
    },
    sourcemap: false,
    emptyOutDir: true,
  },
});

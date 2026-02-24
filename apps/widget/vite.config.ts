import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173
  },
  build: {
    lib: {
      entry: "src/main.ts",
      name: "CSWWidget",
      fileName: () => "widget.js",
      formats: ["iife"]
    }
  }
});


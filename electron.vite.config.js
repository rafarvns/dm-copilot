const { resolve } = require("path");
const { defineConfig, externalizeDepsPlugin } = require("electron-vite");

module.exports = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: resolve(__dirname, "out/main"),
      rollupOptions: {
        input: resolve(__dirname, "src/main/index.js"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: resolve(__dirname, "out/preload"),
      rollupOptions: {
        input: resolve(__dirname, "src/preload/index.js"),
      },
    },
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    build: {
      outDir: resolve(__dirname, "out/renderer"),
      rollupOptions: {
        input: resolve(__dirname, "src/renderer/index.html"),
      },
    },
    server: {
      port: 5173,
    },
  },
});
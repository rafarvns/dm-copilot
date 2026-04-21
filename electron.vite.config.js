const { resolve } = require("path");
const { defineConfig, externalizeDepsPlugin } = require("electron-vite");
const { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } = require("fs");

// Função recursiva para copiar diretórios
function copyDirectory(src, dest) {
  mkdirSync(dest, { recursive: true });
  const files = readdirSync(src);
  for (const file of files) {
    const srcPath = resolve(src, file);
    const outPath = resolve(dest, file);
    if (existsSync(srcPath)) {
      const stats = statSync(srcPath);
      if (stats.isDirectory()) {
        copyDirectory(srcPath, outPath);
      } else if (stats.isFile()) {
        copyFileSync(srcPath, outPath);
      }
    }
  }
}

function copyDatabasePlugin() {
  return {
    name: "copy-database",
    closeBundle() {
      const srcDir = resolve(__dirname, "src/main/database");
      const outDir = resolve(__dirname, "out/main/database");
      if (existsSync(srcDir)) {
        copyDirectory(srcDir, outDir);
        console.log("Database files copied to output!");
      }
    }
  };
}

module.exports = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyDatabasePlugin()],
    build: {
      outDir: resolve(__dirname, "out/main"),
      rollupOptions: {
        input: resolve(__dirname, "src/main/index.js"),
        output: {
          inlineDynamicImports: true,
        },
        external: ["better-sqlite3"],
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
const js = require("@eslint/js");

module.exports = [
  // Base recommended rules
  js.configs.recommended,

  // Global settings
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        // Node.js globals (main & preload)
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        Buffer: "readonly",
        global: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "writable",
      },
    },
    rules: {
      // General rules
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },

  // Main process
  {
    files: ["src/main/**/*.js"],
    languageOptions: {
      globals: {
        // Electron main process globals
      },
    },
  },

  // Preload scripts
  {
    files: ["src/preload/**/*.js"],
    languageOptions: {
      globals: {
        // Electron preload globals
      },
    },
  },

  // Renderer process
  {
    files: ["src/renderer/src/**/*.js"],
    languageOptions: {
      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        requestAnimationFrame: "readonly",
        HTMLElement: "readonly",
        Node: "readonly",
        Event: "readonly",
        dmCopilot: "readonly",
      },
      sourceType: "module",
    },
  },

  // Config files
  {
    files: ["electron.vite.config.js", "eslint.config.js"],
    languageOptions: {
      sourceType: "commonjs",
    },
  },

  // Ignore patterns
  {
    ignores: ["out/**", "dist/**", "node_modules/**"],
  },
];
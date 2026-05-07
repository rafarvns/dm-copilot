#!/usr/bin/env node
// Hook PreToolUse — bloqueia Edit/Write/MultiEdit feitos pela main thread
// em src/renderer/** e src/main/**, forçando delegação via Agent tool.
// Subagentes (detectados pela presença de agent_id no payload de hook)
// passam livremente. Veja CLAUDE.md § "Sempre utilize os seguintes subagents".

"use strict";

const fs = require("fs");

let raw;
try {
  raw = fs.readFileSync(0, "utf8");
} catch (_) {
  process.exit(0);
}

let input;
try {
  input = JSON.parse(raw);
} catch (_) {
  process.exit(0);
}

if (input.agent_id) process.exit(0);

const fp = (input.tool_input && input.tool_input.file_path) || "";
if (!fp) process.exit(0);

const cwd = (input.cwd || "").replace(/\\/g, "/");
let normFp = fp.replace(/\\/g, "/");
if (cwd && normFp.toLowerCase().startsWith(cwd.toLowerCase())) {
  normFp = normFp.slice(cwd.length).replace(/^\/+/, "");
}

if (!/^(src\/renderer\/|src\/main\/)/.test(normFp)) process.exit(0);

const reason =
  "Edição direta de arquivos de UI/Electron não permitida — delegue via Agent tool com subagent_type voltagent-core-dev:frontend-developer (renderer), voltagent-core-dev:electron-pro (main process) ou voltagent-core-dev:ui-designer (CSS/visual), e ative a skill /dm-copilot-design-system. Veja CLAUDE.md.";

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  })
);
process.exit(0);

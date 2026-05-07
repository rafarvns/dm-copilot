# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Delegação de UI/Electron (obrigatório)

Edits em `src/renderer/**` e `src/main/**` são **bloqueados pelo hook PreToolUse** em `.claude/hooks/block-direct-renderer-edits.js`. Tudo nessas pastas passa por subagente, sem exceção — a regra vale para alterações de 1 linha de CSS tanto quanto pra refactors grandes.

- `voltagent-core-dev:frontend-developer` — código do renderer (vanilla JS, HTML, features/views)
- `voltagent-core-dev:electron-pro` — main process, IPC, integração Electron
- `voltagent-core-dev:ui-designer` — design, CSS, tokens, layout, estilização
- `voltagent-core-dev:backend-architect` — APIs (não bloqueado pelo hook, mas use)

Pra qualquer mudança na UI, ative `/dm-copilot-design-system` antes de delegar — carrega o design system com tokens, tipografia e iconografia. O hook detecta subagentes pelo campo `agent_id` no payload, então edits feitos de dentro deles passam normalmente.

## Common Commands

Package manager is **pnpm** (locked to `pnpm@10.14.0`). All scripts live in `package.json`.

```bash
pnpm install          # also runs `electron-rebuild -f -w better-sqlite3` via postinstall
pnpm dev              # electron-vite dev — HMR for renderer, auto-restart for main/preload
pnpm build            # electron-vite build + copies src/main/{database,services} to out/
pnpm preview          # preview production build
pnpm build:win        # build installer (NSIS) — also build:linux / build:mac
pnpm lint             # eslint src/
pnpm format           # prettier --write src/
```

There is no test suite yet. Lint and a clean `pnpm build` are the only static checks.

If `better-sqlite3` throws `NODE_MODULE_VERSION` errors after pulling deps, re-run `pnpm install` (the postinstall hook rebuilds the native binding for Electron's Node version).

## Architecture

DM Copilot is an **Electron desktop app** for tabletop RPG game masters. Three Electron processes plus an embedded HTTP/WebSocket server for the player view.

### Process layout

- **Main** (`src/main/index.js`) — single monolithic file holding the `BrowserWindow`, the `DatabaseManager` (SQLite via `better-sqlite3`), the `CombatServer` (Express + Socket.IO on port 3000), and **all `ipcMain.handle` registrations**. New IPC channels are added here.
- **Preload** (`src/preload/index.js`) — exposes the entire main-process API to the renderer as `window.dmCopilot` via `contextBridge`. Namespaces: `db.{campaigns,characters,encounters,scenes,notes,diceRolls}`, `store`, `dialogs`, `combat`, plus window controls. **Any new IPC handler must be mirrored here** or the renderer can't reach it.
- **Renderer** (`src/renderer/`) — vanilla JS modules (no framework), organized as `core/` (router, event-bus, presentation-controller, toast), `shared/` (sidebar, status-bar), `features/` (dashboard, campaigns, characters — each feature is a folder with `.js/.html/.css`), `views/` (legacy/secondary screens like dice, scenes, encounter combat), and `db/database.js` (thin async wrapper over `window.dmCopilot.db.*`).

### Renderer routing

`src/renderer/src/core/router.js` is a tiny Map-based router. Features are registered in `main.js` via `registerRoute(name, FeatureClass)` and mounted into `#view-outlet`. A FeatureClass must implement `mount(el)` and optionally `destroy()` (called before navigating away).

Some screens are not features but **global view singletons** instantiated on `main.js` (`window.encountersView`, `window.scenesView`, `window.charactersView`, `window.diceView`, `window.presentationController`). They're exposed on `window` because legacy code and modal triggers reach into them by name.

### Database layer

SQLite stored at `app.getPath('userData')/dm-copilot.db` with WAL mode + foreign keys on. The schema evolves through **versioned migration files** in `src/main/database/migrations/` (`v2_*`, `v10_*`, … `v15_*`). The `DatabaseManager` (defined inline in `src/main/index.js`) reads every `.js` in that folder, sorts by `version`, and applies any not present in `schema_migrations`.

Adding a new table or column means:
1. Create `vNN_description.js` exporting `{ version, name, up(db), down(db) }`. SQLite can't easily drop columns — make `up` idempotent (wrap `ALTER TABLE` in try/catch like `v15_add_roll_history.js`).
2. Add CRUD functions in `src/main/database/queries/<entity>.js` (CommonJS exports — these are loaded with `require()` from `index.js`).
3. Register `ipcMain.handle("db-<entity>-<op>", ...)` handlers in `src/main/index.js`.
4. Mirror the API in `src/preload/index.js` under the `db` namespace.
5. Optionally add typed wrappers in `src/renderer/src/db/database.js`.

The renderer **must not** require `better-sqlite3` directly — it goes through IPC. `better-sqlite3` is `external` in the Vite config, and `src/main/database/` and `src/main/services/` are copied verbatim into `out/` (not bundled) by custom plugins in `electron.vite.config.js` plus `scripts/copy-database.js`.

### Combat / Player view server

`CombatServer` boots on `app.whenReady` and serves `src/main/server/player-view.html` at `http://<LAN-IP>:3000`. Players on the same network open that URL to see the live combat/scene the DM is running. Communication is one-way Socket.IO broadcast (`combat-update`, `scene-update`, `dice-roll`) triggered from the renderer via `window.dmCopilot.combat.broadcast(event, data)` → `ipcMain.on("combat-server-broadcast")` → `io.emit`.

The server also static-mounts a lot of paths the player view needs: `userData/images/{characters,encounters,scenes}/`, `userData/music/`, the bundled encounter presets, and the `@3d-dice/dice-box` library + assets from `node_modules` and `src/renderer/public/dice-box/`. When adding new resources for the player view, route them through this server — the player browser cannot reach files via Electron's `local-image://` protocol.

Only one combat or scene can be "presented" at a time. `PresentationController` (renderer) gates this: features call `requestPresentation({ type, label, start, stop })` and the controller shows a conflict modal if something is already active. Use `adoptPresentation` when reopening already-active state (e.g. a combat that survived an app restart via `roll_history`).

### User data locations

- `userData/dm-copilot.db` — main database (+ `.db-shm`, `.db-wal`)
- `userData/images/{characters,encounters,scenes}/` — uploaded images, referenced in DB by relative path like `characters/char_<ts>.webp`
- `userData/music/` — YouTube audio downloaded by `src/main/services/youtube-downloader.js` (uses `youtube-dl-exec`)
- `userData/backup-<ts>.db` — backups via `databaseManager.backup()`

## Conventions

- Code style: Prettier (`printWidth: 100`, double quotes, 2-space tabs, trailing commas `es5`, LF line endings). Run `pnpm format` before committing.
- ESLint config splits globals per process — main/preload are CommonJS Node, renderer is ES modules with browser globals plus `dmCopilot`. Don't import Node modules from renderer code.
- Main and preload use **CommonJS** (`require`). Renderer uses **ES modules** (`import`). Don't mix.
- UI strings and most code comments are in **Portuguese (Brazil)** — match the surrounding language when editing.
- Feature folders bundle their own HTML template + CSS + JS. The HTML is loaded as a string (Vite handles this via the renderer build) and injected into the outlet.
- The `*-base.js` gitignore entry exists because vendored dice player blobs leaked third-party API keys in the past — don't commit files matching that pattern.

## Design system

The official design system lives at `design-system/` (bundle exported from `claude.ai/design`, mirroring this repo at commit `30cdb41`). Treat it as the source of truth for any UI work — don't invent visual decisions outside what's documented there.

**Where things live:**
- `design-system/project/README.md` — full spec: voice/copy, color, typography, spacing, motion, layout, iconography. Read this top-to-bottom when designing a new surface.
- `design-system/project/colors_and_type.css` — canonical token values.
- `design-system/project/preview/*.html` — self-contained reference cards per token/component.
- `design-system/project/ui_kits/desktop_app/` — hi-fi React JSX recreation (visual reference only; the app stays vanilla JS).
- `src/renderer/src/assets/tokens.css` — runtime canonical tokens + brand `@font-face`. **Imported by `main.css`.** Add new design tokens here, not in `main.css`.
- `src/renderer/src/assets/fonts/` — bundled `.otf` brand fonts (Nodesto Caps Condensed, Scaly Sans).

**Migration status — early.** `tokens.css` is in place but `main.css`'s legacy `:root` still wins for any conflicting variable, so the app looks identical to before. Next migration step: switch `--font-display` from `Cinzel` to `Nodesto Caps Condensed` and `--font-body` from `Inter` to `Scaly Sans` (fonts are already loaded; `var(--font-display-brand)` / `var(--font-body-brand)` are pre-defined aliases). After that, delete duplicate token entries from `main.css` feature-by-feature.

**Iconography is Lucide via `src/renderer/src/core/icons.js`.** Use `<i data-icon="name">` placeholders (auto-mounted by `mountIcons()`) or call `icon(name, opts)` directly. Don't use emoji as icons in new code; replace adjacent legacy emoji when you touch a file. Canonical icon vocabulary is in `design-system/project/README.md` § Iconography.

**Forbidden moves:** new colors outside the palette, gradients on surfaces (only the brand emblem and ROLL button get gradients), centred modals (they anchor 60 px from the top), light mode (none exists), new font families (Nodesto Caps Condensed + Scaly Sans + JetBrains Mono is the full set), translating D&D vocabulary (HP/AC/CA/Iniciativa/Encontro stay), centralizar conteúdo de feature dentro da `.main-view` com `margin: 0 auto` + `max-width` (a sidebar já desloca o eixo óptico — conteúdo é full-width com padding lateral via tokens).

**Skill:** the `dm-copilot-design-system` skill activates automatically on UI/design keywords. When in doubt, invoke it before touching renderer CSS or HTML.

# DM Copilot — Design System

> A digital assistant for tabletop RPG Dungeon Masters to create and run their campaigns.
> Desktop app built with Electron, written in Portuguese (pt-BR).

This folder is the design system for **DM Copilot**, extracted from the live codebase at
[github.com/rafarvns/dm-copilot](https://github.com/rafarvns/dm-copilot) (commit `30cdb41`,
branch `main`). The product is an Electron desktop app — a single-window dark UI for managing
TTRPG campaigns, characters, encounters, scenes, and live dice rolls. The design system
captured here matches the renderer process's actual CSS — colors, type, spacing, components.

## Sources

- **Codebase:** `rafarvns/dm-copilot` — primary truth.
  - Tokens: `src/renderer/src/assets/main.css` (~72 KB, single stylesheet)
  - HTML structure: `src/renderer/index.html`
  - Views (vanilla JS, no framework): `src/renderer/src/views/*.js`
  - Logo: `src/assets/images/logo_dm_copilot.png`
  - Dice icons: `src/assets/images/dices/d{4,6,8,10,12,20}.png`
- No Figma. No external design system docs.
- Tech: Electron 28 + Vite, vanilla JS + HTML + CSS, SQLite (better-sqlite3),
  3D dice via `@3d-dice/dice-box`.

## Index

```
DM Copilot Design System/
├── README.md                  ← you are here
├── SKILL.md                   ← Agent Skills entrypoint
├── colors_and_type.css        ← CSS variables (the canonical token set)
├── assets/
│   ├── logo_dm_copilot.png    ← app emblem (dragon + d20 + sword)
│   └── dice/d4..d20.png       ← dice icons used in the toolbar
├── preview/                   ← per-token cards rendered in the Design System tab
│   ├── colors-*.html
│   ├── type-*.html
│   ├── spacing-*.html
│   ├── components-*.html
│   └── brand-*.html
└── ui_kits/
    └── desktop_app/
        ├── README.md
        ├── index.html         ← interactive hi-fi recreation
        └── *.jsx              ← Sidebar, CampaignCard, DiceToolbar, etc.
```

---

## Product context

DM Copilot is a **tool**, not a game. The user is the Dungeon Master, sitting at a desk during
a session, fielding questions from players, looking up rules, rolling dice, presenting scenes
to a second screen. The app lives in their peripheral vision — visible but not loud.

Planned features (from upstream README):

- 🏰 **Gestão de Campanhas** — campaign management
- 🧙 **Criação de NPCs** — NPC creation with character sheets
- 🗺️ **Mapeamento de Encontros** — encounter mapping with allies/neutrals/enemies columns
- 📜 **Banco de Itens e Magias** — items & spells catalog
- 🎲 **Rolador de Dados** — integrated 3D dice roller
- 📝 **Diário de Sessão** — session journal
- 🔗 **Gerenciamento de Party** — party tracking

The current build has campaigns, characters, encounters with combat tracking, scenes (with
images and YouTube background music), and a 3D dice roller with history.

---

## Content fundamentals

**Language: Portuguese (pt-BR), throughout.** All UI copy, button labels, error messages,
and tooltips are in Brazilian Portuguese. The placeholder `Ex: A Mina do Rei Anão` ("e.g.
The Dwarf King's Mine") sets the tone — playful fantasy, not corporate.

**Voice — Game-Master register, second person, informal "você".** The app talks to the DM
as a peer who knows the hobby. Prompts read like a friendly co-DM passing notes:

- `"Defina a iniciativa de cada participante para começar."` — instructional, calm.
- `"Apresentar aos Jogadores"` — verbs in the imperative for primary actions.
- `"Tem certeza que deseja excluir? Esta ação não pode ser desfeita."` — direct,
  not apologetic.
- Form helpers: `"Segure Ctrl (ou ⌘) para selecionar várias."` — concrete, OS-aware.

**Casing.** Sentence case for descriptions and helpers. **Title Case** for primary
headings and section titles (`Nova Campanha`, `Confirmar Exclusão`). Buttons are
short imperatives (`Salvar`, `Cancelar`, `Editar`, `ROLL`). The dice **ROLL** button
is the only ALL-CAPS element — it earns the volume.

**Domain vocabulary is preserved, not localized.** D&D terms like *HP*, *AC*, *CA*,
*Iniciativa*, *Encontro*, *Aliados / Neutros / Inimigos*, *Personagem*, *Mestre*,
*Sistema* are used directly. Players know the jargon; the app respects that.

**Emoji used as inline iconography.** This is a deliberate choice — the entire app uses
emoji where a typical product would use an SVG icon set. They appear:

- In primary buttons next to verbs: `💾 Salvar`, `🗑️ Excluir`, `✏️ Editar`, `📁 Escolher arquivo`, `📷` (image picker), `📝` (notes), `🎬 Apresentar`, `💥 ROLL`, `⚔️ Iniciar Encontro`, `🏳️ Finalizar Encontro`, `🎲 Rolar Iniciativa`.
- In feature labels and section headings: `🏰 Campanhas`, `🧙 Personagens`, `🎭 Cenas Conectadas`, `💀 Teste de Resistência contra Morte`, `🎵 Trilha sonora pronta`, `📜 Magias`.
- In status: `⏳` (history), `➕` (add), `⬅️` `➡️` (back / forward / next turn), `&times;` (close).

Emoji are **never decorative** — every one labels an action or a category. Casing rules
still apply to the text next to them.

**Microcopy patterns.**

- Empty states are warm: *"Nenhuma anotação ainda. Clique em **Editar** para escrever lembretes,
  ganchos da cena, segredos do mestre etc."*
- Required fields marked with a rose-pink asterisk (`*`).
- Form helpers below the field, in `--color-text-muted`, italic-feeling but not italic.
- Toast feedback uses noun phrases (`Campanha criada`, `Erro ao salvar`).

---

## Visual foundations

### Mood

**Late-night session at the table.** Deep near-black surfaces, arcane purple as the only
saturated UI color, a warm gold reserved for the names of player-facing artifacts
(campaigns, characters), and a quartet of semantic accents that map to the rules
(rose = HP/danger, sky = AC, gold = initiative/warning, emerald = success). It feels
like a spellbook on a dim oak table — readable, focused, a little ceremonial.

### Color

- **Background ladder:** `#0f0f14 → #1a1a24 → #22222e → #2a2a38`. Four steps from the
  app shell up to active states. Borders are `#2e2e3e` — barely brighter than the active
  surface, just enough to delineate.
- **Primary is a single arcane purple** (`#7c3aed`) with a hover (`#6d28d9`) and a
  light text variant (`#a78bfa`). Used for the ROLL button gradient (`primary → #9333ea`),
  focus rings (`rgba(124,58,237,0.20)`), the sidebar active link, and the glow shadow.
- **Gold (`#f59e0b`) is reserved.** It only appears on names of campaigns, characters,
  initiative stat values, and the "premium" feature tag. Treating it as a scarce resource
  keeps the warm/cool balance intentional.
- **Combat affinity colors are louder than the rest of the UI** — `#22c55e / #eab308 /
  #ef4444` for ally/neutral/enemy headers. They sit at 10% alpha tint on a colored
  border, so they read as "tagged" rather than "filled".

### Type

- **Nodesto Caps Condensed** (display, all-caps fantasy) is used for: every `h1–h6`,
  modal titles, card titles (campaigns, characters), the dice result total, the
  welcome/empty-state titles. It's the "voice of the manual" — a tall, condensed,
  hand-drawn-feeling face that reads as a sourcebook header.
- **Scaly Sans** (humanist body sans) covers everything else — labels, buttons, body
  copy, table cells. The 400 weight handles body and helpers; 700 handles emphasized
  body, primary buttons, and the all-caps section labels.
- **JetBrains Mono** appears in the dice notation (`2d6+3`), timestamps in the dice
  history, and the inline `result-die` chips.
- **Sizes:** 16 px base, scaling `0.75 → 2.25rem` in eight steps. No fluid type — this is
  a fixed-window desktop app.
- **Brand fonts ship as `.otf` from `/fonts`** (Nodesto Caps Condensed and Scaly Sans —
  Bold/Italic/Bold-Italic for each). JetBrains Mono still loads from Google Fonts.

### Spacing

A clean **4 px scale** (`0.25rem` = 4 px steps): `1, 2, 3, 4, 5, 6, 8, 10, 12`. Section
padding lands at `--space-6` (24 px). Cards use `--space-5` interior. Sidebar items use
`--space-2 / --space-3`. The 4 px tightness keeps the dense info-tool feel without
becoming claustrophobic.

### Backgrounds & textures

- **No images, no gradients on surfaces.** The app shell is flat dark.
- **Two purposeful gradients only:** the brand emblem in the sidebar
  (`135deg, primary → gold`), and the ROLL button (`135deg, primary → #9333ea`).
- **Backdrop blur is used for overlays:** modal overlay (`blur(4px)` over `rgba(0,0,0,0.6)`)
  and the dice toolbar (`blur(8px)` over `rgba(30,41,59,0.5)`). This is the only place
  transparency + blur shows up.
- **Scene viewer is the one exception** — the hero block uses the user-uploaded scene
  image full-bleed with a darkening overlay; this is content, not chrome.

### Animation

- **Transitions: 150 / 250 / 350 ms ease.** Almost everything uses `--transition-fast`
  (150 ms) — hovers, focus rings, color shifts.
- **Modals enter** with a 200 ms fade + 250 ms slide-from-top + 5% scale-up.
- **Toasts slide in from the right** (300 ms ease).
- **Cards hover-lift by 2 px** (`translateY(-2px)`), gain a purple border, and reveal a
  4 px gradient bar on the left edge (`primary → gold`).
- **Dice buttons** lift 3 px on hover, scale to 0.95 on press, and the active counter pill
  scales from 0.5 → 1 with opacity.
- **Loading: three-dot bounce** (`loadingBounce` keyframes, 1.4 s cubic). No spinners.
- **`pulse-soft` 2 s infinite** for the "rolls in queue" badge.
- **Dice result panel** slides up from the bottom-right with an overshoot ease
  (`cubic-bezier(0.175, 0.885, 0.32, 1.275)`).

### Hover & press states

- **Buttons.** Primary hover: deeper purple + arcane glow shadow. Secondary hover:
  surface lightens, border brightens to `--color-text-muted`. Danger hover: brighter
  rose + 30 %-opacity glow.
- **Icon buttons** lift 1 px on hover and gain a primary-light border.
- **Cards** translate up 2 px and reveal the gradient accent bar.
- **Press** generally compresses to `scale(0.95)` (dice buttons); other buttons rely on
  the OS active state.

### Borders, radii, shadows

- **Radii:** 4 / 8 / 12 / 16 px. Buttons and inputs are 8 px (`--radius-md`).
  Cards and modals are 12 / 16 px. The dice toolbar is a 50 px **pill**, the only
  fully-rounded element, and the dice result panel is `100px` (also pill-shaped).
- **Borders are 1 px hairlines** on `--color-border`. Combat sections use a 2 px **bottom**
  border in their affinity color.
- **Shadow scale:** sm / md / lg in increasing y-offset and opacity. **`--shadow-glow`**
  is a 20 px arcane-purple aura — the brand's signature elevation, used on:
  - the welcome emblem
  - hovered campaign cards
  - the ROLL button
  - the primary `.btn--primary:hover` state.

### Transparency & blur

Used **only on overlays and the dice toolbar**. The codebase establishes a clear rule:
solid surfaces for everything that holds data, blur+translucency only for ephemeral chrome
that floats above content. The dice result panel and 3D dice canvas overlay both follow
this rule.

### Imagery vibe

When user-supplied images appear (scene backgrounds, character portraits), they are
treated **warm and high-contrast**. The scene hero applies a darkening overlay so titles
remain legible. Character avatars are 60 × 60 with a 1 px border in the surface palette,
making the user's content read as belonging to the dark UI.

### Layout rules

- **Three-zone shell:** 260 px sidebar + flex main view + 24 px status bar.
- **Content max-width 1200 px** for grids (campaigns, characters), 900 px for detail
  views, 520 px for standard modals.
- **Encounter manager** is a three-column flex with affinity-colored section headers.
- **Modals** anchor to the top (60 px from top), not centered — feels less heavy.
- **Toasts pin bottom-right** with stacking; **dice result panel** also bottom-right
  but overlaid above modals.
- **No horizontal centering of content inside `.main-view`.** With a permanent 260 px
  sidebar, `margin: 0 auto` + `max-width` on a feature's root container creates an island
  shifted away from the true optical center — the sidebar already displaces the axis.
  Feature views must fill 100% of the available width, with lateral breathing room
  delivered via spacing tokens (`var(--space-6)` / `var(--space-8)`). Width constraints
  for readability (e.g. long-form text blocks) apply only to inner elements, never to the
  root container.

---

## Iconography

**Iconography is moving to [Lucide](https://lucide.dev) (next commit).** Earlier builds
of the app used Unicode emoji inline in JSX/HTML strings; that approach is being phased
out in favor of a single coherent stroke icon set. Going forward, **all new UI must use
Lucide** — never emoji.

- **Style:** 24 × 24 viewBox, 2 px stroke, `currentColor`, rounded line caps and joins.
- **Sizing:** 16 px in dense table rows, 18 px in inline buttons, 20 px in the sidebar,
  24 px+ for empty-state hero icons. Don't scale below 14 px.
- **Color:** inherit `currentColor` from the surrounding text. Only the dice toolbar
  swaps to `--color-primary` when a die is selected, matching the existing glow rule.
- **Install:** `npm i lucide` (vanilla codebase) or copy raw SVG strings from
  lucide.dev. Either way, render as inline `<svg>` so styles cascade naturally.

**The exception that stays:** the six dice (d4, d6, d8, d10, d12, d20) ship as PNG raster
icons at `src/assets/images/dices/`. They are rendered at 28 × 28 inside the dice toolbar
buttons with a `drop-shadow(0 2px 4px rgba(0,0,0,0.3))`, and an active-state glow swaps
the shadow color to the primary green. d100 reuses the d10 PNG. These PNGs have been
copied into `assets/dice/` here.

The **3D dice rolling canvas** (`@3d-dice/dice-box`) loads its own textures from
`public/dice-box/themes/default/` — not part of the static design system.

**Recommendations for new work.** Pick the Lucide glyph closest to the action's
semantics. If nothing fits, ask before introducing a new icon — don't hand-roll SVG
illustrations (dragons, swords, dice). The brand emblem is the only piece of illustration
in the system.

The active vocabulary, mapped to Lucide names (use these exact icons so the app stays
consistent):

| Action / concept | Lucide icon |
| --- | --- |
| Save | `save` |
| Edit | `edit-3` (pencil) |
| Delete / clear | `trash-2` |
| Add | `plus` |
| Back / forward | `arrow-left` / `arrow-right` |
| File / upload | `folder`, `upload` |
| Camera / image | `camera` |
| Notes | `file-text` |
| History / time | `history` |
| Roll dice | `zap` (the ROLL action) |
| Dice generic | `dice-5` |
| Combat start | `swords` |
| Combat end | `flag` |
| Death save | `skull` |
| Music | `music` |
| Present to players | `video` (or `presentation`) |
| Campaigns | `castle` (or `book-marked`) |
| Characters | wizard composite — `sparkles` + `user`; **commission a custom glyph if budget allows** |
| Scenes | `eye` |
| Spells | `scroll` |
| Items | `backpack` |
| Map | `map` |
| Person / placeholder portrait | `user` |
| Settings | `settings` |

---

## Caveats / known gaps

- **No Figma** was provided; tokens are derived from CSS only. If a Figma library exists,
  surface it and we can reconcile.
- **Fonts are bundled locally** as `.otf` in `/fonts` (Nodesto Caps Condensed for
  display, Scaly Sans for body, each with Regular/Italic/Bold/Bold-Italic). JetBrains
  Mono still loads from Google Fonts; if the team wants it offline too, self-host.
- The codebase is heavy on **emoji-as-icons**. If the team ever wants a unified icon
  system, that's a separate, larger design decision — flagged but not solved here.
- **Spells, items, and journal features are listed as "planned"** in the upstream README;
  no UI exists for them yet, so the UI kit only covers shipped surfaces.

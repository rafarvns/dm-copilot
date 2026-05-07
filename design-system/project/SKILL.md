# DM Copilot Design System — agent skill

When a user wants to design a feature, screen, or marketing surface for **DM Copilot**, load this folder. It captures the brand, content voice, visual foundations, and component vocabulary used in the live Electron app.

## Read first

1. `README.md` — product context (Portuguese, TTRPG-DM tool), content fundamentals (voice, casing, microcopy, emoji policy), visual foundations (mood, color, type, spacing, motion, transparency, layout), iconography rules.
2. `colors_and_type.css` — canonical tokens. Import or copy values from here, never invent new ones unless the README says you may.

## Then, depending on the work

- **Designing a new desktop screen / dialog / modal** → read `ui_kits/desktop_app/README.md`, then the relevant component file in that folder. The styles in `ui_kits/desktop_app/styles.css` are a faithful subset of the renderer's real CSS — treat them as the source of truth for layout patterns.
- **Adding an icon** → use Unicode emoji that matches the table in `README.md` § Iconography. Lucide is the only acceptable fallback, and you must flag it to the user.
- **Adding a die or dice-related UI** → the d4–d20 PNGs live in `assets/dice/`. Don't draw new dice in SVG.
- **Writing copy** → Portuguese (pt-BR), informal *você*, Title Case headings, sentence case helpers, short imperative buttons. D&D jargon (HP, AC, CA, Iniciativa, Encontro, etc.) is preserved untranslated.
- **Picking a color outside the palette** → don't. The combat-affinity greens/yellows/reds are the only saturated colors permitted alongside arcane purple + gold.

## Cards in the Design System tab

Every preview card in `preview/` is a self-contained HTML rendering of one foundation or component. Use these as the authoritative visual reference when you're not running the full UI kit.

## Don't

- Don't add gradients to surfaces — only the brand emblem and the ROLL button use them.
- Don't add new fonts. Cinzel + Inter + JetBrains Mono is the full set.
- Don't centre modals — they anchor 60 px from the top.
- Don't translate the D&D vocabulary.
- Don't switch the app to light mode. There isn't one.

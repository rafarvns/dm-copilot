# Desktop app — UI kit

A clickable hi-fi recreation of DM Copilot's renderer process, built as React
components (vanilla JS in the real app — React here just for the kit demo).

**Open `index.html`** to navigate the kit.

## Surfaces included

| Surface | File | Notes |
| --- | --- | --- |
| App shell + sidebar | `Sidebar.jsx`, `App.jsx` | 260 px sidebar with grouped nav |
| **Campaigns** dashboard | `CampaignsView.jsx`, `CampaignCard.jsx` | Search + system filter + grid |
| Campaign detail | `CampaignDetailView.jsx` | Header + stats row + nested encounters grid |
| **Characters** grid | `CharactersView.jsx` | Avatar + HP/AC/INI stat boxes |
| **Encounter** combat overlay | `EncounterView.jsx`, `ParticipantCard.jsx` | Dice toolbar + 3 affinity columns + round counter |
| Dice toolbar | `DiceToolbar.jsx` | Translucent pill, active counters, roll button |

## How to use

- `index.html` boots an in-browser React app via Babel.
- All component files attach themselves to `window` so the demo's other scripts
  can reach them (no module bundler).
- The CSS in `styles.css` ports the relevant subset of
  `src/renderer/src/assets/main.css` and imports `../../colors_and_type.css` for
  tokens — every color/spacing/radius/shadow value comes from the design system.

## Caveats

- The real app uses **vanilla JS** (no framework). When porting components back
  into the codebase, treat these JSX trees as a structural reference — the
  class names, layout, and copy match the live CSS one-to-one.
- The 3D dice canvas (`@3d-dice/dice-box`) is not recreated here. Rolling in
  the demo just updates the "Último Resultado" badge.
- "Cenas conectadas" / scene presenter view, settings, journal, and the
  spells/items catalog are not yet implemented in the upstream codebase, so
  they aren't in the kit either — clicking those nav items shows a clearly
  labelled "em breve" empty state.

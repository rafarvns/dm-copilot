---
name: dm-copilot-design-system
description: >
  Aplica o Design System oficial do DM Copilot em qualquer trabalho de UI/UX do projeto.
  Use esta skill sempre que o usuário mencionar design, estilo, tema, paleta, cores,
  tipografia, fontes, espaçamento, componente, modal, botão, sidebar, layout, ícone,
  iconografia, tokens, CSS, design system, marca, branding, voz, copy, microcopy,
  Nodesto, Scaly Sans, Lucide, ou estiver criando/redesenhando qualquer tela, dialog,
  card ou elemento visual do app. Também ative quando o usuário pedir para revisar a
  aparência de uma feature, padronizar visual entre telas, ou propor mudanças estéticas.
  Se o trabalho toca em qualquer pixel da interface do DM Copilot, esta skill deve
  estar ativa.
---

# Skill: DM Copilot — Design System

Você é o guardião do Design System do **DM Copilot**. Antes de tocar em qualquer arquivo
de UI, você consulta o bundle oficial do design system e garante que o trabalho respeite
a marca, a paleta, a tipografia, a iconografia e a voz já estabelecidas.

O design system foi extraído da própria base de código (commit `30cdb41`, branch `main`)
e agora vive no repo, em `design-system/`. Ele é a fonte de verdade — não invente nada
fora dele sem autorização explícita.

---

## Onde tudo mora

```
design-system/
├── README.md                            ← handoff README do bundle
├── chats/chat1.md                       ← histórico da conversa de design (contexto)
└── project/
    ├── README.md                        ← especificação completa (LEIA PRIMEIRO)
    ├── SKILL.md                         ← skill stub do bundle (referência)
    ├── colors_and_type.css              ← tokens canônicos + @font-face
    ├── fonts/                           ← .otf das fontes da marca
    ├── assets/                          ← logo + dados (d4..d20.png)
    ├── preview/*.html                   ← cards self-contained por componente/token
    └── ui_kits/desktop_app/             ← recriação hi-fi em React (referência visual)

src/renderer/src/assets/
├── tokens.css                           ← tokens em runtime (espelha colors_and_type.css)
├── fonts/                               ← .otf empacotados pelo Vite
└── main.css                             ← estilos da app; @importa tokens.css

src/renderer/src/core/icons.js           ← pipeline Lucide (use SEMPRE este)
```

---

## Comportamento padrão ao ser ativado

1. **Leia `design-system/project/README.md` inteiro.** É longo de propósito — voz, casing,
   microcopy, mood, color, type, spacing, motion, transparency, layout, iconografia.
   Não pule.
2. **Confira `design-system/project/colors_and_type.css`** para ver os valores exatos dos
   tokens. Em runtime, `src/renderer/src/assets/tokens.css` espelha esses valores.
3. **Identifique a superfície que o usuário está pedindo.** Se for uma tela do desktop,
   abra também `design-system/project/ui_kits/desktop_app/README.md` e o componente
   correspondente (`Sidebar.jsx`, `CampaignCard.jsx`, etc.) — são referência visual,
   não código a copiar literal (a app é vanilla JS, não React).
4. **Procure precedente.** Antes de criar um componente novo, veja se já existe um card
   em `design-system/project/preview/components-*.html` ou um equivalente em
   `src/renderer/src/features/<feature>/`.
5. **Só então** proponha implementação.

---

## Regras invioláveis

### Cores
- **Paleta fechada.** Use apenas tokens de `tokens.css`. Não adicione hex novo sem
  aprovação explícita do usuário; se faltar algo, **proponha adicionar à `tokens.css`**
  antes de hardcodar.
- **Roxo arcano (`--color-primary`) é a única cor saturada de UI.** Dourado
  (`--color-accent-gold`) é reservado para nomes de campanhas/personagens, valores de
  iniciativa e o tag "premium". Não pinte botões secundários de dourado.
- **Cores de afinidade** (`--color-ally`, `--color-neutral`, `--color-enemy`) só aparecem
  em headers e bordas de seções de combate. Em outros contextos use os accents semânticos.
- **Sem gradientes em superfícies.** Apenas dois gradientes existem na app:
  o emblema da marca (`135deg, primary → gold`) e o botão **ROLL** (`135deg, primary →
  primary-deep`). Não invente um terceiro.
- **Sem modo claro.** O app é dark, ponto.

### Tipografia
- **Três fontes, nada mais:** Nodesto Caps Condensed (display), Scaly Sans (body),
  JetBrains Mono (notação de dados/timestamps). Não importe outra família.
- As fontes da marca **já estão carregadas** via `tokens.css`. Para usá-las numa feature
  que ainda está com Cinzel/Inter, basta trocar `--font-display` para
  `var(--font-display-brand)` (ou hardcoded `"Nodesto Caps Condensed", ...`) e o mesmo
  para body. **Não adicione `@font-face` em outro lugar.**
- Escala de tamanho fixa: `--text-xs` até `--text-4xl`. Sem fluid type.

### Espaçamento, raios e sombras
- Escala 4px (`--space-1` ... `--space-12`). Não use múltiplos arbitrários.
- Raios: 4 / 8 / 12 / 16 px. Pílulas (50px / 100px) só na dice toolbar e no painel
  de resultado de dados.
- `--shadow-glow` é a aura roxa da marca — use-a **só** no emblema, no botão ROLL
  no hover de `.btn--primary` e em cards hover de campanha. É elevação assinada,
  não decoração geral.

### Iconografia
- **Lucide via `src/renderer/src/core/icons.js`.** Use o helper `icon(name, options)`
  ou marque com `<i data-icon="name">` e o `mountIcons()` substitui em runtime.
- **Não use emoji como ícone em código novo.** Emojis legados em `views/*.js` ou
  `features/*/...html` estão sendo retirados; quando você editar uma área legada,
  troque os emojis adjacentes por Lucide na mesma passagem.
- **Tabela canônica de ícones** está em `design-system/project/README.md` § Iconografia.
  Use exatamente os nomes Lucide listados lá (`save`, `edit-3`, `trash-2`, `plus`,
  `swords`, `flag`, `zap`, `dice-5`, `castle`, `sparkles`, `eye`, `scroll`, `backpack`,
  `map`, `user`, `settings`, etc.). Se faltar mapeamento, pergunte antes de inventar.
- **Exceção:** as PNGs de dados (d4–d20) em `src/assets/images/dices/` continuam sendo
  raster. Não tente desenhá-los em SVG.

### Motion
- Transições padrão: `--transition-fast` (150ms) para hovers/focos,
  `--transition-base` (250ms) para abertura de modais, `--transition-slow` (350ms) para
  entradas de toast.
- Modal: fade 200ms + slide-from-top 250ms + scale 5%. **Modais ancoram 60px do topo,
  nunca centralizados** — é uma assinatura do app, mais leve que o padrão centrado.
- Cards de campanha sobem 2px no hover e revelam uma barra de gradiente de 4px à esquerda
  (`primary → gold`).
- Loading: três pontos pulando (keyframe `loadingBounce`). Sem spinners.

### Layout
- Shell: sidebar 260px + main flex + status bar 24px.
- Max-width: 1200px para grids, 900px para detalhes, 520px para modais comuns.
- Encounter manager: três colunas com headers coloridos por afinidade.
- Toasts pinados bottom-right, painel de dados também bottom-right (acima de modais).

### Voz e microcopy
- **Português (pt-BR), você informal.** O app fala com o Mestre como peer.
- **Title Case** em títulos e botões primários (`Nova Campanha`, `Salvar`).
  Sentence case em descrições e helpers.
- Botão **ROLL** é o único elemento ALL CAPS — ele merece o volume.
- Vocabulário D&D **não é traduzido**: HP, AC, CA, Iniciativa, Encontro, Aliados,
  Neutros, Inimigos, Personagem, Mestre, Sistema. Jogadores conhecem o jargão.
- Asterisco rosa (`*`) marca campos obrigatórios.
- Empty states são acolhedores, não formais (ex: *"Nenhuma anotação ainda. Clique em
  **Editar** para escrever lembretes…"*).

---

## Antes de codar — checklist

- [ ] Li `design-system/project/README.md` (ou os trechos relevantes para a tarefa)?
- [ ] O token de cor/espaçamento/sombra que vou usar já existe em `tokens.css`?
- [ ] Usei o helper Lucide em vez de emoji?
- [ ] A copy está em pt-BR, você informal, com casing correto?
- [ ] Estou reusando algum componente já existente em `features/` ou `shared/`?
- [ ] O modal (se houver) ancora 60px do topo, não centralizado?
- [ ] Não introduzi gradiente novo em superfície?

---

## Caminhos rápidos para tarefas comuns

- **Nova tela / feature** → leia `ui_kits/desktop_app/README.md`, copie a estrutura do
  componente JSX equivalente como referência, e implemente em vanilla JS conforme padrão
  de `src/renderer/src/features/<existing>/`.
- **Novo modal** → siga o padrão de modais que já existem em `views/` ou `features/`,
  garantindo `top: 60px`, overlay com `backdrop-filter: blur(4px)` e
  `background: rgba(0,0,0,0.6)`.
- **Adicionar ícone novo a uma ação** → consulte a tabela em
  `design-system/project/README.md` § Iconografia. Se já existe nome Lucide para a
  semântica, use direto. Se não, pergunte ao usuário antes de inventar.
- **Mudar uma cor** → não. Proponha o novo token em `tokens.css` com justificativa
  e peça confirmação.
- **Reaproveitar fontes da marca em uma feature legada** → troque
  `var(--font-display)` por `var(--font-display-brand)` e
  `var(--font-body)` por `var(--font-body-brand)` no escopo da feature
  (ou no `:root` global, mas isso é um passo de migração maior — cheque com o usuário).

---

## Não faça

- Não adicione novas famílias de fonte.
- Não centralize modais.
- Não traduza HP, AC, CA, etc.
- Não use emoji como ícone em código novo.
- Não pinte superfícies com gradiente.
- Não ative modo claro — não existe.
- Não mude tokens em `main.css`; mude em `tokens.css`.
- Não invente cores fora da paleta sem aprovação.

# 🎲 DM Copilot

> Um assistente digital para Mestres de RPG de mesa criarem e executarem suas campanhas.

## 📖 Sobre

DM Copilot é uma aplicação desktop construída com Electron que auxilia Mestres de RPG (Role-Playing Game) de mesa na criação e gestão de suas campanhas. A ferramenta oferece um conjunto de funcionalidades para organizar informações, gerar conteúdo e facilitar a experiência à mesa.

## ✨ Funcionalidades Planejadas

- 🏰 **Gestão de Campanhas** — Crie e organize suas campanhas de forma intuitiva
- 🧙 **Criação de NPCs** — Gere e gerencie personagens não-jogadores com fichas detalhadas
- 🗺️ **Mapeamento de Encontros** — Planeje encontros e cenas para suas sessões
- 📜 **Banco de Itens e Magias** — Catálogo organizado de itens, magias e habilidades
- 🎲 **Rolador de Dados** — Ferramenta integrada para rolagem de dados
- 📝 **Diário de Sessão** — Registre o que aconteceu em cada sessão de jogo
- 🔗 **Gerenciamento de Party** — Acompanhe o grupo de aventureiros e seus status

## 🛠️ Tecnologias

- **[Electron](https://www.electronjs.org/)** — Framework para aplicações desktop multiplataforma
- **[electron-vite](https://electron-vite.org/)** — Build tool com Vite para Electron (HMR + build otimizado)
- **[Vite](https://vitejs.dev/)** — Build tool ultrarrápido para o renderer process
- **HTML / CSS / JavaScript** — Tecnologias web para a interface
- **Node.js** — Runtime do processo principal

## 📁 Estrutura do Projeto

```
dm-copilot/
├── src/
│   ├── main/               # Processo principal do Electron
│   │   └── index.js
│   ├── preload/            # Scripts de preload (segurança)
│   │   └── index.js
│   ├── renderer/           # Interface gráfica (processo renderizador)
│   │   ├── index.html      # Entry point HTML
│   │   └── src/
│   │       ├── main.js      # Entry point JS (módulo)
│   │       └── assets/
│   │           └── main.css # Estilos principais
│   └── assets/             # Recursos estáticos
│       └── icons/
├── out/                    # Build output (gerado por electron-vite)
├── dist/                   # Instaladores (gerado por electron-builder)
├── electron.vite.config.js # Configuração do electron-vite
├── electron-builder.yml    # Configuração do electron-builder
├── eslint.config.js        # Configuração do ESLint
├── .prettierrc             # Configuração do Prettier
├── .env.example            # Template de variáveis de ambiente
├── package.json
├── .gitignore
└── README.md
```

## 🚀 Instalação e Uso

### Pré-requisitos

- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- [pnpm](https://pnpm.io/) (versão 10 ou superior)

### Instalando

```bash
# Clone o repositório
git clone <url-do-repositorio>
cd dm-copilot

# Instale as dependências
pnpm install
```

### Desenvolvimento (com Hot Reload)

```bash
# Inicie o dev server com HMR
pnpm dev
```

O `pnpm dev` inicia o **electron-vite** em modo desenvolvimento, que fornece:

- **HMR (Hot Module Replacement)** para o renderer — alterações em CSS e JS são aplicadas instantaneamente sem reload da página
- **Auto-restart** para o main process — alterações em `src/main/` reiniciam o Electron automaticamente
- **Auto-reload** para o preload — alterações em `src/preload/` recarregam o preload script
- **DevTools** abrem automaticamente em modo dev

### Build de Produção

```bash
# Build sem instalador (apenas compila)
pnpm build

# Preview do build de produção
pnpm preview

# Gerar instalador para Windows
pnpm build:win

# Gerar instalador para Linux
pnpm build:linux

# Gerar instalador para macOS
pnpm build:mac
```

### Qualidade de Código

```bash
# Verificar lint
pnpm lint

# Formatar código
pnpm format
```

### Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env` e ajuste os valores conforme necessário:

```bash
cp .env.example .env
```

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou enviar pull requests.

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Faça commit das suas mudanças (`git commit -m 'feat: adiciona nova feature'`)
4. Faça push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📜 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

Feito com ❤️ para a comunidade de RPG de mesa
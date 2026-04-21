# Sistema de Banco de Dados - DM Copilot

## Visão Geral

O DM Copilot utiliza SQLite (através do `better-sqlite3`) para armazenamento persistente de dados. O sistema foi projetado com foco em performance, segurança e facilidade de uso.

## Estrutura do Projeto

```
src/main/database/
├── DatabaseManager.js      # Gerenciador principal de conexões
├── config.js               # Configurações e constantes
├── migrations/             # Scripts de migração de schema
│   └── init.js             # Migration inicial
├── queries/                # Queries encapsuladas por entidade
│   ├── campaigns.js
│   ├── characters.js
│   ├── encounters.js
│   └── notes.js
└── README.md               # Este arquivo
```

## Como Funciona

### 1. DatabaseManager
Gerencia a conexão única com o banco de dados (padrão Singleton). Responsável por:
- Inicializar a conexão
- Executar migrations
- Criar backups
- Gerenciar o ciclo de vida da conexão

### 2. Migrations
Scripts que evoluem o schema do banco de dados. Cada migration tem:
- `version`: Número da versão
- `name`: Descrição da migration
- `up()`: Aplica as mudanças
- `down()`: Reverte as mudanças (opcional)

### 3. Queries
Funções encapsuladas que realizam operações CRUD. Cada arquivo em `queries/` lida com uma entidade:
- `campaigns.js`: Operações com campanhas
- `characters.js`: Operações com personagens
- `encounters.js`: Operações com encontros
- `notes.js`: Operações com notas

### 4. IPC Handlers
O `main/index.js` expõe handlers IPC para que o renderer possa acessar o banco de dados de forma segura.

### 5. DatabaseService (Renderer)
Classe JavaScript no renderer que fornece uma API amigável para acessar o banco de dados.

## Schema do Banco de Dados

### Tabela: campaigns
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
name            TEXT NOT NULL
description     TEXT
system          TEXT
created_at      TEXT NOT NULL
updated_at      TEXT
```

### Tabela: characters
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
campaign_id     INTEGER NOT NULL
name            TEXT NOT NULL
class           TEXT
level           INTEGER DEFAULT 1
race            TEXT
hp              INTEGER
max_hp          INTEGER
attributes      TEXT (JSON)
created_at      TEXT NOT NULL
updated_at      TEXT
FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
```

### Tabela: encounters
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
campaign_id     INTEGER NOT NULL
name            TEXT NOT NULL
description     TEXT
difficulty      TEXT
monsters        TEXT (JSON)
created_at      TEXT NOT NULL
updated_at      TEXT
FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
```

### Tabela: notes
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
campaign_id     INTEGER NOT NULL
title           TEXT NOT NULL
content         TEXT
created_at      TEXT NOT NULL
updated_at      TEXT
FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
```

### Tabela: settings
```sql
key             TEXT PRIMARY KEY
value           TEXT
updated_at      TEXT NOT NULL
```

### Tabela: schema_migrations
```sql
version         INTEGER PRIMARY KEY
migrated_at     TEXT NOT NULL
```

## Uso no Renderer

### Inicialização
```javascript
import databaseService from "./db/database.js";

async function init() {
  const ready = await databaseService.init();
  if (ready) {
    console.log("Database is ready!");
  }
}
```

### Criar Campanha
```javascript
const campaign = await databaseService.createCampaign({
  name: "Minha Campanha",
  description: "Uma campanha épica",
  system: "D&D 5e"
});
```

### Listar Campanhas
```javascript
const campaigns = await databaseService.getAllCampaigns();
console.log(campaigns);
```

### Criar Personagem
```javascript
const character = await databaseService.createCharacter({
  campaign_id: campaignId,
  name: "Herói",
  class: "Paladino",
  level: 1,
  race: "Humano",
  hp: 40,
  max_hp: 40,
  attributes: {
    strength: 16,
    dexterity: 14,
    constitution: 14,
    intelligence: 12,
    wisdom: 10,
    charisma: 13
  }
});
```

### Criar Encontro
```javascript
const encounter = await databaseService.createEncounter({
  campaign_id: campaignId,
  name: "Batalha Final",
  description: "Confronto com o vilão",
  difficulty: "hard",
  monsters: [
    { name: "Vilão", hp: 200, ac: 18 },
    { name: "Minion", hp: 30, ac: 12 }
  ]
});
```

### Criar Nota
```javascript
const note = await databaseService.createNote({
  campaign_id: campaignId,
  title: "Quest Secundária",
  content: "Encontrar a espada mágica"
});
```

### Backup
```javascript
const backupPath = await databaseService.backup();
console.log("Backup created:", backupPath);
```

## Boas Práticas

### 1. Sempre verificar se o banco está pronto
```javascript
if (databaseService.isReady()) {
  // Fazer operações
}
```

### 2. Usar prepared statements (já implementado nas queries)
As queries já usam prepared statements para evitar SQL injection.

### 3. Transações para operações múltiplas
```javascript
// O DatabaseManager já usa transações internamente
// Para operações que precisam de atomicidade:
db.transaction(() => {
  // múltiplas operações
})();
```

### 4. Tratamento de erros
```javascript
try {
  const result = await databaseService.createCampaign(data);
} catch (error) {
  console.error("Failed to create campaign:", error);
}
```

### 5. Limpeza de dados
Quando uma campanha é deletada, todos os personagens, encontros e notas associados são automaticamente deletados (graças ao `ON DELETE CASCADE`).

## Adicionando Novas Funcionalidades

### 1. Criar nova migration
```javascript
// src/main/database/migrations/v2_new_feature.js
const version = 2;
const name = "Add new feature";

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS new_table (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )
  `);
}

function down(db) {
  db.exec("DROP TABLE IF EXISTS new_table");
}

module.exports = { version, name, up, down };
```

### 2. Criar novas queries
```javascript
// src/main/database/queries/new_feature.js
export function createNewFeature(db, data) {
  const stmt = db.prepare(`INSERT INTO new_table (name) VALUES (?)`);
  return stmt.run(data.name);
}

export function getAllNewFeatures(db) {
  const stmt = db.prepare(`SELECT * FROM new_table`);
  return stmt.all();
}
```

### 3. Adicionar IPC handlers
```javascript
// src/main/index.js
ipcMain.handle("db-new-feature-create", (_event, data) => {
  const db = databaseManager.getConnection();
  const { createNewFeature } = require("./database/queries/new_feature");
  return createNewFeature(db, data);
});
```

### 4. Expôr no preload
```javascript
// src/preload/index.js
contextBridge.exposeInMainWorld("dmCopilot", {
  db: {
    newFeature: {
      create: (data) => ipcRenderer.invoke("db-new-feature-create", data),
      getAll: () => ipcRenderer.invoke("db-new-feature-read-all"),
    }
  }
});
```

### 5. Usar no renderer
```javascript
// src/renderer/src/db/database.js
async createNewFeature(data) {
  return await window.dmCopilot.db.newFeature.create(data);
}
```

## Troubleshooting

### Erro: "Database not initialized"
Certifique-se de chamar `databaseService.init()` antes de usar o banco de dados.

### Erro: "Failed to open database"
Verifique se o diretório de dados do usuário existe e tem permissões de escrita.

### Erro: "Foreign key constraint failed"
Verifique se está tentando deletar uma campanha que ainda tem personagens/encontros/notas associados.

### Banco corrompido
O SQLite tem mecanismos de recuperação automática. Se o problema persistir:
1. Feche o app
2. Delete o arquivo `.db` e `.db-wal` no diretório de dados
3. Reabra o app (o banco será recriado)

## Performance

### WAL Mode
O banco está configurado para usar WAL (Write-Ahead Logging) mode, que permite:
- Múltiplas leituras simultâneas
- Leituras enquanto escreve
- Melhor concorrência

### Índices
Índices são criados automaticamente para colunas de foreign keys:
- `idx_characters_campaign_id`
- `idx_encounters_campaign_id`
- `idx_notes_campaign_id`

### VACUUM
Para compactar o banco e reclaim space:
```sql
VACUUM;
```

## Segurança

### Dados Sensíveis
Não armazene dados sensíveis (senhas, tokens) em plaintext. Considere usar criptografia (SQLCipher) para dados sensíveis.

### SQL Injection
Todas as queries usam prepared statements, o que previne SQL injection.

### Acesso ao Banco
O banco só pode ser acessado através do main process, nunca diretamente do renderer.

## Licença

MIT License - Veja LICENSE para mais detalhes.

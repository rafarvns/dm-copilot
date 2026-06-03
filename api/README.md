# dmc-api

API de validação e administração de chaves de produto do **DM Copilot**.

Substitui o stub `_validateKeyStub` em `../src/main/services/license-manager.js`. O app desktop chama `POST /activate` durante a ativação; o backoffice usa os endpoints `/admin/keys` para gerar/listar/revogar chaves.

## Stack

- Go 1.22+ (router `net/http` stdlib, pattern matching nativo)
- PostgreSQL 15+ via `database/sql` + driver `jackc/pgx/v5/stdlib`
- Sem ORM. Queries parametrizadas (`$1`, `$2`)
- Logs JSON via `log/slog` stdlib
- Docker multi-stage com runtime distroless

## Endpoints

### Públicos

| Método | Path | Sucesso | Erros |
|---|---|---|---|
| `POST` | `/activate` | 200 `{"ok":true,"activatedAt":"..."}` | 400 `BAD_REQUEST` / `INVALID_FORMAT`, 404 `INVALID_KEY`, 403 `KEY_REVOKED`, 409 `ALREADY_ACTIVATED_ON_OTHER_MACHINE` |
| `POST` | `/deactivate` | 200 `{"ok":true}` (sempre — noop silencioso se machineId não casa) | 400 `BAD_REQUEST` |
| `GET` | `/health` | 200 `{"status":"ok"}` | 503 se ping no DB falha |

Corpo de `/activate` e `/deactivate`:

```json
{ "key": "DMC-XXXX-XXXX-XXXX", "machineId": "<hash do node-machine-id>" }
```

### Admin (header `X-Admin-Key` obrigatório)

| Método | Path | Resposta |
|---|---|---|
| `POST` | `/admin/keys` | 201 `{"ok":true,"key":"DMC-...","createdAt":"..."}` — corpo opcional `{"customerEmail":"...","notes":"..."}` |
| `GET` | `/admin/keys?page=1&perPage=50` | 200 `{"items":[...],"total":N,"page":1,"perPage":50}` (perPage máx. 200) |
| `GET` | `/admin/keys/{key}` | 200 objeto / 404 `NOT_FOUND` |
| `POST` | `/admin/keys/{key}/revoke` | 200 `{"ok":true}` / 404 `NOT_FOUND` / 409 `ALREADY_REVOKED` |

Sem header ou key errada → 401 `UNAUTHORIZED`. Compare é constant-time (`crypto/subtle`).

## Como rodar

### Local (Postgres em container, API via `go run`)

```bash
docker run --rm -d --name dmc-pg -p 5432:5432 \
  -e POSTGRES_USER=dmc -e POSTGRES_PASSWORD=dmc -e POSTGRES_DB=dmc_licenses \
  postgres:15-alpine

export DATABASE_URL="postgres://dmc:dmc@localhost:5432/dmc_licenses?sslmode=disable"
export ADMIN_API_KEY="dev-only-not-for-prod"
go run .
```

### Tudo via Docker Compose

```bash
cp .env.example .env
# Ajuste ADMIN_API_KEY com: openssl rand -base64 32
docker compose up --build
```

## Smoke test (sequência completa)

```bash
ADMIN="dev-only-not-for-prod"

# 1. Health
curl http://localhost:8080/health
# → {"status":"ok"}

# 2. Admin cria
curl -s -X POST http://localhost:8080/admin/keys \
  -H "X-Admin-Key: $ADMIN" -H "Content-Type: application/json" \
  -d '{"customerEmail":"rafarvns@gmail.com","notes":"smoke"}'
# → {"ok":true,"key":"DMC-XXXX-XXXX-XXXX","createdAt":"..."}

# 3. Ativa primeira vez
KEY="DMC-XXXX-XXXX-XXXX"
curl -s -X POST http://localhost:8080/activate \
  -H "Content-Type: application/json" \
  -d "{\"key\":\"$KEY\",\"machineId\":\"machine-A\"}"
# → {"ok":true,"activatedAt":"..."}

# 4. Re-ativa (idempotente)
# → mesma resposta, mesmo activatedAt

# 5. Máquina B tenta
curl -s -X POST http://localhost:8080/activate \
  -H "Content-Type: application/json" \
  -d "{\"key\":\"$KEY\",\"machineId\":\"machine-B\"}"
# → HTTP 409 {"ok":false,"error":"ALREADY_ACTIVATED_ON_OTHER_MACHINE"}

# 6. Chave inexistente
curl -s -X POST http://localhost:8080/activate \
  -H "Content-Type: application/json" \
  -d '{"key":"DMC-NONE-NONE-NONE","machineId":"machine-X"}'
# → HTTP 404 {"ok":false,"error":"INVALID_KEY"}

# 7. Admin revoga
curl -s -X POST "http://localhost:8080/admin/keys/$KEY/revoke" \
  -H "X-Admin-Key: $ADMIN"
# → {"ok":true}

# 8. Pós-revoke
# → HTTP 403 {"ok":false,"error":"KEY_REVOKED"}

# 9. Admin sem header
curl -s -X POST http://localhost:8080/admin/keys -d '{}'
# → HTTP 401 {"ok":false,"error":"UNAUTHORIZED"}
```

## Variáveis de ambiente

| Var | Obrigatória | Default | Descrição |
|---|---|---|---|
| `DATABASE_URL` | sim | — | DSN Postgres: `postgres://user:pass@host:port/db?sslmode=...` |
| `ADMIN_API_KEY` | sim | — | Header `X-Admin-Key`. Gerar: `openssl rand -base64 32` |
| `PORT` | não | `8080` | Porta HTTP |
| `LOG_LEVEL` | não | `info` | `debug` / `info` / `warn` / `error` |
| `READ_TIMEOUT` | não | `5s` | HTTP read timeout |
| `WRITE_TIMEOUT` | não | `10s` | HTTP write timeout |
| `IDLE_TIMEOUT` | não | `60s` | HTTP idle timeout |

Boot falha rápido se `DATABASE_URL` ou `ADMIN_API_KEY` estiverem ausentes.

## Geração e formato de chave

- Formato: `DMC-XXXX-XXXX-XXXX` (17 chars total).
- Alfabeto sem ambiguidades visuais: `ABCDEFGHJKMNPQRSTVWXYZ23456789` (30 chars, sem `0/O/1/I/L/U`).
- ~5,7 × 10¹⁷ chaves possíveis.
- Fonte de entropia: `crypto/rand`.

## Lock 1 chave = 1 máquina

- Primeira ativação grava `machine_id` na chave.
- Ativações subsequentes do **mesmo** `machineId` retornam OK (idempotente, atualiza `last_seen_at`).
- `machineId` diferente → 409 `ALREADY_ACTIVATED_ON_OTHER_MACHINE`.
- A regra é implementada num único `UPDATE ... WHERE machine_id IS NULL OR machine_id = $2` — Postgres serializa concorrentes via row lock.

Para transferir uma chave entre máquinas, o suporte tem duas opções:
- O cliente chama `POST /deactivate` (libera o vínculo).
- Admin chama `POST /admin/keys/{key}/revoke` e gera uma nova chave.

## Segurança

- **SQL injection**: 100% das queries usam placeholders. Nenhum `fmt.Sprintf` em SQL. Comprimento máximo de input validado antes da query.
- **Timing attack**: comparação do admin key via `crypto/subtle.ConstantTimeCompare`.
- **Logs**: chaves nunca aparecem inteiras em logs — só os primeiros 8 chars + reticências (`DMC-XXXX…`).
- **CORS**: omitido. Cliente é Node.js (main process do Electron), não browser. Adicionar middleware específico se surgir painel web.

## Dívidas técnicas conhecidas

- **Rate limiting**: nenhum. Aceitável pra MVP (chaves 2^59 + admin 256 bits). Quando virar problema, adicionar middleware com `golang.org/x/time/rate` por IP.
- **Migrations**: `CREATE TABLE IF NOT EXISTS` direto no boot. Migrar pra `golang-migrate` quando passar de ~5 statements ou precisar de DOWN reversíveis.
- **Enumeração de chaves via erro distinto**: `/activate` retorna códigos diferentes para `INVALID_KEY` vs `KEY_REVOKED` vs `ALREADY_ACTIVATED_ON_OTHER_MACHINE` — intencional pra UX do cliente. Quando rate limiter for adicionado, considerar genericizar.
- **Healthcheck no Dockerfile**: distroless não tem shell pra `HEALTHCHECK CMD wget`. Definir probe no orquestrador (compose / k8s) batendo em `GET /health`.

## Layout

```
api/
├── main.go                       # bootstrap + graceful shutdown
├── go.mod
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .dockerignore
└── internal/
    ├── config/config.go
    ├── db/
    │   ├── db.go                 # Open + pool tuning
    │   ├── schema.go             # CREATE TABLE IF NOT EXISTS
    │   └── keys.go               # Store + CRUD
    ├── keys/
    │   ├── generator.go          # DMC-XXXX-XXXX-XXXX via crypto/rand
    │   └── normalize.go          # trim/upper/regex
    ├── http/
    │   ├── server.go             # rotas + timeouts
    │   ├── middleware.go         # recoverer, requestLog, adminAuth
    │   ├── handlers_public.go    # /activate, /deactivate, /health
    │   ├── handlers_admin.go     # /admin/keys CRUD
    │   └── response.go           # writeJSON, writeError
    └── domain/errors.go          # códigos de erro padronizados
```

# Git Workflow

## Commits Semânticos (Conventional Commits)

```
<tipo>(<escopo opcional>): <descrição curta>

[corpo opcional]

[rodapé opcional]
```

### Tipos
| Tipo | Quando usar |
|------|-------------|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `refactor` | Refatoração sem mudança de comportamento |
| `test` | Adiciona ou corrige testes |
| `docs` | Documentação |
| `chore` | Tarefas de manutenção (deps, config) |
| `perf` | Melhoria de performance |
| `ci` | Mudanças de CI/CD |
| `style` | Formatação, sem mudança de lógica |
| `revert` | Reverte commit anterior |

### Exemplos
```
feat(auth): add JWT refresh token rotation
fix(orders): prevent duplicate order on double-click
refactor(user): extract email validation to value object
test(cart): add unit tests for discount calculation
docs(api): update endpoint documentation for /orders
chore(deps): upgrade typescript to 5.4
perf(query): add index on orders.created_at
```

### Breaking Changes
```
feat(api)!: change response format for /users endpoint

BREAKING CHANGE: response now returns { data: User[] } instead of User[]
```

---

## Estratégia de Branching

### Git Flow (projetos com releases)
```
main          ← produção, sempre estável
develop       ← integração contínua
feature/xxx   ← novas features (branch de develop)
hotfix/xxx    ← correções urgentes em produção (branch de main)
release/x.x.x ← preparação de release
```

### Trunk-Based Development (CI/CD frequente)
```
main                  ← branch principal, sempre deployável
feature/short-lived   ← branches curtas (< 2 dias), merge via PR
```
Prefira Trunk-Based para times que fazem deploy frequente.

---

## Pull Request — boas práticas

### Tamanho ideal
- ✅ < 400 linhas alteradas
- ✅ Uma responsabilidade clara
- ❌ "PR de 2000 linhas" — ninguém revisa direito

### Descrição de PR
```markdown
## O que este PR faz?
[Descrição clara e objetiva]

## Por que essa mudança é necessária?
[Contexto de negócio ou técnico]

## Como testar?
1. [Passo 1]
2. [Passo 2]

## Checklist
- [ ] Testes adicionados/atualizados
- [ ] Documentação atualizada
- [ ] Breaking changes documentados
- [ ] Testado localmente

## Referências
- Issue: #123
- ADR: ADR-005
```

---

## Git — comandos úteis

```bash
# Desfazer último commit mantendo mudanças
git reset --soft HEAD~1

# Stash com nome descritivo
git stash push -m "wip: validação de CEP"

# Rebase interativo para limpar histórico antes de PR
git rebase -i HEAD~3

# Verificar quem alterou uma linha específica
git blame -L 42,52 src/orders/order.service.ts

# Buscar em qual commit um bug foi introduzido
git bisect start
git bisect bad          # commit atual tem o bug
git bisect good v1.0.0  # essa versão estava boa
# git bisect roda e vai apontando commits para testar

# Cherry-pick de commit específico
git cherry-pick <commit-hash>

# Log visual de branches
git log --oneline --graph --all
```

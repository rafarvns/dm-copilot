# Anti-Patterns de Modernização

## Os 7 Pecados Capitais da Modernização

---

### 1. Big Bang Rewrite
**O que é:** Parar tudo, reescrever o sistema do zero, lançar tudo de uma vez.
**Por que falha:** Leva anos, o negócio muda, o legado continua evoluindo enquanto isso,
e o novo sistema entrega com atraso e cheio de regressões.
**Caso famoso:** Netscape 6 — reescreveram o browser do zero e quase faliram a empresa.

```
❌ "Vamos congelar o legado por 18 meses e reescrever tudo"
✅ "Vamos migrar funcionalidade por funcionalidade com o strangler fig"
```

---

### 2. Copiar a Arquitetura Ruim
**O que é:** Reescrever o sistema em linguagem nova, mas mantendo a mesma arquitetura problemática.
**Por que falha:** Você paga o custo de uma reescrita mas continua com os mesmos problemas estruturais.

```
❌ Migrar PHP com procedural puro para Node.js com procedural puro
✅ Aproveitar a migração para introduzir arquitetura em camadas e DDD
```

---

### 3. Modernizar Sem Testes de Segurança
**O que é:** Refatorar ou migrar sem ter testes que garantam que o comportamento foi preservado.
**Por que falha:** Você não sabe se introduziu regressões. O sistema "funciona" mas com comportamentos
diferentes que só aparecem em produção.

```
❌ "Refatorei a classe de cálculo de imposto, parece certo"
✅ "Escrevi testes de caracterização com 50 cenários reais antes de tocar uma linha"
```

---

### 4. Migrar Tudo de Uma Vez (Banco de Dados)
**O que é:** Fazer uma migração de banco de dados massiva em produção sem estratégia de rollback.
**Por que falha:** Uma linha errada em uma migration pode corromper milhões de registros.

```
❌ ALTER TABLE orders DROP COLUMN legacy_status; (sem backup, sem teste)
✅ Expand → Migrate → Validate → Contract (em fases com rollback em cada etapa)
```

---

### 5. Ignorar o Conhecimento Tribal
**O que é:** Reescrever o sistema sem consultar as pessoas que trabalham com ele há anos.
**Por que falha:** O legado acumula "workarounds" que compensam bugs de outros sistemas,
regras de negócio não documentadas, e casos de borda que só o time conhece.

```
Antes de modernizar, entreviste:
- Quem desenvolveu o sistema (se ainda disponível)
- Quem faz suporte e conhece os casos de erro
- Usuários de negócio que conhecem as exceções do processo
```

---

### 6. Modernizar Por Modismo
**O que é:** Adotar microsserviços, Kubernetes, event sourcing etc. porque "é o que se usa hoje",
não porque o problema exige.

```
Perguntas antes de adotar qualquer "arquitetura moderna":
- O problema atual justifica essa complexidade?
- O time tem maturidade para operar isso em produção?
- O custo operacional é sustentável?

❌ "Vamos migrar nosso CRUD de 5 usuários para microsserviços e Kafka"
✅ "Vamos migrar para um monolito modular bem estruturado — que resolve nosso problema"
```

---

### 7. Deixar o Legado Crescer Durante a Migração
**O que é:** Continuar adicionando features no sistema legado enquanto o novo está sendo construído.
**Por que falha:** O alvo se move. Quando o novo sistema fica pronto, o legado está diferente do
que era quando você começou a migrar.

```
Estratégias:
- Feature freeze no legado (ideal, nem sempre possível)
- Qualquer nova feature vai direto no novo sistema
- Se precisar ir no legado, replica no novo sistema imediatamente
- Use feature flags para controlar onde cada funcionalidade roda
```

---

## Sinais de Alerta Durante a Modernização

| Sinal | O que significa | O que fazer |
|-------|----------------|-------------|
| "Só mais uma semana" repetido por meses | Escopo descontrolado | Re-escope, entregue MVP menor |
| Nenhum deploy em produção há 60+ dias | Risco de integração acumulado | Deploy parcial imediato, mesmo que incompleto |
| Time com medo de fazer merge | Branches muito longas | Trunk-based development, feature flags |
| Stakeholders perdendo confiança | Falta de valor visível | Entregue algo utilizável antes de terminar |
| Novo sistema ficando tão complexo quanto o legado | Sem refatoração contínua | Pause features, dedique sprint para qualidade |

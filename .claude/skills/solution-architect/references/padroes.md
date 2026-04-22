# Padrões Arquiteturais

## Padrões de Integração

### API Gateway
Ponto único de entrada para múltiplos serviços.
- Responsabilidades: autenticação, rate limiting, roteamento, logging
- Ferramentas: Kong, AWS API Gateway, Nginx, Traefik
- Cuidado: não coloque lógica de negócio no gateway

### BFF — Backend for Frontend
Um backend dedicado por tipo de cliente (web, mobile, TV).
- Use quando: web e mobile têm necessidades muito diferentes
- Evita: over-fetching e under-fetching de dados

### Strangler Fig Pattern
Substituição gradual de sistema legado.
```
[Cliente] --> [Proxy/Router]
                  |
         [Novo Sistema]  [Sistema Legado]
```
Roteie funcionalidades migradas para o novo sistema progressivamente.

---

## Padrões de Resiliência

### Circuit Breaker
Evita cascata de falhas entre serviços.
```
Estados: Fechado → Aberto → Semi-Aberto
- Fechado: chamadas normais
- Aberto: falhas acima do threshold, retorna erro imediatamente
- Semi-Aberto: testa se serviço voltou
```
Ferramentas: Resilience4j, Hystrix, Polly

### Retry com Exponential Backoff
```
Tentativa 1: aguarda 1s
Tentativa 2: aguarda 2s
Tentativa 3: aguarda 4s
Tentativa 4: aguarda 8s + jitter aleatório
```
Sempre adicione jitter para evitar thundering herd.

### Saga Pattern (para transações distribuídas)
Substitui transações ACID em microsserviços.

**Coreografia:** cada serviço publica eventos e reage a eventos de outros.
**Orquestração:** um orquestrador central coordena os passos.

---

## Padrões de Dados

### CQRS — Command Query Responsibility Segregation
Separa modelo de leitura do modelo de escrita.
```
[Cliente]
   |
   ├── Command --> [Write Model] --> [Event Store / DB Write]
   |                                        |
   └── Query  --> [Read Model]  <-- [Projeção / DB Read]
```
Use quando: leitura e escrita têm padrões de acesso muito distintos.

### Event Sourcing
Armazena eventos em vez de estado atual.
```
Ao invés de: users { id, balance: 500 }
Armazena:
  - AccountCreated { id, balance: 0 }
  - MoneyDeposited { amount: 700 }
  - MoneyWithdrawn { amount: 200 }
  → Estado atual = replay dos eventos
```
Vantagem: auditoria completa, point-in-time recovery.
Desvantagem: complexidade alta, eventual consistency.

### Outbox Pattern
Garante consistência entre salvar no banco e publicar evento.
```
1. Salva entidade + evento na tabela outbox (mesma transação)
2. Worker lê outbox e publica no message broker
3. Marca evento como publicado
```
Evita o problema de "salvou no banco mas não publicou o evento".

---

## Padrões de Deployment

### Blue-Green Deployment
```
[Load Balancer]
      |
  [Blue - v1]  ← produção atual
  [Green - v2] ← nova versão (testando)
```
Switch instantâneo. Rollback imediato se algo der errado.

### Canary Release
Libera nova versão para % pequena do tráfego.
```
95% → [v1]
 5% → [v2] ← monitorando métricas
```
Se métricas OK → aumenta % gradualmente.

### Feature Flags
Habilita funcionalidades sem novo deploy.
Ferramentas: LaunchDarkly, Unleash, Flagsmith
Use para: testes A/B, rollout gradual, kill switch de emergência.

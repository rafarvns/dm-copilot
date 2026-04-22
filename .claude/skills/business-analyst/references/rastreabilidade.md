# Rastreabilidade e Análise de Impacto

## Matriz de Rastreabilidade (RTM)

Conecta requisitos de negócio → requisitos funcionais → casos de teste.

| ID Req. Negócio | Descrição | ID Req. Funcional | ID Caso de Teste | Status |
|-----------------|-----------|-------------------|-----------------|--------|
| RN-001 | [Regra] | RF-001, RF-002 | CT-001, CT-002 | Em desenvolvimento |
| RN-002 | [Regra] | RF-003 | CT-003 | Aprovado |

**Quando usar:** Em projetos com auditoria, regulatório ou alto risco. Garante que nenhum requisito de negócio fique sem implementação ou teste.

---

## Análise de Impacto de Mudança

Quando um requisito muda, avalie:

```
## Análise de Impacto — Mudança em [RN-XXX]

**Mudança:** [Descrição da alteração]
**Solicitante:** [Quem pediu]
**Data:** [Data]

### Impactos Identificados
| Área afetada | Tipo de impacto | Esforço estimado |
|--------------|-----------------|-----------------|
| [Processo X] | [Alto/Médio/Baixo] | [horas/dias] |
| [Sistema Y]  | [Alto/Médio/Baixo] | [horas/dias] |

### Requisitos que precisam ser revisados
- RF-001: [como muda]
- RF-004: [como muda]

### Recomendação
[ ] Aprovar mudança
[ ] Aprovar com ressalvas
[ ] Rejeitar — justificativa: ...
```

---

## Critérios de Aceite de Negócio vs. Critérios de Aceite Técnicos

| Aspecto | Critério de Negócio | Critério Técnico |
|---------|--------------------|--------------------|
| Foco | Processo e resultado para o usuário | Funcionamento do sistema |
| Autor | BA + Stakeholder | Dev + QA |
| Exemplo | "O relatório deve estar disponível em até 5 minutos após o fechamento" | "A query deve retornar em menos de 3 segundos com 10k registros" |

Sempre produza os critérios de negócio antes dos técnicos. Os técnicos derivam dos de negócio.

---

## Níveis de Prioridade de Requisitos

| Prioridade | Critério |
|-----------|---------|
| **Crítico** | Sem isso o processo não funciona ou há risco legal |
| **Alto** | Impacta diretamente a experiência ou resultado do negócio |
| **Médio** | Melhoria relevante, mas processo funciona sem |
| **Baixo** | Desejável, sem impacto imediato |

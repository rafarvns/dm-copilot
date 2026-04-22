# Priorização Avançada de Backlog

## Kano Model
Classifica features pelo impacto na satisfação do usuário:

| Tipo | Descrição | Exemplo |
|------|-----------|---------|
| **Basic** (obrigatório) | Ausência causa insatisfação extrema | App não travar |
| **Performance** (linear) | Mais = melhor satisfação | Velocidade de carregamento |
| **Delighter** (encantador) | Surpresa positiva, não esperada | Animações elegantes |
| **Indifferent** | Não afeta satisfação | Opções raramente usadas |
| **Reverse** | Presença incomoda alguns | Notificações excessivas |

Use Kano quando tiver muitas features e quiser decidir o que realmente encanta vs o que é básico.

## Opportunity Scoring (Jobs to be Done)
1. Liste os "jobs" que o usuário quer realizar
2. Pesquise: quão **importante** é cada job? (1-10)
3. Pesquise: quão **satisfeito** o usuário está hoje? (1-10)
4. Calcule: `Oportunidade = Importância + max(Importância - Satisfação, 0)`
5. Priorize os jobs com maior score de oportunidade

## Story Mapping
Estrutura visual para organizar o backlog:

```
[Atividade 1]         [Atividade 2]         [Atividade 3]
     |                     |                     |
[Tarefa 1.1]          [Tarefa 2.1]          [Tarefa 3.1]
[Tarefa 1.2]          [Tarefa 2.2]          [Tarefa 3.2]
─────────────────── MVP ───────────────────────────────
[Tarefa 1.3]          [Tarefa 2.3]          [Tarefa 3.3]
─────────────────── V2 ────────────────────────────────
```

Atividades = fluxo do usuário da esquerda para a direita
Tarefas = stories empilhadas verticalmente por prioridade
Cortes horizontais = releases/versões

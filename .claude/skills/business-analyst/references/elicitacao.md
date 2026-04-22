# Técnicas de Elicitação de Requisitos

## 1. Entrevista Estruturada
Use quando o stakeholder é experiente e sabe o que quer.

Roteiro base:
- "Me descreva um dia típico lidando com esse processo."
- "Qual é a pior coisa que pode acontecer nesse processo?"
- "Se você pudesse mudar uma coisa amanhã, o que seria?"
- "Quem mais é afetado por esse processo além de você?"

## 2. Cinco Porquês
Use para chegar na causa raiz de um problema.

Exemplo:
- Problema: "O relatório sempre atrasa."
- Por quê? → "Porque o sistema não exporta os dados corretos."
- Por quê? → "Porque o cadastro é feito em duplicidade."
- Por quê? → "Porque dois departamentos alimentam o mesmo dado separadamente."
- Por quê? → "Porque não há processo de integração entre eles."
- Por quê? → **Causa raiz: ausência de sistema integrado ou processo de sincronização.**

## 3. Análise de Documentos Existentes
Peça ao usuário para compartilhar:
- Manuais e procedimentos operacionais
- Planilhas e relatórios usados hoje
- E-mails ou checklists informais
- Fluxogramas (mesmo que desatualizados)

Esses artefatos revelam regras implícitas que ninguém documenta.

## 4. Observação Direta (Shadowing)
Quando possível, peça para o usuário descrever o processo enquanto o executa:
- "Me mostre como você faria isso agora, passo a passo."
- Observe onde ele hesita, volta atrás ou improvisa — esses são os gaps.

## 5. Workshop de Requisitos
Para processos complexos com múltiplos stakeholders:
1. Reúna todos os atores do processo
2. Mapeie o fluxo em conjunto (post-its ou quadro)
3. Identifique divergências de entendimento entre áreas
4. Priorize os pontos de melhoria coletivamente

## 6. Prototipagem de Processo (TO-BE Walkthrough)
Após mapear o TO-BE, apresente-o aos stakeholders e simule:
- "Vamos seguir esse fluxo com um caso real. O que aconteceria em cada etapa?"
- Isso revela inconsistências antes de qualquer desenvolvimento.

## 7. Perguntas para requisitos implícitos
Requisitos implícitos são aqueles que ninguém fala mas todos esperam:

- "O que acontece se [dado crítico] estiver errado?"
- "Há situações de exceção que fogem do fluxo normal?"
- "Quem pode cancelar ou reverter esse processo?"
- "O que acontece quando [ator principal] está ausente?"
- "Existe alguma sazonalidade ou pico de uso?"
- "Há requisitos legais ou regulatórios que precisamos respeitar?"

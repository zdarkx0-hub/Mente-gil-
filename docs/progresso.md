# Progresso, constância e conquistas

## Onde encontrar cada regra

- `shared/achievements.mjs`: catálogo das 11 medalhas, critérios e limites de progresso.
- `shared/practice-streak.mjs`: cálculo puro da sequência diária, calendário e descanso.
- `worker/progress.ts`: consultas privadas ao histórico completo da conta.
- `worker/achievements.ts`: criação e conclusão dos treinos livres.
- `worker/drills.ts`: conclusão dos treinos específicos e salvamento atômico dos erros.
- `app/use-achievement-data.jsx`: uma consulta compartilhada pelo início e pelas conquistas.
- `app/practice-flame.jsx`: apresentação compacta no início e calendário em Conquistas.
- `app/achievements-card.jsx`: apresentação das medalhas, sem lógica de persistência.

As páginas continuam separadas. O layout compartilhado em `app/(study)/layout.jsx`
mantém os treinos em andamento ao navegar, e `app/study-app.jsx` coordena as sessões.

## Constância diária

1. Conta apenas uma sessão concluída e salva com pelo menos 10 respostas, certas
   ou erradas. Login, revisão isolada e duas sessões de 5 respostas não contam.
2. Treinos livres, específicos e ranking usam a mesma sequência. Muitos treinos no
   mesmo dia continuam valendo um dia. O calendário do site é fixo: UTC−3, Brasília.
3. Usa-se a data de conclusão registrada pelo servidor, nunca a data enviada pelo
   cliente. Uma repetição do salvamento mantém a data original.
4. A semana começa na segunda e termina no domingo. O primeiro dia sem prática
   protege uma sequência ativa; o segundo dia sem prática da mesma semana a quebra.
   Dias protegidos não aumentam o contador. A proteção só vale após o fim do dia.
5. Domingo e segunda pertencem a semanas distintas: ambos podem ser protegidos.
   Quebrar e recomeçar a sequência não concede outra proteção na mesma semana.
6. O recorde e a medalha de 7 dias usam a melhor sequência do histórico, não só a
   atual. Não há apagamento de histórico ou medalhas por falta de treino.

## Novas medalhas

- Uma semana de prática: 7 dias efetivamente praticados na mesma sequência.
- Explorador: sessões de ao menos 10 respostas em cada operação. Treinos mistos
  não contam. Treinos livres antigos sem operação armazenada permanecem mistos:
  não se tenta reconstruir informação que não foi salva.
- Base firme: 3 sessões específicas de 90% ou mais. Cada combinação de operação,
  habilidade, intervalo e tabuada tem sua própria sequência. A quantidade 10/15
  pode variar. Um resultado abaixo de 90% interrompe a tentativa naquela combinação,
  mas uma sequência histórica de 3 continua garantindo a medalha.
- Aprendendo com os erros · 50: 50 resoluções registradas, além da medalha original de 10.
- Mil na conta: 1.000 acertos de partidas salvas, sem somar revisões novamente.
- Superação pessoal: superar um recorde anterior na mesma operação, faixa e duração.
  Primeira participação e empate não contam. Resultados com o mesmo milissegundo
  não são usados para presumir uma ordem de superação entre eles.

## Dados e segurança

`/api/achievements` é somente leitura, exige conta e retorna apenas o progresso do
usuário autenticado pelo servidor. As consultas recebem a chave HMAC da identidade;
um parâmetro de URL ou JSON não permite escolher outra conta. Respostas são `no-store`.
Nenhum dado real ou segredo é usado nos testes. O ranking não recebe pontos extras
por foguinho ou medalhas.

As medalhas são calculadas sobre os registros persistentes, não no navegador.
Descanso e resultados ruins não retiram medalhas, mas uma remoção administrativa
explícita do histórico pode afetar os valores: não existe um segundo histórico oculto.

A migração aditiva `0007_add_training_operation.sql` acrescenta a operação dos
treinos livres. Migrações já publicadas não devem ser modificadas. Não há DDL novo
em requisições de produção nem cópia/remoção de dados históricos nessa migração.

## Validação

Execute `npm test` para testar calendário, virada de dia, descanso, conquistas,
persistência, repetição de salvamentos, privacidade, erros, navegação e rotas antigas.
O banco de testes é SQLite em memória (`tests/site-fixture.mjs`). As verificações
de interface usam renderização de componentes, não um navegador real.

Depois use o fluxo de build/publicação do Sites. Testes aprovados reduzem riscos;
não são garantia de ausência absoluta de bugs em todos os dispositivos.

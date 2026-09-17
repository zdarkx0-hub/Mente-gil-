# Organização do Android Beta

Esta é a edição offline independente, na linha Beta 1.3.0. O diretório
`android-app/` da branch principal contém o contêiner antigo do site; não é a
fonte deste APK. A refatoração parte do commit `a5537e5`, cujos arquivos web foram
conferidos com os arquivos empacotados no APK Beta 1.3.0 entregue.

## Responsabilidades

Os módulos da interface ficam em `app/src/main/assets/www/`.

| Arquivo | Responsabilidade |
| --- | --- |
| `app.js` | Montar dependências, navegar e expor a API usada pelo perfil |
| `core.js` | Gerar contas, calcular precisão, resumos e sequência de dias |
| `catalog.js` | Nomes, temas, medalhas e regras de desbloqueio compartilhadas |
| `data-store.js` | Carregar e salvar dados, importar backup, separar contas e unir histórico |
| `native-request.js` | Associar requisições às respostas Android, tratar erro e timeout |
| `training.js` | Sessão ativa, respostas, cronômetros e resumo do treino |
| `ranking.js` | Categoria, listagem, início e conclusão de partidas ranqueadas |
| `progress.js` | Histórico, gráfico, conquistas e foguinho |
| `customization.js` | Escolher temas e sincronizar/selecionar medalhas |
| `settings.js` | Som, backup e ações de privacidade |
| `ui.js` | Seletores, aviso breve, aplicação de tema e som |
| `account.js` | Perfil, foto, autenticação, amigos e sincronização de conta |
| `connectivity.js` | Indicador de conexão e eventos de rede |

Os scripts são locais e carregados na ordem explícita do `index.html`. Não há
dependência de CDN, servidor de desenvolvimento ou bundler para iniciar o treino.
`jsdom` é uma dependência de desenvolvimento usada nos testes; não vai no APK.

## Como acrescentar uma função

- Coloque a regra no módulo responsável e passe as dependências na criação do
  módulo. `app.js` faz essa composição; não recebe regras de treino ou backup.
- Preserve `core.js` e `catalog.js` independentes de DOM e armazenamento.
- Use o `data-store` para persistência. `snapshot()` devolve uma cópia para o
  perfil; `getData()` é a referência interna usada pelos módulos de recursos.
  Após uma alteração persistente, chame `save()`.
- Cada treino e seus timers pertencem a `training.js`. Uma resposta pendente só
  pode afetar a mesma sessão que originou a requisição.
- Requisições de ranking e conta compartilham `native-request.js`. Não crie outro
  mapa de callbacks/timers em cada tela.
- Capture a categoria antes de iniciar a requisição. Na listagem, somente a
  resposta da consulta mais recente pode substituir a interface.
- Operações assíncronas que escrevem dados devem conferir se a referência do
  estado ainda pertence à conta atual. A troca de conta substitui essa referência.
- Não acrescente dependências cíclicas entre recursos. Use callbacks na montagem
  em `app.js`, como a conclusão de um treino ranqueado.

## Compatibilidade

A refatoração preserva schema 3, chave do armazenamento web, limite de 100 treinos,
formato do backup, nomes das pontes JavaScript/Android e a API `MenteApp`.
As classes Java, preferências criptografadas, aliases do Android Keystore,
identificador do pacote e certificado de assinatura permanecem iguais.
Todos os cinco temas da Beta continuam liberados.

Históricos antigos sem `id` recebem uma chave de comparação em memória durante a
união, evitando que várias sessões antigas sejam reduzidas a uma única entrada.
Nenhum novo identificador é gravado nesses registros.

O limite de 100 treinos e os totais calculados sobre esse histórico já existiam.
Guardar medalhas cumulativas para sempre exigiria uma alteração de dados própria;
não faz parte desta refatoração.

## Verificação

Use Node 24.15 ou superior da linha 24, como no CI:

```sh
cd android-offline
npm ci --ignore-scripts
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
```

Os testes exercitam regras de cálculo, respostas de rede fora de ordem,
cancelamento de partidas, timeout, troca de conta, reabertura, backup e
carregamento do HTML real com um treino completo. As pontes Android são simuladas
nos testes JavaScript; isso não substitui instalar uma atualização em um aparelho.

A assinatura é coberta por testes do validador. Para entregar um novo APK, siga
`RELEASING.md`: avance a versão, compile release e assine com a chave Beta
existente, comparando com o último APK entregue.

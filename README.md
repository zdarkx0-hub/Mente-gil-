# Mente Ágil

Aplicação web de treino de cálculo mental, criada para desenvolver precisão antes de velocidade.

**Site publicado:** [mente-agil-vinicius.zdarkx0.chatgpt.site](https://mente-agil-vinicius.zdarkx0.chatgpt.site)

## Funcionalidades

- treinos adaptativos de soma, subtração e multiplicação;
- níveis do aquecimento até operações com números de 1.000;
- sessões livres de 1, 2 ou 5 minutos;
- ranking por operação, duração e nível;
- treinos específicos sem cronômetro, com 10 ou 15 questões;
- revisão privada das contas erradas;
- histórico, evolução e perfil de desempenho;
- sequência diária com um descanso semanal;
- sistema de conquistas privadas;
- cadastro e proteção dos dados vinculados à conta.

## Tecnologias

- React 19 e Next.js 16;
- Vinext e Vite;
- Cloudflare Workers;
- Cloudflare D1 (SQLite);
- testes nativos do Node.js.

## Executar localmente

Requisitos: Node.js 20 ou superior e npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Preencha `USER_DATA_HMAC_SECRET` em `.env.local` com uma chave longa e aleatória. Esse arquivo é ignorado pelo Git e nunca deve ser enviado ao repositório.

Para preparar um banco D1 local do zero:

```bash
npx wrangler d1 execute mente-agil-ranking --local --file=database/schema.sql
```

Os arquivos incrementais usados pelo ambiente publicado estão em [`drizzle/`](drizzle/). O arquivo [`database/schema.sql`](database/schema.sql) representa o estado completo atual do banco para novas instalações. Dados fictícios opcionais estão em [`database/seed.example.sql`](database/seed.example.sql).

O arquivo `.openai/hosting.example.json` é apenas um modelo. Ao publicar sua própria cópia, crie `.openai/hosting.json` com o identificador fornecido pelo ambiente de hospedagem; esse arquivo fica fora do Git.

## Comandos

```bash
npm run dev      # desenvolvimento
npm test         # testes automatizados
npm run build    # compilação de produção
npm run start    # execução da versão compilada
```

## Privacidade

O repositório contém apenas código, estrutura do banco e exemplos fictícios. Registros reais de contas, treinos, rankings e segredos do ambiente de produção não são versionados.

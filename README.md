# Mente Ágil

**Versão atual: 1.2.0 — Offline First**

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
- instalação como aplicativo no Android, com ícone, tela cheia e atalhos;
- modo offline-first: treinos livres, treinos específicos já carregados, histórico local e revisão em cache continuam sem internet;
- fila criptografada AES-GCM para resultados pendentes, sincronizada automaticamente quando a conexão volta;
- dados privados offline guardados no armazenamento isolado do navegador/WebView; a chave local não é exportável;
- navegação inferior otimizada para telas pequenas e aviso de conexão;
- cadastro e proteção dos dados vinculados à conta.

## Instalar no Android

1. Abra o site no Google Chrome.
2. Toque em **Instalar app** quando o botão aparecer. Se ele não aparecer, abra o
   menu do Chrome e escolha **Adicionar à tela inicial** ou **Instalar app**.
3. Confirme a instalação. O Mente Ágil ficará na tela inicial e abrirá em tela cheia.

Se o link estiver aberto dentro do ChatGPT ou de outro aplicativo, o botão mostra
um guia e oferece a opção **Abrir no Chrome**. A versão instalada procura atualizações
do aplicativo sempre que é aberta.

Depois da primeira abertura online, o núcleo de estudo fica disponível sem conexão.
Resultados concluídos offline são armazenados localmente em uma fila criptografada e
sincronizados automaticamente quando a internet volta. Senhas, segredos do banco e
chaves do servidor nunca são colocados no APK. O ranking continua online, pois precisa
validar a sessão em tempo real. Conquistas e perfil mostram a última cópia privada
disponível offline e são atualizados após a sincronização.

## Tecnologias

- React 19 e Next.js 16;
- Vinext e Vite;
- Cloudflare Workers;
- Cloudflare D1 (SQLite);
- Progressive Web App (PWA) com Service Worker;
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

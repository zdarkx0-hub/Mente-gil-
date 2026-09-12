# Guia de desenvolvimento

## Requisitos

- Node.js 20 ou superior;
- npm;
- Java 17 e Android SDK 35 apenas para compilar o aplicativo Android.

## Preparação

```bash
npm ci
cp .env.example .env.local
```

Defina uma chave longa e aleatória em `USER_DATA_HMAC_SECRET`. Nunca use um segredo de produção no desenvolvimento local e nunca envie `.env.local` ao Git.

Para preparar o banco local:

```bash
npx wrangler d1 execute mente-agil-ranking --local --file=database/schema.sql
```

Depois, inicie a aplicação:

```bash
npm run dev
```

## Validação obrigatória

Antes de enviar uma mudança, execute:

```bash
npm run check
```

Esse comando roda os testes e a compilação de produção. O mesmo processo é executado pelo workflow `.github/workflows/validate.yml` no GitHub.

## Convenções

- nomes de arquivos e pastas em minúsculas, usando hífen quando necessário;
- componentes React em `components/`, agrupados por área;
- hooks compartilhados em `hooks/` e iniciados por `use`;
- integrações do navegador em `lib/client/`;
- integrações exclusivas do servidor em `lib/server/`;
- regras puras reutilizáveis em `shared/`;
- uma nova alteração de banco sempre recebe uma nova migração em `drizzle/`;
- dados, tokens, segredos, APKs e pastas de build nunca são versionados.

## Fluxo sugerido no Git

1. atualize a branch `main`;
2. crie uma branch curta, como `feat/nova-funcao` ou `fix/correcao`;
3. faça commits pequenos com uma finalidade clara;
4. execute `npm run check`;
5. abra um Pull Request usando o modelo do repositório.

## Android

Para compilar localmente:

```bash
gradle -p android-app :app:assembleDebug
```

No GitHub, o workflow `android-apk.yml` executa a compilação e disponibiliza o APK e seu SHA-256 como artefatos. O APK gerado não deve ser adicionado ao repositório.

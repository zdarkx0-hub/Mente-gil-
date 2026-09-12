# Mente Ágil

[![Validação](https://github.com/zdarkx0-hub/Mente-gil-/actions/workflows/validate.yml/badge.svg)](https://github.com/zdarkx0-hub/Mente-gil-/actions/workflows/validate.yml)
[![APK Android](https://github.com/zdarkx0-hub/Mente-gil-/actions/workflows/android-apk.yml/badge.svg)](https://github.com/zdarkx0-hub/Mente-gil-/actions/workflows/android-apk.yml)

Aplicação de treino de cálculo mental criada para desenvolver **precisão antes de velocidade**.

- **Versão:** 1.2.0 — Offline First
- **Aplicação:** [mente-agil-vinicius.zdarkx0.chatgpt.site](https://mente-agil-vinicius.zdarkx0.chatgpt.site)
- **Plataformas:** web, PWA e Android 7.0+

## Recursos principais

- soma, subtração e multiplicação em níveis progressivos;
- sessões livres de 1, 2 ou 5 minutos;
- treinos específicos de 10 ou 15 questões;
- revisão privada de erros, histórico e gráficos de evolução;
- ranking separado por operação, duração e nível;
- sequência diária e 11 conquistas;
- modo offline-first após a primeira abertura online;
- fila local criptografada com AES-GCM para sincronizar resultados pendentes.

O ranking permanece online porque precisa validar a sessão no servidor.

## Organização do repositório

| Caminho | Responsabilidade |
| --- | --- |
| `app/` | Rotas, layouts e estilos globais da aplicação web |
| `components/` | Componentes de interface separados por área |
| `hooks/` | Estado e consultas reutilizáveis do React |
| `lib/` | Infraestrutura privada do cliente e do servidor |
| `shared/` | Regras puras compartilhadas entre interface, servidor e testes |
| `worker/` | API e integração com o Cloudflare Worker |
| `db/` | Modelo tipado do banco |
| `drizzle/` | Migrações incrementais do ambiente publicado |
| `database/` | Schema completo e dados fictícios para instalações novas |
| `public/` | Manifesto, Service Worker, tela offline e ícones |
| `android-app/` | Contêiner Android e configuração Gradle |
| `tests/` | Testes automatizados |
| `docs/` | Arquitetura, desenvolvimento e regras do produto |

Veja o mapa completo em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Executar localmente

Requisitos: Node.js 20 ou superior e npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Preencha `USER_DATA_HMAC_SECRET` em `.env.local` com uma chave longa e aleatória. O arquivo é ignorado pelo Git e não deve ser enviado ao repositório.

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Inicia o ambiente de desenvolvimento |
| `npm test` | Executa os testes automatizados |
| `npm run build` | Gera a compilação de produção |
| `npm run check` | Executa testes e compilação |
| `npm run start` | Inicia a versão compilada |

As instruções detalhadas estão em [docs/DESENVOLVIMENTO.md](docs/DESENVOLVIMENTO.md).

## Android

O código Android fica isolado em [`android-app/`](android-app/). A Action [Build Android APK](https://github.com/zdarkx0-hub/Mente-gil-/actions/workflows/android-apk.yml) compila o APK e publica o arquivo como artefato do workflow; arquivos de build não são versionados.

## Banco de dados

Para criar um banco D1 local com o estado completo atual:

```bash
npx wrangler d1 execute mente-agil-ranking --local --file=database/schema.sql
```

Migrações já publicadas em `drizzle/` são imutáveis. Mudanças futuras devem ser adicionadas em uma nova migração.

## Documentação

- [Arquitetura](docs/ARQUITETURA.md)
- [Desenvolvimento](docs/DESENVOLVIMENTO.md)
- [Progresso, constância e conquistas](docs/progresso.md)
- [Política de segurança](SECURITY.md)
- [Como contribuir](CONTRIBUTING.md)

## Privacidade

O repositório contém somente código, estrutura do banco e exemplos fictícios. Contas, resultados reais e segredos do ambiente de produção não são versionados.

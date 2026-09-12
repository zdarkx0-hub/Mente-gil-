# Arquitetura do Mente Ágil

Este documento mostra onde cada parte do projeto deve ficar e ajuda a evitar que novas funcionalidades voltem a se misturar no mesmo diretório.

## Visão geral

| Camada | Diretórios | Função |
| --- | --- | --- |
| Rotas | `app/` | Define URLs, layouts e páginas do Next.js/Vinext |
| Interface | `components/`, `hooks/` | Renderiza telas e administra estado no navegador |
| Infraestrutura | `lib/client/`, `lib/server/` | Armazenamento offline, autenticação e utilitários dependentes do ambiente |
| Domínio | `shared/` | Regras puras de treinos, conquistas e constância |
| API | `worker/` | Valida requisições e acessa o Cloudflare D1 |
| Persistência | `db/`, `drizzle/`, `database/` | Tipos, migrações e bootstrap do banco |
| Plataformas | `public/`, `android-app/` | PWA, arquivos estáticos e contêiner Android |
| Qualidade | `tests/`, `.github/workflows/` | Testes e automações do GitHub |

## Interface web

`app/` deve conter somente arquivos que participam do roteamento ou são exigidos pelo framework. Componentes reutilizáveis ficam fora dele:

```text
app/
├── (study)/           rotas da área de estudo
├── cadastro/          cadastro de conta
├── entrar/            autenticação
├── globals.css        estilos globais
└── layout.jsx         layout raiz

components/
├── layout/            cabeçalho e navegação
├── pwa/               instalação, rede e sincronização
└── study/             treino, revisão, histórico e conquistas
```

Hooks reutilizáveis ficam em `hooks/`. Código que não renderiza interface fica em `lib/`, separado entre navegador (`client`) e servidor (`server`).

## Regras compartilhadas

Os módulos de `shared/` não devem acessar DOM, React, banco ou APIs. Isso permite usar a mesma regra na interface, no Worker e nos testes sem duplicação.

- `achievements.mjs`: catálogo e progresso das conquistas;
- `drills.mjs`: geração, resposta e resumo dos treinos específicos;
- `practice-streak.mjs`: calendário, sequência e descanso protegido.

## API e dados

`worker/index.ts` recebe as requisições e delega regras específicas aos demais módulos de `worker/`. O acesso persistente usa o binding `DB` configurado em `wrangler.jsonc`.

- `db/schema.ts` descreve o modelo tipado usado pelo código;
- `drizzle/` mantém migrações incrementais já publicadas;
- `database/schema.sql` cria uma instalação nova no estado atual;
- `database/seed.example.sql` possui apenas registros fictícios opcionais.

## Offline e Android

`public/sw.js` mantém o shell público disponível offline. Dados privados e mutações pendentes são tratados por `lib/client/offline-client.js`, em armazenamento isolado e criptografado. Respostas privadas de `/api/` não entram no Cache Storage do Service Worker.

O diretório `android-app/` contém somente o contêiner nativo. Ele abre a aplicação publicada e reutiliza a experiência offline da PWA depois da primeira abertura online.

## Regra para novos arquivos

Antes de criar um arquivo, escolha a camada pela responsabilidade principal:

1. define uma URL: `app/`;
2. renderiza interface: `components/`;
3. compartilha estado React: `hooks/`;
4. integra navegador ou servidor: `lib/client/` ou `lib/server/`;
5. contém regra pura: `shared/`;
6. atende uma API ou acessa o banco: `worker/`.

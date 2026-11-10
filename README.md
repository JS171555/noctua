# Noctua

Aplicação de atmosferas sonoras para dormir, relaxar e concentrar, construída com React, TanStack Start, TypeScript e Supabase.

## Requisitos

- Node.js 22.12 ou superior e npm.
- Um projeto Supabase é opcional para explorar e mixar sons localmente, mas necessário para login, favoritos e salvar atmosferas.

## Desenvolvimento local

```sh
npm ci
cp .env.example .env
npm run dev
```

Preencha no `.env` as variáveis do Supabase descritas abaixo. Sem essas variáveis, os recursos de conta permanecem indisponíveis, mas o catálogo e o Studio podem ser usados localmente.

O build de produção é gerado com `npm run build`; os testes são executados com `npm test`.

## Publicar na Vercel

O projeto usa TanStack Start com o plugin Nitro para gerar o servidor compatível com Vercel Functions. Importe o repositório `JS171555/noctua` em [vercel.com/new](https://vercel.com/new), mantenha a raiz do projeto na pasta do repositório e permita a detecção automática do framework e dos comandos de build. Não configure a aplicação como site estático nem substitua o comando de build `npm run build`.

Se o projeto usar autenticação Supabase, cadastre no painel Vercel as variáveis abaixo nos ambientes que serão usados (Production, Preview e Development):

- `VITE_SUPABASE_URL`: URL do projeto Supabase, disponibilizada ao cliente durante o build.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: chave publicável do Supabase, disponibilizada ao cliente durante o build. Essa chave é pública por definição; as políticas RLS do banco devem proteger os dados.
- `SUPABASE_URL`: URL do Supabase disponível no servidor.
- `SUPABASE_PUBLISHABLE_KEY`: chave publicável disponível no servidor para autenticação e funções server-side.

As duas variáveis com prefixo `VITE_` são incluídas no bundle do navegador e nunca devem conter segredos. `SUPABASE_SERVICE_ROLE_KEY` só deve ser definida se operações administrativas server-side forem usadas; nunca use essa chave em código enviado ao navegador ou com prefixo `VITE_`. `DATABASE_URL` só é necessária para executar comandos Drizzle/migrações e não é exigida para servir o app atualmente.

No painel Supabase, ative o provedor Google se quiser oferecer esse tipo de login e ajuste a configuração de URLs de autenticação para incluir o domínio de produção e os domínios de Preview que você pretende usar. O fluxo de login e recuperação de senha redireciona para a origem do site publicado.

Depois de configurar as variáveis, faça o deploy. Para testar localmente, configure `.env` e execute `npm run build` e `npm test`. `.env` e outros arquivos de ambiente locais são ignorados pelo Git; mantenha `.env.example` sem credenciais.

## Segurança

Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no navegador, nunca use-a em uma variável `VITE_` e nunca versione arquivos `.env` com credenciais.

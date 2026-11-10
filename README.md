# Noctua

Aplicação de atmosferas sonoras para dormir, relaxar e concentrar, construída com React, TanStack Start, TypeScript e Supabase.

## Requisitos

- Node.js 20 ou superior e npm
- Um projeto Supabase (opcional para explorar e mixar sons localmente; necessário para login, favoritos e salvar atmosferas)

## Configuração local

1. Instale dependências e inicie o servidor para usar o catálogo e o Studio local:

```sh
npm install
npm run dev
```

Para habilitar contas, favoritos e salvamento, copie `.env.example` para `.env`, preencha as variáveis do seu Supabase e configure o provedor Google em Supabase Authentication (se quiser login Google).

O build de produção é gerado com `npm run build`; testes com `npm test`.

Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no navegador nem inclua arquivos `.env` com credenciais no controle de versão.

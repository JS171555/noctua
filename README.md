# NOCTUA

<p align="center">
  <img src="public/noctua-logo.png" alt="Logo do NOCTUA: lua dourada sobre fundo verde-floresta" width="176" />
</p>

<p align="center"><strong>Atmosferas sonoras para desacelerar.</strong><br />Durma, relaxe e concentre-se no seu próprio ritmo.</p>

O **NOCTUA** é uma experiência sonora para celular e tablet. Combine camadas de som, ajuste volumes e temporizador, ouça atmosferas prontas e crie misturas próprias. A exploração do catálogo funciona sem conta; login, favoritos e misturas salvas dependem de uma instância Supabase configurada. Em computadores, o site exibe um aviso de acesso e orienta a continuar em um dispositivo móvel ou tablet.

## Recursos

- Atmosferas prontas com filtros por intenção, como dormir, relaxar, ler e meditar.
- Studio para combinar sons, ajustar o volume de cada camada e controlar o volume geral.
- Temporizador para interromper a reprodução após 15, 30, 60 ou 90 minutos.
- Conta com cadastro e login por e-mail e senha, recuperação de senha e login Google opcional.
- Com conta configurada: salvar e remover sons e misturas dos favoritos, guardar misturas personalizadas, consultar histórico de reprodução e editar o nome do perfil.
- Preferência de tema claro/escuro, persistida localmente no dispositivo.
- Interface instalável como Web App em dispositivos compatíveis; a instalação não habilita reprodução offline.

## Biblioteca de áudio

O catálogo contém **20 identificadores** organizados em cinco categorias: Chuva, Natureza, Aconchego, Cidade e Ruídos. São 17 camadas ambientais — 15 efeitos gerados por IA, uma fonte de Chuva fornecida pelo usuário e uma gravação real de Trovões — mais três ruídos matemáticos sintetizados no navegador.

Os ambientes gravados são carregados sob demanda e têm aproximadamente 30 segundos. O carregador processa o áudio para transições em loop e limita o cache de PCM para reduzir o uso de memória. Ruídos são sintetizados em Web Worker quando disponível, com fallback para navegadores sem suporte. A reprodução requer conexão à internet para baixar os arquivos; o cache de áudio não é armazenamento offline persistente.

A gravação usada em Trovões é [Thunder crack 2B.wav](https://commons.wikimedia.org/wiki/File:Thunder_crack_2B.wav), de Jud McCranie, sob **CC BY-SA 4.0**. O derivado distribuído pelo projeto mantém essa licença e requer atribuição. A fonte de Chuva foi fornecida pelo usuário e não tem licença declarada neste repositório. Para detalhes técnicos, fontes e manutenção dos arquivos, consulte [docs/audio.md](docs/audio.md).

## Tecnologias

- React 19 e TypeScript
- TanStack Start e TanStack Router
- Vite 8 e Nitro
- Tailwind CSS 4
- Supabase Auth, Postgres e Row Level Security (RLS)
- Drizzle ORM/Kit para schema e migrações do banco
- Vitest para testes

## Requisitos

- Node.js **22.12 ou superior**
- npm
- Supabase é opcional para explorar e usar o catálogo; necessário para autenticação, favoritos, perfil, histórico e persistência de misturas

## Começar localmente

```bash
git clone https://github.com/JS171555/noctua.git
cd noctua
npm ci
cp .env.example .env
npm run dev
```

Abra o endereço local informado pelo Vite em um celular ou tablet. Em computadores, a interface é substituída pelo aviso de acesso. Sem variáveis do Supabase, é possível explorar o catálogo e usar o Studio; recursos de conta permanecem indisponíveis. Os arquivos de áudio de desenvolvimento estão em `public/audio/v2/`.

## Configurar o Supabase

1. Crie um projeto Supabase.
2. No **SQL Editor** do projeto, execute `drizzle/migrations/0000_noctua_core_schema.sql`. A migração cria as tabelas, funções e políticas RLS necessárias e insere o catálogo de sons.
3. Preencha as variáveis abaixo no `.env` local. Para o cliente no navegador, defina as variáveis `VITE_`. As variáveis sem esse prefixo são server-side. Use os valores do projeto Supabase correspondente.
4. Em **Authentication → URL Configuration**, configure a URL do site e permita os domínios locais, de produção e de Preview usados como redirecionamento.
5. O login Google é opcional. Para habilitá-lo, configure o provedor Google em **Authentication → Sign In / Providers** no Supabase e os respectivos dados OAuth.

| Variável                        | Uso                                                                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | URL pública do projeto Supabase, usada no navegador.                                                                                            |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave publicável do Supabase, usada no navegador; os acessos são limitados pelas políticas RLS.                                                 |
| `SUPABASE_URL`                  | URL disponível no servidor; pode ser usada como fallback quando as variáveis públicas não estiverem definidas no servidor.                      |
| `SUPABASE_PUBLISHABLE_KEY`      | Chave publicável disponível no servidor.                                                                                                        |
| `SUPABASE_SERVICE_ROLE_KEY`     | Não é necessária para a aplicação normal. É privilegiada, ignora RLS e nunca deve ser exposta ao navegador ou incluída em uma variável `VITE_`. |
| `DATABASE_URL`                  | Opcional; conexão PostgreSQL usada por comandos Drizzle, não necessária para executar a aplicação.                                              |

A configuração recomendada para uma aplicação publicada é fornecer as variáveis públicas ao build do cliente e as variáveis server-side ao runtime. Nunca versione `.env` nem credenciais. O arquivo [.env.example](.env.example) lista os nomes das variáveis aceitas.

## Comandos

```bash
npm run dev       # servidor de desenvolvimento
npm run build     # build de produção (cliente e servidor Nitro)
npm run preview   # prévia local do build
npm test          # testes automatizados com Vitest
npm run lint      # análise estática com ESLint
npm run format    # formata os arquivos com Prettier
npx tsc --noEmit  # checagem de tipos TypeScript
```

## Publicar na Vercel

1. Importe `JS171555/noctua` em [vercel.com/new](https://vercel.com/new), mantendo a raiz do repositório como diretório do projeto.
2. Use o comando de build `npm run build` e o runtime detectado para TanStack Start/Nitro. Não configure o app como site estático: as rotas do servidor precisam do runtime Nitro.
3. Para recursos de conta, configure as variáveis do Supabase nos ambientes **Production**, **Preview** e **Development** conforme necessário.
4. Ajuste no Supabase as URLs autorizadas de redirecionamento para os domínios da Vercel que serão usados. Para login Google, configure também as credenciais e URLs de callback no provedor.
5. Faça o deploy e valide autenticação, áudio e URLs de redirecionamento em HTTPS.

O manifest e os ícones públicos permitem oferecer instalação nos dispositivos compatíveis quando o site está em HTTPS.

## Instalar no dispositivo

- **Android:** abra o site no Chrome e escolha **Instalar app** ou **Adicionar à tela inicial** no menu do navegador.
- **iPhone/iPad:** abra o site no Safari, toque em **Compartilhar** e escolha **Adicionar à Tela de Início**. A instalação é iniciada pelo menu do sistema, não por um botão automático no site.

A instalação abre o site em modo de aplicativo, mas não cria suporte offline. Reprodução, autenticação e recursos dependentes do Supabase continuam precisando de conexão.

## Estrutura do projeto

```text
src/
├── components/       # componentes de interface
├── data/             # catálogo e atmosferas prontas
├── hooks/            # autenticação
├── integration/      # cliente e tipos Supabase
├── routes/           # páginas e rotas TanStack
├── services/audio/    # engine, carregamento e processamento de áudio
├── services/supabase/ # consultas e mutações de dados
└── test/             # testes automatizados
public/
├── audio/v2/         # arquivos de áudio publicados
├── icons/            # ícones PWA
└── manifest.json     # configuração do Web App
```

Arquivos e áreas úteis:

- [docs/audio.md](docs/audio.md): detalhes de reprodução, cache, fontes, licenças e manutenção.
- `drizzle/migrations/0000_noctua_core_schema.sql`: schema Supabase, políticas RLS e catálogo inicial.
- `src/config/audio-sources.ts`: associação entre identificadores e arquivos de áudio.
- `scripts/`: ferramentas de preparação, auditoria e verificação de áudio.

## Segurança e limitações

- A chave publicável do Supabase pode ser usada no navegador; a autorização dos dados deve continuar protegida por RLS. A migração deste projeto habilita políticas para os dados pessoais.
- A `SUPABASE_SERVICE_ROLE_KEY` possui privilégios administrativos. Não a inclua em código client-side, variáveis `VITE_` ou arquivos versionados.
- IDs de sons são usados por misturas e favoritos. Ao manter ou substituir a biblioteca, preserve os identificadores; atualize a versão dos arquivos/URLs para invalidar caches, conforme descrito em [docs/audio.md](docs/audio.md).
- A continuidade da reprodução em segundo plano depende do navegador e do sistema operacional. O volume seguro também depende do dispositivo e dos fones usados.

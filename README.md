# NOCTUA

<p align="center">
  <img src="public/noctua-logo.png" alt="Logo do NOCTUA: lua dourada sobre fundo verde-floresta" width="176" />
</p>

<p align="center"><strong>Atmosferas sonoras para desacelerar.</strong><br />Durma, relaxe e concentre-se no seu próprio ritmo.</p>

O **NOCTUA** é uma experiência sonora minimalista, criada para dispositivos móveis e tablets. Explore sons e combine atmosferas para criar o ambiente ideal para cada momento. Em computadores, a aplicação exibe um aviso e solicita o acesso por celular ou tablet. A experiência pode ser explorada sem conta; os recursos de autenticação, favoritos e salvamento dependem da configuração do Supabase.

## Experiência sonora

O catálogo oferece **20 camadas**: 17 ambientes originais gerados por IA e três ruídos matemáticos em estéreo. Os ambientes incluem chuva, floresta, oceano, lareira, cafeteria e trem, com arquivos individuais de aproximadamente 30 segundos e crossfade na repetição. Não são gravações de campo nem áudio lossless.

O mixer aplica transições suaves, calibragem de energia e folga para combinar camadas. Os arquivos são carregados sob demanda; os ruídos são preparados em Web Worker nos navegadores modernos. O cache de áudio é limitado para reduzir o consumo de memória em celulares e não habilita reprodução offline persistente.

Consulte [a documentação de áudio](docs/audio.md) para formato, tratamento, manutenção e limites da reprodução.

## Tecnologias

- React 19, TypeScript e TanStack Start
- Vite 8 e Nitro para build e execução server-side
- Tailwind CSS 4
- Supabase para autenticação e recursos de conta
- Drizzle ORM/Kit para schema e migrações do banco

## Requisitos

- Node.js 22.12 ou superior
- npm
- Projeto Supabase, opcional para explorar o catálogo e o Studio; necessário para recursos de conta

## Desenvolvimento local

```bash
git clone https://github.com/JS171555/noctua.git
cd noctua
npm ci
cp .env.example .env
npm run dev
```

A aplicação inicia sem credenciais do Supabase para permitir a exploração local. Preencha o `.env` quando for testar login, favoritos ou salvamento de atmosferas.

## Variáveis de ambiente

| Variável                        | Uso                                                                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | URL pública do Supabase, incorporada ao bundle do navegador no build.                                                      |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave publicável usada pelo cliente no navegador. A proteção dos dados deve ser feita com políticas RLS.                   |
| `SUPABASE_URL`                  | URL do Supabase disponível no servidor.                                                                                    |
| `SUPABASE_PUBLISHABLE_KEY`      | Chave publicável usada em operações server-side.                                                                           |
| `SUPABASE_SERVICE_ROLE_KEY`     | Opcional; somente para operações administrativas confiáveis no servidor. Ignora RLS e nunca pode ser exposta ao navegador. |
| `DATABASE_URL`                  | Opcional; necessária apenas para comandos Drizzle e migrações, não para servir a aplicação.                                |

Use `.env.example` como referência e mantenha credenciais fora do Git. Variáveis com prefixo `VITE_` são públicas. Nunca coloque chaves secretas em variáveis `VITE_`.

## Instalação no celular

O NOCTUA inclui um Web App Manifest com nome, modo de exibição, cores de marca e ícones quadrados opacos. A instalação exige que o site esteja publicado em HTTPS; a Vercel fornece HTTPS para domínios publicados.

### Android

Abra o site no Chrome para Android. No menu do navegador, escolha **Instalar app** ou **Adicionar à tela inicial** e confirme. A opção pode aparecer depois que a página for visitada e pode variar conforme a versão do navegador.

### iPhone e iPad

Abra o site no Safari, toque em **Compartilhar** e escolha **Adicionar à Tela de Início**. Ative **Abrir como App da Web** e toque em **Adicionar**. No iOS, a instalação é iniciada pelo usuário no menu de compartilhamento; não há um botão de instalação automática no site.

A instalação abre o NOCTUA em modo de aplicativo, mas não habilita uso offline. Reprodução de sons, autenticação e demais recursos que dependem da rede continuam precisando de conexão.

## Publicação na Vercel

1. Importe `JS171555/noctua` em [vercel.com/new](https://vercel.com/new).
2. Mantenha a raiz do repositório como diretório do projeto e aceite a detecção automática do framework e do comando `npm run build`.
3. Se for usar recursos de conta, cadastre as variáveis Supabase na Vercel nos ambientes **Production**, **Preview** e **Development**.
4. No painel Supabase, habilite o provedor Google caso queira oferecer esse tipo de login e configure as URLs de redirecionamento para os domínios de produção e Preview utilizados.
5. Execute o deploy e valide o site publicado em HTTPS antes de testar a instalação no dispositivo.

Não configure o projeto como site estático: o TanStack Start usa Nitro para gerar o servidor compatível com Vercel Functions. Não é necessário adicionar plugins ou dependências para servir o manifest e os ícones.

## Comandos úteis

```bash
npm run dev       # desenvolvimento local
npm run build     # build de produção para Vercel/Nitro
npm run preview   # prévia local do build
npm test          # testes automatizados
npm run lint      # análise estática
```

## Estrutura PWA

- `public/manifest.json`: identidade, cores, modo de abertura e ícones PWA.
- `public/noctua-logo.png`: ícone principal da aplicação em 512 × 512 px.
- `public/icons/noctua-192.png`: ícone PWA de 192 × 192 px.
- `public/icons/noctua-apple-touch-icon.png`: ícone de tela inicial Apple em 180 × 180 px.
- `public/icons/noctua-favicon-32.png`: favicon em 32 × 32 px.

## Segurança

Nunca versione arquivos `.env` com credenciais. As chaves publicáveis do Supabase não substituem políticas RLS. A `SUPABASE_SERVICE_ROLE_KEY` tem privilégios administrativos e deve permanecer exclusivamente no ambiente de servidor.

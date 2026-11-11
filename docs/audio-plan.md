# Renovação sonora do NOCTUA

## Objetivo

Refazer todos os sons do catálogo com identidade sonora mais natural e confortável para descanso, mantendo nomes, controles, presets, layout e integração Supabase.

## Implementação

- Substituir as 17 simulações de ambientes por efeitos sonoros originais gerados por IA, solicitados com 30 segundos e repetição contínua. Não são gravações de campo e não incluem trilha musical ou narração solicitada.
- Publicar MP3 estéreo a 44,1 kHz / 192 kbps em `public/audio/v2/`, carregados apenas quando o usuário reproduzir uma camada.
- Manter branco, rosa e marrom como ruídos matemáticos, renovando sua geração estéreo e realizando o trabalho em Web Worker para evitar travamentos da interface.
- Processar o PCM decodificado: retirar componente DC, criar crossfade no encontro do fim e início, calibrar energia e preservar folga de pico. Não normalizar camadas silenciosas a volumes agressivos.
- Limitar carregamentos e cache para reduzir o impacto em dispositivos móveis. Falhas de download devem aparecer com possibilidade de tentar novamente, sem substituir silenciosamente o som por outro.
- Melhorar a soma do mixer com folga de volume, dinâmica moderada e rampas suaves; corrigir condições de corrida de carregamento e pausa.

## Organização

`src/config/audio-sources.ts` declara os assets. `src/services/audio/` concentra geração de ruídos, preparação PCM, carregamento e reprodução. `public/audio/v2/` guarda os ambientes. `scripts/prepare-audio.py` padroniza entregas. `src/test/` verifica os contratos de áudio.

## Resultados

- [x] Os 20 sons do catálogo usam a nova implementação, sem trocar conteúdo ou visual da interface.
- [x] Todos os ambientes possuem arquivos individuais válidos; não há substituição por outro ambiente em caso de falha.
- [x] Loops, ganho, cache e geração de ruído têm verificações automatizadas.
- [x] Build Vercel, 29 testes e verificações dos arquivos de áudio executados antes da atualização da main.

## Limites

MP3 é um formato com perdas; não se anuncia áudio lossless. Qualidade perceptiva não é comprovada apenas por análise numérica. Reprodução em segundo plano depende das políticas do navegador e do sistema operacional. Volume seguro continua dependendo do aparelho e dos fones utilizados.

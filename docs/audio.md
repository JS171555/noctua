# Áudio do NOCTUA

O catálogo conserva os mesmos 20 identificadores e controles. Das 17 camadas ambientais, 15 são efeitos gerados por IA; Chuva e Trovões usam os arquivos fornecidos pelo usuário. A procedência original desses dois arquivos não foi inferida. Não se anuncia validação auditiva humana dos efeitos gerados.

## Biblioteca

| Grupo              | Sons                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| Chuva              | Chuva, chuva na janela, chuva no telhado, trovões e tempestade distante                         |
| Natureza           | Vento, oceano, floresta, pássaros, grilos, água corrente, folhas balançando e vento nas árvores |
| Aconchego          | Lareira e fogueira                                                                              |
| Cidade             | Cafeteria e trem                                                                                |
| Ruídos matemáticos | Branco, rosa e marrom                                                                           |

Os ambientes estão em `public/audio/v2/`. Os 15 efeitos gerados usam MP3 estéreo a 44,1 kHz e 192 kbps, com aproximadamente 30 segundos. Chuva preserva o MP3 estéreo de 44,1 kHz, 256 kbps e aproximadamente 109 segundos enviado pelo usuário. Trovões preserva o MP3 estéreo de 24 kHz, 160 kbps e aproximadamente 121 segundos. MP3 é um formato com perdas; preservar um MP3 existente sem recodificação não transforma o arquivo em áudio lossless.

### Revisão de Chuva e Trovões

Na revisão `rev=4`, os dois arquivos gerados foram substituídos pelos arquivos enviados pelo usuário, preservados byte a byte. Não foram cortados, equalizados, reamostrados nem recodificados. A tentativa de remoção de metadados com cópia direta dos frames MP3 não economizou bytes; por isso os originais foram mantidos. O preset “Floresta sob a chuva” continua iniciando Trovões em 45%; os demais volumes permanecem iguais.

As URLs usam `?rev=4` para invalidar o cache dos dois arquivos sem alterar os outros ambientes. O SHA-256 dos arquivos publicados foi comparado com o dos anexos originais. Reduzir mais o tamanho por recodificação MP3 acrescentaria perdas e não foi feito. O tratamento de reprodução já existente no mixer permanece aplicado apenas em tempo de execução.

## Reprodução e loops

Na preparação dos 15 efeitos gerados, o FFmpeg mede a sonoridade em uma primeira passagem e aplica `loudnorm` em uma segunda, com alvos de −23 LUFS, true peak de −4 dB e faixa dinâmica de 7 LU. Chuva e Trovões fornecidos não passaram por essa etapa. São parâmetros de produção, não certificação de áudio ou de escuta humana.

Ao decodificar um ambiente, o carregador remove o componente DC, sobrepõe até dois segundos do final ao início com crossfade de potência constante e ajusta o ganho de ambos os canais em conjunto. O resultado típico de uma fonte de 30 segundos é um loop de aproximadamente 28 segundos, sem uma pausa inserida a cada repetição. O comprimento exato é calculado a partir do PCM decodificado pelo navegador.

A calibragem busca RMS de 0,08 (aproximadamente −22 dBFS), respeitando pico de amostra de 0,55 (aproximadamente −5,2 dBFS) e limite de amplificação de quatro vezes. Sons com transientes podem ficar abaixo do alvo RMS para preservar a folga. Esse tratamento é calibragem de energia em PCM; não equivale a normalização certificada em LUFS nem a medição de true peak.

Os ruídos branco, rosa e marrom são gerados com canais independentes, filtragem de DC/subgraves e loop de 24 segundos. Um Web Worker faz a geração em navegadores modernos para não bloquear os controles. Há fallback sem Worker em ambientes antigos. O ruído rosa distribui energia em direção às baixas frequências e o marrom enfatiza essa região ainda mais; não se tratam de efeitos ambientais gerados por IA.

## Mixer e desempenho

O volume de cada camada continua usando a curva perceptiva do app. O barramento de saída inclui filtro de subgraves, folga para a soma das camadas e compressão moderada. A compressão não é um limitador brickwall e não garante ausência de clipping em qualquer combinação possível. Fades acompanham início, pausa e troca de camadas.

Arquivos são carregados sob demanda, com até dois carregamentos simultâneos. O cache LRU do PCM decodificado tem teto de 96 MiB; camadas ativas também ocupam memória fora desse cache. O cache não é armazenamento offline persistente. Downloads têm cancelamento e prazo de 30 segundos. Falhas aparecem no estado de áudio para que a interface ofereça nova tentativa, sem substituir um ambiente por outro.

## Manutenção

`src/config/audio-sources.ts` associa IDs a URLs versionadas. Preserve os IDs para manter presets e favoritos válidos. Ao substituir uma biblioteca já publicada, altere a versão no caminho; em revisões pontuais, incremente o parâmetro `rev` para evitar que caches antigos mantenham arquivos de outra edição.

Para preparar um novo original, use `python3 scripts/prepare-audio.py ORIGINAL.mp3 public/audio/v3/ID.mp3`. O script requer FFmpeg/FFprobe, remove metadados, filtra extremos, nivela em duas passagens e codifica a entrega. Essas ferramentas só são necessárias na produção dos assets; não são dependências do deploy Vercel.

Execute `python3 scripts/audit-audio.py public/audio/v2 --output docs/audio-quality.json` para repetir a verificação de formato, duração, silêncio, corrupção e níveis PCM dos 17 ambientes. O relatório versionado registra níveis dos arquivos decodificados antes do tratamento adicional do navegador.

Os testes cobrem catálogo, crossfade, calibragem, ruídos, cache, concorrência e estado de reprodução. Análise numérica identifica silêncio, corrupção, duração e níveis, mas não substitui ouvir cada ambiente em fones e alto-falantes reais. A continuidade em segundo plano depende do navegador/sistema; o volume confortável e seguro depende também do aparelho e dos fones.

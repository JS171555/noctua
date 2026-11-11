# Chuva e Trovões: revisão móvel

A versão anterior baixava dois arquivos de 3,4 MB e 2,4 MB, com 109 e 121 segundos. Nesta revisão ambos têm 30 segundos: 795 KB para Chuva e 676 KB para Trovões. A redução foi de 77% e 72% no download. Como a memória do áudio decodificado depende da duração, ela também cai de forma proporcional.

## Chuva

A gravação enviada pelo usuário foi mantida como fonte. Para não trocar o som aprovado, foi escolhido o trecho mais estável da gravação, entre 60 e 90 segundos, medido por janelas de um segundo com variação de 0,55 dB. Não houve equalização nem compressão. Foram aplicados 1,5 dB de atenuação, para não encostar no limite digital, e fades de 120 ms nas extremidades.

## Trovões

Os testes com sons gerados por IA e com síntese própria não foram aprovados na escuta. A direção mudou para gravação real: `Thunder crack 2B.wav`, de Jud McCranie, no Wikimedia Commons, sob CC BY-SA 4.0. O trecho escolhido contém um estrondo próximo aos 3,6 segundos e uma cauda longa. Foram aplicados filtro de subgraves, compressão moderada, nivelamento em −16 LUFS com true peak de −1,5 dB e codificação MP3 com bitrate variável. O arquivo derivado é distribuído sob CC BY-SA 4.0, com crédito ao autor.

Fonte e licença: [Thunder crack 2B.wav](https://commons.wikimedia.org/wiki/File:Thunder_crack_2B.wav).

## Codificação

A entrega usa MP3 estéreo a 44,1 kHz, compatível com Chrome, Firefox e Safari, com bitrate variável de qualidade 2 do LAME. A documentação do MDN descreve o compromisso entre bitrate, fidelidade e tamanho e o suporte dos navegadores a MP3. A documentação do LAME descreve a escala de qualidade do bitrate variável. Aumentar o bitrate não recupera informação ausente na fonte e MP3 continua sendo um formato com perdas.

Fontes: [MDN — codecs de áudio](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs), [LAME — Variable Bit Rate](https://lame.sourceforge.io/vbr.php).

## Verificação

O script `scripts/audit-audio.py` confere formato, duração, silêncio e níveis decodificados dos 17 arquivos. O script `scripts/audit-runtime.mjs` aplica o mesmo tratamento PCM do aplicativo e confere RMS, pico e componente DC. Essas medições não substituem a escuta em celular. O preset “Floresta sob a chuva” inicia Trovões em 70%.

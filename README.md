# Marés de Âmbar

Protótipo de estratégia medieval em tempo real para PC. Na escaramuça **A Passagem do Sal**, comande o Cais de Âmbar e destrua a sede da Casa de Ardósia. As duas ilhas, a arte e o código do jogo são originais.

## Abrir offline

Na pasta do projeto, rode `npm start` e abra [http://127.0.0.1:4173/](http://127.0.0.1:4173/). O comando serve o build preparado em `dist/` e só depende do Node.js já instalado. A partida e a IA rodam no navegador, e os arquivos de jogo e fontes são servidos pelo localhost.

## Jogar

1. Pressione **W** para selecionar os trabalhadores. Clique com o botão direito em um bosque. Eles cortam madeira, levam a carga à sede e retornam ao bosque por conta própria.
2. Com ao menos 125 de madeira e trabalhadores selecionados, pressione **B** ou clique em **Erguer quartel**. Clique em terreno livre da sua ilha para marcar a construção. Use **Esc** para cancelar.
3. Selecione o quartel concluído. **T** ou **Treinar guarda** adiciona um guarda à fila por 40 de madeira. Selecione os trabalhadores disponíveis e mande-os de volta à coleta para sustentar o treino.
4. Use **A** para reunir os guardas. Clique com o botão direito no terreno para marchar por uma das pontes ou sobre um alvo rival para atacar. Vence quem derrubar a sede adversária.

O clique esquerdo seleciona uma unidade ou edificação. Arraste para selecionar unidades em grupo ou use **Shift + clique** para adicionar e remover unidades. Use **Espaço** ou o botão de pausa no topo para pausar. O botão de reinício recomeça a mesma escaramuça.

## Desenvolvimento e teste

Com as dependências instaladas, rode `npm run dev` para desenvolver ou `npm run build` para reconstruir `dist/`. Se precisar instalar as dependências pela primeira vez, rode `npm ci` em um ambiente com acesso ao registro npm. Para o build, use Node.js 20.19+ na linha 20 ou 22.12+.

Com o servidor local em execução, `npm test` exercita o build pelo navegador com Playwright. Os cenários cobrem vitória, derrota, reinício, pausa e travessia em grupo. As solicitações externas são bloqueadas. Se necessário, aponte `CHROME_PATH` para o Chrome ou Chromium instalado. As capturas ficam em `test-results/`.

Consulte `public/licencas/` para as licenças das fontes e do Phaser.

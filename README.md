# Marés de Âmbar

Protótipo de estratégia medieval em tempo real para PC. Na escaramuça **A Passagem do Sal**, comande o Cais de Âmbar e destrua a sede da Casa de Ardósia. As duas ilhas, a arte e o código do jogo são originais.

## Jogar no Linux

Abra **Marés de Âmbar** no menu de aplicativos ou pelo atalho da área de trabalho. Para instalar a partir de um pacote, extraia o arquivo `mares-de-ambar-linux-x64-<commit>.tar.gz` da pasta `distribuicao/` e execute `./install.sh` dentro da pasta extraída. A instalação é por usuário. O pacote inclui o runtime, o jogo e as fontes, e a edição instalada funciona offline com um protocolo interno.

O executável fica em `${XDG_DATA_HOME:-$HOME/.local/share}/mares-de-ambar/current/mares-de-ambar`. A edição instalada foi validada no Linux Mint 22.3 x86_64. O atalho do menu fica no diretório XDG de aplicativos e o atalho da área de trabalho usa o diretório retornado por `xdg-user-dir DESKTOP`. Se o jogo estiver aberto durante uma atualização, feche e reabra a janela para usar a nova versão.

## Abrir a versão web offline

Na pasta do projeto, rode `npm run build`, depois `npm start`, e abra [http://127.0.0.1:4173/](http://127.0.0.1:4173/). O servidor serve os arquivos de `dist/` pelo localhost. A partida e a IA rodam no navegador.

## Jogar

1. Pressione **W** para selecionar os trabalhadores. Clique com o botão direito em um bosque. Eles cortam madeira, levam a carga à sede e retornam ao bosque por conta própria.
2. Com ao menos 125 de madeira e trabalhadores selecionados, pressione **B** ou clique em **Erguer quartel**. Clique em terreno livre da sua ilha para marcar a construção. Use **Esc** para cancelar.
3. Selecione o quartel concluído. **T** ou **Treinar guarda** adiciona um guarda à fila por 40 de madeira. Selecione os trabalhadores disponíveis e mande-os de volta à coleta para sustentar o treino.
4. Use **A** para reunir os guardas. Clique com o botão direito no terreno para marchar por uma das pontes ou sobre um alvo rival para atacar. Vence quem derrubar a sede adversária.

O clique esquerdo seleciona uma unidade ou edificação. Arraste para selecionar unidades em grupo ou use **Shift + clique** para adicionar e remover unidades. Use **Espaço** ou o botão de pausa no topo para pausar. O botão de reinício recomeça a mesma escaramuça.

## Desenvolvimento e teste

Com as dependências instaladas, rode `npm run dev` para desenvolver ou `npm run build` para reconstruir `dist/`. Se precisar instalar as dependências pela primeira vez, rode `npm ci` em um ambiente com acesso ao registro npm. Para o build, use Node.js 20.19+ na linha 20 ou 22.12+.

Com o servidor local em execução, `npm test` verifica a versão web pelo Playwright. Se necessário, aponte `CHROME_PATH` para o Chrome ou Chromium instalado. Com a edição desktop instalada, `npm run test:desktop` verifica o executável e pode ser executado com o servidor web desligado. Os cenários cobrem vitória, derrota, reinício, pausa e travessia em grupo. As capturas ficam em `test-results/`.

## Atualizações desta máquina

O hook local roda depois de um commit em `main` que afete o jogo, o build ou a edição Linux. Ele usa exatamente os arquivos do commit, gera e testa o pacote, atualiza a instalação e envia o commit ao GitHub. O pacote e seu SHA-256 ficam em `distribuicao/`. As versões anteriores instaladas ficam em `releases/`, e o atalho acompanha a versão apontada por `current`.

- Para ativar ou restaurar o hook neste checkout, rode `git config --local core.hooksPath .githooks`.
- Para repetir todo o fluxo para o último commit de `main`, rode `bash scripts/release-linux.sh`.
- Para ver o último resultado, rode `cat "$(git rev-parse --git-common-dir)/mares-de-ambar-release.status"`.
- Se o build ou o teste falhar, o instalador anterior continua disponível. Corrija a causa e faça um novo commit ou repita o fluxo se a falha for do ambiente. Se a etapa de Git falhar, a versão local continua jogável. Resolva a rede, a autenticação ou uma divergência no histórico e execute o mesmo comando para retomar.

O empacotamento usa Node.js, npm, Git, Bash, curl, unzip, tar, gzip, flock e `gdk-pixbuf-thumbnailer`, com uma sessão gráfica ou Xvfb para o teste. O primeiro build pode baixar dependências e o runtime Electron com SHA-256 fixado. A rede também é usada no push. A instalação pelo arquivo de distribuição e o jogo instalado funcionam offline.

Consulte `public/licencas/` para as licenças das fontes e do Phaser. As licenças do Electron acompanham o pacote.

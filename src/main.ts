import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/cinzel/latin-500.css';
import '@fontsource/cinzel/latin-700.css';
import './style.css';
import { person, structure } from './art';
import { Battlefield, startBattlefield } from './battlefield';
import { icon } from './icons';
import { cellAt, center, type Point } from './map';
import {
  BARRACKS_COST, GUARD_COST, Match, POP_CAP, TRAIN_SECONDS, type Building, type Entity, type Unit,
} from './match';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header class="topbar">
    <div class="topbar-inner">
      <div class="brand">
        <span class="brand-seal">${icon('anchor', 25)}</span>
        <div><h1>Marés de Âmbar</h1><span>Estratégia medieval em tempo real</span></div>
      </div>
      <div class="resources" aria-label="Recursos">
        <div class="resource">
          <span class="resource-icon wood-icon">${icon('logs', 22)}</span>
          <div><span class="caption">Madeira</span><strong id="wood">100</strong></div>
        </div>
        <div class="resource">
          <span class="resource-icon pop-icon">${icon('people', 21)}</span>
          <div><span class="caption">População</span><strong id="population">05 <small>/ 18</small></strong></div>
        </div>
      </div>
      <div class="top-actions">
        <span class="clock" aria-label="Tempo de partida">${icon('timer', 17)} <span id="clock">00:00</span></span>
        <button id="pause" class="square-button" type="button" title="Pausar (Espaço)" aria-label="Pausar">${icon('pause', 18)}</button>
        <button id="restart" class="square-button" type="button" title="Reiniciar partida" aria-label="Reiniciar partida">${icon('reset', 18)}</button>
      </div>
    </div>
  </header>
  <main class="layout">
    <div class="match-strip">
      <div class="breadcrumb">${icon('swords', 17)} <strong>Escaramuça local</strong><span class="breadcrumb-divider">/</span><span>Arquipélago do Âmbar</span></div>
      <div id="match-state" class="match-state"><i></i><span>Em andamento</span></div>
    </div>
    <div class="play-grid">
      <section class="battle-panel" aria-label="Campo de batalha">
        <div class="battle-wrap">
          <div id="battlefield" aria-label="Tabuleiro da Passagem do Sal"></div>
          <div class="map-chrome" aria-hidden="true">
            <i class="corner top-left"></i><i class="corner top-right"></i><i class="corner bottom-left"></i><i class="corner bottom-right"></i>
            <div class="map-factions">
              <span><i></i>Cais de Âmbar</span>
              <span><i></i>Casa de Ardósia</span>
            </div>
            <div class="compass"><span>N</span><i></i></div>
            <span class="water-name">Estreito do Sal</span>
          </div>
          <div id="notice" class="notice" role="status" hidden></div>
          <div id="veil" class="veil" hidden>
            <div class="veil-content" role="dialog" aria-modal="true" aria-labelledby="veil-title">
              <div id="veil-icon" class="veil-seal"></div>
              <h2 id="veil-title"></h2>
              <p id="veil-copy"></p>
              <button id="veil-action" type="button" class="primary-button"></button>
            </div>
          </div>
        </div>
      </section>
      <aside class="brief-panel" aria-label="Painel da escaramuça">
        <div class="brief-content">
          <div class="caption kicker">${icon('flag', 15)} Missão de conquista</div>
          <h2>A Passagem<br>do Sal</h2>
          <p>Erga uma guarnição e tome o estreito antes que a Casa de Ardósia avance sobre o cais.</p>
        </div>
        <div class="objectives">
          <h3 class="caption">Objetivos</h3>
          <ul>
            <li id="objective-wood"><span class="task-marker">${icon('check', 11)}</span>Depositar madeira na sede</li>
            <li id="objective-build"><span class="task-marker">${icon('check', 11)}</span>Construir um quartel</li>
            <li id="objective-train"><span class="task-marker">${icon('check', 11)}</span>Treinar um guarda</li>
            <li id="objective-win"><span class="task-marker">${icon('check', 11)}</span>Destruir a sede rival</li>
          </ul>
        </div>
        <div class="minimap">
          <h3 class="caption">${icon('map', 16)} Mapa tático</h3>
          <canvas id="minimap" width="260" height="146" role="img" aria-label="Visão geral das duas ilhas e das tropas"></canvas>
          <div class="minimap-key"><span><i></i>Aliados</span><span><i></i>Rivais</span></div>
        </div>
      </aside>
    </div>
    <section class="command-deck" aria-label="Painel de comando">
      <div class="selection-pane">
        <div id="portrait" class="portrait">${icon('hand', 26)}</div>
        <div class="selection-copy"><div class="caption" id="selection-label">Seleção</div>
          <strong id="selection-name">Selecione uma unidade</strong><span id="selection-detail">Use W e clique com o botão direito em um bosque.</span>
        </div>
      </div>
      <div class="orders-pane">
        <h3 class="caption">Comandos</h3>
        <div class="order-buttons">
          <button class="order-button" id="build" type="button" title="Construir quartel (B)">
            <span class="order-symbol">${icon('barracks', 23)}</span><span><strong>Erguer quartel</strong><small>${icon('logs', 13)} ${BARRACKS_COST}</small></span><kbd>B</kbd>
          </button>
          <button class="order-button" id="train" type="button" title="Treinar guarda (T)">
            <span class="order-symbol">${icon('shield', 21)}</span><span><strong>Treinar guarda</strong><small>${icon('logs', 13)} ${GUARD_COST}</small></span><kbd>T</kbd>
          </button>
        </div>
      </div>
      <div class="journal-pane">
        <h3 class="caption">${icon('journal', 15)} Registro de campo</h3>
        <ol id="journal" aria-live="polite"></ol>
      </div>
    </section>
    <footer class="help">
      <span>${icon('mouse', 15)} <strong>Clique / arraste</strong> seleciona <i></i><strong>Botão direito</strong> dá ordens</span>
      <span>${icon('keyboard', 16)} <kbd>W</kbd> trabalhadores <kbd>A</kbd> guardas <kbd>Esc</kbd> cancelar</span>
    </footer>
  </main>
`;

function get<T extends HTMLElement = HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

const battlefield = get('battlefield');
const mini = get<HTMLCanvasElement>('minimap');
const notice = get('notice');
const buildButton = get<HTMLButtonElement>('build');
const trainButton = get<HTMLButtonElement>('train');
const pauseButton = get<HTMLButtonElement>('pause');
const status = get('match-state');
const veil = get('veil');
const veilAction = get<HTMLButtonElement>('veil-action');
const portrait = get('portrait');
let match = new Match();
let selection: number[] = [];
let placing = false;
let noticeTimer: number | undefined;
let noticeType = 'normal';
let lastJournal: Match['activity'][number] | undefined;
let lastPortrait = '';
let lastVeil: string | null = null;

const portraits = {
  worker: person('amber', 'worker').toDataURL(),
  guard: person('amber', 'guard').toDataURL(),
  seat: structure('amber', 'seat').toDataURL(),
  barracks: structure('amber', 'barracks').toDataURL(),
};

const time = (elapsed: number) => {
  const seconds = Math.floor(elapsed);
  return [Math.floor(seconds / 60), seconds % 60].map((part) => String(part).padStart(2, '0')).join(':');
};
const number = (amount: number) => String(amount).padStart(2, '0');

function selectedEntities() {
  return selection.map((id) => match.entity(id)).filter((entity): entity is Entity => !!entity);
}

function selectedUnits() {
  return selectedEntities().filter((entity): entity is Unit => entity.category === 'unit');
}

function selectedWorkers() {
  return selectedUnits().filter((unit) => unit.kind === 'worker');
}

function selectedBarracks() {
  return selectedEntities().find((entity): entity is Building => entity.category === 'building' && entity.kind === 'barracks');
}

function setText(element: HTMLElement, text: string) {
  if (element.textContent !== text) element.textContent = text;
}

function showNotice(copy: string, kind = 'normal', stay = false) {
  window.clearTimeout(noticeTimer);
  setText(notice, copy);
  noticeType = kind;
  notice.dataset.kind = kind;
  notice.hidden = false;
  if (!stay) {
    noticeTimer = window.setTimeout(() => {
      if (placing && noticeType === 'invalid') placementNotice();
      else notice.hidden = true;
    }, 3200);
  }
}

function placementNotice() {
  showNotice('Escolha um terreno livre na sua ilha · Esc para cancelar', 'placement', true);
}

function setPlacing(active: boolean) {
  placing = active;
  scene.setPlacement(active);
  if (active) placementNotice();
  else if (noticeType === 'placement' || noticeType === 'invalid') {
    window.clearTimeout(noticeTimer);
    notice.hidden = true;
  }
}

function select(ids: number[]) {
  if (match.result || match.paused) return;
  selection = ids;
  setPlacing(false);
  scene.setSelection(ids);
  refresh();
}

function togglePlacement() {
  if (placing) {
    setPlacing(false);
    refresh();
    return;
  }
  if (match.paused || match.result) return;
  if (!selectedWorkers().length) {
    showNotice('Selecione um trabalhador para construir.', 'hint');
    return;
  }
  if (match.wood.amber < BARRACKS_COST) {
    showNotice('Faltam ' + (BARRACKS_COST - match.wood.amber) + ' de madeira para erguer o quartel.', 'hint');
    return;
  }
  setPlacing(true);
  refresh();
}

function train() {
  if (match.paused || match.result) return;
  const barracks = selectedBarracks();
  if (!barracks || barracks.progress < 1) {
    showNotice('Selecione um quartel concluído para treinar guardas.', 'hint');
    return;
  }
  if (!match.train(barracks)) {
    if (match.wood.amber < GUARD_COST) showNotice('Faltam ' + (GUARD_COST - match.wood.amber) + ' de madeira para treinar.', 'hint');
    else if (match.reserved('amber') >= POP_CAP) showNotice('Limite de população atingido.', 'hint');
    else showNotice('A fila do quartel está cheia.', 'hint');
    return;
  }
  refresh();
}

function command(kind: 'select' | 'place' | 'order', point: Point, target?: Entity) {
  if (match.paused || match.result) return;
  const cell = cellAt(point.x, point.y);
  if (kind === 'select') {
    select(target?.side === 'amber' ? [target.id] : []);
    if (target?.side === 'slate') {
      showNotice(`${target.kind === 'seat' ? 'Sede de Ardósia' : target.kind === 'barracks' ? 'Quartel rival' :
        target.kind === 'guard' ? 'Guarda de Ardósia' : 'Trabalhador rival'} · ${Math.ceil(target.hp)} PV`);
    } else {
      const grove = match.groveAt(cell);
      if (grove) showNotice(`${grove.name} · ${grove.wood} de madeira`);
    }
    return;
  }
  if (kind === 'place') {
    if (!match.build('amber', selectedWorkers(), cell)) {
      showNotice('O quartel precisa de espaço livre e acesso às pontes.', 'invalid');
      return;
    }
    setPlacing(false);
    scene.indicate(center(cell));
    refresh();
    return;
  }

  if (placing) {
    setPlacing(false);
    refresh();
    return;
  }
  const units = selectedUnits();
  if (!units.length) {
    showNotice('Selecione uma unidade para dar ordens.', 'hint');
    return;
  }

  const workers = units.filter((unit) => unit.kind === 'worker');
  if (target?.side === 'slate') {
    for (const unit of units) match.order(unit, { kind: 'attack', target: target.id });
    scene.indicate(target, 0xffae91);
  } else if (target?.category === 'building' && target.progress < 1 && workers.length) {
    for (const worker of workers) match.order(worker, { kind: 'build', target: target.id });
    scene.indicate(target);
  } else if (target?.category === 'building' && target.kind === 'seat' && workers.some((worker) => worker.wood)) {
    for (const worker of workers.filter((unit) => unit.wood)) match.order(worker, { kind: 'return' });
    scene.indicate(target);
  } else {
    const grove = match.groveAt(cell);
    if (grove && workers.length) {
      for (const worker of workers) match.order(worker, { kind: 'gather', grove: grove.id });
      scene.indicate(center(grove));
    } else if (match.moveGroup(units, cell)) scene.indicate(center(cell));
    else showNotice(grove ? 'Selecione trabalhadores para coletar madeira.' : 'Esse terreno não pode ser atravessado.', 'hint');
  }
  refresh();
}

function refreshSelection(entities: Entity[]) {
  const first = entities[0];
  let name = 'Selecione uma unidade';
  let detail = 'Use W e clique com o botão direito em um bosque.';
  let label = 'Seleção';
  let art = '';

  if (entities.length > 1) {
    const units = entities.filter((entity) => entity.category === 'unit');
    const workers = units.filter((unit) => unit.kind === 'worker').length;
    const guards = units.length - workers;
    label = 'Grupo selecionado';
    name = entities.length + ' unidades';
    const composition = [workers ? workers + (workers === 1 ? ' trabalhador' : ' trabalhadores') : '',
      guards ? guards + (guards === 1 ? ' guarda' : ' guardas') : ''].filter(Boolean).join(' · ');
    const states = {
      move: 'Em marcha', gather: 'Coletando madeira', build: 'Construindo', attack: 'Em combate',
      return: 'Voltando à sede',
    };
    const active = units.find((unit) => unit.order)?.order;
    detail = [composition, active ? states[active.kind] : ''].filter(Boolean).join(' · ');
    art = guards > 0 ? 'guard group' : 'worker group';
  } else if (first) {
    art = first.kind;
    label = first.category === 'building' ? 'Edificação' : 'Unidade';
    if (first.category === 'building') {
      name = first.kind === 'seat' ? 'Sede do Cais de Âmbar' : 'Quartel';
      if (first.progress < 1) detail = `Em construção · ${Math.floor(first.progress * 100)}%`;
      else if (first.queue.length) {
        const progress = 1 - first.queue[0] / TRAIN_SECONDS;
        detail = `${first.queue.length} na fila · ${Math.floor(progress * 100)}% do treino`;
      } else detail = `${Math.ceil(first.hp)} / ${first.maxHp} PV`;
    } else {
      name = first.kind === 'guard' ? 'Guarda' : 'Trabalhador';
      const order = first.order?.kind;
      const action = order === 'gather' ? first.returning ? 'Levando madeira' : 'Coletando' :
        order === 'build' ? 'Construindo' : order === 'move' ? 'Em marcha' :
          order === 'attack' ? 'Em combate' : order === 'return' ? 'Voltando à sede' : 'Disponível';
      detail = `${first.hp} / ${first.maxHp} PV · ${action}`;
    }
  }
  setText(get('selection-label'), label);
  setText(get('selection-name'), name);
  setText(get('selection-detail'), detail);

  if (art !== lastPortrait) {
    lastPortrait = art;
    if (art) {
      const [kind, group] = art.split(' ') as [keyof typeof portraits, string?];
      portrait.dataset.icon = kind;
      portrait.classList.toggle('group', !!group);
      const image = `<img src="${portraits[kind]}" alt="">`;
      portrait.innerHTML = group ? image + image : image;
    } else {
      delete portrait.dataset.icon;
      portrait.classList.remove('group');
      portrait.innerHTML = icon('hand', 26);
    }
  }
}

function refresh() {
  const entities = selectedEntities();
  if (entities.length !== selection.length) {
    selection = entities.map((entity) => entity.id);
    scene.setSelection(selection);
    if (placing && !selectedWorkers().length) setPlacing(false);
  }
  refreshSelection(entities);
  setText(get('wood'), number(match.wood.amber));
  const pop = `${number(match.population('amber'))} <small>/ ${POP_CAP}</small>`;
  if (get('population').innerHTML !== pop) get('population').innerHTML = pop;
  setText(get('clock'), time(match.time));
  setText(status.querySelector('span')!, match.result === 'victory' ? 'Vitória' :
    match.result === 'defeat' ? 'Derrota' : match.paused ? 'Em pausa' : 'Em andamento');
  status.dataset.state = match.result ?? (match.paused ? 'paused' : 'active');

  const live = !match.paused && !match.result;
  const barracks = selectedBarracks();
  buildButton.disabled = !live || !selectedWorkers().length || match.wood.amber < BARRACKS_COST;
  buildButton.setAttribute('aria-pressed', String(placing));
  trainButton.disabled = !live || !barracks || barracks.progress < 1 || match.wood.amber < GUARD_COST ||
    match.reserved('amber') >= POP_CAP || barracks.queue.length >= 6;
  pauseButton.disabled = !!match.result;
  const pauseLabel = match.paused ? 'Retomar' : 'Pausar';
  if (pauseButton.getAttribute('aria-label') !== pauseLabel) {
    pauseButton.setAttribute('aria-label', pauseLabel);
    pauseButton.title = pauseLabel + ' (Espaço)';
    pauseButton.innerHTML = icon(match.paused ? 'play' : 'pause', 18);
  }
  get('objective-wood').classList.toggle('done', match.milestones.gathered);
  get('objective-build').classList.toggle('done', match.milestones.built);
  get('objective-train').classList.toggle('done', match.milestones.trained);
  get('objective-win').classList.toggle('done', match.result === 'victory');

  if (lastJournal !== match.activity[0]) {
    lastJournal = match.activity[0];
    const entries = match.activity.slice(0, 2).map((entry) => {
      const row = document.createElement('li');
      const stamp = document.createElement('time');
      stamp.textContent = time(entry.at);
      const copy = document.createElement('span');
      copy.textContent = entry.text;
      row.classList.toggle('alert', entry.level === 'alert');
      row.append(stamp, copy);
      return row;
    });
    get('journal').replaceChildren(...entries);
  }

  const curtain = match.result ?? (match.paused ? 'pause' : null);
  if (curtain !== lastVeil) {
    lastVeil = curtain;
    veil.hidden = !curtain;
    if (curtain) {
      const state = curtain === 'victory' ? {
        title: 'O estreito é seu', copy: 'A sede de Ardósia caiu. O Cais de Âmbar controla a Passagem do Sal.', symbol: 'flag',
      } as const : curtain === 'defeat' ? {
        title: 'O cais caiu', copy: 'A Casa de Ardósia tomou sua sede e conquistou a passagem.', symbol: 'shield',
      } as const : {
        title: 'Partida pausada', copy: 'A escaramuça aguarda suas ordens.', symbol: 'pause',
      } as const;
      setText(get('veil-title'), state.title);
      setText(get('veil-copy'), state.copy);
      get('veil-icon').innerHTML = icon(state.symbol, 27);
      setText(veilAction, curtain === 'pause' ? 'Retomar partida' : 'Jogar novamente');
      veilAction.focus();
    }
  }
  scene.paintMinimap(mini);
}

function pause() {
  if (match.result) return;
  if (match.paused) {
    match.paused = false;
    pauseButton.focus();
  } else {
    setPlacing(false);
    match.paused = true;
  }
  refresh();
}

function restart() {
  match = new Match();
  selection = [];
  placing = false;
  window.clearTimeout(noticeTimer);
  notice.hidden = true;
  scene.reset(match);
  refresh();
}

const scene = new Battlefield(match, { selected: select, command, refresh });
startBattlefield(battlefield, scene);

buildButton.addEventListener('click', togglePlacement);
trainButton.addEventListener('click', train);
pauseButton.addEventListener('click', pause);
get('restart').addEventListener('click', restart);
veilAction.addEventListener('click', () => {
  if (match.paused) pause();
  else {
    restart();
    get('restart').focus();
  }
});

window.addEventListener('keydown', (event) => {
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.code === 'Space') {
    if (event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    pause();
    return;
  }
  if (match.paused || match.result) return;
  switch (event.code) {
    case 'KeyA':
    case 'KeyW': {
      const kind = event.code === 'KeyA' ? 'guard' : 'worker';
      select(match.units.filter((unit) => unit.side === 'amber' && unit.kind === kind).map((unit) => unit.id));
      break;
    }
    case 'KeyB': togglePlacement(); break;
    case 'KeyT': train(); break;
    case 'Escape':
      if (placing) {
        setPlacing(false);
        refresh();
      } else select([]);
      break;
  }
});

import {
  TILE, cellAt, center, findPath, groves, inFootprint, inside, isCrossing, isLand, onShore, seats, west, east,
  type Cell, type Point,
} from './map';

export type Side = 'amber' | 'slate';
export type UnitKind = 'worker' | 'guard';
export type BuildingKind = 'seat' | 'barracks';

type Order =
  | { kind: 'move'; cell: Cell }
  | { kind: 'gather'; grove: number }
  | { kind: 'build' | 'attack'; target: number }
  | { kind: 'return' };

type Body = Point & { id: number; side: Side; hp: number; maxHp: number };
export type Unit = Body & {
  category: 'unit'; kind: UnitKind; order: Order | null; wood: number; work: number;
  route: Cell[]; destination: Cell | null; replan: number; cooldown: number; strike: number;
  facing: number; moving: boolean; returning: boolean; raider: boolean;
};
export type Building = Body & {
  category: 'building'; kind: BuildingKind; cell: Cell; progress: number; queue: number[]; phase: number;
};
export type Entity = Unit | Building;
export type Grove = Cell & { id: number; name: string; wood: number };
export type Entry = { at: number; text: string; level: 'normal' | 'alert' };

export const BARRACKS_COST = 125;
export const GUARD_COST = 40;
export const POP_CAP = 18;
export const GROVE_WOOD = 360;
export const BUILD_SECONDS = 10;
export const TRAIN_SECONDS = 6;
const LOAD = 15;

const other = (side: Side): Side => side === 'amber' ? 'slate' : 'amber';
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const footprintDistance = (point: Point, target: Building | Grove) => {
  const origin = 'category' in target ? target : center(target);
  return Math.hypot(Math.max(0, Math.abs(point.x - origin.x) - TILE),
    Math.max(0, Math.abs(point.y - origin.y) - TILE));
};
const sameCell = (a: Cell | null, b: Cell) => a?.x === b.x && a?.y === b.y;

export class Match {
  time = 0;
  paused = false;
  result: 'victory' | 'defeat' | null = null;
  wood = { amber: 100, slate: 100 };
  units: Unit[] = [];
  buildings: Building[] = [];
  groves: Grove[] = groves.map((grove, id) => ({ ...grove, id, wood: GROVE_WOOD }));
  activity: Entry[] = [];
  milestones = { gathered: false, built: false, trained: false };
  private nextId = 1;
  private aiClock = 0;
  private nextRaid = 74;
  private underAttack = false;

  constructor() {
    for (const side of ['amber', 'slate'] as const) {
      const cell = seats[side];
      this.addBuilding(side, 'seat', cell);
      const direction = side === 'amber' ? 1 : -1;
      for (const [dx, dy] of [[-1, -3], [0, -3], [1, -3]]) {
        this.addUnit(side, 'worker', { x: cell.x + dx, y: cell.y + dy });
      }
      for (const [dx, dy] of [[3, 0], [3, 1]]) {
        this.addUnit(side, 'guard', { x: cell.x + dx * direction, y: cell.y + dy });
      }
    }
    this.log('A guarnição do Cais de Âmbar aguarda ordens.');
  }

  log(text: string, level: Entry['level'] = 'normal') {
    this.activity.unshift({ at: this.time, text, level });
    this.activity.length = Math.min(8, this.activity.length);
  }

  entities(): Entity[] {
    return [...this.buildings, ...this.units];
  }

  entity(id: number): Entity | undefined {
    return this.units.find((unit) => unit.id === id) ?? this.buildings.find((building) => building.id === id);
  }

  seat(side: Side) {
    return this.buildings.find((building) => building.side === side && building.kind === 'seat');
  }

  population(side: Side) {
    return this.units.filter((unit) => unit.side === side).length;
  }

  reserved(side: Side) {
    return this.population(side) + this.buildings.reduce((total, building) =>
      building.side === side ? total + building.queue.length : total, 0);
  }

  groveAt(cell: Cell) {
    return this.groves.find((grove) => grove.wood > 0 && inFootprint(cell, grove, 1));
  }

  buildingAt(cell: Cell) {
    return this.buildings.find((building) => building.hp > 0 && inFootprint(cell, building.cell, 1));
  }

  walkable(cell: Cell) {
    return inside(cell) && (isLand(cell) || isCrossing(cell)) && !this.groveAt(cell) && !this.buildingAt(cell);
  }

  canBuild(side: Side, cell: Cell) {
    const shore = side === 'amber' ? west : east;
    for (let y = cell.y - 1; y <= cell.y + 1; y++) {
      for (let x = cell.x - 1; x <= cell.x + 1; x++) {
        const tile = { x, y };
        if (!onShore(tile, shore) || isCrossing(tile) || !this.walkable(tile) ||
          this.units.some((unit) => inFootprint(cellAt(unit.x, unit.y), tile, 0))) {
          return false;
        }
      }
    }
    // Keep an approach open and keep bridges and groves connected to the seat.
    const seat = this.seat(side);
    if (!seat) return false;
    const available = (tile: Cell) => this.walkable(tile) && !inFootprint(tile, cell, 1);
    const origin = this.ring(seat.cell, 2).find(available);
    if (!origin || !this.ring(cell, 2).some((tile) => available(tile) && findPath(origin, tile, available) !== null)) {
      return false;
    }
    const exits = side === 'amber' ? [{ x: 22, y: 8 }, { x: 23, y: 20 }] :
      [{ x: 29, y: 8 }, { x: 27, y: 20 }];
    return exits.every((exit) => findPath(origin, exit, available) !== null) &&
      this.groves.filter((grove) => grove.wood > 0 && onShore(grove, shore))
        .every((grove) => this.ring(grove, 2).some((tile) =>
          available(tile) && findPath(origin, tile, available) !== null));
  }

  private addUnit(side: Side, kind: UnitKind, cell: Cell) {
    const maxHp = kind === 'guard' ? 76 : 45;
    const unit: Unit = {
      ...center(cell), id: this.nextId++, side, hp: maxHp, maxHp, category: 'unit', kind, order: null,
      wood: 0, work: 0, route: [], destination: null, replan: 0, cooldown: 0,
      strike: 0, facing: side === 'amber' ? 1 : -1, moving: false, returning: false, raider: false,
    };
    this.units.push(unit);
    return unit;
  }

  private addBuilding(side: Side, kind: BuildingKind, cell: Cell) {
    const maxHp = kind === 'seat' ? 465 : 285;
    const building: Building = {
      ...center(cell), id: this.nextId++, side, hp: kind === 'seat' ? maxHp : 70,
      maxHp, category: 'building', kind, cell, progress: kind === 'seat' ? 1 : 0,
      queue: [], phase: 0,
    };
    this.buildings.push(building);
    return building;
  }

  build(side: Side, workers: Unit[], cell: Cell) {
    if (this.paused || this.result || this.wood[side] < BARRACKS_COST || !workers.length || !this.canBuild(side, cell)) {
      return false;
    }
    const standing = workers.filter((unit) => unit.hp > 0 && unit.side === side && unit.kind === 'worker');
    if (!standing.length) return false;

    this.wood[side] -= BARRACKS_COST;
    const building = this.addBuilding(side, 'barracks', cell);
    for (const worker of standing) this.order(worker, { kind: 'build', target: building.id });
    for (const unit of this.units) {
      if (unit.route.some((tile) => inFootprint(tile, cell, 1))) {
        unit.route = [];
        unit.destination = null;
        unit.replan = 0;
      }
    }
    if (side === 'amber') this.log('As fundações do quartel foram marcadas.');
    else this.log('A Casa de Ardósia iniciou a construção de um quartel.');
    return true;
  }

  train(building: Building) {
    const { side } = building;
    if (this.paused || this.result || building.hp <= 0 || building.kind !== 'barracks' || building.progress < 1 ||
      this.wood[side] < GUARD_COST || this.reserved(side) >= POP_CAP || building.queue.length >= 6) return false;

    this.wood[side] -= GUARD_COST;
    building.queue.push(TRAIN_SECONDS);
    return true;
  }

  order(unit: Unit, order: Order | null) {
    unit.order = order;
    unit.work = 0;
    unit.route = [];
    unit.destination = null;
    unit.replan = 0;
    unit.returning = order?.kind === 'return' || (order?.kind === 'gather' && unit.wood >= LOAD);
  }

  moveGroup(units: Unit[], goal: Cell) {
    if (!this.walkable(goal)) return false;

    const assigned: Cell[] = [];
    const options = [goal, ...Array.from({ length: 5 }, (_, index) => this.ring(goal, index + 1)).flat()];
    const sorted = [...units].sort((a, b) => distance(a, center(goal)) - distance(b, center(goal)));
    for (const unit of sorted) {
      const tile = options.find((option) => this.walkable(option) &&
        !assigned.some((used) => sameCell(used, option)) &&
        findPath(cellAt(unit.x, unit.y), option, (cell) => this.walkable(cell)) !== null);
      if (!tile) continue;
      assigned.push(tile);
      this.order(unit, { kind: 'move', cell: tile });
    }
    return assigned.length > 0;
  }

  private ring(cell: Cell, radius: number) {
    const tiles: Cell[] = [];
    for (let y = -radius; y <= radius; y++) {
      for (let x = -radius; x <= radius; x++) {
        if (Math.max(Math.abs(x), Math.abs(y)) === radius) tiles.push({ x: cell.x + x, y: cell.y + y });
      }
    }
    return tiles;
  }

  private approach(unit: Unit, point: Point, radius: number) {
    const origin = cellAt(unit.x, unit.y);
    const cell = cellAt(point.x, point.y);
    const options = (radius === 1 ? this.ring(cell, 2) : [cell, ...this.ring(cell, 1)])
      .filter((tile) => {
        if (!this.walkable(tile)) return false;
        const position = center(tile);
        if (radius === 0) return distance(position, point) <= 23;
        return Math.hypot(Math.max(0, Math.abs(position.x - point.x) - TILE),
          Math.max(0, Math.abs(position.y - point.y) - TILE)) <= 40;
      })
      .sort((a, b) => this.approachScore(unit, a, point) - this.approachScore(unit, b, point));
    for (const tile of options) {
      const route = findPath(origin, tile, (next) => this.walkable(next));
      if (route !== null) {
        unit.route = route;
        unit.destination = tile;
        return;
      }
    }
    unit.destination = null;
    unit.route = [];
  }

  private approachScore(unit: Unit, cell: Cell, point: Point) {
    const position = center(cell);
    const occupied = this.units.some((peer) => peer !== unit && peer.side === unit.side &&
      (sameCell(peer.destination, cell) || distance(peer, position) < 11));
    return distance(unit, position) + distance(point, position) * .4 + (occupied ? 44 : 0);
  }

  private travel(unit: Unit, dt: number) {
    const waypoint = unit.route[0] ?? unit.destination;
    if (!waypoint) return true;

    const point = center(waypoint);
    const remaining = distance(unit, point);
    const step = (unit.kind === 'guard' ? 86 : 73) * dt;
    if (remaining <= step) {
      unit.x = point.x;
      unit.y = point.y;
      if (unit.route.length) unit.route.shift();
      return !unit.route.length && sameCell(unit.destination, waypoint);
    }

    const dx = point.x - unit.x;
    const dy = point.y - unit.y;
    unit.x += dx / remaining * step;
    unit.y += dy / remaining * step;
    if (Math.abs(dx) > 2) unit.facing = Math.sign(dx);
    unit.moving = true;
    return false;
  }

  private travelTo(unit: Unit, point: Point, footprint: number, dt: number) {
    if (unit.replan <= 0) {
      if (!unit.destination || (footprint === 0 && distance(center(unit.destination), point) > 23)) {
        this.approach(unit, point, footprint);
      }
      unit.replan = .55;
    }
    this.travel(unit, dt);
  }

  private harvest(unit: Unit, grove: Grove, dt: number) {
    if (unit.returning || grove.wood <= 0) {
      if (!unit.wood) {
        const replacement = this.closestGrove(unit);
        this.order(unit, replacement ? { kind: 'gather', grove: replacement.id } : null);
        return;
      }
      this.deposit(unit, dt);
      return;
    }
    if (footprintDistance(unit, grove) > 40) {
      this.travelTo(unit, center(grove), 1, dt);
      return;
    }
    const trunk = center(grove);
    if (Math.abs(trunk.x - unit.x) > 2) unit.facing = Math.sign(trunk.x - unit.x);
    unit.work += dt;
    if (unit.work < .9) return;

    unit.work = 0;
    const amount = Math.min(5, grove.wood, LOAD - unit.wood);
    unit.wood += amount;
    grove.wood -= amount;
    unit.strike = .24;
    if (unit.wood >= LOAD || grove.wood <= 0) {
      unit.returning = true;
      unit.destination = null;
      unit.route = [];
      unit.replan = 0;
    }
  }

  private deposit(unit: Unit, dt: number) {
    const seat = this.seat(unit.side);
    if (!seat) return;
    if (footprintDistance(unit, seat) > 40) {
      this.travelTo(unit, seat, 1, dt);
      return;
    }
    if (unit.wood > 0) {
      this.wood[unit.side] += unit.wood;
      if (unit.side === 'amber' && !this.milestones.gathered) {
        this.milestones.gathered = true;
        this.log('A primeira carga de madeira chegou à sede.');
      }
    }
    unit.wood = 0;
    this.order(unit, unit.order?.kind === 'gather' ? unit.order : null);
  }

  private construct(unit: Unit, building: Building, dt: number) {
    if (building.progress >= 1) {
      this.order(unit, null);
      return;
    }
    if (footprintDistance(unit, building) > 40) {
      this.travelTo(unit, building, 1, dt);
      return;
    }
    const before = building.progress;
    building.progress = Math.min(1, building.progress + dt / BUILD_SECONDS);
    building.hp = Math.min(building.maxHp, building.hp + (building.progress - before) * (building.maxHp - 70));
    if (building.progress < 1) return;
    if (unit.side === 'amber') this.milestones.built = true;
    this.log(unit.side === 'amber' ? 'Quartel concluído. A guarda pode ser treinada.' :
      'O quartel da Casa de Ardósia está em operação.');
  }

  private fight(unit: Unit, target: Entity, dt: number, pursue: boolean) {
    const range = target.category === 'building' ? footprintDistance(unit, target) : distance(unit, target);
    if (range > (target.category === 'building' ? 40 : 23)) {
      if (pursue) this.travelTo(unit, target, target.category === 'building' ? 1 : 0, dt);
      return;
    }
    if (Math.abs(target.x - unit.x) > 2) unit.facing = Math.sign(target.x - unit.x);
    if (unit.cooldown > 0) return;

    unit.cooldown = unit.kind === 'guard' ? .8 : 1.25;
    unit.strike = .27;
    target.hp = Math.max(0, target.hp - (unit.kind === 'guard' ? 12 : 3));
    if (target.category === 'building' && target.kind === 'seat' && target.side === 'amber' && !this.underAttack) {
      this.underAttack = true;
      this.log('A sede do Cais de Âmbar está sob ataque.', 'alert');
    }
  }

  private closestGrove(unit: Unit) {
    const shore = unit.side === 'amber' ? west : east;
    return this.groves.filter((grove) => grove.wood > 0 && onShore(grove, shore))
      .sort((a, b) => distance(unit, center(a)) - distance(unit, center(b)))[0];
  }

  private nearbyEnemy(unit: Unit, radius: number) {
    return this.units.filter((peer) => peer.hp > 0 && peer.side !== unit.side && distance(peer, unit) < radius)
      .sort((a, b) => distance(a, unit) - distance(b, unit))[0];
  }

  private updateUnit(unit: Unit, dt: number) {
    unit.moving = false;
    unit.replan -= dt;
    unit.cooldown -= dt;
    unit.strike = Math.max(0, unit.strike - dt);

    const order = unit.order;
    if (unit.kind === 'guard' && (!order || (unit.raider && order.kind === 'attack' &&
      this.entity(order.target)?.category === 'building'))) {
      const enemy = this.nearbyEnemy(unit, unit.raider ? 112 : 68);
      if (enemy) {
        if (unit.raider) this.order(unit, { kind: 'attack', target: enemy.id });
        else this.fight(unit, enemy, dt, false);
        if (!unit.raider) return;
      }
    }
    const action = unit.order;
    if (!action) return;
    switch (action.kind) {
      case 'move':
        if (!unit.destination) {
          unit.route = findPath(cellAt(unit.x, unit.y), action.cell, (cell) => this.walkable(cell)) ?? [];
          if (!unit.route.length && !sameCell(cellAt(unit.x, unit.y), action.cell)) {
            this.order(unit, null);
            break;
          }
          unit.destination = action.cell;
        }
        if (this.travel(unit, dt)) this.order(unit, null);
        break;
      case 'gather':
        this.harvest(unit, this.groves[action.grove], dt);
        break;
      case 'return':
        this.deposit(unit, dt);
        break;
      case 'build': {
        const building = this.entity(action.target);
        if (building?.category === 'building' && building.hp > 0) this.construct(unit, building, dt);
        else this.order(unit, null);
        break;
      }
      case 'attack': {
        const target = this.entity(action.target);
        const threat = target?.category === 'building' && unit.kind === 'guard' ? this.nearbyEnemy(unit, 23) : null;
        if (threat) this.fight(unit, threat, dt, false);
        else if (target && target.hp > 0) this.fight(unit, target, dt, true);
        else this.order(unit, null);
        break;
      }
    }
  }

  private separateUnits(dt: number) {
    for (let first = 0; first < this.units.length; first++) {
      const unit = this.units[first];
      for (let second = first + 1; second < this.units.length; second++) {
        const peer = this.units[second];
        const gap = distance(unit, peer);
        if (gap >= 15 || unit.side !== peer.side) continue;

        const dx = gap > .01 ? (peer.x - unit.x) / gap : 1;
        const dy = gap > .01 ? (peer.y - unit.y) / gap : 0;
        const offset = Math.min((15 - gap) / 2, 17 * dt);
        for (const [mover, direction] of [[unit, -1], [peer, 1]] as const) {
          const x = mover.x + dx * offset * direction;
          const y = mover.y + dy * offset * direction;
          if (this.walkable(cellAt(x, y))) {
            mover.x = x;
            mover.y = y;
          }
        }
      }
    }
  }

  private updateTraining(building: Building, dt: number) {
    if (!building.queue.length || building.hp <= 0) return;

    building.queue[0] = Math.max(0, building.queue[0] - dt);
    if (building.queue[0] > 0) return;

    const direction = building.side === 'amber' ? 1 : -1;
    const door = { x: building.x + direction * TILE * 2, y: building.y + TILE };
    const area = this.ring(building.cell, 2).filter((tile) => this.walkable(tile) &&
      !this.units.some((unit) => distance(unit, center(tile)) < 19));
    const tile = area.sort((a, b) => distance(door, center(a)) - distance(door, center(b)))[0];
    if (!tile) return;

    building.queue.shift();
    this.addUnit(building.side, 'guard', tile);
    if (building.side === 'amber' && !this.milestones.trained) {
      this.milestones.trained = true;
      this.log('O primeiro guarda está pronto para marchar.');
    }
  }

  private updateOpponent() {
    const barracks = this.buildings.find((building) => building.side === 'slate' && building.kind === 'barracks');
    const workers = this.units.filter((unit) => unit.side === 'slate' && unit.kind === 'worker');
    if (!barracks && this.wood.slate >= BARRACKS_COST && workers.length) {
      for (const tile of [{ x: 36, y: 11 }, { x: 36, y: 16 }, { x: 40, y: 18 }]) {
        if (this.build('slate', [workers[workers.length - 1]], tile)) break;
      }
    }
    if (barracks && barracks.progress < 1 && !workers.some((unit) => unit.order?.kind === 'build') && workers[0]) {
      this.order(workers[0], { kind: 'build', target: barracks.id });
    }
    for (const worker of workers) {
      if (worker.order) continue;
      const grove = this.closestGrove(worker);
      if (grove) this.order(worker, { kind: 'gather', grove: grove.id });
    }
    const guards = this.units.filter((unit) => unit.side === 'slate' && unit.kind === 'guard');
    if (barracks && guards.length + barracks.queue.length < 7 && barracks.queue.length < 1) this.train(barracks);

    const ready = guards.filter((unit) => !unit.raider);
    if (this.time >= this.nextRaid && this.seat('amber') && ready.length >= 4) {
      const column = ready.slice(0, Math.min(4, ready.length - 1));
      for (const unit of column) unit.raider = true;
      this.nextRaid = this.time + 37;
      this.log('Uma coluna de Ardósia está cruzando a passagem.', 'alert');
    }
    const enemySeat = this.seat('amber');
    for (const unit of guards) {
      if (unit.raider) {
        if (unit.order) continue;
        const target = this.nearbyEnemy(unit, 160) ?? enemySeat;
        if (target) this.order(unit, { kind: 'attack', target: target.id });
      } else {
        const target = this.nearbyEnemy(unit, 170);
        if (target && (!unit.order || unit.order.kind === 'move')) {
          this.order(unit, { kind: 'attack', target: target.id });
        }
      }
    }
  }

  update(dt: number) {
    if (this.paused || this.result) return;

    this.time += dt;
    this.aiClock -= dt;
    if (this.aiClock <= 0) {
      this.aiClock = .45;
      this.updateOpponent();
    }
    for (const unit of this.units) {
      if (unit.hp > 0) this.updateUnit(unit, dt);
    }
    this.separateUnits(dt);
    for (const building of this.buildings) this.updateTraining(building, dt);

    const victory = this.seat('slate')?.hp === 0;
    const defeat = this.seat('amber')?.hp === 0;
    this.units = this.units.filter((unit) => unit.hp > 0);
    this.buildings = this.buildings.filter((building) => building.hp > 0);
    if (victory || defeat) {
      this.result = defeat ? 'defeat' : 'victory';
      this.log(defeat ? 'A sede do Cais de Âmbar caiu.' : 'A sede de Ardósia caiu. A passagem foi conquistada.', 'alert');
    }
  }
}

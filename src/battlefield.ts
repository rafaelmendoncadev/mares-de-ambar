import Phaser from 'phaser';
import { groveArt, heraldry, person, structure, terrain } from './art';
import { HEIGHT, TILE, WIDTH, cellAt, center, type Cell, type Point } from './map';
import { GROVE_WOOD, Match, type Entity, type Unit } from './match';

const gold = 0xf2cd81;
const blue = 0xabd2e6;
const mint = 0xe3ebad;

type Callbacks = {
  selected: (ids: number[]) => void;
  command: (kind: 'select' | 'place' | 'order', point: Point, entity?: Entity) => void;
  refresh: () => void;
};

export class Battlefield extends Phaser.Scene {
  private sprites = new Map<number, Phaser.GameObjects.Image>();
  private forests: Phaser.GameObjects.Image[] = [];
  private overlay!: Phaser.GameObjects.Graphics;
  private ground!: Phaser.GameObjects.Image;
  private press: (Point & { extend: boolean }) | null = null;
  private cursor: Point | null = null;
  private selection: number[] = [];
  private placing = false;
  private site: { key: string; allowed: boolean; checkedAt: number } | null = null;
  private marker: (Point & { color: number; until: number }) | null = null;
  private refreshAt = 0;
  private match: Match;
  private readonly callbacks: Callbacks;

  constructor(match: Match, callbacks: Callbacks) {
    super({ key: 'battlefield' });
    this.match = match;
    this.callbacks = callbacks;
  }

  create() {
    this.textures.addCanvas('terrain', terrain());
    this.ground = this.add.image(0, 0, 'terrain').setOrigin(0, 0);
    for (const side of ['amber', 'slate'] as const) {
      for (const kind of ['seat', 'barracks', 'foundation'] as const) {
        this.textures.addCanvas(side + kind, structure(side, kind));
      }
      for (const kind of ['worker', 'guard'] as const) {
        for (let frame = 0; frame < 4; frame++) {
          this.textures.addCanvas(side + kind + frame, person(side, kind, frame));
        }
      }
    }
    for (const grove of this.match.groves) {
      for (const stage of ['full', 'low', 'stumps'] as const) {
        this.textures.addCanvas('grove' + grove.id + stage, groveArt(grove.id, stage));
      }
      const { x, y } = center(grove);
      this.forests.push(this.add.image(x, y, 'grove' + grove.id + 'full').setOrigin(.5, 89 / 148));
    }
    this.overlay = this.add.graphics().setDepth(HEIGHT + 4);
    this.input.mouse?.disableContextMenu();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const point = { x: pointer.x, y: pointer.y };
      if (pointer.button === 2) {
        this.press = null;
        this.callbacks.command('order', point, this.hit(point));
      } else if (pointer.button === 0) {
        this.press = { ...point, extend: !!(pointer.event as MouseEvent).shiftKey };
      }
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.cursor = { x: pointer.x, y: pointer.y };
      this.updateCursor();
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.press || pointer.button !== 0) return;

      const point = { x: pointer.x, y: pointer.y };
      const start = this.press;
      this.press = null;
      if (this.placing) {
        this.callbacks.command('place', point);
        return;
      }
      if (Math.hypot(start.x - point.x, start.y - point.y) >= 15) {
        const left = Math.min(start.x, point.x);
        const right = Math.max(start.x, point.x);
        const top = Math.min(start.y, point.y);
        const bottom = Math.max(start.y, point.y);
        const ids = this.match.units.filter((unit) => unit.side === 'amber' && unit.x >= left &&
          unit.x <= right && unit.y - 10 >= top && unit.y - 10 <= bottom).map((unit) => unit.id);
        this.callbacks.selected(start.extend ? [...new Set([...this.selection, ...ids])] : ids);
      } else if (start.extend) {
        const entity = this.hit(point);
        if (!entity || entity.side !== 'amber' || entity.category !== 'unit') return;
        const units = this.selection.filter((id) => this.match.entity(id)?.category === 'unit');
        this.callbacks.selected(units.includes(entity.id) ? units.filter((id) => id !== entity.id) : [...units, entity.id]);
      } else this.callbacks.command('select', point, this.hit(point));
    });
    this.input.on('pointerupoutside', () => { this.press = null; });
    this.input.on('gameout', () => { this.cursor = null; });
    this.callbacks.refresh();
  }

  reset(match: Match) {
    this.match = match;
    this.press = null;
    this.cursor = null;
    this.selection = [];
    this.placing = false;
    this.site = null;
    this.marker = null;
    this.updateCursor();
  }

  setSelection(selection: number[]) {
    this.selection = selection;
  }

  setPlacement(placing: boolean) {
    this.placing = placing;
    this.site = null;
    this.updateCursor();
  }

  indicate(point: Point, color = mint) {
    if (this.time) this.marker = { ...point, color, until: this.time.now + 850 };
  }

  private hit(point: Point): Entity | undefined {
    const alive = this.match.entities();
    const units = alive.filter((unit): unit is Unit => unit.category === 'unit' &&
      Math.abs(unit.x - point.x) < 16 && point.y > unit.y - 36 && point.y < unit.y + 10);
    const unit = units.sort((a, b) => Math.hypot(a.x - point.x, a.y - 14 - point.y) -
      Math.hypot(b.x - point.x, b.y - 14 - point.y))[0];
    return unit ?? alive.find((entity) => entity.category === 'building' &&
      Math.abs(entity.x - point.x) < (entity.kind === 'seat' ? 60 : 49) &&
      point.y >= entity.y - (entity.kind === 'seat' ? 76 : 56) && point.y <= entity.y + 34);
  }

  private updateCursor() {
    if (!this.game) return;
    const canvas = this.game.canvas;
    if (this.placing) canvas.style.cursor = 'crosshair';
    else if (this.cursor && this.hit(this.cursor)) canvas.style.cursor = 'pointer';
    else if (this.cursor && this.match.groveAt(cellAt(this.cursor.x, this.cursor.y))) canvas.style.cursor = 'pointer';
    else canvas.style.cursor = 'default';
  }

  private buildingGhost(cell: Cell, now: number) {
    const key = cell.x + ',' + cell.y;
    if (!this.site || this.site.key !== key || now - this.site.checkedAt > 240) {
      this.site = { key, checkedAt: now, allowed: this.match.canBuild('amber', cell) };
    }
    const point = center(cell);
    const color = this.site.allowed ? mint : 0xef9a83;
    const size = TILE * 3;
    this.overlay.fillStyle(color, .22).fillRect(point.x - size / 2, point.y - size / 2, size, size);
    this.overlay.lineStyle(2, color, .94).strokeRect(point.x - size / 2, point.y - size / 2, size, size);
    this.overlay.lineStyle(1, color, .76).lineBetween(point.x - 10, point.y, point.x + 10, point.y)
      .lineBetween(point.x, point.y - 10, point.x, point.y + 10);
  }

  update(time: number, delta: number) {
    if (!this.overlay) return;
    this.match.update(Math.min(delta / 1000, .05));

    const entities = this.match.entities();
    const current = new Set(entities.map((entity) => entity.id));
    for (const [id, sprite] of this.sprites) {
      if (current.has(id)) continue;
      sprite.destroy();
      this.sprites.delete(id);
    }
    this.overlay.clear();
    for (const grove of this.match.groves) {
      const sprite = this.forests[grove.id];
      const stage = !grove.wood ? 'stumps' : grove.wood < GROVE_WOOD / 2 ? 'low' : 'full';
      sprite.setTexture('grove' + grove.id + stage).setDepth(center(grove).y + 12);
    }
    const hover = this.cursor && !this.placing ? this.hit(this.cursor) : undefined;
    for (const entity of entities) this.drawEntity(entity, this.match.time, hover?.id === entity.id);

    if (this.cursor && !this.match.result && !this.match.paused) {
      if (this.placing) this.buildingGhost(cellAt(this.cursor.x, this.cursor.y), time);
      else if (this.press && Math.hypot(this.cursor.x - this.press.x, this.cursor.y - this.press.y) >= 15) {
        const x = Math.min(this.cursor.x, this.press.x);
        const y = Math.min(this.cursor.y, this.press.y);
        const width = Math.abs(this.cursor.x - this.press.x);
        const height = Math.abs(this.cursor.y - this.press.y);
        this.overlay.fillStyle(gold, .12).fillRect(x, y, width, height);
        this.overlay.lineStyle(2, gold, .9).strokeRect(x, y, width, height);
      } else if (!hover) {
        const grove = this.match.groveAt(cellAt(this.cursor.x, this.cursor.y));
        if (grove) {
          const point = center(grove);
          this.overlay.lineStyle(2, mint, .72).strokeEllipse(point.x, point.y + 8, 92, 60);
        }
      }
    }
    if (this.marker && this.marker.until > time) {
      const { x, y, color, until } = this.marker;
      const phase = (until - time) / 850;
      this.overlay.lineStyle(2, color, phase).strokeEllipse(x, y, 25 + 35 * (1 - phase), 15 + 23 * (1 - phase));
      this.overlay.fillStyle(color, phase).fillCircle(x, y, 3);
    }

    if (time >= this.refreshAt) {
      this.refreshAt = time + 130;
      this.callbacks.refresh();
    }
  }

  private drawEntity(entity: Entity, time: number, hovered: boolean) {
    const { x, y, side } = entity;
    const unit = entity.category === 'unit';
    const frame = unit ? entity.strike > 0 ? 3 : entity.moving ? 1 + (Math.floor(time * 9 + entity.id) % 2) : 0 : '';
    const key = side + (unit || entity.progress >= 1 ? entity.kind : 'foundation') + frame;
    const sprite = this.sprites.get(entity.id) ?? this.add.image(x, y, key);
    this.sprites.set(entity.id, sprite);
    sprite.setTexture(key).setPosition(x, y).setDepth(y + (unit ? 0 : 15));
    sprite.setOrigin(unit ? 23 / 51 : .5, unit ? 44 / 57 : 112 / 160);
    if (unit) sprite.setFlipX(entity.facing < 0);
    const selected = this.selection.includes(entity.id);

    if (hovered || selected) {
      const color = side === 'amber' ? gold : blue;
      const width = unit ? 29 : entity.kind === 'seat' ? 126 : 105;
      const height = unit ? 13 : entity.kind === 'seat' ? 53 : 47;
      this.overlay.lineStyle(4, 0x20281e, .82).strokeEllipse(x, y + 2, width, height);
      this.overlay.lineStyle(selected ? 2.4 : 1.6, color, selected ? 1 : .7).strokeEllipse(x, y + 2, width, height);
    }
    const progress = !unit && entity.progress < 1 ? entity.progress : null;
    if (selected || hovered || entity.hp < entity.maxHp || progress !== null) {
      const width = unit ? 25 : 70;
      const top = y - (unit ? 43 : entity.kind === 'seat' ? 87 : 67);
      this.overlay.fillStyle(0x192420, .92).fillRoundedRect(x - width / 2 - 2, top - 2, width + 4, 7, 2);
      this.overlay.fillStyle(progress === null ? (side === 'amber' ? 0xb8cc7c : blue) : gold, .95)
        .fillRect(x - width / 2, top, width * (progress ?? (entity.hp / entity.maxHp)), 3);
    }
    if (unit && entity.wood) {
      this.overlay.fillStyle(0x644326, 1).fillRoundedRect(x + 6, y - 17, 12, 8, 2);
      this.overlay.fillStyle(gold, .9).fillRoundedRect(x + 7, y - 17, 10, 4, 2);
    }
  }

  paintMinimap(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx || !this.ground) return;
    const { width, height } = canvas;
    ctx.drawImage(this.textures.get('terrain').getSourceImage() as HTMLCanvasElement, 0, 0, width, height);
    for (const grove of this.match.groves) {
      const point = center(grove);
      ctx.fillStyle = grove.wood ? '#294837' : '#84745b';
      ctx.fillRect(point.x / WIDTH * width - 4, point.y / HEIGHT * height - 3, 8, 6);
    }
    for (const entity of this.match.entities()) {
      const color = heraldry[entity.side].light;
      const x = entity.x / WIDTH * width;
      const y = entity.y / HEIGHT * height;
      if (entity.category === 'unit') {
        ctx.beginPath();
        ctx.arc(x, y, this.selection.includes(entity.id) ? 3 : 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      } else {
        const size = entity.kind === 'seat' ? 10 : 6;
        ctx.fillStyle = '#152222';
        ctx.fillRect(x - size / 2 - 1, y - size / 2 - 1, size + 2, size + 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - size / 2, y - size / 2, size, size);
      }
    }
  }
}

export function startBattlefield(parent: HTMLElement, scene: Battlefield) {
  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    width: WIDTH,
    height: HEIGHT,
    parent,
    scene,
    backgroundColor: '#233e41',
    render: { antialias: true, roundPixels: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    banner: false,
    audio: { noAudio: true },
    disableContextMenu: true,
  });
  return game;
}

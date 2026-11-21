import { HEIGHT, TILE, WIDTH, center, crossings, east, groves, isCrossing, seats, west, type Shore } from './map';
import { type Side } from './match';

type Ink = CanvasRenderingContext2D;
type Pair = [number, number];

export const heraldry = {
  amber: { light: '#fee1a1', fill: '#d39a4b', shadow: '#7e4a29', roof: '#a46943', textile: '#ddae60' },
  slate: { light: '#cce3f2', fill: '#739db1', shadow: '#365260', roof: '#4e7184', textile: '#8baebd' },
};

function random(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function paint(width: number, height: number, draw: (ctx: Ink) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível.');
  draw(ctx);
  return canvas;
}

function path(ctx: Ink, points: Pair[], closed = true) {
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  if (closed) ctx.closePath();
}

function shape(ctx: Ink, color: string, points: Pair[], edge?: string) {
  path(ctx, points);
  ctx.fillStyle = color;
  ctx.fill();
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function line(ctx: Ink, color: string, weight: number, points: Pair[]) {
  path(ctx, points, false);
  ctx.lineWidth = weight;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function ellipse(ctx: Ink, fill: string | CanvasGradient, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function shoreline(shore: Shore) {
  const left: Pair[] = [];
  const right: Pair[] = [];
  const full = shore.flatMap((range, row) => range ? [{ range, row }] : []);
  full.forEach(({ range: [a, b], row }, index) => {
    const y = row * TILE;
    const inset = Math.sin(row * 2.6) * 3;
    if (index === 0) {
      left.push([a * TILE + 4, y + 6]);
      right.push([(b + 1) * TILE - 4, y + 6]);
    }
    left.push([a * TILE + inset, y + TILE / 2]);
    right.push([(b + 1) * TILE + inset, y + TILE / 2]);
    if (index === full.length - 1) {
      left.push([a * TILE + 4, y + TILE - 4]);
      right.push([(b + 1) * TILE - 4, y + TILE - 4]);
    }
  });
  const boundary = [...left, ...right.reverse()];
  return boundary.flatMap(([x, y], index) => {
    const [otherX, otherY] = boundary[(index + 1) % boundary.length];
    return [[(3 * x + otherX) / 4, (3 * y + otherY) / 4],
      [(x + 3 * otherX) / 4, (y + 3 * otherY) / 4]] as Pair[];
  });
}

function smooth(ctx: Ink, points: Pair[]) {
  ctx.beginPath();
  const first = points[0];
  const last = points[points.length - 1];
  ctx.moveTo((first[0] + last[0]) / 2, (first[1] + last[1]) / 2);
  points.forEach(([x, y], index) => {
    const [nx, ny] = points[(index + 1) % points.length];
    ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  });
  ctx.closePath();
}

function rock(ctx: Ink, x: number, y: number, size: number, coastal = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ellipse(ctx, coastal ? '#1d3437a0' : '#2c3e30a0', 2, 4, 10, 5);
  shape(ctx, coastal ? '#556662' : '#66715b', [[-9, 2], [-7, -4], [0, -7], [7, -4], [9, 3], [3, 5], [-5, 5]],
    '#344941');
  shape(ctx, coastal ? '#81918a' : '#8e9273', [[-7, -4], [0, -7], [7, -4], [2, -1], [-3, 1]]);
  line(ctx, '#b0ae875e', 1, [[-6, -4], [-1, -6], [3, -5]]);
  ctx.restore();
}

function island(ctx: Ink, shore: Shore, seed: number, colors: string[]) {
  const points = shoreline(shore);
  const rand = random(seed);
  const xMin = Math.min(...points.map(([x]) => x));
  const xMax = Math.max(...points.map(([x]) => x));
  const land = ctx.createLinearGradient(xMin, HEIGHT * .15, xMax, HEIGHT * .83);
  colors.forEach((color, index) => land.addColorStop(index / (colors.length - 1), color));

  ctx.lineJoin = 'round';
  smooth(ctx, points);
  for (const [width, color] of [[46, '#7cc1b61b'], [31, '#76b7a94d'], [23, '#a7c5ab59'], [18, '#253f39'], [11, '#bcab75'], [5, '#d6c08a']] as const) {
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  }
  ctx.fillStyle = land;
  ctx.fill();

  ctx.save();
  ctx.clip();
  ctx.lineWidth = 15;
  ctx.strokeStyle = '#c3aa7052';
  ctx.stroke();
  for (let i = 0; i < 280; i++) {
    const x = xMin + rand() * (xMax - xMin);
    const y = rand() * HEIGHT;
    const spread = 14 + rand() * 72;
    const patch = ctx.createRadialGradient(x, y, 0, x, y, spread);
    patch.addColorStop(0, i % 3 === 0 ? '#dfc9805c' : i % 3 === 1 ? '#243e383b' : '#6f8b3b4d');
    patch.addColorStop(1, '#fafad000');
    ellipse(ctx, patch, x, y, spread, spread);
  }
  for (let i = 0; i < 10000; i++) {
    const x = xMin + rand() * (xMax - xMin);
    const y = rand() * HEIGHT;
    ctx.fillStyle = i % 5 === 0 ? '#cbd29540' : i % 3 === 0 ? '#232f2852' : '#b7bd7829';
    ctx.fillRect(x, y, rand() * 2.4 + .5, rand() * 1.7 + .5);
  }
  ctx.restore();

  for (let index = 0; index < points.length; index++) {
    const [x, y] = points[index];
    if (rand() > .37 || isCrossing({ x: Math.floor(x / TILE), y: Math.floor(y / TILE) })) continue;
    rock(ctx, x + rand() * 11 - 5, y + rand() * 9 - 4, .65 + rand() * .85, true);
  }
}

function road(ctx: Ink, waypoints: Pair[], width: number) {
  const points = waypoints.map(([x, y]) => [(x + .5) * TILE, (y + .5) * TILE] as Pair);
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  points.slice(0, -1).forEach(([x, y], index) => {
    const [nx, ny] = points[index + 1];
    ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  });
  ctx.lineTo(...points[points.length - 1]);
  ctx.lineCap = 'round';
  for (const [spread, color] of [[width + 10, '#84764935'], [width, '#b6a57552'], [width - 6, '#c3ac755e']] as const) {
    ctx.lineWidth = spread;
    ctx.strokeStyle = color;
    ctx.stroke();
  }
}

function bridge(ctx: Ink, x: number, y: number, width: number, height: number) {
  y += height * .17;
  height *= .66;
  ctx.fillStyle = '#1328299c';
  ctx.fillRect(x - 4, y + 7, width + 18, height + 10);
  ctx.fillStyle = '#553f2b';
  ctx.fillRect(x - 5, y - 4, width + 10, height + 8);
  const rand = random(x + y | 0);
  for (let plank = 0; plank < width; plank += 7) {
    ctx.fillStyle = ['#8d7452', '#a38a5f', '#947955', '#a68b61'][Math.floor(rand() * 4)];
    ctx.fillRect(x + plank, y, Math.min(6.4, width - plank), height);
    ctx.fillStyle = '#d6ba823b';
    ctx.fillRect(x + plank + 1, y + rand() * 6, 1, height * .71);
  }
  for (const rail of [y + 1, y + height - 2]) {
    line(ctx, '#53402f', 7, [[x - 5, rail], [x + width + 6, rail]]);
    line(ctx, '#c1a275', 2.5, [[x - 4, rail - 2], [x + width + 6, rail - 2]]);
    for (let post = x; post <= x + width + 1; post += 24) {
      ctx.fillStyle = '#483b2c';
      ctx.fillRect(post - 3, rail - 5, 6, 11);
      ctx.fillStyle = '#d0b58b';
      ctx.fillRect(post - 2, rail - 5, 4, 4);
    }
  }
  for (const end of [x - 4, x + width + 2]) {
    for (const side of [y - 7, y + height + 1]) rock(ctx, end, side, 1.15, true);
  }
}

export function terrain() {
  return paint(WIDTH, HEIGHT, (ctx) => {
    const sea = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    sea.addColorStop(0, '#2c5558');
    sea.addColorStop(.53, '#1b4148');
    sea.addColorStop(1, '#224d51');
    ctx.fillStyle = sea;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const rand = random(92314);

    for (let i = 0; i < 5600; i++) {
      const x = rand() * WIDTH;
      const y = rand() * HEIGHT;
      const reach = 1 + rand() ** 2 * 20;
      ctx.fillStyle = i % 5 === 0 ? '#9dbca239' : i % 4 === 0 ? '#143c425e' : '#77aaa52c';
      ctx.fillRect(x, y, reach, rand() * 1.35 + .35);
      if (i % 29 === 0) line(ctx, '#b8ccae35', 1,
        [[x, y + 5], [x + 5, y + 3], [x + 16 + reach, y + 3], [x + 22 + reach, y + 1]]);
    }

    island(ctx, west, 21, ['#7d8354', '#5d7550', '#4c6e51', '#69794e']);
    island(ctx, east, 71, ['#55755a', '#687956', '#5c6d4f', '#79825c']);
    road(ctx, [[9, 13], [12, 13], [15, 11], [17, 9], [20, 8.4], [22, 8.5]], 25);
    road(ctx, [[9, 13], [11, 16], [14, 18], [19, 19.5], [22, 20]], 23);
    road(ctx, [[30, 8.5], [34, 8.5], [37, 10], [39, 12], [40, 13]], 25);
    road(ctx, [[28, 20], [33, 20], [36, 18], [38, 16], [40, 13]], 23);
    road(ctx, [[9, 13], [7, 11], [7, 8]], 15);
    road(ctx, [[40, 13], [41, 10], [41, 8]], 15);
    for (const { x, y, width, height } of crossings) bridge(ctx, x * TILE, y * TILE, width * TILE, height * TILE);

    for (const [x, y, amount] of [[23, 4, 8], [26, 24, 10], [24, 14, 7], [3, 20, 5], [46, 23, 5], [34, 4, 6]]) {
      const middle = center({ x, y });
      ellipse(ctx, '#9ccab62a', middle.x + 2, middle.y + 3, 31, 13);
      ellipse(ctx, '#97b5a13d', middle.x, middle.y, 24, 9);
      for (let i = 0; i < amount; i++) {
        rock(ctx, middle.x + rand() * 46 - 25, middle.y + rand() * 15 - 8, .33 + rand() * .8, true);
      }
    }

    for (const [x, y] of [[4, 9], [5, 16], [8, 19], [11, 4], [12, 7], [16, 6], [15, 24],
      [19, 21], [36, 7], [35, 21], [42, 10], [45, 12], [38, 24], [45, 19]]) {
      const point = center({ x, y });
      rock(ctx, point.x, point.y, .54 + rand() * .48);
      for (let i = 0; i < 12; i++) {
        const xx = point.x + rand() * 50 - 25;
        const yy = point.y + rand() * 30 - 15;
        line(ctx, i % 2 ? '#c1bd7773' : '#3a5238a0', 1.3, [[xx - 3, yy - 4], [xx, yy], [xx + 2, yy - 6]]);
      }
    }

    for (const cell of Object.values(seats)) {
      const point = center(cell);
      ellipse(ctx, '#c7af7470', point.x - 1, point.y + 5, 74, 52);
      ellipse(ctx, '#b6a06d51', point.x, point.y + 11, 57, 48);
    }

    const shade = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 370, WIDTH / 2, HEIGHT / 2, 890);
    shade.addColorStop(0, '#10222600');
    shade.addColorStop(1, '#10222683');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  });
}

function tree(ctx: Ink, x: number, y: number, scale: number, hue: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ellipse(ctx, '#192d21ad', 7, 1, 13, 5);
  line(ctx, '#584936', 4, [[1, 1], [0, -22]]);
  const colors = [
    ['#213b32', '#385d47', '#64805c', '#a0a276'],
    ['#263c32', '#466448', '#738c5d', '#aab079'],
    ['#263b32', '#34564a', '#658779', '#93a88b'],
  ][hue];
  for (const [level, width] of [[-6, 12], [-13, 11], [-21, 9], [-28, 7]]) {
    shape(ctx, colors[0], [[-width, level], [-1, level - 15], [width + 1, level], [3, level + 3], [-6, level + 2]]);
    shape(ctx, colors[1], [[-width + 1, level - 2], [-1, level - 15], [width - 1, level - 2], [2, level + 1]]);
    shape(ctx, colors[2], [[-width + 1, level - 3], [-1, level - 15], [1, level - 4], [-5, level - 1]]);
    line(ctx, colors[3] + '8c', .8, [[-width + 3, level - 5], [-1, level - 15]]);
  }
  ctx.restore();
}

export function groveArt(id: number, level: 'full' | 'low' | 'stumps') {
  const rand = random(1079 + id * 101);
  return paint(152, 148, (ctx) => {
    ctx.translate(76, 89);
    ellipse(ctx, '#2c453a8c', 0, 1, 48, 42);
    const points = Array.from({ length: 25 }, (_, index) => {
      const ring = 6 + Math.sqrt(rand()) * 42;
      const angle = index * 2.4;
      return { x: Math.cos(angle) * ring, y: Math.sin(angle) * ring * .88 + 6, size: .62 + rand() * .56, index };
    }).sort((a, b) => a.y - b.y);
    for (const { x, y, size, index } of points) {
      if (level === 'full' || (level === 'low' && index % 3 === 0)) {
        tree(ctx, x, y, size, (index + id) % 3);
      } else if (index % 2 === 0) {
        ellipse(ctx, '#3e4230', x + 1, y + 1, 5, 3);
        ellipse(ctx, '#b49a66', x, y - 1, 3, 2);
      }
    }
    rock(ctx, -35, 22, .7);
    rock(ctx, 36, -1, .61);
  });
}

function house(ctx: Ink, x: number, y: number, width: number, height: number, colors: typeof heraldry.amber, roofHeight = 23) {
  ctx.save();
  ctx.translate(x, y);
  const edge = '#342f28';
  shape(ctx, '#343a2b70', [[-width / 2 + 8, 9], [width / 2 + 35, 13], [width / 2 + 23, -11], [0, -23]]);
  shape(ctx, '#b6a279', [[-width / 2, 0], [width / 2, 0], [width / 2, -height], [-width / 2, -height]], edge);
  shape(ctx, '#786f58', [[width / 2, 0], [width / 2 + 17, -12], [width / 2 + 17, -height - 12], [width / 2, -height]], edge);
  line(ctx, '#dbc79b', 2, [[-width / 2 + 1, -2], [width / 2 - 1, -2]]);
  for (const widthOffset of [-width / 2 + 4, width / 2 - 4, 0]) {
    line(ctx, '#524531', 2.5, [[widthOffset, -2], [widthOffset, -height + 2]]);
  }
  for (const offset of [-width / 3, width / 3]) {
    shape(ctx, '#363b32', [[offset - 4, -9], [offset + 4, -9], [offset + 4, -17], [offset - 4, -17]], '#b79e75');
    line(ctx, '#c4a9618f', 1, [[offset - 2, -13], [offset + 2, -13]]);
  }
  shape(ctx, '#453b2f', [[-6, 0], [7, 0], [7, -14], [0, -18], [-6, -14]], '#80725b');
  const roof = [[-width / 2 - 5, -height + 1], [0, -height - roofHeight], [width / 2 + 5, -height + 1]] as Pair[];
  shape(ctx, colors.roof, [...roof, [width / 2 + 22, -height - 11], [17, -height - roofHeight - 12]],
    edge);
  shape(ctx, colors.shadow, [roof[1], roof[2], [width / 2 + 22, -height - 11], [17, -height - roofHeight - 12]], edge);
  const span = width / 2 + 5;
  for (const fraction of [.24, .48, .72, .9]) {
    const heightAt = -height - roofHeight + fraction * (roofHeight + 1);
    line(ctx, '#eac59251', 1, [[-span * fraction, heightAt], [span * fraction, heightAt]]);
    line(ctx, '#302f294e', 1, [[span * fraction, heightAt], [span * fraction + 17, heightAt - 12]]);
  }
  line(ctx, '#e6c59b', 1.6, [roof[0], roof[1], [17, -height - roofHeight - 12]]);
  ctx.restore();
}

function flag(ctx: Ink, x: number, y: number, size: number, colors: typeof heraldry.amber) {
  line(ctx, '#e1cea2', 1.8, [[x, y + size + 11], [x, y - 1]]);
  ellipse(ctx, '#e9d3a5', x, y - 2, 1.9, 1.9);
  shape(ctx, colors.textile, [[x + 1, y], [x + size, y + 1], [x + size - 4, y + 7],
    [x + size, y + 11], [x + 1, y + 10]], colors.shadow);
  shape(ctx, colors.light, [[x + 4, y + 5], [x + 7, y + 2], [x + 10, y + 5], [x + 7, y + 8]]);
}

export function structure(side: Side, kind: 'seat' | 'barracks' | 'foundation') {
  const colors = heraldry[side];
  return paint(172, 160, (ctx) => {
    ctx.translate(86, 112);
    ellipse(ctx, '#172b2282', 7, 2, kind === 'seat' ? 62 : 49, 28);
    if (kind === 'foundation') {
      shape(ctx, '#ae916784', [[-45, 13], [29, 20], [53, -11], [-28, -27]], '#8a7859');
      for (const [x, y] of [[-43, 11], [30, 18], [51, -10], [-27, -25]]) {
        rock(ctx, x, y, .68);
        line(ctx, '#594b35', 4, [[x, y], [x, y - 14]]);
        line(ctx, '#cfac73', 1.6, [[x - 1, y], [x - 1, y - 14]]);
      }
      line(ctx, '#d7bb77', 1, [[-43, -1], [30, 6], [51, -22], [-27, -37], [-43, -1]]);
      for (let i = 0; i < 5; i++) line(ctx, '#765738', 3, [[-16, -8 + i * 4], [21, -4 + i * 4]]);
      return;
    }
    if (kind === 'seat') {
      house(ctx, 29, -4, 37, 38, colors, 26);
      house(ctx, -28, 8, 31, 34, colors, 19);
      house(ctx, 0, 18, 65, 37, colors, 34);
      flag(ctx, 3, -68, 21, colors);
      for (const x of [-41, 34]) {
        line(ctx, '#292d26', 5, [[x, 22], [x, 7]]);
        line(ctx, colors.fill, 3, [[x - 1, 21], [x - 1, 8]]);
      }
      ellipse(ctx, '#e5b97e', 40, 9, 3, 2);
      ellipse(ctx, '#e5b97e', -47, 13, 3, 2);
    } else {
      house(ctx, 23, 2, 30, 26, colors, 18);
      house(ctx, -5, 13, 60, 30, colors, 25);
      flag(ctx, -4, -48, 17, colors);
      for (const x of [-30, 24]) {
        line(ctx, '#604a32', 4, [[x, 15], [x + 5, -3]]);
        shape(ctx, colors.textile, [[x + 2, 1], [x + 8, 2], [x + 7, 11], [x + 1, 10]], '#403f32');
      }
    }
  });
}

export function person(side: Side, kind: 'worker' | 'guard', frame = 0) {
  const colors = heraldry[side];
  return paint(51, 57, (ctx) => {
    ctx.translate(23, 44);
    const guard = kind === 'guard';
    const attack = frame === 3;
    const gait = frame === 1 ? 3 : frame === 2 ? -3 : 0;
    ellipse(ctx, '#152a237d', 2, 1, 11, 4);
    for (const [x, offset] of [[-3, gait], [4, -gait]]) {
      line(ctx, '#302c24', 5, [[x, -11], [x + offset, -3], [x + offset + 2, -2]]);
      line(ctx, '#8a7054', 1.7, [[x, -10], [x + offset, -4]]);
    }
    shape(ctx, guard ? colors.shadow : '#725b42', [[-8, -21], [3, -22], [8, -15], [6, -9], [-7, -11]], '#2f2e27');
    shape(ctx, colors.textile, [[-7, -21], [2, -22], [5, -16], [1, -13], [-8, -15]], '#493d31');
    line(ctx, '#292f28', 2, [[-7, -13], [5, -12]]);
    line(ctx, '#a68055', 5, [[3, -19], [attack ? 12 : 7, attack ? -18 : -13]]);
    ellipse(ctx, '#4b3627', 1, -26, 5.5, 6);
    ellipse(ctx, '#d1a781', 2, -25, 4.7, 4.6);
    if (guard) {
      shape(ctx, '#9da49a', [[-4, -26], [-4, -30], [1, -34], [6, -31], [7, -25], [3, -27]], '#3a4138');
      line(ctx, '#d7d8b7', 1, [[-4, -30], [1, -33], [4, -31]]);
      shape(ctx, colors.fill, [[-9, -21], [-2, -18], [-3, -11], [-8, -7], [-12, -12], [-13, -18]], '#e0ca93');
      line(ctx, colors.light, 1.2, [[-8, -17], [-8, -11]]);
      line(ctx, '#493724', 3, [[attack ? 11 : 8, -11], [attack ? 15 : 11, -15]]);
      shape(ctx, '#dae0cc', attack ? [[13, -16], [24, -22], [25, -19], [15, -13]] :
        [[9, -15], [10, -26], [13, -28], [14, -24], [12, -14]], '#354438');
    } else {
      shape(ctx, '#c4ac72', [[-5, -27], [-2, -33], [5, -32], [8, -27], [9, -25], [-7, -26]], '#5b4c36');
      line(ctx, '#eee0aa', 1, [[-5, -28], [7, -27]]);
      line(ctx, '#59422d', 2.5, [[7, -7], [attack ? 17 : 10, attack ? -22 : -18]]);
      shape(ctx, '#bdc3ae', attack ? [[15, -21], [19, -27], [23, -23], [19, -19]] :
        [[8, -16], [8, -20], [14, -20], [15, -15]], '#4a4a3c');
    }
  });
}

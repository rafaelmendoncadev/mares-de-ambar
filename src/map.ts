export const TILE = 32;
export const COLS = 50;
export const ROWS = 28;
export const WIDTH = COLS * TILE;
export const HEIGHT = ROWS * TILE;

export interface Cell { x: number; y: number }
export interface Point { x: number; y: number }
export type Shore = readonly (readonly [number, number] | null)[];

export const west: Shore = [
  null, null, [7, 12], [5, 15], [4, 16], [3, 17], [3, 19], [2, 20],
  [2, 21], [2, 21], [2, 20], [2, 19], [3, 19], [3, 18],
  [3, 18], [4, 17], [3, 18], [3, 19], [4, 21], [4, 22],
  [4, 22], [5, 22], [5, 20], [6, 18], [7, 16], [9, 15], [11, 13], null,
];
export const east: Shore = [
  null, null, null, [39, 43], [37, 45], [36, 46], [34, 46], [31, 47],
  [30, 47], [30, 47], [31, 47], [33, 48], [34, 48], [34, 47],
  [34, 47], [33, 47], [32, 47], [31, 46], [29, 46], [28, 45],
  [28, 45], [28, 44], [30, 43], [32, 42], [33, 41], [35, 40], [36, 38], null,
];

export const crossings = [
  { x: 21, y: 8, width: 10, height: 2 },
  { x: 22, y: 19, width: 7, height: 3 },
];

export const seats = { amber: { x: 9, y: 13 }, slate: { x: 40, y: 13 } } as const;
export const groves = [
  { x: 7, y: 6, name: 'Bosque do Farol' },
  { x: 12, y: 22, name: 'Pinhal das Dunas' },
  { x: 17, y: 16, name: 'Mata da Encosta' },
  { x: 41, y: 6, name: 'Bosque da Falésia' },
  { x: 39, y: 22, name: 'Pinhal da Ardósia' },
  { x: 44, y: 16, name: 'Mata do Bastião' },
] as const;

export function onShore(cell: Cell, shore: Shore) {
  const span = shore[cell.y];
  return !!span && cell.x >= span[0] && cell.x <= span[1];
}

export function isLand(cell: Cell) {
  return onShore(cell, west) || onShore(cell, east);
}

export function isCrossing({ x, y }: Cell) {
  return crossings.some((span) => x >= span.x && x < span.x + span.width &&
    y >= span.y && y < span.y + span.height);
}

export function cellAt(x: number, y: number): Cell {
  return { x: Math.floor(x / TILE), y: Math.floor(y / TILE) };
}

export function center({ x, y }: Cell): Point {
  return { x: (x + .5) * TILE, y: (y + .5) * TILE };
}

export function cellKey({ x, y }: Cell) {
  return y * COLS + x;
}

export function fromKey(key: number): Cell {
  return { x: key % COLS, y: Math.floor(key / COLS) };
}

export function inside({ x, y }: Cell) {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS;
}

export function inFootprint(cell: Cell, middle: Cell, radius: number) {
  return Math.abs(cell.x - middle.x) <= radius && Math.abs(cell.y - middle.y) <= radius;
}

const neighbors = [
  [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
  [-1, -1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, 1, Math.SQRT2],
];

function estimate(a: Cell, b: Cell) {
  const x = Math.abs(a.x - b.x);
  const y = Math.abs(a.y - b.y);
  return Math.max(x, y) + (Math.SQRT2 - 1) * Math.min(x, y);
}

export function findPath(start: Cell, goal: Cell, walkable: (cell: Cell) => boolean): Cell[] | null {
  const initialKey = cellKey(start);
  const goalKey = cellKey(goal);
  if (initialKey === goalKey) return [];
  if (!walkable(goal)) return null;

  const scores = new Float64Array(COLS * ROWS).fill(Infinity);
  const parents = new Int32Array(COLS * ROWS).fill(-1);
  const closed = new Uint8Array(COLS * ROWS);
  const open = [{ key: initialKey, priority: estimate(start, goal) }];
  scores[initialKey] = 0;

  while (open.length) {
    let lowest = 0;
    for (let index = 1; index < open.length; index++) {
      if (open[index].priority < open[lowest].priority) lowest = index;
    }
    const [{ key }] = open.splice(lowest, 1);
    if (closed[key]) continue;
    if (key === goalKey) {
      const path: Cell[] = [];
      for (let cursor = key; cursor !== initialKey; cursor = parents[cursor]) {
        path.push(fromKey(cursor));
      }
      return path.reverse();
    }
    closed[key] = 1;

    const current = fromKey(key);
    for (const [dx, dy, distance] of neighbors) {
      const next = { x: current.x + dx, y: current.y + dy };
      if (!walkable(next)) continue;
      if (dx && dy && (!walkable({ x: next.x, y: current.y }) || !walkable({ x: current.x, y: next.y }))) {
        continue;
      }
      const nextKey = cellKey(next);
      const score = scores[key] + distance;
      if (closed[nextKey] || score >= scores[nextKey]) continue;
      scores[nextKey] = score;
      parents[nextKey] = key;
      open.push({ key: nextKey, priority: score + estimate(next, goal) });
    }
  }
  return null;
}

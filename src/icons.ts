const paths = {
  anchor: '<circle cx="12" cy="5" r="2.5"/><path d="M12 7.5v13M8 11h8M3 14v4l3-1m15-3v4l-3-1M3 16c2 5 7 5 9 5s7 0 9-5"/>',
  logs: '<path d="m7 15 9-8c2-2 6 2 4 4l-9 8M5 8l6-5c1.5-1 4 1 4 3l-1 1M6 13l-2 1c-2 2 2 6 4 5"/><ellipse cx="9" cy="16.8" rx="2.7" ry="3.5" transform="rotate(-46 9 16.8)"/><ellipse cx="6" cy="10" rx="2.2" ry="2.8" transform="rotate(-46 6 10)"/>',
  people: '<circle cx="9" cy="7" r="3"/><path d="M3 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2m2-15a3 3 0 0 1 0 6m1 3a4 4 0 0 1 3 4v2"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 1M10 2h4m4 4 2-2"/>',
  pause: '<path d="M9 5v14m6-14v14" stroke-width="2.6"/>',
  play: '<path d="m8 5 12 7-12 7Z"/>',
  reset: '<path d="M4 11a8 8 0 1 1 2 7M4 5v6h6"/>',
  swords: '<path d="m3 3 5 1 12 13-3 3L4 7Zm11 7 6-7 1 5-4 5m-7 1-5 6-2-2 5-6m9 4 5 5m-20 1 4-4"/>',
  map: '<path d="m2 6 7-3 6 3 7-3v15l-7 3-6-3-7 3Zm7-3v15m6-12v15"/>',
  flag: '<path d="M5 21V3c4-4 8 4 14 0v11c-6 4-10-4-14 0"/>',
  barracks: '<path d="M3 21h18M5 21v-9h14v9M3 12l9-8 9 8M10 21v-5h4v5m-2-17V2h5"/>',
  shield: '<path d="M12 22s7-3 7-10V5l-7-3-7 3v7c0 7 7 10 7 10Z"/><path d="M12 6v11m-4-6h8"/>',
  check: '<path d="m5 12 4 4 10-9"/>',
  target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v7m-6 0h12"/>',
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h1m4 0h1m4 0h1m-11 4h1m9 0h1m-7 2h4"/>',
  journal: '<path d="M5 3h13a2 2 0 0 1 2 2v15H6a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2Zm-2 14a3 3 0 0 1 3-3h14M8 7h8m-8 3h5"/>',
  hand: '<path d="M8 13V6a2 2 0 1 1 4 0v5-7a2 2 0 1 1 4 0v8-5a2 2 0 1 1 4 0v8c0 4-2 7-6 7h-2c-3 0-5-2-7-5l-3-5a2 2 0 0 1 3-2Z"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
} as const;

export function icon(name: keyof typeof paths, size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}

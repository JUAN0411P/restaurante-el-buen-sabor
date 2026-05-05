// Design tokens — warm artisanal + olive palette (v2)
export const T = {
  // Surfaces
  bg: '#f4ede0',          // warm cream (main background)
  bgSoft: '#ebe3d2',      // softer cream
  card: '#fbf7ec',        // card background
  cardAlt: '#f8f3e6',
  border: '#e2d8c2',
  borderSoft: '#eee5d0',

  // Ink
  text: '#2a2a1f',
  textSoft: '#6f6855',
  textMute: '#9c9481',

  // Brand — olive (primary)
  olive: '#4a5d3a',
  oliveDark: '#36462a',
  oliveSoft: '#e3e8d4',
  green: '#4a5d3a',       // alias for compatibility
  greenSoft: '#e3e8d4',

  // Accents
  terracotta: '#b4553e',
  terraSoft: '#f3e0d6',
  accent: '#b4553e',      // alias for compatibility
  accentHover: '#9d4734',
  accentSoft: '#f3e0d6',

  mustard: '#b8873a',
  mustardSoft: '#f3e6c8',
  amber: '#b8873a',       // alias for compatibility
  amberSoft: '#f3e6c8',

  plum: '#6d4157',
  plumSoft: '#ead6de',
  purple: '#6d4157',      // alias
  purpleSoft: '#ead6de',

  red: '#a83c2c',
  redSoft: '#f3dbd4',

  blue: '#3f5a6e',        // muted blue (kept for legacy)
  blueSoft: '#dde6ec',
};

// Font tokens (used inline in components)
export const FontFraunces = {
  fontFamily: "'Fraunces', serif",
  fontWeight: 400,
  letterSpacing: '-0.015em',
};

export const FontMono = {
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
};

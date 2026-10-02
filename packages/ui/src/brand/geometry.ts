/**
 * Geometria da composição de marca das capas dos decks (retratos em duotone
 * sobre planos e fragmentos), gerada em código para poder ser animada e
 * regenerada. Espaço de coordenadas: 1672 × 941, o mesmo da capa de
 * referência.
 *
 * Dois modos: `reference` reproduz a capa (abertura e Nossa história);
 * `varied` sorteia variações dos mesmos elementos a partir da semente, para
 * os fundos das outras seções não saírem todos iguais.
 *
 * Regras da linguagem visual da marca, valendo nos dois
 * modos: círculos verdadeiros (nunca elipses), um único conjunto de
 * fragmentos, no máximo uma matriz de pontos e no máximo um acento coral.
 */

export const COMPOSITION_WIDTH = 1672;
export const COMPOSITION_HEIGHT = 941;
/** Borda esquerda padrão do viewBox: a composição começa recortada à esquerda. */
export const DEFAULT_VIEW_BOX_X = 440;

export const BRAND = {
  coral: '#F47A5C',
  lavender: '#8E8BD8',
  lavenderSoft: '#B3AEE6',
  mint: '#9EF2E2',
  violet: '#463C6D',
} as const;

export type BrandColor = keyof typeof BRAND;
export type FragmentFill = 'hatch' | 'lavender' | 'mint' | 'violet';
export type Corner = 'bl' | 'br' | 'tl' | 'tr';

/** Plano principal: bloco de lado semicircular, círculo ou bloco de canto arredondado. */
export type MainShape =
  | {
      fill: BrandColor;
      flat: 'left' | 'right';
      kind: 'semi';
      r: number;
      w: number;
      x: number;
      y: number;
    }
  | { cx: number; cy: number; fill: BrandColor; kind: 'circle'; r: number }
  | {
      corner: Corner;
      fill: BrandColor;
      h: number;
      kind: 'corner';
      r: number;
      w: number;
      x: number;
      y: number;
    };

export interface Fragment {
  fill: FragmentFill;
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface Rail {
  x1: number;
  x2: number;
  y: number;
}

export type ChainItem =
  | { kind: 'dot'; r: number; x: number }
  | { kind: 'ring'; r: number; x: number }
  | { color: 'lavender' | 'mint' | 'violet'; kind: 'square'; size: number; x: number };

export interface Composition {
  chain: { items: ChainItem[]; x1: number; x2: number; y: number } | null;
  coral: { cx: number; cy: number; r: number } | null;
  /** Bloco roxo que sangra pelo topo; `null` quando a variação não o usa. */
  dark: { height: number; x: number } | null;
  dots: { cols: number; rows: number; step: number; x: number; y: number } | null;
  fragments: Fragment[];
  main: MainShape;
  rails: Rail[];
  ring: { cx: number; cy: number; r: number; stroke: 'lavender' | 'violet' };
  /** Faixa ao lado do bloco roxo, também sangrando pelo topo. */
  strip: { color: 'lavender' | 'mint'; height: number; width: number; x: number } | null;
}

export type CompositionMode = 'reference' | 'varied';

/** Gerador determinístico (mulberry32): a mesma semente dá a mesma composição. */
export function createRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rand: () => number, min: number, max: number) => min + rand() * (max - min);
const pick = <T>(rand: () => number, items: readonly T[]): T =>
  items[Math.floor(rand() * items.length)] as T;
const chance = (rand: () => number, p: number) => rand() < p;

/** Caixa (x1, x2, y1, y2) do plano principal, para posicionar o resto. */
export function mainBounds(main: MainShape) {
  if (main.kind === 'circle') {
    return {
      x1: main.cx - main.r,
      x2: main.cx + main.r,
      y1: main.cy - main.r,
      y2: main.cy + main.r,
    };
  }
  if (main.kind === 'semi') {
    return { x1: main.x, x2: main.x + main.w + main.r, y1: main.y, y2: main.y + main.r * 2 };
  }
  return { x1: main.x, x2: main.x + main.w, y1: main.y, y2: main.y + main.h };
}

/**
 * Um conjunto de fragmentos: fileiras próximas, deslocamento irregular por
 * fileira e por fragmento, sem colunas alinhadas.
 */
function generateFragments(
  rand: () => number,
  band: { x0: number; x1: number; y0: number },
  palette: readonly FragmentFill[],
) {
  const fragments: Fragment[] = [];
  const rails: Rail[] = [];
  const rows = 7 + Math.floor(rand() * 4);
  let y = band.y0;
  for (let row = 0; row < rows; row++) {
    const count = 2 + Math.floor(rand() * 3);
    const rowStart = band.x0 + between(rand, 0, 70);
    const rowEnd = band.x1 - between(rand, 0, 60);
    const span = rowEnd - rowStart;
    if (chance(rand, 0.55)) {
      rails.push({ x1: rowStart - between(rand, 10, 40), x2: rowEnd, y: y + 2 });
    }
    for (let i = 0; i < count; i++) {
      const slot = span / count;
      const width = between(rand, 10, 46);
      const x = rowStart + slot * i + between(rand, 0, Math.max(0, slot - width));
      const fill: FragmentFill = chance(rand, 0.12) ? 'hatch' : pick(rand, palette);
      fragments.push({ fill, height: pick(rand, [4, 5, 7, 9, 12] as const), width, x, y });
    }
    y += between(rand, 16, 26);
  }
  return { fragments, rails };
}

/** A corrente: trilho horizontal com quadrados, pontos lavanda e um anel no fim. */
function generateChain(rand: () => number, x1: number, x2: number, y: number) {
  const items: ChainItem[] = [];
  let x = x1 + between(rand, 20, 50);
  const squares = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < squares; i++) {
    items.push({
      color: pick(rand, ['lavender', 'lavender', 'mint', 'violet'] as const),
      kind: 'square',
      size: pick(rand, [6, 8, 10] as const),
      x,
    });
    x += between(rand, 22, 60);
  }
  x = Math.max(x, x2 - 150);
  const dots = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < dots && x < x2 - 20; i++) {
    items.push({ kind: 'dot', r: 9, x });
    x += between(rand, 38, 48);
  }
  items.push({ kind: 'ring', r: 19, x: x2 + 19 });
  return { items, x1, x2, y };
}

/** A capa de referência. A semente só varia fragmentos, pontos e corrente. */
function referenceComposition(rand: () => number): Composition {
  const ring = { cx: 1005, cy: 505, r: 325, stroke: 'lavender' as const };
  const left = ring.cx - ring.r;
  const { fragments, rails } = generateFragments(rand, { x0: left - 195, x1: left + 95, y0: 440 }, [
    'violet',
    'lavender',
    'lavender',
    'mint',
  ]);
  return {
    chain: generateChain(rand, 1140, 1622, 543),
    coral: { cx: 1573, cy: 590, r: 6 },
    dark: { height: 263, x: 1377 },
    dots: { cols: 4 + Math.floor(rand() * 2), rows: 4, step: 12, x: 1545, y: 293 },
    fragments,
    main: { fill: 'lavenderSoft', flat: 'left', kind: 'semi', r: 245, w: 300, x: 941, y: 101 },
    rails,
    ring,
    strip: { color: 'mint', height: 145, width: 28, x: 1349 },
  };
}

/** Variação: mesmos elementos, com forma, tamanho, cor e posição sorteados. */
function variedComposition(rand: () => number): Composition {
  const scale = between(rand, 0.72, 1.12);
  const cx = between(rand, 1060, 1300);
  const cy = between(rand, 380, 560);
  const fill: BrandColor = chance(rand, 0.7) ? 'lavenderSoft' : 'mint';

  const kind = pick(rand, ['semi', 'semi', 'circle', 'corner'] as const);
  let main: MainShape;
  if (kind === 'circle') {
    main = { cx, cy, fill, kind, r: 250 * scale };
  } else if (kind === 'semi') {
    const r = 245 * scale;
    const w = between(rand, 180, 320) * scale;
    main = {
      fill,
      flat: chance(rand, 0.75) ? 'left' : 'right',
      kind,
      r,
      w,
      x: cx - (w + r) / 2,
      y: cy - r,
    };
  } else {
    const w = between(rand, 400, 520) * scale;
    const h = between(rand, 360, 480) * scale;
    main = {
      corner: pick(rand, ['tr', 'br', 'tl', 'bl'] as const),
      fill,
      h,
      kind,
      r: Math.min(w, h) * between(rand, 0.35, 0.5),
      w,
      x: cx - w / 2,
      y: cy - h / 2,
    };
  }
  const box = mainBounds(main);

  const ringR = ((box.x2 - box.x1) / 2) * between(rand, 1.05, 1.4);
  const ring = {
    cx: (box.x1 + box.x2) / 2 - between(rand, 40, 150),
    cy: (box.y1 + box.y2) / 2 + between(rand, -40, 90),
    r: ringR,
    stroke: chance(rand, 0.75) ? ('lavender' as const) : ('violet' as const),
  };

  // Fragmentos cruzando a borda esquerda do contorno, ou saindo do lado
  // direito do plano: um conjunto só, de um lado só.
  const leftSide = chance(rand, 0.7);
  const band = leftSide
    ? { x0: ring.cx - ring.r - 200, x1: ring.cx - ring.r + 100, y0: between(rand, 380, 560) }
    : { x0: box.x2 - 60, x1: Math.min(box.x2 + 240, 1640), y0: between(rand, 280, 520) };
  const palette: readonly FragmentFill[] =
    fill === 'mint'
      ? ['violet', 'lavender', 'lavender']
      : ['violet', 'lavender', 'lavender', 'mint'];
  const { fragments, rails } = generateFragments(rand, band, palette);

  const dark = chance(rand, 0.7)
    ? { height: between(rand, 170, 320), x: between(rand, 1330, 1460) }
    : null;
  const strip =
    dark && chance(rand, 0.65)
      ? {
          color:
            fill === 'mint' ? ('lavender' as const) : pick(rand, ['mint', 'lavender'] as const),
          height: dark.height * between(rand, 0.4, 0.7),
          width: between(rand, 18, 32),
          x: dark.x - between(rand, 18, 32),
        }
      : null;

  const dots = chance(rand, 0.8)
    ? {
        cols: 3 + Math.floor(rand() * 4),
        rows: 3 + Math.floor(rand() * 3),
        step: 12,
        x: between(rand, 1480, 1590),
        y: dark ? dark.height + between(rand, 30, 90) : between(rand, 120, 300),
      }
    : null;

  const chain = chance(rand, 0.55)
    ? generateChain(
        rand,
        box.x1 + between(rand, 40, 200),
        between(rand, 1560, 1622),
        between(rand, 520, 640),
      )
    : null;

  const coral = chance(rand, 0.85)
    ? {
        cx: between(rand, 1500, 1620),
        cy: between(rand, 560, 760),
        r: pick(rand, [5, 6, 8] as const),
      }
    : null;

  return { chain, coral, dark, dots, fragments, main, rails, ring, strip };
}

/** Gera a composição. Mesma semente e modo, mesma composição. */
export function generateComposition(seed = 1, mode: CompositionMode = 'reference'): Composition {
  const rand = createRandom(seed);
  return mode === 'reference' ? referenceComposition(rand) : variedComposition(rand);
}

/** Contorno do plano principal. */
export function mainPath(m: MainShape): string {
  if (m.kind === 'semi') {
    const { r, w, x, y } = m;
    return m.flat === 'left'
      ? `M${x} ${y}H${x + w}A${r} ${r} 0 0 1 ${x + w} ${y + 2 * r}H${x}Z`
      : `M${x + r} ${y}H${x + r + w}V${y + 2 * r}H${x + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
  }
  if (m.kind === 'corner') {
    const { h, r, w, x, y } = m;
    switch (m.corner) {
      case 'tl':
        return `M${x} ${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}H${x + w}V${y + h}H${x}Z`;
      case 'tr':
        return `M${x} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h}H${x}Z`;
      case 'br':
        return `M${x} ${y}H${x + w}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x}Z`;
      default:
        return `M${x} ${y}H${x + w}V${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}Z`;
    }
  }
  return '';
}

/**
 * De onde o plano principal "desdobra": o bloco semicircular cresce a partir
 * do lado reto; o bloco de canto, a partir do canto oposto ao arredondado.
 */
export function mainOrigin(m: MainShape): { originX: number; originY: number } {
  if (m.kind === 'semi') return { originX: m.flat === 'left' ? 0 : 1, originY: 0.5 };
  if (m.kind === 'corner') {
    const origin = { bl: [1, 0], br: [0, 0], tl: [1, 1], tr: [0, 1] }[m.corner];
    return { originX: origin[0]!, originY: origin[1]! };
  }
  return { originX: 0.5, originY: 0.5 };
}

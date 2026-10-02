/** Uma única posição no tempo: inverter o destino percorre os mesmos estados. */
export interface ShapeMotion {
  cx?: number;
  cy?: number;
  delay: number;
  depth?: number;
  drift?: number;
  duration: number;
  grow?: boolean;
  x?: number;
  y?: number;
}

export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export function advance(time: number, target: number, elapsed: number) {
  return target > time ? Math.min(target, time + elapsed) : Math.max(target, time - elapsed);
}

export function sampleMotion(spec: ShapeMotion, time: number, scroll: number) {
  // Duração zero (ou negativa) é um salto no `delay`: sem isto, `0 / 0` dá NaN
  // no instante do `delay` e o `transform` sai inválido.
  const t =
    spec.duration > 0 ? clamp((time - spec.delay) / spec.duration) : time >= spec.delay ? 1 : 0;
  const p = 1 - (1 - t) ** 3;
  const x = (spec.x ?? 0) * (1 - p) + scroll * (spec.drift ?? 0) * p;
  const y = (spec.y ?? 0) * (1 - p) + scroll * (spec.depth ?? 0) * p;
  const cx = spec.cx ?? 0;
  const cy = spec.cy ?? 0;
  const scale = spec.grow ? p : 1;
  return {
    opacity: p,
    transform: `translate(${x} ${y}) translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`,
  };
}

/** Deslizamento pela borda mais próxima, sem deformar o retângulo. */
export function edgeOffset(x: number, width: number, min: number, max: number) {
  return x - min <= max - x - width ? -(x - min + width + 24) : max - x + 24;
}

/** Profundidade individual: trilhos vizinhos nunca viajam como um bloco rígido. */
export function lineDrift(index: number) {
  return (index % 2 ? -1 : 1) * (18 + (index % 5) * 11);
}

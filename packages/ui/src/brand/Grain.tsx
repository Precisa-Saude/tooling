/** Textura estática em ladrilho pequeno: não filtra a área inteira da sangria. */
export function Grain({ id, seed }: { id: string; seed: number }) {
  return (
    <>
      <filter height="100%" id={`${id}-noise`} width="100%" x="0%" y="0%">
        <feTurbulence
          baseFrequency="0.72"
          numOctaves="3"
          seed={seed}
          stitchTiles="stitch"
          type="fractalNoise"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <pattern height="128" id={id} patternUnits="userSpaceOnUse" width="128">
        <rect filter={`url(#${id}-noise)`} height="128" width="128" />
      </pattern>
    </>
  );
}

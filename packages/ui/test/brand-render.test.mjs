import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  BrandComposition,
  generateComposition,
  mainBounds,
  mainOrigin,
  mainPath,
} from '../.brand-check/index.js';

test('geometria determinística mantém os limites da identidade em 100 sementes', () => {
  const kinds = new Set();
  for (let seed = 1; seed <= 100; seed++) {
    const c = generateComposition(seed, 'varied');
    assert.deepEqual(c, generateComposition(seed, 'varied'));
    kinds.add(c.main.kind);
    const box = mainBounds(c.main);
    assert.ok(box.x1 > 0 && box.x2 < 1872 && box.y1 > -100 && box.y2 < 1141);
    assert.ok(c.fragments.length > 10);
    if (c.dots) assert.ok(c.dots.rows * c.dots.cols <= 30);
    if (c.coral) assert.ok(c.coral.r <= 8);
    if (c.strip) assert.ok(c.dark);
    assert.ok(mainOrigin(c.main).originX >= 0);
    assert.equal(mainPath(c.main) === '', c.main.kind === 'circle');
  }
  assert.equal(kinds.size, 3);
  assert.deepEqual(generateComposition(1).main, generateComposition(2).main);
  assert.notDeepEqual(generateComposition(1).fragments, generateComposition(2).fragments);
});

test('SSR mostra geometria completa, IDs únicos e conteúdo SVG sem espelhar', () => {
  const markup = renderToStaticMarkup(
    createElement(
      'div',
      null,
      createElement(
        BrandComposition,
        { label: 'Retrato', mirror: true, viewBoxX: 800 },
        createElement('image', { href: '/portrait.webp' }),
      ),
      createElement(BrandComposition, { mode: 'varied', seed: 4, anchor: 'top', fit: 'slice' }),
    ),
  );
  const ids = [...markup.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.match(markup, /role="img"/);
  assert.match(markup, /aria-hidden="true"/);
  assert.match(markup, /translate\(2472 0\) scale\(-1 1\)/);
  assert.match(markup, /<\/g><image href="\/portrait.webp"><\/image><\/svg>/);
  assert.doesNotMatch(markup, /opacity="0"/);
});

test('pontos pequenos têm horários distintos; textura só acompanha planos grandes', () => {
  const markup = renderToStaticMarkup(createElement(BrandComposition));
  const specs = [...markup.matchAll(/data-brand-motion="([^"]+)"/g)].map((m) =>
    JSON.parse(m[1].replaceAll('&quot;', '"')),
  );
  const dots = specs.filter((spec) => spec.duration === 0.12);
  assert.ok(dots.length >= 16);
  assert.equal(new Set(dots.map((spec) => spec.delay)).size, dots.length);
  assert.ok(dots.at(-1).delay - dots[0].delay < 0.55);
  assert.equal((markup.match(/fill="url\(#brand-grain/g) ?? []).length, 3);
  assert.equal((markup.match(/<feTurbulence/g) ?? []).length, 1);
  const plain = renderToStaticMarkup(
    createElement(BrandComposition, { texture: 0, bleed: false, animated: false }),
  );
  assert.doesNotMatch(plain, /feTurbulence/);
  assert.doesNotMatch(plain, /y="-2000"/);
});

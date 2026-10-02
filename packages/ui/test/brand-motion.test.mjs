import assert from 'node:assert/strict';
import { test } from 'node:test';

import { advance, edgeOffset, lineDrift, sampleMotion } from '../.brand-check/timeline.js';

test('inverter a direção no meio da entrada repete os mesmos estados, sem salto', () => {
  const spec = {
    cx: 30,
    cy: 50,
    delay: 0.1,
    depth: 60,
    drift: 15,
    duration: 0.6,
    grow: true,
    x: 250,
  };
  let time = 0;
  const forward = [sampleMotion(spec, time, 0.4)];
  for (let i = 0; i < 5; i++) {
    time = advance(time, 1, 0.125);
    forward.push(sampleMotion(spec, time, 0.4));
  }
  for (let i = 4; i >= 0; i--) {
    time = advance(time, 0, 0.125);
    assert.deepEqual(sampleMotion(spec, time, 0.4), forward[i]);
  }
  assert.equal(advance(0.8, 1, 10), 1);
  assert.equal(advance(0.2, 0, 10), 0);
});

test('escala usa o centro do círculo e deslizamento preserva proporções', () => {
  const circle = { cx: 20, cy: 30, delay: 0, duration: 1, grow: true };
  assert.equal(
    sampleMotion(circle, 0, 0).transform,
    'translate(0 0) translate(20 30) scale(0) translate(-20 -30)',
  );
  assert.equal(
    sampleMotion(circle, 1, 0).transform,
    'translate(0 0) translate(20 30) scale(1) translate(-20 -30)',
  );
  assert.match(sampleMotion({ delay: 0, duration: 1, x: 200 }, 0.5, 0).transform, /scale\(1\)/);
  assert.equal(sampleMotion(circle, -1, 0).opacity, 0);
  assert.equal(sampleMotion(circle, 5, 0).opacity, 1);
});

test('retângulos usam a borda mais próxima; linhas têm profundidade lateral independente', () => {
  assert.ok(edgeOffset(100, 20, 0, 1000) < -120);
  assert.ok(edgeOffset(900, 20, 0, 1000) > 100);
  assert.notEqual(lineDrift(0), lineDrift(1));
  assert.notEqual(lineDrift(0), lineDrift(2));
  const spec = { delay: 0, duration: 1, drift: lineDrift(2), depth: 50 };
  assert.match(sampleMotion(spec, 1, 1).transform, /translate\(40 50\)/);
  assert.match(sampleMotion(spec, 1, -1).transform, /translate\(-40 -50\)/);
  assert.equal(sampleMotion(spec, 0, 1).transform, sampleMotion(spec, 0, -1).transform);
});

test('entradas fora do esperado não produzem NaN nem passam do estado final', () => {
  const spec = {
    cx: 10,
    cy: 10,
    delay: 0.2,
    depth: 40,
    drift: 20,
    duration: 0.5,
    grow: true,
    x: 100,
  };
  const final = sampleMotion(spec, 0.7, 0);
  // Antes do delay fica no início; depois do fim, no estado final.
  assert.equal(sampleMotion(spec, -5, 0).opacity, 0);
  assert.deepEqual(sampleMotion(spec, 50, 0), final);
  assert.equal(final.opacity, 1);
  // Duração zero é um salto no delay, sem NaN.
  for (const time of [0.19, 0.2, 0.21]) {
    const value = sampleMotion({ ...spec, duration: 0 }, time, 0.3);
    assert.ok(!value.transform.includes('NaN'), `NaN em t=${time}`);
    assert.equal(value.opacity, time >= 0.2 ? 1 : 0);
  }
  assert.ok(!sampleMotion({ ...spec, duration: -1 }, 0.2, 0).transform.includes('NaN'));
  // Rolagem nos extremos só desloca, sem mudar a opacidade.
  assert.equal(sampleMotion(spec, 0.7, -1).opacity, 1);
  assert.equal(sampleMotion(spec, 0.7, 1).opacity, 1);
});

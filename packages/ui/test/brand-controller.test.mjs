import assert from 'node:assert/strict';
import { test } from 'node:test';

import { animateComposition } from '../.brand-check/animate.js';

function setup(t, reduced = false) {
  const original = Object.fromEntries(
    ['window', 'document', 'IntersectionObserver', 'ResizeObserver'].map((k) => [k, globalThis[k]]),
  );
  const raf = new Map();
  const media = new EventTarget();
  media.matches = reduced;
  const win = new EventTarget();
  let id = 0;
  let now = 100;
  Object.assign(win, {
    innerHeight: 900,
    matchMedia: () => media,
    requestAnimationFrame: (fn) => {
      raf.set(++id, fn);
      return id;
    },
    cancelAnimationFrame: (key) => raf.delete(key),
  });
  const doc = new EventTarget();
  doc.hidden = false;
  let notify;
  let disconnected = false;
  class Observer {
    constructor(fn) {
      notify = fn;
    }
    observe() {}
    disconnect() {
      disconnected = true;
    }
  }
  Object.assign(globalThis, {
    window: win,
    document: doc,
    IntersectionObserver: Observer,
    ResizeObserver: undefined,
  });
  win.IntersectionObserver = Observer;
  t.after(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });
  const attributes = new Map();
  const node = {
    getAttribute: () => JSON.stringify({ delay: 0, duration: 0.6, x: 200, depth: 50 }),
    setAttribute: (k, v) => attributes.set(k, v),
  };
  const svg = {
    querySelectorAll: () => [node],
    getBoundingClientRect: () => ({ top: 200, height: 600 }),
  };
  const flush = (count = 1) => {
    for (let i = 0; i < count; i++) {
      now += 25;
      const callbacks = [...raf.values()];
      raf.clear();
      callbacks.forEach((fn) => fn(now));
    }
  };
  return {
    attributes,
    disconnected: () => disconnected,
    doc,
    flush,
    media,
    raf,
    svg,
    visible: (v) => notify([{ isIntersecting: v, intersectionRatio: v ? 0.7 : 0 }]),
    win,
  };
}

test('observação controla entrada, reversão interrompida e suspensão em repouso', (t) => {
  const s = setup(t);
  const cleanup = animateComposition(s.svg, 1);
  s.visible(true);
  s.flush(10);
  const middle = Number(s.attributes.get('opacity'));
  assert.ok(middle > 0 && middle < 1);
  s.visible(false);
  assert.equal(Number(s.attributes.get('opacity')), middle);
  s.flush(3);
  assert.ok(Number(s.attributes.get('opacity')) < middle);
  s.visible(true);
  s.flush(40);
  assert.equal(s.attributes.get('opacity'), '1');
  assert.equal(s.raf.size, 0);
  s.win.dispatchEvent(new Event('scroll'));
  assert.equal(s.raf.size, 1);
  cleanup();
  assert.equal(s.raf.size, 0);
  assert.equal(s.disconnected(), true);
  s.win.dispatchEvent(new Event('scroll'));
  assert.equal(s.raf.size, 0);
});

test('preferência reduzida reage ao vivo e aba oculta pausa o relógio', (t) => {
  const s = setup(t, true);
  const cleanup = animateComposition(s.svg, 1);
  s.visible(true);
  assert.equal(s.attributes.get('opacity'), '1');
  assert.match(s.attributes.get('transform'), /^translate\(0 0\)/);
  assert.equal(s.raf.size, 0);
  s.media.matches = false;
  s.media.dispatchEvent(new Event('change'));
  s.flush(3);
  s.doc.hidden = true;
  s.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(s.raf.size, 0);
  s.doc.hidden = false;
  s.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(s.raf.size, 1);
  s.media.matches = true;
  s.media.dispatchEvent(new Event('change'));
  assert.equal(s.raf.size, 0);
  assert.equal(s.attributes.get('opacity'), '1');
  cleanup();
});

test('sem IntersectionObserver conserva o desenho estático', (t) => {
  const s = setup(t);
  delete s.win.IntersectionObserver;
  animateComposition(s.svg, 1)();
  assert.equal(s.attributes.size, 0);
  assert.equal(s.raf.size, 0);
});

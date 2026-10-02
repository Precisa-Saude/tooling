import { advance, clamp, sampleMotion, type ShapeMotion } from './timeline.js';

/** Controlador sem estado React por quadro; retorna a limpeza completa. */
export function animateComposition(svg: SVGSVGElement, parallax: number) {
  const nodes = Array.from(svg.querySelectorAll<SVGGElement>('[data-brand-motion]')).map(
    (element) => ({
      element,
      spec: JSON.parse(element.getAttribute('data-brand-motion')!) as ShapeMotion,
    }),
  );
  const duration = Math.max(0, ...nodes.map(({ spec }) => spec.delay + spec.duration));
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let time = 0;
  let target = 0;
  let scroll = 0;
  let visible = false;
  let frame = 0;
  let last = 0;
  let dirty = true;

  const paint = (position: number, offset: number) => {
    for (const { element, spec } of nodes) {
      const value = sampleMotion(spec, position, offset);
      element.setAttribute('transform', value.transform);
      element.setAttribute('opacity', String(value.opacity));
    }
  };
  const tick = (now: number) => {
    frame = 0;
    if (dirty) {
      const box = svg.getBoundingClientRect();
      scroll =
        clamp(
          (window.innerHeight / 2 - box.top - box.height / 2) /
            ((window.innerHeight + box.height) / 2),
          -1,
          1,
        ) * parallax;
      dirty = false;
    }
    time = advance(time, target, last ? Math.min((now - last) / 1000, 0.064) : 0);
    last = now;
    paint(time, scroll);
    if (time !== target) frame = window.requestAnimationFrame(tick);
    else last = 0;
  };
  const wake = () => {
    if (!frame && !document.hidden && !preference.matches) {
      frame = window.requestAnimationFrame(tick);
    }
  };
  const update = () => {
    dirty = true;
    if (visible) wake();
  };
  const suspend = () => {
    window.cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
  };
  const sync = () => {
    suspend();
    if (preference.matches) {
      time = duration;
      paint(duration, 0);
    } else {
      target = visible ? duration : 0;
      dirty = true;
      wake();
    }
  };

  // Sem observador, conserva o SVG estático entregue pelo servidor.
  if (!window.IntersectionObserver) return () => {};
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry) return;
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.15;
      target = visible ? duration : 0;
      dirty = true;
      wake();
    },
    { threshold: [0, 0.15] },
  );
  observer.observe(svg);
  paint(preference.matches ? duration : 0, 0);
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  document.addEventListener('visibilitychange', sync);
  preference.addEventListener('change', sync);
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
  resize?.observe(svg);

  return () => {
    suspend();
    observer.disconnect();
    resize?.disconnect();
    window.removeEventListener('scroll', update);
    window.removeEventListener('resize', update);
    document.removeEventListener('visibilitychange', sync);
    preference.removeEventListener('change', sync);
  };
}

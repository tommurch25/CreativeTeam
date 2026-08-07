/* Shared: reveal on scroll. Blocks fade+rise (.reveal); grids stagger their
   children (.stagger). Classes added via JS so no-JS users still see content. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;

  var FADE = '.hero, .section-head, .table-card, .dfilter, .vregions, .chart-card';
  var STAG = '.grid, .res-grid, .kpi-strip, #varea';

  function init() {
    var fade = [].slice.call(document.querySelectorAll(FADE));
    var stag = [].slice.call(document.querySelectorAll(STAG));
    fade.forEach(function (el) { el.classList.add('reveal'); });
    stag.forEach(function (el) { el.classList.add('stagger'); });
    var all = fade.concat(stag);
    if (!all.length) return;
    // Toggle (don't unobserve) so sections re-animate every time they scroll
    // into view — going down or back up. Reset happens while off-screen.
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.classList.toggle('in', e.isIntersecting); });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    all.forEach(function (el) { io.observe(el); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* Shared: count-up for numbers. window.animateNumber(el, to, fmt) tweens from
   the element's last value to `to`, formatting each frame with fmt. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.animateNumber = function (el, to, fmt) {
    if (!el) return;
    fmt = fmt || function (v) { return String(Math.round(v)); };
    to = Number(to) || 0;
    if (reduce) { el.textContent = fmt(to); el._val = to; return; }
    var from = typeof el._val === 'number' ? el._val : 0;
    if (el._raf) cancelAnimationFrame(el._raf);
    var start = null, dur = 650;
    function step(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / dur), e = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (t < 1) { el._raf = requestAnimationFrame(step); }
      else { el.textContent = fmt(to); el._val = to; el._raf = null; }
    }
    el._raf = requestAnimationFrame(step);
  };
})();

/* Shared: mobile burger nav. */
(function () {
  function init() {
    var burger = document.getElementById('nav-burger'), links = document.getElementById('nav-links');
    if (!burger || !links) return;
    function setOpen(o) {
      links.classList.toggle('open', o);
      burger.classList.toggle('open', o);
      burger.setAttribute('aria-expanded', o ? 'true' : 'false');
    }
    burger.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!links.classList.contains('open')); });
    links.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
    document.addEventListener('click', function (e) { if (!links.contains(e.target) && e.target !== burger) setOpen(false); });
    window.addEventListener('resize', function () { if (window.innerWidth > 760) setOpen(false); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

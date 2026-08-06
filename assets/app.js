/* Shared: reveal sections as they scroll into view.
   Adds .reveal via JS (so no-JS users still see content), then .in when in view. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;

  var SEL = '.hero, .section-head, .grid, .chart-card, .table-card, .dfilter, .brandgrid, .period-bar';

  function init() {
    var els = [].slice.call(document.querySelectorAll(SEL));
    if (!els.length) return;
    els.forEach(function (el) { el.classList.add('reveal'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
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

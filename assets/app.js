/* Shared: reveal on scroll. Blocks fade+rise (.reveal); grids stagger their
   children (.stagger). Classes added via JS so no-JS users still see content. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;

  var FADE = '.hero, .section-head, .table-card, .dfilter, .vregions, .chart-card';
  var STAG = '.grid, .res-grid, .kpi-strip, .team-grid, #varea';

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

/* ============================================================
   Smart helper — floating "find a job or a link" assistant.
   Client-side only: searches a curated link list + the live
   tracker feed (jobs). No API key, no backend, no cost.
   Appears site-wide; nothing else needs editing per page.
   To give it a character: drop a square transparent PNG at
   assets/helper/assistant.png (it replaces the icon automatically).
   ============================================================ */
(function () {
  var DATA_URL = 'https://script.google.com/macros/s/AKfycbz10YPP7Fk9U_Y-WXpAuRXsvrBU4mWvNlfU9jXVY1pB2g8e9Y2pVlc7gZLv8E5Y5FtWXQ/exec';
  var FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScUKFEaGsRDUsAIvRTebVR2CSDq1slB9nup9yxOrakS-XNvlQ/viewform';
  var AVATAR = 'assets/helper/assistant.png';      // full mascot for the launcher
  var HEAD = 'assets/helper/assistant-head.png';   // face crop for the panel header

  // Curated links the helper can point people to. Intentionally excludes the
  // unlinked Dashboard / FY report (uncomment below to make them findable).
  var LINKS = [
    { t: 'Home', d: 'The hub home page', u: 'index.html', k: 'home start overview landing' },
    { t: 'Jobs', d: 'In progress & delivered work', u: 'jobs.html', k: 'jobs work delivered in progress tracker status board what shipped' },
    { t: 'Team', d: 'The creative team', u: 'team.html', k: 'team people designers who staff members' },
    { t: 'Data', d: 'Studio performance & stats', u: 'data.html', k: 'data stats kpi performance numbers metrics analytics' },
    { t: 'Resources', d: 'Guidelines, tools & links', u: 'resources.html', k: 'resources guidelines tools links templates' },
    { t: 'Showcase', d: 'Case studies & standout work', u: 'showcase.html', k: 'showcase case study proud work portfolio' },
    { t: 'Brief in work', d: 'Submit a new brief', u: FORM_URL, k: 'brief request submit new job form raise ticket brief in work', ext: true },
    { t: 'Trello board', d: 'The live Creative Team board', u: 'https://trello.com/b/nQsWDZPA/creative-team', k: 'trello board card kanban', ext: true },
    { t: 'PageProof', d: 'Where work goes for review & sign-off', u: 'https://app.pageproof.com/dashboard', k: 'pageproof proof review sign off approval feedback', ext: true },
    { t: 'Bannerflow', d: 'Digital platform scaling tool', u: 'https://app.bannerflow.com/home/qih/da', k: 'bannerflow banner display scaling digital ads production tool', ext: true },
    { t: 'Creative Induction', d: 'Your welcome to the studio', u: 'Creative-Studio-Induction.html', k: 'induction onboarding welcome new starter joiner intro', ext: true },
    { t: 'All brand guidelines', d: 'Every guideline in one library', u: 'https://fliphtml5.com/bookcase/rgzyz/', k: 'guidelines brand library all rules logo colours fonts', ext: true },
    { t: 'Quantum guidelines', d: 'Master brand guidelines', u: 'https://online.fliphtml5.com/lvgme/Quantum_Creative_Brand_Guidelines/#p=1', k: 'guidelines quantum brand master logo', ext: true },
    { t: 'SlotsWise UK guidelines', d: 'SlotsWise UK brand', u: 'https://online.fliphtml5.com/lvgme/wnef/#p=1', k: 'guidelines slotswise slw uk brand', ext: true },
    { t: 'SlotsWise US guidelines', d: 'SlotsWise US brand', u: 'https://online.fliphtml5.com/lvgme/ldog/#p=1', k: 'guidelines slotswise slw us brand', ext: true },
    { t: 'Strike Wild guidelines', d: 'Strike Wild brand', u: 'https://online.fliphtml5.com/lvgme/tdpk/#p=1', k: 'guidelines strike wild brand', ext: true },
    { t: 'Casino Signup Offers guidelines', d: 'Casino Signup Offers brand', u: 'https://online.fliphtml5.com/lvgme/CSO_Brand_Guidelines_2026/#p=1', k: 'guidelines casino signup offers cso brand', ext: true }
    // { t: 'Studio dashboard', d: 'Comparative trends', u: 'dashboard.html', k: 'dashboard trends analytics comparison', ext: true },
    // { t: 'The year in creative', d: 'FY report', u: 'creative-allocation-fy2026.html', k: 'report fy year allocation annual', ext: true }
  ];

  // ---- icons ----
  var IC = {
    spark: '<svg viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/><circle cx="12" cy="12" r="3.2"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>',
    doc: '<svg viewBox="0 0 24 24"><path d="M6 2h8l4 4v16H6Z"/><path d="M14 2v4h4"/></svg>',
    job: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>',
    brand: '<svg viewBox="0 0 24 24"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7-7A2 2 0 0 1 3 12.2V5a2 2 0 0 1 2-2h7.2a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.3"/></svg>'
  };

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var codeOf = function (s) { var i = String(s).indexOf(' - '); return (i > -1 ? String(s).slice(0, i) : String(s)).trim(); };
  var brandCodes = function (b) { return String(b || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean).map(codeOf).map(function (c) { return c === 'CAS' ? 'CBK' : c; }); };

  var FEED = null, LOADING = false, FAILED = false, JOBS = [], BRANDS = [];
  var root, panel, input, bodyEl, launch, nudge, open = false, activeIdx = -1, flat = [];

  function fetchFeed() {
    if (FEED || LOADING) return;
    LOADING = true;
    fetch(DATA_URL, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      FEED = d; LOADING = false;
      var meta = d.brandMeta || {};
      BRANDS = Object.keys(meta).map(function (code) { return { code: code, name: (meta[code] || {}).name || code, flag: (meta[code] || {}).flag || '' }; });
      var ip = (d.inProgress || []).map(function (j) {
        return { jn: j.jobNumber || '', title: j.title || '', brand: j.brand || '', extra: [j.owner, j.status].join(' '),
                 url: j.trelloUrl || '', tag: (j.status || 'In progress'), state: 'live' };
      });
      var dv = (d.delivered || []).map(function (j) {
        return { jn: j.jobNumber || '', title: j.title || '', brand: j.brand || '', extra: [j.stakeholder, j.channel, j.assetType, (j.designer || []).join(' ')].join(' '),
                 url: (j.deliveryUrl && j.deliveryUrl !== '#') ? j.deliveryUrl : (j.trelloUrl || ''), tag: 'Delivered' + (j.delivered ? ' ' + j.delivered : ''), state: 'done' };
      });
      JOBS = ip.concat(dv).map(function (j) {
        j.codes = brandCodes(j.brand);
        j.hay = [j.jn, j.title, j.codes.join(' '), j.brand, j.extra].join(' ').toLowerCase();
        return j;
      });
      if (open) render(input.value);
    }).catch(function () { LOADING = false; FAILED = true; if (open) render(input.value); });
  }

  // ---- scoring ----
  function terms(q) { return q.toLowerCase().trim().split(/\s+/).filter(Boolean); }
  function scoreHay(hay, ts, title) {
    var all = ts.every(function (t) { return hay.indexOf(t) > -1; });
    if (!all) return 0;
    var s = 10;
    var lt = (title || '').toLowerCase();
    ts.forEach(function (t) { if (lt.indexOf(t) === 0) s += 6; else if (lt.indexOf(t) > -1) s += 2; });
    return s;
  }

  function searchLinks(ts) {
    return LINKS.map(function (l) {
      return { l: l, s: scoreHay((l.t + ' ' + l.d + ' ' + l.k).toLowerCase(), ts, l.t) };
    }).filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s; }).map(function (x) { return x.l; });
  }
  function searchBrands(ts) {
    var out = [];
    BRANDS.forEach(function (b) {
      var hay = (b.code + ' ' + b.name).toLowerCase();
      if (scoreHay(hay, ts, b.name) > 0) {
        out.push({ t: (b.flag ? b.flag + ' ' : '') + b.name + ' jobs', d: 'All ' + b.code + ' work in the tracker', u: 'jobs.html?q=' + encodeURIComponent(b.code), ico: 'brand' });
      }
    });
    return out.slice(0, 3);
  }
  function searchJobs(ts) {
    var digits = ts.join('').replace(/\D/g, '');
    return JOBS.map(function (j) {
      var s = scoreHay(j.hay, ts, j.title);
      if (digits && j.jn.replace(/\D/g, '') === digits) s += 40;
      else if (digits && j.jn.replace(/\D/g, '').indexOf(digits) === 0) s += 20;
      return { j: j, s: s };
    }).filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 6).map(function (x) { return x.j; });
  }

  // ---- render ----
  function resItem(o) {
    // o: { href, ext, ico, icoCls, title, sub, tag, tagCls }
    var tag = o.tag ? '<span class="qh-tag ' + (o.tagCls || '') + '">' + esc(o.tag) + '</span>' : '';
    return '<a class="qh-res" href="' + esc(o.href) + '"' + (o.ext ? ' target="_blank" rel="noopener"' : '') + '>' +
      '<span class="qh-ico ' + (o.icoCls || '') + '">' + (IC[o.ico] || IC.link) + '</span>' +
      '<span class="qh-rtext"><span class="qh-rt">' + esc(o.title) + '</span><span class="qh-rd">' + esc(o.sub) + '</span></span>' +
      tag + '</a>';
  }
  function linkItem(l) {
    return resItem({ href: l.u, ext: l.ext, ico: l.ico || (l.u.indexOf('.html') > -1 && l.u.indexOf('http') !== 0 ? 'doc' : 'link'), title: l.t, sub: l.d, tag: l.ext ? 'Open ↗' : 'Open' });
  }
  function jobItem(j) {
    var brand = j.codes.length ? j.codes.join(', ') : '—';
    return resItem({ href: j.url || 'jobs.html', ext: !!j.url, ico: 'job', icoCls: 'job',
      title: (j.jn ? j.jn + ' · ' : '') + (j.title || 'Untitled'), sub: brand, tag: j.tag, tagCls: j.state === 'live' ? 'live' : 'done' });
  }

  function defaultView() {
    var chips = ['Find a job', 'Brief in work', 'Brand guidelines', 'Trello board'];
    var pop = LINKS.filter(function (l) { return ['Jobs', 'Brief in work', 'Trello board', 'All brand guidelines'].indexOf(l.t) > -1; });
    return '<p class="qh-greet">Need help finding something? Search a job number, brand, stakeholder — or a link like guidelines or PageProof.</p>' +
      '<div class="qh-chips">' + chips.map(function (c) { return '<button class="qh-chip" data-q="' + esc(c === 'Find a job' ? '' : c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' +
      '<div class="qh-group"><div class="qh-group-t">Popular</div>' + pop.map(linkItem).join('') + '</div>';
  }

  function render(q) {
    q = (q || '').trim();
    activeIdx = -1;
    if (!q) { bodyEl.innerHTML = defaultView(); bindChips(); collectFlat(); return; }
    var ts = terms(q);
    var links = searchLinks(ts), brands = searchBrands(ts), jobs = searchJobs(ts);
    var html = '';
    var linkResults = brands.map(function (b) { return resItem({ href: b.u, ico: b.ico, title: b.t, sub: b.d, tag: 'Jobs' }); })
      .concat(links.slice(0, 5).map(linkItem));
    if (linkResults.length) html += '<div class="qh-group"><div class="qh-group-t">Pages & links</div>' + linkResults.join('') + '</div>';
    if (jobs.length) html += '<div class="qh-group"><div class="qh-group-t">Jobs</div>' + jobs.map(jobItem).join('') + '</div>';
    else if (LOADING) html += '<p class="qh-note">Loading jobs…</p>';
    else if (FAILED) html += '<p class="qh-note">Couldn’t reach the jobs feed just now — links above still work.</p>';
    if (!linkResults.length && !jobs.length && !LOADING) {
      html = '<div class="qh-empty">No match for “' + esc(q) + '”.<br>Try a job number or brand, or <a href="' + esc(FORM_URL) + '" target="_blank" rel="noopener">brief it in</a>.</div>';
    }
    bodyEl.innerHTML = html;
    collectFlat();
  }

  function collectFlat() { flat = [].slice.call(bodyEl.querySelectorAll('.qh-res')); }
  function bindChips() {
    bodyEl.querySelectorAll('.qh-chip').forEach(function (c) {
      c.addEventListener('click', function () { input.value = c.dataset.q || ''; input.focus(); render(input.value); });
    });
  }
  function setActive(i) {
    if (!flat.length) return;
    activeIdx = (i + flat.length) % flat.length;
    flat.forEach(function (el, n) { el.classList.toggle('active', n === activeIdx); });
    flat[activeIdx].scrollIntoView({ block: 'nearest' });
  }

  // ---- open / close ----
  function setOpen(o) {
    open = o; root.classList.toggle('open', o); root.classList.add('seen');
    launch.setAttribute('aria-expanded', o ? 'true' : 'false');
    if (o) { hideNudge(); fetchFeed(); render(input.value); setTimeout(function () { input.focus(); }, 60); }
  }
  function hideNudge() { if (nudge) { nudge.classList.remove('show'); } }

  // ---- build DOM ----
  function build() {
    if (document.querySelector('.qh')) return;
    root = document.createElement('div'); root.className = 'qh';
    root.innerHTML =
      '<div class="qh-nudge" role="status"><button class="qh-nudge-x" aria-label="Dismiss">×</button>Need help finding something?</div>' +
      '<div class="qh-panel" role="dialog" aria-label="Creative Hub helper">' +
        '<div class="qh-head">' +
          '<span class="qh-htext"><span class="qh-htitle">Hub helper</span><span class="qh-hsub">Find a job or a link</span></span>' +
          '<button class="qh-x" aria-label="Close helper">×</button>' +
        '</div>' +
        '<div class="qh-body"></div>' +
        '<div class="qh-foot">' +
          '<div class="qh-search">' + IC.search + '<input type="search" aria-label="Search the hub" placeholder="Search jobs, brands, links…" autocomplete="off" /></div>' +
          '<div class="qh-hint">Enter opens the top result · Esc closes</div>' +
        '</div>' +
      '</div>' +
      '<button class="qh-launch has-mascot" aria-label="Open helper" aria-expanded="false" aria-haspopup="dialog">' +
        '<img src="' + AVATAR + '" alt="" onerror="this.remove();this.parentNode.classList.remove(\'has-mascot\')" />' +
        '<span class="qh-open-i">' + IC.spark + '</span><span class="qh-close-i">' + IC.close + '</span>' +
      '</button>';
    document.body.appendChild(root);

    panel = root.querySelector('.qh-panel');
    bodyEl = root.querySelector('.qh-body');
    input = root.querySelector('.qh-search input');
    launch = root.querySelector('.qh-launch');
    nudge = root.querySelector('.qh-nudge');

    launch.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!open); });
    root.querySelector('.qh-x').addEventListener('click', function () { setOpen(false); });
    root.querySelector('.qh-nudge-x').addEventListener('click', function (e) { e.stopPropagation(); hideNudge(); try { sessionStorage.setItem('qhNudge', '1'); } catch (x) {} });
    nudge.addEventListener('click', function () { setOpen(true); });
    panel.addEventListener('click', function (e) { e.stopPropagation(); });

    var t;
    input.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { render(input.value); }, 120); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeIdx + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeIdx - 1); }
      else if (e.key === 'Enter') { var el = flat[activeIdx > -1 ? activeIdx : 0]; if (el) el.click(); }
    });

    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) setOpen(false); });
    document.addEventListener('click', function (e) { if (open && !root.contains(e.target)) setOpen(false); });

    // Nudge: show once per session, shortly after load.
    var seen; try { seen = sessionStorage.getItem('qhNudge'); } catch (x) { seen = null; }
    if (!seen) setTimeout(function () { if (!open) { nudge.classList.add('show'); try { sessionStorage.setItem('qhNudge', '1'); } catch (x) {} setTimeout(hideNudge, 9000); } }, 2200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();

/**
 * Creative Hub — Jobs feed
 * Reads the Delivered Google Sheet + the Trello board and returns one JSON feed.
 * Deploy as a Web App (Execute as: Me, Who has access: Anyone) and use the /exec URL.
 */

// ===== Settings (already filled in for you) =====
var TRELLO_KEY  = 'c2512fe6b78078ee159f530bafca7a50';
var TRELLO_TOKEN = 'ATTAc67d1d13bb3e4b875c89f6a0ec36aec8e4efc6f62ab615aa8ca5d68fb33999aa39E33EBF';
var BOARD_ID = 'nQsWDZPA';
var IN_PROGRESS_LISTS = ['Joe', 'Ben', 'Charlie', 'Eoin', 'Rich', 'Zaid', 'Tom'];
var PENDING_LISTS = ['Incoming Projects', 'PM - Monthly Sprint'];   // unassigned backlog
var SHEET_ID = '1_EY4DLiualQJ2rgK6NNCb5Jf3OcUk61DiT3Kk00kcSM';
var SHEET_GID = 2015462909;
var DELIVERED_LIMIT = 5000;   // effectively all delivered rows (was 250). Monthly stats already read the whole sheet regardless; this only caps the row list sent to the browser.

// Absence: the shared "Who's Out" calendar. Events are titled "Full Name (Leave type - N days)".
var ABSENCE_CALENDAR_ID = '6eprn1d547l0s22vg2mftqdqfaeu54js@import.calendar.google.com';
var ABSENCE_SOON_DAYS = 7;    // how far ahead to flag "out soon"
// Full names exactly as shown on the Team page — only these are flagged.
var TEAM_NAMES = ['Richard Morton', 'Joe Khalique-Brown', 'Zaid Arabi-Katbi', 'Charlie Gardner', 'Ben Richards', 'Eoin McDermott', 'Tom Murch'];
// ================================================

// Brand directory — source of truth for vertical, colour, flag (from Quantum_Brand_Reference).
var BRAND_CONFIG = {
  'CSO':    { name: 'Casino Signup Offers', vertical: 'UK iGaming',       region: 'GB',  flag: '🇬🇧', colour: '#ff00c1' },
  'STR':    { name: 'Strike Wild',          vertical: 'UK iGaming',       region: 'GB',  flag: '🇬🇧', colour: '#defd3d' },
  'FSL':    { name: 'Free Spins Loopy',     vertical: 'UK iGaming',       region: 'GB',  flag: '🇬🇧', colour: '#c00055' },
  'FSW':    { name: 'Free Spins Wizard',    vertical: 'UK iGaming',       region: 'GB',  flag: '🇬🇧', colour: '#371a49' },
  'SLW UK': { name: 'SlotsWise UK',         vertical: 'UK iGaming',       region: 'GB',  flag: '🇬🇧', colour: '#00ff88' },
  'TOP':    { name: 'Top Choices',          vertical: 'UK Comparison',    region: 'GB',  flag: '🇬🇧', colour: '#00c19d' },
  'CUS':    { name: 'Custard',              vertical: 'Rewards',          region: 'GB',  flag: '🇬🇧', colour: '#ffb800' },
  'CBK':    { name: 'Cashback',             vertical: 'Rewards',          region: 'GB',  flag: '🇬🇧', colour: '#47007b' },
  'POD':    { name: 'Podium Bets',          vertical: 'UK Sport',         region: 'GB',  flag: '🇬🇧', colour: '#de001c' },
  'BUS':    { name: 'Bonuses USA',          vertical: 'US Regulated',     region: 'US',  flag: '🇺🇸', colour: '#2c37f8' },
  'SLW US': { name: 'SlotsWise US',         vertical: 'US Social Gaming', region: 'US',  flag: '🇺🇸', colour: '#c61df7' },
  'ASB':    { name: 'ASB',                  vertical: 'US Social Gaming', region: 'US',  flag: '🇺🇸', colour: '#143b76' },
  'SLW IE': { name: 'SlotsWise IE',         vertical: 'iGaming',          region: 'IE',  flag: '🇮🇪', colour: '#00ff88' },
  'SLW ZA': { name: 'SlotsWise ZA',         vertical: 'iGaming',          region: 'ZA',  flag: '🇿🇦', colour: '#00ff88' },
  'QUA':    { name: 'Quantum',              vertical: 'Quantum',          region: 'INT', flag: '🏢', colour: '#0086ff' },
  'QUN':    { name: 'Quantum Network',      vertical: 'Quantum',          region: 'INT', flag: '🏢', colour: '#ff7900' }
};

// Highest-count key in a {key: count} map.
function topKey(map) { var best = '', n = -1; for (var k in map) { if (map[k] > n) { n = map[k]; best = k; } } return best; }

// Delivered brand cells look like "SLW UK - SlotsWise UK, CBK - Cashback" — return the codes (CAS shown as CBK).
function deliveredBrandCodes(cell) {
  return String(cell || '').split(',').map(function (s) {
    s = s.trim(); var i = s.indexOf(' - '); var c = (i > -1 ? s.slice(0, i) : s).trim();
    return c === 'CAS' ? 'CBK' : c;
  }).filter(Boolean);
}

// Pull the card identifiers out of a Trello link (…/c/<shortLink>/<idShort>-slug).
function cardRefs(url) {
  var m = String(url || '').match(/\/c\/([A-Za-z0-9]+)(?:\/(\d+))?/);
  return m ? { s: m[1], n: m[2] || '' } : null;
}

// Map every card in the "Completed" list to its due date AND its designer(s) — the card
// members that match the creative team. Keyed by shortLink and card number.
function getCompletedMaps() {
  var due = {}, members = {}, names = {};
  var lists = trello('boards/' + BOARD_ID + '/lists?fields=name');
  var completed = null;
  for (var i = 0; i < lists.length; i++) { if (/completed/i.test(lists[i].name || '')) { completed = lists[i]; break; } }
  if (!completed) return { due: due, members: members, names: names };
  var before = '';
  for (var p = 0; p < 5; p++) {   // up to 5,000 cards
    var cards = trello('lists/' + completed.id + '/cards?fields=name,due,shortLink,idShort&members=true&member_fields=fullName&limit=1000' + (before ? '&before=' + before : ''));
    if (!cards.length) break;
    for (var c = 0; c < cards.length; c++) {
      var card = cards[c];
      if (card.name) { if (card.shortLink) names['s' + card.shortLink] = card.name; if (card.idShort) names['n' + card.idShort] = card.name; }
      if (card.due) { if (card.shortLink) due['s' + card.shortLink] = card.due; if (card.idShort) due['n' + card.idShort] = card.due; }
      var names = (card.members || []).map(function (m) { return m.fullName; }).filter(function (n) { return TEAM_NAMES.indexOf(n) > -1; });
      if (names.length) { if (card.shortLink) members['s' + card.shortLink] = names; if (card.idShort) members['n' + card.idShort] = names; }
    }
    if (cards.length < 1000) break;
    before = cards[cards.length - 1].id;
  }
  return { due: due, members: members, names: names };
}

var CACHE_SECONDS = 300;   // serve a cached feed for 5 minutes before re-querying Trello + the sheet

// Run this once from the editor to wipe the cached feed and force the next request to rebuild fresh.
function clearFeedCache() {
  var c = CacheService.getScriptCache();
  var n = +(c.get('feed_n') || 0), keys = ['feed_n'];
  for (var i = 0; i < n; i++) keys.push('feed_' + i);
  c.removeAll(keys);
}

function doGet(e) {
  if (e && e.parameter && e.parameter.debug === 'format') {
    return ContentService.createTextOutput(JSON.stringify(formatDebug())).setMimeType(ContentService.MimeType.JSON);
  }
  if (e && e.parameter && e.parameter.debug === 'absence') {
    return ContentService.createTextOutput(JSON.stringify(absenceDebug())).setMimeType(ContentService.MimeType.JSON);
  }
  if (e && e.parameter && e.parameter.feed === 'compliance') {
    return ContentService.createTextOutput(complianceFeed()).setMimeType(ContentService.MimeType.JSON);
  }
  var cache = CacheService.getScriptCache();
  var cached = cacheGet(cache, 'feed');
  if (cached) {
    return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
  }
  var out = JSON.stringify(buildPayload());
  cachePut(cache, 'feed', out, CACHE_SECONDS);
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

// ---- Compliance live feed ------------------------------------------------
// Add or edit sources here. Verify each URL returns RSS/Atom (open it in a browser).
// Run complianceFeedDebug() from the editor to see which sources load and how many items pass the filter.
var COMPLIANCE_SOURCES = [
  { name: 'ASA rulings',            market: 'uk', url: 'https://www.asa.org.uk/rss.xml',                 filter: false },
  { name: 'UK Gambling Commission', market: 'uk', url: 'https://www.gamblingcommission.gov.uk/rss/news', filter: false },
  { name: 'FTC press releases',     market: 'us', url: 'https://www.ftc.gov/feeds/press-release.xml',    filter: true  }
];
// Sources with filter:true only keep items mentioning one of these words.
var COMPLIANCE_KEYWORDS = /gambl|betting|casino|sweepstake|lotter|igaming|slots|advertis|endorse|influencer|deceptive|misleading|promotion|bonus|rewards/i;
var COMPLIANCE_CACHE_SECONDS = 3600;
var COMPLIANCE_MAX_ITEMS = 40;

function complianceFeed() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('compliance');
  if (hit) return hit;
  var out = JSON.stringify(buildComplianceFeed(null));
  try { cache.put('compliance', out, COMPLIANCE_CACHE_SECONDS); } catch (e) {}
  return out;
}

function complianceFeedDebug() {
  var log = [];
  buildComplianceFeed(log);
  Logger.log(log.join('\n'));
}

function buildComplianceFeed(log) {
  var items = [];
  COMPLIANCE_SOURCES.forEach(function (s) {
    try {
      var res = UrlFetchApp.fetch(s.url, { muteHttpExceptions: true, followRedirects: true });
      if (res.getResponseCode() !== 200) { if (log) log.push(s.name + ': HTTP ' + res.getResponseCode()); return; }
      var got = parseFeed(res.getContentText(), s);
      if (log) log.push(s.name + ': ' + got.length + ' items');
      items = items.concat(got);
    } catch (err) {
      if (log) log.push(s.name + ': error ' + err);
    }
  });
  items.sort(function (a, b) { return b.date < a.date ? -1 : 1; });
  return { updated: new Date().toISOString(), items: items.slice(0, COMPLIANCE_MAX_ITEMS) };
}

function parseFeed(xml, s) {
  var doc = XmlService.parse(xml), root = doc.getRootElement(), out = [];
  function kids(el, name) { return el.getChildren().filter(function (c) { return c.getName() === name; }); }
  function txt(el, name) { var k = kids(el, name)[0]; return k ? k.getText() : ''; }
  var entries = [];
  if (root.getName() === 'rss') {
    var ch = kids(root, 'channel')[0];
    entries = ch ? kids(ch, 'item') : [];
    entries.forEach(function (it) { out.push(mk(txt(it, 'title'), txt(it, 'link'), txt(it, 'pubDate'), txt(it, 'description'))); });
  } else {
    entries = kids(root, 'entry');
    entries.forEach(function (it) {
      var l = kids(it, 'link')[0];
      out.push(mk(txt(it, 'title'), l ? l.getAttribute('href').getValue() : '', txt(it, 'updated') || txt(it, 'published'), txt(it, 'summary')));
    });
  }
  function mk(title, link, date, desc) {
    var d = new Date(date);
    return { title: String(title).replace(/\s+/g, ' ').trim(), link: link, source: s.name, market: s.market,
             date: isNaN(d) ? new Date().toISOString() : d.toISOString(), _t: title + ' ' + desc };
  }
  return out.filter(function (i) {
    var keep = !s.filter || COMPLIANCE_KEYWORDS.test(i._t);
    delete i._t;
    return keep && i.title && /^https?:/.test(i.link);
  });
}

function buildPayload() {
  var inProgress = getInProgress();
  var cmaps = getCompletedMaps();      // Trello due dates + card members (designers)
  var deliveredData = getDelivered(cmaps.due, cmaps.members, cmaps.names);
  var stats = deliveredData.stats;
  stats.activeJobs = inProgress.length;
  return {
    updated: new Date().toISOString().slice(0, 10),
    inProgress: inProgress,
    delivered: deliveredData.rows,
    stats: stats,
    brandMeta: BRAND_CONFIG,
    absence: getAbsence()
  };
}

// Read the "Who's Out" calendar and flag each team member as away (off today) or out soon
// (off within ABSENCE_SOON_DAYS). Work From Home is not treated as away.
// Uses the Advanced Calendar service (Services → Google Calendar API), which — unlike
// CalendarApp — can read subscribed/imported calendars like "Who's Out".

function absenceItems() {
  var today = new Date(); today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  var winEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + ABSENCE_SOON_DAYS + 1);
  var resp = Calendar.Events.list(ABSENCE_CALENDAR_ID, {
    timeMin: today.toISOString(),
    timeMax: winEnd.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 250
  });
  return (resp && resp.items) ? resp.items : [];
}

// Diagnostic: hit <exec-url>?debug=absence to see what the calendar read finds.
function absenceDebug() {
  var info = { titles: [], matched: {}, error: null };
  try {
    var items = absenceItems();
    for (var i = 0; i < items.length; i++) info.titles.push(items[i].summary);
    info.matched = getAbsence();
  } catch (e) { info.error = String(e); }
  return info;
}

// ---- Absence from the Team_Holiday tracker --------------------------------
// Primary source for the Team page "Away" / "Out soon" flags. The Who's Out calendar is only a fallback.
var HOLIDAY_SHEET_ID = '1PlpTgNU4Jhk_XyfueMJzjKZR51Fofjb1zYnfGjd0sIA';
// Only these leave types raise a flag. Sick leave, WFH, out of office and bereavement are deliberately excluded.
var HOLIDAY_FLAG_TYPES = ['Annual Leave (Vacation)', 'Birthday Day Off', 'Maternity/Paternity Leave'];

function getAbsence() {
  try {
    var r = getAbsenceFromHolidaySheet();
    if (r) return r;
  } catch (e) { Logger.log('Holiday sheet read failed: ' + e); }
  return getAbsenceFromCalendar();
}

function getAbsenceFromHolidaySheet() {
  var ss = SpreadsheetApp.openById(HOLIDAY_SHEET_ID);
  var team = ss.getSheetByName('Team').getDataRange().getValues();
  var nameMap = {};                                   // "morton, richard" -> "Richard Morton"
  for (var t = 1; t < team.length; t++) {
    if (team[t][0] && team[t][1]) nameMap[String(team[t][1]).trim().toLowerCase()] = String(team[t][0]).trim();
  }
  var rows = ss.getSheetByName('Holiday Data').getDataRange().getValues();

  var today = new Date(); today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  var soonLimit = new Date(today.getFullYear(), today.getMonth(), today.getDate() + ABSENCE_SOON_DAYS);
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var isoLocal = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var label = function (d) { return d.getDate() + ' ' + MONTHS[d.getMonth()]; };
  function toDate(v) {
    if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
    var m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);       // dd/mm/yyyy
    return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
  }
  function nextWorkday(d) {                           // day after d, skipping weekends
    var n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    while (n.getDay() === 0 || n.getDay() === 6) n.setDate(n.getDate() + 1);
    return n;
  }

  var byPerson = {};
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var full = nameMap[String(r[0]).trim().toLowerCase()];
    if (!full) continue;
    if (HOLIDAY_FLAG_TYPES.indexOf(String(r[1]).trim()) === -1) continue;
    if (String(r[5]).trim() !== 'Approved') continue;
    var s = toDate(r[2]), e = toDate(r[3]);
    if (!s || !e) continue;
    (byPerson[full] = byPerson[full] || []).push({ s: s, e: e, days: parseFloat(r[4]) || 0 });
  }

  // The next 5 working days (from today, or the next workday if today is a weekend) — used for capacity.
  var win = [], wd = new Date(today.getTime());
  while (wd.getDay() === 0 || wd.getDay() === 6) wd.setDate(wd.getDate() + 1);
  while (win.length < 5) {
    win.push(new Date(wd.getTime()));
    wd = nextWorkday(wd);
  }
  function offDaysIn(list) {                           // working days of leave inside the window (half days count 0.5)
    var total = 0;
    win.forEach(function (day) {
      var frac = 0;
      list.forEach(function (it) {
        if (it.s <= day && day <= it.e) {
          var f = (it.s.getTime() === it.e.getTime() && it.days > 0 && it.days < 1) ? it.days : 1;
          if (f > frac) frac = f;
        }
      });
      total += frac;
    });
    return total;
  }

  var out = {};
  Object.keys(byPerson).forEach(function (full) {
    var list = byPerson[full];
    var cur = null;
    for (var k = 0; k < list.length; k++) {
      if (list[k].s <= today && today <= list[k].e) { cur = list[k]; break; }
    }
    if (cur) {                                         // away now: chain back-to-back leave to find the real return day
      var back = nextWorkday(cur.e), moved = true;
      while (moved) {
        moved = false;
        for (var j = 0; j < list.length; j++) {
          if (list[j].s.getTime() <= back.getTime() && list[j].e.getTime() >= back.getTime()) { back = nextWorkday(list[j].e); moved = true; }
        }
      }
      out[full] = { state: 'away', date: isoLocal(back), label: label(back) };
      return;
    }
    var soon = null;                                   // not off today: earliest leave starting within the window
    for (var q = 0; q < list.length; q++) {
      if (list[q].s > today && list[q].s <= soonLimit && (!soon || list[q].s < soon)) soon = list[q].s;
    }
    if (soon) out[full] = { state: 'soon', date: isoLocal(soon), label: label(soon) };
  });
  Object.keys(out).forEach(function (full) { out[full].offDays = offDaysIn(byPerson[full] || []); });
  return out;
}

function absenceSheetDebug() {
  Logger.log(JSON.stringify(getAbsenceFromHolidaySheet()));
}

function getAbsenceFromCalendar() {
  var out = {};
  var items;
  try { items = absenceItems(); } catch (e) { return out; }

  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var isoLocal = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var ymd = function (s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  var label = function (d) { return d.getDate() + ' ' + MONTHS[d.getMonth()]; };

  var today = new Date(); today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  var soonLimit = new Date(today.getFullYear(), today.getMonth(), today.getDate() + ABSENCE_SOON_DAYS);

  for (var i = 0; i < items.length; i++) {
    var ev = items[i];
    var title = ev.summary || '';
    if (/work from home/i.test(title)) continue;                 // still working
    var name = title.split(' (')[0].trim();
    var full = null;
    for (var t = 0; t < TEAM_NAMES.length; t++) {
      if (TEAM_NAMES[t].toLowerCase() === name.toLowerCase()) { full = TEAM_NAMES[t]; break; }
    }
    if (!full) continue;

    var s, e;
    if (ev.start && ev.start.date) {                              // all-day: end.date is exclusive
      s = ymd(ev.start.date); e = ymd(ev.end.date);
    } else {                                                      // timed
      var sd = new Date(ev.start.dateTime), ed = new Date(ev.end.dateTime);
      s = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate());
      e = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate() + 1);
    }

    if (s <= today && today < e) {                                // off right now → back on end date
      out[full] = { state: 'away', date: isoLocal(e), label: label(e) };
    } else if (s > today && s.getTime() <= soonLimit.getTime()) { // off within the window
      if (!out[full] || (out[full].state === 'soon' && s.getTime() < new Date(out[full].date).getTime())) {
        out[full] = { state: 'soon', date: isoLocal(s), label: label(s) };
      }
    }
  }
  return out;
}

// CacheService caps each value at ~100KB, so store the JSON in chunks.
function cachePut(cache, key, str, ttl) {
  var CH = 95000, n = Math.ceil(str.length / CH), obj = {};
  obj[key + '_n'] = String(n);
  for (var i = 0; i < n; i++) obj[key + '_' + i] = str.substr(i * CH, CH);
  cache.putAll(obj, ttl);
}
function cacheGet(cache, key) {
  var meta = cache.get(key + '_n');
  if (!meta) return null;
  var n = +meta, keys = [];
  for (var i = 0; i < n; i++) keys.push(key + '_' + i);
  var got = cache.getAll(keys), parts = [];
  for (var j = 0; j < n; j++) { var p = got[key + '_' + j]; if (p == null) return null; parts.push(p); }
  return parts.join('');
}

function toMinutes(v) {
  v = String(v == null ? '' : v).trim();
  var m = v.match(/^(\d+):(\d+)/);          // hh:mm
  if (m) return (+m[1]) * 60 + (+m[2]);
  var n = parseFloat(v);                     // or a plain number of hours
  return isNaN(n) ? 0 : Math.round(n * 60);
}

function emptyStats() {
  return {
    jobsLast: 0, jobsPrev: 0, assetsLast: 0, assetsPrev: 0, minsPerAssetLast: 0, minsPerAssetPrev: 0,
    topBrand: '', topBrandPrev: '', topVertical: '', topVerticalPrev: '', topTeam: '', topTeamPrev: '',
    staticPctLast: 0, staticPctPrev: 0,
    onTimeLast: null, onTimePrev: null, onTimeOverall: null, onTimeScored: 0,
    lastMonthLabel: '', prevMonthLabel: ''
  };
}

var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function trello(path) {
  var url = 'https://api.trello.com/1/' + path + (path.indexOf('?') > -1 ? '&' : '?') +
            'key=' + TRELLO_KEY + '&token=' + TRELLO_TOKEN;
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  return JSON.parse(res.getContentText());
}

function pick(desc, label) {
  if (!desc) return '';
  // Label must sit at the start of a line (allowing markdown *, _, > and spaces),
  // so "Format" doesn't accidentally match inside "Information:".
  var re = new RegExp('(?:^|\\n)[\\s*_>]*' + label + '[\\s*_]*:\\s*`?([^\\n`]+)', 'i');
  var m = desc.match(re);
  return m ? m[1].replace(/[`*_]/g, '').trim() : '';
}

function fmtDue(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d)) return '';
  return d.getDate() + ' ' + MONTHS[d.getMonth()];
}

function fmtDate(d) {
  return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}

// Brand list — code + full name. Detection matches either, in a card's title or description.
var BRANDS = [
  { code: 'ASB', name: 'All Star Bonuses' },
  { code: 'CBK', name: 'Cashback', aliases: ['CAS'] },
  { code: 'CSO', name: 'Casino Signup Offers' },
  { code: 'CUS', name: 'Custard' },
  { code: 'FSL', name: 'Free Spins Loopy' },
  { code: 'FSW', name: 'Free Spins Wizard' },
  { code: 'POD', name: 'Podium Bets' },
  { code: 'SLW', name: 'SlotsWise', country: true },
  { code: 'STR', name: 'Strike Wild' },
  { code: 'TOP', name: 'Top Choices' }
];

function detectBrand(text) {
  if (!text) return '';
  var found = [];
  for (var i = 0; i < BRANDS.length; i++) {
    var b = BRANDS[i];
    var nameEsc = b.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var nameRe = new RegExp('\\b' + nameEsc + '\\b', 'i');   // full name, any case
    var matched = nameRe.test(text);
    if (!matched) {
      var codes = [b.code].concat(b.aliases || []);          // code + aliases, uppercase only
      for (var k = 0; k < codes.length; k++) {
        if (new RegExp('\\b' + codes[k] + '\\b').test(text)) { matched = true; break; }
      }
    }
    if (matched) {
      var label = b.code;
      if (b.country) {                         // e.g. SLW -> "SLW UK" / "SLW US"
        var cc = [];
        if (/\bUK\b/.test(text)) cc.push('UK');
        if (/\bUS\b/.test(text)) cc.push('US');
        if (cc.length) label = b.code + ' ' + cc.join('/');
      }
      if (found.indexOf(label) === -1) found.push(label);
    }
  }
  return found.join(', ');
}

// Normalise any job reference to "JN####" (e.g. "1498" -> "JN1498", "#1524" -> "JN1524").
function jnFormat(v) {
  v = String(v == null ? '' : v).trim();
  var d = v.replace(/\D/g, '');
  return d ? 'JN' + d : v;
}

function jobNo(c) {
  var hay = (c.name || '') + ' ' + (c.desc || '');
  var m = hay.match(/\bJN[\s-]?(\d{2,})/i);       // explicit JN written on the card wins
  if (m) return 'JN' + m[1];
  return c.idShort ? ('JN' + c.idShort) : '';      // otherwise JN + the Trello card number
}

// Turn a "Project From" value (usually an email) into a friendly display name.
// moses.ogunbayo@quantum.media -> "Moses Ogunbayo"; leaves plain names as-is.
function prettyStake(s) {
  s = (s || '').trim();
  if (!s) return '';
  var at = s.indexOf('@');
  if (at > -1) {
    var local = s.slice(0, at).replace(/[._-]+/g, ' ').trim();
    if (!local) return s;
    return local.replace(/\b\w/g, function (ch) { return ch.toUpperCase(); });
  }
  return s;
}

// Diagnostic: open <exec-url>?debug=format (or run formatDebug in the editor) to see which in-progress
// cards have a recognised Format line, and what the description looks like on the ones that don't.
function formatDebug() {
  var rows = getInProgress(true), withFmt = 0, out = [];
  rows.forEach(function (r) {
    var has = !r.formatGuessed;
    if (has) withFmt++;
    out.push({ jn: r.jobNumber, owner: r.owner || '(unassigned)', title: r.title, format: r.format, types: r.types, guessed: r.formatGuessed, hold: r.hold,
               description_start: has ? undefined : r.descHead });
  });
  var res = { total: rows.length, withFormat: withFmt, withoutFormat: rows.length - withFmt, cards: out };
  Logger.log(JSON.stringify(res, null, 1));
  return res;
}

// Best-guess format from the title (and the description's Requirements text). Used only when a card has no
// Format line or label. Copywriters' lists default to copy; everything else defaults to static.
function guessTypes(title, desc, owner) {
  var t = String(title || '') + ' ' + String(desc || '').slice(0, 600);
  var MOTION = /\b(motion|video|videos|animation|animated|gifs?|ugc|b-?roll|reels?|tiktok|stitch|skits?|podcast|story ads?|voice-?over|footage|trailer|captions?|subtitles?|scroll[- ]stopp\w*|interview|selfie)\b/i;
  var COPY = /\b(copy|copywriting|scripts?|crm|emails?|seo|articles?|linkedin|h1|h2|faqs?|persona'?s?|terms|handbook|messaging|captions? copy|tone of voice)\b/i;
  var STATIC = /\b(static|statics|banners?|iframes?|tiles?|images?|imagery|logos?|posters?|templates?|assets?|carousel|header|hero|modules?|wheel|poster|slides?|deck)\b/i;
  if (MOTION.test(t)) return ['motion'];
  if (/^joe$/i.test(owner) && !STATIC.test(t)) return ['copy'];
  if (COPY.test(t) && !STATIC.test(t)) return ['copy'];
  return ['static'];
}

function labelNames(labels) {
  return (labels || []).map(function (l) { return String(l.name || '').toLowerCase(); });
}
function cardTypes(labels) {
  var out = [];
  labelNames(labels).forEach(function (n) {
    ['static', 'motion', 'copy'].forEach(function (t) { if (n.indexOf(t) > -1 && out.indexOf(t) === -1) out.push(t); });
  });
  return out;
}
// The brief form writes "Format: Motion" (etc.) into the card description.
function descFormat(desc) {
  var m = String(desc || '').match(/format\s*\**\s*:\s*\**\s*`*([^\n\r`]+)/i);
  return m ? m[1].replace(/[*`]/g, '').trim() : '';
}
function formatTypes(fmt) {
  var f = String(fmt || '').toLowerCase(), out = [];
  var both = /\bboth\b/.test(f);                       // legacy "Both" = static + motion
  if (both || /static/.test(f)) out.push('static');
  if (both || /motion|video|animation/.test(f)) out.push('motion');
  if (/copy|content/.test(f)) out.push('copy');
  return out;
}
function mergeTypes(a, b) {
  var out = a.slice();
  b.forEach(function (t) { if (out.indexOf(t) === -1) out.push(t); });
  return out;
}
function cardOnHold(labels, title) {
  var byLabel = labelNames(labels).some(function (n) { return n.indexOf('hold') > -1; });
  return byLabel || /\bon hold\b|\[hold\]|\(hold\)/i.test(title || '');
}

// Trello custom fields (Custom Fields power-up): returns {fieldId: {name, options:{optionId:text}}}
function boardCustomFields() {
  var out = {};
  try {
    var fs = trello('boards/' + BOARD_ID + '/customFields');
    (fs || []).forEach(function (f) {
      var o = {};
      (f.options || []).forEach(function (x) { o[x.id] = (x.value && (x.value.text || x.value.number)) || ''; });
      out[f.id] = { name: f.name || '', options: o };
    });
  } catch (e) {}
  return out;
}
// Text of any custom field on the card whose name looks like a format / asset type field.
function cardCustomFormat(c, defs) {
  var vals = [];
  (c.customFieldItems || []).forEach(function (it) {
    var d = defs[it.idCustomField]; if (!d) return;
    if (!/format|asset|type|deliverable|output/i.test(d.name)) return;
    var v = it.idValue ? d.options[it.idValue] : (it.value && (it.value.text || it.value.number));
    if (v) vals.push(String(v));
  });
  return vals.join(', ');
}

function getInProgress(withDesc) {
  var cfDefs = boardCustomFields();
  var lists = trello('boards/' + BOARD_ID + '/lists?fields=name');
  var out = [];
  var now = new Date();
  for (var i = 0; i < lists.length; i++) {
    var list = lists[i];
    var name = (list.name || '').trim();
    var isProgress = IN_PROGRESS_LISTS.indexOf(name) > -1;
    var isPending = PENDING_LISTS.indexOf(name) > -1;
    if (!isProgress && !isPending) continue;
    var cards = trello('lists/' + list.id + '/cards?fields=name,due,url,desc,idShort,labels&customFieldItems=true');
    for (var j = 0; j < cards.length; j++) {
      var c = cards[j];
      var cn = (c.name || '').trim();
      if (!cn) continue;
      if (/-\s*in progress$/i.test(cn)) continue;                 // per-person header card
      if (/^sprint\b/i.test(cn)) continue;                        // "SPRINT: …" divider cards
      if (cn.toLowerCase() === name.toLowerCase()) continue;      // list heading card (e.g. "Incoming Projects")
      var dueDate = c.due ? new Date(c.due) : null;
      var overdue = dueDate && !isNaN(dueDate) && dueDate < now;
      // Trello card creation time is encoded in the first 8 hex chars of its id.
      var created = c.id ? new Date(parseInt(String(c.id).substring(0, 8), 16) * 1000) : null;
      var createdOk = created && !isNaN(created);
      var pf = (c.desc || '').match(/project\s*from:\s*([^\n\r]+)/i);
      var stakeRaw = pf ? pf[1].replace(/[*`]/g, '').trim() : '';
      // Format: the card's own "Format:" line or label first; otherwise guess from the title so every brief has one.
      var cfFmt = cardCustomFormat(c, cfDefs);
      var types = mergeTypes(mergeTypes(formatTypes(descFormat(c.desc)), formatTypes(cfFmt)), cardTypes(c.labels));
      var guessed = false;
      if (!types.length) { types = guessTypes(cn, c.desc, isPending ? '' : name); guessed = true; }
      out.push({
        jobNumber: jobNo(c),
        title: cn,
        brand: detectBrand(cn + ' ' + (c.desc || '')),
        owner: isPending ? '' : name,
        status: isPending ? 'Pending' : (overdue ? 'Overdue' : 'In progress'),
        due: fmtDue(c.due),
        dueISO: (dueDate && !isNaN(dueDate)) ? dueDate.toISOString().slice(0, 10) : '',
        submitted: createdOk ? fmtDate(created) : '',
        submittedISO: createdOk ? created.toISOString().slice(0, 10) : '',
        stakeholder: prettyStake(stakeRaw),
        stakeholderEmail: stakeRaw,
        // Trello labels drive capacity: "Mild/Medium Motion" etc. mark motion work; "ON HOLD" excludes a card from capacity.
        descHead: withDesc ? String(c.desc || '').slice(0, 400) : undefined,
        format: descFormat(c.desc),
        types: types,
        formatGuessed: guessed,
        hold: cardOnHold(c.labels, cn),
        trelloUrl: c.url
      });
    }
  }
  return out;
}

function getDelivered(dueMap, memberMap, nameMap) {
  dueMap = dueMap || {}; memberMap = memberMap || {}; nameMap = nameMap || {};
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheets = ss.getSheets();
  var sheet = null;
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === SHEET_GID) { sheet = sheets[i]; break; }
  }
  if (!sheet) sheet = sheets[0];

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return { rows: [], stats: emptyStats() };

  var headers = values[0].map(function (h) { return String(h).toLowerCase(); });
  function col() {
    var needles = Array.prototype.slice.call(arguments);
    for (var i = 0; i < headers.length; i++) {
      for (var j = 0; j < needles.length; j++) {
        if (headers[i].indexOf(needles[j]) > -1) return i;
      }
    }
    return -1;
  }
  var iJob = col('job number'), iType = col('asset type'), iBrand = col('brand'),
      iChannel = col('channel'), iStake = col('stakeholder'), iTime = col('timestamp'),
      iDeliv = col('delivery link'), iTrello = col('trello link'),
      iDur = col('how long', 'hh:mm'),
      iStatic = col('static asset'), iMotion = col('motion asset'), iCopy = col('copy asset'),
      iAssetsLegacy = col('how many assets'),   // legacy single "how many assets" column (pre-split)
      iTitle = col('brief title', 'job title', 'task name', 'project name', 'brief name');   // specific only — avoid matching 'Brief Quality'
  var hasSplit = (iStatic > -1 || iMotion > -1 || iCopy > -1);   // sheet now records the static/motion/copy split

  var now = new Date();
  var lastKey = now.getFullYear() * 12 + now.getMonth() - 1;   // previous calendar month
  var prevKey = lastKey - 1;                                    // the month before that
  var st = {
    jobs: { last: 0, prev: 0 }, assets: { last: 0, prev: 0 }, minutes: { last: 0, prev: 0 },
    brand: { last: {}, prev: {} }, vert: { last: {}, prev: {} }, team: { last: {}, prev: {} },
    stat: { last: 0, prev: 0 }, motion: { last: 0, prev: 0 },
    ot: { last: { sc: 0, ok: 0 }, prev: { sc: 0, ok: 0 }, all: { sc: 0, ok: 0 } }
  };

  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var job = iJob > -1 ? String(row[iJob]).trim() : '';
    if (!job) continue;
    var ts = iTime > -1 ? row[iTime] : '';
    var d = ts ? new Date(ts) : null;
    var valid = d && !isNaN(d);
    var brandCell = iBrand > -1 ? String(row[iBrand]).trim() : '';
    var channelCell = iChannel > -1 ? String(row[iChannel]).trim() : '';
    var typeCell = iType > -1 ? String(row[iType]).trim() : '';
    var trelloCell = iTrello > -1 ? String(row[iTrello]).trim() : '';
    var deliveredISO = valid ? d.toISOString().slice(0, 10) : '';
    function assetNum(i){ return (i > -1) ? (parseFloat(String(row[i]).replace(/[^0-9.]/g, '')) || 0) : 0; }
    var nStatic = assetNum(iStatic), nMotion = assetNum(iMotion), nCopy = assetNum(iCopy);
    var assetsN = hasSplit ? (nStatic + nMotion + nCopy) : (iAssetsLegacy > -1 ? assetNum(iAssetsLegacy) : null);
    var durMin = iDur > -1 ? toMinutes(row[iDur]) : 0;
    var hoursN = iDur > -1 ? Math.round(durMin / 60 * 100) / 100 : null;

    if (valid) {   // accumulate monthly stats over ALL rows (before the display cap)
      var key = d.getFullYear() * 12 + d.getMonth();
      var bucket = key === lastKey ? 'last' : (key === prevKey ? 'prev' : null);
      if (bucket) {
        st.jobs[bucket]++;
        st.assets[bucket] += assetsN || 0;
        st.minutes[bucket] += durMin;
        deliveredBrandCodes(brandCell).forEach(function (code) {
          st.brand[bucket][code] = (st.brand[bucket][code] || 0) + 1;
          var v = BRAND_CONFIG[code] ? BRAND_CONFIG[code].vertical : null;
          if (v) st.vert[bucket][v] = (st.vert[bucket][v] || 0) + 1;
        });
        channelCell.split(',').forEach(function (t) { t = t.trim(); if (t) st.team[bucket][t] = (st.team[bucket][t] || 0) + 1; });
        if (hasSplit) { st.stat[bucket] += nStatic; st.motion[bucket] += nMotion; }   // count assets by type
        else { var at = typeCell.toLowerCase(); if (at === 'static') st.stat[bucket]++; else if (at === 'motion') st.motion[bucket]++; }
      }

      // On-time: delivery date vs the Trello card's due date
      var refs = cardRefs(trelloCell);
      var due = refs ? (dueMap['s' + refs.s] || (refs.n ? dueMap['n' + refs.n] : null)) : null;
      if (due) {
        var onTime = deliveredISO <= new Date(due).toISOString().slice(0, 10);
        st.ot.all.sc++; if (onTime) st.ot.all.ok++;
        if (bucket) { st.ot[bucket].sc++; if (onTime) st.ot[bucket].ok++; }
      }
    }

    var oRefs = cardRefs(trelloCell);
    var oDue = oRefs ? (dueMap['s' + oRefs.s] || (oRefs.n ? dueMap['n' + oRefs.n] : null)) : null;
    var rowOnTime = (valid && oDue) ? (deliveredISO <= new Date(oDue).toISOString().slice(0, 10)) : null;
    var oDesigner = oRefs ? (memberMap['s' + oRefs.s] || (oRefs.n ? memberMap['n' + oRefs.n] : null)) : null;

    var oName = oRefs ? (nameMap['s' + oRefs.s] || (oRefs.n ? nameMap['n' + oRefs.n] : '')) : '';
    rows.push({
      jobNumber: jnFormat(job),
      title: (iTitle > -1 ? String(row[iTitle]).trim() : '') || oName || '',
      onTime: rowOnTime,
      designer: oDesigner || [],
      assetType: typeCell,
      brand: brandCell,
      channel: channelCell,
      stakeholder: iStake > -1 ? String(row[iStake]).trim() : '',
      assets: assetsN,
      assetsStatic: hasSplit ? nStatic : null,
      assetsMotion: hasSplit ? nMotion : null,
      assetsCopy: hasSplit ? nCopy : null,
      hours: hoursN,
      delivered: valid ? fmtDate(d) : String(ts),
      deliveredISO: deliveredISO,
      _sort: valid ? d.getTime() : 0,
      deliveryUrl: iDeliv > -1 ? String(row[iDeliv]).trim() : '',
      trelloUrl: trelloCell
    });
  }
  rows.sort(function (a, b) { return b._sort - a._sort; });
  rows = rows.slice(0, DELIVERED_LIMIT).map(function (o) { delete o._sort; return o; });

  var mpa = function (b) { return st.assets[b] ? Math.round(st.minutes[b] / st.assets[b]) : 0; };
  var pctStatic = function (b) { var s = st.stat[b], m = st.motion[b]; return (s + m) ? Math.round(s / (s + m) * 100) : 0; };
  var onTime = function (b) { return st.ot[b].sc ? Math.round(st.ot[b].ok / st.ot[b].sc * 100) : null; };
  var MSHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var stats = {
    jobsLast: st.jobs.last, jobsPrev: st.jobs.prev,
    assetsLast: st.assets.last, assetsPrev: st.assets.prev,
    minsPerAssetLast: mpa('last'), minsPerAssetPrev: mpa('prev'),
    topBrand: topKey(st.brand.last), topBrandPrev: topKey(st.brand.prev),
    topVertical: topKey(st.vert.last), topVerticalPrev: topKey(st.vert.prev),
    topTeam: topKey(st.team.last), topTeamPrev: topKey(st.team.prev),
    staticPctLast: pctStatic('last'), staticPctPrev: pctStatic('prev'),
    onTimeLast: onTime('last'), onTimePrev: onTime('prev'), onTimeOverall: onTime('all'),
    onTimeScored: st.ot.all.sc,
    lastMonthLabel: MSHORT[new Date(now.getFullYear(), now.getMonth() - 1, 1).getMonth()],
    prevMonthLabel: MSHORT[new Date(now.getFullYear(), now.getMonth() - 2, 1).getMonth()]
  };
  return { rows: rows, stats: stats };
}

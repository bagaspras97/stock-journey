// Builds data.js from the story files and real daily closes (Yahoo Finance chart API, split-adjusted, no dividends).
// Usage: node src/build-data.js <dir with d_<TICKER>.json>
const fs = require('fs'), path = require('path');
const PX = process.argv[2];
const ROOT = path.join(__dirname, '..');

global.window = {};
const oldSrc = fs.readFileSync(path.join(__dirname, 'stories-old.js'), 'utf8');
eval(oldSrc);
const OLD = window.STOCKS;
const NEW = require('./stories-new.js'), MORE = require('./stories-more.js'), IDN = require('./stories-id.js'), IDN2 = require('./stories-id2.js'), IDN3 = require('./stories-id3.js'), US4 = require('./stories-us4.js'), IDN4 = require('./stories-id4.js');
const file = tk => tk.replace(/\W/g, '');

// corrections found while checking the original stories against daily data
const FIX = {
  nvda: [
    ['Di pertengahan tahun, saham jatuh hampir separuh dari posisi April.', 'Antara April dan Agustus, saham kehilangan lebih dari separuh nilainya.'],
    ['Saham mencapai puncak sekitar $7,30 (disesuaikan split)', 'Saham mencapai puncak sekitar $7,23 (disesuaikan split)'],
    ["'Puncak $7,30'", "'Puncak $7,23'"],
  ],
  lly: [
    ['Saham jatuh 14% dalam sehari.', 'Saham jatuh lebih dari 10% dalam sehari.'],
    ['Solanezumab gagal −14%', 'Solanezumab gagal −10%'],
    ['Saham naik sekitar 70% dalam 19 bulan.', 'Saham naik lebih dari 70% dalam kurang dari dua tahun.'],
    ['Saham yang dianggap aman bisa turun 25%', 'Saham yang dianggap aman bisa turun lebih dari 20%'],
  ],
};
FIX.xom = [['Harga hanya naik sekitar 70% dalam 16 tahun.', 'Harga hanya naik sekitar 75% dalam 16 tahun.']];
const GROUP = {tsla: 'Konsumen', nflx: 'Komunikasi & media'};
// English translations: src/en/*.js, keyed by stock id (events under "events")
const EN_ALL = {};
for (const f of fs.readdirSync(path.join(__dirname, 'en')).filter(f => f.endsWith('.js')).sort()) Object.assign(EN_ALL, require(path.join(__dirname, 'en', f)));
const enMissing = [];
function attachEn(S){
  const T = EN_ALL[S.id];
  if (!T){ enMissing.push(S.id); return; }
  const bad = m => { throw new Error(`EN ${S.id}: ${m}`); };
  if (T.ch.length !== S.ch.length) bad(`chapters ${T.ch.length} vs ${S.ch.length}`);
  if (T.lessons.length !== S.lessons.length) bad('lessons');
  S.ch.forEach((c, i) => { const t = T.ch[i];
    for (const k of ['era', 'kicker', 'title', 'body']) if (!t[k]) bad(`ch${i + 1} ${k}`);
    if (t.causes.length !== c.causes.length) bad(`ch${i + 1} causes ${t.causes.length} vs ${c.causes.length}`);
    if (t.ev.length !== c.ev.length) bad(`ch${i + 1} ev ${t.ev.length} vs ${c.ev.length}`);
    c.ev = c.ev.map((e, k) => [e[0], e[1], t.ev[k]]); });
  S.en = {sector: T.sector, lead: T.lead, split: T.split, lessons: T.lessons, ch: T.ch.map(({era, kicker, title, body, causes}) => ({era, kicker, title, body, causes}))};
}

function fixText(S){
  let j = JSON.stringify(S);
  for (const [a, b] of FIX[S.id] || []){
    const ja = JSON.stringify(a).slice(1, -1), jb = JSON.stringify(b).slice(1, -1);
    const aa = a.startsWith("'") ? JSON.stringify(a.slice(1, -1)) : ja, bb = b.startsWith("'") ? JSON.stringify(b.slice(1, -1)) : jb;
    if (!j.includes(aa)) throw new Error(`fix not found in ${S.id}: ${a}`);
    j = j.split(aa).join(bb);
  }
  return JSON.parse(j);
}

// Indonesian (IDX) series need cleaning: Yahoo adds market holidays with a carried-over price,
// one known bad print, and over-adjusts the BBRI 2021 rights issue.
const IDX_DAYS = (() => {
  const r = JSON.parse(fs.readFileSync(path.join(PX, 't_JKSE.json'))).chart.result[0];
  return new Set(r.timestamp.map((t, i) => r.indicators.quote[0].close[i] != null ? new Date(t*1000).toISOString().slice(0, 10) : null).filter(Boolean));
})();
const IDX_BAD = {'TLKM.JK': ['2011-03-23'], 'TOWR.JK': ['2018-05-02', '2018-05-04'], 'MAPI.JK': ['2018-05-02', '2018-05-04', '2018-05-14']};
// BNI: a December 2010 rights-issue adjustment could not be verified, so its series starts in 2011.
// Chandra Asri: the ticker belonged to Tri Polyta until the merger completed at the start of 2011.
// Bank Jago: before 2019 a thinly traded small bank with erratic prints. Mayora: a 2013 bonus-share adjustment that does not reconcile.
// Aneka Tambang: Yahoo has no trades from May 2010 to September 2012. Alfamart and Sarana Menara: before 2014 most rows repeat the previous day.
const IDX_START = {'BBNI.JK': '2011-01-03', 'TPIA.JK': '2011-01-03', 'ARTO.JK': '2019-01-02', 'MYOR.JK': '2013-10-22',
  'ANTM.JK': '2012-09-24', 'AMRT.JK': '2014-01-02', 'TOWR.JK': '2014-01-02',
  'BNGA.JK': '2011-01-03'}; // CIMB Niaga: a December 2010 adjustment that could not be verified
// BBRI rights issue (ex-date 8 Sep 2021): Yahoo scales earlier prices by 0.909072. The theoretical ex-rights
// factor from the offer (0.22873 new shares per share at Rp3,400, cum price Rp3,910) is 0.97571.
const IDX_REFACTOR = {'BBRI.JK': [{before: '2021-09-08', mult: 0.97571 / 0.909072}]};
// Rows without any trade (volume 0), or repeating the previous row's close and volume exactly, are dropped:
// Yahoo fills them with a carried or stale price.
function clean(tk, days, vols, ...series){
  if (!tk.endsWith('.JK')) return;
  const dup = i => i > 0 && series[0][i] === series[0][i-1] && vols[i] === vols[i-1];
  const keep = days.map((d, i) => IDX_DAYS.has(d) && !(IDX_BAD[tk] || []).includes(d) && d >= (IDX_START[tk] || '') && vols[i] > 0 && !dup(i));
  for (const {before, mult} of IDX_REFACTOR[tk] || []) series.forEach(v => days.forEach((d, i) => { if (d < before) v[i] *= mult; }));
  for (let i = days.length - 1; i >= 0; i--) if (!keep[i]){ days.splice(i, 1); vols.splice(i, 1); series.forEach(v => v.splice(i, 1)); }
}
function load(tk){
  const d = JSON.parse(fs.readFileSync(path.join(PX, `d_${file(tk)}.json`))).chart.result[0];
  const days = [], vals = [], vols = [];
  d.timestamp.forEach((t, i) => {
    const c = d.indicators.quote[0].close[i];
    const day = new Date(t*1000).toISOString().slice(0, 10);
    if (c != null && day >= '2010-01-01' && day <= '2025-12-31'){ days.push(day); vals.push(c); vols.push(d.indicators.quote[0].volume[i]); }
  });
  clean(tk, days, vols, vals);
  return days.map((d, i) => [d, vals[i]]);
}
const round = v => +(v < 1 ? v.toFixed(4) : v < 10 ? v.toFixed(3) : v.toFixed(2));
const addDays = (d, n) => new Date(Date.parse(d) + n*864e5).toISOString().slice(0, 10);

const report = [];
function build(S0){
  const S = fixText(S0);
  if (GROUP[S.id]) S.group = GROUP[S.id];
  delete S.raw; delete S.color;
  attachEn(S);
  const D = load(S.yf || S.tk);
  if (IDX_START[S.yf]) S.lateStart = true; // listed earlier, data starts later
  const days = D.map(d => d[0]);
  const idxOnOrAfter = d => { const i = days.findIndex(x => x >= d); return i < 0 ? days.length-1 : i; };
  const idxOnOrBefore = d => { let i = -1; for (let k = 0; k < days.length && days[k] <= d; k++) i = k; return Math.max(0, i); };
  const extreme = (d, kind, win = 45) => {
    let best = -1;
    for (let k = 0; k < days.length; k++){
      if (days[k] < addDays(d, -win) || days[k] > addDays(d, win)) continue;
      if (best < 0 || (kind === 'max' ? D[k][1] > D[best][1] : D[k][1] < D[best][1])) best = k;
    }
    return best;
  };
  // snap boundaries to real closing extremes
  S.ch[0].s = days[0];
  S.ch.forEach((c, i) => {
    const next = S.ch[i+1];
    if (!next){ c.e = days[days.length-1]; return; }
    const kind = c.type === 'bull' && next.type !== 'bull' ? 'max' : c.type === 'bear' && next.type !== 'bear' ? 'min' : null;
    const k = kind ? extreme(c.e, kind) : idxOnOrBefore(c.e);
    if (days[k] !== c.e) report.push(`${S.tk} ch${i+1} end ${c.e} -> ${days[k]}`);
    c.e = days[k]; next.s = c.e;
  });
  // events land on a trading day inside their chapter
  S.ch.forEach(c => { c.ev = c.ev.map(([d, l, le]) => {
    let k = idxOnOrAfter(d); if (days[k] > c.e) k = idxOnOrBefore(d);
    return le ? [days[k], l, le] : [days[k], l]; }).filter(([d]) => d >= c.s && d <= c.e); });
  // series: weekly closes plus every boundary and event day
  const keep = new Set([0, days.length-1]);
  for (let k = 0; k < days.length; k++){
    const wk = new Date(days[k]).getUTCDay(), nextWk = k+1 < days.length ? new Date(days[k+1]).getUTCDay() : -1;
    if (nextWk <= wk) keep.add(k); // last trading day of the week
  }
  S.ch.forEach(c => { keep.add(days.indexOf(c.s)); keep.add(days.indexOf(c.e)); c.ev.forEach(([d]) => { const k = days.indexOf(d); keep.add(k); if (k > 0) keep.add(k-1); }); });
  S.raw = [...keep].filter(k => k >= 0).sort((a, b) => a - b).map(k => [days[k], round(D[k][1])]);
  // checks
  S.ch.forEach((c, i) => {
    if (i && c.s !== S.ch[i-1].e) throw new Error(`${S.tk} gap at ch${i+1}`);
    if (!(c.e > c.s)) throw new Error(`${S.tk} empty chapter ${i+1}`);
    const from = D[days.indexOf(c.s)][1], to = D[days.indexOf(c.e)][1], p = (to/from - 1)*100;
    if (c.type === 'bull' && p < 0) throw new Error(`${S.tk} ch${i+1} marked bull but ${p.toFixed(1)}%`);
    if (c.type === 'bear' && p > 0) throw new Error(`${S.tk} ch${i+1} marked bear but ${p.toFixed(1)}%`);
    c._pct = p;
  });
  return S;
}

const ORDER = ['nvda','aapl','msft','avgo','amd','intc','orcl','pltr','googl','meta','nflx','amzn','tsla','wmt','cost','hd','ko','pg','mcd','brkb','jpm','bac','v','ma','lly','unh','jnj','pfe','xom','cvx','ba','cat','unp','csco','crm','adbe','qcom','ibm','abbv','mrk','pep','nke','dis','wfc','gs','bbca','bbri','bmri','bbni','tlkm','asii','icbp','unvr','tpia','bren','ammn','goto','byan','dcii','amrt','brpt','cuan','untr','klbf','isat','cpin','indf','ggrm','myor','antm','inco','ptba','arto','towr','buka','pgas','itmg','akra','jsmr','excl','sido','inkp','intp','bnga','jpfa','mapi','mika','bdmn','eraa','pnbn'];

// USD/IDR (Yahoo "IDR=X"): drop feed glitches with a rolling median, keep weekly closes plus month starts
function loadFx(){
  const d = JSON.parse(fs.readFileSync(path.join(PX, 'd_IDR.json'))).chart.result[0];
  const pts = [];
  d.timestamp.forEach((t, i) => { const c = d.indicators.quote[0].close[i]; const day = new Date(t*1000).toISOString().slice(0, 10);
    if (c != null && day >= '2010-01-01' && day <= '2025-12-31') pts.push([day, c]); });
  const clean = pts.filter((p, i) => {
    const win = pts.slice(Math.max(0, i-6), i+7).map(q => q[1]).sort((a, b) => a - b), med = win[win.length >> 1];
    return Math.abs(p[1]/med - 1) < .03;
  });
  const keep = clean.filter((p, i) => { const n = clean[i+1]; return !n || new Date(n[0]).getUTCDay() <= new Date(p[0]).getUTCDay() || p[0].slice(5,7) !== n[0].slice(5,7) || i === 0; });
  return {removed: pts.length - clean.length, series: keep.map(([d, v]) => [d, Math.round(v)])};
}

// event impacts from daily closes
const EVENTS_SRC = require('./events.js');
function closeOnOrBefore(days, d){ let k = -1; for (let i = 0; i < days.length && days[i] <= d; i++) k = i; return k; }
function impact(days, vals, ev){
  const a = closeOnOrBefore(days, ev.start), b = closeOnOrBefore(days, ev.end);
  if (days[0] > ev.start) return null; // not listed yet
  const chg = (vals[b]/vals[a] - 1)*100;
  let rec = null;
  if (chg < 0) for (let i = b; i < days.length; i++) if (vals[i] >= vals[a]){ rec = days[i]; break; }
  return {chg: +chg.toFixed(2), from: days[a], to: days[b], rec};
}
const fx = loadFx();
// adjusted closes (dividends reinvested) and dividends, plus the S&P 500 price and total-return indices
function loadAdj(file, tk = ''){
  const r = JSON.parse(fs.readFileSync(path.join(PX, file))).chart.result[0];
  const days = [], adj = [], close = [], vols = [];
  r.timestamp.forEach((t, i) => { const a = r.indicators.adjclose[0].adjclose[i], c = r.indicators.quote[0].close[i]; const d = new Date(t*1000).toISOString().slice(0, 10);
    if (a != null && c != null && d >= '2010-01-01' && d <= '2025-12-31'){ days.push(d); adj.push(a); close.push(c); vols.push(r.indicators.quote[0].volume[i]); } });
  clean(tk, days, vols, adj, close);
  const divs = Object.values((r.events || {}).dividends || {}).map(v => [new Date(v.date*1000).toISOString().slice(0, 10), v.amount]).filter(([d]) => d >= '2010-01-01' && d <= '2025-12-31').sort();
  return {days, adj, close, divs};
}
const monthly = (days, vals) => { const out = []; days.forEach((d, i) => { const n = days[i+1]; if (i === 0 || !n || n.slice(0, 7) !== d.slice(0, 7)) out.push([d, +vals[i].toPrecision(6)]); }); return out; };
function extras(S){
  const a = loadAdj(`t_${file(S.yf || S.tk)}.json`, S.yf || S.tk);
  const trMult = a.adj[a.adj.length-1] / a.adj[0], pxMult = a.close[a.close.length-1] / a.close[0];
  const byYear = {}; a.divs.forEach(([d, v]) => { const y = d.slice(0, 4); byYear[y] = +((byYear[y] || 0) + v).toFixed(4); });
  return {trMult: +trMult.toFixed(4), pxMult: +pxMult.toFixed(4), tr: monthly(a.days, a.adj), divYears: byYear, divCount: a.divs.length};
}
const spx = loadAdj('t_GSPC.json'), sptr = loadAdj('t_SP500TR.json'), jkse = loadAdj('t_JKSE.json');
const MARKET = {spx: monthly(spx.days, spx.close), sptr: monthly(sptr.days, sptr.adj), jkse: monthly(jkse.days, jkse.close)};
const LOGO = fs.existsSync(path.join(__dirname, 'extra/logos.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'extra/logos.json'))).icons : {};

const all = [...OLD, ...NEW, ...MORE, ...US4, ...IDN, ...IDN2, ...IDN3, ...IDN4].map(build).map(S => Object.assign(S, extras(S), LOGO[S.tk] ? {logo: LOGO[S.tk].path} : {}));
all.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
const EVENTS = EVENTS_SRC.map(ev => {
  const rows = {};
  for (const S of all.filter(S => S.mkt !== 'id')){ const r = loadAdj(`t_${file(S.tk)}.json`, S.tk); rows[S.tk] = impact(r.days, r.close, ev); }
  const en = (EN_ALL.events || {})[ev.id];
  return {...ev, ...(en ? {en} : {}), sp: impact(spx.days, spx.close, ev), rows};
});
const EVENTS_ID = require('./events-id.js').map(ev => {
  const rows = {};
  for (const S of all.filter(S => S.mkt === 'id')){ const r = loadAdj(`t_${file(S.yf)}.json`, S.yf); rows[S.tk] = impact(r.days, r.close, ev); }
  const en = (EN_ALL.events_id || {})[ev.id];
  return {...ev, ...(en ? {en} : {}), sp: impact(jkse.days, jkse.close, ev), rows};
});

// split output for the site: a small index per market and language, and one detail file per stock and language
const DIR = path.join(ROOT, 'd');
fs.rmSync(DIR, {recursive: true, force: true}); fs.mkdirSync(path.join(DIR, 's'), {recursive: true});
const sig = v => +v.toPrecision(5);
const T = (S, lang) => lang === 'en' && S.en ? S.en : null;
const MKTS = {us: all.filter(S => S.mkt !== 'id'), id: all.filter(S => S.mkt === 'id')};
fs.writeFileSync(path.join(DIR, 'ids.js'), '// Stock id -> market, used to pick which index to load.\nwindow.SJ_IDS = ' + JSON.stringify(Object.fromEntries(all.map(S => [S.id, S.mkt === 'id' ? 'id' : 'us']))) + ';\n');
const evText = (ev, lang) => { const {en, rows, sp, ...rest} = ev; return {...rest, ...(lang === 'en' && en ? en : {}), rows, sp}; };
// brand color, initial and Logo.dev domain from src/meta.js; every stock must have a color
const META = require('./meta.js');
const metaOf = S => { const m = META[S.id]; if (!m || !m.c || !m.cd) throw new Error(`meta.js: no colors for ${S.id}`);
  return {c: m.c, cd: m.cd, ...(m.ini ? {ini: m.ini} : {}), ...(m.logo && !S.logo ? {ld: m.fill ? [m.logo, 1] : [m.logo]} : {})}; };
let indexBytes = {};
for (const mkt of ['us', 'id']) for (const lang of ['id', 'en']){
  const stocks = MKTS[mkt].map(S => { const t = T(S, lang);
    return {id: S.id, tk: S.tk, name: S.name, ex: S.ex, mkt: S.mkt || 'us', group: S.group, sector: t ? t.sector : S.sector,
      ...(S.logo ? {logo: S.logo} : {}), ...(S.lateStart ? {lateStart: true} : {}), ...metaOf(S),
      trMult: S.trMult, pxMult: S.pxMult, divCount: S.divCount,
      raw: monthly(S.raw.map(r => r[0]), S.raw.map(r => r[1])).map(([d, v]) => [d, sig(v)]), tr: S.tr,
      ch: S.ch.map((c, i) => ({s: c.s, e: c.e, type: c.type, title: t ? t.ch[i].title : c.title, pct: +c._pct.toFixed(2)}))}; });
  const events = (mkt === 'id' ? EVENTS_ID : EVENTS).map(ev => evText(ev, lang));
  const market = mkt === 'id' ? {jkse: MARKET.jkse} : {spx: MARKET.spx, sptr: MARKET.sptr};
  const f = path.join(DIR, `${mkt}-${lang}.js`);
  fs.writeFileSync(f, `// Generated by src/build-data.js: ${mkt.toUpperCase()} stocks, ${lang} text. Month-end prices for lists and comparisons; full detail in d/s/.\n` +
    'window.STOCKS = ' + JSON.stringify(stocks) + ';\nwindow.EVENTS = ' + JSON.stringify(events) + ';\nwindow.MARKET = ' + JSON.stringify(market) + ';\nwindow.FX_IDR = ' + JSON.stringify(fx.series) + ';\n');
  indexBytes[`${mkt}-${lang}`] = fs.statSync(f).size;
}
for (const S of all) for (const lang of ['id', 'en']){
  const t = T(S, lang);
  const full = {raw: S.raw, lead: t ? t.lead : S.lead, split: t ? t.split : S.split, lessons: t ? t.lessons : S.lessons, divYears: S.divYears,
    ch: S.ch.map((c, i) => { const tc = t ? t.ch[i] : null;
      return {s: c.s, e: c.e, type: c.type, era: tc ? tc.era : c.era, kicker: tc ? tc.kicker : c.kicker, title: tc ? tc.title : c.title,
        body: tc ? tc.body : c.body, causes: tc ? tc.causes : c.causes, ev: c.ev.map(e => [e[0], lang === 'en' && e[2] ? e[2] : e[1]])}; })};
  fs.writeFileSync(path.join(DIR, 's', `${S.id}-${lang}.js`), '(window.SJ_STOCK = window.SJ_STOCK || {})[' + JSON.stringify(S.id) + '] = ' + JSON.stringify(full) + ';\n');
}
console.log('index bytes', indexBytes);
const out = all.map(S => { S.ch.forEach(c => delete c._pct); return S; });
fs.writeFileSync(path.join(ROOT, 'data.js'),
  '// Generated by src/build-data.js. Prices: daily closes from Yahoo Finance, split-adjusted, excluding dividends;\n' +
  '// weekly closes plus every chapter boundary and event day.\nwindow.STOCKS = ' + JSON.stringify(out) + ';\n' +
  '// USD/IDR closes (Yahoo Finance), cleaned of feed glitches.\nwindow.FX_IDR = ' + JSON.stringify(fx.series) + ';\n' +
  '// Logos: Simple Icons (CC0); trademarks of their owners.\n' +
  '// Market-wide events with per-stock impact from daily closes.\nwindow.EVENTS = ' + JSON.stringify(EVENTS) + ';\n' +
  '// Indonesian market events, impact against the JCI.\nwindow.EVENTS_ID = ' + JSON.stringify(EVENTS_ID) + ';\n' +
  '// Month-end market indices (Yahoo Finance): S&P 500 price (^GSPC) and total return (^SP500TR), IHSG (^JKSE).\nwindow.MARKET = ' + JSON.stringify(MARKET) + ';\n');
console.log('fx points', fx.series.length, 'glitches removed', fx.removed, 'first', fx.series[0], 'last', fx.series[fx.series.length-1]);
console.log(report.join('\n'));
if (enMissing.length) console.log('EN missing:', enMissing.join(','));
console.log('stocks', out.length, 'chapters', out.reduce((a, S) => a + S.ch.length, 0), 'points', out.reduce((a, S) => a + S.raw.length, 0), 'bytes', fs.statSync(path.join(ROOT, 'data.js')).size);

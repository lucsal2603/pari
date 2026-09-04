/* ==========================================================================
   Pari — app spese di coppia. Vanilla JS, dati in localStorage,
   sincronizzazione opzionale via Supabase (REST).
   ========================================================================== */
(() => {
'use strict';

const APP_VERSION = '1.0.0';
const KEY = 'pari:v1';
const CATS = [
  { id: 'cibo', name: 'Cibo', icon: 'c-cibo' },
  { id: 'spesa', name: 'Spesa', icon: 'c-spesa' },
  { id: 'casa', name: 'Casa', icon: 'c-casa' },
  { id: 'bollette', name: 'Bollette', icon: 'c-bollette' },
  { id: 'trasporti', name: 'Trasporti', icon: 'c-trasporti' },
  { id: 'tempo-libero', name: 'Tempo libero', icon: 'c-tempo-libero' },
  { id: 'viaggi', name: 'Viaggi', icon: 'c-viaggi' },
  { id: 'salute', name: 'Salute', icon: 'c-salute' },
  { id: 'shopping', name: 'Shopping', icon: 'c-shopping' },
  { id: 'regali', name: 'Regali', icon: 'c-regali' },
  { id: 'abbonamenti', name: 'Abbonamenti', icon: 'c-abbonamenti' },
  { id: 'animali', name: 'Animali', icon: 'c-animali' },
  { id: 'altro', name: 'Altro', icon: 'c-altro' },
];
const DONUT_COLORS = ['#2C4A3B', '#5F8A6E', '#9DBBA4', '#D9C7A6', '#B8B3A9', '#8A8378', '#E3A85A', '#C97A2B', '#6E6A63', '#CFCAC0'];

/* ---------- Utility ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
const nowISO = () => new Date().toISOString();
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const ym = (dateStr) => dateStr.slice(0, 7);
const curYM = () => todayStr().slice(0, 7);
const fmtEUR = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const money = (cents) => fmtEUR.format((cents || 0) / 100);
const moneyPlain = (cents) => new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((cents || 0) / 100);
const monthName = (ymStr) => { const [y, m] = ymStr.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }); };
const monthShort = (ymStr) => { const [y, m] = ymStr.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('it-IT', { month: 'short' }).replace('.', ''); };
const dateLong = (d) => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }); };
const dateShort = (d) => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).replace('.', ''); };
const shiftYM = (ymStr, delta) => { const [y, m] = ymStr.split('-').map(Number); const d = new Date(y, m - 1 + delta, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const parseAmount = (s) => { const t = String(s || '').replace(/\s|€/g, '').replace(',', '.'); if (!t || isNaN(t)) return NaN; return Math.round(parseFloat(t) * 100); };
const relDay = (d) => {
  const [y, m, dd] = d.split('-').map(Number); const t = new Date(y, m - 1, dd); const n = new Date(); n.setHours(0, 0, 0, 0);
  const diff = Math.round((n - t) / 86400000);
  if (diff === 0) return 'Oggi'; if (diff === 1) return 'Ieri'; if (diff > 1 && diff < 7) return diff + ' giorni fa'; return dateShort(d);
};
const catOf = (id) => CATS.find((c) => c.id === id) || CATS[CATS.length - 1];
const icon = (id, cls = 'ic') => `<svg class="${cls}"><use href="#${id}"/></svg>`;
const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

/* ---------- Stato ---------- */
function defaultState() {
  return {
    version: 1,
    members: [
      { id: 'm1', name: 'Luca', color: '#2C4A3B' },
      { id: 'm2', name: 'Martina', color: '#C97A2B' },
    ],
    entries: [],
    activity: [],
    settings: { me: 'm1', currency: 'EUR', together: '', sync: { url: '', key: '', house: '' }, lastPull: null, membersUpdatedAt: null },
    ui: { month: curYM(), statsRange: 'mese', balTab: 0, homeMode: 'paid' },
  };
}
let S = load();
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw); const d = defaultState(); return { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}), sync: { ...d.settings.sync, ...((s.settings || {}).sync || {}) } }, ui: { ...d.ui, ...(s.ui || {}), month: curYM() } }; } } catch (e) { console.warn('stato corrotto', e); }
  return defaultState();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Memoria piena: impossibile salvare'); } }
const me = () => S.members.find((m) => m.id === S.settings.me) || S.members[0];
const other = () => S.members.find((m) => m.id !== me().id) || S.members[1];
const member = (id) => S.members.find((m) => m.id === id) || { id, name: '?', color: '#999' };
const active = () => S.entries.filter((e) => !e.deleted);

/* ---------- Logica dei conti ---------- */
function splitEqual(amount, ids) {
  const base = Math.floor(amount / ids.length); let rest = amount - base * ids.length; const out = {};
  ids.forEach((id) => { out[id] = base + (rest > 0 ? 1 : 0); if (rest > 0) rest--; });
  return out;
}
function balances() {
  const b = {}; S.members.forEach((m) => (b[m.id] = 0));
  active().forEach((e) => { b[e.paidBy] = (b[e.paidBy] || 0) + e.amount; for (const [id, c] of Object.entries(e.owed || {})) b[id] = (b[id] || 0) - c; });
  return b; // positivo = deve ricevere
}
function monthStats(ymStr) {
  const es = active().filter((e) => e.kind === 'expense' && ym(e.date) === ymStr);
  return aggregate(es);
}
function aggregate(es) {
  const paid = {}, share = {}, byCat = {}; let total = 0;
  S.members.forEach((m) => { paid[m.id] = 0; share[m.id] = 0; });
  es.forEach((e) => { total += e.amount; paid[e.paidBy] = (paid[e.paidBy] || 0) + e.amount; for (const [id, c] of Object.entries(e.owed || {})) share[id] = (share[id] || 0) + c; byCat[e.cat || 'altro'] = (byCat[e.cat || 'altro'] || 0) + e.amount; });
  return { total, paid, share, byCat, count: es.length, entries: es };
}
function rangeEntries(range, ymStr) {
  if (range === 'mese') return active().filter((e) => e.kind === 'expense' && ym(e.date) === ymStr);
  if (range === '3mesi') { const set = new Set([ymStr, shiftYM(ymStr, -1), shiftYM(ymStr, -2)]); return active().filter((e) => e.kind === 'expense' && set.has(ym(e.date))); }
  const y = ymStr.slice(0, 4); return active().filter((e) => e.kind === 'expense' && e.date.startsWith(y));
}
function balanceSentence(bal) {
  const a = me(), b = other(); const v = bal[a.id] || 0;
  if (Math.abs(v) < 1) return { even: true, text: 'Siete in pari', amount: 0, sign: '' };
  if (v > 0) return { even: false, text: `${b.name} deve a ${a.name}`, amount: v, sign: '+' };
  return { even: false, text: `${a.name} deve a ${b.name}`, amount: -v, sign: '−' };
}

/* ---------- Mutazioni + attività ---------- */
function logActivity(type, entry, extra = {}) {
  S.activity.unshift({ id: uid(), ts: nowISO(), type, entryId: entry.id, by: me().id, desc: entry.desc, amount: entry.amount, kind: entry.kind, ...extra });
  S.activity = S.activity.slice(0, 300);
}
function addEntry(e) { e.id = e.id || uid(); e.createdAt = nowISO(); e.updatedAt = e.createdAt; e.deleted = false; S.entries.push(e); logActivity(e.kind === 'payment' ? 'settle' : 'add', e); afterChange(); return e; }
function updateEntry(id, patch) { const e = S.entries.find((x) => x.id === id); if (!e) return; Object.assign(e, patch, { updatedAt: nowISO() }); logActivity('edit', e); afterChange(); return e; }
function deleteEntry(id) { const e = S.entries.find((x) => x.id === id); if (!e) return; e.deleted = true; e.updatedAt = nowISO(); logActivity('delete', e); afterChange(); return e; }
function restoreEntry(id) { const e = S.entries.find((x) => x.id === id); if (!e) return; e.deleted = false; e.updatedAt = nowISO(); logActivity('restore', e); afterChange(); }
function afterChange() { save(); render(); sync.schedule(); }

/* Spese ricorrenti: genera le copie mensili mancanti fino al mese corrente */
function materializeRecurring() {
  let changed = false; const cur = curYM();
  active().filter((e) => e.recurring === 'monthly' && !e.recurringOf).forEach((tpl) => {
    let m = shiftYM(ym(tpl.date), 1);
    while (m <= cur) {
      const exists = S.entries.some((x) => x.recurringOf === tpl.id && ym(x.date) === m);
      if (!exists) {
        const day = Math.min(parseInt(tpl.date.slice(8, 10), 10), new Date(parseInt(m.slice(0, 4)), parseInt(m.slice(5, 7)), 0).getDate());
        const copy = { ...tpl, id: tpl.id + ':' + m, date: m + '-' + String(day).padStart(2, '0'), recurring: null, recurringOf: tpl.id, createdAt: nowISO(), updatedAt: nowISO(), deleted: false, owed: { ...tpl.owed } };
        S.entries.push(copy); changed = true;
      }
      m = shiftYM(m, 1);
    }
  });
  if (changed) { save(); sync.schedule(); }
}

/* ---------- Router ---------- */
const view = $('#view'); const tabbar = $('#tabbar');
let prevHash = '', curHash = location.hash || '#/home';
function route() {
  prevHash = curHash; curHash = location.hash || '#/home';
  const hash = location.hash || '#/home';
  const [path, qs] = hash.slice(2).split('?');
  const parts = path.split('/'); const q = Object.fromEntries(new URLSearchParams(qs || ''));
  const r = { name: parts[0] || 'home', id: parts[1] || '', sub: parts[1] || '', q };
  render(r);
}
window.addEventListener('hashchange', route);
function go(h) { location.hash = h; }
function back(fallback) { const ok = prevHash && prevHash !== curHash && !/^#\/(nuova|modifica)/.test(prevHash); go(ok ? prevHash : fallback); }

let currentRoute = null;
function render(r) {
  r = r || currentRoute || { name: 'home', id: '', q: {} }; currentRoute = r;
  const pages = { home: pageHome, spese: pageSpese, bilanci: pageBilanci, profilo: pageProfilo, nuova: pageForm, modifica: pageForm, spesa: pageDetail, statistiche: pageStats, attivita: pageActivity };
  const fn = pages[r.name] || pageHome;
  const noTab = ['nuova', 'modifica', 'spesa'].includes(r.name);
  tabbar.classList.toggle('hide', noTab); view.classList.toggle('no-tabbar', noTab);
  const tabName = r.name === 'profilo' ? 'profilo' : r.name === 'statistiche' ? 'bilanci' : r.name;
  $$('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tabName));
  view.innerHTML = fn(r);
  window.scrollTo(0, 0);
  bind(r);
  const reveal = () => { $$('.chart').forEach((c) => c.classList.add('in')); $$('[data-w]').forEach((el) => (el.style.width = el.dataset.w)); };
  requestAnimationFrame(() => requestAnimationFrame(reveal)); setTimeout(reveal, 80);
}

/* ---------- Componenti condivisi ---------- */
const ph = (label, cls = '') => `<span class="ph ${cls}">${esc(label)}</span>`;
const avatar = (m, lg = false) => `<span class="ph avatar${lg ? ' lg' : ''}" title="${esc(m.name)}" aria-label="avatar di ${esc(m.name)}">${esc(m.name.slice(0, 1))}</span>`;
function entryRow(e, i) {
  const c = catOf(e.cat); const payer = member(e.paidBy); const isPay = e.kind === 'payment';
  const to = isPay ? member(Object.keys(e.owed || {})[0]) : null;
  const col = payer.id === S.members[0].id ? 'green' : 'orange';
  return `<a class="row${isPay ? ' payment' : ''}" href="#/spesa/${e.id}" style="--i:${i}">
    <span class="cat-ic${isPay ? ' pay' : ''}">${icon(isPay ? 'c-pagamento' : c.icon)}</span>
    <span class="main"><span class="title">${esc(isPay ? `${payer.name} ha pagato ${to ? to.name : ''}` : e.desc)}</span><span class="sub">${esc(relDay(e.date))}${!isPay && e.cat ? ' · ' + esc(c.name) : ''}${e.recurringOf || e.recurring ? ' · ricorrente' : ''}</span></span>
    <span class="right"><span class="money">${money(e.amount)}</span><span class="by ${isPay ? 'green' : col}">${isPay ? 'Pagamento' : esc(payer.name) + ' ha pagato'}</span></span>
  </a>`;
}
function emptyBox(t, d) { return `<div class="empty">${ph('Illustrazione', 'illu')}<div class="t">${esc(t)}</div><div class="small">${esc(d)}</div></div>`; }
function monthNav(ymStr, hrefBase) {
  return `<div class="monthnav"><button class="icon-btn" data-month="-1" aria-label="Mese precedente">${icon('i-left')}</button><button class="label" data-month="0" title="Torna al mese corrente">${esc(monthName(ymStr))}</button><button class="icon-btn" data-month="1" aria-label="Mese successivo">${icon('i-right')}</button></div>`;
}
function segHTML(items, activeIdx, cls = '', dataKey = 'seg') {
  return `<div class="seg ${cls}" style="--n:${items.length};--i:${activeIdx}" data-seg="${dataKey}">${items.map((it, i) => `<button type="button" data-i="${i}" data-v="${esc(it.v)}" class="${i === activeIdx ? 'on' : ''}">${esc(it.t)}</button>`).join('')}</div>`;
}
function bindSeg(el, onChange) {
  if (!el) return;
  el.addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; el.style.setProperty('--i', b.dataset.i); $$('button', el).forEach((x) => x.classList.toggle('on', x === b)); onChange(b.dataset.v, +b.dataset.i); });
}

/* ---------- HOME ---------- */
function pageHome() {
  const bal = balances(); const sent = balanceSentence(bal); const a = me(), b = other();
  const recent = active().sort((x, y) => (y.date + y.createdAt).localeCompare(x.date + x.createdAt)).slice(0, 4);
  const m = S.ui.month; const st = monthStats(m); const mode = S.ui.homeMode;
  const va = mode === 'paid' ? st.paid[a.id] : st.share[a.id]; const vb = mode === 'paid' ? st.paid[b.id] : st.share[b.id];
  const pa = st.total ? Math.round((va / st.total) * 100) : 0, pb = st.total ? 100 - pa : 0;
  const syncCls = !sync.enabled() ? 'off' : sync.status === 'busy' ? 'busy' : sync.status === 'err' ? 'err' : '';
  return `<div class="page">
    <div class="head left"><div class="greet">Ciao ${esc(a.name)}! <span aria-hidden="true">👋</span></div><a class="who-chip" href="#/profilo"><span class="sync-dot ${syncCls}" title="Sincronizzazione"></span>${esc(a.name)} ${avatar(a)}</a></div>
    <section class="card hero${sent.even ? ' even' : ''}">
      <div class="k">Saldo totale</div>
      <div class="amt">${sent.even ? money(0) : sent.sign + ' ' + money(sent.amount)}</div>
      <div class="s">${esc(sent.text)}</div>
      ${ph('Illustrazione coppia', 'illu')}
    </section>
    <div class="link-row"><h2 class="sec-title">Ultime spese</h2><a href="#/spese">Vedi tutte ${icon('i-right')}</a></div>
    <section class="card list-card"><div class="list stagger">${recent.length ? recent.map(entryRow).join('') : emptyBox('Nessuna spesa ancora', 'Aggiungi la prima con il tasto qui sotto.')}</div></section>
    <div class="section"><a class="btn" href="#/nuova">${icon('i-plus')} Aggiungi spesa</a></div>
    <div class="link-row"><h2 class="sec-title">Questo mese</h2><a href="#/statistiche">Statistiche ${icon('i-right')}</a></div>
    <section class="card">
      ${monthNav(m)}
      <div class="row-between"><div><div class="muted small" style="font-weight:600">Totale di ${esc(monthName(m))}</div><div class="money" style="font-size:28px">${money(st.total)}</div></div>
      ${segHTML([{ v: 'paid', t: 'Pagato' }, { v: 'share', t: 'Quota' }], mode === 'paid' ? 0 : 1, 'small', 'homeMode')}</div>
      <div class="split" aria-hidden="true"><span style="background:${a.color}" data-w="${pa}%"></span><span style="background:${b.color}" data-w="${pb}%"></span></div>
      <div class="mini-stat">
        <div><div class="k"><span class="pd" style="--c:${a.color}"></span>${esc(a.name)}</div><div class="v">${money(va)}</div><div class="p">${st.total ? pa + '% del totale' : 'nessuna spesa'}</div></div>
        <div><div class="k"><span class="pd" style="--c:${b.color}"></span>${esc(b.name)}</div><div class="v">${money(vb)}</div><div class="p">${st.total ? pb + '% del totale' : 'nessuna spesa'}</div></div>
      </div>
    </section>
    ${installBanner()}
  </div>`;
}

/* ---------- SPESE ---------- */
let speseFilter = { q: '', cat: '' };
function pageSpese() {
  return `<div class="page">
    <div class="head left"><div class="title">Spese</div><a class="icon-btn" href="#/attivita" aria-label="Attività">${icon('i-repeat')}</a></div>
    <label class="search">${icon('i-search')}<input id="q" type="search" placeholder="Cerca una spesa…" value="${esc(speseFilter.q)}" autocomplete="off"></label>
    <div class="chips" id="chips"><button class="chip${!speseFilter.cat ? ' on' : ''}" data-cat="">Tutte</button>${CATS.map((c) => `<button class="chip${speseFilter.cat === c.id ? ' on' : ''}" data-cat="${c.id}">${icon(c.icon)}${esc(c.name)}</button>`).join('')}</div>
    <div id="spese-list">${speseList()}</div>
  </div>`;
}
function speseList() {
  const q = speseFilter.q.trim().toLowerCase();
  let es = active().filter((e) => (!speseFilter.cat || e.cat === speseFilter.cat) && (!q || (e.desc || '').toLowerCase().includes(q) || (e.notes || '').toLowerCase().includes(q) || moneyPlain(e.amount).includes(q)));
  es.sort((x, y) => (y.date + y.createdAt).localeCompare(x.date + x.createdAt));
  if (!es.length) return `<section class="card">${emptyBox(q || speseFilter.cat ? 'Nessun risultato' : 'Nessuna spesa ancora', q || speseFilter.cat ? 'Prova con un\'altra parola o categoria.' : 'Le spese che aggiungete compariranno qui, mese per mese.')}</section>`;
  const groups = []; es.forEach((e) => { const k = ym(e.date); let g = groups.find((x) => x.k === k); if (!g) { g = { k, items: [], total: 0 }; groups.push(g); } g.items.push(e); if (e.kind === 'expense') g.total += e.amount; });
  return groups.map((g) => `<div class="month-head"><span class="t">${esc(monthName(g.k))}</span><span class="money">${money(g.total)}</span></div><section class="card list-card"><div class="list stagger">${g.items.map(entryRow).join('')}</div></section>`).join('');
}

/* ---------- BILANCI ---------- */
function pageBilanci() {
  const tab = S.ui.balTab; const bal = balances(); const sent = balanceSentence(bal); const a = me(), b = other();
  const owesAB = Math.max(0, -(bal[a.id] || 0)), owesBA = Math.max(0, bal[a.id] || 0);
  let body;
  if (tab === 0) {
    body = `<section class="card saldo${sent.even ? ' even' : ''}"><div><div class="k">Saldo attuale</div><div class="amt">${sent.even ? money(0) : sent.sign + ' ' + money(sent.amount)}</div><div class="s">${esc(sent.text)}</div></div>${ph('Illustrazione', 'round')}</section>
    <h2 class="sec-title section">Dettaglio</h2>
    <section class="card"><div class="dlist">
      <button type="button" data-settle="${a.id}:${b.id}"><span class="t">${esc(a.name)} deve a ${esc(b.name)}</span><span class="money ${owesAB ? 'red' : ''}">${money(owesAB)}</span>${icon('i-right')}</button>
      <button type="button" data-settle="${b.id}:${a.id}"><span class="t">${esc(b.name)} deve a ${esc(a.name)}</span><span class="money ${owesBA ? 'green' : ''}">${money(owesBA)}</span>${icon('i-right')}</button>
      <div><span class="t">In pari</span><span class="money">${money(0)}</span>${sent.even ? icon('i-check') : '<span></span>'}</div>
    </div></section>
    <div class="section"><a class="btn" href="#/nuova?tipo=pagamento">Registra pagamento</a></div>
    <h2 class="sec-title section">Ultimi pagamenti</h2>
    <section class="card list-card"><div class="list stagger">${(() => { const ps = active().filter((e) => e.kind === 'payment').sort((x, y) => (y.date + y.createdAt).localeCompare(x.date + x.createdAt)).slice(0, 5); return ps.length ? ps.map(entryRow).join('') : '<div class="empty small" style="padding:18px">Nessun pagamento registrato.</div>'; })()}</div></section>`;
  } else {
    const m = S.ui.month; const st = monthStats(m);
    const net = {}; S.members.forEach((x) => (net[x.id] = st.paid[x.id] - st.share[x.id]));
    const pays = active().filter((e) => e.kind === 'payment' && ym(e.date) === m);
    body = `${monthNav(m)}
    <section class="card"><div class="stat-rows">
      <div><div class="k">Totale speso nel mese</div><div class="v">${money(st.total)}<small>${st.count} ${st.count === 1 ? 'spesa' : 'spese'}</small></div></div>
      ${S.members.map((x) => `<div><div class="k"><span class="pd" style="--c:${x.color};margin-right:6px"></span>${esc(x.name)}</div><div class="row-between"><div class="v">${money(st.paid[x.id])}<small>pagato</small></div><div class="v" style="text-align:right">${money(st.share[x.id])}<small>quota</small></div></div><div class="small ${net[x.id] > 0 ? 'green' : net[x.id] < 0 ? 'red' : 'muted'}" style="font-weight:700;margin-top:4px">${net[x.id] > 0 ? 'Ha anticipato ' + money(net[x.id]) : net[x.id] < 0 ? 'Deve ' + money(-net[x.id]) + ' per questo mese' : 'In pari nel mese'}</div></div>`).join('')}
      <div><div class="k">Pagamenti registrati nel mese</div><div class="v">${money(pays.reduce((s, e) => s + e.amount, 0))}<small>${pays.length}</small></div></div>
    </div></section>
    <h2 class="sec-title section">Andamento mensile</h2>
    <section class="card">${barChart(m)}<div class="legend">${S.members.map((x) => `<span><span class="pd" style="--c:${x.color}"></span>${esc(x.name)}</span>`).join('')}</div></section>`;
  }
  return `<div class="page">
    <div class="head left"><div class="title">Bilanci</div><a class="icon-btn" href="#/statistiche" aria-label="Statistiche">${icon('i-chart')}</a></div>
    ${segHTML([{ v: '0', t: 'Totali' }, { v: '1', t: 'Per periodo' }], tab, '', 'balTab')}
    <div class="section">${body}</div>
  </div>`;
}

/* ---------- STATISTICHE ---------- */
function pageStats() {
  const range = S.ui.statsRange; const m = S.ui.month; const es = rangeEntries(range, m); const st = aggregate(es);
  const a = me(), b = other();
  const monthsInRange = range === 'mese' ? 1 : range === '3mesi' ? 3 : 12;
  const [y, mm] = m.split('-').map(Number);
  const daysInRange = range === 'mese' ? new Date(y, mm, 0).getDate() : range === '3mesi' ? 91 : 365;
  const weekly = Math.round((st.total / daysInRange) * 7);
  const cats = Object.entries(st.byCat).sort((x, y2) => y2[1] - x[1]);
  const label = range === 'mese' ? monthName(m) : range === '3mesi' ? `${monthShort(shiftYM(m, -2))} – ${monthName(m)}` : 'Anno ' + m.slice(0, 4);
  const maxP = Math.max(st.paid[a.id], st.paid[b.id], 1);
  return `<div class="page slide">
    <div class="head"><button class="icon-btn" data-back="#/bilanci" aria-label="Indietro">${icon('i-back')}</button><div class="title">Statistiche</div><span></span></div>
    ${segHTML([{ v: 'mese', t: 'Mese' }, { v: '3mesi', t: '3 mesi' }, { v: 'anno', t: 'Anno' }], ['mese', '3mesi', 'anno'].indexOf(range), 'dark', 'statsRange')}
    ${range === 'anno' ? `<div class="monthnav"><button class="icon-btn" data-year="-1" aria-label="Anno precedente">${icon('i-left')}</button><span class="label">${esc(label)}</span><button class="icon-btn" data-year="1" aria-label="Anno successivo">${icon('i-right')}</button></div>` : monthNav(m)}
    <section class="card"><div class="stat-rows">
      <div><div class="k">Totale spese</div><div class="v">${money(st.total)}<small>${st.count} ${st.count === 1 ? 'spesa' : 'spese'}</small></div></div>
      <div><div class="k">Media settimanale</div><div class="v">${money(weekly)}</div></div>
      <div><div class="k">Media al mese</div><div class="v">${money(Math.round(st.total / monthsInRange))}</div></div>
    </div></section>
    <h2 class="sec-title section">Speso a testa</h2>
    <section class="card"><div class="person-bars">
      ${S.members.map((x) => `<div class="pb"><div class="top"><span class="who"><span class="pd" style="--c:${x.color}"></span>${esc(x.name)}</span><span class="money">${money(st.paid[x.id])}</span></div><div class="bar"><i style="--c:${x.color}" data-w="${Math.round((st.paid[x.id] / maxP) * 100)}%"></i></div><div class="d">Pagato ${money(st.paid[x.id])} · quota ${money(st.share[x.id])}${st.total ? ' (' + Math.round((st.share[x.id] / st.total) * 100) + '%)' : ''}</div></div>`).join('')}
    </div></section>
    <h2 class="sec-title section">Andamento mensile</h2>
    <section class="card">${barChart(range === 'anno' ? m.slice(0, 4) + '-12' : m)}<div class="legend">${S.members.map((x) => `<span><span class="pd" style="--c:${x.color}"></span>${esc(x.name)}</span>`).join('')}</div></section>
    <h2 class="sec-title section">Spese per categoria</h2>
    <section class="card">${cats.length ? donut(cats, st.total) : '<div class="empty small" style="padding:14px">Nessuna spesa nel periodo.</div>'}</section>
  </div>`;
}
function barChart(endYM) {
  const months = []; for (let i = 11; i >= 0; i--) months.push(shiftYM(endYM, -i));
  const data = months.map((k) => ({ k, st: monthStats(k) }));
  const max = Math.max(...data.map((d) => d.st.total), 100);
  const nice = (v) => { const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; const r = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10; return r * p; };
  const top = nice(max * 1.05);
  const W = 320, H = 150, padL = 34, padB = 22, padT = 8; const cw = (W - padL) / 12; const bw = Math.min(16, cw * 0.6);
  const sy = (v) => padT + (H - padB - padT) * (1 - v / top);
  const grid = [0, 0.5, 1].map((f) => `<line class="grid" x1="${padL}" x2="${W}" y1="${sy(top * f)}" y2="${sy(top * f)}"/><text class="ylbl" x="${padL - 6}" y="${sy(top * f) + 3}">${Math.round((top * f) / 100)}</text>`).join('');
  const cols = data.map((d, i) => {
    const x = padL + cw * i + (cw - bw) / 2; let yBase = sy(0); let rects = '';
    S.members.forEach((mb, j) => { const v = d.st.paid[mb.id] || 0; if (!v) return; const h = sy(0) - sy(v); yBase -= h; rects += `<rect class="bar" x="${x}" y="${yBase}" width="${bw}" height="${h}" rx="3" fill="${mb.color}" style="transition-delay:${i * 40 + j * 60}ms"/>`; });
    const on = d.k === S.ui.month;
    return `<g class="col${on ? '' : ''}" data-ym="${d.k}">${rects}<text class="lbl${on ? ' on' : ''}" x="${x + bw / 2}" y="${H - 6}">${esc(monthShort(d.k).slice(0, 3))}</text><rect class="hit" x="${padL + cw * i}" y="0" width="${cw}" height="${H}"/></g>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Spese degli ultimi dodici mesi">${grid}${cols}</svg>`;
}
function donut(cats, total) {
  const r = 44, C = 2 * Math.PI * r; let off = 0;
  const segs = cats.map(([id, v], i) => { const f = v / total; const len = C * f; const s = `<circle r="${r}" cx="66" cy="66" stroke="${DONUT_COLORS[i % DONUT_COLORS.length]}" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 66 66)"/>`; const mid = (off + len / 2) / C * 360 - 90; const lx = 66 + Math.cos(mid * Math.PI / 180) * r, ly = 66 + Math.sin(mid * Math.PI / 180) * r; const lbl = f >= 0.08 ? `<text class="seg-lbl" x="${lx}" y="${ly}">${Math.round(f * 100)}%</text>` : ''; off += len; return s + lbl; }).join('');
  return `<div class="donut-wrap"><svg class="donut" viewBox="0 0 132 132" aria-hidden="true"><circle class="track" r="${r}" cx="66" cy="66"/>${segs}</svg>
  <div class="cat-legend">${cats.slice(0, 6).map(([id, v], i) => `<div class="ci"><span class="sw" style="--c:${DONUT_COLORS[i % DONUT_COLORS.length]}"></span><span>${esc(catOf(id).name)}</span><span class="p">${Math.round((v / total) * 100)}%</span></div>`).join('')}</div></div>
  <div class="kv section">${cats.map(([id, v]) => `<div><span class="k" style="display:flex;align-items:center;gap:8px">${icon(catOf(id).icon)}${esc(catOf(id).name)}</span><span class="v money">${money(v)}</span></div>`).join('')}</div>`;
}

/* ---------- DETTAGLIO ---------- */
function pageDetail(r) {
  const e = S.entries.find((x) => x.id === r.id);
  if (!e) return `<div class="page slide"><div class="head"><button class="icon-btn" data-back="#/spese">${icon('i-back')}</button><div class="title">Spesa</div><span></span></div>${emptyBox('Spesa non trovata', 'Forse è stata eliminata.')}</div>`;
  const c = catOf(e.cat); const payer = member(e.paidBy); const isPay = e.kind === 'payment';
  const parts = Object.entries(e.owed || {}).filter(([, v]) => v > 0);
  return `<div class="page slide">
    <div class="head"><button class="icon-btn" data-back="#/spese" aria-label="Indietro">${icon('i-back')}</button><div class="title">${isPay ? 'Dettaglio pagamento' : 'Dettaglio spesa'}</div><button class="icon-btn" data-menu aria-label="Altre azioni">${icon('i-dots')}</button></div>
    <div class="detail-top">
      <span class="cat-ic${isPay ? ' pay' : ''}">${icon(isPay ? 'c-pagamento' : c.icon)}</span>
      <div class="name">${esc(isPay ? `${payer.name} ha pagato ${member(parts[0]?.[0]).name}` : e.desc)}</div>
      <div class="date">${esc(dateLong(e.date))}${!isPay && e.cat ? ' · ' + esc(c.name) : ''}${e.recurringOf || e.recurring ? ' · si ripete ogni mese' : ''}</div>
      <div class="amt">${money(e.amount)}</div>
      <div class="by ${payer.id === S.members[0].id ? 'green' : 'orange'}">${isPay ? 'Saldo aggiornato' : 'Pagato da ' + esc(payer.name)}</div>
    </div>
    ${isPay ? '' : `<h2 class="sec-title section">Diviso tra</h2>
    <section class="card"><div class="people">${parts.map(([id, v]) => `<div>${avatar(member(id))}<span>${esc(member(id).name)}</span><span class="money">${money(v)}</span></div>`).join('')}</div></section>`}
    ${e.notes ? `<h2 class="sec-title section">Note</h2><div class="notes">${esc(e.notes)}</div>` : ''}
    <div class="section btn-row"><a class="btn soft" href="#/modifica/${e.id}">Modifica</a><button class="btn danger" data-del="${e.id}">Elimina</button></div>
    <div class="section small muted" style="text-align:center">Aggiunta ${esc(new Date(e.createdAt).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }))}${e.updatedAt !== e.createdAt ? ' · modificata ' + esc(new Date(e.updatedAt).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })) : ''}</div>
  </div>`;
}

/* ---------- FORM nuova / modifica ---------- */
let F = null; // stato del form
function pageForm(r) {
  const editing = r.name === 'modifica' ? S.entries.find((x) => x.id === r.id) : null;
  if (!F || F.routeKey !== location.hash) {
    F = editing ? { routeKey: location.hash, id: editing.id, kind: editing.kind, desc: editing.desc || '', amount: moneyPlain(editing.amount), date: editing.date, cat: editing.cat || '', paidBy: editing.paidBy, splitMethod: editing.splitMethod || 'equal', splitInput: { ...(editing.splitInput || {}) }, notes: editing.notes || '', recurring: editing.recurring === 'monthly', to: Object.keys(editing.owed || {})[0] }
      : { routeKey: location.hash, id: null, kind: r.q.tipo === 'pagamento' ? 'payment' : 'expense', desc: '', amount: '', date: todayStr(), cat: '', paidBy: me().id, splitMethod: 'equal', splitInput: {}, notes: '', recurring: false, to: other().id };
    if (!editing && F.kind === 'payment') { const bal = balances(); const v = bal[me().id] || 0; if (v < 0) { F.paidBy = me().id; F.to = other().id; F.amount = moneyPlain(-v); } else if (v > 0) { F.paidBy = other().id; F.to = me().id; F.amount = moneyPlain(v); } }
  }
  const isPay = F.kind === 'payment'; const a = me(), b = other();
  const optCard = (m, sel, key) => `<button type="button" class="opt${sel ? ' on' : ''}" data-pick="${key}" data-id="${m.id}">${avatar(m)}<span><span class="t">${esc(m.name)}</span></span>${icon('i-right')}</button>`;
  const payerOf = (id) => member(id);
  return `<div class="page up">
    <div class="head"><button class="icon-btn" data-back="${editing ? '#/spesa/' + editing.id : '#/home'}" aria-label="Annulla">${icon('i-x')}</button><div class="title">${editing ? (isPay ? 'Modifica pagamento' : 'Modifica spesa') : (isPay ? 'Nuovo pagamento' : 'Nuova spesa')}</div><button class="icon-btn green" id="save-top" aria-label="Salva">${icon('i-check')}</button></div>
    ${editing ? '' : segHTML([{ v: 'expense', t: 'Spesa' }, { v: 'payment', t: 'Pagamento' }], isPay ? 1 : 0, '', 'kind')}
    <form id="f" novalidate>
      ${isPay ? '' : `<div class="field"><label for="desc">Descrizione</label><input id="desc" type="text" placeholder="Cena pizza" value="${esc(F.desc)}" autocomplete="off" enterkeyhint="next"></div>`}
      <div class="field"><label for="amount">Importo</label><div class="money-input"><span class="cur">€</span><input id="amount" type="text" inputmode="decimal" placeholder="0,00" value="${esc(F.amount)}" autocomplete="off"></div><div class="hint err" id="amount-err" hidden>Inserisci un importo valido.</div></div>
      ${isPay
        ? `<div class="field"><div class="lbl">Chi paga?</div><div class="opts">${S.members.map((m) => optCard(m, F.paidBy === m.id, 'payer')).join('')}</div></div>
           <div class="field"><div class="lbl">A chi?</div><div class="opts">${S.members.map((m) => optCard(m, F.to === m.id, 'to')).join('')}</div><div class="hint">${esc(payerOf(F.paidBy).name)} dà ${F.amount ? '€ ' + esc(F.amount) : 'questa somma'} a ${esc(payerOf(F.to).name)}: il saldo fra voi si aggiorna.</div></div>`
        : `<div class="field"><div class="lbl">Chi ha pagato?</div><div class="opts">${S.members.map((m) => optCard(m, F.paidBy === m.id, 'payer')).join('')}</div></div>
           <div class="field"><div class="lbl">Per chi è?</div><div class="opts">
             <button type="button" class="opt on" data-soon="no"><span class="ph avatar">2</span><span><span class="t">Solo noi</span><span class="d">${esc(a.name)} e ${esc(b.name)}</span></span>${icon('i-right')}</button>
             <button type="button" class="opt" data-soon="friends"><span class="ph avatar">+</span><span><span class="t">Altro</span><span class="d">Dividi con amici</span></span>${icon('i-right')}</button>
           </div></div>
           <div class="field"><div class="lbl">Come dividere?</div><div class="opts">
             <button type="button" class="opt${F.splitMethod === 'equal' ? ' on' : ''}" data-split="equal"><span><span class="t">Metà e metà</span><span class="d">${F.amount && !isNaN(parseAmount(F.amount)) ? money(Math.round(parseAmount(F.amount) / 2)) + ' a testa' : 'In parti uguali'}</span></span>${icon('i-right')}</button>
             <button type="button" class="opt${F.splitMethod !== 'equal' ? ' on' : ''}" data-split="custom"><span><span class="t">Personalizzata</span><span class="d">Importi o percentuali</span></span>${icon('i-right')}</button>
           </div>
           <div id="custom-split" ${F.splitMethod === 'equal' ? 'hidden' : ''}>
             <div style="margin-top:12px">${segHTML([{ v: 'exact', t: 'Importi' }, { v: 'percent', t: 'Percentuali' }, { v: 'shares', t: 'Quote' }], ['exact', 'percent', 'shares'].indexOf(F.splitMethod === 'equal' ? 'exact' : F.splitMethod), 'small', 'splitMethod')}</div>
             <div class="split-rows">${S.members.map((m) => `<div class="sr-row"><span class="who"><span class="pd" style="--c:${m.color}"></span>${esc(m.name)}</span><input class="input" type="text" inputmode="decimal" data-share="${m.id}" value="${esc(F.splitInput[m.id] ?? '')}" placeholder="${F.splitMethod === 'percent' ? '50' : F.splitMethod === 'shares' ? '1' : '0,00'}"></div>`).join('')}</div>
             <div class="split-total" id="split-total"></div>
           </div></div>
           <div class="field"><div class="lbl">Categoria <small>(opzionale)</small></div><div class="cat-circles">${CATS.map((c) => `<button type="button" class="cat-circle${F.cat === c.id ? ' on' : ''}" data-cat="${c.id}" aria-label="${esc(c.name)}" title="${esc(c.name)}">${icon(c.icon)}</button>`).join('')}</div><div class="cat-name" id="cat-name">${F.cat ? esc(catOf(F.cat).name) : 'Nessuna categoria'}</div></div>`}
      <div class="field"><label for="date">Data</label><input id="date" type="date" value="${esc(F.date)}" max="2100-12-31"></div>
      <div class="field"><label for="notes">Note <small class="muted" style="font-weight:500">(opzionale)</small></label><textarea id="notes" placeholder="${isPay ? 'Es. bonifico, contanti…' : 'Es. Sushi Yama - Corso Buenos Aires'}">${esc(F.notes)}</textarea></div>
      ${isPay || F.id ? '' : `<div class="field"><div class="toggle"><div><div class="t">Si ripete ogni mese</div><div class="d">Per affitto, bollette, abbonamenti: la ricrea da sola ogni mese.</div></div><button type="button" class="switch" role="switch" aria-checked="${F.recurring}" id="recurring"></button></div></div>`}
      <div class="form-foot"><button class="btn" type="submit" id="save">${editing ? 'Salva modifiche' : isPay ? 'Registra pagamento' : 'Aggiungi spesa'}</button></div>
    </form>
  </div>`;
}
function computeOwed() {
  const amount = parseAmount(F.amount); const ids = S.members.map((m) => m.id);
  if (F.kind === 'payment') return { [F.to]: amount };
  if (F.splitMethod === 'equal') return splitEqual(amount, ids);
  if (F.splitMethod === 'exact') { const o = {}; ids.forEach((id) => (o[id] = Math.max(0, parseAmount(F.splitInput[id]) || 0))); return o; }
  if (F.splitMethod === 'percent') { const o = {}; let acc = 0; ids.forEach((id, i) => { const p = parseFloat(String(F.splitInput[id] || '0').replace(',', '.')) || 0; const v = i === ids.length - 1 ? amount - acc : Math.round((amount * p) / 100); o[id] = Math.max(0, v); acc += v; }); return o; }
  const w = {}; let tot = 0; ids.forEach((id) => { w[id] = Math.max(0, parseFloat(String(F.splitInput[id] || '0').replace(',', '.')) || 0); tot += w[id]; });
  if (!tot) return splitEqual(amount, ids);
  const o = {}; let acc = 0; ids.forEach((id, i) => { const v = i === ids.length - 1 ? amount - acc : Math.round((amount * w[id]) / tot); o[id] = v; acc += v; }); return o;
}
function validateSplit() {
  const el = $('#split-total'); if (!el) return true;
  const amount = parseAmount(F.amount); if (isNaN(amount)) { el.innerHTML = ''; return true; }
  if (F.splitMethod === 'exact') { const sum = S.members.reduce((s, m) => s + (parseAmount(F.splitInput[m.id]) || 0), 0); const ok = sum === amount; el.className = 'split-total' + (ok ? '' : ' bad'); el.innerHTML = `<span>Somma delle parti</span><b>${money(sum)} su ${money(amount)}${ok ? '' : ' · mancano ' + money(amount - sum)}</b>`; return ok; }
  if (F.splitMethod === 'percent') { const sum = S.members.reduce((s, m) => s + (parseFloat(String(F.splitInput[m.id] || '0').replace(',', '.')) || 0), 0); const ok = Math.abs(sum - 100) < 0.01; el.className = 'split-total' + (ok ? '' : ' bad'); el.innerHTML = `<span>Totale percentuali</span><b>${sum}%${ok ? '' : ' · deve fare 100%'}</b>`; return ok; }
  const o = computeOwed(); el.className = 'split-total'; el.innerHTML = `<span>Risultato</span><b>${S.members.map((m) => esc(m.name) + ' ' + money(o[m.id])).join(' · ')}</b>`; return true;
}
function submitForm() {
  const amount = parseAmount(F.amount);
  const amtWrap = $('.money-input'), amtErr = $('#amount-err');
  if (isNaN(amount) || amount <= 0) { amtWrap.classList.remove('err'); void amtWrap.offsetWidth; amtWrap.classList.add('err'); amtErr.hidden = false; $('#amount').focus(); return; }
  amtErr.hidden = true;
  if (F.kind === 'expense' && !F.desc.trim()) { $('#desc').focus(); toast('Scrivi una descrizione'); return; }
  if (F.kind === 'payment' && F.paidBy === F.to) { toast('Chi paga e chi riceve devono essere diversi'); return; }
  if (!validateSplit()) { toast('Controlla la divisione'); return; }
  const owed = computeOwed();
  const data = { kind: F.kind, desc: F.kind === 'payment' ? 'Pagamento' : F.desc.trim(), amount, date: F.date || todayStr(), cat: F.kind === 'payment' ? '' : F.cat, paidBy: F.paidBy, splitMethod: F.kind === 'payment' ? 'exact' : F.splitMethod, splitInput: F.splitMethod === 'equal' ? {} : { ...F.splitInput }, owed, notes: F.notes.trim() };
  if (F.id) { const id = F.id; F = null; updateEntry(id, data); toast('Modifiche salvate'); go('#/spesa/' + id); return; }
  data.recurring = F.recurring ? 'monthly' : null; F = null;
  const e = addEntry(data);
  go(data.kind === 'payment' ? '#/bilanci' : '#/home');
  toast(data.kind === 'payment' ? 'Pagamento registrato' : 'Spesa aggiunta', { label: 'Annulla', fn: () => { deleteEntry(e.id); toast('Annullata'); } });
}

/* ---------- PROFILO + sottopagine ---------- */
function pageProfilo(r) {
  const a = me(), b = other();
  if (r.sub === 'account') return pageAccount();
  if (r.sub === 'categorie') return pageCategorie();
  if (r.sub === 'sync') return pageSync();
  if (r.sub === 'info') return pageInfo();
  if (r.sub === 'esporta') return pageExport();
  const together = S.settings.together ? `Insieme dal ${esc(S.settings.together)} <span aria-hidden="true">❤️</span>` : 'Le nostre spese, a metà <span aria-hidden="true">❤️</span>';
  const syncOn = sync.enabled();
  return `<div class="page">
    <div class="profile-head">${ph('Illustrazione coppia', 'round')}<div class="n">${esc(S.members[0].name)} &amp; ${esc(S.members[1].name)}</div><div class="s">${together}</div></div>
    <section class="card profile-list"><div class="menu">
      <a href="#/profilo/account">${icon('i-gear')}<span>Impostazioni account</span><span class="val">Io sono ${esc(a.name)}</span>${icon('i-right', 'ic chev')}</a>
      <a href="#/profilo/categorie">${icon('i-grid')}<span>Categorie</span><span></span>${icon('i-right', 'ic chev')}</a>
      <a href="#/profilo/account">${icon('i-coin')}<span>Valuta</span><span class="val">EUR (€)</span>${icon('i-right', 'ic chev')}</a>
      <a href="#/profilo/esporta">${icon('i-download')}<span>Esporta dati</span><span></span>${icon('i-right', 'ic chev')}</a>
      <a href="#/profilo/sync">${icon('i-cloud')}<span>Backup e sincronizzazione</span><span class="sync-dot ${syncOn ? '' : 'off'}" title="${syncOn ? 'attiva' : 'non attiva'}"></span>${icon('i-right', 'ic chev')}</a>
    </div></section>
    <section class="card"><div class="menu">
      <a href="#/attivita">${icon('i-repeat')}<span>Attività recente</span><span></span>${icon('i-right', 'ic chev')}</a>
      <a href="#/profilo/info">${icon('i-info')}<span>Informazioni sull'app</span><span class="val">v${APP_VERSION}</span>${icon('i-right', 'ic chev')}</a>
    </div></section>
    ${installBanner()}
  </div>`;
}
function subHead(title, backTo = '#/profilo') { return `<div class="head"><button class="icon-btn" data-back="${backTo}" aria-label="Indietro">${icon('i-back')}</button><div class="title">${esc(title)}</div><span></span></div>`; }
function pageAccount() {
  return `<div class="page slide">${subHead('Impostazioni account')}
    <h2 class="sec-title">Chi siamo</h2>
    <section class="card">${S.members.map((m, i) => `<div class="member-row"><input class="swatch" type="color" value="${m.color}" data-color="${m.id}" style="--c:${m.color}" aria-label="Colore di ${esc(m.name)}"><div class="field" style="margin:0"><input type="text" value="${esc(m.name)}" data-name="${m.id}" aria-label="Nome" placeholder="Nome"></div></div>`).join('')}
    <div class="field"><div class="lbl">Su questo telefono io sono</div>${segHTML(S.members.map((m) => ({ v: m.id, t: m.name })), S.members.findIndex((m) => m.id === S.settings.me), '', 'me')}<div class="hint">Sul telefono di ${esc(other().name)} va scelto l'altro nome: così "Ciao" e i saldi sono dal suo punto di vista.</div></div>
    </section>
    <h2 class="sec-title section">Coppia</h2>
    <section class="card"><div class="field" style="margin:0"><label for="together">Insieme dal (anno o data)</label><input id="together" type="text" value="${esc(S.settings.together)}" placeholder="2023" inputmode="numeric"><div class="hint">Compare nel profilo. Lascia vuoto per non mostrarlo.</div></div>
    <div class="field"><div class="lbl">Valuta</div><div class="input" style="display:flex;align-items:center;color:var(--muted)">EUR (€) — per ora l'unica disponibile</div></div></section>
    <div class="section"><button class="btn" id="save-account">Salva</button></div>
  </div>`;
}
function pageCategorie() {
  const counts = {}; active().forEach((e) => { if (e.kind === 'expense') counts[e.cat || 'altro'] = (counts[e.cat || 'altro'] || 0) + 1; });
  return `<div class="page slide">${subHead('Categorie')}
    <p class="muted small" style="margin:0 2px 12px">Le categorie servono per i grafici e i filtri. Tocca una categoria per vedere le sue spese.</p>
    <section class="card list-card"><div class="list stagger">${CATS.map((c, i) => `<a class="row" href="#/spese" data-filter-cat="${c.id}" style="--i:${i}"><span class="cat-ic">${icon(c.icon)}</span><span class="main"><span class="title">${esc(c.name)}</span><span class="sub">${counts[c.id] || 0} ${counts[c.id] === 1 ? 'spesa' : 'spese'}</span></span><span class="right">${icon('i-right', 'ic muted')}</span></a>`).join('')}</div></section>
    <p class="muted small section" style="margin:14px 2px">Categorie personalizzate: in arrivo in una prossima versione.</p>
  </div>`;
}
function pageExport() {
  const n = active().length;
  return `<div class="page slide">${subHead('Esporta dati')}
    <section class="card"><div class="menu">
      <button type="button" data-export="json">${icon('i-share')}<span>Backup completo <span class="d">File JSON con tutto (${n} voci). Serve anche per portare i dati sull'altro telefono.</span></span><span></span>${icon('i-right', 'ic chev')}</button>
      <button type="button" data-export="csv">${icon('i-download')}<span>Foglio di calcolo <span class="d">CSV delle spese, si apre con Numbers o Excel.</span></span><span></span>${icon('i-right', 'ic chev')}</button>
      <label class="menu-import">${icon('i-upload')}<span>Importa backup <span class="d">Unisce un file JSON esportato da Pari: niente doppioni.</span></span><span></span>${icon('i-right', 'ic chev')}<input type="file" accept="application/json,.json" id="import-file" hidden></label>
    </div></section>
    <h2 class="sec-title section">Zona pericolosa</h2>
    <section class="card"><div class="menu"><button type="button" class="danger" data-reset>${icon('i-trash')}<span>Cancella tutti i dati <span class="d">Solo su questo telefono. Chiede conferma.</span></span><span></span>${icon('i-right', 'ic chev')}</button></div></section>
  </div>`;
}
function pageSync() {
  const s = S.settings.sync; const on = sync.enabled();
  const st = sync.status === 'busy' ? 'Sincronizzazione in corso…' : sync.status === 'err' ? 'Errore: ' + (sync.lastError || 'controlla URL e chiave') : on ? (S.settings.lastPull ? 'Ultimo aggiornamento ' + new Date(S.settings.lastPull).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : 'Collegata, mai sincronizzata') : 'Non attiva: i dati restano solo su questo telefono';
  return `<div class="page slide">${subHead('Backup e sincronizzazione')}
    <section class="card"><div class="status-line"><span class="sync-dot ${!on ? 'off' : sync.status === 'busy' ? 'busy' : sync.status === 'err' ? 'err' : ''}"></span>${esc(st)}</div>
    <p class="small muted" style="margin:10px 0 0">Per vedere le stesse spese su due telefoni serve un piccolo database gratuito su <b>Supabase</b>. Si crea in cinque minuti: le istruzioni sono nel file <code class="mono">README.md</code> del progetto. Poi incolla qui i tre valori, uguali su entrambi i telefoni.</p></section>
    <section class="card section">
      <div class="field" style="margin-top:0"><label for="s-url">URL del progetto</label><input id="s-url" type="url" placeholder="https://xxxx.supabase.co" value="${esc(s.url)}" autocapitalize="off" autocorrect="off"></div>
      <div class="field"><label for="s-key">Chiave pubblica (anon key)</label><input id="s-key" type="password" placeholder="eyJhbGciOi…" value="${esc(s.key)}" autocapitalize="off" autocorrect="off"></div>
      <div class="field"><label for="s-house">Codice casa</label><input id="s-house" type="text" placeholder="es. luca-martina-2026" value="${esc(s.house)}" autocapitalize="off" autocorrect="off"><div class="hint">Una parola segreta scelta da voi: separa i vostri dati da quelli di chiunque altro usasse lo stesso database.</div></div>
      <div class="section btn-row"><button class="btn" id="save-sync">Salva e collega</button>${on ? `<button class="btn soft" id="sync-now">Sincronizza ora</button>` : ''}</div>
      ${on ? `<div class="section"><button class="btn ghost" id="sync-off">Scollega questo telefono</button></div>` : ''}
    </section>
  </div>`;
}
function pageInfo() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  return `<div class="page slide">${subHead("Informazioni sull'app")}
    <section class="card" style="text-align:center;padding:26px 18px"><img src="icons/preview-256.png" alt="" width="72" height="72" style="border-radius:18px"><div style="font-weight:800;font-size:22px;margin-top:12px">Pari</div><div class="muted small">Versione ${APP_VERSION}${standalone ? ' · installata' : ' · nel browser'}</div>
    <p class="small" style="margin:14px 0 0;color:var(--ink-2)">Le spese di ${esc(S.members[0].name)} e ${esc(S.members[1].name)}, divise a metà. Funziona anche senza rete: i dati sono salvati sul telefono.</p></section>
    <section class="card section"><div class="kv">
      <div><span class="k">Voci salvate</span><span class="v">${active().length}</span></div>
      <div><span class="k">Attività registrate</span><span class="v">${S.activity.length}</span></div>
      <div><span class="k">Spazio usato</span><span class="v">${Math.round((localStorage.getItem(KEY) || '').length / 1024)} KB</span></div>
    </div></section>
    <div class="section btn-row"><button class="btn soft" id="reload-app">Ricarica l'app</button></div>
  </div>`;
}

/* ---------- ATTIVITÀ ---------- */
function pageActivity() {
  const days = []; S.activity.forEach((a) => { const k = a.ts.slice(0, 10); let d = days.find((x) => x.k === k); if (!d) { d = { k, items: [] }; days.push(d); } d.items.push(a); });
  const text = (a) => { const who = member(a.by).name; const amt = money(a.amount); const d = esc(a.desc || ''); switch (a.type) { case 'add': return `<b>${esc(who)}</b> ha aggiunto <b>${d}</b> (${amt})`; case 'edit': return `<b>${esc(who)}</b> ha modificato <b>${d}</b> (${amt})`; case 'delete': return `<b>${esc(who)}</b> ha eliminato <b>${d}</b> (${amt})`; case 'restore': return `<b>${esc(who)}</b> ha ripristinato <b>${d}</b>`; case 'settle': return `<b>${esc(who)}</b> ha registrato un pagamento di <b>${amt}</b>`; default: return d; } };
  return `<div class="page slide">${subHead('Attività', '#/spese')}
    <section class="card">${days.length ? `<div class="feed">${days.map((d) => `<div class="day">${esc(relDay(d.k))}</div>${d.items.map((a) => `<a class="ev ${a.type}" href="#/spesa/${a.entryId}"><div class="t">${text(a)}</div><div class="when">${esc(new Date(a.ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }))}</div></a>`).join('')}`).join('')}</div>` : emptyBox('Ancora niente', 'Qui compare tutto quello che aggiungete, modificate o saldate.')}</section>
  </div>`;
}

/* ---------- Banner installazione iOS ---------- */
function installBanner() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (standalone || !ios || sessionStorage.getItem('pari:install-hide')) return '';
  return `<section class="card install section"><img src="icons/apple-touch-icon.png" alt=""><div><div class="t">Mettila sulla schermata Home</div><div class="d">In Safari: tasto Condividi, poi "Aggiungi alla schermata Home".</div></div><button class="icon-btn" data-install-hide aria-label="Chiudi">${icon('i-x')}</button></section>`;
}

/* ---------- Bind eventi per pagina ---------- */
function bind(r) {
  $$('[data-back]').forEach((b) => b.addEventListener('click', () => { if (r.name === 'nuova' || r.name === 'modifica') F = null; back(b.dataset.back); }));
  $$('[data-month]').forEach((b) => b.addEventListener('click', () => { const d = +b.dataset.month; S.ui.month = d === 0 ? curYM() : shiftYM(S.ui.month, d); save(); render(); const l = $('.monthnav .label'); if (l) l.classList.add('swap'); }));
  $$('[data-year]').forEach((b) => b.addEventListener('click', () => { S.ui.month = String(+S.ui.month.slice(0, 4) + +b.dataset.year) + S.ui.month.slice(4); save(); render(); }));
  $$('[data-install-hide]').forEach((b) => b.addEventListener('click', () => { sessionStorage.setItem('pari:install-hide', '1'); b.closest('.install').remove(); }));
  bindSeg($('[data-seg="homeMode"]'), (v) => { S.ui.homeMode = v; save(); render(); });
  bindSeg($('[data-seg="balTab"]'), (v) => { S.ui.balTab = +v; save(); render(); });
  bindSeg($('[data-seg="statsRange"]'), (v) => { S.ui.statsRange = v; save(); render(); });
  $$('.chart .col').forEach((c) => c.addEventListener('click', () => { S.ui.month = c.dataset.ym; if (r.name === 'statistiche' && S.ui.statsRange === 'anno') S.ui.statsRange = 'mese'; save(); render(); }));
  $$('[data-settle]').forEach((b) => b.addEventListener('click', () => { const [from, to] = b.dataset.settle.split(':'); F = null; go(`#/nuova?tipo=pagamento&da=${from}&a=${to}`); }));

  if (r.name === 'spese') {
    const q = $('#q'); let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { speseFilter.q = q.value; $('#spese-list').innerHTML = speseList(); }, 120); });
    $('#chips').addEventListener('click', (ev) => { const c = ev.target.closest('.chip'); if (!c) return; speseFilter.cat = c.dataset.cat; $$('.chip').forEach((x) => x.classList.toggle('on', x === c)); $('#spese-list').innerHTML = speseList(); });
  }
  if (r.name === 'profilo' && r.sub === 'categorie') $$('[data-filter-cat]').forEach((a) => a.addEventListener('click', () => { speseFilter = { q: '', cat: a.dataset.filterCat }; }));
  if (r.name === 'spesa') {
    $$('[data-del]').forEach((b) => b.addEventListener('click', () => confirmSheet('Eliminare questa spesa?', 'Puoi annullare subito dopo dal messaggio in basso.', 'Elimina', () => { const id = b.dataset.del; deleteEntry(id); go('#/spese'); toast('Spesa eliminata', { label: 'Annulla', fn: () => restoreEntry(id) }); })));
    const mb = $('[data-menu]'); if (mb) mb.addEventListener('click', () => { const e = S.entries.find((x) => x.id === r.id); if (!e) return; actionSheet('Azioni', [
      { t: 'Modifica', ic: 'i-edit', fn: () => go('#/modifica/' + e.id) },
      { t: 'Duplica', ic: 'i-copy', fn: () => { const c = { ...e, id: undefined, date: todayStr(), recurring: null, recurringOf: null, owed: { ...e.owed } }; const n = addEntry(c); toast('Spesa duplicata a oggi'); go('#/spesa/' + n.id); } },
      { t: 'Copia riepilogo', ic: 'i-share', fn: () => { const txt = `${e.desc} — ${money(e.amount)} — ${dateLong(e.date)} — pagato da ${member(e.paidBy).name}`; if (navigator.share) navigator.share({ text: txt }).catch(() => {}); else navigator.clipboard?.writeText(txt).then(() => toast('Copiato')); } },
      { t: 'Elimina', ic: 'i-trash', danger: true, fn: () => $('[data-del]').click() },
    ]); });
  }
  if (r.name === 'nuova' || r.name === 'modifica') bindForm(r);
  if (r.name === 'profilo') bindProfilo(r);
}

function bindForm(r) {
  if (r.q.da && !F.id && F.kind === 'payment' && !F._prefilled) { F.paidBy = r.q.da; F.to = r.q.a; const bal = balances(); const v = bal[r.q.a] || 0; F.amount = v > 0 ? moneyPlain(v) : ''; F._prefilled = true; render(); return; }
  const form = $('#f');
  const rerender = () => { const pos = window.scrollY; render(); window.scrollTo(0, pos); };
  bindSeg($('[data-seg="kind"]'), (v) => { F.kind = v; if (v === 'payment') { const bal = balances(); const m = bal[me().id] || 0; if (m < 0) { F.paidBy = me().id; F.to = other().id; F.amount = moneyPlain(-m); } else if (m > 0) { F.paidBy = other().id; F.to = me().id; F.amount = moneyPlain(m); } } rerender(); });
  bindSeg($('[data-seg="splitMethod"]'), (v) => { F.splitMethod = v; F.splitInput = {}; rerender(); });
  const desc = $('#desc'); if (desc) desc.addEventListener('input', () => (F.desc = desc.value));
  const amount = $('#amount'); amount.addEventListener('input', () => { F.amount = amount.value; $('#amount-err').hidden = true; const d = $('[data-split="equal"] .d'); const v = parseAmount(F.amount); if (d) d.textContent = !isNaN(v) ? money(Math.round(v / 2)) + ' a testa' : 'In parti uguali'; validateSplit(); });
  $('#date').addEventListener('change', (ev) => (F.date = ev.target.value || todayStr()));
  $('#notes').addEventListener('input', (ev) => (F.notes = ev.target.value));
  $$('[data-pick]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.pick === 'payer') F.paidBy = b.dataset.id; else F.to = b.dataset.id; rerender(); }));
  $$('[data-soon]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.soon === 'friends') toast('Dividere con amici arriva in una prossima versione'); }));
  $$('[data-split]').forEach((b) => b.addEventListener('click', () => { const v = b.dataset.split; if (v === 'equal') F.splitMethod = 'equal'; else if (F.splitMethod === 'equal') F.splitMethod = 'exact'; rerender(); }));
  $$('[data-share]').forEach((inp) => inp.addEventListener('input', () => { F.splitInput[inp.dataset.share] = inp.value; validateSplit(); }));
  $$('[data-cat]').forEach((b) => b.addEventListener('click', () => { F.cat = F.cat === b.dataset.cat ? '' : b.dataset.cat; $$('.cat-circle').forEach((x) => x.classList.toggle('on', x.dataset.cat === F.cat)); $('#cat-name').textContent = F.cat ? catOf(F.cat).name : 'Nessuna categoria'; }));
  const rec = $('#recurring'); if (rec) rec.addEventListener('click', () => { F.recurring = !F.recurring; rec.setAttribute('aria-checked', F.recurring); });
  form.addEventListener('submit', (ev) => { ev.preventDefault(); submitForm(); });
  $('#save-top').addEventListener('click', submitForm);
  validateSplit();
  if (!F.id && !F.desc && desc) setTimeout(() => desc.focus({ preventScroll: true }), 350);
}

function bindProfilo(r) {
  if (r.sub === 'account') {
    $('#save-account').addEventListener('click', () => {
      $$('[data-name]').forEach((i) => { const m = member(i.dataset.name); const v = i.value.trim(); if (v) m.name = v; });
      $$('[data-color]').forEach((i) => (member(i.dataset.color).color = i.value));
      S.settings.together = $('#together').value.trim(); S.settings.membersUpdatedAt = nowISO();
      save(); sync.schedule(); toast('Impostazioni salvate'); go('#/profilo');
    });
    $$('[data-color]').forEach((i) => i.addEventListener('input', () => i.style.setProperty('--c', i.value)));
    bindSeg($('[data-seg="me"]'), (v) => { S.settings.me = v; save(); });
  }
  if (r.sub === 'esporta') {
    $$('[data-export]').forEach((b) => b.addEventListener('click', () => exportData(b.dataset.export)));
    $('#import-file').addEventListener('change', (ev) => { const f = ev.target.files[0]; if (!f) return; f.text().then((t) => importData(t)).catch(() => toast('File non leggibile')); ev.target.value = ''; });
    const rs = $('[data-reset]'); if (rs) rs.addEventListener('click', () => confirmSheet('Cancellare tutto?', 'Spese, pagamenti e impostazioni di questo telefono verranno eliminati. Se la sincronizzazione è attiva, i dati sul database restano.', 'Cancella tutto', () => { const keepSync = S.settings.sync; S = defaultState(); S.settings.sync = keepSync; save(); toast('Dati cancellati'); go('#/home'); }));
  }
  if (r.sub === 'sync') {
    $('#save-sync').addEventListener('click', async () => {
      S.settings.sync = { url: $('#s-url').value.trim().replace(/\/+$/, ''), key: $('#s-key').value.trim(), house: $('#s-house').value.trim() }; save();
      if (!sync.enabled()) { toast('Compila tutti e tre i campi'); return; }
      toast('Collego…'); const ok = await sync.run(true); render(); toast(ok ? 'Collegata: dati sincronizzati' : 'Non riesco a collegarmi: ' + (sync.lastError || 'controlla i valori'));
    });
    const n = $('#sync-now'); if (n) n.addEventListener('click', async () => { toast('Sincronizzo…'); const ok = await sync.run(true); render(); toast(ok ? 'Aggiornato' : 'Errore: ' + (sync.lastError || '')); });
    const off = $('#sync-off'); if (off) off.addEventListener('click', () => { S.settings.sync = { url: '', key: '', house: '' }; S.settings.lastPull = null; save(); sync.status = 'idle'; render(); toast('Scollegata: i dati restano sul telefono'); });
  }
  if (r.sub === 'info') $('#reload-app').addEventListener('click', () => { navigator.serviceWorker?.getRegistration().then((reg) => reg && reg.update()); location.reload(); });
}

/* ---------- Esporta / importa ---------- */
async function shareOrDownload(name, text, type) {
  const blob = new Blob([text], { type }); const file = new File([blob], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function exportData(kind) {
  const stamp = todayStr();
  if (kind === 'json') { const out = { app: 'pari', version: 1, exportedAt: nowISO(), members: S.members, settings: { together: S.settings.together }, entries: S.entries, activity: S.activity }; shareOrDownload(`pari-backup-${stamp}.json`, JSON.stringify(out, null, 2), 'application/json'); return; }
  const rows = [['Data', 'Descrizione', 'Categoria', 'Tipo', 'Importo', 'Pagato da', ...S.members.map((m) => 'Quota ' + m.name), 'Note']];
  active().sort((a, b) => a.date.localeCompare(b.date)).forEach((e) => rows.push([e.date, e.desc, e.kind === 'payment' ? 'Pagamento' : catOf(e.cat).name, e.kind === 'payment' ? 'pagamento' : 'spesa', moneyPlain(e.amount), member(e.paidBy).name, ...S.members.map((m) => moneyPlain(e.owed?.[m.id] || 0)), e.notes || '']));
  const csv = '﻿' + rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\r\n');
  shareOrDownload(`pari-spese-${stamp}.csv`, csv, 'text/csv');
}
function importData(text) {
  let d; try { d = JSON.parse(text); } catch (e) { toast('Non è un backup di Pari'); return; }
  if (!d || d.app !== 'pari' || !Array.isArray(d.entries)) { toast('Non è un backup di Pari'); return; }
  let added = 0, updated = 0;
  d.entries.forEach((e) => { const cur = S.entries.find((x) => x.id === e.id); if (!cur) { S.entries.push(e); added++; } else if ((e.updatedAt || '') > (cur.updatedAt || '')) { Object.assign(cur, e); updated++; } });
  (d.activity || []).forEach((a) => { if (!S.activity.some((x) => x.id === a.id)) S.activity.push(a); });
  S.activity.sort((a, b) => b.ts.localeCompare(a.ts)); S.activity = S.activity.slice(0, 300);
  if (Array.isArray(d.members) && d.members.length === 2 && !active().length) S.members = d.members;
  save(); sync.schedule(); render(); toast(`Importate ${added} voci nuove, ${updated} aggiornate`);
}

/* ---------- Sincronizzazione Supabase (REST) ---------- */
const sync = {
  status: 'idle', lastError: '', timer: null, running: false,
  enabled() { const s = S.settings.sync; return !!(s.url && s.key && s.house); },
  headers() { const k = S.settings.sync.key; return { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }; },
  schedule() { if (!this.enabled()) return; clearTimeout(this.timer); this.timer = setTimeout(() => this.run(), 900); },
  async run(force) {
    if (!this.enabled() || this.running) return false; this.running = true; this.status = 'busy'; this.lastError = ''; updateSyncDot();
    try {
      const s = S.settings.sync; const base = s.url + '/rest/v1/pari_rows';
      // 1) spingo le righe locali cambiate dopo l'ultimo invio
      const since = S.settings.lastPush || '';
      const rows = S.entries.filter((e) => (e.updatedAt || '') > since).map((e) => ({ house: s.house, id: e.id, kind: 'entry', data: e, updated_at: e.updatedAt, deleted: !!e.deleted }));
      if ((S.settings.membersUpdatedAt || '') > since) rows.push({ house: s.house, id: 'members', kind: 'members', data: { members: S.members, together: S.settings.together }, updated_at: S.settings.membersUpdatedAt || nowISO(), deleted: false });
      S.activity.filter((a) => (a.ts || '') > since).forEach((a) => rows.push({ house: s.house, id: 'act-' + a.id, kind: 'activity', data: a, updated_at: a.ts, deleted: false }));
      if (rows.length) {
        const r = await fetch(base + '?on_conflict=house,id', { method: 'POST', headers: this.headers(), body: JSON.stringify(rows) });
        if (!r.ok) throw new Error(await errText(r));
      }
      S.settings.lastPush = nowISO();
      // 2) scarico tutto ciò che è cambiato dopo l'ultimo scarico
      const q = `?house=eq.${encodeURIComponent(s.house)}&order=updated_at.asc&limit=1000` + (S.settings.lastPull && !force ? `&updated_at=gt.${encodeURIComponent(S.settings.lastPull)}` : '');
      const r2 = await fetch(base + q, { headers: this.headers() });
      if (!r2.ok) throw new Error(await errText(r2));
      const remote = await r2.json(); let changed = 0;
      remote.forEach((row) => {
        if (row.kind === 'entry') { const e = row.data; const cur = S.entries.find((x) => x.id === e.id); if (!cur) { S.entries.push(e); changed++; } else if ((e.updatedAt || '') > (cur.updatedAt || '')) { Object.assign(cur, e); changed++; } }
        else if (row.kind === 'members') { if ((row.updated_at || '') > (S.settings.membersUpdatedAt || '')) { const m = row.data.members; if (Array.isArray(m) && m.length >= 2) { S.members = m; } if (typeof row.data.together === 'string') S.settings.together = row.data.together; S.settings.membersUpdatedAt = row.updated_at; changed++; } }
        else if (row.kind === 'activity') { if (!S.activity.some((x) => x.id === row.data.id)) { S.activity.push(row.data); } }
      });
      S.activity.sort((a, b) => b.ts.localeCompare(a.ts)); S.activity = S.activity.slice(0, 300);
      if (remote.length) S.settings.lastPull = remote[remote.length - 1].updated_at; else if (!S.settings.lastPull) S.settings.lastPull = nowISO();
      this.status = 'ok'; save();
      if (changed) { materializeRecurring(); if (!['nuova', 'modifica'].includes((currentRoute || {}).name)) render(); }
      return true;
    } catch (e) { this.status = 'err'; this.lastError = e.message || String(e); console.warn('sync', e); return false; }
    finally { this.running = false; updateSyncDot(); }
  },
};
async function errText(r) { try { const j = await r.json(); return (j.message || j.hint || j.error || r.status) + ''; } catch (e) { return 'HTTP ' + r.status; } }
function updateSyncDot() { const d = $('.sync-dot'); if (!d) return; d.className = 'sync-dot ' + (!sync.enabled() ? 'off' : sync.status === 'busy' ? 'busy' : sync.status === 'err' ? 'err' : ''); }

/* ---------- Sheet, conferme, toast ---------- */
function openSheet(title, bodyHTML, onOpen) {
  closeSheet(true);
  const root = $('#sheet-root');
  root.innerHTML = `<div class="backdrop"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="grab"><i></i></div><div class="shead"><span class="t">${esc(title)}</span><button class="close" type="button" aria-label="Chiudi">${icon('i-x')}</button></div><div class="sbody">${bodyHTML}</div></div>`;
  const bd = $('.backdrop', root), sh = $('.sheet', root);
  requestAnimationFrame(() => requestAnimationFrame(() => { bd.classList.add('in'); sh.classList.add('in'); }));
  bd.addEventListener('click', () => closeSheet()); $('.close', sh).addEventListener('click', () => closeSheet());
  // trascina per chiudere
  let y0 = 0, dy = 0, t0 = 0, drag = false;
  sh.addEventListener('pointerdown', (ev) => { if (ev.target.closest('.sbody') && $('.sbody', sh).scrollTop > 0) return; drag = true; y0 = ev.clientY; t0 = Date.now(); dy = 0; sh.classList.add('dragging'); sh.setPointerCapture(ev.pointerId); });
  sh.addEventListener('pointermove', (ev) => { if (!drag) return; dy = Math.max(0, ev.clientY - y0); sh.style.transform = `translateY(${dy}px)`; });
  const end = () => { if (!drag) return; drag = false; sh.classList.remove('dragging'); const v = dy / Math.max(1, Date.now() - t0); if (dy > sh.offsetHeight * 0.3 || v > 0.5) closeSheet(); else sh.style.transform = ''; };
  sh.addEventListener('pointerup', end); sh.addEventListener('pointercancel', end);
  if (onOpen) onOpen(sh);
}
function closeSheet(now) {
  const root = $('#sheet-root'); const sh = $('.sheet', root), bd = $('.backdrop', root); if (!sh) return;
  if (now) { root.innerHTML = ''; return; }
  sh.style.transform = ''; sh.classList.remove('in'); bd.classList.remove('in'); setTimeout(() => { if ($('.sheet', root) === sh) root.innerHTML = ''; }, 400);
}
function confirmSheet(title, text, okLabel, fn) {
  openSheet(title, `<p>${esc(text)}</p><div class="btn-row"><button class="btn soft" data-c="no">Annulla</button><button class="btn danger" data-c="ok">${esc(okLabel)}</button></div>`, (sh) => { $('[data-c="no"]', sh).addEventListener('click', () => closeSheet()); $('[data-c="ok"]', sh).addEventListener('click', () => { closeSheet(); fn(); }); });
}
function actionSheet(title, items) {
  openSheet(title, `<div class="menu">${items.map((it, i) => `<button type="button" class="${it.danger ? 'danger' : ''}" data-a="${i}">${icon(it.ic)}<span>${esc(it.t)}</span><span></span>${icon('i-right', 'ic chev')}</button>`).join('')}</div>`, (sh) => $$('[data-a]', sh).forEach((b) => b.addEventListener('click', () => { closeSheet(); items[+b.dataset.a].fn(); })));
}
let toastTimer;
function toast(text, action) {
  const root = $('#toast-root'); root.innerHTML = `<div class="toast-wrap"><div class="toast"><span>${esc(text)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}</div></div>`;
  const t = $('.toast', root); requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('in')));
  if (action) $('button', t).addEventListener('click', () => { action.fn(); root.innerHTML = ''; });
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.classList.remove('in'); setTimeout(() => { if ($('.toast', root) === t) root.innerHTML = ''; }, 300); }, action ? 5000 : 2600);
}

/* ---------- Avvio ---------- */
materializeRecurring();
route();
if (sync.enabled()) sync.run();
document.addEventListener('visibilitychange', () => { if (!document.hidden) { materializeRecurring(); if (sync.enabled()) sync.run(); } });
setInterval(() => { if (!document.hidden && sync.enabled()) sync.run(); }, 45000);
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => { const nw = reg.installing; nw && nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('Nuova versione pronta', { label: 'Aggiorna', fn: () => { nw.postMessage('skipWaiting'); setTimeout(() => location.reload(), 300); } }); }); });
    }).catch(() => {});
  });
}
window.PARI = { state: () => S, addEntry, balances, monthStats, sync, toast };
})();

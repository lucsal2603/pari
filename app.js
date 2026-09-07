/* ==========================================================================
   Divvy — app spese di coppia. Vanilla JS, dati in localStorage,
   sincronizzazione opzionale via Supabase (REST).
   ========================================================================== */
(() => {
'use strict';

const APP_VERSION = '1.44.9';
const KEY = 'pari:v1';
/* Progetto Supabase "divvy": indirizzo e chiave pubblica (anon) sono pensati per stare nel client; la privacy è nel codice casa */
const SUPA_URL = 'https://odvbwrrpbkuqccoprrrc.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kdmJ3cnJwYmt1cWNjb3BycnJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MTIxMDgsImV4cCI6MjEwNDA4ODEwOH0.0z4B9bOU8_LN5P7GC7rryCQ_hrC9EJASXf6rcMDrcV8';
const VAPID_PUBLIC = 'BAUQZ4UtSZAcJIDeoRF4b06elYpAl_pMJp5HzAA5nwbUB6Shslilu-bM9vjN0lnlrwTcfxgPi0ibyU3_UbAz-UI';
const urlB64ToU8 = (b) => { const p = '='.repeat((4 - (b.length % 4)) % 4); const r = (b + p).replace(/-/g, '+').replace(/_/g, '/'); const raw = atob(r); return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))); };
const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const isStandalone = () => isNative() || window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
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
/* ---------- Lingua dell'interfaccia (dizionari in i18n.js, chiavi = testo italiano) ---------- */
const LANG_FALLBACK = { code: 'it', name: 'Italiano', locale: 'it-IT', flag: 'it' };
const LANGS = () => (window.I18N && I18N.langs) || [LANG_FALLBACK];
const LANG = () => (window.__S && window.__S.settings && window.__S.settings.lang) || 'it';
const langInfo = (c) => LANGS().find((l) => l.code === (c || LANG())) || LANG_FALLBACK;
const LOC = () => langInfo().locale;
const detectLang = () => { const n = String(navigator.language || 'it').slice(0, 2).toLowerCase(); return LANGS().some((l) => l.code === n) ? n : 'en'; };
const i18nPats = {};
function i18nPatterns(L) {
  if (i18nPats[L]) return i18nPats[L];
  const d = I18N.dict[L]; const out = [];
  for (const k of Object.keys(d)) { if (!k.includes('{')) continue; const re = new RegExp('^' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{(\d)\\\}/g, '(.+?)') + '$', 's'); out.push({ re, out: d[k], n: k.length }); }
  out.sort((a, b) => b.n - a.n); i18nPats[L] = out; return out;
}
function trStr(d, L, s, depth) {
  const k = s.trim(); if (!k || !/[A-Za-zÀ-ú]/.test(k)) return s;
  const lead = s.slice(0, s.length - s.trimStart().length), trail = s.slice(s.trimEnd().length);
  if (Object.prototype.hasOwnProperty.call(d, k)) return lead + d[k] + trail;
  if (depth > 2) return s;
  for (const p of i18nPatterns(L)) { const m = p.re.exec(k); if (m) { let o = p.out; for (let i = 1; i < m.length; i++) o = o.split('{' + (i - 1) + '}').join(trStr(d, L, m[i], depth + 1)); return lead + o + trail; } }
  return s;
}
/* T('testo italiano') → testo nella lingua scelta; T('Ciao {0}', nome) sostituisce le parti variabili */
function T(s, ...args) {
  s = String(s == null ? '' : s); const L = LANG(); let out = s;
  if (L !== 'it' && window.I18N && I18N.dict[L]) out = args.length ? (Object.prototype.hasOwnProperty.call(I18N.dict[L], s) ? I18N.dict[L][s] : s) : trStr(I18N.dict[L], L, s, 0);
  args.forEach((a, i) => { out = out.split('{' + i + '}').join(a); });
  return out;
}
/* traduce i testi e gli attributi (placeholder, aria-label, title) di una parte di pagina appena disegnata */
function translateDom(root) {
  if (!root || LANG() === 'it' || !window.I18N) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const nodes = []; let n; while ((n = w.nextNode())) nodes.push(n);
  for (const t of nodes) { const par = t.parentElement; if (!par || /^(SCRIPT|STYLE|TEXTAREA)$/.test(par.tagName) || par.closest('[data-no-i18n]')) continue; const v = t.nodeValue; if (!/[A-Za-zÀ-ú]/.test(v)) continue; const x = T(v); if (x !== v) t.nodeValue = x; }
  root.querySelectorAll('[placeholder],[aria-label],[title]').forEach((el) => { for (const a of ['placeholder', 'aria-label', 'title']) { const v = el.getAttribute(a); if (v) { const x = T(v); if (x !== v) el.setAttribute(a, x); } } });
}
/* parti fisse (barra in basso, caricamento, tira-per-aggiornare): ricordo l'italiano per poterle ritradurre quando cambia lingua */
function translateStatic(root) {
  if (!root) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const nodes = []; let n; while ((n = w.nextNode())) nodes.push(n);
  for (const t of nodes) { if (t.__it === undefined) t.__it = t.nodeValue; if (/[A-Za-zÀ-ú]/.test(t.__it)) t.nodeValue = T(t.__it); }
  root.querySelectorAll('[aria-label],[title],[placeholder]').forEach((el) => { el.__it = el.__it || {}; for (const a of ['aria-label', 'title', 'placeholder']) { const v = el.getAttribute(a); if (v == null) continue; if (!(a in el.__it)) el.__it[a] = v; el.setAttribute(a, T(el.__it[a])); } });
}
function applyLang() { document.documentElement.lang = LANG(); translateStatic(document.getElementById('tabbar')); translateStatic(document.getElementById('splash')); translateStatic(document.querySelector('.ptr')); }

const CURRENCIES = [
  ['EUR', 'Euro'], ['USD', 'Dollaro statunitense'], ['GBP', 'Sterlina britannica'], ['CHF', 'Franco svizzero'], ['JPY', 'Yen giapponese'], ['CAD', 'Dollaro canadese'], ['AUD', 'Dollaro australiano'], ['NZD', 'Dollaro neozelandese'],
  ['SEK', 'Corona svedese'], ['NOK', 'Corona norvegese'], ['DKK', 'Corona danese'], ['ISK', 'Corona islandese'], ['PLN', 'Złoty polacco'], ['CZK', 'Corona ceca'], ['HUF', 'Fiorino ungherese'], ['RON', 'Leu rumeno'], ['BGN', 'Lev bulgaro'], ['RSD', 'Dinaro serbo'],
  ['TRY', 'Lira turca'], ['ILS', 'Shekel israeliano'], ['AED', 'Dirham degli Emirati'], ['SAR', 'Riyal saudita'], ['EGP', 'Sterlina egiziana'], ['MAD', 'Dirham marocchino'], ['ZAR', 'Rand sudafricano'],
  ['BRL', 'Real brasiliano'], ['MXN', 'Peso messicano'], ['ARS', 'Peso argentino'], ['CLP', 'Peso cileno'], ['COP', 'Peso colombiano'],
  ['INR', 'Rupia indiana'], ['CNY', 'Yuan cinese'], ['HKD', 'Dollaro di Hong Kong'], ['SGD', 'Dollaro di Singapore'], ['KRW', 'Won sudcoreano'], ['THB', 'Baht thailandese'], ['IDR', 'Rupia indonesiana'], ['MYR', 'Ringgit malese'], ['PHP', 'Peso filippino'], ['VND', 'Dong vietnamita'],
];
const currencyName = (code) => { const it = (CURRENCIES.find((c) => c[0] === code) || [code, code])[1]; if (LANG() === 'it') return it; try { const n = new Intl.DisplayNames([LOC()], { type: 'currency' }).of(code); return n && n !== code ? n.charAt(0).toUpperCase() + n.slice(1) : it; } catch (_) { return it; } };
const fmtCache = {};
const curFmt = () => { const c = (window.__S && window.__S.settings.currency) || 'EUR'; const kk = LANG() + c; if (!fmtCache[kk]) { try { fmtCache[kk] = new Intl.NumberFormat(LOC(), { style: 'currency', currency: c, currencyDisplay: 'narrowSymbol' }); } catch (_) { try { fmtCache[kk] = new Intl.NumberFormat(LOC(), { style: 'currency', currency: c }); } catch (__) { fmtCache[kk] = new Intl.NumberFormat(LOC(), { style: 'currency', currency: 'EUR' }); } } } return fmtCache[kk]; };
const curSymbol = () => { try { return curFmt().formatToParts(0).find((p) => p.type === 'currency').value; } catch (_) { return '€'; } };
const curDigits = () => { try { return curFmt().resolvedOptions().maximumFractionDigits; } catch (_) { return 2; } };
const money = (cents) => curFmt().format((cents || 0) / 100);
const moneyPlain = (cents) => new Intl.NumberFormat(LOC(), { useGrouping: false, minimumFractionDigits: curDigits(), maximumFractionDigits: curDigits() }).format((cents || 0) / 100);
const monthName = (ymStr) => { const [y, m] = ymStr.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString(LOC(), { month: 'long', year: 'numeric' }); };
const monthShort = (ymStr) => { const [y, m] = ymStr.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString(LOC(), { month: 'short' }).replace('.', ''); };
const dateLong = (d) => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString(LOC(), { day: 'numeric', month: 'long', year: 'numeric' }); };
const dateShort = (d) => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString(LOC(), { day: 'numeric', month: 'short' }).replace('.', ''); };
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
    budget: {},
    groups: [{ id: 'g1', name: 'Spese casa', createdAt: '2026-09-04T00:00:00.000Z', updatedAt: '2026-09-04T00:00:00.000Z', deleted: false }],
    settings: { me: 'm1', currency: 'EUR', together: '', sync: { url: SUPA_URL, key: SUPA_ANON, house: '' }, lastPull: null, membersUpdatedAt: null, groupsUpdatedAt: null, lastGroup: 'g1', deviceId: null, push: null, pushUpdatedAt: null, notified: [], onboarded: false, lang: detectLang(), budgetUpdatedAt: null },
    ui: { month: curYM(), statsRange: 'mese', balTab: 0, homeMode: 'paid' },
  };
}
let S = load(); window.__S = S;
/* v1.31.0 aveva un budget unico di coppia: lo passo alla persona di questo telefono */
function migrateBudget(b, meId) { if (!b || typeof b !== 'object') return {}; if (typeof b.monthly === 'number' || b.byCat) { const out = {}; if (b.monthly || (b.byCat && Object.keys(b.byCat).length)) out[meId] = { monthly: b.monthly || 0, byCat: b.byCat || {}, updatedAt: nowISO() }; return out; } return b; } // dichiarazione di funzione: load() gira prima di questa riga
function load(rawOverride) {
  try { const raw = rawOverride !== undefined ? rawOverride : localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw); const d = defaultState(); const st = { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}), sync: { ...d.settings.sync, ...((s.settings || {}).sync || {}) } }, ui: { ...d.ui, ...(s.ui || {}), month: curYM() }, budget: migrateBudget(s.budget, ((s.settings || {}).me) || 'm1') };
    if (!Array.isArray(s.groups)) { st.groups = d.groups; st.entries.forEach((e) => { if (!e.group) e.group = 'g1'; }); st.settings.lastGroup = 'g1'; }
    if (!st.settings.sync.url) { st.settings.sync.url = SUPA_URL; st.settings.sync.key = SUPA_ANON; }
    // telefoni già collegati prima dell'arrivo della presentazione: non la mostro
    if ((s.settings || {}).onboarded === undefined) st.settings.onboarded = !!(st.settings.sync && st.settings.sync.house);
    // telefoni che usavano l'app prima delle lingue: restano in italiano
    if ((s.settings || {}).lang === undefined) st.settings.lang = 'it';
    // in classifica come coppia: vero solo per i telefoni di Luca e Martina (quelli con l'import da Splitwise); gli altri utenti sono singoli
    if ((s.settings || {}).boardCouple === undefined) st.settings.boardCouple = !!(s.settings || {}).splitwiseImported;
    return st; } } catch (e) { console.warn('stato corrotto', e); }
  return defaultState();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Memoria piena: impossibile salvare'); }  if (typeof scheduleMissionCheck === 'function') scheduleMissionCheck(); }
const me = () => S.members.find((m) => m.id === S.settings.me) || S.members[0];
const other = () => { const main = typeof mainSection === 'function' ? mainSection() : null; const ids = main ? sectionMembers(main) : []; return S.members.find((m) => m.id !== me().id && ids.includes(m.id)) || S.members.find((m) => m.id !== me().id) || S.members[1] || { id: '', name: '…', color: '#999' }; };
const member = (id) => S.members.find((m) => m.id === id) || { id, name: '?', color: '#999' };
const leftGroup = (gid) => { const g = gid && S.groups.find((x) => x.id === gid); return !!(g && g.left); }; /* sezione da cui sono uscito: le sue voci non si vedono */
const active = () => S.entries.filter((e) => !e.deleted && !leftGroup(e.group));
const groups = () => S.groups.filter((g) => !g.deleted && !g.left);
const groupOf = (e) => S.groups.find((g) => g.id === e.group && !g.deleted) || null;
const groupName = (e) => { const g = groupOf(e); return g ? g.name : 'Senza sezione'; };
function addGroup(name) { const now = nowISO(); const g = { id: 'g-' + uid(), name: name.trim(), code: newSectionCode(), owner: me().id, members: { [me().id]: { joinedAt: now, updatedAt: now } }, createdAt: now, updatedAt: now, deleted: false }; S.groups.push(g); S.settings.groupsUpdatedAt = nowISO(); save(); sync.schedule(); return g; }
function renameGroup(id, name) { const g = S.groups.find((x) => x.id === id); if (!g || !name.trim()) return; g.name = name.trim(); g.updatedAt = nowISO(); S.settings.groupsUpdatedAt = g.updatedAt; save(); sync.schedule(); }
function deleteGroup(id) { const g = S.groups.find((x) => x.id === id); if (!g) return; g.deleted = true; g.updatedAt = nowISO(); S.settings.groupsUpdatedAt = g.updatedAt; if (S.settings.lastGroup === id) S.settings.lastGroup = (groups()[0] || {}).id || null; save(); sync.schedule(); }

if (!S.settings.deviceId) { S.settings.deviceId = 'd-' + uid(); save(); }

/* ---------- Persone e sezioni con codice ----------
   Ogni persona ha un id globale (l'id dell'account). I vecchi id "m1"/"m2" restano come alias (campo legacy) e vengono tradotti al volo.
   Ogni sezione ha un codice: chi lo inserisce entra nella sezione e divide le spese con i suoi membri. Su Supabase il codice è la "casa" delle righe. */
const isLegacyId = (x) => /^m\d+$/.test(String(x || ''));
const pidMap = () => { const m = {}; S.members.forEach((p) => { if (p.legacy && p.legacy !== p.id) m[p.legacy] = p.id; }); return m; };
const pid = (x, map) => ((map || pidMap())[x] || x);
function normEntry(e, map) {
  map = map || pidMap(); if (!e || !Object.keys(map).length) return false; let ch = false;
  if (map[e.paidBy]) { e.paidBy = map[e.paidBy]; ch = true; } if (e.to && map[e.to]) { e.to = map[e.to]; ch = true; }
  for (const k of ['owed', 'splitInput']) { const o = e[k]; if (!o || typeof o !== 'object') continue; if (Object.keys(o).some((x) => map[x])) { const n = {}; Object.entries(o).forEach(([x, v]) => { n[map[x] || x] = v; }); e[k] = n; ch = true; } }
  return ch;
}
/* traduce gli alias ovunque (voci, attività, budget, divisione predefinita, notifiche, membri delle sezioni) senza toccare le date di modifica */
function normAll(map) {
  map = map || pidMap(); if (!Object.keys(map).length) return;
  S.entries.forEach((e) => normEntry(e, map)); S.activity.forEach((a) => { if (map[a.by]) a.by = map[a.by]; });
  Object.keys(S.budget || {}).forEach((k) => { if (map[k]) { S.budget[map[k]] = S.budget[map[k]] || S.budget[k]; delete S.budget[k]; } });
  const sp = S.settings.split; if (sp && sp.pct) { const n = {}; Object.entries(sp.pct).forEach(([x, v]) => { n[map[x] || x] = v; }); sp.pct = n; }
  if (S.settings.push && map[S.settings.push.member]) S.settings.push.member = map[S.settings.push.member];
  if (map[S.settings.me]) S.settings.me = map[S.settings.me];
  S.groups.forEach((g) => { if (map[g.owner]) g.owner = map[g.owner]; if (!g.members) return; Object.keys(g.members).forEach((x) => { if (map[x]) { g.members[map[x]] = g.members[map[x]] || g.members[x]; delete g.members[x]; } }); });
}
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newSectionCode = () => { let c = ''; const r = crypto.getRandomValues(new Uint8Array(6)); for (let i = 0; i < 6; i++) c += CODE_ALPHABET[r[i] % CODE_ALPHABET.length]; return c; };
const fnv = (str) => { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
/* codice deterministico per le sezioni nate prima dei codici: uguale su tutti i telefoni della stessa casa */
const legacyCode = (house, gid) => { let a = fnv(house + '|' + gid), b = fnv(gid + '#' + house); let c = ''; for (let i = 0; i < 4; i++) { c += CODE_ALPHABET[a % 32]; a = Math.floor(a / 32); } for (let i = 0; i < 4; i++) { c += CODE_ALPHABET[b % 32]; b = Math.floor(b / 32); } return c; };
const inSection = (g, id) => !!(g && g.members && g.members[id] && !g.members[id].leftAt);
const sectionMembers = (g) => Object.entries((g && g.members) || {}).filter(([, m]) => !m.leftAt).sort((x, y) => (x[0] === g.owner ? -1 : y[0] === g.owner ? 1 : (x[1].joinedAt || '').localeCompare(y[1].joinedAt || ''))).map(([id]) => id);
const sectionPeople = (g) => sectionMembers(g).map(member);
const sectionOthers = (g) => sectionPeople(g).filter((m) => m.id !== me().id);
const mainSection = () => groups().find((g) => g.code && g.code === S.settings.sync.house) || groups().find((g) => g.owner === me().id) || groups()[0] || null;
const codeOf = (gid) => { const g = gid && S.groups.find((x) => x.id === gid); return (g && g.code) || ((mainSection() || {}).code) || S.settings.sync.house; };
const sectionCodes = () => [...new Set(groups().map((g) => g.code).filter(Boolean))];
const isOwner = (g) => !!g && g.owner === me().id;
/* aggiorna il registro delle persone con quelle arrivate da una sezione o dalla vecchia riga "members" */
function mergePeople(list, rowTs) {
  let ch = false;
  (list || []).forEach((p) => {
    if (!p || !p.id) return;
    let cur = S.members.find((m) => m.id === p.id) || (p.legacy ? S.members.find((m) => m.id === p.legacy || m.legacy === p.legacy) : null) || (isLegacyId(p.id) ? S.members.find((m) => m.legacy === p.id) : null);
    if (!cur) { S.members.push({ id: p.id, name: p.name || '?', color: p.color || '#999', avatar: p.avatar, legacy: p.legacy }); ch = true; return; }
    if (cur.id !== p.id && !isLegacyId(p.id)) { if (cur.id === me().id) { S.members.push({ id: p.id, name: p.name || '?', color: p.color || '#999', avatar: p.avatar, legacy: p.legacy }); ch = true; return; } cur.legacy = cur.legacy || cur.id; cur.id = p.id; ch = true; }
    if (p.legacy && !cur.legacy && p.legacy !== cur.id) { cur.legacy = p.legacy; ch = true; } /* ho imparato l'id globale di una persona che conoscevo con l'id vecchio */
    const mine = cur.id === me().id; const newer = (rowTs || '') > (S.settings.membersUpdatedAt || '');
    if ((!mine && newer) || (mine && !S.settings.membersUpdatedAt)) { if (p.name && p.name !== cur.name) { cur.name = p.name; ch = true; } if (p.color && p.color !== cur.color) { cur.color = p.color; ch = true; } if (p.avatar !== undefined && JSON.stringify(p.avatar) !== JSON.stringify(cur.avatar)) { cur.avatar = p.avatar; ch = true; } }
  });
  if (ch) normAll();
  return ch;
}
/* fonde una riga "section" arrivata dal server: nome/creatore per data, membri uno per uno per data */
function mergeSection(d, rowTs) {
  if (!d || !d.id) return false; let ch = false;
  if (mergePeople(d.people, rowTs)) ch = true;
  let g = S.groups.find((x) => x.id === d.id);
  if (!g) { g = { id: d.id, name: d.name || 'Sezione', code: d.code, owner: pid(d.owner), members: {}, createdAt: d.createdAt || rowTs || nowISO(), updatedAt: '', deleted: false }; S.groups.push(g); ch = true; }
  if (!g.code && d.code) { g.code = d.code; ch = true; }
  if ((d.updatedAt || rowTs || '') > (g.updatedAt || '')) { if (d.name) g.name = d.name; if (d.owner) g.owner = pid(d.owner); g.deleted = !!d.deleted; g.updatedAt = d.updatedAt || rowTs; ch = true; }
  g.members = g.members || {};
  Object.entries(d.members || {}).forEach(([id0, m]) => { const id = pid(id0); const cur = g.members[id]; if (!cur || (m.updatedAt || '') > (cur.updatedAt || '')) { g.members[id] = { ...m }; ch = true; } });
  const mine = g.members[me().id]; if (mine && mine.leftAt && !g.left) { g.left = true; ch = true; if (mine.by && mine.by !== me().id) toast(T('Sei stato tolto dalla sezione «{0}»', g.name)); }
  return ch;
}
/* ---------- Passaggio alle sezioni con codice (stato v2) ---------- */
function migrateIdentity() {
  const u = auth.user(); if (!u) return false; const uidNow = u.id; let changed = false;
  if (S.settings.me !== uidNow) {
    const cur = S.members.find((m) => m.id === S.settings.me) || S.members[0];
    if (S.members.some((m) => m.id === uidNow)) S.settings.me = uidNow;
    else if (cur) { if (S.entries.length || S.settings.lastPull) cur.legacy = cur.legacy || cur.id; cur.id = uidNow; S.settings.me = uidNow; }
    else { S.members.unshift({ id: uidNow, name: 'Io', color: '#2C4A3B' }); S.settings.me = uidNow; }
    changed = true;
  }
  if (!S.settings.couple && !S.settings.sync.house && !S.entries.length && !S.settings.lastPull && S.members.length > 1) { S.members = S.members.filter((m) => m.id === uidNow); if (!me().name || me().name === 'Luca') me().name = (u.email || '').split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Io'; changed = true; } /* account singolo nuovo: solo io */
  /* account singolo: via i segnaposto di coppia (m1/m2) che non sono io e non compaiono in nessuna spesa, anche dalle sezioni */
  if (!S.settings.couple) { const used = new Set(); S.entries.filter((e) => !e.deleted).forEach((e) => { used.add(e.paidBy); if (e.to) used.add(e.to); Object.keys(e.owed || {}).forEach((k) => used.add(k)); });
    const drop = S.members.filter((m) => m.id !== uidNow && isLegacyId(m.id) && !used.has(m.id));
    if (drop.length) { S.members = S.members.filter((m) => !drop.includes(m)); drop.forEach((m) => S.groups.forEach((g) => { if (g.members && g.members[m.id]) { delete g.members[m.id]; g.updatedAt = nowISO(); S.settings.groupsUpdatedAt = g.updatedAt; } })); S.settings.membersUpdatedAt = nowISO(); changed = true; } }
  const map = pidMap();
  if (Object.keys(map).length) { const t = nowISO(); S.entries.forEach((e) => { if (normEntry(e, map)) { e.updatedAt = t; changed = true; } }); normAll(map); }
  if (changed) { if (S.entries.length || S.settings.membersUpdatedAt) S.settings.membersUpdatedAt = nowISO(); if (S.settings.push) S.settings.pushUpdatedAt = nowISO(); S.settings.lastPush = null; save(); }
  return changed;
}
function migrateSections() {
  let changed = false; const house = S.settings.sync.house; const legacyOwner = pid('m1'); const first = S.groups.find((g) => g.id === 'g1') || S.groups.find((g) => !g.deleted) || S.groups[0];
  S.groups.forEach((g) => {
    let ch = false;
    if (!g.code) { g.code = house ? (g === first ? house : legacyCode(house, g.id)) : newSectionCode(); ch = true; }
    if (!g.owner) { g.owner = S.members.some((m) => m.id === legacyOwner) ? legacyOwner : me().id; ch = true; }
    if (!g.members) { g.members = {}; const t = g.createdAt || nowISO(); (house ? S.members : [me()]).forEach((m) => { g.members[m.id] = { joinedAt: t, updatedAt: t }; }); ch = true; }
    if (ch) { g.updatedAt = nowISO(); changed = true; }
  });
  if (!house && first && first.code) { S.settings.sync.house = first.code; S.settings.lastPull = null; changed = true; }
  if (S.version !== 2) { S.version = 2; changed = true; }
  if (changed) { S.settings.groupsUpdatedAt = nowISO(); S.settings.lastPush = null; save(); }
  return changed;
}
/* ---------- Account singoli: solo l'account di Luca è "di coppia" (riconosciuto dall'impronta dell'email, non dall'email in chiaro) ---------- */
const COUPLE_HASHES = ['ecc6df58d7e59c137391c8ef87c233eb3735ab3a1dc1055b0deaaaf6bcb4925b']; /* impronte SHA-256 delle email dell'account di coppia: Luca; Martina quando arriva la sua */
async function coupleCheck() { const u = auth.user(); if (!u || !u.email || !(crypto.subtle && crypto.subtle.digest)) return false; try { const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(u.email.trim().toLowerCase())); return COUPLE_HASHES.includes([...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')); } catch (_) { return false; } }
const isCoupleAccount = () => !!S.settings.couple;
async function updateCoupleFlag() { const c = await coupleCheck(); if (S.settings.couple !== c) { S.settings.couple = c; S.settings.boardCouple = c; save(); return true; } return false; }
const hasOthers = () => S.members.some((m) => m.id !== me().id);
const otherName = () => (other().id ? other().name : T('chi condivide con te'));
/* ogni account ha il suo stato sul telefono: se entra un altro account, metto da parte lo stato di prima e carico il suo */
function switchStateFor(uidNow) {
  let own = S.settings.ownerUid || S.settings.onboardedFor || S.settings.tutorialDoneFor || null; /* stati vecchi: il proprietario è chi ha fatto la presentazione */
  /* un account appena creato parte SEMPRE da zero: se sul telefono c'è uno stato senza proprietario con dei dati, non è suo */
  const u = auth.user(); const fresh = u && u.created_at && (Date.now() - new Date(u.created_at).getTime()) < 30 * 60000;
  if (!own && fresh && (S.entries.length || S.settings.sync.house)) own = 'sconosciuto';
  if (own && own !== uidNow) {
    try { localStorage.setItem(KEY + ':' + own, JSON.stringify(S)); } catch (_) {}
    let raw = null; try { raw = localStorage.getItem(KEY + ':' + uidNow); } catch (_) {}
    S = raw ? load(raw) : defaultState(); window.__S = S; if (!S.settings.deviceId) S.settings.deviceId = 'd-' + uid();
  }
  if (S.settings.ownerUid !== uidNow) { S.settings.ownerUid = uidNow; save(); }
}
/* per risparmiare spazio: una sezione che ho creato, in cui non è mai entrato nessuno, senza spese, non principale, dopo 7 giorni sparisce da sola. Se c'è (o c'è stata) almeno un'altra persona non si tocca mai. */
function cleanupSections() {
  const cut = Date.now() - 7 * 86400000; let n = 0;
  groups().forEach((g) => {
    if (!isOwner(g) || !g.code || g.code === S.settings.sync.house) return;
    if (Object.keys(g.members || {}).some((id) => id !== me().id)) return;
    if (Object.values(g.requests || {}).some((r) => r.status === 'pending')) return;
    if (active().some((e) => e.group === g.id)) return;
    if (!g.createdAt || new Date(g.createdAt).getTime() > cut) return;
    deleteGroup(g.id); n++;
  });
  return n;
}
function afterAuth() { switchStateFor(auth.user().id); if (S.version !== 2) { try { if (!localStorage.getItem('pari:backup-v1')) localStorage.setItem('pari:backup-v1', localStorage.getItem(KEY) || ''); } catch (_) {} } /* copia dello stato prima del passaggio alle sezioni */ restoreHouseFromAccount(); const a = migrateIdentity(); const b = migrateSections(); rememberHouse(); return a || b; }


/* ---------- Accesso (Supabase Auth: email/password, Apple, Google) ----------
   L'accesso identifica la persona; le spese restano nella "casa" condivisa come prima. */
const AUTH_KEY = 'pari:auth';
const appUrl = () => location.origin + location.pathname;
const authMsg = (j) => { const m = (j && (j.msg || j.message || j.error_description || j.error)) || ''; const t = String(m).toLowerCase();
  if (t.includes('invalid login')) return 'Email o password sbagliate'; if (t.includes('already registered') || t.includes('already been registered')) return 'Esiste già un account con questa email: accedi'; if (t.includes('password should be')) return 'La password deve avere almeno 6 caratteri'; if (t.includes('email not confirmed')) return 'Conferma prima l\'email che ti abbiamo mandato'; if (t.includes('rate limit')) return 'Troppi tentativi: riprova tra un minuto'; if (t.includes('provider is not enabled') || t.includes('unsupported provider')) return 'Accesso non ancora attivo con questo servizio'; if (t.includes('invalid email') || t.includes('validate email')) return 'Controlla l\'email'; return m || 'Qualcosa è andato storto'; };
const auth = {
  s: null, recovery: false,
  load() { try { this.s = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch (_) { this.s = null; } },
  save() { try { if (this.s) localStorage.setItem(AUTH_KEY, JSON.stringify(this.s)); else localStorage.removeItem(AUTH_KEY); } catch (_) {} },
  user() { return this.s && this.s.user; },
  email() { const u = this.user(); return (u && u.email) || ''; },
  h(json = true) { const o = { apikey: SUPA_ANON }; if (json) o['Content-Type'] = 'application/json'; return o; },
  setSession(j) { if (j.expires_in && !j.expires_at) j.expires_at = Math.floor(Date.now() / 1000) + j.expires_in; this.s = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at, user: j.user || null }; this.save(); },
  async signUp(email, password, data) { const r = await fetch(SUPA_URL + '/auth/v1/signup', { method: 'POST', headers: this.h(), body: JSON.stringify({ email, password, data: data || {}, options: { emailRedirectTo: appUrl() } }) }); const j = await r.json(); if (!r.ok) { const raw = String((j && (j.msg || j.message || j.error_description || j.error)) || '').toLowerCase(); if (raw.includes('rate limit') || r.status === 429) throw new Error('Il server ha raggiunto il limite di email di conferma: riprova tra un po\'. Non dipende dai tuoi tentativi.'); throw new Error(authMsg(j)); } /* alla registrazione il limite è quello delle email di conferma di Supabase, non un blocco per tentativi */ if (j.access_token) { this.setSession(j); return 'ok'; } return 'confirm'; },
  async signIn(email, password) { const r = await fetch(SUPA_URL + '/auth/v1/token?grant_type=password', { method: 'POST', headers: this.h(), body: JSON.stringify({ email, password }) }); const j = await r.json(); if (!r.ok) throw new Error(authMsg(j)); this.setSession(j); },
  async signOut() { try { if (this.s) await fetch(SUPA_URL + '/auth/v1/logout', { method: 'POST', headers: { apikey: SUPA_ANON, Authorization: 'Bearer ' + this.s.access_token } }); } catch (_) {} this.s = null; this.save(); },
  async refreshIfNeeded() { if (!this.s || !this.s.refresh_token) return; if (Date.now() < ((this.s.expires_at || 0) * 1000) - 120000) return; try { const r = await fetch(SUPA_URL + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: this.h(), body: JSON.stringify({ refresh_token: this.s.refresh_token }) }); const j = await r.json(); if (r.ok && j.access_token) this.setSession(j); else if (r.status === 400 || r.status === 401) { this.s = null; this.save(); } } catch (_) {} },
  async recover(email) { const r = await fetch(SUPA_URL + '/auth/v1/recover?redirect_to=' + encodeURIComponent(appUrl()), { method: 'POST', headers: this.h(), body: JSON.stringify({ email }) }); if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(authMsg(j)); } },
  async updatePassword(password) { const r = await fetch(SUPA_URL + '/auth/v1/user', { method: 'PUT', headers: { ...this.h(), Authorization: 'Bearer ' + this.s.access_token }, body: JSON.stringify({ password }) }); const j = await r.json(); if (!r.ok) throw new Error(authMsg(j)); this.s.user = j; this.save(); },
  async updateMeta(data) { if (!this.s) return; try { const r = await fetch(SUPA_URL + '/auth/v1/user', { method: 'PUT', headers: { ...this.h(), Authorization: 'Bearer ' + this.s.access_token }, body: JSON.stringify({ data }) }); if (r.ok) { this.s.user = await r.json(); this.save(); } } catch (_) {} },
  async fetchUser() { if (!this.s) return; try { const r = await fetch(SUPA_URL + '/auth/v1/user', { headers: { apikey: SUPA_ANON, Authorization: 'Bearer ' + this.s.access_token } }); if (r.ok) { this.s.user = await r.json(); this.save(); } } catch (_) {} },
  oauth(provider) { location.href = SUPA_URL + '/auth/v1/authorize?provider=' + provider + '&redirect_to=' + encodeURIComponent(appUrl()); },
  /* ritorno da un link (OAuth, conferma email, recupero password): i dati stanno nel frammento dell'URL */
  async handleRedirect() {
    const h = location.hash || ''; if (!/access_token=|error=|error_description=/.test(h)) return false;
    const p = new URLSearchParams(h.replace(/^#\/?/, '').replace(/^\?/, ''));
    if (p.get('error') || p.get('error_description')) { setTimeout(() => toast(authMsg({ msg: p.get('error_description') || p.get('error') })), 600); history.replaceState(null, '', '#/accedi'); return false; }
    this.setSession({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: +p.get('expires_in') || 3600, expires_at: +p.get('expires_at') || undefined });
    await this.fetchUser();
    this.recovery = p.get('type') === 'recovery';
    history.replaceState(null, '', this.recovery ? '#/recupero' : '#/home'); return true;
  },
};
auth.load();

/* ---------- Un pensiero al giorno per Martina (solo sul suo telefono, alla prima apertura del giorno) ---------- */
const LOVE = [
  'Ricordati che ti amo.',
  'Buongiorno amore, oggi pensami un secondo in più.',
  'Sei la parte migliore delle mie giornate.',
  'Ogni spesa con te è un investimento felice.',
  'Ti amo più di ieri, meno di domani.',
  'Con te anche le bollette fanno meno paura.',
  'Sei casa mia, ovunque siamo.',
  'Oggi sorridi: c\'è uno che ti pensa.',
  'Ti scelgo ogni giorno, anche oggi.',
  'Il conto migliore è quello dei giorni con te.',
  'Sei la mia persona preferita.',
  'Ti amo anche quando dividiamo a metà.',
  'Grazie di esistere, amore mio.',
  'La cosa più bella della mia vita sei tu.',
  'Ogni giorno con te vale doppio.',
  'Sei il mio posto felice.',
  'Oggi ti amo forte forte.',
  'Con te tutto torna, anche i conti.',
  'Mi manchi già, e ti ho appena vista.',
  'Sei bellissima, anche di lunedì.',
  'Ti amo in tutte le lingue, ma soprattutto in silenzio.',
  'Sei la mia fortuna più grande.',
  'Il resto del mondo può aspettare: prima tu.',
  'Con te voglio spendere tutto il tempo che ho.',
  'Sei la mia spesa preferita: ne vale sempre la pena.',
  'Amore, oggi va tutto bene perché ci sei tu.',
  'Nessun saldo è in pari come il mio cuore con te.',
  'Un bacio in anticipo per tutta la giornata.',
  'Ti amo, e non è mai una cosa da poco.',
  'Siamo una squadra, la migliore.',
];
const LOVE_FORCE = { day: '2026-09-04', idx: 4 }; // frase imposta per un giorno preciso (ricompare anche se già vista)
function showDailyLove() {
  if ((me().legacy || S.settings.me) !== 'm2') return;
  const today = todayStr(); let st = {}; try { st = JSON.parse(localStorage.getItem('pari:love') || '{}'); } catch (_) {}
  const forced = LOVE_FORCE.day === today && st.forced !== today;
  if (st.day === today && !forced) return;
  let idx = Math.floor(Math.random() * LOVE.length); if (idx === st.last) idx = (idx + 1) % LOVE.length;
  if (forced) idx = LOVE_FORCE.idx;
  const el = document.createElement('div'); el.className = 'love'; el.setAttribute('role', 'dialog');
  el.innerHTML = `<div class="love-in"><div class="love-heart" aria-hidden="true">♥</div><div class="love-t">${esc(LOVE[idx])}</div><div class="love-s">Il tuo Lu</div></div>`;
  document.body.appendChild(el);
  // segno "visto" solo quando la frase è rimasta a schermo: se l'app si ricarica prima (aggiornamento), ricompare
  let done = false; const close = () => { if (done) return; done = true; try { localStorage.setItem('pari:love', JSON.stringify({ day: today, last: idx, forced: forced ? today : st.forced })); } catch (_) {} el.classList.add('out'); setTimeout(() => el.remove(), 800); };
  el.addEventListener('click', close); setTimeout(close, 5500);
}

/* ---------- Notifiche ---------- */
function notifText(e, actorName, balForMe) {
  const line = balForMe < 0 ? `Devi ancora: ${money(-balForMe)}` : balForMe > 0 ? `${actorName} ti deve ancora: ${money(balForMe)}` : 'Siete in pari';
  const title = e.kind === 'payment' ? `${actorName} ha registrato un pagamento` : `${actorName} ha aggiunto una spesa`;
  return { title: T(title), body: T(`${e.kind === 'payment' ? 'Pagamento' : e.desc}: ${money(e.amount)}`) + '\n' + T(line) };
}
async function showLocalNotification(title, body, url) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  try { const reg = await navigator.serviceWorker.ready; await reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'pari-' + Date.now(), data: { url: url || './#/home' } }); return true; } catch (e) { return false; }
}
/* avvisa localmente (app aperta) delle voci nuove arrivate dalla sincronizzazione e messe dall'altro */
function notifyIncoming(newEntries) {
  const mine = me().id; const bal = balances()[mine] || 0; const seen = new Set(S.settings.notified || []);
  const fresh = newEntries.filter((e) => !e.deleted && e.paidBy !== mine && !seen.has(e.id) && (Date.now() - new Date(e.createdAt || 0).getTime()) < 2 * 86400000);
  fresh.forEach((e) => seen.add(e.id)); S.settings.notified = [...seen].slice(-200);
  fresh.slice(-3).forEach((e) => { const t = notifText(e, member(e.paidBy).name, bal); showLocalNotification(t.title, t.body, './#/spesa/' + e.id).then((ok) => { if (!ok) toast(t.title + ' · ' + t.body.split('\n')[0]); }); });
}
/* chiede al server (funzione Supabase "notify") di avvisare l'altro telefono delle voci appena caricate */
async function notifyOthers(entryIds) {
  if (!entryIds.length || !sync.enabled()) return;
  const sconf = S.settings.sync; const byHouse = {};
  entryIds.forEach((id) => { const e = S.entries.find((x) => x.id === id); const h = codeOf(e && e.group); if (h) (byHouse[h] = byHouse[h] || []).push(id); });
  for (const [house, ids] of Object.entries(byHouse)) { try { await fetch(sconf.url + '/functions/v1/notify', { method: 'POST', headers: { apikey: sconf.key, Authorization: 'Bearer ' + sconf.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ house, entryIds: ids, actor: me().id }) }); } catch (e) { console.warn('notify', e); } }
}
async function enablePush() {
  if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) { toast(isIOS() && !isStandalone() ? 'Su iPhone le notifiche funzionano solo con l\'app sulla schermata Home' : 'Questo browser non supporta le notifiche'); return false; }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast('Permesso negato: abilitalo nelle Impostazioni di iOS'); return false; }
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToU8(VAPID_PUBLIC) });
    S.settings.push = { sub: sub.toJSON(), member: me().id, device: S.settings.deviceId, at: nowISO(), ua: navigator.userAgent.slice(0, 80) }; S.settings.pushUpdatedAt = nowISO(); save();
    if (sync.enabled()) await sync.run(true);
    return true;
  } catch (e) { console.warn('push', e); toast('Non riesco ad attivare le notifiche: ' + (e.message || e)); return false; }
}
async function disablePush() {
  try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch (e) {}
  S.settings.push = null; S.settings.pushUpdatedAt = nowISO(); save(); if (sync.enabled()) sync.run(true);
}

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
function groupBalance(gid) {
  const b = {}; S.members.forEach((m) => (b[m.id] = 0));
  active().filter((e) => e.group === gid).forEach((e) => { b[e.paidBy] = (b[e.paidBy] || 0) + e.amount; for (const [id, c] of Object.entries(e.owed || {})) b[id] = (b[id] || 0) - c; });
  return b;
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
/* saldo con ogni singola persona (positivo = mi deve), in tutto o in una sezione */
function pairBalances(gid) {
  const my = me().id; const net = {};
  active().filter((e) => !gid || e.group === gid).forEach((e) => { const p = e.paidBy; Object.entries(e.owed || {}).forEach(([q, c]) => { if (q === p || !c) return; if (p === my) net[q] = (net[q] || 0) + c; else if (q === my) net[p] = (net[p] || 0) - c; }); });
  return net;
}
const listNames = (arr) => arr.length <= 1 ? (arr[0] || '') : arr.slice(0, -1).join(', ') + ' e ' + arr[arr.length - 1];
/* pagamento suggerito: con la persona con cui il conto è più aperto */
function paymentDefault() {
  const net = pairBalances(); const top = Object.entries(net).filter(([, x]) => Math.abs(x) >= 1).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
  if (!top) return null; const [id, x] = top; return x < 0 ? { paidBy: me().id, to: id, amount: moneyPlain(-x) } : { paidBy: id, to: me().id, amount: moneyPlain(x) };
}
function balanceSentence(bal, gid) {
  const a = me(); const v = bal[a.id] || 0;
  if (!hasOthers()) return { even: true, text: 'Nessun conto aperto', amount: 0, sign: '' }; const net = pairBalances(gid); const others = Object.entries(net).filter(([, x]) => Math.abs(x) >= 1);
  if (Math.abs(v) < 1 && !others.length) return { even: true, text: 'Siete in pari', amount: 0, sign: '' };
  if (others.length === 1) { const b = member(others[0][0]); const x = others[0][1]; if (x > 0) return { even: false, text: `${b.name} deve a ${a.name}`, amount: x, sign: '+', who: b.id }; return { even: false, text: `${a.name} deve a ${b.name}`, amount: -x, sign: '−', who: b.id }; }
  if (Math.abs(v) < 1) return { even: true, text: 'In pari nel totale', amount: 0, sign: '' };
  return v > 0 ? { even: false, text: T('Ti devono {0} in totale', money(v)), amount: v, sign: '+' } : { even: false, text: T('Devi {0} in totale', money(-v)), amount: -v, sign: '−' };
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
let prevHash = '', curHash = location.hash || '#/home', viaTab = false;
tabbar.addEventListener('click', () => { viaTab = true; });
/* il + della barra: il pallino verde si gonfia dal basso fino a coprire lo schermo, poi si scopre la pagina Nuova spesa */
tabbar.addEventListener('click', (e) => {
  const fab = e.target.closest('.fab'); if (!fab) return;
  if (currentRoute && currentRoute.name === 'nuova') { e.preventDefault(); return; }
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  e.preventDefault();
  const r = fab.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const d = Math.ceil(2 * Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy))) + 8;
  const ov = document.createElement('div'); ov.className = 'plus-reveal'; ov.style.cssText = `left:${cx - r.width / 2}px;top:${cy - r.height / 2}px;width:${r.width}px;height:${r.height}px;--s:${(d / r.width).toFixed(2)}`;
  document.body.appendChild(ov); document.body.classList.add('plus-revealing'); fab.classList.add('pressed');
  requestAnimationFrame(() => requestAnimationFrame(() => ov.classList.add('grow')));
  setTimeout(() => { viaTab = true; location.hash = '#/nuova'; setTimeout(() => { ov.classList.add('fade'); fab.classList.remove('pressed'); setTimeout(() => { ov.remove(); document.body.classList.remove('plus-revealing'); }, 340); }, 80); }, 400);
});
const tabOf = (h) => { const n = (h || '').slice(2).split(/[/?]/)[0] || 'home'; return { spesa: 'spese', modifica: 'spese', attivita: 'spese', statistiche: 'home', bilanci: 'home', nuova: 'home', traguardi: 'home', missioni: 'home' }[n] || n; };
function route() {
  prevHash = curHash; curHash = location.hash || '#/home';
  const hash = location.hash || '#/home';
  const [path, qs] = hash.slice(2).split('?');
  const parts = path.split('/'); const q = Object.fromEntries(new URLSearchParams(qs || ''));
  let r = { name: parts[0] || 'home', id: parts[1] || '', sub: parts[1] || '', q };
  if (r.name === 'statistiche') statsGroup = q.sezione !== undefined ? q.sezione : '';
  if (r.name === 'spese' && q.sezione !== undefined) { speseFilter.group = q.sezione; speseFilter.q = ''; speseFilter.cat = ''; }
  if (r.name === 'join') { const code = decodeURIComponent(r.id || ''); if (auth.user()) { applyJoin(code); history.replaceState(null, '', onboardingDone() ? '#/home' : '#/benvenuto'); r = { name: onboardingDone() ? 'home' : 'benvenuto', id: '', sub: '', q: {} }; } else { try { localStorage.setItem(JOIN_KEY, code); } catch (_) {} history.replaceState(null, '', '#/accedi'); r = { name: 'accedi', id: '', sub: '', q: {} }; } }
  // arrivati da un link (non dalla barra in basso) e da un'altra area: mostro il tasto indietro
  const fromLink = !viaTab && prevHash && prevHash !== curHash && !/^#\/(nuova|modifica)/.test(prevHash);
  r.back = fromLink && tabOf(prevHash) !== tabOf(curHash) ? prevHash : null; viaTab = false;
  render(r, true);
}
window.addEventListener('hashchange', route);
function go(h) { location.hash = h; }
function back(fallback) { const ok = prevHash && prevHash !== curHash && !/^#\/(nuova|modifica)/.test(prevHash); go(ok ? prevHash : fallback); }

let currentRoute = null;
function render(r, toTop) {
  // toTop solo quando cambia pagina: i ridisegni per un cambio di stato (Pagato/Quota, mese, tab) tengono la posizione
  const keep = toTop ? 0 : window.scrollY;
  r = r || currentRoute || { name: 'home', id: '', q: {} }; currentRoute = r;
  const publicPages = ['accedi', 'registrati', 'recupero', 'legale', 'conferma'];
  if (!auth.user() && !publicPages.includes(r.name)) { r = { name: 'accedi', id: '', sub: '', q: {}, back: null }; currentRoute = r; }
  const pages = { home: pageHome, spese: pageSpese, sezione: pageSezione, bilanci: pageBilanci, profilo: pageProfilo, nuova: pageForm, modifica: pageForm, spesa: pageDetail, statistiche: pageStats, attivita: pageActivity, traguardi: pageMissioni, missioni: pageMissioni, budget: pageBudget, benvenuto: pageWelcome, accedi: pageLogin, registrati: pageRegister, recupero: pageRecovery, legale: pageLegal, conferma: pageConfirm, fatto: pageDone };
  const fn = pages[r.name] || pageHome;
  const onb = ['benvenuto', 'accedi', 'registrati', 'recupero', 'conferma', 'fatto'].includes(r.name) || (r.name === 'legale' && !auth.user());
  document.body.classList.toggle('fixed-screen', ['accedi', 'registrati', 'recupero', 'conferma', 'benvenuto', 'fatto'].includes(r.name));
  tabbar.classList.toggle('hide', onb); view.classList.toggle('no-tabbar', onb);
  const tabName = r.name === 'profilo' ? 'profilo' : r.name === 'statistiche' || r.name === 'bilanci' ? 'home' : r.name;
  $$('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tabName));
  view.innerHTML = fn(r); translateDom(view);
  window.scrollTo(0, keep);
  bind(r); initSwipes();
  if (typeof TOUR !== 'undefined' && TOUR && TOUR.pending != null) tourApply(); /* la card del tour cambia nello stesso istante della pagina */
  const reveal = () => { $$('.chart').forEach((c) => c.classList.add('in')); $$('[data-w]').forEach((el) => (el.style.width = el.dataset.w)); };
  // finita l'animazione d'ingresso, tolgo il transform così la barra del titolo può restare fissa in alto
  $$('.page').forEach((pg) => pg.addEventListener('animationend', (e) => { if (e.target === pg) pg.classList.add('settled'); }));
  requestAnimationFrame(() => requestAnimationFrame(reveal)); setTimeout(reveal, 80);
}

/* ---------- Componenti condivisi ---------- */
const ph = (label, cls = '') => `<span class="ph ${cls}">${esc(label)}</span>`;
const imgKey = (m) => (m.id === 'm1' ? 'luca' : m.id === 'm2' ? 'martina' : '');
const avatar = (m, lg = false) => (m.avatar && m.avatar.img) ? `<img class="avatar${lg ? ' lg' : ''}" src="img/${esc(m.avatar.img)}" alt="" title="${esc(m.name)}">` : imgKey(m) ? `<img class="avatar${lg ? ' lg' : ''}" src="img/${imgKey(m)}-avatar.png" alt="" title="${esc(m.name)}">` : `<span class="avatar-col${lg ? ' lg' : ''}" style="--bg:${(m.avatar || {}).bg || '#2C4A3B'};--fg:${(m.avatar || {}).fg || '#F8F4EE'}" title="${esc(m.name)}">${icon('i-user')}</span>`;
const couple = (cls = '') => `<div class="couple ${cls}" aria-hidden="true"><img src="img/luca.png" alt=""><img src="img/martina.png" alt=""></div>`;
/* Scena in base al saldo: Luca deve → portafoglio vuoto; Martina deve → lei gli passa la banconota; pari → i due che si guardano */
const coupleScene = (cls = '') => { const v = balances()[S.members[0].id] || 0; if (Math.abs(v) < 1) return couple(cls); return `<div class="couple scene ${cls}" aria-hidden="true"><img src="img/${v < 0 ? 'luca-deve' : 'martina-deve'}.png" alt=""></div>`; };
function entryRow(e, i) {
  const c = catOf(e.cat); const payer = member(e.paidBy); const isPay = e.kind === 'payment';
  const to = isPay ? member(Object.keys(e.owed || {})[0]) : null;
  const mine = myShare(e);
  return `<div class="swipe" data-id="${e.id}" style="--i:${i}"><a class="row${isPay ? ' payment' : ''}" href="#/spesa/${e.id}">
    <span class="cat-ic${isPay ? ' pay' : ''}">${icon(isPay ? 'c-pagamento' : c.icon)}</span>
    <span class="main"><span class="title">${esc(isPay ? `${payer.name} ha pagato ${to ? to.name : ''}` : e.desc)}</span><span class="sub">${esc(relDay(e.date))}${isPay ? '' : ' · ' + esc(payer.id === me().id ? 'hai pagato tu' : payer.name + ' ha pagato')}${e.recurringOf || e.recurring ? ' · ricorrente' : ''}${groups().length > 1 ? ' · ' + esc(groupName(e)) : ''}</span></span>
    <span class="right"><span class="money ${mine.cls}">${mine.big}</span><span class="by muted">${mine.small}</span></span>
  </a><button type="button" class="swipe-edit" aria-label="Modifica">${icon('i-edit')}<span>Modifica</span></button><button type="button" class="swipe-del" aria-label="Elimina">${icon('i-trash')}<span>Elimina</span></button></div>`;
}
/* La mia parte di una voce: quanto ricevo (ho pagato io) o quanto devo (ha pagato l'altro) */
function myShare(e) {
  const my = me().id; const owedByMe = (e.owed || {})[my] || 0;
  if (e.kind === 'payment') return { big: money(e.amount), cls: '', small: e.paidBy === my ? 'hai pagato tu' : 'ti ha pagato', label: '' };
  if (e.paidBy === my) { const v = e.amount - owedByMe; return { big: '+ ' + money(v), cls: 'green', small: 'tot. ' + money(e.amount), label: 'Ricevi ' + money(v) }; }
  if (owedByMe > 0) return { big: '− ' + money(owedByMe), cls: 'red', small: 'tot. ' + money(e.amount), label: 'Devi ' + money(owedByMe) };
  return { big: money(e.amount), cls: 'muted', small: 'non ti riguarda', label: '' };
}
function groupRow(g, i) {
  const es = active().filter((e) => e.group === g.id); const tot = es.filter((e) => e.kind === 'expense').reduce((a, e) => a + e.amount, 0);
  const sg = balanceSentence(groupBalance(g.id), g.id); const oth = sectionOthers(g);
  return `<a class="row" href="#/spese?sezione=${g.id}" style="--i:${i}"><span class="cat-ic">${icon('i-list')}</span><span class="main"><span class="title">${esc(g.name)}</span><span class="sub">${es.length} ${es.length === 1 ? 'voce' : 'voci'} · tot. ${money(tot)}</span></span><span class="right"><span class="money ${sg.even ? 'muted' : sg.sign === '+' ? 'green' : 'red'}">${sg.even ? 'in pari' : sg.sign + ' ' + money(sg.amount)}</span><span class="by muted">${sg.even ? '' : sg.who ? esc(sg.sign === '+' ? 'ti deve' : 'devi a ' + member(sg.who).name) : esc(sg.sign === '+' ? 'ti devono' : 'devi in totale')}</span></span></a>`;
}
function emptyBox(t, d, withImg) { return `<div class="empty">${withImg ? '<img class="empty-img" src="img/nessuna-spesa.png" alt="">' : ''}<div class="t">${esc(t)}</div><div class="small">${esc(d)}</div></div>`; }
/* Spese vere riportate da Splitwise (screenshot del 4/9/2026), caricate una volta sola su ogni telefono.
   Gli id sono fissi così i due telefoni creano le stesse voci e la sincronizzazione non le raddoppia. */
const SPLITWISE_2026_09 = [
  ['sw-20260904-spesa-1024', '2026-09-04', 'Spesa', 1024, 'spesa', 'm1', { m1: 512, m2: 512 }],
  ['sw-20260904-decathlon', '2026-09-04', 'Decathlon', 8094, 'shopping', 'm1', { m1: 4047, m2: 4047 }],
  ['sw-20260904-spesa-2430', '2026-09-04', 'Spesa', 2430, 'spesa', 'm1', { m1: 1215, m2: 1215 }],
  ['sw-20260831-spesa-2175', '2026-08-31', 'Spesa', 2175, 'spesa', 'm2', { m1: 1087, m2: 1088 }],
  ['sw-20260831-spesa-1504', '2026-08-31', 'Spesa', 1504, 'spesa', 'm2', { m1: 752, m2: 752 }],
  ['sw-20260831-spesa-4544', '2026-08-31', 'Spesa', 4544, 'spesa', 'm2', { m1: 2272, m2: 2272 }],
  ['sw-20260831-cabina-sardegna', '2026-08-31', 'Cabina sardegna', 13500, 'viaggi', 'm2', { m1: 6750, m2: 6750 }],
  ['sw-20260830-casa-sardegna', '2026-08-30', 'Casa sardegna', 60888, 'viaggi', 'm2', { m1: 30444, m2: 30444 }],
  ['sw-20260830-condominio-6', '2026-08-30', 'Sesta rata spese condominiali', 18380, 'casa', 'm2', { m1: 9190, m2: 9190 }],
];
function importSplitwiseOnce() {
  return; /* import fatto il 4/9/2026 sui due telefoni: i dati sono sul server; un telefono nuovo non deve caricarli */
  if (S.settings.splitwiseImported) return;
  const t = nowISO(); let changed = false;
  S.entries.forEach((e) => { if (e.demo && !e.deleted) { e.deleted = true; e.updatedAt = t; changed = true; } });
  SPLITWISE_2026_09.forEach(([id, date, desc, amount, cat, paidBy, owed]) => {
    if (S.entries.some((e) => e.id === id)) return;
    S.entries.push({ id, kind: 'expense', desc, amount, date, cat, paidBy, splitMethod: 'equal', splitInput: {}, owed, notes: '', group: 'g1', createdAt: t, updatedAt: t, deleted: false }); changed = true;
  });
  S.settings.splitwiseImported = true; save(); if (changed) sync.schedule();
}
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
    <div class="head left"><div class="greet">Ciao ${esc(a.name)}! <span aria-hidden="true">👋</span></div><a class="icon-btn trophy-btn${missionsNew() ? ' has-new' : ''}" href="#/missioni" aria-label="Missioni settimanali" data-trophy>${icon('i-target')}</a></div>
    <section class="card hero${sent.even ? ' even' : sent.sign === '+' ? ' owed' : ' owe'}">
      <div class="k">Saldo totale</div>
      <div class="amt">${sent.even ? money(0) : sent.sign + ' ' + money(sent.amount)}</div>
      <div class="s">${esc(sent.text)}</div>
      ${isCoupleAccount() ? coupleScene('hero-couple') : ''}
    </section>
    <div class="home-actions">${sent.even ? `<a class="ha main" href="#/statistiche">${icon('i-chart')}<span>Statistiche</span></a>` : `<button type="button" class="ha main" data-settle-all>${icon('i-balance')}<span>Metti in pari</span></button>`}<a class="ha" href="#/bilanci">${icon('i-scale')}<span>Dettaglio saldi</span></a></div>
    ${(() => { const items = []; groups().filter(isOwner).forEach((g) => Object.values(g.requests || {}).filter((x) => x.status === 'pending' && x.id !== me().id).forEach((x) => items.push([g, x]))); if (!items.length) return ''; return `<h2 class="sec-title">Richieste di ingresso</h2><section class="card req-card">${items.map(([g, x]) => `<div class="req-row">${avatar({ name: x.name, color: x.color, avatar: x.avatar })}<div class="req-t"><b data-no-i18n>${esc(x.name)}</b><span>${esc(T('vuole entrare in «{0}»', g.name))}</span></div><button type="button" class="btn sm ghost" data-refuse="${g.id}:${esc(x.id)}">Rifiuta</button><button type="button" class="btn sm" data-accept="${g.id}:${esc(x.id)}">Accetta</button></div>`).join('')}</section>`; })()}
    <div class="link-row"><h2 class="sec-title">Sezioni</h2><a href="#/profilo/sezioni">Gestisci ${icon('i-right')}</a></div>
    <section class="card list-card"><div class="list stagger">${groups().map((g, i) => groupRow(g, i)).join('')}<button type="button" class="row add-row" data-new-section style="--i:${groups().length}"><span class="cat-ic plus">${icon('i-plus')}</span><span class="main"><span class="title">Nuova sezione</span><span class="sub">Con un codice tutto suo, da condividere con chi vuoi</span></span><span class="right">${icon('i-right', 'ic chev')}</span></button></div></section>
    <section class="card join-card"><div class="lbl">Entra in una sezione</div><div class="join-row"><input class="input" id="home-code" type="text" placeholder="Codice della sezione" autocapitalize="characters" autocomplete="off" spellcheck="false" enterkeyhint="send"><button type="button" class="btn sm" id="home-join">Chiedi</button></div><div class="hint">Chi ha creato la sezione riceve la richiesta e può accettarla o rifiutarla.</div>${(S.settings.pendingJoins || []).length ? `<div class="pend-list">${S.settings.pendingJoins.map((p) => `<div class="pend-row"><span class="spin small"></span><span class="pend-t"><b data-no-i18n>${esc(p.name)}</b><span>${esc(p.owner ? T('in attesa di {0}', p.owner) : T('In attesa'))}</span></span><button type="button" class="btn sm ghost" data-cancel-join="${esc(p.code)}">Annulla</button></div>`).join('')}</div>` : ''}</section>
    <div class="link-row"><h2 class="sec-title">Ultime spese</h2><a href="#/spese">Vedi tutte ${icon('i-right')}</a></div>
    <section class="card list-card"><div class="list stagger">${recent.length ? recent.map(entryRow).join('') : emptyBox('Nessuna spesa ancora', 'Aggiungi la prima con il tasto qui sotto.', true)}</div></section>
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
      ${homeBudgetLine(m)}
    </section>
    ${installBanner()}
  </div>`;
}

/* ---------- SPESE ---------- */
let speseFilter = { q: '', cat: '', group: '' };
let statsGroup = '';
function pageSpese(r) {
  return `<div class="page">
    <div class="head left${r.back ? ' with-back' : ''}">${r.back ? `<button class="icon-btn" data-back="${esc(r.back)}" aria-label="Indietro">${icon('i-back')}</button>` : ''}<div class="title">${speseFilter.group && groups().find((g) => g.id === speseFilter.group) ? esc(groups().find((g) => g.id === speseFilter.group).name) : 'Spese'}</div>${speseFilter.group && groups().find((g) => g.id === speseFilter.group) ? `<button type="button" class="icon-btn" data-group-menu="${esc(speseFilter.group)}" aria-label="Gestisci la sezione">${icon('i-edit')}</button>` : `<a class="icon-btn" href="#/statistiche" aria-label="Statistiche">${icon('i-chart')}</a>`}</div>
    ${speseFilter.group && groups().find((g) => g.id === speseFilter.group) ? (() => { const gsel = groups().find((g) => g.id === speseFilter.group); const oth = sectionOthers(gsel); return `<div class="shared-with">${oth.length ? oth.slice(0, 3).map((m) => avatar(m)).join('') + '<span>' + esc(T('Condivisa con {0}', listNames(oth.map((m) => m.name)))) + '</span>' : avatar(me()) + '<span>' + esc(T('Solo tu')) + '</span>'}</div>`; })() : ''}
    <label class="search">${icon('i-search')}<input id="q" type="search" placeholder="Cerca una spesa…" value="${esc(speseFilter.q)}" autocomplete="off"></label>
    ${groups().length ? `<div class="chips" id="group-chips"><button class="chip${!speseFilter.group ? ' on' : ''}" data-group="">Tutte le sezioni</button>${groups().map((g) => `<button class="chip${speseFilter.group === g.id ? ' on' : ''}" data-group="${g.id}">${esc(g.name)}</button>`).join('')}</div>` : ''}
    <div class="chips" id="chips"><button class="chip${!speseFilter.cat ? ' on' : ''}" data-cat="">Tutte</button>${CATS.map((c) => `<button class="chip${speseFilter.cat === c.id ? ' on' : ''}" data-cat="${c.id}">${icon(c.icon)}${esc(c.name)}</button>`).join('')}</div>
    <div id="spese-list">${speseList()}</div>
  </div>`;
}
function speseList() {
  const q = speseFilter.q.trim().toLowerCase();
  let es = active().filter((e) => (!speseFilter.cat || e.cat === speseFilter.cat) && (!speseFilter.group || e.group === speseFilter.group) && (!q || (e.desc || '').toLowerCase().includes(q) || (e.notes || '').toLowerCase().includes(q) || moneyPlain(e.amount).includes(q)));
  es.sort((x, y) => (y.date + y.createdAt).localeCompare(x.date + x.createdAt));
  const filtered = q || speseFilter.cat || speseFilter.group;
  if (!es.length) return `<section class="card">${emptyBox(filtered ? 'Nessun risultato' : 'Nessuna spesa ancora', filtered ? 'Prova con un\'altra parola, categoria o sezione.' : 'Le spese che aggiungete compariranno qui, mese per mese.', !filtered)}</section>`;
  const groups = []; es.forEach((e) => { const k = ym(e.date); let g = groups.find((x) => x.k === k); if (!g) { g = { k, items: [], total: 0 }; groups.push(g); } g.items.push(e); if (e.kind === 'expense') g.total += e.amount; });
  return groups.map((g) => `<div class="month-head"><span class="t">${esc(monthName(g.k))}</span><span class="money">${money(g.total)}</span></div><section class="card list-card"><div class="list stagger">${g.items.map(entryRow).join('')}</div></section>`).join('');
}

/* ---------- BILANCI ---------- */
function pageBilanci(r) {
  const tab = S.ui.balTab; const bal = balances(); const sent = balanceSentence(bal); const a = me(), b = other();
    let body;
  if (tab === 0) {
    body = `<section class="card saldo${sent.even ? ' even' : sent.sign === '+' ? ' owed' : ' owe'}"><div><div class="k">Saldo attuale</div><div class="amt">${sent.even ? money(0) : sent.sign + ' ' + money(sent.amount)}</div><div class="s">${esc(sent.text)}</div></div>${isCoupleAccount() ? coupleScene('saldo-couple') : ''}</section>
    <h2 class="sec-title section">Dettaglio</h2>
    <section class="card"><div class="dlist">
      ${(() => { const net = pairBalances(); const ids = [...new Set([...groups().flatMap((g) => sectionMembers(g)), ...Object.keys(net)])].filter((id) => id !== a.id && S.members.some((m) => m.id === id)); if (!ids.length) return `<div><span class="t">${esc(T('Nessuna spesa condivisa'))}</span><span class="money">${money(0)}</span><span></span></div>`;
        return ids.map((id) => { const p = member(id); const x = net[id] || 0; if (x > 0) return `<button type="button" data-settle="${id}:${a.id}"><span class="t">${esc(p.name)} deve a ${esc(a.name)}</span><span class="money green">${money(x)}</span>${icon('i-right')}</button>`; if (x < 0) return `<button type="button" data-settle="${a.id}:${id}"><span class="t">${esc(a.name)} deve a ${esc(p.name)}</span><span class="money red">${money(-x)}</span>${icon('i-right')}</button>`; return `<div><span class="t">${esc(T('In pari con {0}', p.name))}</span><span class="money">${money(0)}</span>${icon('i-check')}</div>`; }).join(''); })()}
    </div></section>
    ${hasOthers() ? `<div class="section"><a class="btn" href="#/nuova?tipo=pagamento">Registra pagamento</a></div>` : ''}
    ${groups().length ? `<h2 class="sec-title section">Per sezione</h2><section class="card"><div class="dlist">${groups().map((g) => { const bg = groupBalance(g.id); const sg = balanceSentence(bg, g.id); return `<a href="#/spese?sezione=${g.id}" style="display:grid;grid-template-columns:1fr auto 18px;align-items:center;gap:10px;padding:14px 0;border-top:1px solid var(--line);font-weight:600;font-size:14.5px"><span class="t">${esc(g.name)}<span class="muted small" style="margin-left:6px">${sg.even ? 'in pari' : esc(sg.text)}</span></span><span class="money ${sg.even ? '' : sg.sign === '+' ? 'green' : 'red'}">${sg.even ? money(0) : sg.sign + ' ' + money(sg.amount)}</span>${icon('i-right')}</a>`; }).join('')}</div></section>` : ''}
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
    <div class="head left with-back"><button class="icon-btn" data-back="${esc(r.back || '#/home')}" aria-label="Indietro">${icon('i-back')}</button><div class="title">Bilanci</div><a class="icon-btn" href="#/statistiche" aria-label="Statistiche">${icon('i-chart')}</a></div>
    ${segHTML([{ v: '0', t: 'Totali' }, { v: '1', t: 'Per periodo' }], tab, '', 'balTab')}
    <div class="section">${body}</div>
  </div>`;
}

/* ---------- STATISTICHE ---------- */
function pageStats(r) {
  r = r || currentRoute || {};
  const range = S.ui.statsRange; const m = S.ui.month; const sg = statsGroup && groups().find((g) => g.id === statsGroup); const es = rangeEntries(range, m).filter((e) => !sg || e.group === sg.id); const st = aggregate(es);
  const a = me(), b = other();
  const monthsInRange = range === 'mese' ? 1 : range === '3mesi' ? 3 : 12;
  const [y, mm] = m.split('-').map(Number);
  const daysInRange = range === 'mese' ? new Date(y, mm, 0).getDate() : range === '3mesi' ? 91 : 365;
  const weekly = Math.round((st.total / daysInRange) * 7);
  const cats = Object.entries(st.byCat).sort((x, y2) => y2[1] - x[1]);
  const label = range === 'mese' ? monthName(m) : range === '3mesi' ? `${monthShort(shiftYM(m, -2))} – ${monthName(m)}` : 'Anno ' + m.slice(0, 4);
  const maxP = Math.max(st.paid[a.id], st.paid[b.id], 1);
  return `<div class="page slide">
    <div class="head"><button class="icon-btn" data-back="${esc(r.back || '#/home')}" aria-label="Indietro">${icon('i-back')}</button><div class="title">${sg ? esc(sg.name) : 'Statistiche'}</div><span></span></div>
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
      <div class="date">${esc(dateLong(e.date))}${!isPay && e.cat ? ' · <span>' + esc(c.name) + '</span>' : ''}${e.recurringOf || e.recurring ? ' · <span>si ripete ogni mese</span>' : ''}${groups().length > 1 || !groupOf(e) ? ' · ' + esc(groupName(e)) : ''}</div>
      <div class="amt">${money(e.amount)}</div>
      <div class="by ${payer.id === me().id ? 'green' : 'orange'}">${isPay ? 'Saldo aggiornato' : 'Pagato da ' + esc(payer.name)}</div>
      ${(() => { const m = myShare(e); return m.label ? `<div style="margin-top:10px"><span class="pill ${m.cls === 'green' ? 'green' : 'red'}">${esc(m.label)}</span></div>` : ''; })()}
    </div>
    ${isPay ? '' : `<h2 class="sec-title section">Diviso tra</h2>
    <section class="card"><div class="people">${parts.map(([id, v]) => `<div>${avatar(member(id))}<span>${esc(member(id).name)}</span><span class="money">${money(v)}</span></div>`).join('')}</div></section>`}
    ${e.notes ? `<h2 class="sec-title section">Note</h2><div class="notes">${esc(e.notes)}</div>` : ''}
    <div class="section btn-row"><a class="btn soft" href="#/modifica/${e.id}">Modifica</a><button class="btn danger" data-del="${e.id}">Elimina</button></div>
    <div class="section small muted" style="text-align:center">Aggiunta ${esc(new Date(e.createdAt).toLocaleString(LOC(), { dateStyle: 'medium', timeStyle: 'short' }))}${e.updatedAt !== e.createdAt ? ' · modificata ' + esc(new Date(e.updatedAt).toLocaleString(LOC(), { dateStyle: 'medium', timeStyle: 'short' })) : ''}</div>
  </div>`;
}

/* ---------- FORM nuova / modifica ---------- */
let F = null; // stato del form
function pageForm(r) {
  const editing = r.name === 'modifica' ? S.entries.find((x) => x.id === r.id) : null;
  if (!editing && r.q.tipo === 'pagamento' && !hasOthers()) { setTimeout(() => { toast('Nessuno con cui mettersi in pari'); go('#/home'); }, 0); return '<div class="page"></div>'; }
  if (!F || F.routeKey !== location.hash) {
    F = editing ? { routeKey: location.hash, id: editing.id, kind: editing.kind, group: editing.group || null, desc: editing.desc || '', amount: moneyPlain(editing.amount), date: editing.date, cat: editing.cat || '', paidBy: editing.paidBy, splitMethod: editing.splitMethod || 'equal', splitInput: { ...(editing.splitInput || {}) }, notes: editing.notes || '', recurring: editing.recurring === 'monthly', to: Object.keys(editing.owed || {})[0] }
      : { routeKey: location.hash, id: null, kind: r.q.tipo === 'pagamento' ? 'payment' : 'expense', desc: '', amount: '', date: todayStr(), cat: '', paidBy: me().id, splitMethod: 'equal', splitInput: {}, notes: '', recurring: false, to: other().id, group: (groups().find((g) => g.id === S.settings.lastGroup) || groups()[0] || {}).id || null };
    if (editing && F.group === undefined) F.group = editing.group || null;
    if (F.kind === 'expense') { const sp = S.settings.split; if (!editing && sp && sp.mode === 'custom' && sp.pct) { F.splitMethod = 'percent'; F.splitInput = { ...sp.pct }; } else F.splitMethod = 'equal'; }
    if (!editing && F.kind === 'payment') { const pd = paymentDefault(); if (pd) { F.paidBy = pd.paidBy; F.to = pd.to; F.amount = pd.amount; } }
  }
  const isPay = F.kind === 'payment'; const a = me(), b = other();
  const optCard = (m, sel, key) => `<button type="button" class="opt${sel ? ' on' : ''}" data-pick="${key}" data-id="${m.id}">${avatar(m)}<span><span class="t">${esc(m.name)}</span></span>${icon('i-right')}</button>`;
  const payerOf = (id) => member(id);
  return `<div class="page up">
    <div class="head"><button class="icon-btn" data-back="${editing ? '#/spesa/' + editing.id : '#/home'}" aria-label="Annulla">${icon('i-x')}</button><div class="title">${editing ? (isPay ? 'Modifica pagamento' : 'Modifica spesa') : (isPay ? 'Nuovo pagamento' : 'Nuova spesa')}</div><button class="icon-btn green" id="save-top" aria-label="Salva">${icon('i-check')}</button></div>
    <form id="f" novalidate>
      ${isPay ? '' : `<div class="scan-card"><img class="scan-mascot" src="img/scansione.webp" alt=""><div class="scan-txt"><b>Leggi lo scontrino</b><span>Foto, screenshot o notifica di pagamento: compilo io i campi.</span><div class="scan-acts"><label class="scan-pill main">${icon('i-camera')}<span>Fotografa</span><input type="file" accept="image/*" capture="environment" id="scan-cam" hidden></label><label class="scan-pill">${icon('i-image')}<span>Galleria</span><input type="file" accept="image/*" id="scan-gal" hidden></label></div></div></div>`}
      ${isPay ? '' : `<div class="field"><label for="desc">Descrizione</label><input id="desc" type="text" placeholder="Cena pizza" value="${esc(F.desc)}" autocomplete="off" enterkeyhint="next"></div>`}
      <div class="field"><label for="amount">Importo</label><div class="money-input"><span class="cur">${esc(curSymbol())}</span><input id="amount" type="text" inputmode="decimal" placeholder="${esc(moneyPlain(0))}" value="${esc(F.amount)}" autocomplete="off"></div><div class="hint err" id="amount-err" hidden>Inserisci un importo valido.</div></div>
      ${isPay
        ? `<div class="field"><div class="lbl">Pagamento</div><button type="button" class="pay-dir" data-payer-pick>${avatar(payerOf(F.paidBy))}<span class="txt"><span class="t">${esc(payerOf(F.paidBy).name)} dà a ${esc(payerOf(F.to).name)}</span><span class="d">${F.amount ? '€ ' + esc(F.amount) : 'la somma qui sopra'} · il saldo fra voi si aggiorna</span></span>${avatar(payerOf(F.to))}</button></div>`
        : `<div class="field"><button type="button" class="pay-dir soft" data-payer-pick>${avatar(payerOf(F.paidBy))}<span class="txt"><span class="t">${F.paidBy === me().id ? 'Paghi tu, ' + esc(payerOf(F.paidBy).name) : 'Pagata da ' + esc(payerOf(F.paidBy).name)}</span><span class="d" id="half-hint">${halfHint()}</span></span>${formPeople().length > 1 ? icon('i-right', 'ic chev') : ''}</button></div>
           <div class="field"><div class="lbl">Categoria <small>(opzionale)</small></div><div class="cat-circles">${CATS.map((c) => `<button type="button" class="cat-circle${F.cat === c.id ? ' on' : ''}" data-cat="${c.id}" aria-label="${esc(c.name)}" title="${esc(c.name)}">${icon(c.icon)}</button>`).join('')}</div><div class="cat-name" id="cat-name">${F.cat ? esc(catOf(F.cat).name) : 'Nessuna categoria'}</div></div>`}
      <div class="field"><div class="lbl">Sezione</div><div class="chips" id="form-groups">${groups().map((g) => `<button type="button" class="chip${F.group === g.id ? ' on' : ''}" data-group="${g.id}">${esc(g.name)}</button>`).join('')}<button type="button" class="chip" data-group-new>${icon('i-plus')}Nuova</button></div>
        <div id="group-new" ${F.newGroup ? '' : 'hidden'}><div style="display:flex;gap:8px"><input class="input" id="group-name" type="text" placeholder="Nome della sezione, es. Vacanze" value="${esc(F.newGroupName || '')}" autocomplete="off"><button type="button" class="btn sm" id="group-create" style="height:50px;flex:none">Crea</button></div></div>
        ${groups().length ? '' : '<div class="hint">Nessuna sezione: creane una per raggruppare le spese (es. Spese casa, Vacanze).</div>'}</div>
      <div class="field"><label for="date">Data</label><input id="date" type="date" value="${esc(F.date)}" max="2100-12-31"></div>
      <div class="field"><label for="notes">Note <small class="muted" style="font-weight:500">(opzionale)</small></label><textarea id="notes" placeholder="${isPay ? 'Es. bonifico, contanti…' : 'Es. Sushi Yama - Corso Buenos Aires'}">${esc(F.notes)}</textarea></div>
      ${isPay || F.id ? '' : `<div class="field"><div class="toggle"><div><div class="t">Si ripete ogni mese</div><div class="d">Per affitto, bollette, abbonamenti: la ricrea da sola ogni mese.</div></div><button type="button" class="switch" role="switch" aria-checked="${F.recurring}" id="recurring"></button></div></div>`}
      <div class="form-foot"><button class="btn" type="submit" id="save">${editing ? 'Salva modifiche' : isPay ? 'Registra pagamento' : 'Aggiungi spesa'}</button></div>
    </form>
  </div>`;
}
function halfHint() {
  const v = parseAmount(F.amount); const ppl = formPeople(); const n = ppl.length; const o = ppl.find((m) => m.id !== me().id) || other();
  if (n === 1) return 'Solo tu: nessuna divisione';
  if (n > 2) return !isNaN(v) ? T('Divisa in {0}: {1} a testa', n, money(Math.round(v / n))) : T('Divisa in {0} fra {1}', n, listNames(ppl.filter((m) => m.id !== me().id).map((m) => m.name)));
  if (F.splitMethod === 'percent' && F.splitInput) { const pm = +F.splitInput[me().id] || 50; return !isNaN(v) ? `Tu ${pm}%: ${money(Math.round(v * pm / 100))} · ${o.name} ${100 - pm}%` : `Divisa ${pm}% / ${100 - pm}% con ${o.name}`; }
  return !isNaN(v) ? 'Metà a testa: ' + money(Math.round(v / 2)) : 'Divisa a metà con ' + o.name;
}
/* le persone fra cui dividere: quelle della sezione scelta (se ne ha), altrimenti tutte quelle che conosco */
function formPeople() { const g = F && F.group && S.groups.find((x) => x.id === F.group); const ppl = g && g.members ? sectionPeople(g) : []; return ppl.length ? ppl : S.members; }
function computeOwed() {
  const amount = parseAmount(F.amount); const ids = formPeople().map((m) => m.id);
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
  if (F.splitMethod === 'exact') { const sum = formPeople().reduce((s, m) => s + (parseAmount(F.splitInput[m.id]) || 0), 0); const ok = sum === amount; el.className = 'split-total' + (ok ? '' : ' bad'); el.innerHTML = `<span>Somma delle parti</span><b>${money(sum)} su ${money(amount)}${ok ? '' : ' · mancano ' + money(amount - sum)}</b>`; return ok; }
  if (F.splitMethod === 'percent') { const sum = formPeople().reduce((s, m) => s + (parseFloat(String(F.splitInput[m.id] || '0').replace(',', '.')) || 0), 0); const ok = Math.abs(sum - 100) < 0.01; el.className = 'split-total' + (ok ? '' : ' bad'); el.innerHTML = `<span>Totale percentuali</span><b>${sum}%${ok ? '' : ' · deve fare 100%'}</b>`; return ok; }
  const o = computeOwed(); el.className = 'split-total'; el.innerHTML = `<span>Risultato</span><b>${formPeople().map((m) => esc(m.name) + ' ' + money(o[m.id])).join(' · ')}</b>`; return true;
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
  const data = { kind: F.kind, scanned: !!F.scanned, desc: F.kind === 'payment' ? 'Pagamento' : F.desc.trim(), amount, date: F.date || todayStr(), cat: F.kind === 'payment' ? '' : F.cat, paidBy: F.paidBy, splitMethod: F.kind === 'payment' ? 'exact' : F.splitMethod, splitInput: F.splitMethod === 'equal' ? {} : { ...F.splitInput }, owed, notes: F.notes.trim(), group: F.group || null };
  const wasKind = F.kind;
  if (F.group) { S.settings.lastGroup = F.group; }
  if (F.id) { const id = F.id; F = null; updateEntry(id, data); toast('Modifiche salvate'); go('#/spesa/' + id); return; }
  data.recurring = F.recurring ? 'monthly' : null; F = null;
  const e = addEntry(data);
  go('#/fatto/' + e.id);
}

/* ---------- PROFILO + sottopagine ---------- */
function pageProfilo(r) {
  const a = me(), b = other();
  if (r.sub === 'account') return pageAccount();
  if (r.sub === 'categorie') return pageCategorie();
  if (r.sub === 'sezioni') return pageGroups();
  if (r.sub === 'sync') return pageSync();
  if (r.sub === 'notifiche') return pageNotifiche();
  if (r.sub === 'valuta') return pageValuta();
  if (r.sub === 'lingua') return pageLingua();
  if (r.sub === 'trofei') return pageTrofei();
  if (r.sub === 'classifica') return pageClassifica();
  if (r.sub === 'info') return pageInfo();
  if (r.sub === 'esporta') return pageExport();
  const together = !isCoupleAccount() ? 'Le tue spese, condivise quando vuoi' : S.settings.together ? `Insieme dal ${esc(S.settings.together)} <span aria-hidden="true">❤️</span>` : 'Le nostre spese, a metà <span aria-hidden="true">❤️</span>';
  const li = levelInfo(); const lvlPill = `<div class="lvl-xpline" data-no-i18n>${li.xp} / ${li.next} XP</div>`;
  const syncOn = sync.enabled();
  return `<div class="page">
    <div class="profile-head">${r.back ? `<button class="icon-btn profile-back" data-back="${esc(r.back)}" aria-label="Indietro">${icon('i-back')}</button>` : ''}<div class="lvl-ring" style="--p:${levelInfo().pct}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="tr" cx="50" cy="50" r="46"/><circle class="fl" cx="50" cy="50" r="46" pathLength="100"/></svg><div class="couple-circle">${isCoupleAccount() && S.members[1] ? '<img src="img/coppia.png" alt="">' : avatar(me(), true)}</div><span class="lvl-badge" data-no-i18n>LV ${levelInfo().lv}</span></div><div class="n">${isCoupleAccount() && S.members[1] ? esc(S.members[0].name) + ' &amp; ' + esc(S.members[1].name) : esc(me().name)}</div><div class="s">${together}</div>${lvlPill}</div>
    <section class="card profile-list"><div class="menu">
      <a href="#/profilo/account">${icon('i-gear')}<span>Impostazioni account</span><span class="val">Io sono ${esc(a.name)}</span>${icon('i-right', 'ic chev')}</a>
      <a href="#/profilo/classifica">${icon('i-podium')}<span>Classifica</span><span class="val" data-no-i18n>${S.settings.boardPos ? '#' + S.settings.boardPos : ''}</span>${icon('i-right', 'ic chev')}</a>
      <a href="#/profilo/trofei">${icon('i-trophy')}<span>I tuoi trofei</span><span class="val" data-no-i18n>${(() => { const t = trophies(); return t.filter((x) => x.ok).length + '/' + t.length; })()}</span>${icon('i-right', 'ic chev')}</a>
      <a href="#/profilo/sezioni">${icon('i-list')}<span>Sezioni</span><span class="val">${groups().length}</span>${icon('i-right', 'ic chev')}</a>
      <a href="#/profilo/categorie">${icon('i-grid')}<span>Categorie</span><span></span>${icon('i-right', 'ic chev')}</a>
      <a href="#/profilo/valuta">${icon('i-coin')}<span>Valuta</span><span class="val">${esc(S.settings.currency || 'EUR')} (${esc(curSymbol())})</span>${icon('i-right', 'ic chev')}</a>
      <a href="#/home" data-start-tour>${icon('i-play')}<span>Tutorial</span><span class="val">Rivedi il giro dell'app</span>${icon('i-right', 'ic chev')}</a>
      <a href="#/profilo/lingua">${icon('i-globe')}<span>Lingua</span><span class="val" data-no-i18n><i class="flag ${esc(langInfo().flag)} mini" aria-hidden="true"></i>${esc(langInfo().name)}</span>${icon('i-right', 'ic chev')}</a>
      <a href="#/profilo/esporta">${icon('i-download')}<span>Esporta dati</span><span></span>${icon('i-right', 'ic chev')}</a>
      <a href="#/profilo/notifiche">${icon('i-heart')}<span>Notifiche</span><span class="val">${S.settings.push && Notification?.permission === 'granted' ? 'attive' : 'non attive'}</span>${icon('i-right', 'ic chev')}</a>
      <a href="#/profilo/sync">${icon('i-cloud')}<span>Backup e sincronizzazione</span><span class="sync-dot ${syncOn ? '' : 'off'}" title="${syncOn ? 'attiva' : 'non attiva'}"></span>${icon('i-right', 'ic chev')}</a>
    </div></section>
    <section class="card"><div class="menu">
      <a href="#/attivita">${icon('i-repeat')}<span>Attività recente</span><span></span>${icon('i-right', 'ic chev')}</a>
      <a href="#/profilo/info">${icon('i-info')}<span>Informazioni sull'app</span><span class="val">v${APP_VERSION}</span>${icon('i-right', 'ic chev')}</a>
      <button type="button" data-logout>${icon('i-x')}<span>Esci <span class="d">${esc(auth.email() || 'account')}</span></span><span></span>${icon('i-right', 'ic chev')}</button>
    </div></section>
    ${installBanner()}
  </div>`;
}
function subHead(title, backTo = '#/profilo') { return `<div class="head"><button class="icon-btn" data-back="${backTo}" aria-label="Indietro">${icon('i-back')}</button><div class="title">${esc(title)}</div><span></span></div>`; }
const NAME_LOCK_DAYS = 30;
const nameLockLeft = () => { const t = S.settings.nameChangedAt; if (!t) return 0; return Math.max(0, Math.ceil((new Date(t).getTime() + NAME_LOCK_DAYS * 86400000 - Date.now()) / 86400000)); };
function pageAccount() {
  if (!isCoupleAccount()) { const m = me(); const u = auth.user() || {}; const left = nameLockLeft();
    return `<div class="page slide">${subHead('Impostazioni account')}
    <h2 class="sec-title">Il tuo account</h2>
    <section class="card"><div class="field" style="margin:0"><div class="lbl">Email</div><div class="input" style="display:flex;align-items:center;color:var(--muted)" data-no-i18n>${esc(u.email || '—')}</div></div>
      <div class="field"><label for="acc-name">Nome</label><input id="acc-name" type="text" value="${esc(m.name)}" data-name="${m.id}" placeholder="Nome" autocomplete="given-name" ${left ? 'disabled' : ''}><div class="hint">${left ? esc(T('Potrai cambiarlo tra {0} giorni.', left)) : 'Si può cambiare una volta ogni 30 giorni.'}</div></div>
      <div class="field"><div class="lbl">Avatar</div>${avatarPicker(AVATAR_IMGS.indexOf(((m.avatar || {}).img) || ''), 'data-av-' + m.id)}<div class="hint">Lo puoi cambiare quando vuoi.</div></div>
      <input type="hidden" data-color="${m.id}" value="${esc(m.color)}"></section>
    <section class="card"><div class="field" style="margin:0"><div class="lbl">Valuta</div><a class="input" href="#/profilo/valuta" style="display:flex;align-items:center;justify-content:space-between">${esc(currencyName(S.settings.currency || 'EUR'))} (${esc(curSymbol())}) ${icon('i-right', 'ic muted')}</a></div></section>
    <div class="section"><button class="btn" id="save-account">Salva</button></div>
  </div>`; }
  return `<div class="page slide">${subHead('Impostazioni account')}
    <h2 class="sec-title">Chi siamo</h2>
    <section class="card">${S.members.map((m, i) => `<div class="member-row"><input class="swatch" type="color" value="${m.color}" data-color="${m.id}" style="--c:${m.color}" aria-label="Colore di ${esc(m.name)}"><div class="field" style="margin:0"><input type="text" value="${esc(m.name)}" data-name="${m.id}" aria-label="Nome" placeholder="Nome"></div></div><div class="field" style="margin-top:8px"><div class="lbl" style="text-transform:none;letter-spacing:0">Avatar di ${esc(m.name)}</div>${avatarPicker(AVATAR_IMGS.indexOf(((m.avatar || {}).img) || ''), 'data-av-' + m.id)}</div>`).join('')}
    <div class="hint" style="margin-top:8px">${esc(T('Tu sei {0}. Nome e avatar arrivano anche sui telefoni con cui condividi le sezioni.', me().name))}</div>
    </section>
    ${isCoupleAccount() ? `<h2 class="sec-title section">Coppia</h2>
    <section class="card"><div class="toggle"><div><div class="t">In classifica come coppia</div><div class="d">${esc(T('Un\'unica voce «{0}» con l\'esperienza di tutti e due.', S.members[0].name + ' e ' + (S.members[1] || {}).name))}</div></div><button type="button" class="switch" role="switch" aria-checked="${!!S.settings.boardCouple}" data-couple-toggle></button></div></section>
    <section class="card"><div class="field" style="margin:0"><label for="together">Insieme dal (anno o data)</label><input id="together" type="text" value="${esc(S.settings.together)}" placeholder="2023" inputmode="numeric"><div class="hint">Compare nel profilo. Lascia vuoto per non mostrarlo.</div></div>
    ` : '<section class="card">'}
    <div class="field"><div class="lbl">Valuta</div><a class="input" href="#/profilo/valuta" style="display:flex;align-items:center;justify-content:space-between">${esc(currencyName(S.settings.currency || 'EUR'))} (${esc(curSymbol())}) ${icon('i-right', 'ic muted')}</a></div></section>
    <div class="section"><button class="btn" id="save-account">Salva</button></div>
  </div>`;
}
function pageGroups() {
  const counts = {}; active().forEach((e) => { const k = groupOf(e) ? e.group : ''; counts[k] = (counts[k] || 0) + 1; });
  const orphans = counts[''] || 0;
  return `<div class="page slide">${subHead('Sezioni')}
    <p class="muted small" style="margin:0 2px 12px">Le sezioni raggruppano le spese, come i gruppi di Splitwise (es. Spese casa, Vacanze). Quando aggiungi una spesa resta selezionata l'ultima usata.</p>
    <section class="card"><div class="lbl">Entra con un codice</div><div style="display:flex;gap:8px"><input class="input" id="join-code" type="text" placeholder="Es. KX7P4Q" autocapitalize="characters" autocomplete="off" spellcheck="false"><button type="button" class="btn sm" id="join-go" style="height:50px;flex:none">Chiedi</button></div><div class="hint">Il codice te lo dà chi ha creato la sezione: riceve la tua richiesta e può accettarla.</div></section>
    <section class="card list-card"><div class="list stagger">${groups().map((g, i) => `<div class="row" style="--i:${i}"><span class="cat-ic">${icon('i-list')}</span><span class="main"><span class="title">${esc(g.name)}</span><span class="sub">${counts[g.id] || 0} ${counts[g.id] === 1 ? 'voce' : 'voci'}${S.settings.lastGroup === g.id ? ' · predefinita' : ''}<span data-no-i18n> · </span><span>${sectionMembers(g).length} ${sectionMembers(g).length === 1 ? 'persona' : 'persone'}</span></span></span><span class="right" style="flex-direction:row;gap:2px"><button type="button" class="icon-btn" data-open-sec="${g.id}" aria-label="Codice e persone">${icon('i-users')}</button><button type="button" class="icon-btn" data-rename="${g.id}" aria-label="Rinomina">${icon('i-edit')}</button>${isOwner(g) ? `<button type="button" class="icon-btn red" data-delete-group="${g.id}" aria-label="Elimina">${icon('i-trash')}</button>` : ''}</span></div>`).join('') || '<div class="empty small" style="padding:18px">Nessuna sezione.</div>'}</div></section>
    ${orphans ? `<p class="muted small" style="margin:10px 2px">${orphans} ${orphans === 1 ? 'voce è' : 'voci sono'} senza sezione.</p>` : ''}
    <div class="section"><div style="display:flex;gap:8px"><input class="input" id="new-group-name" type="text" placeholder="Nuova sezione, es. Vacanze" autocomplete="off"><button type="button" class="btn sm" id="new-group-create" style="height:50px;flex:none">Crea</button></div></div>
  </div>`;
}
function pageSezione(r) {
  const g = S.groups.find((x) => x.id === r.id && !x.deleted && !x.left); if (!g) return pageGroups();
  const own = isOwner(g); const link = sectionLink(g).replace(/^https?:\/\//, '');
  const person = (m) => { const mm = (g.members || {})[m.id] || {}; return `<div class="sec-person">${avatar(m, true)}<div class="sec-pt"><b>${esc(m.name)}${m.id === me().id ? ' <small>(tu)</small>' : ''}</b><span>${m.id === g.owner ? 'ha creato la sezione' : esc(T('dentro dal {0}', mm.joinedAt ? dateShort(mm.joinedAt.slice(0, 10)) : '—'))}</span></div>${own && m.id !== me().id ? `<button type="button" class="btn sm ghost" data-remove="${m.id}">Togli</button>` : ''}</div>`; };
  return `<div class="page slide">${subHead(g.name, r.back || '#/profilo/sezioni')}
    <section class="card sec-card"><div class="lbl">Codice della sezione</div><div class="sec-code" data-no-i18n>${esc(g.code)}</div>
      <p class="small muted" style="margin:0 0 12px">Chi inserisce questo codice in Divvy, o apre il link, entra nella sezione e divide le spese con voi.</p>
      <div class="inv-link"><span class="inv-url" data-no-i18n>${esc(link)}</span><button type="button" class="inv-copy" data-copy-code><span class="l1">Copia ${icon('i-copy')}</span><span class="l2">Copiato ${icon('i-check')}</span></button></div>
      <div class="inv-share">
        <button type="button" data-share-sec="whatsapp"><span class="inv-circle wa">${icon('i-whatsapp')}</span>WhatsApp</button>
        <button type="button" data-share-sec="telegram"><span class="inv-circle tg">${icon('i-telegram')}</span>Telegram</button>
        <button type="button" data-share-sec="sms"><span class="inv-circle sms">${icon('i-sms')}</span>SMS</button>
        <button type="button" data-share-sec="more"><span class="inv-circle">${icon('i-more')}</span>Altro</button>
      </div></section>
    <h2 class="sec-title section">Persone</h2>
    <section class="card sec-people">${sectionPeople(g).map(person).join('')}</section>
    ${own ? `<p class="small muted" style="margin:10px 2px 0">Hai creato tu questa sezione: solo tu puoi togliere le persone o eliminarla.</p>` : `<div class="section"><button type="button" class="btn ghost" data-leave>Esci dalla sezione</button></div>`}
  </div>`;
}
async function shareSection(g, k) {
  const link = sectionLink(g), text = sectionInviteText(g), short = T('Unisciti alla mia sezione «{0}» su Divvy per dividere le spese', g.name);
  if (k === 'whatsapp') window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  else if (k === 'telegram') window.open('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(short), '_blank');
  else if (k === 'sms') location.href = 'sms:?&body=' + encodeURIComponent(text);
  else if (navigator.share) { try { await navigator.share({ title: 'Divvy', text: short + ' · ' + g.code, url: link }); } catch (_) {} }
  else { try { await navigator.clipboard.writeText(text); toast('Link copiato'); } catch (_) {} }
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
      <label class="menu-import">${icon('i-upload')}<span>Importa backup <span class="d">Unisce un file JSON esportato da Divvy: niente doppioni.</span></span><span></span>${icon('i-right', 'ic chev')}<input type="file" accept="application/json,.json" id="import-file" hidden></label>
    </div></section>
    <h2 class="sec-title section">Zona pericolosa</h2>
    <section class="card"><div class="menu"><button type="button" class="danger" data-reset>${icon('i-trash')}<span>Cancella tutti i dati <span class="d">Solo su questo telefono. Chiede conferma.</span></span><span></span>${icon('i-right', 'ic chev')}</button></div></section>
  </div>`;
}
function pageSync() {
  const s = S.settings.sync; const on = sync.enabled();
  const st = sync.status === 'busy' ? 'Sincronizzazione in corso…' : sync.status === 'err' ? 'Errore: ' + (sync.lastError || 'controlla URL e chiave') : on ? (S.settings.lastPull ? 'Ultimo aggiornamento ' + new Date(S.settings.lastPull).toLocaleString(LOC(), { dateStyle: 'short', timeStyle: 'short' }) : 'Collegata, mai sincronizzata') : 'Non attiva: i dati restano solo su questo telefono';
  return `<div class="page slide">${subHead('Backup e sincronizzazione')}
    <section class="card"><div class="status-line"><span class="sync-dot ${!on ? 'off' : sync.status === 'busy' ? 'busy' : sync.status === 'err' ? 'err' : ''}"></span>${esc(st)}</div>
    <p class="small muted" style="margin:10px 0 0">Il database condiviso è già impostato. Per collegare i due telefoni basta scrivere lo stesso <b>codice casa</b> su entrambi e premere "Salva e collega".</p></section>
    <section class="card section">
      <div class="field" style="margin-top:0"><label for="s-url">URL del progetto</label><input id="s-url" type="url" placeholder="https://xxxx.supabase.co" value="${esc(s.url)}" autocapitalize="off" autocorrect="off"></div>
      <div class="field"><label for="s-key">Chiave pubblica (anon key)</label><input id="s-key" type="password" placeholder="eyJhbGciOi…" value="${esc(s.key)}" autocapitalize="off" autocorrect="off"></div>
      <div class="field"><label for="s-house">Codice della sezione principale</label><input id="s-house" type="text" placeholder="es. luca-martina-2026" value="${esc(s.house)}" autocapitalize="off" autocorrect="off"><div class="hint">È il codice della tua prima sezione: ogni sezione ha il suo, lo trovi aprendo la sezione.</div></div>
      <div class="section btn-row"><button class="btn" id="save-sync">Salva e collega</button>${on ? `<button class="btn soft" id="sync-now">Sincronizza ora</button>` : ''}</div>
      ${on ? `<div class="section"><button class="btn ghost" id="sync-off">Scollega questo telefono</button></div>` : ''}
    </section>
  </div>`;
}
function pageNotifiche() {
  const supported = 'Notification' in window && 'PushManager' in window; const perm = supported ? Notification.permission : 'unsupported';
  const on = !!S.settings.push && perm === 'granted'; const needsHome = isIOS() && !isStandalone();
  const st = !supported ? (needsHome ? 'Su iPhone le notifiche arrivano solo se l\'app è sulla schermata Home' : 'Questo browser non supporta le notifiche') : perm === 'denied' ? 'Permesso negato: riattivalo da Impostazioni iOS → Notifiche → Divvy' : on ? 'Attive su questo telefono' : 'Non attive';
  const sample = notifText({ kind: 'expense', desc: 'Spesa', amount: 1000 }, otherName(), (balances()[me().id] || 0));
  return `<div class="page slide">${subHead('Notifiche')}
    <section class="card"><div class="status-line"><span class="sync-dot ${on ? '' : perm === 'denied' ? 'err' : 'off'}"></span>${esc(st)}</div>
    <p class="small muted" style="margin:10px 0 0">Quando ${esc(otherName())} aggiunge una spesa o un pagamento ti arriva un avviso così:</p>
    <div class="notif-preview"><img src="icons/icon-192.png" alt=""><div><div class="t">${esc(sample.title)}</div><div class="b">${esc(sample.body).replace('\n', '<br>')}</div></div></div>
    ${!sync.enabled() ? '<p class="small muted" style="margin:10px 0 0">Serve prima la <a href="#/profilo/sync" style="color:var(--green);font-weight:700">sincronizzazione</a>: è quella che porta la spesa da un telefono all\'altro.</p>' : ''}
    ${needsHome ? '<p class="small muted" style="margin:10px 0 0">Aggiungi Divvy alla schermata Home (Condividi → Aggiungi alla schermata Home) e apri le notifiche da lì.</p>' : ''}
    </section>
    <div class="section btn-row">${on ? `<button class="btn soft" id="push-test">Prova una notifica</button><button class="btn ghost" id="push-off">Disattiva</button>` : `<button class="btn" id="push-on" ${supported && perm !== 'denied' ? '' : 'disabled'}>Attiva le notifiche</button>`}</div>
  </div>`;
}
const currencyRow = (code, name, cur, attr) => { let sym = code; try { sym = new Intl.NumberFormat(LOC(), { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((p) => p.type === 'currency').value; } catch (_) {} const nm = currencyName(code); return `<button type="button" class="row" ${attr}="${code}" data-name="${esc((name + ' ' + nm).toLowerCase())}"><span class="cat-ic" style="font-weight:800;font-size:14px">${esc(sym.length > 3 ? code.slice(0, 3) : sym)}</span><span class="main"><span class="title" data-no-i18n>${esc(nm)}</span><span class="sub">${code}</span></span><span class="right">${cur === code ? icon('i-check') : ''}</span></button>`; };
function pageValuta() {
  const cur = S.settings.currency || 'EUR';
  return `<div class="page slide">${subHead('Valuta')}
    <p class="muted small" style="margin:0 2px 12px">La valuta vale per tutte le spese del gruppo, su entrambi i telefoni. Gli importi già inseriti restano gli stessi numeri: cambiano solo simbolo e formato.</p>
    <label class="search">${icon('i-search')}<input id="cur-q" type="search" placeholder="Cerca una valuta…" autocomplete="off"></label>
    <section class="card list-card"><div class="list" id="cur-list">${CURRENCIES.map(([code, name]) => { let sym = code; try { sym = new Intl.NumberFormat(LOC(), { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((p) => p.type === 'currency').value; } catch (_) {} const nm = currencyName(code); return `<button type="button" class="row" data-cur="${code}" data-name="${esc((name + ' ' + nm).toLowerCase())}"><span class="cat-ic" style="font-weight:800;font-size:14px">${esc(sym.length > 3 ? code.slice(0, 3) : sym)}</span><span class="main"><span class="title" data-no-i18n>${esc(nm)}</span><span class="sub">${code}</span></span><span class="right">${cur === code ? icon('i-check', 'ic green') : ''}</span></button>`; }).join('')}</div></section>
  </div>`;
}
const langListHTML = (cur) => LANGS().map((l) => `<button type="button" class="row" data-lang="${l.code}"><span class="flag ${esc(l.flag)}" aria-hidden="true"></span><span class="main"><span class="title" data-no-i18n>${esc(l.name)}</span><span class="sub" data-no-i18n>${esc(l.code.toUpperCase())}</span></span><span class="right">${cur === l.code ? icon('i-check', 'ic green') : ''}</span></button>`).join('');
/* pillola con bandierina e sigla: apre il foglio con le lingue (usata nella presentazione iniziale) */
const langPill = () => `<button type="button" class="lang-pill" data-lang-pick aria-label="Lingua"><i class="flag ${esc(langInfo().flag)} mini" aria-hidden="true"></i><span data-no-i18n>${esc(LANG().toUpperCase())}</span>${icon('i-right', 'ic chev')}</button>`;
function pickLang(code, before) {
  if (!LANGS().some((l) => l.code === code)) return;
  if (before) before();
  S.settings.lang = code; if (code !== 'it') S.settings.usedOtherLang = true; if (S.settings.push) { S.settings.pushUpdatedAt = nowISO(); sync.schedule(); } save(); applyLang(); render();
}
function openLangSheet(before) {
  openSheet('Lingua', `<div class="list lang-list">${langListHTML(LANG())}</div>`, (root) => { $$('[data-lang]', root).forEach((b) => b.addEventListener('click', () => { closeSheet(); pickLang(b.dataset.lang, before); })); });
}
/* foglio della sezione (matita in alto a destra nelle Spese): rinomina, statistiche, metti in pari, elimina */
function newSectionSheet() {
  openSheet('Nuova sezione', `<p class="muted small" style="margin:0 0 12px;line-height:1.45">Ogni sezione ha un codice tutto suo: chi lo inserisce entra e divide le spese di quella sezione con te.</p><div class="field" style="margin-top:0"><input class="input" id="ns-name" type="text" placeholder="Nome della sezione, es. Vacanze" autocomplete="off" enterkeyhint="done"></div><div class="btn-row" style="margin-top:14px"><button class="btn soft" data-c="no">Annulla</button><button class="btn" data-c="ok">Crea</button></div>`, (sh) => {
    const inp = $('#ns-name', sh); setTimeout(() => inp.focus(), 120);
    const create = () => { const n = (inp.value || '').trim(); if (!n) { inp.focus(); return; } const g = addGroup(n); S.settings.lastGroup = g.id; save(); closeSheet(); toast(T('Sezione "{0}" creata', n)); go('#/sezione/' + g.id); };
    $('[data-c="no"]', sh).addEventListener('click', closeSheet); $('[data-c="ok"]', sh).addEventListener('click', create); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } });
  });
}
function renameGroupSheet(g, after) {
  openSheet('Rinomina sezione', `<div class="field" style="margin-top:0"><input class="input" id="rn" type="text" value="${esc(g.name)}"></div><div class="btn-row" style="margin-top:14px"><button class="btn soft" data-c="no">Annulla</button><button class="btn" data-c="ok">Salva</button></div>`, (sh) => { $('[data-c="no"]', sh).addEventListener('click', () => closeSheet()); $('[data-c="ok"]', sh).addEventListener('click', () => { renameGroup(g.id, $('#rn', sh).value); closeSheet(); render(); if (after) after(); }); setTimeout(() => { const i = $('#rn', sh); if (i) { i.focus(); i.select(); } }, 250); });
}
function openGroupSheet(gid) {
  const g = groups().find((x) => x.id === gid); if (!g) return;
  const row = (k, ic, t, cls) => `<button type="button" class="row${cls ? ' ' + cls : ''}" data-ga="${k}"><span class="cat-ic">${icon(ic)}</span><span class="main"><span class="title">${t}</span></span><span class="right">${icon('i-right', 'ic chev')}</span></button>`;
  openSheet(g.name, `<div class="list group-menu">${row('share', 'i-users', 'Codice e persone')}${row('rename', 'i-edit', 'Rinomina')}${row('stats', 'i-chart', 'Statistiche della sezione')}${row('settle', 'i-balance', 'Metti in pari')}${isOwner(g) ? row('delete', 'i-trash', 'Elimina la sezione', 'danger') : row('leave', 'i-x', 'Esci dalla sezione', 'danger')}</div>`, (sh) => {
    $$('[data-ga]', sh).forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.ga;
      if (k === 'share') { closeSheet(); go('#/sezione/' + g.id); return; }
      if (k === 'leave') { closeSheet(); confirmSheet(T('Uscire dalla sezione «{0}»?', g.name), 'Non vedrai più le sue spese. Potrai rientrare con il codice.', 'Lascia', async () => { await leaveSection(g); speseFilter.group = ''; go('#/home'); }); return; }
      if (k === 'rename') { renameGroupSheet(g); return; }
      if (k === 'stats') { closeSheet(); go('#/statistiche?sezione=' + encodeURIComponent(g.id)); return; }
      if (k === 'settle') {
        const bal = groupBalance(g.id); const srt = Object.entries(bal).sort((x, y) => y[1] - x[1]); const cred = srt.length && srt[0][1] > 0 ? member(srt[0][0]) : null, deb = srt.length && srt[srt.length - 1][1] < 0 ? member(srt[srt.length - 1][0]) : null; const amt = cred && deb ? Math.min(bal[cred.id], -bal[deb.id]) : 0;
        if (!cred || !deb || amt < 1) { closeSheet(); toast('Siete già in pari in questa sezione'); return; }
        confirmSheet(T('Mettere in pari «{0}»?', g.name), T('{0} paga {1} a {2}. Il saldo della sezione torna a zero.', deb.name, money(amt), cred.name), 'Registra', () => {
          const e = addEntry({ kind: 'payment', desc: 'Pagamento', amount: amt, date: todayStr(), cat: '', paidBy: deb.id, to: cred.id, splitMethod: 'exact', splitInput: {}, owed: { [cred.id]: amt }, notes: '', group: g.id });
          go('#/fatto/' + e.id);
        });
        return;
      }
      if (k === 'delete') { const n = active().filter((e) => e.group === g.id).length; confirmSheet(T('Eliminare "{0}"?', g.name), n ? T('Le sue {0} voci restano, ma senza sezione.', n) : 'La sezione è vuota.', 'Elimina', () => { deleteGroup(g.id); speseFilter.group = ''; render(); toast('Sezione eliminata'); }); }
    }));
  });
}
/* ---------- I tuoi trofei: 30 obiettivi in 5 famiglie, calcolati dai dati ---------- */
const TROPHY_CATS = [['tutti', 'Tutti'], ['risparmio', 'Risparmio'], ['costanza', 'Costanza'], ['spese', 'Spese'], ['insieme', 'Insieme'], ['speciali', 'Speciali']];
let trophyFilter = 'tutti';
function trophies() {
  const byTime = (a, b) => (a.date + (a.createdAt || '')).localeCompare(b.date + (b.createdAt || ''));
  const all = active().slice().sort(byTime); const es = all.filter((e) => e.kind === 'expense'); const pays = all.filter((e) => e.kind === 'payment');
  const nth = (arr, n) => (arr[n - 1] ? arr[n - 1].date : '');
  const months = [...new Set(es.map((e) => ym(e.date)))].sort(); const tot = (m) => es.filter((e) => ym(e.date) === m).reduce((x, e) => x + e.amount, 0);
  const cur = curYM(); const pastMonths = months.filter((m) => m < cur); const lastOf = (m) => { const l = es.filter((e) => ym(e.date) === m).pop(); return l ? l.date : m + '-28'; };
  // giorni di fila con almeno una spesa
  const days = [...new Set(es.map((e) => e.date))].sort(); let bestDays = 0, run = 0, prevD = null, bestDaysAt = '';
  days.forEach((d) => { const t = new Date(d + 'T00:00:00'); run = prevD && (t - prevD) / 86400000 === 1 ? run + 1 : 1; if (run > bestDays) { bestDays = run; bestDaysAt = d; } prevD = t; });
  // mesi di fila
  let bestM = 0, runM = 0, bestMAt = ''; months.forEach((m, i) => { runM = i > 0 && shiftYM(months[i - 1], 1) === m ? runM + 1 : 1; if (runM > bestM) { bestM = runM; bestMAt = lastOf(m); } });
  // settimane diverse in uno stesso mese
  let bestWeeks = 0, bestWeeksAt = ''; months.forEach((m) => { const w = new Set(es.filter((e) => ym(e.date) === m).map((e) => Math.floor((+e.date.slice(8) - 1) / 7))); if (w.size > bestWeeks) { bestWeeks = w.size; bestWeeksAt = lastOf(m); } });
  // risparmio: mesi con meno spese del precedente e quanto risparmiato in tutto
  let saved = 0, spilAt = '', lighterAt = ''; for (let i = 1; i < months.length; i++) { if (shiftYM(months[i - 1], 1) !== months[i]) continue; const d = tot(months[i - 1]) - tot(months[i]); if (d > 0 && months[i] < cur) { saved += d; if (!spilAt) spilAt = lastOf(months[i]); } }
  pastMonths.forEach((m) => { if (!lighterAt && tot(m) > 0 && tot(m) < 30000) lighterAt = lastOf(m); });
  const recordAt = (months.find((m) => tot(m) >= 100000) || '') && lastOf(months.find((m) => tot(m) >= 100000));
  // budget personale: mesi chiusi entro il budget
  const mb = myBudget().monthly || 0; let kept = 0, keptRun = 0, bestKept = 0, keptAt = '', kept3At = '';
  if (mb) pastMonths.forEach((m, i) => { const ok = budgetMonth(m).spent <= mb; if (ok) { kept++; if (!keptAt) keptAt = lastOf(m); } keptRun = ok && i > 0 && shiftYM(pastMonths[i - 1], 1) === m ? keptRun + 1 : ok ? 1 : 0; if (keptRun > bestKept) { bestKept = keptRun; if (bestKept >= 3 && !kept3At) kept3At = lastOf(m); } });
  // insieme
  const paidBy = {}; es.forEach((e) => { paidBy[e.paidBy] = (paidBy[e.paidBy] || 0) + 1; }); const minPaid = Math.min(...S.members.map((m) => paidBy[m.id] || 0));
  let halfAt = ''; months.forEach((m) => { if (halfAt) return; const st = monthStats(m); const vals = S.members.map((x) => st.paid[x.id] || 0); if (st.total > 0 && vals.every((v) => v > 0) && Math.abs(vals[0] - vals[1]) / st.total < 0.1) halfAt = lastOf(m); });
  const payersSet = new Set(pays.map((e) => e.paidBy)); const bothPayAt = payersSet.size >= 2 ? pays.filter((e, i, arr) => arr.slice(0, i + 1).some((x) => x.paidBy !== e.paidBy))[0]?.date || '' : '';
  let bal = 0, pariAt = ''; all.forEach((e) => { const a = S.members[0].id; bal += (e.paidBy === a ? e.amount : 0) - ((e.owed || {})[a] || 0); if (e.kind === 'payment' && Math.abs(bal) < 1 && !pariAt) pariAt = e.date; });
  const tripGroup = groups().find((g) => /viagg|vacanz|trip|holiday|urlaub|voyage|vacances|viaje|reise|ferie|\bmare\b|montagna/i.test(g.name)); const tripExp = es.find((e) => e.cat === 'viaggi');
  const cats = new Set(es.map((e) => e.cat).filter(Boolean)); const scanned = es.filter((e) => e.scanned);
  const hour = (e) => { try { return new Date(e.createdAt).getHours(); } catch (_) { return 12; } }; const night = es.find((e) => hour(e) < 5); const early = es.find((e) => { const h = hour(e); return h >= 5 && h < 7; });
  const weekendOk = achievements().find((a) => a.id === 'weekend'); const otherLang = S.settings.usedOtherLang || LANG() !== 'it';
  const L = [];
  const add = (id, cat, img, title, done, todo, curV, target, at, fmt) => L.push({ id, cat, img, title, done, todo, cur: Math.min(curV, target), target, ok: curV >= target, at, fmt: fmt || 'count' });
  // Spese
  add('primo', 'spese', 'scontrino', 'Primo passo', 'Hai aggiunto la tua prima spesa', 'Aggiungi la prima spesa', es.length, 1, nth(es, 1), 'bool');
  add('dieci', 'spese', 'vetta', 'Dieci alla volta', 'Avete condiviso 10 spese', 'Condividete 10 spese', es.length, 10, nth(es, 10));
  add('cinquanta', 'spese', 'pesi', 'Peso massimo', 'Avete diviso 50 spese', 'Dividete 50 spese', es.length, 50, nth(es, 50));
  add('cento', 'spese', 'torta', 'Centenario', 'Avete diviso 100 spese', 'Dividete 100 spese', es.length, 100, nth(es, 100));
  add('fotografo', 'spese', 'scansione', 'Fotografo di scontrini', 'Il bot ha letto 20 scontrini', 'Scansiona 20 scontrini', scanned.length, 20, nth(scanned, 20));
  add('categorie', 'spese', 'categorie', 'Di tutto un po\'', 'Spese in 8 categorie diverse', 'Usate 8 categorie diverse', cats.size, 8, '');
  // Risparmio
  add('spilorcio', 'risparmio', 'moneta', 'Spilorcio', 'Un mese con meno spese del precedente', 'Chiudi un mese spendendo meno del precedente', spilAt ? 1 : 0, 1, spilAt, 'bool');
  add('budget1', 'risparmio', 'salvadanaio', 'Nel budget', 'Un mese chiuso entro il tuo budget', 'Chiudi un mese entro il tuo budget', kept, 1, keptAt, 'bool');
  add('budget3', 'risparmio', 'tresalvadanai', 'Tre su tre', 'Tre mesi di fila entro il budget', 'Tre mesi di fila entro il budget', bestKept, 3, kept3At);
  add('risparmio500', 'risparmio', 'moneta', 'Grande risparmio', 'Risparmiati 500 € rispetto ai mesi prima', 'Risparmia 500 € rispetto ai mesi prima', saved, 50000, '', 'money');
  add('leggero', 'risparmio', 'palloncino', 'Mese leggero', 'Un mese sotto i 300 € di spese', 'Chiudi un mese sotto i 300 €', lighterAt ? 1 : 0, 1, lighterAt, 'bool');
  add('weekend', 'risparmio', 'sdraio', 'Weekend senza extraspese', 'Un weekend senza cene fuori, svaghi e shopping', 'Un weekend senza cene fuori, svaghi e shopping', weekendOk && weekendOk.done ? 1 : 0, 1, '', 'bool');
  // Costanza
  add('sette', 'costanza', 'calendario', 'Costanza', '7 giorni consecutivi con una spesa', 'Aggiungi una spesa per 7 giorni di fila', bestDays, 7, bestDaysAt);
  add('settimane', 'costanza', 'settimane', 'Un mese intero', 'Spese in 4 settimane dello stesso mese', 'Spese in 4 settimane dello stesso mese', bestWeeks, 4, bestWeeksAt);
  add('tremesi', 'costanza', 'calendario', 'Tre mesi di fila', 'Tre mesi consecutivi con spese', 'Usate Divvy per tre mesi di seguito', bestM, 3, bestMAt);
  add('seimesi', 'costanza', 'sei', 'Sei mesi insieme', 'Sei mesi consecutivi con spese', 'Usate Divvy per sei mesi di seguito', bestM, 6, bestMAt);
  add('anno', 'costanza', 'compleanno', 'Un anno di Divvy', 'Dodici mesi consecutivi con spese', 'Usate Divvy per un anno intero', bestM, 12, bestMAt);
  add('puntuali', 'costanza', 'sveglia', 'Puntuali', 'Avete registrato 5 pagamenti', 'Registrate 5 pagamenti', pays.length, 5, nth(pays, 5));
  // Insieme
  add('pari', 'insieme', 'coppa', 'Tutto in pari', 'Avete azzerato i saldi', 'Mettetevi in pari almeno una volta', pariAt ? 1 : 0, 1, pariAt, 'bool');
  add('team', 'insieme', 'team', 'Team perfetto', 'Avete pagato 10 spese a testa', 'Pagate 10 spese a testa', minPaid, 10, '');
  add('meta', 'insieme', 'bilancia', 'Metà e metà', 'Un mese in cui avete pagato quasi uguale', 'Un mese in cui pagate quasi uguale', halfAt ? 1 : 0, 1, halfAt, 'bool');
  add('viaggio', 'insieme', 'mondo', 'Primo viaggio insieme', 'La vostra prima sezione o spesa di viaggio', 'Create una sezione viaggio', tripGroup || tripExp ? 1 : 0, 1, tripExp ? tripExp.date : '', 'bool');
  add('esploratori', 'insieme', 'mondo', 'Esploratori', 'Avete creato 3 sezioni', 'Create 3 sezioni', groups().length, 3, '');
  add('turni', 'insieme', 'turno', 'A turno', 'Avete registrato pagamenti tutti e due', 'Registrate un pagamento a testa', payersSet.size, 2, bothPayAt);
  // Speciali
  add('record', 'speciali', 'pesi', 'Mese da record', 'Più di 1.000 € di spese in un mese', 'Superate 1.000 € di spese in un mese', recordAt ? 1 : 0, 1, recordAt, 'bool');
  add('notturno', 'speciali', 'notte', 'Nottambulo', 'Una spesa aggiunta dopo mezzanotte', 'Aggiungi una spesa dopo mezzanotte', night ? 1 : 0, 1, night ? night.date : '', 'bool');
  add('mattiniero', 'speciali', 'mattino', 'Mattiniero', 'Una spesa aggiunta prima delle 7', 'Aggiungi una spesa prima delle 7', early ? 1 : 0, 1, early ? early.date : '', 'bool');
  add('poliglotta', 'speciali', 'lingue', 'Poliglotta', 'Hai usato Divvy in un\'altra lingua', 'Cambia lingua dalle impostazioni', otherLang ? 1 : 0, 1, '', 'bool');
  const doneSoFar = L.filter((t) => t.ok).length;
  add('primoobiettivo', 'speciali', 'coppa', 'Piccoli traguardi', 'Hai sbloccato il tuo primo trofeo', 'Sblocca il tuo primo trofeo', doneSoFar, 1, '', 'bool');
  add('collezionista', 'speciali', 'collezione', 'Collezionista', 'Metà dei trofei sbloccati', 'Sblocca 15 trofei', doneSoFar, 15, '');
  // data di sblocco: dai dati quando si può, altrimenti la prima volta che lo vedo sbloccato (resta sul telefono)
  const seen = S.settings.trophyAt || {}; let changed = false;
  L.forEach((t) => { if (!t.ok) return; if (!t.at) { if (!seen[t.id]) { seen[t.id] = todayStr(); changed = true; } t.at = seen[t.id]; } });
  if (changed) { S.settings.trophyAt = seen; save(); }
  return L;
}
const trophyDate = (d) => { try { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString(LOC(), { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', ''); } catch (_) { return d; } };
function pageTrofei() {
  const all = trophies(); const total = all.length; const done = all.filter((t) => t.ok).length; const pct = Math.round(done / total * 100);
  const list = all.filter((t) => trophyFilter === 'tutti' || t.cat === trophyFilter); const ok = list.filter((t) => t.ok), todo = list.filter((t) => !t.ok);
  const art = (t) => t.img ? `<img src="img/traguardi/${t.img}.webp" alt="">` : `<span class="tf-ph" aria-hidden="true"></span>`;
  const prog = (t) => t.fmt === 'bool' ? '' : `<div class="tf-bar"><i style="width:${Math.round(t.cur / t.target * 100)}%"></i></div><div class="tf-num" data-no-i18n>${t.fmt === 'money' ? `${moneyRound(t.cur)} / ${moneyRound(t.target)}` : `${t.cur} / ${t.target}`}</div>`;
  const card = (t) => `<div class="tf-card${t.ok ? '' : ' locked'}"><div class="tf-art">${art(t)}${t.ok ? '' : `<span class="tf-lock">${icon('i-lock')}</span>`}</div><div class="tf-body"><b class="tf-t">${esc(t.title)}</b><em class="xp-tag${t.ok ? ' got' : ''}" data-no-i18n>+${XP.trophy} XP</em><span class="tf-d">${esc(t.ok ? t.done : t.todo)}</span>${t.ok ? `<span class="tf-date" data-no-i18n>${esc(trophyDate(t.at))}</span>` : prog(t)}</div></div>`;
  return `<div class="page slide tf">${subHead('I tuoi trofei')}
    <div class="chips tf-chips">${TROPHY_CATS.map(([k, n]) => `<button type="button" class="chip${trophyFilter === k ? ' on' : ''}" data-tf="${k}">${n}</button>`).join('')}</div>
    <section class="card tf-sum"><span class="tf-sum-ic">${icon('i-trophy')}</span><div class="tf-sum-t"><div><b data-no-i18n>${done} di ${total}</b> trofei sbloccati</div><div class="tf-sum-bar"><div class="tf-bar"><i style="width:${pct}%"></i></div><span data-no-i18n>${pct}%</span></div></div></section>
    <h2 class="sec-title tf-h">Sbloccati <span data-no-i18n>(${ok.length})</span></h2>
    ${ok.length ? `<div class="tf-grid">${ok.map(card).join('')}</div>` : `<p class="muted small tf-empty">Ancora nessun trofeo qui: continua così e arriveranno.</p>`}
    <h2 class="sec-title tf-h">Da sbloccare <span data-no-i18n>(${todo.length})</span></h2>
    ${todo.length ? `<div class="tf-grid">${todo.map(card).join('')}</div>` : `<p class="muted small tf-empty">Li avete sbloccati tutti!</p>`}
  </div>`;
}
/* ---------- Classifica: ogni casa pubblica livello ed XP in una riga condivisa (house "__board__", id = codice casa) ---------- */
const BOARD_HOUSE = '__board__';
const boardName = () => asCouple() ? `${S.members[0].name} e ${S.members[1].name}` : me().name;
const boardAvatarSrc = () => { if (asCouple()) return 'img/coppia.png'; const a = (me().avatar || {}).img; return a ? 'img/' + a : (me().id === 'm1' ? 'img/luca-avatar.png' : 'img/martina-avatar.png'); };
const boardAv = (src, cls) => src ? `<img class="${cls}" src="${esc(src)}" alt="">` : `<span class="${cls}">${icon('i-user')}</span>`;
const boardId = () => asCouple() ? S.settings.sync.house : S.settings.sync.house + ':' + me().id;
async function boardPush(force) {
  if (!sync.enabled()) return; const st = S.settings.sync; let li; try { li = levelInfo(); } catch (_) { return; }
  const last = S.settings.boardPushed || {}; const now = Date.now();
  if (!force && last.xp === li.xp && last.lv === li.lv && last.name === boardName()) return;
  if (!force && last.at && now - last.at < 60000 && last.lv === li.lv) return; // al massimo una volta al minuto, salvo cambio di livello
  try {
    const rows = [{ house: BOARD_HOUSE, id: boardId(), kind: 'board', data: { name: boardName(), level: li.lv, xp: li.xp, avatar: boardAvatarSrc() }, updated_at: nowISO(), deleted: false }];
    // cambiando modalità (coppia/singolo) tolgo le righe dell'altra modalità
    const mode = asCouple() ? 'couple' : 'single'; if (S.settings.boardMode !== mode) { (asCouple() ? [st.house + ':m1', st.house + ':m2'] : [st.house]).forEach((id) => rows.push({ house: BOARD_HOUSE, id, kind: 'board', data: {}, updated_at: nowISO(), deleted: true })); }
    const r = await fetch(st.url + '/rest/v1/pari_rows?on_conflict=house,id', { method: 'POST', headers: sync.headers(), body: JSON.stringify(rows) });
    if (r.ok) S.settings.boardMode = mode;
    if (r.ok) { S.settings.boardPushed = { xp: li.xp, lv: li.lv, name: boardName(), at: now }; missionBusy = true; try { save(); } finally { missionBusy = false; } }
  } catch (_) {}
}
async function boardFetch() {
  if (!sync.enabled()) return null; const st = S.settings.sync;
  const r = await fetch(st.url + '/rest/v1/pari_rows?house=eq.' + encodeURIComponent(BOARD_HOUSE) + '&kind=eq.board&deleted=eq.false&select=id,data,updated_at&limit=500', { headers: sync.headers() });
  if (!r.ok) throw new Error(await errText(r));
  const rows = (await r.json()).map((x) => ({ id: x.id, name: (x.data && x.data.name) || '?', lv: +((x.data && x.data.level) || 1), xp: +((x.data && x.data.xp) || 0), av: (x.data && x.data.avatar) || '', at: x.updated_at })).sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name));
  const myId = boardId(); const mine = rows.findIndex((x) => x.id === myId); const li = levelInfo();
  if (mine < 0) { rows.push({ id: myId, name: boardName(), lv: li.lv, xp: li.xp, av: boardAvatarSrc(), me: true }); rows.sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name)); }
  rows.forEach((x, i) => { x.pos = i + 1; if (x.id === myId) { x.me = true; x.lv = li.lv; x.xp = li.xp; x.av = boardAvatarSrc(); } });
  const pos = rows.findIndex((x) => x.me) + 1; S.settings.boardPos = pos; S.settings.boardTotal = rows.length; missionBusy = true; try { save(); } finally { missionBusy = false; }
  return { rows, pos, total: rows.length };
}
function boardRow(x) { return `<div class="cl-row${x.me ? ' me' : ''}"><span class="cl-pos" data-no-i18n>${x.pos <= 3 ? ['🥇', '🥈', '🥉'][x.pos - 1] : x.pos}</span>${boardAv(x.av, 'cl-av')}<span class="cl-main"><b>${esc(x.name)}${x.me ? ` <em class="cl-me">Tu</em>` : ''}</b><span data-no-i18n>LV ${x.lv}</span></span><span class="cl-xp" data-no-i18n>${x.xp} XP</span></div>`; }
function boardHTML(b) {
  const top = b.rows.slice(0, 20); const podium = [top[1], top[0], top[2]];
  const step = (x, n) => x ? `<div class="clp clp${n}${x.me ? ' me' : ''}">${boardAv(x.av, 'clp-av')}<b>${esc(x.name)}</b><span class="clp-lv" data-no-i18n>LV ${x.lv}</span><span class="clp-xp" data-no-i18n>${x.xp} XP</span><i data-no-i18n>${n}</i></div>` : `<div class="clp clp${n} empty"><i data-no-i18n>${n}</i></div>`;
  const meOut = b.pos > 20 ? b.rows.find((x) => x.me) : null;
  return `<section class="cl-podium">${step(podium[0], 2)}${step(podium[1], 1)}${step(podium[2], 3)}</section>
    <div class="ach-row"><h3>I 20 utenti con il livello più alto</h3><span class="ach-count" data-no-i18n>${b.total}</span></div>
    <section class="card list-card"><div class="cl-list">${top.slice(3).map(boardRow).join('') || `<p class="muted small" style="margin:12px 16px">Ancora pochi utenti in classifica: invita i tuoi amici!</p>`}</div></section>
    ${meOut ? `<div class="ach-row"><h3>La tua posizione</h3></div><section class="card list-card"><div class="cl-list">${boardRow(meOut)}</div></section>` : ''}`;
}
function pageClassifica() {
  const on = sync.enabled(); const pos = S.settings.boardPos;
  return `<div class="page slide cl">${subHead('Classifica')}
    <p class="ach-sub">${on ? (pos ? esc(T('Sei al posto {0} su {1}', pos, S.settings.boardTotal || pos)) : 'Chi ha più XP sale sul podio.') : 'Attiva la sincronizzazione per entrare in classifica.'}</p>
    <div id="cl-body">${on ? `<div class="cl-loading"><span class="spin"></span>Carico la classifica…</div>` : `<section class="card" style="padding:18px"><p class="muted small" style="margin:0 0 12px">La classifica confronta il livello di tutti gli utenti di Divvy. Serve il codice casa.</p><a class="btn" href="#/profilo/sync">Backup e sincronizzazione</a></section>`}</div>
  </div>`;
}
/* ---------- Tour guidato dentro l'app (primo accesso): la schermata cambia da sola, la mascotte animata spiega ---------- */
const TUT_STEPS = [
  { id: 'ciao', hash: '#/home', target: null, title: 'Ciao, sono Divvy!', text: 'Ti faccio fare un giro veloce dell\'app: ti mostro dove sta ogni cosa.' },
  { id: 'spesa', hash: '#/home', target: '#tabbar .fab', title: 'Aggiungi una spesa col +', text: 'Da qui aggiungi una spesa: paghi tu e si divide a metà con {0}.' },
  { id: 'scontrino', hash: '#/nuova', target: '.scan-card', title: 'Fotografa lo scontrino', text: 'Qui mi fai leggere lo scontrino o uno screenshot della banca: compilo io i campi.' },
  { id: 'saldi', hash: '#/home', target: '.home-actions', title: 'Chi deve cosa', text: 'Qui vedi il saldo con {0}. Con "Metti in pari" registri il pagamento in un tocco.' },
  { id: 'budget', hash: '#/budget', target: '.bg-hero', title: 'Il tuo budget', text: 'Qui decidi quanto vuoi spendere al mese: ti dico quanto resta e a che ritmo vai.' },
  { id: 'missioni', hash: '#/home', target: '.trophy-btn', title: 'Missioni, trofei e livelli', text: 'Da qui apri le missioni della settimana: ogni spesa dà XP e sali di livello.' },
  { id: 'pronto', hash: '#/profilo', target: 'a[href="#/profilo/notifiche"]', title: 'Tutto pronto!', text: 'Attiva le notifiche qui per sapere quando {0} aggiunge qualcosa. Buon divertimento!' },
];
let TOUR = null;
const tutorialDone = () => { const u = auth.user(); if (!u) return true; return !!((u.user_metadata || {}).tutorial) || S.settings.tutorialDoneFor === u.id; };
function tutorialFinish() { const u = auth.user(); if (u) { S.settings.tutorialDoneFor = u.id; try { auth.updateMeta({ tutorial: true }); } catch (_) {} } save(); }
function startTour() {
  if (TOUR) return; if (!auth.user()) return;
  const el = document.createElement('div'); el.className = 'tour'; el.innerHTML = `<div class="tour-hl"></div><div class="tour-card"><div class="tour-anim"></div><b class="tour-t"></b><p class="tour-p"></p><div class="tour-row"><button type="button" class="tour-skip">Salta</button><span class="tour-dots"></span><button type="button" class="btn sm tour-next">Avanti</button></div></div>`;
  document.body.appendChild(el); TOUR = { el, i: -1 };
  const block = (e) => { if (e.cancelable) e.preventDefault(); }; el.addEventListener('touchmove', block, { passive: false }); el.addEventListener('wheel', block, { passive: false });
  TOUR.onKey = (e) => { if ([' ', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) e.preventDefault(); }; document.addEventListener('keydown', TOUR.onKey); document.body.classList.add('touring');
  $('.tour-skip', el).addEventListener('click', endTour); $('.tour-next', el).addEventListener('click', () => tourStep(TOUR.i + 1));
  TOUR.onScroll = () => tourPlace(); window.addEventListener('resize', TOUR.onScroll); window.addEventListener('scroll', TOUR.onScroll, { passive: true });
  requestAnimationFrame(() => el.classList.add('in')); tourStep(0);
}
function endTour() { if (!TOUR) return; const t = TOUR; TOUR = null; window.removeEventListener('resize', t.onScroll); window.removeEventListener('scroll', t.onScroll); document.removeEventListener('keydown', t.onKey); document.body.classList.remove('touring'); t.el.classList.remove('in'); setTimeout(() => t.el.remove(), 300); tutorialFinish(); if (location.hash !== '#/home') go('#/home'); }
function tourStep(i) {
  if (!TOUR) return; if (i >= TUT_STEPS.length) { endTour(); return; }
  TOUR.i = i; const st = TUT_STEPS[i];
  /* se serve cambiare schermata, la card si aggiorna dentro render(), nello stesso istante della pagina; il timer è solo una rete di sicurezza */
  if (location.hash !== st.hash) { TOUR.pending = i; go(st.hash); setTimeout(() => { if (TOUR && TOUR.pending === i) tourApply(); }, 600); }
  else tourApply();
}
function tourApply() {
  if (!TOUR) return; const i = TOUR.i; const st = TUT_STEPS[i]; const el = TOUR.el; const last = i === TUT_STEPS.length - 1; TOUR.pending = null;
  $('.tour-anim', el).innerHTML = `<img src="img/tutorial/${st.id}.webp" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'), { className: 'tour-ph' }))">`;
  $('.tour-t', el).textContent = T(st.title); $('.tour-p', el).textContent = T(st.text, otherName());
  $('.tour-dots', el).innerHTML = TUT_STEPS.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join(''); $('.tour-next', el).textContent = T(last ? 'Inizia' : 'Avanti');
  el.dataset.step = i; tourPlace(true);
}
function tourPlace(first) {
  if (!TOUR) return; const st = TUT_STEPS[TOUR.i]; const el = TOUR.el; const hl = $('.tour-hl', el); const card = $('.tour-card', el);
  const tg = st.target ? document.querySelector(st.target) : null;
  if (tg && first) { try { tg.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch (_) { tg.scrollIntoView(); } }
  const W = window.innerWidth, H = window.innerHeight;
  if (tg) { const r = tg.getBoundingClientRect(); const pad = 8; hl.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px;border-radius:${Math.min(22, r.height / 2 + pad)}px;opacity:1`;
    const ch = card.offsetHeight || 260; const below = r.bottom + 14 + ch < H - 12; card.classList.toggle('top', !below); card.style.top = below ? (r.bottom + 14) + 'px' : Math.max(12, r.top - 14 - ch) + 'px'; card.style.transform = ''; }
  else { hl.style.cssText = `left:${W / 2}px;top:${H / 2}px;width:0;height:0;opacity:1`; card.classList.remove('top'); card.style.top = '50%'; card.style.transform = 'translateY(-50%)'; }
  el.classList.add('placed');
}
function pageLingua() {
  const cur = LANG();
  return `<div class="page slide">${subHead('Lingua')}
    <p class="muted small" style="margin:0 2px 12px">${esc(T("La lingua vale solo per questo telefono: {0} può sceglierne un'altra sul suo.", other().name))}</p>
    <section class="card list-card"><div class="list">${langListHTML(cur)}</div></section>
  </div>`;
}
function pageInfo() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  return `<div class="page slide">${subHead("Informazioni sull'app")}
    <section class="card" style="text-align:center;padding:26px 18px"><img src="icons/preview-256.png" alt="" width="72" height="72" style="border-radius:18px"><div style="font-weight:800;font-size:22px;margin-top:12px">Divvy</div><div class="muted small">Versione ${APP_VERSION}${standalone ? ' · installata' : ' · nel browser'}</div>
    <p class="small" style="margin:14px 0 0;color:var(--ink-2)">${isCoupleAccount() && S.members[1] ? `Le spese di ${esc(S.members[0].name)} e ${esc(S.members[1].name)}, divise a metà. Funziona anche senza rete: i dati sono salvati sul telefono.` : 'Le tue spese, da solo o con chi entra nelle tue sezioni. Funziona anche senza rete: i dati sono salvati sul telefono.'}</p></section>
    <section class="card section"><div class="kv">
      <div><span class="k">Voci salvate</span><span class="v">${active().length}</span></div>
      <div><span class="k">Attività registrate</span><span class="v">${S.activity.length}</span></div>
      <div><span class="k">Spazio usato</span><span class="v">${Math.round((localStorage.getItem(KEY) || '').length / 1024)} KB</span></div>
    </div></section>
    <section class="card section"><div class="menu"><a href="#/legale/termini">${icon('i-info')}<span>Termini di servizio</span><span></span>${icon('i-right', 'ic chev')}</a><a href="#/legale/privacy">${icon('i-lock')}<span>Informativa sulla privacy</span><span></span>${icon('i-right', 'ic chev')}</a></div></section>
    <div class="section btn-row"><button class="btn soft" id="reload-app">Ricarica l'app</button><button class="btn ghost" id="replay-onb">Rivedi la presentazione</button></div>
    <div class="section"><button class="btn ghost" id="replay-tut" style="width:100%">Rivedi il tutorial</button></div>
  </div>`;
}

/* ---------- ATTIVITÀ ---------- */
/* ---------- Piccoli traguardi (si calcolano da spese e saldi, uguali per tutti e due) ---------- */
const prevYM = (ymStr) => { const [y, m] = ymStr.split('-').map(Number); const d = new Date(y, m - 2, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const monthOnly = (ymStr) => { const [y, m] = ymStr.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString(LOC(), { month: 'long' }); };
const cap = (t) => t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
const moneyRound = (cents) => { try { return new Intl.NumberFormat(LOC(), { style: 'currency', currency: S.settings.currency || 'EUR', currencyDisplay: 'narrowSymbol', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round((cents || 0) / 100)); } catch (_) { return money(cents); } };
function achievements() {
  const es = active().filter((e) => e.kind === 'expense'); const cur = curYM(); const prev = prevYM(cur);
  const tot = (y) => es.filter((e) => ym(e.date) === y).reduce((s, e) => s + e.amount, 0);
  const bal = balances(); const owe = Object.values(bal).reduce((s, v) => s + Math.max(0, v), 0); const settled = active().length > 0 && owe < 1;
  const monthTot = tot(cur), prevTot = tot(prev); const less = prevTot > 0 && monthTot < prevTot;
  // ultimo weekend concluso (sabato + domenica prima di oggi)
  const now = new Date(); now.setHours(0, 0, 0, 0); const dow = now.getDay(); const sun = new Date(now); sun.setDate(now.getDate() - (dow === 0 ? 7 : dow)); const sat = new Date(sun); sat.setDate(sun.getDate() - 1);
  const ds = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const extras = es.filter((e) => (e.date === ds(sat) || e.date === ds(sun)) && ['cibo', 'tempo-libero', 'shopping', 'viaggi'].includes(e.cat));
  const weekendOk = extras.length === 0 && es.some((e) => e.date < ds(sat));
  const n = es.length;
  const tripGroup = groups().find((g) => /viagg|vacanz|trip|holiday|urlaub|voyage|vacances|viaje|reise|ferie|\bmare\b|montagna/i.test(g.name)); const tripExp = es.find((e) => e.cat === 'viaggi');
  const months = [...new Set(es.map((e) => ym(e.date)))].sort();
  const record = months.map((m) => [m, tot(m)]).filter(([, t]) => t >= 100000).sort((a, b) => b[1] - a[1])[0];
  let streak = false; for (let i = 0; i + 2 < months.length; i++) if (prevYM(months[i + 1]) === months[i] && prevYM(months[i + 2]) === months[i + 1]) { streak = true; break; }
  const scanned = es.some((e) => e.scanned);
  const pm = monthOnly(prev); const rispetto = LANG() === 'it' && /^[aeiou]/i.test(pm) ? 'Rispetto ad {0}.' : 'Rispetto a {0}.';
  return [
    { id: 'pari', hero: true, done: settled, img: 'coppa', title: settled ? 'Tutto in pari!' : 'Manca poco!', sub: settled ? 'Avete sistemato tutti i saldi. Grande!' : T('Vi separano {0}: saldate per sbloccare il trofeo.', money(owe)), cta: settled ? 'Continua così!' : 'Registra pagamento', href: settled ? '#/home' : '#/bilanci' },
    { id: 'meno', done: less, img: 'moneta', title: less ? T('Avete speso {0} in meno questo mese!', moneyRound(prevTot - monthTot)) : 'Meno del mese scorso', sub: less ? T(rispetto, pm) : 'Spendete meno del mese scorso per sbloccarlo.' },
    { id: 'weekend', done: weekendOk, img: 'sdraio', title: 'Weekend senza extraspese!', sub: weekendOk ? 'Avete mantenuto il budget del weekend.' : 'Un weekend senza cene fuori, svaghi e shopping e si sblocca.' },
    { id: 'dieci', done: n >= 10, img: 'vetta', title: '10 spese condivise', sub: n >= 10 ? T('Avete già {0} spese insieme.', n) : 10 - n === 1 ? "Aggiungete un'altra spesa per sbloccare questo traguardo." : T('Aggiungete altre {0} spese per sbloccare questo traguardo.', 10 - n) },
    { id: 'viaggio', done: !!(tripGroup || tripExp), img: 'mondo', title: 'Primo viaggio insieme', sub: tripGroup ? T('La sezione «{0}» è il vostro primo viaggio.', tripGroup.name) : tripExp ? 'Avete già una spesa di viaggio.' : 'Create una sezione viaggio per sbloccare questo traguardo.' },
    { id: 'record', done: !!record, img: 'pesi', title: 'Mese da record', sub: record ? T('{0}: {1} di spese.', cap(monthName(record[0])), money(record[1])) : T('Superate {0} di spese in un mese.', moneyRound(100000)) },
    { id: 'tre', done: streak, img: 'calendario', title: 'Tre mesi di fila', sub: streak ? 'Tre mesi consecutivi con spese: che costanza!' : 'Usate Divvy per tre mesi di seguito.' },
    { id: 'scontrino', done: scanned, img: 'scontrino', title: 'Primo scontrino letto', sub: scanned ? 'Il bot ha letto il vostro primo scontrino.' : 'Fotografate uno scontrino dal + per sbloccarlo.' },
  ];
}
const achNew = () => { const seen = S.settings.seenAch || []; return achievements().some((a) => a.done && !seen.includes(a.id)); };
/* ---------- Missioni settimanali (da lunedì a domenica, si azzerano ogni settimana) ---------- */
const weekKey = () => { const d = new Date(); d.setHours(0, 0, 0, 0); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
/* ---------- Serbatoio di missioni: ogni settimana ne escono 7 a caso, uguali per tutti i telefoni della stessa casa ---------- */
const MISSIONS_PER_WEEK = 7;
const seedRand = (str) => { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return () => { h = (h + 0x6D2B79F5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
/* [id, immagine, famiglia (al massimo 2 per settimana), titolo, sottotitolo, valore corrente, obiettivo, tipo] — tutte si completano nell'istante in cui fai l'azione */
const MISSION_POOL = [
  ['tre', 'vetta', 'count', 'Tre spese in settimana', 'Aggiungi almeno 3 spese questa settimana.', (d) => d.es.length, 3],
  ['cinque', 'vetta', 'count', 'Cinque spese in settimana', 'Aggiungete almeno 5 spese da lunedì a domenica.', (d) => d.es.length, 5],
  ['dieci', 'pesi', 'count', 'Dieci spese in settimana', 'Una settimana piena: 10 spese registrate.', (d) => d.es.length, 10],
  ['giorni', 'calendario', 'days', 'Tre giorni attivi', 'Spese in almeno 3 giorni diversi della settimana.', (d) => d.days, 3],
  ['cinquegiorni', 'settimane', 'days', 'Cinque giorni attivi', 'Spese in almeno 5 giorni diversi della settimana.', (d) => d.days, 5],
  ['fila', 'settimane', 'days', 'Tre giorni di fila', 'Una spesa al giorno per 3 giorni consecutivi.', (d) => d.streak, 3],
  ['weekend', 'sdraio', 'when', 'Spesa del weekend', 'Registra una spesa di sabato o domenica.', (d) => d.weekend, 1],
  ['lunedi', 'sveglia', 'when', 'Si parte di lunedì', 'Registra una spesa con la data di lunedì.', (d) => d.monday, 1],
  ['mattino', 'mattino', 'when', 'Spesa del mattino', 'Aggiungi una spesa prima di mezzogiorno.', (d) => d.morning, 1],
  ['notte', 'notte', 'when', 'Nottambuli', 'Aggiungi una spesa dopo le 22.', (d) => d.night, 1],
  ['giornata', 'turno', 'when', 'Fresca di giornata', 'Registra una spesa lo stesso giorno in cui l\'hai fatta.', (d) => d.sameDay, 1],
  ['categorie', 'categorie', 'cat', 'Tutto in ordine', 'Ogni spesa della settimana con la sua categoria.', (d) => d.allCat, 1, 'bool'],
  ['trecat', 'categorie', 'cat', 'Tre categorie diverse', 'Spese in almeno 3 categorie diverse.', (d) => d.cats, 3],
  ['cinquecat', 'collezione', 'cat', 'Cinque categorie diverse', 'Spese in almeno 5 categorie diverse.', (d) => d.cats, 5],
  ['cibo', 'torta', 'cat', 'A tavola', 'Registra una spesa nella categoria Cibo.', (d) => d.cat('cibo'), 1],
  ['supermercato', 'moneta', 'cat', 'Due volte al supermercato', 'Due spese nella categoria Spesa.', (d) => d.cat('spesa'), 2],
  ['casa', 'palloncino', 'cat', 'Casa dolce casa', 'Una spesa nella categoria Casa.', (d) => d.cat('casa'), 1],
  ['trasporti', 'mondo', 'cat', 'In movimento', 'Una spesa nella categoria Trasporti.', (d) => d.cat('trasporti'), 1],
  ['salute', 'sei', 'cat', 'Prendersi cura', 'Una spesa nella categoria Salute.', (d) => d.cat('salute'), 1],
  ['regali', 'compleanno', 'cat', 'Un pensiero', 'Una spesa nella categoria Regali.', (d) => d.cat('regali'), 1],
  ['scontrino', 'scansione', 'scan', 'Un scontrino letto', 'Fai leggere almeno uno scontrino al bot questa settimana.', (d) => d.scanned, 1],
  ['duescontrini', 'scontrino', 'scan', 'Due scontrini letti', 'Fai leggere due scontrini al bot questa settimana.', (d) => d.scanned, 2],
  ['note', 'scontrino', 'notes', 'Con le note', 'Una spesa con una nota scritta.', (d) => d.notes, 1],
  ['trenote', 'scontrino', 'notes', 'Tre note', 'Tre spese con una nota scritta.', (d) => d.notes, 3],
  ['piccola', 'moneta', 'amount', 'Piccola spesa', () => T('Registra una spesa fino a {0}.', money(500)), (d) => d.small, 1],
  ['grande', 'pesi', 'amount', 'Spesa pesante', () => T('Registra una spesa di almeno {0}.', money(5000)), (d) => d.big, 1],
  ['tonda', 'moneta', 'amount', 'Cifra tonda', 'Una spesa senza centesimi, a cifra tonda.', (d) => d.round, 1],
  ['centesimi', 'moneta', 'amount', 'Al centesimo', 'Una spesa con i centesimi precisi.', (d) => d.cents, 1],
  ['budget', 'salvadanaio', 'budget', 'Un budget per te', 'Imposta il tuo budget mensile dal tab Budget.', (d) => d.budget, 1, 'bool'],
  ['budgetcat', 'tresalvadanai', 'budget', 'Budget per categoria', 'Imposta un budget per almeno una categoria.', (d) => d.budgetCat, 1, 'bool'],
  ['pari', 'coppa', 'pay', 'Conti in pari', 'Registrate un pagamento o chiudete la settimana in pari.', (d) => (d.pays || (d.settled && d.es.length) ? 1 : 0), 1, 'bool'],
  ['pagamento', 'bilancia', 'pay', 'Un pagamento registrato', 'Registra un pagamento dal + o con Metti in pari.', (d) => d.pays, 1],
  ['offri', 'moneta', 'pay', 'Offri tu', 'Paga tu almeno 3 spese della settimana.', (d) => d.mine, 3],
  ['quota', 'bilancia', 'pay', 'Divisione su misura', 'Una spesa divisa non a metà.', (d) => d.custom, 1],
  ['lingua', 'lingue', 'misc', 'Un\'altra lingua', 'Prova l\'app in un\'altra lingua dalle impostazioni.', (d) => d.lang, 1, 'bool'],
  ['sezione', 'team', 'misc', 'Una nuova sezione', 'Crea una nuova sezione per le tue spese.', (d) => d.groups, 1],
  ['modifica', 'turno', 'misc', 'Correzione al volo', 'Modifica una spesa già registrata.', (d) => d.edited, 1],
  ['trofeo', 'coppa', 'misc', 'Un trofeo nuovo', 'Sblocca un trofeo questa settimana.', (d) => d.trophies(), 1],
];
function missions(all) {
  const mon = weekKey(); const ds = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const m0 = new Date(mon + 'T00:00:00'); const sunD = new Date(m0); sunD.setDate(m0.getDate() + 6); const sun = ds(sunD); const sat = ds(new Date(m0.getFullYear(), m0.getMonth(), m0.getDate() + 5));
  const today = todayStr(); const daysLeft = Math.max(0, Math.round((sunD - new Date(today + 'T00:00:00')) / 86400000)) + 1;
  const inWeek = (e) => e.date >= mon && e.date <= sun; const week = active().filter(inWeek); const es = week.filter((e) => e.kind === 'expense'); const pays = week.filter((e) => e.kind === 'payment');
  const mid = me().id; const dsIso = (iso) => (iso ? ds(new Date(iso)) : ''); const hour = (e) => (e.createdAt ? new Date(e.createdAt).getHours() : 12);
  const dates = [...new Set(es.map((e) => e.date))].sort(); let streak = 0, run = 0; dates.forEach((dt, k) => { run = k && new Date(dt) - new Date(dates[k - 1]) === 86400000 ? run + 1 : 1; streak = Math.max(streak, run); });
  const bal = balances(); const b = myBudget();
  const d = { es, mon, sat, sun, mid, days: dates.length, streak,
    scanned: es.filter((e) => e.scanned).length, allCat: es.length && es.every((e) => e.cat) ? 1 : 0, cats: new Set(es.filter((e) => e.cat).map((e) => e.cat)).size, cat: (c) => es.filter((e) => e.cat === c).length,
    notes: es.filter((e) => (e.notes || '').trim()).length, small: es.filter((e) => e.amount <= 500).length, big: es.filter((e) => e.amount >= 5000).length, round: es.filter((e) => e.amount % 100 === 0).length, cents: es.filter((e) => e.amount % 100 !== 0).length,
    mine: es.filter((e) => e.paidBy === mid).length, custom: es.filter((e) => e.splitMethod && e.splitMethod !== 'equal').length, morning: es.filter((e) => hour(e) < 12).length, night: es.filter((e) => hour(e) >= 22).length,
    sameDay: es.filter((e) => dsIso(e.createdAt) === e.date).length, weekend: es.filter((e) => e.date === sat || e.date === sun).length, monday: es.filter((e) => e.date === mon).length,
    edited: week.filter((e) => e.updatedAt && e.createdAt && Date.parse(e.updatedAt) - Date.parse(e.createdAt) > 60000).length,
    budget: b.monthly ? 1 : 0, budgetCat: Object.values(b.byCat || {}).some((v) => v > 0) ? 1 : 0, settled: Object.values(bal).every((v) => Math.abs(v) < 1) ? 1 : 0, pays: pays.length,
    lang: S.settings.usedOtherLang || LANG() !== 'it' ? 1 : 0, groups: (S.groups || []).filter((g) => !g.deleted && g.createdAt && dsIso(g.createdAt) >= mon && dsIso(g.createdAt) <= sun).length,
    trophies: () => { try { return trophies().filter((t) => t.ok && t.at && t.at >= mon && t.at <= sun).length; } catch (_) { return 0; } } };
  /* estrazione della settimana: stessa per tutta la casa (seme = lunedì + codice casa), al massimo 2 missioni per famiglia */
  let pick = MISSION_POOL;
  if (!all) { const rnd = seedRand(mon + '|' + ((S.settings.sync || {}).house || (auth.user() || {}).id || '')); const pool = MISSION_POOL.filter((m) => hasOthers() || (m[2] !== 'pay' && m[0] !== 'quota')); /* da soli niente missioni sui pagamenti */ for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const fam = {}; pick = []; pool.forEach((m) => { if (pick.length >= MISSIONS_PER_WEEK || (fam[m[2]] || 0) >= 2) return; fam[m[2]] = (fam[m[2]] || 0) + 1; pick.push(m); }); }
  const L = pick.map(([id, img, fam, title, sub, val, target, fmt]) => { let cur = 0; try { cur = val(d) || 0; } catch (_) {} return { id, img, fam, title, sub: typeof sub === 'function' ? sub() : sub, cur: Math.min(cur, target), target, done: cur >= target, fmt: fmt || 'count' }; });
  return { list: L, mon, sun, daysLeft };
}
const missionsNew = () => { const w = missions(); const seen = S.settings.seenMissions || {}; const ids = seen.week === w.mon ? (seen.ids || []) : []; return w.list.some((m) => m.done && !ids.includes(m.id)); };
const CHECK_SVG = '<svg class="ach-ok" viewBox="0 0 24 24" aria-hidden="true"><path class="ok-path" d="M4 12 L9 17 L20 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'; /* la spunta che si disegna da sinistra a destra */
function pageMissioni() {
  const w = missions(); const list = w.list; const done = list.filter((m) => m.done).length; const all = done === list.length;
  const seen = S.settings.seenMissions || {}; const ids = new Set(seen.week === w.mon ? seen.ids || [] : []); let changed = false; const fresh = new Set(); list.forEach((m) => { if (m.done && !ids.has(m.id)) { ids.add(m.id); fresh.add(m.id); changed = true; } }); if (changed || seen.week !== w.mon) { S.settings.seenMissions = { week: w.mon, ids: [...ids] }; save(); }
  const range = `${dateShort(w.mon)} – ${dateShort(w.sun)}`;
  const art = (img) => `<img class="ach-art" src="img/traguardi/${img}.webp" alt="">`;
  const hero = `<section class="ach-hero${all ? '' : ' locked'}">${art(all ? 'coppa' : 'team')}<div class="ach-hero-t"><h2>${all ? 'Settimana perfetta!' : esc(T('{0} di {1} missioni', done, list.length))}</h2><p>${all ? 'Avete completato tutte le missioni. Grande!' : esc(w.daysLeft === 1 ? T('Ultimo giorno: si azzerano lunedì.') : T('Mancano {0} giorni: si azzerano lunedì.', w.daysLeft))}</p><a class="btn ach-cta" href="${all ? '#/home' : '#/nuova'}">${all ? 'Continua così!' : 'Aggiungi spesa'}</a></div></section>`;
  return `<div class="page ach pop">
    <div class="head"><button class="icon-btn soft" data-back="#/home" aria-label="Indietro">${icon('i-back')}</button><div class="title">Missioni settimanali</div><button type="button" class="icon-btn" data-ach-info aria-label="Informazioni">${icon('i-info')}</button></div>
    <p class="ach-sub">Ogni settimana nuove missioni.<br><span data-no-i18n>${esc(range)}</span></p>
    ${hero}
    <div class="ach-row"><h3>Le missioni di questa settimana</h3><span class="ach-count" data-no-i18n>${done} / ${list.length}</span></div>
    <div class="ach-list stagger">${list.map((m, i) => `<div class="ach-card${m.done ? (fresh.has(m.id) ? ' locked fresh' : ' done') : ' locked'}" style="--i:${i}">${art(m.img)}<div class="ach-t"><b>${esc(m.title)} <em class="xp-tag${m.done && !fresh.has(m.id) ? ' got' : ''}" data-no-i18n>+${XP.mission} XP</em></b><span>${esc(m.sub)}</span>${!m.done && m.fmt !== 'bool' ? `<span class="ach-prog"><i style="width:${Math.round(m.cur / m.target * 100)}%"></i></span><span class="ach-num" data-no-i18n>${m.cur} / ${m.target}</span>` : ''}</div><span class="ach-st">${icon('i-lock')}${CHECK_SVG}</span></div>`).join('')}</div>
    <div class="ach-quote"><p>“Piccole missioni, grandi abitudini.”</p><svg class="ach-line" viewBox="0 0 200 10" aria-hidden="true"><path d="M3 6 C 50 1, 110 9, 197 4" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg></div>
  </div>`;
}
/* ---------- Avviso "Missione completata!" che scende dall'alto (missioni della settimana e trofei) ---------- */
var missionTimer = null, missionBusy = false, missionShowing = false, missionQueue = []; // var: save() può girare già all'avvio, prima di questa riga
function missionState() { missionBusy = true; try { const w = missions(); const t = trophies(); return { week: w.mon, m: w.list.filter((x) => x.done).map((x) => [x.id, x.title]), t: t.filter((x) => x.ok).map((x) => [x.id, x.title]) }; } finally { missionBusy = false; } }
/* le missioni completate (anche mentre l'app era chiusa, o dall'altro telefono) vengono annunciate una volta sola: ricordo cosa ho già mostrato */
function missionCheck() {
  if (!auth.user()) return; let st; try { st = missionState(); } catch (_) { return; }
  const shown = S.settings.bannerShown && S.settings.bannerShown.week === st.week ? S.settings.bannerShown : { week: st.week, ids: [], trophies: (S.settings.bannerShown || {}).trophies };
  let changed = false;
  if (!Array.isArray(shown.trophies)) { shown.trophies = st.t.map((x) => x[0]); changed = true; } // prima volta: i trofei già presi non si annunciano
  st.m.forEach(([id, title]) => { if (!shown.ids.includes(id)) { shown.ids.push(id); changed = true; S.settings.missionsDone = (S.settings.missionsDone || 0) + 1; missionQueue.push({ title, trophy: false }); } });
  st.t.forEach(([id, title]) => { if (!shown.trophies.includes(id)) { shown.trophies.push(id); changed = true; missionQueue.push({ title, trophy: true }); } });
  if (changed) { S.settings.bannerShown = shown; missionBusy = true; try { save(); } finally { missionBusy = false; } }
  missionNext(); levelCheck(); boardPush();
}
/* ---------- Livelli ed esperienza (di coppia: contano i dati condivisi) ---------- */
const xpFor = (n) => { let t = 0; for (let k = 2; k <= n; k++) t += Math.round(60 * Math.pow(1.18, k - 2)); return t; }; // livello 2 a 60 XP, poi ogni livello chiede il 18% in più (3 = 131, 4 = 215, 5 = 314, 10 = 1146)
const XP = { expense: 10, payment: 15, category: 5, scanned: 20, mission: 40, trophy: 100 };
const entryXp = (e) => (e.kind === 'payment' ? XP.payment : XP.expense) + (e.kind === 'expense' && e.cat ? XP.category : 0) + (e.scanned ? XP.scanned : 0);
/* XP PERSONALI: ogni persona ha il suo livello (Lucas: l'app sarà per singoli, solo lui e Martina condividono un account) */
const asCouple = () => !!S.settings.boardCouple;
function xpTotal() { const mid = me().id; let xp = 0; active().forEach((e) => { if (asCouple() || e.paidBy === mid) xp += entryXp(e); }); xp += (S.settings.missionsDone || 0) * XP.mission; xp += trophies().filter((t) => t.ok).length * XP.trophy; return xp; }
function levelInfo() { const xp = xpTotal(); let lv = 1; while (xp >= xpFor(lv + 1)) lv++; const base = xpFor(lv), next = xpFor(lv + 1); return { xp, lv, base, next, pct: Math.max(0, Math.min(100, Math.round((xp - base) / (next - base) * 100))) }; }
/* schermata "LEVEL UP" a tutto schermo (immagine di Lucas + livello, XP e barra disegnati sopra) */
function showLevelUp(li) {
  if ($('#levelup')) return; const el = document.createElement('div'); el.id = 'levelup'; el.className = 'lvl';
  el.innerHTML = `<div class="lvl-bg"></div><div class="lvl-star s1"><img src="img/levelup-stella.webp" alt=""></div><div class="lvl-star s2"><img src="img/levelup-stella.webp" alt=""></div><div class="lvl-star s3"><img src="img/levelup-stella.webp" alt=""></div><div class="lvl-masc"><img src="img/levelup-mascotte.webp" alt=""></div><div class="lvl-ui"><div class="lvl-bar2" data-no-i18n><span class="lb-l">LV</span><span class="lb-n">${li.lv}</span><span class="lb-track"><i style="width:0%"></i></span><span class="lb-l">XP</span></div><div class="lvl-xp2" data-no-i18n>${li.base} / ${li.base} XP</div><button type="button" class="lvl-btn" aria-label="Continua"><svg class="ic" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>`;
  document.body.appendChild(el); try { if (navigator.vibrate) navigator.vibrate([40, 60, 40]); } catch (_) {}
  requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add('in'); setTimeout(() => { const f = $('.lb-track i', el); if (f) f.style.width = '100%'; /* la barra arriva sempre al massimo: il livello è stato raggiunto */ }, 500); }));
  const close = () => { el.classList.remove('in'); el.classList.add('out'); setTimeout(() => el.remove(), 450); };
  $('.lvl-btn', el).addEventListener('click', close); el.addEventListener('click', (e) => { if (e.target === el || e.target.classList.contains('lvl-bg')) close(); });
}
function levelCheck() {
  let li; try { missionBusy = true; li = levelInfo(); } catch (_) { return; } finally { missionBusy = false; }
  const seen = S.settings.levelSeen;
  if (seen == null || li.lv > seen) { const wasNew = seen != null; S.settings.levelSeen = li.lv; missionBusy = true; try { save(); } finally { missionBusy = false; } if (wasNew) showLevelUp(li); }
}
function scheduleMissionCheck() { if (missionBusy) return; clearTimeout(missionTimer); missionTimer = setTimeout(missionCheck, 350); }
function missionNext() {
  if (missionShowing || !missionQueue.length) return;
  if (typeof TOUR !== 'undefined' && TOUR) { setTimeout(missionNext, 2500); return; } /* durante il tour guidato gli avvisi aspettano */ const it = missionQueue.shift(); missionShowing = true;
  const el = document.createElement('a'); el.className = 'mban' + (it.trophy ? ' trophy' : ''); el.href = it.trophy ? '#/profilo/trofei' : '#/missioni';
  el.innerHTML = `<img src="img/missione.webp" alt=""><span class="mban-h">${esc(T(it.trophy ? 'Trofeo sbloccato!' : 'Missione completata!'))}</span><span class="mban-s">${esc(T('Hai sbloccato:'))}</span><span class="mban-t" data-no-i18n>${esc(T(it.title))}</span>`; document.body.appendChild(el);
  try { if (navigator.vibrate) navigator.vibrate(30); } catch (_) {}
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  const hide = () => { el.classList.remove('in'); setTimeout(() => { el.remove(); missionShowing = false; missionNext(); }, 650); };
  const tm = setTimeout(hide, 4200); el.addEventListener('click', () => { clearTimeout(tm); hide(); });
}
function pageTraguardi() {
  const list = achievements(); const hero = list[0]; const others = list.slice(1); const done = list.filter((a) => a.done).length;
  const seen = new Set(S.settings.seenAch || []); let changed = false; list.forEach((a) => { if (a.done && !seen.has(a.id)) { seen.add(a.id); changed = true; } }); if (changed) { S.settings.seenAch = [...seen]; save(); }
  // le illustrazioni che mancano restano un riquadro vuoto: Lucas le manda lui
  const art = (a) => a.img ? `<img class="ach-art" src="img/traguardi/${a.img}.webp" alt="">` : `<div class="ach-art ach-ph" aria-hidden="true"></div>`;
  return `<div class="page ach pop">
    <div class="head"><button class="icon-btn soft" data-back="#/home" aria-label="Indietro">${icon('i-back')}</button><div class="title">Piccoli traguardi</div><button type="button" class="icon-btn" data-ach-info aria-label="Informazioni">${icon('i-info')}</button></div>
    <p class="ach-sub">Ogni spesa è un passo in più.<br>Ecco i vostri traguardi!</p>
    <section class="ach-hero${hero.done ? '' : ' locked'}">${art(hero)}<div class="ach-hero-t"><h2>${esc(hero.title)}</h2><p>${esc(hero.sub)}</p><a class="btn ach-cta" href="${hero.href}">${esc(hero.cta)}</a></div></section>
    <div class="ach-row"><h3>Altri traguardi</h3><span class="ach-count" data-no-i18n>${done} / ${list.length}</span></div>
    <div class="ach-list stagger">${others.map((a, i) => `<div class="ach-card${a.done ? ' done' : ' locked'}" style="--i:${i}">${art(a)}<div class="ach-t"><b>${esc(a.title)}</b><span>${esc(a.sub)}</span></div><span class="ach-st">${icon(a.done ? 'i-check' : 'i-lock')}</span></div>`).join('')}</div>
    <div class="ach-quote"><p>“Grandi obiettivi si raggiungono anche con piccole spese.”</p><svg class="ach-line" viewBox="0 0 200 10" aria-hidden="true"><path d="M3 6 C 50 1, 110 9, 197 4" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg></div>
  </div>`;
}
/* ---------- Budget mensile (uguale sui due telefoni) ---------- */
const myBudget = () => (S.budget || {})[me().id] || { monthly: 0, byCat: {}, updatedAt: null };
/* il budget è personale: conta la quota di chi usa il telefono, non il totale della coppia */
function budgetMonth(ymStr) {
  const mid = me().id; const es = active().filter((e) => e.kind === 'expense' && ym(e.date) === ymStr); let spent = 0; const byCat = {};
  es.forEach((e) => { const mine = (e.owed || {})[mid] || 0; if (!mine) return; spent += mine; const c = e.cat || 'altro'; byCat[c] = (byCat[c] || 0) + mine; });
  const [y, m] = ymStr.split('-').map(Number); const dim = new Date(y, m, 0).getDate(); const cur = curYM(); const today = new Date().getDate();
  const status = ymStr === cur ? 'current' : ymStr < cur ? 'past' : 'future';
  const dayN = status === 'current' ? today : status === 'past' ? dim : 0; const daysLeft = status === 'current' ? dim - today + 1 : 0;
  const budget = myBudget().monthly || 0; const left = budget - spent;
  const projection = status === 'current' && dayN >= 3 ? Math.round(spent / dayN * dim) : 0;
  return { spent, byCat, dim, dayN, daysLeft, status, budget, left, projection, count: es.length };
}
function setBudget(cents) { const b = { ...myBudget(), byCat: { ...(myBudget().byCat || {}) } }; b.monthly = Math.max(0, Math.round(cents || 0)); b.updatedAt = nowISO(); S.budget = S.budget || {}; S.budget[me().id] = b; save(); sync.schedule(); }
function setCatBudget(cat, cents) { const b = { ...myBudget(), byCat: { ...(myBudget().byCat || {}) } }; if (cents > 0) b.byCat[cat] = Math.round(cents); else delete b.byCat[cat]; b.updatedAt = nowISO(); S.budget = S.budget || {}; S.budget[me().id] = b; save(); sync.schedule(); }
/* colori della barra del budget: verde, GIALLO quando ci si avvicina (dal 70%), ROSSO quando è quasi al massimo (dal 90%) */
const budgetCls = (pct) => (pct >= 90 ? 'over' : pct >= 70 ? 'warn' : 'ok');
function homeBudgetLine(m) {
  const b = myBudget().monthly || 0; if (!b) return '';
  const bm = budgetMonth(m); const pct = Math.round(bm.spent / b * 100);
  return `<a class="home-budget ${budgetCls(pct)}" href="#/budget"><div class="hb-row"><span>Il tuo budget</span><b>${esc(T('{0} di {1}', money(bm.spent), money(b)))}</b></div><div class="hb-bar"><i style="width:${Math.min(100, pct)}%"></i></div><div class="hb-sub">${bm.left >= 0 ? esc(T('Restano {0}', money(bm.left))) : esc(T('Sforato di {0}', money(-bm.left)))} · ${esc(T('{0}% usato', pct))}</div></a>`;
}
function budgetSuggestions() {
  const cur = curYM(); const prev = budgetMonth(shiftYM(cur, -1)).spent; const trio = [1, 2, 3].map((i) => budgetMonth(shiftYM(cur, -i)).spent).filter((v) => v > 0); const avg = trio.length ? Math.round(trio.reduce((a, b) => a + b, 0) / trio.length) : 0;
  const round = (v) => Math.ceil(v / 5000) * 5000; const out = [];
  if (prev > 0) out.push({ v: round(prev), t: T('Come il mese scorso ({0})', money(round(prev))) });
  if (avg > 0 && round(avg) !== round(prev)) out.push({ v: round(avg), t: T('Media degli ultimi 3 mesi ({0})', money(round(avg))) });
  return out;
}
function budgetSheet(title, current, onSave, extraNote) {
  const sug = budgetSuggestions();
  openSheet(title, `<p class="muted small" style="margin:0 0 12px">${esc(extraNote || T('Il budget è solo tuo: conta la tua quota delle spese. {0} può impostare il suo.', other().name))}</p>
    <div class="field money-input" style="margin-top:0"><span class="cur">${esc(curSymbol())}</span><input id="bg-amt" type="text" inputmode="decimal" placeholder="${esc(moneyPlain(0))}" value="${current ? esc(moneyPlain(current)) : ''}"></div>
    ${sug.length ? `<div class="chips" style="margin-top:10px;padding-bottom:4px">${sug.map((x) => `<button type="button" class="chip" data-sug="${x.v}">${esc(x.t)}</button>`).join('')}</div>` : ''}
    <div class="btn-row" style="margin-top:14px">${current ? `<button type="button" class="btn danger" data-c="rm">Togli il budget</button>` : `<button type="button" class="btn soft" data-c="no">Annulla</button>`}<button type="button" class="btn" data-c="ok">Salva</button></div>`, (sh) => {
    const inp = $('#bg-amt', sh); setTimeout(() => { inp.focus(); inp.select(); }, 250);
    $$('[data-sug]', sh).forEach((b) => b.addEventListener('click', () => { inp.value = moneyPlain(+b.dataset.sug); }));
    const no = $('[data-c="no"]', sh); if (no) no.addEventListener('click', () => closeSheet());
    const rm = $('[data-c="rm"]', sh); if (rm) rm.addEventListener('click', () => { onSave(0); closeSheet(); toast('Budget tolto'); render(); });
    $('[data-c="ok"]', sh).addEventListener('click', () => { const v = parseAmount(inp.value); if (isNaN(v) || v <= 0) { toast('Inserisci un importo valido.'); inp.focus(); return; } onSave(v); closeSheet(); toast('Budget salvato'); render(); });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('[data-c="ok"]', sh).click(); } });
  });
}
function budgetChart(m) {
  const months = [5, 4, 3, 2, 1, 0].map((i) => shiftYM(m, -i)); const data = months.map((x) => budgetMonth(x)); const b = myBudget().monthly || 0;
  const max = Math.max(b, ...data.map((d) => d.spent), 1); const W = 360, H = 150, bw = 30, gap = (W - bw * 6) / 6; const base = H - 8; const y = (v) => base - (v / max) * (H - 24);
  return `<svg class="chart bchart" viewBox="0 0 ${W} ${H + 22}" aria-hidden="true">${b ? `<line x1="0" x2="${W}" y1="${y(b).toFixed(1)}" y2="${y(b).toFixed(1)}" class="bline"/>` : ''}${data.map((d, i) => { const x = gap / 2 + i * (bw + gap); const h = Math.max(3, base - y(d.spent)); const cls = b && d.spent > b ? 'over' : 'ok'; return `<g class="col${d.spent ? '' : ' dim'}"><rect class="bar ${cls}" x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" rx="6"/><text class="lbl${months[i] === m ? ' on' : ''}" x="${(x + bw / 2).toFixed(1)}" y="${H + 12}">${esc(monthShort(months[i]))}</text></g>`; }).join('')}</svg>`;
}
function pageBudget(r) {
  const m = S.ui.month; const bm = budgetMonth(m); const b = bm.budget; const pct = b ? Math.round(bm.spent / b * 100) : 0; const cls = budgetCls(pct);
  const cats = CATS.map((c) => ({ c, spent: bm.byCat[c.id] || 0, lim: (myBudget().byCat || {})[c.id] || 0 })).filter((x) => x.spent || x.lim).sort((a, b2) => (b2.lim ? 1 : 0) - (a.lim ? 1 : 0) || b2.spent - a.spent);
  let hero;
  if (!b) hero = `<div class="bg-empty"><div class="bg-empty-t">Nessun budget per questo mese</div><p class="muted small" style="margin:6px 0 14px">Decidi quanto vuoi spendere al mese: conto la tua quota delle spese e ti dico quanto resta e a che ritmo vai.</p><button type="button" class="btn" data-set-budget>Imposta budget</button></div>`;
  else {
    const stats = bm.status === 'current'
      ? `<div class="bg-stats"><div><b>${esc(bm.left >= 0 ? money(bm.left) : money(-bm.left))}</b><span>${bm.left >= 0 ? 'Restano' : 'Sforato di'}</span></div><div><b>${bm.daysLeft}</b><span>${bm.daysLeft === 1 ? '1 giorno' : esc(T('{0} giorni', bm.daysLeft)).replace(String(bm.daysLeft), '').trim()}</span></div><div><b>${esc(bm.left > 0 ? moneyRound(Math.floor(bm.left / Math.max(1, bm.daysLeft))) : money(0))}</b><span>al giorno</span></div></div>${bm.projection ? `<div class="bg-proj ${budgetCls(Math.round(bm.projection / b * 100))}">${esc(T('Di questo passo: {0} a fine mese', money(bm.projection)))}</div>` : ''}`
      : bm.status === 'past' ? `<div class="bg-proj ${cls}">${bm.spent <= b ? esc(T('Budget rispettato')) + ' · ' + esc(T('Restano {0}', money(bm.left))) : esc(T('Sforato di {0}', money(-bm.left)))}</div>` : `<div class="bg-proj">Mese non ancora iniziato</div>`;
    hero = `<div class="bg-big"><b>${esc(money(bm.spent))}</b><span>${esc(T('{0} di {1}', '', money(b))).trim()}</span></div>
      <div class="bg-bar ${cls}"><i style="width:${Math.min(100, pct)}%"></i></div><div class="bg-pct">${esc(T('{0}% usato', pct))}</div>
      ${stats}
      <button type="button" class="btn soft sm" data-set-budget style="margin-top:14px">${icon('i-edit')} Modifica budget</button>`;
  }
  return `<div class="page">
    <div class="head"><span></span><div class="title">Il tuo budget</div><span></span></div>
    <p class="bg-note muted small">Conta la tua quota delle spese, non il totale.</p>
    <section class="card bg-hero">${monthNav(m)}${hero}</section>
    <div class="link-row"><h2 class="sec-title">Per categoria</h2></div>
    <section class="card list-card"><p class="muted small" style="margin:12px 16px 4px">Tocca una categoria per darle un budget.</p><div class="list bg-cats">${(cats.length ? cats : CATS.slice(0, 4).map((c) => ({ c, spent: 0, lim: 0 }))).map(({ c, spent, lim }) => { const p = lim ? Math.round(spent / lim * 100) : 0; return `<button type="button" class="row" data-cat-budget="${c.id}"><span class="cat-ic">${icon(c.icon)}</span><span class="main"><span class="title">${esc(c.name)}</span><span class="sub">${lim ? esc(T('{0} di {1}', money(spent), money(lim))) : esc(money(spent)) + ' · ' + esc(T('senza budget'))}</span>${lim ? `<span class="bg-mini ${budgetCls(p)}"><i style="width:${Math.min(100, p)}%"></i></span>` : ''}</span><span class="right">${lim ? `<span class="bg-p ${budgetCls(p)}">${p}%</span>` : icon('i-plus', 'ic muted')}</span></button>`; }).join('')}</div></section>
    <div class="link-row"><h2 class="sec-title">Ultimi sei mesi</h2></div>
    <section class="card">${budgetChart(m)}</section>
  </div>`;
}
function pageActivity() {
  const days = []; S.activity.forEach((a) => { const k = a.ts.slice(0, 10); let d = days.find((x) => x.k === k); if (!d) { d = { k, items: [] }; days.push(d); } d.items.push(a); });
  const text = (a) => { const who = member(a.by).name; const amt = money(a.amount); const d = esc(a.desc || ''); switch (a.type) { case 'add': return `<b>${esc(who)}</b> ha aggiunto <b>${d}</b> (${amt})`; case 'edit': return `<b>${esc(who)}</b> ha modificato <b>${d}</b> (${amt})`; case 'delete': return `<b>${esc(who)}</b> ha eliminato <b>${d}</b> (${amt})`; case 'restore': return `<b>${esc(who)}</b> ha ripristinato <b>${d}</b>`; case 'settle': return `<b>${esc(who)}</b> ha registrato un pagamento di <b>${amt}</b>`; default: return d; } };
  return `<div class="page slide">${subHead('Attività', '#/spese')}
    <section class="card">${days.length ? `<div class="feed">${days.map((d) => `<div class="day">${esc(relDay(d.k))}</div>${d.items.map((a) => `<a class="ev ${a.type}" href="#/spesa/${a.entryId}"><div class="t">${text(a)}</div><div class="when">${esc(new Date(a.ts).toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit' }))}</div></a>`).join('')}`).join('')}</div>` : emptyBox('Ancora niente', 'Qui compare tutto quello che aggiungete, modificate o saldate.')}</section>
  </div>`;
}

/* ---------- Schermata di accesso / registrazione ---------- */
let LG = { mode: 'login', email: '', busy: false, show: false, sent: '' };
function pageLogin() {
  const reg = LG.mode === 'register';
  return `<div class="page onb login">
    <div class="onb-top"><span></span><span></span></div>
    <img class="onb-logo" src="img/logo.png" alt="Divvy">
    <h1 class="onb-h">${reg ? 'Crea il tuo account' : 'Benvenuto in Divvy!'}</h1><p class="onb-p">${reg ? 'Bastano un\'email e una password: poi ti presentiamo l\'app.' : 'L\'app per condividere le spese in modo semplice e trasparente.'}</p>
    <div class="onb-art"><img src="img/benvenuto-4.png" alt=""></div>
    <form class="onb-form" data-login-form>
      <label class="onb-field">${icon('i-mail')}<input id="lg-email" type="email" placeholder="Email" value="${esc(LG.email)}" autocomplete="email" autocapitalize="off" inputmode="email" enterkeyhint="next"></label>
      <label class="onb-field">${icon('i-lock')}<input id="lg-pass" type="${LG.show ? 'text' : 'password'}" placeholder="Password" autocomplete="${reg ? 'new-password' : 'current-password'}" enterkeyhint="go"><button type="button" class="login-eye" data-eye aria-label="Mostra password">${icon(LG.show ? 'i-eye-off' : 'i-eye')}</button></label>
      ${reg ? '' : `<div class="login-row"><button type="button" class="login-link" data-forgot>Password dimenticata?</button></div>`}
      <button class="btn onb-btn login-main" type="submit" ${LG.busy ? 'disabled' : ''}>${reg ? 'Registrati' : 'Accedi'}</button>
    </form>
    <div class="login-or"><span>oppure</span></div>
    <button type="button" class="btn ghost login-oauth" data-oauth="apple">${icon('i-apple')} Continua con Apple</button>
    <button type="button" class="btn ghost login-oauth" data-oauth="google">${icon('i-google')} Continua con Google</button>
    <p class="login-foot">Non hai un account? <a class="login-link u" href="#/registrati">Registrati</a></p>
  </div>`;
}
/* la presentazione si vede una sola volta per account (segnata sia sul telefono sia nei metadati dell'utente) */
const onboardingDone = () => { const u = auth.user(); if (!u) return true; return !!((u.user_metadata || {}).onboarded) || S.settings.onboardedFor === u.id; };
const INTRO_AT_EVERY_LOGIN = true; // richiesta di Lucas (5/9): a ogni accesso ripartono le 4 pagine dalla prima
function afterLogin() {
  try { localStorage.removeItem(PENDING_KEY); } catch (_) {}
  updateCoupleFlag().then((ch) => { if (ch) render(); }); const chAuth = afterAuth(); applyPendingJoin(); if (sync.enabled() && (chAuth || !S.settings.lastPull)) sync.run(true);
  const done = onboardingDone();
  OB = { step: 1, name: done ? me().name : '', partner: '', house: '', avatar: AVATAR_IMGS.indexOf(((me().avatar || {}).img) || ''), split: (S.settings.split || {}).mode === 'custom' ? 'custom' : 'equal', pct: ((S.settings.split || {}).pct || {})[me().id] || 50 };
  go(done && !INTRO_AT_EVERY_LOGIN ? '#/home' : '#/benvenuto'); if (sync.enabled()) sync.run();
}
function bindLogin() {
  const form = $('[data-login-form]');
  $('#lg-email').addEventListener('input', (e) => (LG.email = e.target.value.trim()));
  $('[data-eye]').addEventListener('click', () => { LG.show = !LG.show; const i = $('#lg-pass'); const v = i.value; render(); $('#lg-pass').value = v; });
  $$('[data-oauth]').forEach((b) => b.addEventListener('click', () => auth.oauth(b.dataset.oauth)));
  const forgot = $('[data-forgot]'); if (forgot) forgot.addEventListener('click', async () => { const em = ($('#lg-email').value || '').trim(); if (!em) { $('#lg-email').focus(); toast('Scrivi prima la tua email'); return; } try { await auth.recover(em); toast('Email inviata: apri il link per scegliere una nuova password'); } catch (e) { toast(e.message); } });
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); const em = ($('#lg-email').value || '').trim(); const pw = $('#lg-pass').value || '';
    if (!em) { $('#lg-email').focus(); return; } if (pw.length < 6) { $('#lg-pass').focus(); toast('La password deve avere almeno 6 caratteri'); return; }
    LG.busy = true; $('.login-main').disabled = true;
    try {
      await auth.signIn(em, pw);
      LG.busy = false; LG.sent = ''; afterLogin();
    } catch (err) { LG.busy = false; render(); toast(err.message); }
  });
  if (!isNative()) setTimeout(() => { const i = $('#lg-email'); if (i && !i.value) i.focus({ preventScroll: true }); }, 400);
}
let RG = { email: '', show1: false, show2: false, terms: false, news: false, busy: false };
function pageRegister() {
  return `<div class="page onb login reg">
    <div class="onb-top"><a class="icon-btn onb-back" href="#/accedi" aria-label="Indietro">${icon('i-back')}</a><span></span></div>
    <img class="onb-logo" src="img/logo.png" alt="Divvy">
    <h1 class="onb-h">Crea il tuo account</h1><p class="onb-p">Inizia a condividere le spese in pochi secondi.</p>
    <div class="onb-art"><img src="img/registrati.png" alt=""></div>
    <form class="onb-form" data-register-form>
      <label class="onb-field">${icon('i-mail')}<input id="rg-email" type="email" placeholder="Email" value="${esc(RG.email)}" autocomplete="email" autocapitalize="off" inputmode="email" enterkeyhint="next"></label>
      <label class="onb-field">${icon('i-lock')}<input id="rg-pass" type="${RG.show1 ? 'text' : 'password'}" placeholder="Password" autocomplete="new-password" enterkeyhint="next"><button type="button" class="login-eye" data-eye="1" aria-label="Mostra password">${icon(RG.show1 ? 'i-eye-off' : 'i-eye')}</button></label>
      <label class="onb-field">${icon('i-lock')}<input id="rg-pass2" type="${RG.show2 ? 'text' : 'password'}" placeholder="Conferma password" autocomplete="new-password" enterkeyhint="go"><button type="button" class="login-eye" data-eye="2" aria-label="Mostra password">${icon(RG.show2 ? 'i-eye-off' : 'i-eye')}</button></label>
      <label class="reg-check"><input type="checkbox" id="rg-terms" ${RG.terms ? 'checked' : ''}><span class="box"></span><span>Accetto i <a href="#/legale/termini">Termini di servizio</a> e l'<a href="#/legale/privacy">Informativa sulla privacy</a></span></label>
      <label class="reg-check"><input type="checkbox" id="rg-news" ${RG.news ? 'checked' : ''}><span class="box"></span><span>Voglio ricevere novità e aggiornamenti (opzionale)</span></label>
      <button class="btn onb-btn login-main" type="submit" ${RG.busy ? 'disabled' : ''}>Crea account ${arrowIc}</button>
    </form>
    <div class="login-or"><span>Oppure</span></div>
    <button type="button" class="btn ghost login-oauth" data-oauth="google">${icon('i-google')} Continua con Google</button>
    <p class="login-foot">Hai già un account? <a class="login-link" href="#/accedi">Accedi</a></p>
  </div>`;
}
function bindRegister() {
  $('#rg-email').addEventListener('input', (e) => (RG.email = e.target.value.trim()));
  $$('[data-eye]').forEach((b) => b.addEventListener('click', () => { const p1 = $('#rg-pass').value, p2 = $('#rg-pass2').value; if (b.dataset.eye === '1') RG.show1 = !RG.show1; else RG.show2 = !RG.show2; render(); $('#rg-pass').value = p1; $('#rg-pass2').value = p2; }));
  $('#rg-terms').addEventListener('change', (e) => (RG.terms = e.target.checked)); $('#rg-news').addEventListener('change', (e) => (RG.news = e.target.checked));
  $$('[data-oauth]').forEach((b) => b.addEventListener('click', () => auth.oauth(b.dataset.oauth)));
  $('[data-register-form]').addEventListener('submit', async (e) => {
    e.preventDefault(); const em = ($('#rg-email').value || '').trim(); const p1 = $('#rg-pass').value || '', p2 = $('#rg-pass2').value || '';
    if (!em) { $('#rg-email').focus(); return; } if (p1.length < 6) { $('#rg-pass').focus(); toast('La password deve avere almeno 6 caratteri'); return; }
    if (p1 !== p2) { $('#rg-pass2').focus(); toast('Le due password non coincidono'); return; }
    if (!RG.terms) { const c = $('#rg-terms').closest('.reg-check'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); toast('Accetta i Termini di servizio per continuare'); return; }
    RG.busy = true; $('.login-main').disabled = true;
    try { const res = await auth.signUp(em, p1, { newsletter: RG.news, terms_accepted_at: nowISO() }); RG.busy = false; if (res === 'confirm') { LG.email = em; try { localStorage.setItem(PENDING_KEY, em); } catch (_) {} go('#/conferma'); } else afterLogin(); }
    catch (err) { RG.busy = false; render(); toast(err.message); }
  });
  if (!isNative()) setTimeout(() => { const i = $('#rg-email'); if (i && !i.value) i.focus({ preventScroll: true }); }, 400);
}
function pageLegal(r) {
  const privacy = r.sub === 'privacy';
  return `<div class="page slide"><div class="head"><button class="icon-btn" data-back="${auth.user() ? '#/profilo/info' : '#/registrati'}" aria-label="Indietro">${icon('i-back')}</button><div class="title">${privacy ? 'Privacy' : 'Termini di servizio'}</div><span></span></div>
    <section class="card legal">${privacy
      ? `<h2 class="sec-title">Informativa sulla privacy</h2><p><b>Bozza da rivedere prima della pubblicazione.</b></p><p>Divvy salva le spese, i pagamenti e i nomi che inserisci per mostrarli a te e alla persona con cui condividi la casa. I dati stanno sul telefono e, se attivi la sincronizzazione, su un database Supabase in Europa.</p><p>Per l'accesso usiamo la tua email e una password (o l'account Google/Apple). L'email serve solo per farti entrare e per le email di conferma e recupero password.</p><p>Se attivi le notifiche, salviamo l'indirizzo tecnico del tuo telefono per poterle inviare. Non vendiamo né cediamo dati a terzi. Puoi cancellare tutto dal Profilo o scrivendo a lukesalvemini@gmail.com.</p>`
      : `<h2 class="sec-title">Termini di servizio</h2><p><b>Bozza da rivedere prima della pubblicazione.</b></p><p>Divvy è un'app per tenere il conto delle spese condivise. Il servizio è offerto così com'è, gratuitamente, in fase di prova.</p><p>Sei responsabile di ciò che inserisci e di custodire la tua password. Non usare l'app per scopi illeciti o per dati di altre persone senza il loro consenso.</p><p>Possiamo modificare o sospendere il servizio in qualsiasi momento. Per domande: lukesalvemini@gmail.com.</p>`}</section></div>`;
}
const PENDING_KEY = 'pari:pending-email';
function pageConfirm() {
  const em = localStorage.getItem(PENDING_KEY) || LG.email || '';
  return `<div class="page onb login conf">
    <div class="onb-top"><span></span><span></span></div>
    <img class="onb-logo" src="img/logo.png" alt="Divvy">
    <h1 class="onb-h">Controlla la tua email</h1>
    <p class="onb-p">Ti abbiamo inviato un link di conferma a<br><b class="conf-mail">${esc(em)}</b>.</p>
    <p class="onb-p conf-p2">Aprilo per verificare il tuo account<br>e iniziare a usare Divvy.</p>
    <div class="onb-art"><img src="img/conferma.png" alt=""></div>
    <div class="conf-box"><span class="conf-i">${icon('i-info')}</span><div><b>Non trovi l'email?</b><span>Controlla anche nella cartella spam o promozioni.</span></div></div>
    <div class="onb-form"><a class="btn onb-btn" href="#/accedi" data-confirmed>Ho confermato l'email ${arrowIc}</a></div>
    <p class="login-foot conf-foot">Non hai ricevuto l'email?<br><button type="button" class="login-link u" data-resend>Invia di nuovo</button></p>
  </div>`;
}
function bindConfirm() {
  const em = localStorage.getItem(PENDING_KEY) || LG.email || '';
  $('[data-confirmed]').addEventListener('click', () => { LG.email = em; LG.sent = ''; });
  $('[data-resend]').addEventListener('click', async (e) => {
    if (!em) { go('#/registrati'); return; } e.target.disabled = true;
    try { const r = await fetch(SUPA_URL + '/auth/v1/resend', { method: 'POST', headers: auth.h(), body: JSON.stringify({ type: 'signup', email: em, options: { emailRedirectTo: appUrl() } }) }); if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(authMsg(j)); } toast('Email inviata di nuovo a ' + em); }
    catch (err) { toast(err.message); } finally { setTimeout(() => (e.target.disabled = false), 15000); }
  });
}
function pageRecovery() {
  return `<div class="page onb login"><img class="onb-logo" src="img/logo.png" alt="Divvy">
    <h1 class="onb-h">Scegli una nuova password</h1><p class="onb-p">Almeno 6 caratteri. Poi entri subito.</p>
    <form class="onb-form" data-recovery-form style="margin-top:24px"><label class="onb-field">${icon('i-lock')}<input id="rc-pass" type="password" placeholder="Nuova password" autocomplete="new-password"></label>
    <button class="btn onb-btn" type="submit">Salva e accedi</button></form></div>`;
}
function bindRecovery() {
  $('[data-recovery-form]').addEventListener('submit', async (e) => { e.preventDefault(); const pw = $('#rc-pass').value || ''; if (pw.length < 6) { toast('Almeno 6 caratteri'); return; } try { await auth.updatePassword(pw); auth.recovery = false; toast('Password aggiornata'); afterLogin(); } catch (err) { toast(err.message); } });
}

/* ---------- Lettura dello scontrino (OCR sul telefono, niente servizi esterni) ---------- */
const STORES = [
  ['esselunga', 'Esselunga', 'spesa'], ['coop', 'Coop', 'spesa'], ['conad', 'Conad', 'spesa'], ['carrefour', 'Carrefour', 'spesa'], ['lidl', 'Lidl', 'spesa'], ['eurospin', 'Eurospin', 'spesa'], ['pam', 'Pam', 'spesa'], ['despar', 'Despar', 'spesa'], ['iper', 'Iper', 'spesa'], ['bennet', 'Bennet', 'spesa'], ['tigros', 'Tigros', 'spesa'], ['famila', 'Famila', 'spesa'], ['aldi', 'Aldi', 'spesa'], ['md ', 'MD', 'spesa'], ['penny', 'Penny', 'spesa'], ['unes', 'Unes', 'spesa'], ['todis', 'Todis', 'spesa'], ['crai', 'Crai', 'spesa'], ['simply', 'Simply', 'spesa'], ['auchan', 'Auchan', 'spesa'], ['italmark', 'Italmark', 'spesa'], ['gigante', 'Il Gigante', 'spesa'],
  ['decathlon', 'Decathlon', 'shopping'], ['zara', 'Zara', 'shopping'], ['h&m', 'H&M', 'shopping'], ['ovs', 'OVS', 'shopping'], ['ikea', 'Ikea', 'casa'], ['leroy', 'Leroy Merlin', 'casa'], ['brico', 'Brico', 'casa'], ['mediaworld', 'MediaWorld', 'shopping'], ['unieuro', 'Unieuro', 'shopping'], ['euronics', 'Euronics', 'shopping'], ['tigota', 'Tigotà', 'shopping'], ['acqua e sapone', 'Acqua & Sapone', 'casa'], ['caddy', "Caddy's", 'casa'], ['primark', 'Primark', 'shopping'], ['amazon', 'Amazon', 'shopping'],
  ['farmacia', 'Farmacia', 'salute'], ['parafarmacia', 'Parafarmacia', 'salute'],
  ['eni', 'Eni', 'trasporti'], ['q8', 'Q8', 'trasporti'], ['esso', 'Esso', 'trasporti'], ['tamoil', 'Tamoil', 'trasporti'], ['ip ', 'IP', 'trasporti'], ['agip', 'Agip', 'trasporti'], ['autogrill', 'Autogrill', 'cibo'], ['autostrade', 'Autostrade', 'trasporti'], ['trenitalia', 'Trenitalia', 'trasporti'], ['italo', 'Italo', 'trasporti'], ['atm', 'ATM', 'trasporti'],
  ['mcdonald', "McDonald's", 'cibo'], ['burger king', 'Burger King', 'cibo'], ['kfc', 'KFC', 'cibo'], ['ristorante', 'Ristorante', 'cibo'], ['pizzeria', 'Pizzeria', 'cibo'], ['trattoria', 'Trattoria', 'cibo'], ['osteria', 'Osteria', 'cibo'], ['bar ', 'Bar', 'cibo'], ['caffe', 'Caffè', 'cibo'], ['pasticceria', 'Pasticceria', 'cibo'], ['gelateria', 'Gelateria', 'cibo'], ['sushi', 'Sushi', 'cibo'], ['kebab', 'Kebab', 'cibo'],
  ['cinema', 'Cinema', 'tempo-libero'], ['uci', 'UCI Cinemas', 'tempo-libero'], ['the space', 'The Space Cinema', 'tempo-libero'], ['parcheggio', 'Parcheggio', 'trasporti'], ['hotel', 'Hotel', 'viaggi'], ['b&b', 'B&B', 'viaggi'],
];
const GENERIC = new Set(['Farmacia', 'Parafarmacia', 'Ristorante', 'Pizzeria', 'Trattoria', 'Osteria', 'Bar', 'Caffè', 'Pasticceria', 'Gelateria', 'Sushi', 'Kebab', 'Cinema', 'Parcheggio', 'Hotel', 'B&B', 'Brico']);
const storeMatch = (text) => { const t = ' ' + text.toLowerCase().replace(/[^a-z0-9&à-ú]+/g, ' ') + ' '; for (const [k, name, c] of STORES) { const kk = k.trim(); if (kk.length <= 4 ? t.includes(' ' + kk + ' ') : t.includes(kk)) return { name, cat: c }; } return null; };
const CAT_HINTS = [
  ['salute', /farmacia|parafarmacia|medicin|ricetta|ticket sanit/i], ['trasporti', /carburant|benzin|diesel|gasolio|litri|parcheggio|sosta|pedaggio|autostrad|biglietto|treno|trenitalia|italo|\bbus\b|metro/i],
  ['cibo', /ristorant|pizzeria|trattoria|osteria|coperto|men[uù]|pizza|caff[eè]|\bbar\b|birra|vino|panin|kebab|sushi|gelat|pasticc|bistrot|pub\b/i], ['viaggi', /hotel|albergo|b&b|pernott|soggiorno|volo|aeroport|camping/i],
  ['tempo-libero', /cinema|teatro|concerto|museo|palestra|piscina|biglietti|spettacol/i], ['casa', /detersiv|ferrament|brico|arred|lampad|casalingh|bucato/i], ['spesa', /supermerc|ipermerc|discount|latte|pane\b|pasta|frutta|verdura|uova|formagg|carne|surgelat|yogurt|biscott/i],
];
const guessCat = (text) => { for (const [c, re] of CAT_HINTS) if (re.test(text)) return c; return ''; };
const lev = (a, b) => { const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9; let prev = Array.from({ length: n + 1 }, (_, i) => i); for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; } return prev[n]; };
/* marchi letti con un refuso ("ESSELUNCA", "C0NAD"): parole di almeno 5 lettere a distanza 1 da un marchio noto */
const storeMatchFuzzy = (text) => { const words = text.toLowerCase().replace(/[^a-z0-9à-ú\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 5); for (const [k, name, c] of STORES) { const kk = k.trim(); if (kk.length < 5 || kk.includes(' ')) continue; for (const w of words) if (lev(w, kk) <= 1) return { name, cat: c }; } return null; };
const NOISE = /scontrino|documento|commerciale|p\.? ?iva|partita|c\.?f\.|tel\.?|fax|cod\.? ?fisc|via |viale |piazza |corso |cassa|operatore|n\.? ?doc|data|ora |grazie|arrivederci|euro|totale|iva|resto|contanti|carta|bancomat|pagamento|reparto|descrizione|prezzo|qta|art\./i;
const MONTHS = { gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12, jan: 1, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, dec: 12 };
function parseReceipt(text) {
  const lines = String(text).split(/\n+/).map((l) => l.replace(/[|_]/g, ' ').replace(/\s+/g, ' ').trim()).filter((l) => l.length > 1);
  const whole = lines.join('\n'); const low = whole.toLowerCase();
  const digital = /hai pagato|hai autorizzato|hai inviato|inviato a|hai ricevuto|pagamento (?:a|di|presso|effettuato|con carta|autorizzato)|prelievo o pagamento|transazione|addebito|satispay|revolut|paypal|apple pay|google pay|bonifico|beneficiario|intesa|unicredit|poste ?pay|bancoposta|fineco|n26|hype|mooney|cr[eé]dit agricole|cartaconto|bnl|bper|banco bpm|mediolanum|carta di credito|carta di debito|con la tua carta|movimento|operazione|ore fa|minuti fa/i.test(low);
  if (digital) return parseDigital(lines, whole);
  const norm = (l) => l.replace(/(\d)[oO](?=\d)/g, '$10').replace(/[oO](?=[.,]\d\d)/g, '0').replace(/([.,]\d)[oO]\b/g, '$10').replace(/(\d)[lI|](?=\d)/g, '$11').replace(/[lI|](?=[.,]\d\d)/g, '1').replace(/([.,]\d)[lI|]\b/g, '$11');
  const amountsIn = (l) => { const out = []; const re = /(?:€\s*)?(\d{1,4}(?:[.,]\d{3})?)[.,](\d{2})(?!\d)/g; let m; const s2 = norm(l); while ((m = re.exec(s2))) { const cents = parseInt(m[1].replace(/[.,]/g, ''), 10) * 100 + parseInt(m[2], 10); if (cents > 0 && cents < 1000000) out.push(cents); } return out; };
  // totale: righe con TOTALE (non subtotale/parziale), altrimenti "importo pagato", altrimenti il più grande nella metà bassa
  let amount = 0; const isTot = (l) => /tota\s*l|t0tale|tot\.|totle|importo pagato|da pagare|netto a pagare/i.test(l) && !/sub|parz|sconto|risparm|punti|\biva\b|resto|contant/i.test(l); const totLines = lines.filter(isTot);
  for (const l of totLines) { const a = amountsIn(l); if (a.length) amount = Math.max(amount, ...a); }
  const noPay = (l) => !/resto|contant|bancomat|carta|pagamento|pos\b|cambio/i.test(l);
  if (!amount) for (const l of lines.filter((l) => /pagato|importo/i.test(l) && noPay(l))) { const a = amountsIn(l); if (a.length) { amount = Math.max(amount, ...a); } }
  if (!amount) { const tail = lines.slice(Math.floor(lines.length * 0.4)).filter(noPay); let all = []; tail.forEach((l) => (all = all.concat(amountsIn(l)))); if (all.length) amount = Math.max(...all); }
  // data
  let date = ''; for (const l of lines) { const m = norm(l).match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/); if (m) { let d = +m[1], mo = +m[2], y = +m[3]; if (y < 100) y += 2000; if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 2015 && y <= 2035) { date = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`; break; } } }
  // negozio e categoria
  let store = '', cat = ''; const sm = storeMatch(lines.slice(0, 8).join(' ')) || storeMatchFuzzy(lines.slice(0, 8).join(' ')); if (sm) { store = sm.name; cat = sm.cat; }
  if (sm && GENERIC.has(sm.name)) { const ln = lines.slice(0, 6).find((l) => l.toLowerCase().includes(sm.name.toLowerCase().replace('è', 'e').slice(0, 5)) && !/\d{3,}/.test(l)); if (ln) store = ln.toLowerCase().replace(/[^a-zà-ú0-9&'. -]/gi, ' ').replace(/\s+/g, ' ').trim().replace(/(^|\s)([a-zà-ú])/g, (x, b, c) => b + c.toUpperCase()).slice(0, 40); }
  if (!store) { const cand = lines.slice(0, 6).find((l) => /[a-zà-ú]{3,}/i.test(l) && !NOISE.test(l) && !/\d{3,}/.test(l)); if (cand) store = cand.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 40); }
  // voci dello scontrino: righe con un importo in fondo, prima del totale (finiscono nelle note)
  const items = []; const totIdx = lines.findIndex(isTot); const body = totIdx > 0 ? lines.slice(0, totIdx) : lines;
  for (const l of body) { if (NOISE.test(l) || /sub|parz|sconto|arrotond|punti|saldo|bollo|cauzion/i.test(l)) continue; const a = amountsIn(l); if (a.length !== 1) continue; const m = norm(l).match(/^\s*(?:\d+\s*[xX×]\s*)?([A-Za-zÀ-ú][A-Za-zÀ-ú0-9'&.\/ -]{2,}?)\s+(?:\d{1,2}%\s+)?(?:€\s*)?\d{1,4}(?:[.,]\d{3})?[.,]\d{2}\s*(?:€|eur)?\s*[A-Za-z%*]?\s*$/i); if (!m) continue; const name = m[1].trim().replace(/\s{2,}/g, ' '); if (name.replace(/[^A-Za-zÀ-ú]/g, '').length < 3) continue; items.push({ name: name.toLowerCase().replace(/(^|\s)([a-zà-ú])/g, (x, b, c) => b + c.toUpperCase()), cents: a[0] }); if (items.length >= 12) break; }
  if (!cat) cat = guessCat(whole);
  return { amount, date, store, cat, items, lines: lines.length };
}
/* ricevute digitali: screenshot di banca, Satispay, PayPal, notifiche di pagamento */
function parseDigital(lines, whole) {
  const norm = (l) => l.replace(/(\d)[oO](?=\d)/g, '$10').replace(/[oO](?=[.,]\d\d)/g, '0').replace(/([.,]\d)[oO]\b/g, '$10').replace(/(\d)[lI|](?=\d)/g, '$11').replace(/[lI|](?=[.,]\d\d)/g, '1').replace(/([.,]\d)[lI|]\b/g, '$11');
  const amountsIn = (l) => { const out = []; const re = /[-−]?\s*(?:€|eur)?\s*(\d{1,4}(?:[.,]\d{3})?)[.,](\d{2})(?!\d)\s*(?:€|eur)?/gi; let m; const s2 = norm(l); while ((m = re.exec(s2))) { const cents = parseInt(m[1].replace(/[.,]/g, ''), 10) * 100 + parseInt(m[2], 10); if (cents > 0 && cents < 1000000) out.push({ cents, euro: /€|eur/i.test(m[0]) }); } return out; };
  // importo: prima le righe "hai pagato / importo / pagamento / totale / addebito", poi qualsiasi importo con €, poi il più grande
  let amount = 0; const pri = lines.filter((l) => /hai pagato|hai autorizzato|hai inviato|importo|pagamento|pagato|totale|addebito|transazione|speso|prelievo/i.test(l));
  for (const l of pri) { const a = amountsIn(l); if (a.length) { amount = a[0].cents; break; } }
  if (!amount) { let all = []; lines.forEach((l) => (all = all.concat(amountsIn(l)))); const withEuro = all.filter((x) => x.euro); if (withEuro.length) amount = withEuro[0].cents; else if (all.length) amount = Math.max(...all.map((x) => x.cents)); }
  // esercente: prima quello scritto nella notifica ("presso X", "a X", "beneficiario X"), poi marchio noto, poi riga in maiuscolo
  let store = '', cat = '';
  const flat = whole.replace(/-\s*\n\s*/g, '-').replace(/\s*\n\s*/g, ' ');
  const mm = flat.match(/\b(?:presso|a favore di|beneficiario|esercente|merchant|pagamento a|pagato a|hai pagato [^\n]*? a|da)\b\s*[:\-]?\s*([A-Za-zÀ-ú0-9&'.\- ]{3,60})/i);
  if (mm) { let x = mm[1].trim().replace(/^\d{2,}\s+/, '').replace(/\s+-\s+.*$/, ''); if (/^[A-ZÀ-Ú0-9]/.test(x)) { const cut = x.search(/\s+[a-zà-ú]+\b/); if (cut > 0) x = x.slice(0, cut); } else x = x.replace(/\s+(il|lo|la|per|di|con|in|alle|€|eur).*$/i, ''); x = x.replace(/[\s.,;:-]+$/, ''); if (/^(?!(?:un|una|carta|conto|banca|te|tu|noi)$)[A-Za-zÀ-ú]/.test(x) && x.replace(/[^A-Za-zÀ-ú]/g, '').length >= 3) store = x; }
  // bonifici e invii (Satispay, PayPal…): la causale fra virgolette è la descrizione migliore, altrimenti chi ha ricevuto i soldi
  if (!store) { const note = lines.find((l) => /^["“'][^"”']{3,40}["”']$/.test(l)); const rcp = flat.match(/\binviat[oa]\b[^"“]*?\s+a\s+([A-Za-zÀ-ú][A-Za-zÀ-ú' ]{2,60})/i); if (note) store = note.slice(1, -1).trim(); else if (rcp) store = rcp[1].trim().replace(/\s+(riceverà|ricevera|ricever|potrai|per|il|la|id|transazione|nuovo|fine|cronologia|codice|data|ore|alle|oggi|ieri)\b.*$/i, '').split(/\s+/).slice(0, 4).join(' '); }
  const sm = storeMatch(store || whole); if (sm) { cat = sm.cat; if (!store || !GENERIC.has(sm.name)) store = sm.name; }
  if (!store) { const smw = storeMatch(whole); if (smw && !GENERIC.has(smw.name)) { store = smw.name; cat = smw.cat; } }
  if (!store) { const cand = lines.find((l) => /^[A-Z0-9&'. \-]{4,}$/.test(l) && !/[0-9]{3,}/.test(l) && !NOISE.test(l) && !/PAGAMENTO|IMPORTO|TOTALE|EUR|SATISPAY|PAYPAL|REVOLUT|OGGI|IERI/i.test(l)); if (cand) store = cand; }
  store = store.replace(/[.\s]+$/, '').slice(0, 40);
  // "RAMEN BAR AKIRA-BRESCIA" / "CADDY'S BRESCIA-BRESCIA" → via la città attaccata col trattino (e la stessa città ripetuta prima)
  if (/^[^a-zà-ú]*$/.test(store)) { const cm = store.match(/\s*-\s*([A-ZÀ-Ú]{3,})$/); if (cm) { store = store.slice(0, cm.index); store = store.replace(new RegExp('\\s+' + cm[1] + '$'), ''); } }
  if (store && store === store.toUpperCase()) store = store.toLowerCase().replace(/(^|[\s&(-])([a-zà-ú])/g, (a, b, c) => b + c.toUpperCase());
  else if (store && store === store.toLowerCase()) store = store.replace(/(^|\s)([a-zà-ú])/g, (a, b, c) => b + c.toUpperCase());
  if (!cat && store) { const sm2 = storeMatch(store); if (sm2) cat = sm2.cat; }
  if (!cat) cat = guessCat(store + ' ' + whole);
  // data: gg/mm/aaaa, "5 set 2026", "5 settembre 2026", oggi/ieri
  let date = '';
  for (const l of lines) { const m = norm(l).match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/); if (m) { let d = +m[1], mo = +m[2], y = +m[3]; if (y < 100) y += 2000; if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 2015 && y <= 2035) { date = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`; break; } } }
  if (!date) { const m = whole.match(/(\d{1,2})\s+(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic|jan|may|jun|jul|aug|sep|oct|dec)[a-z]*\.?\s*(\d{4})?/i); if (m) { const y = m[3] ? +m[3] : new Date().getFullYear(); const mo = MONTHS[m[2].toLowerCase()]; const d = +m[1]; if (mo && d >= 1 && d <= 31) date = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`; } }
  if (!date && /\bieri\b/i.test(whole)) { const x = new Date(); x.setDate(x.getDate() - 1); date = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
  return { amount, date, store, cat, lines: lines.length, digital: true };
}
let ocrLib = null, pendingScan = null;
function loadOCR() {
  if (ocrLib) return Promise.resolve(ocrLib);
  return new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'; sc.onload = () => { ocrLib = window.Tesseract; res(ocrLib); }; sc.onerror = () => rej(new Error('Serve la rete per scaricare il lettore la prima volta')); document.head.appendChild(sc); });
}
/* geometria della foto, calcolata una sola volta: dov'è il foglio (ritaglio) e di quanto è storto (raddrizzamento) */
async function analyzeGeometry(bmp) {
  const SW = 320; const k = Math.min(1, SW / Math.max(bmp.width, bmp.height)); const w = Math.max(8, Math.round(bmp.width * k)), h = Math.max(8, Math.round(bmp.height * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d'); ctx.drawImage(bmp, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data; const n = w * h; const g = new Uint8Array(n); const hist = new Uint32Array(256);
  for (let i = 0, j = 0; i < n; i++, j += 4) { const v = (d[j] * .3 + d[j + 1] * .59 + d[j + 2] * .11) | 0; g[i] = v; hist[v]++; }
  // soglia di Otsu: separa foglio chiaro e sfondo scuro
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i]; let sumB = 0, wB = 0, best = 0, thr = 128; for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = n - wB; if (!wF) break; sumB += t * hist[t]; const mB = sumB / wB, mF = (sum - sumB) / wF; const v = wB * wF * (mB - mF) * (mB - mF); if (v > best) { best = v; thr = t; } }
  const rows = new Float32Array(h), cols = new Float32Array(w); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y * w + x] > thr) { rows[y]++; cols[x]++; }
  const run = (arr, len, other) => { let bi = -1, bl = 0, i = 0; while (i < len) { if (arr[i] / other > 0.5) { let j = i, gap = 0; while (j < len && (arr[j] / other > 0.5 || gap < Math.max(2, len * 0.03))) { gap = arr[j] / other > 0.5 ? 0 : gap + 1; j++; } j -= gap; if (j - i > bl) { bl = j - i; bi = i; } i = j; } i++; } return bl > 0 ? [bi, bi + bl] : null; };
  const ry = run(rows, h, w), rx = run(cols, w, h); let crop = null;
  if (ry && rx) { const area = (ry[1] - ry[0]) * (rx[1] - rx[0]); if (area < n * 0.6 && (ry[1] - ry[0]) > h * 0.25 && (rx[1] - rx[0]) > w * 0.25) { const mx = Math.round(w * 0.02), my = Math.round(h * 0.02); crop = { x: Math.max(0, rx[0] - mx) / k, y: Math.max(0, ry[0] - my) / k, w: Math.min(w, rx[1] + mx) / k, h: Math.min(h, ry[1] + my) / k }; crop.w -= crop.x; crop.h -= crop.y; } }
  // raddrizzamento: provo vari angoli e tengo quello in cui le righe di testo sono più "compatte"
  const cx0 = crop ? Math.round(crop.x * k) : 0, cy0 = crop ? Math.round(crop.y * k) : 0, cw = crop ? Math.round(crop.w * k) : w, ch = crop ? Math.round(crop.h * k) : h;
  let m = 0, cnt = 0; for (let y = cy0; y < cy0 + ch; y++) for (let x = cx0; x < cx0 + cw; x++) { m += g[y * w + x]; cnt++; } m /= Math.max(1, cnt);
  const pts = []; const darkText = m >= 110; for (let y = cy0; y < cy0 + ch; y++) for (let x = cx0; x < cx0 + cw; x++) { const v = g[y * w + x]; if (darkText ? v < m - 40 : v > m + 40) pts.push(x - cx0 - cw / 2, y - cy0 - ch / 2); }
  let angle = 0;
  if (pts.length > 200 && pts.length < cw * ch * 0.5) {
    const score = (a) => { const r = a * Math.PI / 180, co = Math.cos(r), si = Math.sin(r); const H = new Float32Array(ch + 2); for (let i = 0; i < pts.length; i += 2) { const yy = Math.round(pts[i + 1] * co - pts[i] * si + ch / 2); if (yy >= 0 && yy < ch) H[yy]++; } let sq = 0; for (let i = 0; i < ch; i++) sq += H[i] * H[i]; return sq; };
    let bestA = 0, bestS = -1; for (let a = -8; a <= 8; a += 1) { const sc = score(a); if (sc > bestS) { bestS = sc; bestA = a; } }
    for (const a of [bestA - 0.5, bestA + 0.5]) { const sc = score(a); if (sc > bestS) { bestS = sc; bestA = a; } }
    if (Math.abs(bestA) >= 0.6 && bestS > score(0) * 1.08) angle = bestA;
  }
  return { crop, angle, mean: m };
}
async function prepareImage(file, mode, quarter, nogeo) {
  if (!file.__bmp) { try { file.__bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (_) { file.__bmp = await createImageBitmap(file); } }
  const bmp = file.__bmp; if (!file.__geom) { try { file.__geom = await analyzeGeometry(bmp); } catch (_) { file.__geom = { crop: null, angle: 0, mean: 128 }; } }
  const geo = nogeo ? { crop: null, angle: 0, mean: file.__geom.mean } : file.__geom; const src = geo.crop || { x: 0, y: 0, w: bmp.width, h: bmp.height };
  // foto grandi rimpicciolite, screenshot piccoli (notifiche) ingranditi: il lettore vuole lettere alte almeno 25-30 px
  const k = Math.min(2, 1800 / Math.max(src.w, src.h)); const sw = Math.round(src.w * k), sh = Math.round(src.h * k); const q = quarter || 0;
  const w = q % 2 ? sh : sw, h = q % 2 ? sw : sh;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = geo.mean < 110 ? '#000' : '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2); ctx.rotate((q * 90 - geo.angle) * Math.PI / 180); ctx.drawImage(bmp, src.x, src.y, src.w, src.h, -sw / 2, -sh / 2, sw, sh); ctx.setTransform(1, 0, 0, 1, 0, 0);
  const img = ctx.getImageData(0, 0, w, h); const d = img.data; const n = w * h; const g = new Uint8ClampedArray(n); let sum = 0;
  for (let i = 0, j = 0; i < n; i++, j += 4) { const v = d[j] * .3 + d[j + 1] * .59 + d[j + 2] * .11; g[i] = v; sum += v; }
  const mean = sum / n; const dark = mean < 110;
  if (mode === 'adaptive-dark' || mode === 'adaptive-light') {
    // soglia locale (media in una finestra intorno al pixel): funziona anche con sfondi non uniformi,
    // tipo una notifica semitrasparente sopra una foto o uno scontrino fotografato con luce di lato
    const W = w + 1; const I = new Float64Array(W * (h + 1));
    for (let y = 1; y <= h; y++) { let row = 0; const o = y * W, po = (y - 1) * W, go = (y - 1) * w; for (let x = 1; x <= w; x++) { row += g[go + x - 1]; I[o + x] = I[po + x] + row; } }
    const r = Math.max(14, Math.round(Math.min(w, h) / 14)); const C = 12; const light = mode === 'adaptive-light';
    for (let y = 0; y < h; y++) { const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1); for (let x = 0; x < w; x++) { const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1); const m = (I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0]) / ((y1 - y0) * (x1 - x0)); const v = g[y * w + x]; const isText = light ? v > m + C : v < m - C; const o = (y * w + x) * 4; d[o] = d[o + 1] = d[o + 2] = isText ? 0 : 255; } }
  } else {
    const boost = mode === 'boost';
    for (let i = 0, j = 0; i < n; i++, j += 4) { let v = dark ? 255 - g[i] : g[i]; if (boost) { const mm = dark ? 255 - mean : mean; v = (v - mm) * 1.35 + mm + 10; } d[j] = d[j + 1] = d[j + 2] = v < 0 ? 0 : v > 255 ? 255 : v; }
  }
  ctx.putImageData(img, 0, 0); c.__mean = mean; return c;
}
let ocrWorker = null, ocrIdle = null;
async function getWorker(T, onProgress) {
  clearTimeout(ocrIdle);
  if (!ocrWorker) { ocrWorker = await T.createWorker('ita', 1, { logger: (m) => onProgress && onProgress(m) }); await ocrWorker.setParameters({ preserve_interword_spaces: '1' }); }
  ocrProgress = onProgress; return ocrWorker;
}
let ocrProgress = null;
/* il lettore resta pronto 90 s dopo l'ultima lettura: la seconda foto di fila parte subito */
const releaseWorker = () => { clearTimeout(ocrIdle); ocrIdle = setTimeout(async () => { const w = ocrWorker; ocrWorker = null; if (w) { try { await w.terminate(); } catch (_) {} } }, 90000); };
async function scanReceipt(file) {
  openSheet('Lettura dello scontrino', `<div class="scan-box"><div class="scan-prev" id="scan-prev"></div><div class="scan-t" id="scan-t">Preparo la foto…</div><div class="scan-bar"><i id="scan-bar"></i></div><p class="small muted" style="margin:10px 0 0">La lettura avviene sul telefono: la foto non viene inviata da nessuna parte.</p></div>`);
  const setP = (t, p) => { const el = $('#scan-t'); if (el) el.textContent = T(t); const b = $('#scan-bar'); if (b) b.style.width = Math.round(p * 100) + '%'; };
  let pass = 0;
  try {
    setP('Scarico il lettore…', .05);
    const Tess = await loadOCR();
    const worker = await getWorker(Tess, (m) => { if (m.status === 'recognizing text') setP((pass ? `Rileggo (${pass + 1}ª volta)… ` : 'Leggo lo scontrino… ') + Math.round(m.progress * 100) + '%', .2 + Math.min(.75, (pass + m.progress) * .18)); else if (/load|init/i.test(m.status)) setP('Preparo il lettore…', .1); });
    // primo passaggio in scala di grigi (foglio ritagliato e raddrizzato), poi soglia adattiva nelle due polarità, poi contrasto forzato;
    // se il testo resta illeggibile provo la foto girata di 90° e 270°. Mi fermo appena trovo importo e negozio.
    const first = await prepareImage(file, 'gray'); const darkShot = first.__mean < 128;
    const pv = $('#scan-prev'); if (pv) { const t = document.createElement('canvas'); const kk = Math.min(1, 240 / first.width, 120 / first.height); t.width = Math.round(first.width * kk); t.height = Math.round(first.height * kk); t.getContext('2d').drawImage(first, 0, 0, t.width, t.height); pv.appendChild(t); }
    const plan = [['gray', '4', 0], [darkShot ? 'adaptive-light' : 'adaptive-dark', '4', 0], [darkShot ? 'adaptive-dark' : 'adaptive-light', '4', 0], ['gray', '4', 0, true], ['boost', '6', 0], ['gray', '4', 1], ['gray', '4', 3]];
    const alnum = (t) => (t.match(/[A-Za-z0-9]/g) || []).length;
    const score = (x, conf) => (x.amount ? 2 : 0) + (x.store ? 1 : 0) + (x.date ? .3 : 0) + (conf || 0) / 200;
    let r = null, txt = '', best = -1, seenText = 0;
    for (pass = 0; pass < plan.length; pass++) {
      const [mode, psm, quarter, nogeo] = plan[pass];
      if (quarter && seenText >= 20) break; // le rotazioni servono solo se la foto è illeggibile
      if (nogeo && !(file.__geom && file.__geom.crop)) continue; // senza ritaglio: solo se un ritaglio c'era
      await worker.setParameters({ tessedit_pageseg_mode: psm });
      const cv = pass === 0 ? first : await prepareImage(file, mode, quarter, nogeo);
      const { data } = await worker.recognize(cv); const t = data.text || ''; const x = parseReceipt(t); const sc = score(x, data.confidence); seenText = Math.max(seenText, alnum(t));
      window.PARI && (window.PARI.lastConf = data.confidence, window.PARI.lastPasses = pass + 1);
      if (sc > best) { best = sc; txt = t; r = r ? { ...x, store: x.store || r.store, date: x.date || r.date, cat: x.cat || r.cat, items: (x.items && x.items.length) ? x.items : r.items } : x; } else if (r) { r = { ...r, store: r.store || x.store, date: r.date || x.date, cat: r.cat || x.cat, items: (r.items && r.items.length) ? r.items : x.items }; }
      if (r.amount && r.store) break;
    }
    releaseWorker(); window.PARI && (window.PARI.lastOCR = txt, window.PARI.lastParsed = r, window.PARI.lastGeom = file.__geom); closeSheet();
    if (!r.amount && !r.store) { toast('Non riesco a leggere lo scontrino: prova con più luce e inquadratura dritta'); return; }
    F.scanned = true;
    if (r.store) { F.desc = r.store; const d = $('#desc'); if (d) d.value = r.store; }
    if (r.amount) { F.amount = moneyPlain(r.amount); const a = $('#amount'); if (a) { a.value = F.amount; a.dispatchEvent(new Event('input', { bubbles: true })); } }
    if (r.date) { F.date = r.date; const dt = $('#date'); if (dt) dt.value = r.date; }
    if (r.cat) { F.cat = r.cat; $$('.cat-circle').forEach((x) => x.classList.toggle('on', x.dataset.cat === F.cat)); const cn = $('#cat-name'); if (cn) cn.textContent = T(catOf(F.cat).name); }
    // le voci dello scontrino finiscono nelle note, se sono vuote
    const items = (r.items || []).filter((it) => !r.amount || it.cents <= r.amount);
    if (items.length >= 2 && !(F.notes || '').trim()) { F.notes = items.map((it) => `${it.name} ${moneyPlain(it.cents)}`).join(' · '); const nt = $('#notes'); if (nt) nt.value = F.notes; }
    $$('.scan-fill').forEach((x) => x.classList.remove('scan-fill')); ['#desc', '#amount', '#date', '#notes'].forEach((sel) => { const el = $(sel); if (el && el.value) el.classList.add('scan-fill'); });
    toast(r.amount ? T('Letto: {0} · {1}. Controlla e conferma', T(r.store || 'scontrino'), money(r.amount)) + (items.length >= 2 ? ' ' + T('({0} voci nelle note)', items.length) : '') : 'Ho trovato il negozio ma non il totale: scrivilo tu');
  } catch (e) { releaseWorker(); closeSheet(); console.warn('ocr', e); toast(e.message && /rete/.test(e.message) ? e.message : 'Lettura non riuscita: riprova con una foto più nitida'); }
}

/* ---------- Conferma dopo aver aggiunto una spesa o un pagamento ---------- */
function pageDone(r) {
  const e = S.entries.find((x) => x.id === r.id);
  if (!e) { setTimeout(() => go('#/home'), 0); return '<div class="page"></div>'; }
  const isPay = e.kind === 'payment'; const c = catOf(e.cat); const payer = member(e.paidBy); const to = isPay ? member(Object.keys(e.owed || {})[0]) : null;
  const sub = isPay ? `a ${esc(to ? to.name : '')}` : (e.notes ? esc(e.notes) : esc(c.name));
  return `<div class="page onb done">
    <div class="done-art"><img src="img/fatto.png" alt=""></div>
    <h1 class="done-h">${isPay ? 'Pagamento registrato!' : 'Pagamento aggiunto!'}<svg class="done-line" viewBox="0 0 220 12" preserveAspectRatio="none"><path d="M3 8 C 60 2, 150 2, 217 7" fill="none" stroke="#A9D3B6" stroke-width="5" stroke-linecap="round"/></svg></h1>
    <p class="done-p">Tutto ok, l'abbiamo salvato.</p>
    <div class="done-card"><span class="cat-ic${isPay ? ' pay' : ''}">${icon(isPay ? 'c-pagamento' : c.icon)}</span><div class="done-txt"><b>${esc(isPay ? 'Pagamento' : e.desc)}</b><span>${sub}</span><span>${esc(dateShort(e.date))} ${esc(String(e.date).slice(0, 4))} • ${esc(payer.name)}</span></div><span class="done-amt">${esc(curSymbol())} ${esc(moneyPlain(e.amount))}<em class="xp-tag got" data-no-i18n>+${entryXp(e)} XP</em></span></div>
    ${!isPay && (myBudget().monthly || 0) > 0 ? (() => { const bm = budgetMonth(ym(e.date)); const pct = Math.round(bm.spent / bm.budget * 100); return `<div class="done-budget ${budgetCls(pct)}"><span>${esc(T('Il tuo budget: {0} su {1} ({2}%)', money(bm.spent), money(bm.budget), pct))}</span><i class="db-bar"><b style="width:${Math.min(100, pct)}%"></b></i></div>`; })() : ''}
    <div class="done-actions"><a class="btn onb-btn" href="#/home">Perfetto!</a><a class="done-link" href="#/nuova${isPay ? '?tipo=pagamento' : ''}">${isPay ? 'Registra un altro pagamento' : 'Aggiungi un altro pagamento'}</a></div>
    <svg class="done-sq l" viewBox="0 0 120 90" aria-hidden="true"><path d="M8 70 C 25 20, 45 25, 40 55 C 36 80, 60 85, 75 35" fill="none" stroke="#B9D9C4" stroke-width="7" stroke-linecap="round"/></svg>
    <svg class="done-sq r" viewBox="0 0 120 90" aria-hidden="true"><path d="M10 60 C 30 20, 50 35, 55 60 C 60 85, 85 80, 110 30" fill="none" stroke="#B9D9C4" stroke-width="7" stroke-linecap="round"/></svg>
  </div>`;
}

/* ---------- Presentazione per chi apre l'app la prima volta ---------- */
let OB = { step: 1, name: '', partner: '', house: '', avatar: -1, split: 'equal', pct: 50 };
const JOIN_KEY = 'pari:join';
const newHouseCode = () => { const A = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; const r = crypto.getRandomValues(new Uint8Array(6)); for (let i = 0; i < 6; i++) c += A[r[i] % A.length]; return c; };
function rememberHouse() { const h = S.settings.sync.house; if (h && auth.user() && ((auth.user().user_metadata || {}).house !== h)) auth.updateMeta({ house: h }); }
function restoreHouseFromAccount() { const u = auth.user(); const h = u && u.user_metadata && u.user_metadata.house; if (h && !S.settings.sync.house) { S.settings.sync.house = h; S.settings.lastPull = null; S.settings.lastPush = null; save(); return true; } return false; }
function ensureHouse() { if (!S.settings.sync.house) { if (!restoreHouseFromAccount()) { const m = mainSection(); S.settings.sync.house = (m && m.code) || newSectionCode(); S.settings.lastPull = null; S.settings.lastPush = null; save(); } migrateSections(); if (sync.enabled()) sync.run(true); } rememberHouse(); return S.settings.sync.house; }
const sectionLink = (g) => appUrl() + '#/join/' + encodeURIComponent(g.code);
const sectionInviteText = (g) => T('Unisciti alla mia sezione «{0}» su Divvy per dividere le spese: {1}', g.name, sectionLink(g));
const inviteLink = () => appUrl() + '#/join/' + encodeURIComponent(ensureHouse());
const inviteText = () => T('Unisciti al mio gruppo su Divvy per dividere le spese: {0}', inviteLink());
/* chi apre un link di invito: il codice del gruppo viene salvato e applicato dopo l'accesso */
function applyJoin(code) { if (!code) return false; joinSection(code); return true; }
/* ---------- Entrare in una sezione con il codice, uscirne, togliere qualcuno (solo chi l'ha creata) ---------- */
const requestRow = (g, r) => ({ house: g.code, id: 'req-' + r.id, kind: 'request', data: { id: r.id, legacy: r.legacy, name: r.name, color: r.color, avatar: r.avatar, at: r.at, status: r.status, section: g.name, by: r.by }, updated_at: r.updatedAt || nowISO(), deleted: false });
const codeVariants = (code) => [...new Set([code, code.toUpperCase(), code.toLowerCase()])];
/* con un codice si CHIEDE di entrare: la richiesta arriva a chi ha creato la sezione, che accetta o rifiuta. Se risulto già fra i membri (per esempio dopo una reinstallazione) entro subito. */
async function joinSection(code0) {
  const code = String(code0 || '').trim(); if (!code) return false;
  const local = S.groups.find((g) => g.code && codeVariants(code).includes(g.code));
  if (local && !local.deleted && !local.left && inSection(local, me().id)) { toast(T('Sei già nella sezione «{0}»', local.name)); return true; }
  const pend = (S.settings.pendingJoins || []).find((p) => codeVariants(code).includes(p.code)); if (pend) { toast(T('Hai già chiesto di entrare in «{0}»', pend.name)); return true; }
  const s = S.settings.sync; if (!s.url || !s.key) { toast('Serve la sincronizzazione'); return false; }
  toast('Cerco la sezione…');
  for (const c of codeVariants(code)) {
    let rows; try { rows = await sync.fetchRows(s.url + '/rest/v1/pari_rows?house=eq.' + encodeURIComponent(c) + '&id=eq.section&deleted=eq.false'); } catch (e) { toast('Non riesco a collegarmi'); return false; }
    const row = rows && rows[0]; if (!row || !row.data || row.data.deleted) continue;
    const d = row.data; const meId = me().id; const mine = (d.members || {})[meId];
    if (mine && !mine.leftAt) return enterSection(row, c);
    const now = nowISO(); const p = me();
    try { await sync.post([{ house: c, id: 'req-' + meId, kind: 'request', data: { id: meId, legacy: p.legacy, name: p.name, color: p.color, avatar: p.avatar, at: now, status: 'pending', section: d.name }, updated_at: now, deleted: false }]); } catch (e) { toast('Non riesco a collegarmi'); return false; }
    const ownerName = ((d.people || []).find((x) => x.id === d.owner) || {}).name || '';
    S.settings.pendingJoins = (S.settings.pendingJoins || []).filter((x) => x.code !== c).concat([{ code: c, name: d.name, owner: ownerName, at: now }]); save(); render();
    toast(T('Richiesta inviata: chi ha creato «{0}» può accettarla', d.name)); return true;
  }
  toast('Codice non trovato. Chi te l\'ha dato deve avere l\'app aggiornata.'); return false;
}
/* entro davvero nella sezione (accettato, o già membro) */
async function enterSection(row, c) {
  const now = nowISO(); mergeSection(row.data, row.updated_at);
  const g = S.groups.find((x) => x.id === row.data.id); if (!g) return false;
  g.left = false; g.deleted = false; g.code = g.code || c; g.members = g.members || {}; if (!g.members[me().id] || g.members[me().id].leftAt) g.members[me().id] = { joinedAt: now, updatedAt: now }; g.updatedAt = now;
  S.settings.groupsUpdatedAt = now; S.settings.membersUpdatedAt = nowISO(); if (S.settings.push) S.settings.pushUpdatedAt = now;
  if (!S.settings.sync.house) { S.settings.sync.house = g.code; rememberHouse(); }
  S.settings.lastPush = null; save();
  try { await sync.run(true); await sync.pullHouse(g.code); } catch (_) {}
  toast(T('Sei nella sezione «{0}»', g.name)); render(); return true;
}
/* le mie richieste in attesa: a ogni sincronizzazione guardo se chi ha creato la sezione ha risposto */
async function checkPendingJoins() {
  const list = S.settings.pendingJoins || []; if (!list.length || !sync.enabled()) return; const s = S.settings.sync; let changed = false;
  for (const p of list.slice()) {
    let rows; try { rows = await sync.fetchRows(s.url + '/rest/v1/pari_rows?house=eq.' + encodeURIComponent(p.code) + '&id=in.(section,' + encodeURIComponent('req-' + me().id) + ')'); } catch (_) { continue; }
    const req = rows.find((r) => r.kind === 'request'); const sec = rows.find((r) => r.kind === 'section'); const st = req && req.data && req.data.status;
    const drop = () => { S.settings.pendingJoins = (S.settings.pendingJoins || []).filter((x) => x.code !== p.code); changed = true; };
    if (st === 'accepted' && sec && sec.data) { drop(); save(); await enterSection(sec, p.code); }
    else if (st === 'refused') { drop(); toast(T('Richiesta per «{0}» rifiutata', p.name)); }
    else if (!sec || (sec.data && sec.data.deleted)) { drop(); }
  }
  if (changed) { save(); render(); }
}
async function cancelJoin(code) {
  const p = (S.settings.pendingJoins || []).find((x) => x.code === code); if (!p) return;
  try { await sync.post([{ house: code, id: 'req-' + me().id, kind: 'request', data: { id: me().id, status: 'cancelled' }, updated_at: nowISO(), deleted: true }]); } catch (_) {}
  S.settings.pendingJoins = S.settings.pendingJoins.filter((x) => x.code !== code); save(); render(); toast('Richiesta annullata');
}
/* chi ha creato la sezione risponde */
async function acceptRequest(g, id) {
  const r = (g.requests || {})[id]; if (!r) return; const now = nowISO();
  mergePeople([{ id: r.id, legacy: r.legacy, name: r.name, color: r.color, avatar: r.avatar }], now);
  const who = pid(r.id); g.members = g.members || {}; g.members[who] = { joinedAt: now, updatedAt: now, by: me().id }; g.updatedAt = now; r.status = 'accepted'; r.updatedAt = now; r.by = me().id;
  S.settings.groupsUpdatedAt = now; S.settings.membersUpdatedAt = now; save();
  try { await sync.post([...sync.outgoing('', true).filter((x) => x.house === g.code && x.kind === 'section'), requestRow(g, r)]); } catch (_) {}
  sync.schedule(); render(); toast(T('{0} è nella sezione «{1}»', r.name, g.name));
}
async function refuseRequest(g, id) {
  const r = (g.requests || {})[id]; if (!r) return; const now = nowISO(); r.status = 'refused'; r.updatedAt = now; r.by = me().id; save();
  try { await sync.post([requestRow(g, r)]); } catch (_) {}
  render(); toast('Richiesta rifiutata');
}
async function leaveSection(g) {
  const now = nowISO(); g.members = g.members || {}; g.members[me().id] = { ...(g.members[me().id] || { joinedAt: now }), leftAt: now, updatedAt: now }; g.updatedAt = now; S.settings.groupsUpdatedAt = now; save();
  try { await sync.post(sync.outgoing('', true).filter((r) => r.house === g.code && r.kind === 'section')); } catch (_) {}
  g.left = true; if (S.settings.lastGroup === g.id) S.settings.lastGroup = (groups()[0] || {}).id || null; save(); toast(T('Hai lasciato la sezione «{0}»', g.name));
}
function removeMember(g, id) { const now = nowISO(); g.members = g.members || {}; const cur = g.members[id] || { joinedAt: now }; g.members[id] = { ...cur, leftAt: now, by: me().id, updatedAt: now }; g.updatedAt = now; S.settings.groupsUpdatedAt = now; save(); sync.schedule(); }
function applyPendingJoin() { let code = ''; try { code = localStorage.getItem(JOIN_KEY) || ''; localStorage.removeItem(JOIN_KEY); } catch (_) {} if (code) applyJoin(code); }
const AVATAR_IMGS = ['avatar-1.png', 'avatar-2.png', 'avatar-3.png', 'avatar-4.png', 'avatar-5.png'];
const avatarPicker = (sel, attr) => `<div class="onb-avatars">${AVATAR_IMGS.map((f, i) => `<button type="button" class="onb-av img${sel === i ? ' on' : ''}" ${attr}="${i}" aria-label="Avatar ${i + 1}"><img src="img/${f}" alt=""></button>`).join('')}</div>`;
const AVATARS = [{ bg: '#2C4A3B', fg: '#F8F4EE' }, { bg: '#F8D9D2', fg: '#D7563C' }, { bg: '#D3E7F5', fg: '#4E8FBF' }, { bg: '#E0DBF3', fg: '#7B68B8' }, { bg: '#D3E6D8', fg: '#4C8A66' }, { bg: '#F7E7C3', fg: '#C99A2E' }];
const arrowIc = '<svg class="ic"><path d="M5 12h14M13 5l7 7-7 7"/></svg>';
function pageWelcome() {
  const st = OB.step; const dots = `<div class="onb-dots" style="view-transition-name:onb-dots">${[1, 2, 3, 4].map((i) => `<i class="${i === st ? 'on' : ''}"></i>`).join('')}</div>`;
  const top = `<div class="onb-top"><div class="onb-left">${st > 1 ? `<button type="button" class="icon-btn onb-back" data-ob-back aria-label="Indietro">${icon('i-back')}</button>` : ''}${langPill()}</div><button type="button" class="onb-skip" data-ob-skip>Salta</button></div>`;
  let body = '';
  if (st === 1) body = `<img class="onb-logo" src="img/logo.png" alt="Divvy">
    <h1 class="onb-h">Ciao!<br>Come possiamo chiamarti?</h1><p class="onb-p">È il primo passo per iniziare a condividere le spese insieme.</p>
    <div class="onb-art"><img src="img/benvenuto.png" alt=""></div>
    <form class="onb-form" data-ob-form><label class="onb-field">${icon('i-user')}<input id="ob-name" type="text" placeholder="Il tuo nome" value="${esc(OB.name)}" autocomplete="given-name" autocapitalize="words" enterkeyhint="next"></label>
    <div class="onb-lbl">Scegli un avatar <small>(opzionale)</small></div>${avatarPicker(OB.avatar, 'data-ob-av')}
    <button class="btn onb-btn" type="submit">Continua ${arrowIc}</button></form>`;
  else if (st === 2) { const link = inviteLink(); const shown = link.replace(/^https?:\/\//, '');
    body = `<img class="onb-logo" src="img/logo.png" alt="Divvy">
    <h1 class="onb-h">Condividi il link<br>del tuo gruppo</h1><p class="onb-p">Invita le persone con cui vuoi dividere le spese. Basta che clicchino sul link per unirsi al gruppo!</p>
    <div class="onb-art"><img src="img/invito.png" alt=""></div>
    <div class="inv-card">
      <div class="inv-head"><span class="inv-ic">${icon('i-link')}</span><div><b>Il tuo link di invito</b><span>Condividi questo link con chi vuoi far unire al gruppo. Quando lo aprirà verrà aggiunto automaticamente.</span></div></div>
      <div class="inv-link"><span class="inv-url">${esc(shown)}</span><button type="button" class="inv-copy" data-copy-link><span class="l1">Copia ${icon('i-copy')}</span><span class="l2">Copiato ${icon('i-check')}</span></button></div>
      <div class="inv-share">
        <button type="button" data-share="whatsapp"><span class="inv-circle wa">${icon('i-whatsapp')}</span>WhatsApp</button>
        <button type="button" data-share="telegram"><span class="inv-circle tg">${icon('i-telegram')}</span>Telegram</button>
        <button type="button" data-share="sms"><span class="inv-circle sms">${icon('i-sms')}</span>SMS</button>
        <button type="button" data-share="more"><span class="inv-circle">${icon('i-more')}</span>Altro</button>
      </div>
    </div>
    <div class="onb-info"><span class="inv-ic">${icon('i-users')}</span><div><b>Unirsi è semplice</b><span>Chiunque abbia il link potrà unirsi al gruppo in un solo clic, senza bisogno di un account.</span></div></div>
    <div class="onb-info"><span class="inv-ic">${icon('i-shield')}</span><div><b>Link sicuro</b><span>Puoi sempre disattivare il link o generarne uno nuovo dalle impostazioni del gruppo.</span></div></div>
    <form class="onb-form" data-ob-form><button class="btn onb-btn" type="submit">Continua ${arrowIc}</button></form>`; }
  else if (st === 3 && !isCoupleAccount()) { const cur = S.settings.currency || 'EUR'; const top = ['EUR', 'USD', 'GBP', 'CHF'];
    body = `<img class="onb-logo" src="img/logo.png" alt="Divvy">
    <h1 class="onb-h onb-dark">Con quale valuta<br>usi Divvy?</h1><p class="onb-p">Vale per tutte le tue spese. Potrai cambiarla quando vuoi dalle impostazioni.</p>
    <form class="onb-form" data-ob-form>
      <label class="search" style="margin-bottom:8px">${icon('i-search')}<input id="ob-cur-q" type="search" placeholder="Cerca una valuta…" autocomplete="off"></label>
      <section class="card list-card onb-cur"><div class="list" id="ob-cur-list">${[...CURRENCIES.filter(([c]) => top.includes(c)), ...CURRENCIES.filter(([c]) => !top.includes(c))].map(([code, name]) => currencyRow(code, name, cur, 'data-ob-cur')).join('')}</div></section>
      <button class="btn onb-btn" type="submit">Continua ${arrowIc}</button></form>`; }
  else if (st === 3) { const pm = OB.pct, po = 100 - OB.pct;
    body = `<img class="onb-logo" src="img/logo.png" alt="Divvy">
    <h1 class="onb-h onb-dark">Come vuoi<br>dividere le spese?</h1><p class="onb-p">Imposta una modalità predefinita. Potrai cambiarla per ogni singola spesa.</p>
    <div class="onb-art"><img src="img/benvenuto-3.png" alt=""></div>
    <form class="onb-form" data-ob-form>
      <button type="button" class="onb-opt${OB.split === 'equal' ? ' on' : ''}" data-ob-split="equal"><span class="radio"></span><span class="txt"><b>Metà e metà</b><small>50% / 50% per ogni spesa</small></span>${icon('i-users')}</button>
      <button type="button" class="onb-opt${OB.split === 'custom' ? ' on' : ''}" data-ob-split="custom"><span class="radio"></span><span class="txt"><b>Personalizzato</b><small>Scegli tu le percentuali</small></span>${icon('i-sliders')}</button>
      <div class="onb-pct" id="onb-pct" ${OB.split === 'custom' ? '' : 'hidden'}><div class="row-between"><span>${esc(OB.name || me().name)} <b id="pct-me">${pm}%</b></span><span><b id="pct-other">${po}%</b> ${esc(OB.partner || other().name)}</span></div><input type="range" id="pct-range" min="5" max="95" step="5" value="${pm}" aria-label="Percentuale a tuo carico"></div>
      <button class="btn onb-btn" type="submit">Continua ${arrowIc}</button></form>`; }
  else { const a = me(), b = other(); const sp = S.settings.split || { mode: 'equal' }; const pm = sp.mode === 'custom' ? sp.pct[a.id] : 50;
    body = `<img class="onb-logo" src="img/logo.png" alt="Divvy">
    <h1 class="onb-h onb-dark">Tutto pronto,<br>${esc(a.name)}! <span aria-hidden="true">🎉</span></h1><p class="onb-p">Da ora tenere i conti sarà molto più semplice.</p>
    <div class="onb-art"><img src="img/benvenuto-4.png" alt=""></div>
    <div class="onb-summary"><div class="row-between"><b class="onb-sum-t">Il tuo riepilogo</b><button type="button" class="onb-edit" data-ob-edit>Modifica</button></div>
      <div class="onb-people"><span>${avatar(a, true)}${esc(a.name)}</span>${isCoupleAccount() && hasOthers() ? `<span>${avatar(b, true)}${esc(b.name)}</span>` : ''}</div>
      ${isCoupleAccount() ? `<div class="onb-kv">${icon('i-balance')}<span>Divisione predefinita</span><b>${pm}% / ${100 - pm}%</b></div>` : ''}
      <div class="onb-kv">${icon('i-coins')}<span>Valuta</span><b>${esc(currencyName(S.settings.currency || 'EUR'))} (${esc(curSymbol())})</b></div></div>
    <div class="onb-form"><button type="button" class="btn onb-btn" data-ob-finish>Inizia con Divvy ${arrowIc}</button></div>`; }
  return `<div class="page onb steps" style="view-transition-name:onb-stage">${top}${body}${dots}</div>`;
}
function obGo(step, dir) {
  OB.step = step; const doRender = () => render();
  if (document.startViewTransition) { document.documentElement.dataset.obDir = dir || 'next'; const t = document.startViewTransition(doRender); t.finished.catch(() => {}).finally(() => { delete document.documentElement.dataset.obDir; }); if (t.ready) t.ready.catch(() => {}); }
  else doRender();
}
function obFinish() {
  S.settings.onboarded = true; const u = auth.user(); if (u) { S.settings.onboardedFor = u.id; auth.updateMeta({ onboarded: true }); } save(); const nm = me().name; OB = { step: 1, name: '', partner: '', house: '', avatar: -1, split: 'equal', pct: 50 };
  go('#/home'); if (!tutorialDone()) setTimeout(startTour, 700);
  if (!sync.enabled()) toast(`Per condividere con ${otherName()}: Profilo → Backup e sincronizzazione`); else if (!S.settings.push) toast('Attiva gli avvisi da Profilo → Notifiche'); else toast(`Divvy è pronta, ${nm}`);
}
function bindWelcome() {
  $$('[data-ob-skip]').forEach((b) => b.addEventListener('click', obFinish));
  // cambio lingua dalla presentazione: tengo il nome già scritto e ridisegno il passo nella lingua nuova
  $$('[data-lang-pick]').forEach((b) => b.addEventListener('click', () => openLangSheet(() => { const n = $('#ob-name'); if (n) OB.name = n.value; })));
  const form = $('[data-ob-form]');
  if (form) form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (OB.step === 1) { const n = ($('#ob-name').value || '').trim(); if (!n) { $('#ob-name').focus(); return; } OB.name = n;
      migrateIdentity(); me().name = n; S.settings.membersUpdatedAt = nowISO(); /* l'identità è l'account: il nome va sulla mia persona */
      if (OB.avatar >= 0 && AVATAR_IMGS[OB.avatar]) { me().avatar = { img: AVATAR_IMGS[OB.avatar] }; S.settings.membersUpdatedAt = nowISO(); }
      OB.partner = OB.partner || other().name; save(); obGo(2); return; }
    if (OB.step === 2) { obGo(3); return; }
    if (OB.step === 3 && !isCoupleAccount()) { obGo(4); return; }
    if (OB.step === 3) { const a = me(), b = other(); S.settings.split = OB.split === 'custom' ? { mode: 'custom', pct: { [a.id]: OB.pct, [b.id]: 100 - OB.pct } } : { mode: 'equal' }; save(); obGo(4); return; }
  });
  $$('[data-ob-cur]').forEach((b) => b.addEventListener('click', () => { S.settings.currency = b.dataset.obCur; S.settings.membersUpdatedAt = nowISO(); save(); sync.schedule(); $$('[data-ob-cur]').forEach((x) => { x.querySelector('.right').innerHTML = x === b ? icon('i-check') : ''; }); }));
  const cq = $('#ob-cur-q'); if (cq) cq.addEventListener('input', () => { const v = cq.value.trim().toLowerCase(); $$('[data-ob-cur]').forEach((b) => { b.hidden = !!v && !(b.dataset.name.includes(v) || b.dataset.obCur.toLowerCase().includes(v)); }); });
  $$('[data-ob-split]').forEach((b) => b.addEventListener('click', () => { OB.split = b.dataset.obSplit; $$('.onb-opt').forEach((x) => x.classList.toggle('on', x === b)); $('#onb-pct').hidden = OB.split !== 'custom'; }));
  const rng = $('#pct-range'); if (rng) rng.addEventListener('input', () => { OB.pct = +rng.value; $('#pct-me').textContent = OB.pct + '%'; $('#pct-other').textContent = (100 - OB.pct) + '%'; });
  $$('[data-ob-edit]').forEach((b) => b.addEventListener('click', () => obGo(1, 'back')));
  $$('[data-ob-av]').forEach((b) => b.addEventListener('click', () => { const i = +b.dataset.obAv; OB.avatar = OB.avatar === i ? -1 : i; $$('.onb-av').forEach((x) => x.classList.toggle('on', x === b && OB.avatar === i)); }));
  $$('[data-ob-back]').forEach((b) => b.addEventListener('click', () => obGo(Math.max(1, OB.step - 1), 'back')));
  const cp = $('[data-copy-link]'); if (cp) { let t; cp.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(inviteLink()); } catch (_) { toast('Non riesco a copiare: tieni premuto sul link'); return; }
    cp.classList.remove('done'); void cp.offsetWidth; cp.classList.add('done'); clearTimeout(t); t = setTimeout(() => cp.classList.remove('done'), 1800);
  }); }
  $$('[data-share]').forEach((b) => b.addEventListener('click', async () => {
    const k = b.dataset.share, link = inviteLink(), text = inviteText();
    if (k === 'whatsapp') window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
    else if (k === 'telegram') window.open('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent('Unisciti al mio gruppo su Divvy per dividere le spese'), '_blank');
    else if (k === 'sms') location.href = 'sms:?&body=' + encodeURIComponent(text);
    else if (navigator.share) { try { await navigator.share({ title: 'Divvy', text: 'Unisciti al mio gruppo su Divvy per dividere le spese', url: link }); } catch (_) {} }
    else { try { await navigator.clipboard.writeText(link); toast('Link copiato'); } catch (_) {} }
  }));
  $$('[data-ob-finish]').forEach((b) => b.addEventListener('click', obFinish));
  $$('[data-ob-push]').forEach((b) => b.addEventListener('click', async () => { b.disabled = true; await enablePush(); obFinish(); }));
  const first = $('.onb-field input'); if (first && !first.value) setTimeout(() => first.focus({ preventScroll: true }), 400);
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
  $$('[data-settle-all]').forEach((b) => b.addEventListener('click', () => {
    const net = pairBalances(); const open = Object.entries(net).filter(([, x]) => Math.abs(x) >= 1);
    if (!open.length) { toast('Siete in pari'); return; }
    if (open.length > 1) { go('#/bilanci'); return; } /* con più persone si chiude un conto alla volta */
    const [pidOther, x] = open[0]; const deb = x < 0 ? me() : member(pidOther), cred = x < 0 ? member(pidOther) : me(); const amt = Math.abs(x);
    const gid = groups().map((g) => [g.id, Math.abs((pairBalances(g.id)[pidOther] || 0))]).sort((a, b) => b[1] - a[1])[0]; /* nella sezione dove il conto è più aperto */
    confirmSheet('Mettere in pari tutto?', T('{0} paga {1} a {2}. Il saldo torna a zero.', deb.name, money(amt), cred.name), 'Registra', () => { const e = addEntry({ kind: 'payment', desc: 'Pagamento', amount: amt, date: todayStr(), cat: '', paidBy: deb.id, to: cred.id, splitMethod: 'exact', splitInput: {}, owed: { [cred.id]: amt }, notes: '', group: (gid && gid[1] ? gid[0] : S.settings.lastGroup) || null }); go('#/fatto/' + e.id); });
  }));
  $$('.ach-card.fresh').forEach((c, k) => setTimeout(() => { if (!c.isConnected) return; c.classList.remove('locked'); c.classList.add('done', 'ok-in'); const x = $('.xp-tag', c); if (x) x.classList.add('got'); }, 900 + k * 650));
  if (r.name === 'sezione') { const g = S.groups.find((x) => x.id === r.id); if (g) {
    const cp = $('[data-copy-code]'); if (cp) cp.addEventListener('click', async () => { try { await navigator.clipboard.writeText(g.code + ' · ' + sectionLink(g)); } catch (_) { toast('Non riesco a copiare: tieni premuto sul link'); return; } cp.classList.remove('done'); void cp.offsetWidth; cp.classList.add('done'); setTimeout(() => cp.classList.remove('done'), 1800); });
    $$('[data-share-sec]').forEach((b) => b.addEventListener('click', () => shareSection(g, b.dataset.shareSec)));
    $$('[data-remove]').forEach((b) => b.addEventListener('click', () => { const m = member(b.dataset.remove); confirmSheet(T('Togliere {0} dalla sezione?', m.name), 'Non vedrà più le spese della sezione.', 'Togli', () => { removeMember(g, m.id); render(); toast(T('{0} non fa più parte della sezione', m.name)); }); }));
    const lv = $('[data-leave]'); if (lv) lv.addEventListener('click', () => confirmSheet(T('Uscire dalla sezione «{0}»?', g.name), 'Non vedrai più le sue spese. Potrai rientrare con il codice.', 'Lascia', async () => { await leaveSection(g); go('#/home'); }));
  } }
  $$('[data-new-section]').forEach((b) => b.addEventListener('click', newSectionSheet));
  const hj = $('#home-join'), hc = $('#home-code'); if (hj && hc) { const ask = async () => { const c = (hc.value || '').trim(); if (!c) { hc.focus(); return; } hj.disabled = true; await joinSection(c); hj.disabled = false; if (hc.isConnected) hc.value = ''; }; hj.addEventListener('click', ask); hc.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ask(); } }); }
  $$('[data-cancel-join]').forEach((b) => b.addEventListener('click', () => cancelJoin(b.dataset.cancelJoin)));
  $$('[data-accept]').forEach((b) => b.addEventListener('click', () => { const [gid, id] = b.dataset.accept.split(':'); const g = S.groups.find((x) => x.id === gid); if (g) acceptRequest(g, id); }));
  $$('[data-refuse]').forEach((b) => b.addEventListener('click', () => { const [gid, id] = b.dataset.refuse.split(':'); const g = S.groups.find((x) => x.id === gid); if (g) refuseRequest(g, id); }));
  $$('[data-ach-info]').forEach((b) => b.addEventListener('click', () => openSheet('Come funzionano le missioni', `<p class="muted" style="margin:6px 0 14px;line-height:1.5">Le missioni vanno da lunedì a domenica e si azzerano ogni settimana. Si completano da sole in base alle spese del gruppo: quando una è fatta, la vedete tutti e due. I trofei permanenti sono in Profilo → I tuoi trofei.</p>`)));
  const tb = $('[data-trophy]'); if (tb) tb.addEventListener('click', () => { tb.classList.add('tap'); });
  $$('[data-back]').forEach((b) => b.addEventListener('click', () => { if (r.name === 'nuova' || r.name === 'modifica') F = null; back(b.dataset.back); }));
  if (r.name === 'fatto') { const l = $('.done-link'); if (l) l.addEventListener('click', () => { F = null; }); }
  $$('[data-month]').forEach((b) => b.addEventListener('click', () => { const d = +b.dataset.month; S.ui.month = d === 0 ? curYM() : shiftYM(S.ui.month, d); save(); render(); const l = $('.monthnav .label'); if (l) l.classList.add('swap'); }));
  $$('[data-year]').forEach((b) => b.addEventListener('click', () => { S.ui.month = String(+S.ui.month.slice(0, 4) + +b.dataset.year) + S.ui.month.slice(4); save(); render(); }));
  $$('[data-install-hide]').forEach((b) => b.addEventListener('click', () => { sessionStorage.setItem('pari:install-hide', '1'); b.closest('.install').remove(); }));
  bindSeg($('[data-seg="homeMode"]'), (v) => { S.ui.homeMode = v; save(); render(); });
  bindSeg($('[data-seg="balTab"]'), (v) => { S.ui.balTab = +v; save(); render(); });
  bindSeg($('[data-seg="statsRange"]'), (v) => { S.ui.statsRange = v; save(); render(); });
  $$('.chart .col').forEach((c) => c.addEventListener('click', () => { S.ui.month = c.dataset.ym; if (r.name === 'statistiche' && S.ui.statsRange === 'anno') S.ui.statsRange = 'mese'; save(); render(); }));
  $$('[data-settle]').forEach((b) => b.addEventListener('click', () => { const [from, to] = b.dataset.settle.split(':'); F = null; go(`#/nuova?tipo=pagamento&da=${from}&a=${to}`); }));

  if (r.name === 'budget') {
    $$('[data-set-budget]').forEach((b) => b.addEventListener('click', () => budgetSheet('Budget mensile', myBudget().monthly || 0, (v) => setBudget(v))));
    $$('[data-cat-budget]').forEach((b) => b.addEventListener('click', () => { const c = catOf(b.dataset.catBudget); budgetSheet(T('Budget per {0}', T(c.name)), (myBudget().byCat || {})[c.id] || 0, (v) => setCatBudget(c.id, v), T('Conta la tua quota delle spese, non il totale.')); }));
  }
  if (r.name === 'spese') {
    $$('[data-group-menu]').forEach((b) => b.addEventListener('click', () => openGroupSheet(b.dataset.groupMenu)));
    const q = $('#q'); let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { speseFilter.q = q.value; $('#spese-list').innerHTML = speseList(); initSwipes(); }, 120); });
    $('#chips').addEventListener('click', (ev) => { const c = ev.target.closest('.chip'); if (!c) return; speseFilter.cat = c.dataset.cat; $$('#chips .chip').forEach((x) => x.classList.toggle('on', x === c)); $('#spese-list').innerHTML = speseList(); initSwipes(); });
    const gc = $('#group-chips'); if (gc) gc.addEventListener('click', (ev) => { const c = ev.target.closest('.chip'); if (!c) return; speseFilter.group = c.dataset.group; $$('#group-chips .chip').forEach((x) => x.classList.toggle('on', x === c)); const g = groups().find((x) => x.id === speseFilter.group); $('.head .title').textContent = g ? g.name : 'Spese'; $('#spese-list').innerHTML = speseList(); initSwipes(); });
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
  if (r.name === 'benvenuto') bindWelcome();
  if (r.name === 'accedi') bindLogin();
  if (r.name === 'registrati') bindRegister();
  if (r.name === 'conferma') bindConfirm();
  if (r.name === 'recupero') bindRecovery();
  if (r.name === 'profilo') bindProfilo(r);
}

function bindForm(r) {
  if (!$('#f')) return; /* pagina vuota (per esempio pagamento senza nessuno con cui farlo) */
  if (r.q.da && !F.id && F.kind === 'payment' && !F._prefilled) { F.paidBy = r.q.da; F.to = r.q.a; const net = pairBalances(); const v = r.q.a === me().id ? (net[r.q.da] || 0) : -(net[r.q.a] || 0); F.amount = v > 0 ? moneyPlain(v) : ''; F._prefilled = true; render(); return; }
  const form = $('#f');
  const rerender = () => { const pos = window.scrollY; render(); window.scrollTo(0, pos); };
  bindSeg($('[data-seg="kind"]'), (v) => { F.kind = v; if (v === 'payment') { const pd = paymentDefault(); if (pd) { F.paidBy = pd.paidBy; F.to = pd.to; F.amount = pd.amount; } } rerender(); });
  bindSeg($('[data-seg="splitMethod"]'), (v) => { F.splitMethod = v; F.splitInput = {}; rerender(); });
  const desc = $('#desc'); if (desc) desc.addEventListener('input', () => (F.desc = desc.value));
  const amount = $('#amount'); amount.addEventListener('input', () => { F.amount = amount.value; $('#amount-err').hidden = true; const d = $('#half-hint'); if (d) d.textContent = halfHint(); validateSplit(); });
  $('#date').addEventListener('change', (ev) => (F.date = ev.target.value || todayStr()));
  $('#notes').addEventListener('input', (ev) => (F.notes = ev.target.value));
  $$('[data-pick]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.pick === 'payer') F.paidBy = b.dataset.id; else F.to = b.dataset.id; rerender(); }));
  /* scelta di chi paga (e, per i pagamenti, di chi riceve) fra le persone della sezione */
  const pickPerson = (title, exclude, cb) => { const ppl = formPeople().filter((m) => m.id !== exclude); openSheet(title, `<div class="list group-menu">${ppl.map((m) => `<button type="button" class="row" data-person="${m.id}"><span class="cat-ic" style="background:none">${avatar(m)}</span><span class="main"><span class="title">${esc(m.name)}${m.id === me().id ? ' <small class="muted">(tu)</small>' : ''}</span></span><span class="right">${icon('i-right', 'ic chev')}</span></button>`).join('')}</div>`, (sh) => { $$('[data-person]', sh).forEach((b) => b.addEventListener('click', () => { closeSheet(); cb(b.dataset.person); })); }); };
  $$('[data-payer-pick]').forEach((b) => b.addEventListener('click', () => { if (formPeople().length < 2) return; if (F.kind === 'payment') pickPerson('Chi paga?', null, (id) => { F.paidBy = id; pickPerson('A chi?', id, (to) => { F.to = to; rerender(); }); }); else pickPerson('Chi ha pagato?', null, (id) => { F.paidBy = id; rerender(); }); }));
  $$('[data-soon]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.soon === 'friends') toast('Dividere con amici arriva in una prossima versione'); }));
  $$('[data-split]').forEach((b) => b.addEventListener('click', () => { const v = b.dataset.split; if (v === 'equal') F.splitMethod = 'equal'; else if (F.splitMethod === 'equal') F.splitMethod = 'exact'; rerender(); }));
  $$('[data-share]').forEach((inp) => inp.addEventListener('input', () => { F.splitInput[inp.dataset.share] = inp.value; validateSplit(); }));
  $$('[data-cat]').forEach((b) => b.addEventListener('click', () => { F.cat = F.cat === b.dataset.cat ? '' : b.dataset.cat; $$('.cat-circle').forEach((x) => x.classList.toggle('on', x.dataset.cat === F.cat)); $('#cat-name').textContent = T(F.cat ? catOf(F.cat).name : 'Nessuna categoria'); }));
  const rec = $('#recurring'); if (rec) rec.addEventListener('click', () => { F.recurring = !F.recurring; rec.setAttribute('aria-checked', F.recurring); });
  ['#scan-cam', '#scan-gal'].forEach((sel) => { const i = $(sel); if (i) i.addEventListener('change', () => { const f = i.files && i.files[0]; if (f) scanReceipt(f); i.value = ''; }); });
  if (pendingScan && F.kind === 'expense') { const f = pendingScan; pendingScan = null; setTimeout(() => scanReceipt(f), 350); }
  $$('#form-groups [data-group]').forEach((b) => b.addEventListener('click', () => { F.group = b.dataset.group; F.newGroup = false; if (!formPeople().some((m) => m.id === F.paidBy)) F.paidBy = me().id; if (F.kind === 'payment' && !formPeople().some((m) => m.id === F.to)) F.to = (formPeople().find((m) => m.id !== me().id) || other()).id; const hh = $('#half-hint'); if (hh) hh.textContent = halfHint(); $$('#form-groups .chip').forEach((x) => x.classList.toggle('on', x === b)); $('#group-new').hidden = true; }));
  const gn = $('[data-group-new]'); if (gn) gn.addEventListener('click', () => { F.newGroup = true; $('#group-new').hidden = false; $('#group-name').focus(); });
  const gname = $('#group-name'); if (gname) gname.addEventListener('input', () => (F.newGroupName = gname.value));
  const gcreate = $('#group-create'); if (gcreate) gcreate.addEventListener('click', () => { const n = ($('#group-name').value || '').trim(); if (!n) { $('#group-name').focus(); return; } const g = addGroup(n); F.group = g.id; F.newGroup = false; F.newGroupName = ''; S.settings.lastGroup = g.id; save(); rerender(); toast(`Sezione "${n}" creata`); });
  if (gname) gname.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#group-create').click(); } });
  form.addEventListener('submit', (ev) => { ev.preventDefault(); submitForm(); });
  $('#save-top').addEventListener('click', submitForm);
  validateSplit();
  if (!F.id && !F.desc && desc) setTimeout(() => desc.focus({ preventScroll: true }), 350);
}

function bindProfilo(r) {
  const lo = $('[data-logout]'); if (lo) lo.addEventListener('click', () => confirmSheet('Uscire dall\'account?', 'Le spese restano salvate: al prossimo accesso le ritrovi.', 'Esci', async () => { await auth.signOut(); LG = { mode: 'login', email: '', busy: false, show: false, sent: '' }; go('#/accedi'); }));
  const tourBtn = $('[data-start-tour]'); if (tourBtn) tourBtn.addEventListener('click', (e) => { e.preventDefault(); go('#/home'); setTimeout(startTour, 400); });
  if (r.sub === 'account') {
    const ct = $('[data-couple-toggle]'); if (ct) ct.addEventListener('click', () => { S.settings.boardCouple = !S.settings.boardCouple; ct.setAttribute('aria-checked', S.settings.boardCouple); save(); boardPush(true); render(); });
    $('#save-account').addEventListener('click', () => {
      let blocked = false;
      $$('[data-name]').forEach((i) => { const m = member(i.dataset.name); const v = i.value.trim(); if (!v || v === m.name) return; if (!isCoupleAccount() && m.id === me().id) { if (nameLockLeft()) { blocked = true; return; } S.settings.nameChangedAt = nowISO(); } m.name = v; }); /* singoli: il nome cambia una volta ogni 30 giorni */
      if (blocked) { toast(T('Potrai cambiarlo tra {0} giorni.', nameLockLeft())); return; }
      $$('[data-color]').forEach((i) => (member(i.dataset.color).color = i.value));
      const tg = $('#together'); if (tg) S.settings.together = tg.value.trim(); S.settings.membersUpdatedAt = nowISO();
      save(); sync.schedule(); toast('Impostazioni salvate'); go('#/profilo');
    });
    $$('[data-color]').forEach((i) => i.addEventListener('input', () => i.style.setProperty('--c', i.value)));
    S.members.forEach((m) => $$(`[data-av-${m.id}]`).forEach((b) => b.addEventListener('click', () => { const i = +b.getAttribute('data-av-' + m.id); const cur = AVATAR_IMGS.indexOf(((m.avatar || {}).img) || ''); m.avatar = cur === i ? null : { img: AVATAR_IMGS[i] }; S.settings.membersUpdatedAt = nowISO(); save(); sync.schedule(); $$(`[data-av-${m.id}]`).forEach((x) => x.classList.toggle('on', x === b && cur !== i)); })));
    const segMe = $('[data-seg="me"]'); if (segMe) bindSeg(segMe, (v) => { S.settings.me = v; save(); });
  }
  if (r.sub === 'sezioni') {
    const create = () => { const i = $('#new-group-name'); const n = (i.value || '').trim(); if (!n) { i.focus(); return; } addGroup(n); toast(`Sezione "${n}" creata`); render(); };
    $('#new-group-create').addEventListener('click', create); $('#new-group-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } });
    const jg = $('#join-go'), jc = $('#join-code'); if (jg) { const goJoin = async () => { const c = (jc.value || '').trim(); if (!c) { jc.focus(); return; } jg.disabled = true; await joinSection(c); jg.disabled = false; }; jg.addEventListener('click', goJoin); jc.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); goJoin(); } }); }
    $$('[data-open-sec]').forEach((b) => b.addEventListener('click', () => go('#/sezione/' + b.dataset.openSec)));
    $$('[data-rename]').forEach((b) => b.addEventListener('click', () => { const g = S.groups.find((x) => x.id === b.dataset.rename); openSheet('Rinomina sezione', `<div class="field" style="margin-top:0"><input class="input" id="rn" type="text" value="${esc(g.name)}"></div><div class="btn-row" style="margin-top:14px"><button class="btn soft" data-c="no">Annulla</button><button class="btn" data-c="ok">Salva</button></div>`, (sh) => { $('[data-c="no"]', sh).addEventListener('click', () => closeSheet()); $('[data-c="ok"]', sh).addEventListener('click', () => { renameGroup(g.id, $('#rn', sh).value); closeSheet(); render(); }); setTimeout(() => $('#rn', sh).focus(), 350); }); }));
    $$('[data-delete-group]').forEach((b) => b.addEventListener('click', () => { const g = S.groups.find((x) => x.id === b.dataset.deleteGroup); const n = active().filter((e) => e.group === g.id).length; confirmSheet(`Eliminare "${g.name}"?`, n ? `Le sue ${n} voci restano, ma senza sezione.` : 'La sezione è vuota.', 'Elimina', () => { deleteGroup(g.id); render(); toast('Sezione eliminata'); }); }));
  }
  if (r.sub === 'esporta') {
    $$('[data-export]').forEach((b) => b.addEventListener('click', () => exportData(b.dataset.export)));
    $('#import-file').addEventListener('change', (ev) => { const f = ev.target.files[0]; if (!f) return; f.text().then((t) => importData(t)).catch(() => toast('File non leggibile')); ev.target.value = ''; });
    const rs = $('[data-reset]'); if (rs) rs.addEventListener('click', () => confirmSheet('Cancellare tutto?', 'Spese, pagamenti e impostazioni di questo telefono verranno eliminati. Se la sincronizzazione è attiva, i dati sul database restano.', 'Cancella tutto', () => { const keepSync = S.settings.sync; S = defaultState(); window.__S = S; S.settings.sync = keepSync; save(); toast('Dati cancellati'); go('#/home'); }));
  }
  if (r.sub === 'sync') {
    $('#save-sync').addEventListener('click', async () => {
      const prev = S.settings.sync.house; S.settings.sync = { url: $('#s-url').value.trim().replace(/\/+$/, ''), key: $('#s-key').value.trim(), house: $('#s-house').value.trim() }; if (S.settings.sync.house !== prev) { S.settings.lastPull = null; S.settings.lastPush = null; } save(); rememberHouse();
      if (!sync.enabled()) { toast('Compila tutti e tre i campi'); return; }
      toast('Collego…'); const ok = await sync.run(true); render(); toast(ok ? 'Collegata: dati sincronizzati' : 'Non riesco a collegarmi: ' + (sync.lastError || 'controlla i valori'));
    });
    const n = $('#sync-now'); if (n) n.addEventListener('click', async () => { toast('Sincronizzo…'); const ok = await sync.run(true); render(); toast(ok ? 'Aggiornato' : 'Errore: ' + (sync.lastError || '')); });
    const off = $('#sync-off'); if (off) off.addEventListener('click', () => { S.settings.sync = { url: SUPA_URL, key: SUPA_ANON, house: '' }; S.settings.lastPull = null; save(); sync.status = 'idle'; render(); toast('Scollegata: i dati restano sul telefono'); });
  }
  if (r.sub === 'classifica' && sync.enabled()) {
    (async () => { try { await boardPush(true); const b = await boardFetch(); const box = $('#cl-body'); if (!box) return; box.innerHTML = boardHTML(b); translateDom(box); const sub = $('.cl .ach-sub'); if (sub) sub.textContent = T('Sei al posto {0} su {1}', b.pos, b.total); } catch (e) { const box = $('#cl-body'); if (box) box.innerHTML = `<p class="muted small" style="margin:8px 2px">${esc(T('Non riesco a caricare la classifica: {0}', e.message || e))}</p>`; } })();
  }
  if (r.sub === 'trofei') { $$('[data-tf]').forEach((b) => b.addEventListener('click', () => { trophyFilter = b.dataset.tf; render(); })); }
  if (r.sub === 'lingua') {
    $$('[data-lang]').forEach((b) => b.addEventListener('click', () => { pickLang(b.dataset.lang); toast(T('Lingua: {0}', langInfo().name)); }));
  }
  if (r.sub === 'valuta') {
    $$('[data-cur]').forEach((b) => b.addEventListener('click', () => { S.settings.currency = b.dataset.cur; S.settings.membersUpdatedAt = nowISO(); save(); sync.schedule(); toast(`Valuta: ${currencyName(b.dataset.cur)}`); render(); }));
    const q = $('#cur-q'); q.addEventListener('input', () => { const v = q.value.trim().toLowerCase(); $$('[data-cur]').forEach((b) => { b.hidden = !!v && !(b.dataset.name.includes(v) || b.dataset.cur.toLowerCase().includes(v)); }); });
  }
  if (r.sub === 'notifiche') {
    const on = $('#push-on'); if (on) on.addEventListener('click', async () => { on.disabled = true; const ok = await enablePush(); render(); if (ok) { toast('Notifiche attivate'); const t = notifText({ kind: 'expense', desc: 'Spesa', amount: 1000 }, otherName(), balances()[me().id] || 0); showLocalNotification(t.title, t.body); } });
    const test = $('#push-test'); if (test) test.addEventListener('click', async () => { const t = notifText({ kind: 'expense', desc: 'Spesa', amount: 1000 }, otherName(), balances()[me().id] || 0); const ok = await showLocalNotification(t.title, t.body); toast(ok ? 'Inviata: guarda in alto' : 'Non riesco a mostrarla'); });
    const off = $('#push-off'); if (off) off.addEventListener('click', async () => { await disablePush(); render(); toast('Notifiche disattivate'); });
  }
  if (r.sub === 'info') { $('#replay-onb').addEventListener('click', () => { OB = { step: 1, name: '', partner: '', house: '', avatar: AVATAR_IMGS.indexOf(((me().avatar || {}).img) || ''), split: (S.settings.split || {}).mode === 'custom' ? 'custom' : 'equal', pct: ((S.settings.split || {}).pct || {})[me().id] || 50 }; go('#/benvenuto'); }); }
  if (r.sub === 'info') { const rt = $('#replay-tut'); if (rt) rt.addEventListener('click', () => { go('#/home'); setTimeout(startTour, 400); }); }
  if (r.sub === 'info') $('#reload-app').addEventListener('click', () => { navigator.serviceWorker?.getRegistration().then((reg) => reg && reg.update()); try { sessionStorage.setItem('pari:nosplash', '1'); } catch (_) {} location.reload(); });
}

/* ---------- Esporta / importa ---------- */
async function shareOrDownload(name, text, type) {
  const blob = new Blob([text], { type }); const file = new File([blob], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function exportData(kind) {
  const stamp = todayStr();
  if (kind === 'json') { const out = { app: 'pari', version: 1, exportedAt: nowISO(), members: S.members, groups: S.groups, settings: { together: S.settings.together }, entries: S.entries, activity: S.activity }; shareOrDownload(`divvy-backup-${stamp}.json`, JSON.stringify(out, null, 2), 'application/json'); return; }
  const rows = [['Data', 'Descrizione', 'Sezione', 'Categoria', 'Tipo', 'Importo', 'Pagato da', ...S.members.map((m) => 'Quota ' + m.name), 'Note']];
  active().sort((a, b) => a.date.localeCompare(b.date)).forEach((e) => rows.push([e.date, e.desc, groupName(e), e.kind === 'payment' ? 'Pagamento' : catOf(e.cat).name, e.kind === 'payment' ? 'pagamento' : 'spesa', moneyPlain(e.amount), member(e.paidBy).name, ...S.members.map((m) => moneyPlain(e.owed?.[m.id] || 0)), e.notes || '']));
  const csv = '﻿' + rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\r\n');
  shareOrDownload(`divvy-spese-${stamp}.csv`, csv, 'text/csv');
}
function importData(text) {
  let d; try { d = JSON.parse(text); } catch (e) { toast('Non è un backup di Divvy'); return; }
  if (!d || d.app !== 'pari' || !Array.isArray(d.entries)) { toast('Non è un backup di Divvy'); return; }
  let added = 0, updated = 0;
  d.entries.forEach((e) => { const cur = S.entries.find((x) => x.id === e.id); if (!cur) { S.entries.push(e); added++; } else if ((e.updatedAt || '') > (cur.updatedAt || '')) { Object.assign(cur, e); updated++; } });
  (d.activity || []).forEach((a) => { if (!S.activity.some((x) => x.id === a.id)) S.activity.push(a); });
  S.activity.sort((a, b) => b.ts.localeCompare(a.ts)); S.activity = S.activity.slice(0, 300);
  if (Array.isArray(d.members) && d.members.length === 2 && !active().length) S.members = d.members;
  (d.groups || []).forEach((g) => { const cur = S.groups.find((x) => x.id === g.id); if (!cur) S.groups.push(g); else if ((g.updatedAt || '') > (cur.updatedAt || '')) Object.assign(cur, g); });
  save(); sync.schedule(); render(); toast(`Importate ${added} voci nuove, ${updated} aggiornate`);
}

/* ---------- Sincronizzazione Supabase (REST) ---------- */
const PEOPLE_HOUSE = '__people__'; /* casa per le righe personali (budget) */
const sync = {
  status: 'idle', lastError: '', timer: null, running: false,
  enabled() { const s = S.settings.sync; return !!(s.url && s.key && (s.house || sectionCodes().length)); },
  headers() { const k = S.settings.sync.key; return { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }; },
  schedule() { if (!this.enabled()) return; clearTimeout(this.timer); this.timer = setTimeout(() => this.run(), 900); },
  async fetchRows(url) { const r = await fetch(url, { headers: this.headers() }); if (!r.ok) throw new Error(await errText(r)); return r.json(); },
  async post(rows) { if (!rows.length) return; const r = await fetch(S.settings.sync.url + '/rest/v1/pari_rows?on_conflict=house,id', { method: 'POST', headers: this.headers(), body: JSON.stringify(rows) }); if (!r.ok) throw new Error(await errText(r)); },
  /* righe da spingere: ogni voce nella casa della sua sezione; per ogni sezione la riga "section" più le righe "members" e "push" (servono alla funzione notify) */
  outgoing(since, force) {
    const meId = me().id; const rows = []; const people = S.members.map((m) => ({ id: m.id, legacy: m.legacy, name: m.name, color: m.color, avatar: m.avatar }));
    S.entries.filter((e) => (e.updatedAt || '') > since).forEach((e) => rows.push({ house: codeOf(e.group), id: e.id, kind: 'entry', data: e, updated_at: e.updatedAt, deleted: !!e.deleted }));
    const pushMembers = !!S.settings.membersUpdatedAt && ((S.settings.membersUpdatedAt || '') > since || force);
    const pushPush = (S.settings.pushUpdatedAt || '') > since || (force && S.settings.push);
    S.groups.filter((g) => g.code && !g.left).forEach((g) => {
      if ((g.updatedAt || '') > since || force) rows.push({ house: g.code, id: 'section', kind: 'section', data: { id: g.id, name: g.name, code: g.code, owner: g.owner, members: g.members || {}, people: people.filter((p) => inSection(g, p.id)), createdAt: g.createdAt, updatedAt: g.updatedAt, deleted: !!g.deleted }, updated_at: nowISO(), deleted: false });
      if (g.deleted) return;
      if (pushMembers) rows.push({ house: g.code, id: 'members', kind: 'members', data: { members: sectionPeople(g).map((m) => ({ id: m.id, legacy: m.legacy, name: m.name, color: m.color, avatar: m.avatar })), together: S.settings.together, currency: S.settings.currency || 'EUR' }, updated_at: S.settings.membersUpdatedAt, deleted: false });
      Object.values(g.requests || {}).forEach((r) => { if ((r.updatedAt || '') > since && r.by === meId) rows.push(requestRow(g, r)); });
      if (pushPush) rows.push({ house: g.code, id: 'push-' + S.settings.deviceId, kind: 'push', data: S.settings.push ? { ...S.settings.push, member: meId, lang: LANG() } : { device: S.settings.deviceId }, updated_at: S.settings.pushUpdatedAt || nowISO(), deleted: !S.settings.push });
    });
    const main = (mainSection() || {}).code || S.settings.sync.house;
    if (main && S.settings.groupsUpdatedAt && ((S.settings.groupsUpdatedAt || '') > since || force)) rows.push({ house: main, id: 'groups', kind: 'groups', data: { groups: S.groups.filter((g) => !g.left) }, updated_at: S.settings.groupsUpdatedAt, deleted: false }); /* per i telefoni con l'app vecchia */
    const b = (S.budget || {})[meId]; if (b && b.updatedAt && ((b.updatedAt || '') > since || force)) rows.push({ house: PEOPLE_HOUSE, id: 'budget-' + meId, kind: 'mbudget', data: { monthly: b.monthly || 0, byCat: b.byCat || {} }, updated_at: b.updatedAt, deleted: false });
    S.activity.filter((a) => (a.ts || '') > since).forEach((a) => { const e = S.entries.find((x) => x.id === a.entryId); rows.push({ house: codeOf(e && e.group), id: 'act-' + a.id, kind: 'activity', data: a, updated_at: a.ts, deleted: false }); });
    return rows;
  },
  /* applica le righe scaricate (da tutte le sezioni): voci, sezioni, persone, budget, attività */
  apply(rows) {
    let changed = 0; const arrived = []; let map = pidMap();
    rows.forEach((row) => {
      const d = row.data; if (!d) return;
      if (row.kind === 'entry') { normEntry(d, map); const cur = S.entries.find((x) => x.id === d.id); if (!cur) { S.entries.push(d); arrived.push(d); changed++; } else if ((d.updatedAt || '') > (cur.updatedAt || '')) { Object.assign(cur, d); changed++; } }
      else if (row.kind === 'section') { if (mergeSection(d, row.updated_at)) { changed++; map = pidMap(); } }
      else if (row.kind === 'members') { if ((row.updated_at || '') > (S.settings.membersUpdatedAt || '')) { if (mergePeople(d.members, row.updated_at)) { changed++; map = pidMap(); } if (typeof d.together === 'string') S.settings.together = d.together; if (d.currency) S.settings.currency = d.currency; S.settings.membersUpdatedAt = row.updated_at; } }
      else if (row.kind === 'mbudget') { const mid = pid(String(row.id).replace(/^budget-/, ''), map); const cur = (S.budget || {})[mid]; if (!cur || (row.updated_at || '') > (cur.updatedAt || '')) { S.budget = S.budget || {}; S.budget[mid] = { monthly: +(d.monthly || 0), byCat: d.byCat || {}, updatedAt: row.updated_at }; changed++; } }
      else if (row.kind === 'groups') { (d.groups || []).forEach((g) => { const cur = S.groups.find((x) => x.id === g.id); if (!cur) { const t = g.createdAt || row.updated_at; const ng = { ...g, code: g.code || legacyCode(S.settings.sync.house, g.id), owner: pid(g.owner || 'm1', map), members: g.members || Object.fromEntries(S.members.map((m) => [m.id, { joinedAt: t, updatedAt: t }])) }; S.groups.push(ng); changed++; this.newHouses.push(ng.code); } else if ((g.updatedAt || '') > (cur.updatedAt || '')) { cur.name = g.name; cur.deleted = !!g.deleted; cur.updatedAt = g.updatedAt; changed++; } }); if ((row.updated_at || '') > (S.settings.groupsUpdatedAt || '')) S.settings.groupsUpdatedAt = row.updated_at; }
      else if (row.kind === 'activity') { if (map[d.by]) d.by = map[d.by]; if (!S.activity.some((x) => x.id === d.id)) S.activity.push(d); }
      else if (row.kind === 'request') { const g = S.groups.find((x) => x.code === row.house); if (g && d.id) { g.requests = g.requests || {}; const cur = g.requests[d.id]; if (row.deleted || d.status === 'cancelled') { if (cur) { delete g.requests[d.id]; changed++; } } else if (!cur || (row.updated_at || '') > (cur.updatedAt || '')) { const wasPending = !!cur && cur.status === 'pending'; g.requests[d.id] = { ...d, updatedAt: row.updated_at }; changed++; if (d.status === 'pending' && !wasPending && isOwner(g) && d.id !== me().id) toast(T('{0} vuole entrare in «{1}»', d.name, g.name)); } } }
    });
    return { changed, arrived };
  },
  newHouses: [],
  async pullHouse(code) { if (!code) return { changed: 0 }; const rows = await this.fetchRows(S.settings.sync.url + '/rest/v1/pari_rows?house=eq.' + encodeURIComponent(code) + '&order=updated_at.asc&limit=1000'); const r = this.apply(rows); save(); if (r.changed) render(); return r; },
  async run(force) {
    if (!this.enabled() || this.running) return false; this.running = true; this.status = 'busy'; this.lastError = ''; updateSyncDot();
    try {
      const s = S.settings.sync; const base = s.url + '/rest/v1/pari_rows';
      const since = force ? '' : (S.settings.lastPush || '');
      // 1) scarico tutto ciò che è cambiato in tutte le mie sezioni dopo l'ultimo scarico, e lo fondo con quello che ho
      const codes = sectionCodes(); let remote = [];
      if (codes.length) { const q = `?house=in.(${codes.map(encodeURIComponent).join(',')})&order=updated_at.asc&limit=1000` + (S.settings.lastPull && !force ? `&updated_at=gt.${encodeURIComponent(S.settings.lastPull)}` : ''); remote = await this.fetchRows(base + q); }
      let extra = []; if (force) { try { extra = await this.fetchRows(base + `?house=eq.${PEOPLE_HOUSE}&id=eq.${encodeURIComponent('budget-' + me().id)}`); } catch (_) {} }
      this.newHouses = []; const { changed, arrived } = this.apply(remote.concat(extra));
      for (const c of this.newHouses.splice(0)) { try { await this.pullHouse(c); } catch (_) {} }
      S.activity.sort((a, b) => b.ts.localeCompare(a.ts)); S.activity = S.activity.slice(0, 300);
      if (remote.length) S.settings.lastPull = remote[remote.length - 1].updated_at; else if (!S.settings.lastPull) S.settings.lastPull = nowISO();
      // 2) spingo le righe locali cambiate dopo l'ultimo invio (già fuse con le novità), ognuna nella casa della sua sezione
      const rows = this.outgoing(since, force);
      const freshMine = S.entries.filter((e) => !e.deleted && (e.createdAt || '') > since && e.paidBy === me().id && !e.recurringOf).map((e) => e.id);
      for (let i = 0; i < rows.length; i += 400) await this.post(rows.slice(i, i + 400));
      S.settings.lastPush = nowISO();
      if (freshMine.length && since) notifyOthers(freshMine);
      this.status = 'ok'; save();
      if (arrived.length && S.settings.lastPull) notifyIncoming(arrived);
      if (changed) { materializeRecurring(); if (!['nuova', 'modifica'].includes((currentRoute || {}).name)) render(); }
      if ((S.settings.pendingJoins || []).length) setTimeout(checkPendingJoins, 50); /* fuori dal giro: se accettato entro con un giro nuovo */
      return true;
    } catch (e) { this.status = 'err'; this.lastError = e.message || String(e); console.warn('sync', e); return false; }
    finally { this.running = false; updateSyncDot(); }
  },
};
async function errText(r) { try { const j = await r.json(); return (j.message || j.hint || j.error || r.status) + ''; } catch (e) { return 'HTTP ' + r.status; } }
function updateSyncDot() { const d = $('.sync-dot'); if (!d) return; d.className = 'sync-dot ' + (!sync.enabled() ? 'off' : sync.status === 'busy' ? 'busy' : sync.status === 'err' ? 'err' : ''); }

/* ---------- Trascina a sinistra per eliminare ---------- */
let openSwipe = null;
function closeSwipe(w) { if (!w) return; w.classList.remove('open'); w.classList.remove('open-r'); const r = $('.row', w); if (r) r.style.transform = ''; const d = $('.swipe-del', w); if (d) { d.style.width = '0px'; d.classList.remove('wide'); } const ed = $('.swipe-edit', w); if (ed) { ed.style.width = '0px'; ed.classList.remove('wide'); } if (openSwipe === w) openSwipe = null; }
function initSwipes() {
  const W = 96;
  $$('.swipe').forEach((w) => {
    const row = $('.row', w); if (!row) return; const del = $('.swipe-del', w); const edit = $('.swipe-edit', w);
    let down = false, drag = false, moved = false, x0 = 0, y0 = 0, x = 0;
    // la zona rossa copre tutto lo spazio fra il bordo trascinato e il bordo destro fermo
    const GAP = 8; // spazio fra il bordo della riga trascinata e il rosso
    // verso sinistra si scopre il rosso (elimina), verso destra il verde (modifica)
    const setX = (v) => { row.style.transform = v ? `translateX(${v}px)` : ''; if (del) { del.style.width = Math.max(0, -v - GAP) + 'px'; del.classList.toggle('wide', -v > 150); } if (edit) { edit.style.width = Math.max(0, v - GAP) + 'px'; edit.classList.toggle('wide', v > 150); } };
    row.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button !== 0) return; if (e.clientX < 24) return; down = true; drag = false; x0 = e.clientX; y0 = e.clientY; });
    row.addEventListener('pointermove', (e) => {
      if (!down) return; const ddx = e.clientX - x0, ddy = e.clientY - y0;
      if (!drag) { if (Math.abs(ddx) > 8 && Math.abs(ddx) > Math.abs(ddy) * 1.2) { drag = true; moved = true; w.classList.add('dragging'); try { row.setPointerCapture(e.pointerId); } catch (_) {} if (openSwipe && openSwipe !== w) closeSwipe(openSwipe); } else return; }
      const base = w.classList.contains('open') ? -W : w.classList.contains('open-r') ? W : 0; x = base + ddx;
      const lim = w.offsetWidth * 0.92; if (x < -lim) x = -lim; if (x > lim) x = lim; // si può trascinare fino quasi al bordo, in entrambi i versi
      setX(x);
    });
    const end = () => { if (!down) return; down = false; if (!drag) return; drag = false; w.classList.remove('dragging');
      if (x > w.offsetWidth * 0.6) { setX(w.offsetWidth); const id = w.dataset.id; setTimeout(() => { closeSwipe(w); go('#/modifica/' + id); }, 120); } // trascinamento lungo a destra: modifica subito
      else if (x > W / 2) { w.classList.add('open-r'); openSwipe = w; setX(W); }
      else if (x < -w.offsetWidth * 0.6) { setX(-w.offsetWidth); const id = w.dataset.id; setTimeout(() => { closeSwipe(w); deleteEntry(id); toast('Eliminata', { label: 'Annulla', fn: () => restoreEntry(id) }); }, 120); } // trascinamento lungo: elimina subito
      else if (x < -W / 2) { w.classList.add('open'); openSwipe = w; setX(-W); } else closeSwipe(w); setTimeout(() => (moved = false), 60); };
    row.addEventListener('pointerup', end); row.addEventListener('pointercancel', end);
    row.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); return; } if (w.classList.contains('open') || w.classList.contains('open-r')) { e.preventDefault(); e.stopPropagation(); closeSwipe(w); } }, true);
    if (edit) edit.addEventListener('click', (e) => { e.stopPropagation(); const id = w.dataset.id; closeSwipe(w); go('#/modifica/' + id); });
    $('.swipe-del', w).addEventListener('click', (e) => { e.stopPropagation(); const id = w.dataset.id; closeSwipe(w); deleteEntry(id); toast('Eliminata', { label: 'Annulla', fn: () => restoreEntry(id) }); });
  });
}
document.addEventListener('pointerdown', (e) => { if (openSwipe && !openSwipe.contains(e.target)) closeSwipe(openSwipe); }, true);
// col mouse (desktop) il trascinamento di un link farebbe partire il drag nativo e interromperebbe lo swipe
document.addEventListener('dragstart', (e) => { if (e.target && e.target.closest && e.target.closest('.swipe')) e.preventDefault(); });
/* riga sottile sotto la barra del titolo solo quando c'è contenuto che le scorre sotto */
window.addEventListener('scroll', () => { const h = document.querySelector('.page > .head'); if (h) h.classList.toggle('stuck', window.scrollY > 4); }, { passive: true });

/* ---------- Trascina dal bordo sinistro per tornare indietro ---------- */
(function edgeBack() {
  const view = $('#view'); const EDGE = 24, TRIG = 90; let on = false, x0 = 0, y0 = 0, dx = 0, t0 = 0, target = null;
  const backBtn = () => $('#view .head [data-back], #view [data-back][aria-label="Indietro"], #view [data-back][aria-label="Annulla"]');
  document.addEventListener('touchstart', (e) => { on = false; if (TOUR || e.touches.length !== 1 || $('#sheet-root').firstChild) return; const t = e.touches[0]; if (t.clientX > EDGE) return; target = backBtn(); if (!target) return; on = true; x0 = t.clientX; y0 = t.clientY; dx = 0; t0 = Date.now(); }, { passive: true });
  document.addEventListener('touchmove', (e) => { if (!on) return; const t = e.touches[0]; const ddx = t.clientX - x0, ddy = t.clientY - y0; if (dx === 0 && Math.abs(ddy) > Math.abs(ddx)) { on = false; return; } dx = Math.max(0, ddx); if (e.cancelable) e.preventDefault(); view.style.transition = 'none'; view.style.transform = `translateX(${Math.min(dx * 0.7, 140)}px)`; view.style.opacity = String(Math.max(.55, 1 - dx / 600)); }, { passive: false });
  const end = () => { if (!on) return; on = false; const fast = dx > 40 && Date.now() - t0 < 260; view.style.transition = 'transform .28s var(--ease-out), opacity .28s ease';
    if ((dx > TRIG || fast) && target && target.isConnected) { view.style.transform = 'translateX(60px)'; view.style.opacity = '0'; setTimeout(() => { view.style.transition = 'none'; view.style.transform = ''; view.style.opacity = ''; target.click(); }, 160); }
    else { view.style.transform = ''; view.style.opacity = ''; setTimeout(() => { view.style.transition = ''; }, 300); } };
  document.addEventListener('touchend', end); document.addEventListener('touchcancel', end);
})();

/* ---------- Tira giù per ricaricare (su qualsiasi pagina) ---------- */
(function pullToRefresh() {
  const app = $('#view'); const el = document.createElement('div'); el.className = 'ptr'; el.innerHTML = `<span class="ptr-ic">${icon('i-undo')}</span><span class="ptr-t">Tira per aggiornare</span>`; document.body.appendChild(el);
  const lbl = document.querySelector('.ptr-t'), MAX = 110, TRIG = 72; let y0 = 0, pulling = false, dy = 0, busy = false;
  const canPull = () => window.scrollY <= 0 && !$('#sheet-root').firstChild && !busy && !document.body.classList.contains('fixed-screen');
  document.addEventListener('touchstart', (e) => { if (TOUR || e.touches.length !== 1 || !canPull()) { pulling = false; return; } y0 = e.touches[0].clientY; pulling = true; dy = 0; }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!pulling) return; const d = e.touches[0].clientY - y0;
    if (d <= 0 || window.scrollY > 0) { if (dy > 0) { dy = 0; app.style.transform = ''; el.classList.remove('show', 'ready'); } return; }
    if (e.cancelable) e.preventDefault();
    dy = Math.min(MAX, d * 0.55); app.style.transition = 'none'; app.style.transform = `translateY(${dy}px)`;
    el.classList.add('show'); el.classList.toggle('ready', dy >= TRIG); el.style.setProperty('--p', Math.min(1, dy / TRIG)); lbl.textContent = T(dy >= TRIG ? 'Rilascia per ricaricare' : 'Tira per aggiornare');
  }, { passive: false });
  const end = async () => {
    if (!pulling) return; pulling = false; app.style.transition = 'transform .3s var(--ease-out)';
    if (dy >= TRIG) { busy = true; el.classList.add('loading'); lbl.textContent = T('Aggiorno…'); app.style.transform = `translateY(${TRIG}px)`; try { if (sync.enabled()) await Promise.race([sync.run(true), new Promise((r) => setTimeout(r, 4000))]); } catch (_) {} navigator.serviceWorker?.getRegistration().then((reg) => reg && reg.update()).catch(() => {}); try { sessionStorage.setItem('pari:nosplash', '1'); } catch (_) {} setTimeout(() => location.reload(), 150); return; }
    app.style.transform = ''; el.classList.remove('show', 'ready'); dy = 0;
  };
  document.addEventListener('touchend', end); document.addEventListener('touchcancel', end);
})();

/* ---------- Sheet, conferme, toast ---------- */
function openSheet(title, bodyHTML, onOpen) {
  closeSheet(true);
  const root = $('#sheet-root');
  root.innerHTML = `<div class="backdrop"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="grab"><i></i></div><div class="shead"><span class="t">${esc(title)}</span><button class="close" type="button" aria-label="Chiudi">${icon('i-x')}</button></div><div class="sbody">${bodyHTML}</div></div>`; translateDom(root);
  const bd = $('.backdrop', root), sh = $('.sheet', root);
  requestAnimationFrame(() => requestAnimationFrame(() => { bd.classList.add('in'); sh.classList.add('in'); }));
  bd.addEventListener('click', () => closeSheet()); $('.close', sh).addEventListener('click', () => closeSheet());
  // trascina per chiudere
  let y0 = 0, dy = 0, t0 = 0, drag = false;
  // niente setPointerCapture: con la cattura il click finiva sul foglio invece che sul bottone toccato (le righe non rispondevano)
  const move = (ev) => { if (!drag) return; dy = Math.max(0, ev.clientY - y0); sh.style.transform = `translateY(${dy}px)`; };
  const end = () => { if (!drag) return; drag = false; sh.classList.remove('dragging'); document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', end); document.removeEventListener('pointercancel', end); const v = dy / Math.max(1, Date.now() - t0); if (dy > sh.offsetHeight * 0.3 || v > 0.5) closeSheet(); else sh.style.transform = ''; };
  sh.addEventListener('pointerdown', (ev) => { if (ev.target.closest('.sbody') && $('.sbody', sh).scrollTop > 0) return; drag = true; y0 = ev.clientY; t0 = Date.now(); dy = 0; sh.classList.add('dragging'); document.addEventListener('pointermove', move); document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end); });
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
  text = T(text); const root = $('#toast-root'); root.innerHTML = `<div class="toast-wrap"><div class="toast"><span>${esc(text)}</span>${action ? `<button type="button">${esc(T(action.label))}</button>` : ''}</div></div>`;
  const t = $('.toast', root); requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('in')));
  if (action) $('button', t).addEventListener('click', () => { action.fn(); root.innerHTML = ''; });
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.classList.remove('in'); setTimeout(() => { if ($('.toast', root) === t) root.innerHTML = ''; }, 300); }, action ? 5000 : 2600);
}

/* ---------- Avvio ---------- */
importSplitwiseOnce();
materializeRecurring();
(async () => {
  applyLang();
  await auth.handleRedirect();
  if (auth.recovery) history.replaceState(null, '', '#/recupero');
  else if (!auth.user()) { if (!/^#\/(accedi|registrati|legale|conferma|join)/.test(location.hash)) history.replaceState(null, '', '#/accedi'); }
  else if (!onboardingDone()) history.replaceState(null, '', '#/benvenuto');
  if (auth.user()) { await updateCoupleFlag(); const chAuth = afterAuth(); if (cleanupSections()) render(); applyPendingJoin(); if (sync.enabled() && (chAuth || !S.settings.lastPull)) sync.run(true); showDailyLove(); }
  route();
  if (auth.user() && onboardingDone() && !tutorialDone()) setTimeout(startTour, 1500); // tour guidato al primo accesso
  setTimeout(missionCheck, 1200); // all'apertura annuncio le missioni completate nel frattempo
  // prova voluta da Lucas: al prossimo accesso (entro la data) l'avviso scende una volta anche se non c'è niente di nuovo
  // richiesta di Lucas (6/9 sera): la schermata LEVEL UP a OGNI accesso; per tornare alla normalità mettere LEVELUP_EVERY_OPEN a false
  const LEVELUP_EVERY_OPEN = false;
  if (LEVELUP_EVERY_OPEN && auth.user()) setTimeout(() => { try { showLevelUp(levelInfo()); } catch (e) { console.warn('levelup', e); } }, 2600);
  const BANNER_FORCE = { until: '2026-09-06', key: 'pari:banner-force-1' };
  try { if (auth.user() && todayStr() <= BANNER_FORCE.until && !localStorage.getItem(BANNER_FORCE.key)) { setTimeout(() => { localStorage.setItem(BANNER_FORCE.key, '1'); const w = missions(); const m = w.list.find((x) => x.done) || w.list[0]; missionQueue.push({ title: m.title, trophy: false }); missionNext(); }, 1500); } } catch (_) {}
  auth.refreshIfNeeded().then(() => { if (!auth.user() && currentRoute && currentRoute.name !== 'accedi') render(); });
  hideSplash();
})();
/* schermata di caricamento: barra che si riempie, poi dissolvenza (resta almeno 1,6 s per non scattare) */
function hideSplash() {
  const sp = document.getElementById('splash'); if (!sp) return;
  const wait = Math.max(0, 1600 - (Date.now() - (window.__t0 || Date.now())));
  setTimeout(() => { sp.classList.add('done'); setTimeout(() => { sp.classList.add('out'); setTimeout(() => sp.remove(), 500); }, 380); }, wait);
}
if (sync.enabled()) sync.run();
document.addEventListener('visibilitychange', () => { if (!document.hidden) { auth.refreshIfNeeded(); materializeRecurring(); if (sync.enabled()) sync.run(); } });
setInterval(() => { if (!document.hidden && sync.enabled()) sync.run(); }, 45000);
if ('serviceWorker' in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; if (navigator.serviceWorker.controller) { try { sessionStorage.setItem('pari:nosplash', '1'); } catch (_) {} location.reload(); } });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
      reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
      reg.addEventListener('updatefound', () => { const nw = reg.installing; nw && nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('Aggiornamento in arrivo…'); }); });
    }).catch(() => {});
  });
}
window.PARI = { state: () => S, addEntry, balances, monthStats, sync, toast, parseReceipt, scanReceipt, levelInfo, showLevelUp, missions, trophies, missionPool: () => MISSION_POOL, joinSection, leaveSection, removeMember, acceptRequest, refuseRequest, checkPendingJoins, cancelJoin, cleanupSections, isCoupleAccount, hasOthers, pairBalances, sectionCodes, mainSection, migrateIdentity, migrateSections, me, groups: () => S.groups, splitEqual };
})();

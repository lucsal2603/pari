/* ==========================================================================
   Divvy — app spese di coppia. Vanilla JS, dati in localStorage,
   sincronizzazione opzionale via Supabase (REST).
   ========================================================================== */
(() => {
'use strict';

const APP_VERSION = '1.18.2';
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
    groups: [{ id: 'g1', name: 'Spese casa', createdAt: '2026-09-04T00:00:00.000Z', updatedAt: '2026-09-04T00:00:00.000Z', deleted: false }],
    settings: { me: 'm1', currency: 'EUR', together: '', sync: { url: SUPA_URL, key: SUPA_ANON, house: '' }, lastPull: null, membersUpdatedAt: null, groupsUpdatedAt: null, lastGroup: 'g1', deviceId: null, push: null, pushUpdatedAt: null, notified: [], onboarded: false },
    ui: { month: curYM(), statsRange: 'mese', balTab: 0, homeMode: 'paid' },
  };
}
let S = load();
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw); const d = defaultState(); const st = { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}), sync: { ...d.settings.sync, ...((s.settings || {}).sync || {}) } }, ui: { ...d.ui, ...(s.ui || {}), month: curYM() } };
    if (!Array.isArray(s.groups)) { st.groups = d.groups; st.entries.forEach((e) => { if (!e.group) e.group = 'g1'; }); st.settings.lastGroup = 'g1'; }
    if (!st.settings.sync.url) { st.settings.sync.url = SUPA_URL; st.settings.sync.key = SUPA_ANON; }
    // telefoni già collegati prima dell'arrivo della presentazione: non la mostro
    if ((s.settings || {}).onboarded === undefined) st.settings.onboarded = !!(st.settings.sync && st.settings.sync.house);
    return st; } } catch (e) { console.warn('stato corrotto', e); }
  return defaultState();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Memoria piena: impossibile salvare'); } }
const me = () => S.members.find((m) => m.id === S.settings.me) || S.members[0];
const other = () => S.members.find((m) => m.id !== me().id) || S.members[1];
const member = (id) => S.members.find((m) => m.id === id) || { id, name: '?', color: '#999' };
const active = () => S.entries.filter((e) => !e.deleted);
const groups = () => S.groups.filter((g) => !g.deleted);
const groupOf = (e) => S.groups.find((g) => g.id === e.group && !g.deleted) || null;
const groupName = (e) => { const g = groupOf(e); return g ? g.name : 'Senza sezione'; };
function addGroup(name) { const g = { id: 'g-' + uid(), name: name.trim(), createdAt: nowISO(), updatedAt: nowISO(), deleted: false }; S.groups.push(g); S.settings.groupsUpdatedAt = nowISO(); save(); sync.schedule(); return g; }
function renameGroup(id, name) { const g = S.groups.find((x) => x.id === id); if (!g || !name.trim()) return; g.name = name.trim(); g.updatedAt = nowISO(); S.settings.groupsUpdatedAt = g.updatedAt; save(); sync.schedule(); }
function deleteGroup(id) { const g = S.groups.find((x) => x.id === id); if (!g) return; g.deleted = true; g.updatedAt = nowISO(); S.settings.groupsUpdatedAt = g.updatedAt; if (S.settings.lastGroup === id) S.settings.lastGroup = (groups()[0] || {}).id || null; save(); sync.schedule(); }

if (!S.settings.deviceId) { S.settings.deviceId = 'd-' + uid(); save(); }

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
  async signUp(email, password, data) { const r = await fetch(SUPA_URL + '/auth/v1/signup', { method: 'POST', headers: this.h(), body: JSON.stringify({ email, password, data: data || {}, options: { emailRedirectTo: appUrl() } }) }); const j = await r.json(); if (!r.ok) throw new Error(authMsg(j)); if (j.access_token) { this.setSession(j); return 'ok'; } return 'confirm'; },
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
  if (S.settings.me !== 'm2') return;
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
  return { title, body: `${e.kind === 'payment' ? 'Pagamento' : e.desc}: ${money(e.amount)}\n${line}` };
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
  const sconf = S.settings.sync;
  try { await fetch(sconf.url + '/functions/v1/notify', { method: 'POST', headers: { apikey: sconf.key, Authorization: 'Bearer ' + sconf.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ house: sconf.house, entryIds, actor: me().id }) }); } catch (e) { console.warn('notify', e); }
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
let prevHash = '', curHash = location.hash || '#/home', viaTab = false;
tabbar.addEventListener('click', () => { viaTab = true; });
const tabOf = (h) => { const n = (h || '').slice(2).split(/[/?]/)[0] || 'home'; return { spesa: 'spese', modifica: 'spese', attivita: 'spese', statistiche: 'bilanci', nuova: 'home' }[n] || n; };
function route() {
  prevHash = curHash; curHash = location.hash || '#/home';
  const hash = location.hash || '#/home';
  const [path, qs] = hash.slice(2).split('?');
  const parts = path.split('/'); const q = Object.fromEntries(new URLSearchParams(qs || ''));
  let r = { name: parts[0] || 'home', id: parts[1] || '', sub: parts[1] || '', q };
  if (r.name === 'spese' && q.sezione !== undefined) { speseFilter.group = q.sezione; speseFilter.q = ''; speseFilter.cat = ''; }
  if (r.name === 'join') { const code = decodeURIComponent(r.id || ''); if (auth.user()) { if (applyJoin(code)) toast('Sei nel gruppo: le spese si sincronizzano'); history.replaceState(null, '', onboardingDone() ? '#/home' : '#/benvenuto'); r = { name: onboardingDone() ? 'home' : 'benvenuto', id: '', sub: '', q: {} }; } else { try { localStorage.setItem(JOIN_KEY, code); } catch (_) {} history.replaceState(null, '', '#/accedi'); r = { name: 'accedi', id: '', sub: '', q: {} }; } }
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
  const pages = { home: pageHome, spese: pageSpese, bilanci: pageBilanci, profilo: pageProfilo, nuova: pageForm, modifica: pageForm, spesa: pageDetail, statistiche: pageStats, attivita: pageActivity, benvenuto: pageWelcome, accedi: pageLogin, registrati: pageRegister, recupero: pageRecovery, legale: pageLegal, conferma: pageConfirm };
  const fn = pages[r.name] || pageHome;
  const onb = ['benvenuto', 'accedi', 'registrati', 'recupero', 'conferma'].includes(r.name) || (r.name === 'legale' && !auth.user());
  document.body.classList.toggle('fixed-screen', ['accedi', 'registrati', 'recupero', 'conferma', 'benvenuto'].includes(r.name));
  tabbar.classList.toggle('hide', onb); view.classList.toggle('no-tabbar', onb);
  const tabName = r.name === 'profilo' ? 'profilo' : r.name === 'statistiche' ? 'bilanci' : r.name;
  $$('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tabName));
  view.innerHTML = fn(r);
  window.scrollTo(0, keep);
  bind(r); initSwipes();
  const reveal = () => { $$('.chart').forEach((c) => c.classList.add('in')); $$('[data-w]').forEach((el) => (el.style.width = el.dataset.w)); };
  requestAnimationFrame(() => requestAnimationFrame(reveal)); setTimeout(reveal, 80);
}

/* ---------- Componenti condivisi ---------- */
const ph = (label, cls = '') => `<span class="ph ${cls}">${esc(label)}</span>`;
const imgKey = (m) => (m.id === 'm1' ? 'luca' : m.id === 'm2' ? 'martina' : '');
const avatar = (m, lg = false) => imgKey(m) ? `<img class="avatar${lg ? ' lg' : ''}" src="img/${imgKey(m)}-avatar.png" alt="" title="${esc(m.name)}">` : `<span class="avatar-col${lg ? ' lg' : ''}" style="--bg:${(m.avatar || {}).bg || '#2C4A3B'};--fg:${(m.avatar || {}).fg || '#F8F4EE'}" title="${esc(m.name)}">${icon('i-user')}</span>`;
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
  </a><button type="button" class="swipe-del" aria-label="Elimina">${icon('i-trash')}Elimina</button></div>`;
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
  const sg = balanceSentence(groupBalance(g.id));
  return `<a class="row" href="#/spese?sezione=${g.id}" style="--i:${i}"><span class="cat-ic">${icon('i-list')}</span><span class="main"><span class="title">${esc(g.name)}</span><span class="sub">${es.length} ${es.length === 1 ? 'voce' : 'voci'} · tot. ${money(tot)}</span></span><span class="right"><span class="money ${sg.even ? 'muted' : sg.sign === '+' ? 'green' : 'red'}">${sg.even ? 'in pari' : sg.sign + ' ' + money(sg.amount)}</span><span class="by muted">${sg.even ? '' : esc(sg.sign === '+' ? 'ti deve' : 'gli devi').replace('gli devi', 'devi a ' + other().name)}</span></span></a>`;
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
    <div class="head left"><div class="greet">Ciao ${esc(a.name)}! <span aria-hidden="true">👋</span></div><a class="who-chip" href="#/profilo"><span class="sync-dot ${syncCls}" title="Sincronizzazione"></span>${esc(a.name)} ${avatar(a)}</a></div>
    <section class="card hero${sent.even ? ' even' : sent.sign === '+' ? ' owed' : ' owe'}">
      <div class="k">Saldo totale</div>
      <div class="amt">${sent.even ? money(0) : sent.sign + ' ' + money(sent.amount)}</div>
      <div class="s">${esc(sent.text)}</div>
      ${coupleScene('hero-couple')}
    </section>
    <div class="link-row"><h2 class="sec-title">Sezioni</h2><a href="#/profilo/sezioni">Gestisci ${icon('i-right')}</a></div>
    <section class="card list-card"><div class="list stagger">${groups().map((g, i) => groupRow(g, i)).join('') || '<div class="empty small" style="padding:18px">Nessuna sezione: creane una da Gestisci.</div>'}</div></section>
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
    </section>
    ${installBanner()}
  </div>`;
}

/* ---------- SPESE ---------- */
let speseFilter = { q: '', cat: '', group: '' };
function pageSpese(r) {
  return `<div class="page">
    <div class="head left${r.back ? ' with-back' : ''}">${r.back ? `<button class="icon-btn" data-back="${esc(r.back)}" aria-label="Indietro">${icon('i-back')}</button>` : ''}<div class="title">${speseFilter.group && groups().find((g) => g.id === speseFilter.group) ? esc(groups().find((g) => g.id === speseFilter.group).name) : 'Spese'}</div><a class="icon-btn" href="#/attivita" aria-label="Attività">${icon('i-repeat')}</a></div>
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
  const owesAB = Math.max(0, -(bal[a.id] || 0)), owesBA = Math.max(0, bal[a.id] || 0);
  let body;
  if (tab === 0) {
    body = `<section class="card saldo${sent.even ? ' even' : sent.sign === '+' ? ' owed' : ' owe'}"><div><div class="k">Saldo attuale</div><div class="amt">${sent.even ? money(0) : sent.sign + ' ' + money(sent.amount)}</div><div class="s">${esc(sent.text)}</div></div>${coupleScene('saldo-couple')}</section>
    <h2 class="sec-title section">Dettaglio</h2>
    <section class="card"><div class="dlist">
      <button type="button" data-settle="${a.id}:${b.id}"><span class="t">${esc(a.name)} deve a ${esc(b.name)}</span><span class="money ${owesAB ? 'red' : ''}">${money(owesAB)}</span>${icon('i-right')}</button>
      <button type="button" data-settle="${b.id}:${a.id}"><span class="t">${esc(b.name)} deve a ${esc(a.name)}</span><span class="money ${owesBA ? 'green' : ''}">${money(owesBA)}</span>${icon('i-right')}</button>
      <div><span class="t">In pari</span><span class="money">${money(0)}</span>${sent.even ? icon('i-check') : '<span></span>'}</div>
    </div></section>
    <div class="section"><a class="btn" href="#/nuova?tipo=pagamento">Registra pagamento</a></div>
    ${groups().length ? `<h2 class="sec-title section">Per sezione</h2><section class="card"><div class="dlist">${groups().map((g) => { const bg = groupBalance(g.id); const sg = balanceSentence(bg); return `<a href="#/spese?sezione=${g.id}" style="display:grid;grid-template-columns:1fr auto 18px;align-items:center;gap:10px;padding:14px 0;border-top:1px solid var(--line);font-weight:600;font-size:14.5px"><span class="t">${esc(g.name)}<span class="muted small" style="margin-left:6px">${sg.even ? 'in pari' : esc(sg.text)}</span></span><span class="money ${sg.even ? '' : sg.sign === '+' ? 'green' : 'red'}">${sg.even ? money(0) : sg.sign + ' ' + money(sg.amount)}</span>${icon('i-right')}</a>`; }).join('')}</div></section>` : ''}
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
    <div class="head left${r.back ? ' with-back' : ''}">${r.back ? `<button class="icon-btn" data-back="${esc(r.back)}" aria-label="Indietro">${icon('i-back')}</button>` : ''}<div class="title">Bilanci</div><a class="icon-btn" href="#/statistiche" aria-label="Statistiche">${icon('i-chart')}</a></div>
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
      <div class="date">${esc(dateLong(e.date))}${!isPay && e.cat ? ' · ' + esc(c.name) : ''}${e.recurringOf || e.recurring ? ' · si ripete ogni mese' : ''}${groups().length > 1 || !groupOf(e) ? ' · ' + esc(groupName(e)) : ''}</div>
      <div class="amt">${money(e.amount)}</div>
      <div class="by ${payer.id === S.members[0].id ? 'green' : 'orange'}">${isPay ? 'Saldo aggiornato' : 'Pagato da ' + esc(payer.name)}</div>
      ${(() => { const m = myShare(e); return m.label ? `<div style="margin-top:10px"><span class="pill ${m.cls === 'green' ? 'green' : 'red'}">${esc(m.label)}</span></div>` : ''; })()}
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
    F = editing ? { routeKey: location.hash, id: editing.id, kind: editing.kind, group: editing.group || null, desc: editing.desc || '', amount: moneyPlain(editing.amount), date: editing.date, cat: editing.cat || '', paidBy: editing.paidBy, splitMethod: editing.splitMethod || 'equal', splitInput: { ...(editing.splitInput || {}) }, notes: editing.notes || '', recurring: editing.recurring === 'monthly', to: Object.keys(editing.owed || {})[0] }
      : { routeKey: location.hash, id: null, kind: r.q.tipo === 'pagamento' ? 'payment' : 'expense', desc: '', amount: '', date: todayStr(), cat: '', paidBy: me().id, splitMethod: 'equal', splitInput: {}, notes: '', recurring: false, to: other().id, group: (groups().find((g) => g.id === S.settings.lastGroup) || groups()[0] || {}).id || null };
    if (editing && F.group === undefined) F.group = editing.group || null;
    if (F.kind === 'expense') { const sp = S.settings.split; if (!editing && sp && sp.mode === 'custom' && sp.pct) { F.splitMethod = 'percent'; F.splitInput = { ...sp.pct }; } else F.splitMethod = 'equal'; }
    if (!editing && F.kind === 'payment') { const bal = balances(); const v = bal[me().id] || 0; if (v < 0) { F.paidBy = me().id; F.to = other().id; F.amount = moneyPlain(-v); } else if (v > 0) { F.paidBy = other().id; F.to = me().id; F.amount = moneyPlain(v); } }
  }
  const isPay = F.kind === 'payment'; const a = me(), b = other();
  const optCard = (m, sel, key) => `<button type="button" class="opt${sel ? ' on' : ''}" data-pick="${key}" data-id="${m.id}">${avatar(m)}<span><span class="t">${esc(m.name)}</span></span>${icon('i-right')}</button>`;
  const payerOf = (id) => member(id);
  return `<div class="page up">
    <div class="head"><button class="icon-btn" data-back="${editing ? '#/spesa/' + editing.id : '#/home'}" aria-label="Annulla">${icon('i-x')}</button><div class="title">${editing ? (isPay ? 'Modifica pagamento' : 'Modifica spesa') : (isPay ? 'Nuovo pagamento' : 'Nuova spesa')}</div><button class="icon-btn green" id="save-top" aria-label="Salva">${icon('i-check')}</button></div>
    <form id="f" novalidate>
      ${isPay ? '' : `<div class="field"><label for="desc">Descrizione</label><input id="desc" type="text" placeholder="Cena pizza" value="${esc(F.desc)}" autocomplete="off" enterkeyhint="next"></div>`}
      <div class="field"><label for="amount">Importo</label><div class="money-input"><span class="cur">€</span><input id="amount" type="text" inputmode="decimal" placeholder="0,00" value="${esc(F.amount)}" autocomplete="off"></div><div class="hint err" id="amount-err" hidden>Inserisci un importo valido.</div></div>
      ${isPay
        ? `<div class="field"><div class="lbl">Pagamento</div><div class="pay-dir">${avatar(payerOf(F.paidBy))}<span class="txt"><span class="t">${esc(payerOf(F.paidBy).name)} dà a ${esc(payerOf(F.to).name)}</span><span class="d">${F.amount ? '€ ' + esc(F.amount) : 'la somma qui sopra'} · il saldo fra voi si aggiorna</span></span>${avatar(payerOf(F.to))}</div></div>`
        : `<div class="field"><div class="pay-dir soft">${avatar(payerOf(F.paidBy))}<span class="txt"><span class="t">${F.id ? 'Pagata da ' + esc(payerOf(F.paidBy).name) : 'Paghi tu, ' + esc(payerOf(F.paidBy).name)}</span><span class="d" id="half-hint">${halfHint()}</span></span></div></div>
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
  const v = parseAmount(F.amount); const o = other();
  if (F.splitMethod === 'percent' && F.splitInput) { const pm = +F.splitInput[me().id] || 50; return !isNaN(v) ? `Tu ${pm}%: ${money(Math.round(v * pm / 100))} · ${o.name} ${100 - pm}%` : `Divisa ${pm}% / ${100 - pm}% con ${o.name}`; }
  return !isNaN(v) ? 'Metà a testa: ' + money(Math.round(v / 2)) : 'Divisa a metà con ' + o.name;
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
  const data = { kind: F.kind, desc: F.kind === 'payment' ? 'Pagamento' : F.desc.trim(), amount, date: F.date || todayStr(), cat: F.kind === 'payment' ? '' : F.cat, paidBy: F.paidBy, splitMethod: F.kind === 'payment' ? 'exact' : F.splitMethod, splitInput: F.splitMethod === 'equal' ? {} : { ...F.splitInput }, owed, notes: F.notes.trim(), group: F.group || null };
  if (F.group) { S.settings.lastGroup = F.group; }
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
  if (r.sub === 'sezioni') return pageGroups();
  if (r.sub === 'sync') return pageSync();
  if (r.sub === 'notifiche') return pageNotifiche();
  if (r.sub === 'info') return pageInfo();
  if (r.sub === 'esporta') return pageExport();
  const together = S.settings.together ? `Insieme dal ${esc(S.settings.together)} <span aria-hidden="true">❤️</span>` : 'Le nostre spese, a metà <span aria-hidden="true">❤️</span>';
  const syncOn = sync.enabled();
  return `<div class="page">
    <div class="profile-head">${r.back ? `<button class="icon-btn profile-back" data-back="${esc(r.back)}" aria-label="Indietro">${icon('i-back')}</button>` : ''}<div class="couple-circle"><img src="img/coppia.png" alt=""></div><div class="n">${esc(S.members[0].name)} &amp; ${esc(S.members[1].name)}</div><div class="s">${together}</div></div>
    <section class="card profile-list"><div class="menu">
      <a href="#/profilo/account">${icon('i-gear')}<span>Impostazioni account</span><span class="val">Io sono ${esc(a.name)}</span>${icon('i-right', 'ic chev')}</a>
      <a href="#/profilo/sezioni">${icon('i-list')}<span>Sezioni</span><span class="val">${groups().length}</span>${icon('i-right', 'ic chev')}</a>
      <a href="#/profilo/categorie">${icon('i-grid')}<span>Categorie</span><span></span>${icon('i-right', 'ic chev')}</a>
      <a href="#/profilo/account">${icon('i-coin')}<span>Valuta</span><span class="val">EUR (€)</span>${icon('i-right', 'ic chev')}</a>
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
function pageGroups() {
  const counts = {}; active().forEach((e) => { const k = groupOf(e) ? e.group : ''; counts[k] = (counts[k] || 0) + 1; });
  const orphans = counts[''] || 0;
  return `<div class="page slide">${subHead('Sezioni')}
    <p class="muted small" style="margin:0 2px 12px">Le sezioni raggruppano le spese, come i gruppi di Splitwise (es. Spese casa, Vacanze). Quando aggiungi una spesa resta selezionata l'ultima usata.</p>
    <section class="card list-card"><div class="list stagger">${groups().map((g, i) => `<div class="row" style="--i:${i}"><span class="cat-ic">${icon('i-list')}</span><span class="main"><span class="title">${esc(g.name)}</span><span class="sub">${counts[g.id] || 0} ${counts[g.id] === 1 ? 'voce' : 'voci'}${S.settings.lastGroup === g.id ? ' · predefinita' : ''}</span></span><span class="right" style="flex-direction:row;gap:2px"><button type="button" class="icon-btn" data-rename="${g.id}" aria-label="Rinomina">${icon('i-edit')}</button><button type="button" class="icon-btn red" data-delete-group="${g.id}" aria-label="Elimina">${icon('i-trash')}</button></span></div>`).join('') || '<div class="empty small" style="padding:18px">Nessuna sezione.</div>'}</div></section>
    ${orphans ? `<p class="muted small" style="margin:10px 2px">${orphans} ${orphans === 1 ? 'voce è' : 'voci sono'} senza sezione.</p>` : ''}
    <div class="section"><div style="display:flex;gap:8px"><input class="input" id="new-group-name" type="text" placeholder="Nuova sezione, es. Vacanze" autocomplete="off"><button type="button" class="btn sm" id="new-group-create" style="height:50px;flex:none">Crea</button></div></div>
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
      <label class="menu-import">${icon('i-upload')}<span>Importa backup <span class="d">Unisce un file JSON esportato da Divvy: niente doppioni.</span></span><span></span>${icon('i-right', 'ic chev')}<input type="file" accept="application/json,.json" id="import-file" hidden></label>
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
    <p class="small muted" style="margin:10px 0 0">Il database condiviso è già impostato. Per collegare i due telefoni basta scrivere lo stesso <b>codice casa</b> su entrambi e premere "Salva e collega".</p></section>
    <section class="card section">
      <div class="field" style="margin-top:0"><label for="s-url">URL del progetto</label><input id="s-url" type="url" placeholder="https://xxxx.supabase.co" value="${esc(s.url)}" autocapitalize="off" autocorrect="off"></div>
      <div class="field"><label for="s-key">Chiave pubblica (anon key)</label><input id="s-key" type="password" placeholder="eyJhbGciOi…" value="${esc(s.key)}" autocapitalize="off" autocorrect="off"></div>
      <div class="field"><label for="s-house">Codice casa</label><input id="s-house" type="text" placeholder="es. luca-martina-2026" value="${esc(s.house)}" autocapitalize="off" autocorrect="off"><div class="hint">Una parola segreta scelta da voi: separa i vostri dati da quelli di chiunque altro usasse lo stesso database.</div></div>
      <div class="section btn-row"><button class="btn" id="save-sync">Salva e collega</button>${on ? `<button class="btn soft" id="sync-now">Sincronizza ora</button>` : ''}</div>
      ${on ? `<div class="section"><button class="btn ghost" id="sync-off">Scollega questo telefono</button></div>` : ''}
    </section>
  </div>`;
}
function pageNotifiche() {
  const supported = 'Notification' in window && 'PushManager' in window; const perm = supported ? Notification.permission : 'unsupported';
  const on = !!S.settings.push && perm === 'granted'; const needsHome = isIOS() && !isStandalone();
  const st = !supported ? (needsHome ? 'Su iPhone le notifiche arrivano solo se l\'app è sulla schermata Home' : 'Questo browser non supporta le notifiche') : perm === 'denied' ? 'Permesso negato: riattivalo da Impostazioni iOS → Notifiche → Divvy' : on ? 'Attive su questo telefono' : 'Non attive';
  const sample = notifText({ kind: 'expense', desc: 'Spesa', amount: 1000 }, other().name, (balances()[me().id] || 0));
  return `<div class="page slide">${subHead('Notifiche')}
    <section class="card"><div class="status-line"><span class="sync-dot ${on ? '' : perm === 'denied' ? 'err' : 'off'}"></span>${esc(st)}</div>
    <p class="small muted" style="margin:10px 0 0">Quando ${esc(other().name)} aggiunge una spesa o un pagamento ti arriva un avviso così:</p>
    <div class="notif-preview"><img src="icons/icon-192.png" alt=""><div><div class="t">${esc(sample.title)}</div><div class="b">${esc(sample.body).replace('\n', '<br>')}</div></div></div>
    ${!sync.enabled() ? '<p class="small muted" style="margin:10px 0 0">Serve prima la <a href="#/profilo/sync" style="color:var(--green);font-weight:700">sincronizzazione</a>: è quella che porta la spesa da un telefono all\'altro.</p>' : ''}
    ${needsHome ? '<p class="small muted" style="margin:10px 0 0">Aggiungi Divvy alla schermata Home (Condividi → Aggiungi alla schermata Home) e apri le notifiche da lì.</p>' : ''}
    </section>
    <div class="section btn-row">${on ? `<button class="btn soft" id="push-test">Prova una notifica</button><button class="btn ghost" id="push-off">Disattiva</button>` : `<button class="btn" id="push-on" ${supported && perm !== 'denied' ? '' : 'disabled'}>Attiva le notifiche</button>`}</div>
  </div>`;
}
function pageInfo() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  return `<div class="page slide">${subHead("Informazioni sull'app")}
    <section class="card" style="text-align:center;padding:26px 18px"><img src="icons/preview-256.png" alt="" width="72" height="72" style="border-radius:18px"><div style="font-weight:800;font-size:22px;margin-top:12px">Divvy</div><div class="muted small">Versione ${APP_VERSION}${standalone ? ' · installata' : ' · nel browser'}</div>
    <p class="small" style="margin:14px 0 0;color:var(--ink-2)">Le spese di ${esc(S.members[0].name)} e ${esc(S.members[1].name)}, divise a metà. Funziona anche senza rete: i dati sono salvati sul telefono.</p></section>
    <section class="card section"><div class="kv">
      <div><span class="k">Voci salvate</span><span class="v">${active().length}</span></div>
      <div><span class="k">Attività registrate</span><span class="v">${S.activity.length}</span></div>
      <div><span class="k">Spazio usato</span><span class="v">${Math.round((localStorage.getItem(KEY) || '').length / 1024)} KB</span></div>
    </div></section>
    <section class="card section"><div class="menu"><a href="#/legale/termini">${icon('i-info')}<span>Termini di servizio</span><span></span>${icon('i-right', 'ic chev')}</a><a href="#/legale/privacy">${icon('i-lock')}<span>Informativa sulla privacy</span><span></span>${icon('i-right', 'ic chev')}</a></div></section>
    <div class="section btn-row"><button class="btn soft" id="reload-app">Ricarica l'app</button><button class="btn ghost" id="replay-onb">Rivedi la presentazione</button></div>
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

/* ---------- Schermata di accesso / registrazione ---------- */
let LG = { mode: 'login', email: '', busy: false, show: false, sent: '' };
function pageLogin() {
  const reg = LG.mode === 'register';
  return `<div class="page onb login">
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
  applyPendingJoin();
  const done = onboardingDone();
  OB = { step: 1, name: done ? me().name : '', partner: '', house: '', avatar: 0, split: (S.settings.split || {}).mode === 'custom' ? 'custom' : 'equal', pct: ((S.settings.split || {}).pct || {})[me().id] || 50 };
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

/* ---------- Presentazione per chi apre l'app la prima volta ---------- */
let OB = { step: 1, name: '', partner: '', house: '', avatar: 0, split: 'equal', pct: 50 };
const JOIN_KEY = 'pari:join';
const newHouseCode = () => { const A = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; const r = crypto.getRandomValues(new Uint8Array(6)); for (let i = 0; i < 6; i++) c += A[r[i] % A.length]; return c; };
function ensureHouse() { if (!S.settings.sync.house) { S.settings.sync.house = newHouseCode(); save(); if (sync.enabled()) sync.run(true); } return S.settings.sync.house; }
const inviteLink = () => appUrl() + '#/join/' + encodeURIComponent(ensureHouse());
const inviteText = () => `Unisciti al mio gruppo su Divvy per dividere le spese: ${inviteLink()}`;
/* chi apre un link di invito: il codice del gruppo viene salvato e applicato dopo l'accesso */
function applyJoin(code) {
  if (!code) return false; const cur = S.settings.sync.house;
  if (cur && cur !== code && active().length) { toast('Sei già in un gruppo: cambialo da Profilo → Backup e sincronizzazione'); return false; }
  S.settings.sync.house = code; S.settings.joinedVia = code; save(); if (sync.enabled()) sync.run(true); return true;
}
function applyPendingJoin() { let code = ''; try { code = localStorage.getItem(JOIN_KEY) || ''; localStorage.removeItem(JOIN_KEY); } catch (_) {} if (code && applyJoin(code)) toast('Sei nel gruppo: le spese si sincronizzano'); }
const AVATARS = [{ bg: '#2C4A3B', fg: '#F8F4EE' }, { bg: '#F8D9D2', fg: '#D7563C' }, { bg: '#D3E7F5', fg: '#4E8FBF' }, { bg: '#E0DBF3', fg: '#7B68B8' }, { bg: '#D3E6D8', fg: '#4C8A66' }, { bg: '#F7E7C3', fg: '#C99A2E' }];
const arrowIc = '<svg class="ic"><path d="M5 12h14M13 5l7 7-7 7"/></svg>';
function pageWelcome() {
  const st = OB.step; const dots = `<div class="onb-dots" style="view-transition-name:onb-dots">${[1, 2, 3, 4].map((i) => `<i class="${i === st ? 'on' : ''}"></i>`).join('')}</div>`;
  const top = `<div class="onb-top">${st > 1 ? `<button type="button" class="icon-btn onb-back" data-ob-back aria-label="Indietro">${icon('i-back')}</button>` : '<span></span>'}<button type="button" class="onb-skip" data-ob-skip>Salta</button></div>`;
  let body = '';
  if (st === 1) body = `<img class="onb-logo" src="img/logo.png" alt="Divvy">
    <h1 class="onb-h">Ciao!<br>Come possiamo chiamarti?</h1><p class="onb-p">È il primo passo per iniziare a condividere le spese insieme.</p>
    <div class="onb-art"><img src="img/benvenuto.png" alt=""></div>
    <form class="onb-form" data-ob-form><label class="onb-field">${icon('i-user')}<input id="ob-name" type="text" placeholder="Il tuo nome" value="${esc(OB.name)}" autocomplete="given-name" autocapitalize="words" enterkeyhint="next"></label>
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
      <div class="onb-people"><span>${avatar(a, true)}${esc(a.name)}</span><span>${avatar(b, true)}${esc(b.name)}</span></div>
      <div class="onb-kv">${icon('i-balance')}<span>Divisione predefinita</span><b>${pm}% / ${100 - pm}%</b></div>
      <div class="onb-kv">${icon('i-coins')}<span>Valuta</span><b>Euro (€)</b></div></div>
    <div class="onb-form"><button type="button" class="btn onb-btn" data-ob-finish>Inizia con Divvy ${arrowIc}</button></div>`; }
  return `<div class="page onb steps" style="view-transition-name:onb-stage">${top}${body}${dots}</div>`;
}
function obGo(step, dir) {
  OB.step = step; const doRender = () => render();
  if (document.startViewTransition) { document.documentElement.dataset.obDir = dir || 'next'; const t = document.startViewTransition(doRender); t.finished.catch(() => {}).finally(() => { delete document.documentElement.dataset.obDir; }); if (t.ready) t.ready.catch(() => {}); }
  else doRender();
}
function obFinish() {
  S.settings.onboarded = true; const u = auth.user(); if (u) { S.settings.onboardedFor = u.id; auth.updateMeta({ onboarded: true }); } save(); const nm = me().name; OB = { step: 1, name: '', partner: '', house: '', avatar: 0, split: 'equal', pct: 50 }; go('#/home');
  if (!sync.enabled()) toast(`Per condividere con ${other().name}: Profilo → Backup e sincronizzazione`); else if (!S.settings.push) toast('Attiva gli avvisi da Profilo → Notifiche'); else toast(`Divvy è pronta, ${nm}`);
}
function bindWelcome() {
  $$('[data-ob-skip]').forEach((b) => b.addEventListener('click', obFinish));
  const form = $('[data-ob-form]');
  if (form) form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (OB.step === 1) { const n = ($('#ob-name').value || '').trim(); if (!n) { $('#ob-name').focus(); return; } OB.name = n;
      const found = S.members.find((m) => m.name.trim().toLowerCase() === n.toLowerCase());
      if (found) S.settings.me = found.id; else { const slot = S.settings.joinedVia ? S.members[1] : S.members[0]; slot.name = n; S.settings.me = slot.id; S.settings.membersUpdatedAt = nowISO(); }
      OB.partner = OB.partner || other().name; save(); obGo(2); return; }
    if (OB.step === 2) { obGo(3); return; }
    if (OB.step === 3) { const a = me(), b = other(); S.settings.split = OB.split === 'custom' ? { mode: 'custom', pct: { [a.id]: OB.pct, [b.id]: 100 - OB.pct } } : { mode: 'equal' }; save(); obGo(4); return; }
  });
  $$('[data-ob-split]').forEach((b) => b.addEventListener('click', () => { OB.split = b.dataset.obSplit; $$('.onb-opt').forEach((x) => x.classList.toggle('on', x === b)); $('#onb-pct').hidden = OB.split !== 'custom'; }));
  const rng = $('#pct-range'); if (rng) rng.addEventListener('input', () => { OB.pct = +rng.value; $('#pct-me').textContent = OB.pct + '%'; $('#pct-other').textContent = (100 - OB.pct) + '%'; });
  $$('[data-ob-edit]').forEach((b) => b.addEventListener('click', () => obGo(1, 'back')));
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
  if (r.q.da && !F.id && F.kind === 'payment' && !F._prefilled) { F.paidBy = r.q.da; F.to = r.q.a; const bal = balances(); const v = bal[r.q.a] || 0; F.amount = v > 0 ? moneyPlain(v) : ''; F._prefilled = true; render(); return; }
  const form = $('#f');
  const rerender = () => { const pos = window.scrollY; render(); window.scrollTo(0, pos); };
  bindSeg($('[data-seg="kind"]'), (v) => { F.kind = v; if (v === 'payment') { const bal = balances(); const m = bal[me().id] || 0; if (m < 0) { F.paidBy = me().id; F.to = other().id; F.amount = moneyPlain(-m); } else if (m > 0) { F.paidBy = other().id; F.to = me().id; F.amount = moneyPlain(m); } } rerender(); });
  bindSeg($('[data-seg="splitMethod"]'), (v) => { F.splitMethod = v; F.splitInput = {}; rerender(); });
  const desc = $('#desc'); if (desc) desc.addEventListener('input', () => (F.desc = desc.value));
  const amount = $('#amount'); amount.addEventListener('input', () => { F.amount = amount.value; $('#amount-err').hidden = true; const d = $('#half-hint'); if (d) d.textContent = halfHint(); validateSplit(); });
  $('#date').addEventListener('change', (ev) => (F.date = ev.target.value || todayStr()));
  $('#notes').addEventListener('input', (ev) => (F.notes = ev.target.value));
  $$('[data-pick]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.pick === 'payer') F.paidBy = b.dataset.id; else F.to = b.dataset.id; rerender(); }));
  $$('[data-soon]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.soon === 'friends') toast('Dividere con amici arriva in una prossima versione'); }));
  $$('[data-split]').forEach((b) => b.addEventListener('click', () => { const v = b.dataset.split; if (v === 'equal') F.splitMethod = 'equal'; else if (F.splitMethod === 'equal') F.splitMethod = 'exact'; rerender(); }));
  $$('[data-share]').forEach((inp) => inp.addEventListener('input', () => { F.splitInput[inp.dataset.share] = inp.value; validateSplit(); }));
  $$('[data-cat]').forEach((b) => b.addEventListener('click', () => { F.cat = F.cat === b.dataset.cat ? '' : b.dataset.cat; $$('.cat-circle').forEach((x) => x.classList.toggle('on', x.dataset.cat === F.cat)); $('#cat-name').textContent = F.cat ? catOf(F.cat).name : 'Nessuna categoria'; }));
  const rec = $('#recurring'); if (rec) rec.addEventListener('click', () => { F.recurring = !F.recurring; rec.setAttribute('aria-checked', F.recurring); });
  $$('#form-groups [data-group]').forEach((b) => b.addEventListener('click', () => { F.group = b.dataset.group; F.newGroup = false; $$('#form-groups .chip').forEach((x) => x.classList.toggle('on', x === b)); $('#group-new').hidden = true; }));
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
  if (r.sub === 'sezioni') {
    const create = () => { const i = $('#new-group-name'); const n = (i.value || '').trim(); if (!n) { i.focus(); return; } addGroup(n); toast(`Sezione "${n}" creata`); render(); };
    $('#new-group-create').addEventListener('click', create); $('#new-group-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } });
    $$('[data-rename]').forEach((b) => b.addEventListener('click', () => { const g = S.groups.find((x) => x.id === b.dataset.rename); openSheet('Rinomina sezione', `<div class="field" style="margin-top:0"><input class="input" id="rn" type="text" value="${esc(g.name)}"></div><div class="btn-row" style="margin-top:14px"><button class="btn soft" data-c="no">Annulla</button><button class="btn" data-c="ok">Salva</button></div>`, (sh) => { $('[data-c="no"]', sh).addEventListener('click', () => closeSheet()); $('[data-c="ok"]', sh).addEventListener('click', () => { renameGroup(g.id, $('#rn', sh).value); closeSheet(); render(); }); setTimeout(() => $('#rn', sh).focus(), 350); }); }));
    $$('[data-delete-group]').forEach((b) => b.addEventListener('click', () => { const g = S.groups.find((x) => x.id === b.dataset.deleteGroup); const n = active().filter((e) => e.group === g.id).length; confirmSheet(`Eliminare "${g.name}"?`, n ? `Le sue ${n} voci restano, ma senza sezione.` : 'La sezione è vuota.', 'Elimina', () => { deleteGroup(g.id); render(); toast('Sezione eliminata'); }); }));
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
    const off = $('#sync-off'); if (off) off.addEventListener('click', () => { S.settings.sync = { url: SUPA_URL, key: SUPA_ANON, house: '' }; S.settings.lastPull = null; save(); sync.status = 'idle'; render(); toast('Scollegata: i dati restano sul telefono'); });
  }
  if (r.sub === 'notifiche') {
    const on = $('#push-on'); if (on) on.addEventListener('click', async () => { on.disabled = true; const ok = await enablePush(); render(); if (ok) { toast('Notifiche attivate'); const t = notifText({ kind: 'expense', desc: 'Spesa', amount: 1000 }, other().name, balances()[me().id] || 0); showLocalNotification(t.title, t.body); } });
    const test = $('#push-test'); if (test) test.addEventListener('click', async () => { const t = notifText({ kind: 'expense', desc: 'Spesa', amount: 1000 }, other().name, balances()[me().id] || 0); const ok = await showLocalNotification(t.title, t.body); toast(ok ? 'Inviata: guarda in alto' : 'Non riesco a mostrarla'); });
    const off = $('#push-off'); if (off) off.addEventListener('click', async () => { await disablePush(); render(); toast('Notifiche disattivate'); });
  }
  if (r.sub === 'info') { $('#replay-onb').addEventListener('click', () => { OB = { step: 1, name: '', partner: '', house: '', avatar: 0, split: (S.settings.split || {}).mode === 'custom' ? 'custom' : 'equal', pct: ((S.settings.split || {}).pct || {})[me().id] || 50 }; go('#/benvenuto'); }); }
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
      if ((S.settings.groupsUpdatedAt || '') > since) rows.push({ house: s.house, id: 'groups', kind: 'groups', data: { groups: S.groups }, updated_at: S.settings.groupsUpdatedAt, deleted: false });
      if ((S.settings.pushUpdatedAt || '') > since || (force && S.settings.push)) rows.push({ house: s.house, id: 'push-' + S.settings.deviceId, kind: 'push', data: S.settings.push ? { ...S.settings.push, member: me().id } : { device: S.settings.deviceId }, updated_at: S.settings.pushUpdatedAt || nowISO(), deleted: !S.settings.push });
      const freshMine = S.entries.filter((e) => !e.deleted && (e.createdAt || '') > since && e.paidBy === me().id && !e.recurringOf).map((e) => e.id);
      S.activity.filter((a) => (a.ts || '') > since).forEach((a) => rows.push({ house: s.house, id: 'act-' + a.id, kind: 'activity', data: a, updated_at: a.ts, deleted: false }));
      if (rows.length) {
        const r = await fetch(base + '?on_conflict=house,id', { method: 'POST', headers: this.headers(), body: JSON.stringify(rows) });
        if (!r.ok) throw new Error(await errText(r));
      }
      S.settings.lastPush = nowISO();
      if (freshMine.length && since) notifyOthers(freshMine);
      // 2) scarico tutto ciò che è cambiato dopo l'ultimo scarico
      const q = `?house=eq.${encodeURIComponent(s.house)}&order=updated_at.asc&limit=1000` + (S.settings.lastPull && !force ? `&updated_at=gt.${encodeURIComponent(S.settings.lastPull)}` : '');
      const r2 = await fetch(base + q, { headers: this.headers() });
      if (!r2.ok) throw new Error(await errText(r2));
      const remote = await r2.json(); let changed = 0; const arrived = [];
      remote.forEach((row) => {
        if (row.kind === 'entry') { const e = row.data; const cur = S.entries.find((x) => x.id === e.id); if (!cur) { S.entries.push(e); arrived.push(e); changed++; } else if ((e.updatedAt || '') > (cur.updatedAt || '')) { Object.assign(cur, e); changed++; } }
        else if (row.kind === 'members') { if ((row.updated_at || '') > (S.settings.membersUpdatedAt || '')) { const m = row.data.members; if (Array.isArray(m) && m.length >= 2) { S.members = m; } if (typeof row.data.together === 'string') S.settings.together = row.data.together; S.settings.membersUpdatedAt = row.updated_at; changed++; } }
        else if (row.kind === 'groups') { (row.data.groups || []).forEach((g) => { const cur = S.groups.find((x) => x.id === g.id); if (!cur) { S.groups.push(g); changed++; } else if ((g.updatedAt || '') > (cur.updatedAt || '')) { Object.assign(cur, g); changed++; } }); if ((row.updated_at || '') > (S.settings.groupsUpdatedAt || '')) S.settings.groupsUpdatedAt = row.updated_at; }
        else if (row.kind === 'activity') { if (!S.activity.some((x) => x.id === row.data.id)) { S.activity.push(row.data); } }
      });
      S.activity.sort((a, b) => b.ts.localeCompare(a.ts)); S.activity = S.activity.slice(0, 300);
      if (remote.length) S.settings.lastPull = remote[remote.length - 1].updated_at; else if (!S.settings.lastPull) S.settings.lastPull = nowISO();
      this.status = 'ok'; save();
      if (arrived.length && S.settings.lastPull) notifyIncoming(arrived);
      if (changed) { materializeRecurring(); if (!['nuova', 'modifica'].includes((currentRoute || {}).name)) render(); }
      return true;
    } catch (e) { this.status = 'err'; this.lastError = e.message || String(e); console.warn('sync', e); return false; }
    finally { this.running = false; updateSyncDot(); }
  },
};
async function errText(r) { try { const j = await r.json(); return (j.message || j.hint || j.error || r.status) + ''; } catch (e) { return 'HTTP ' + r.status; } }
function updateSyncDot() { const d = $('.sync-dot'); if (!d) return; d.className = 'sync-dot ' + (!sync.enabled() ? 'off' : sync.status === 'busy' ? 'busy' : sync.status === 'err' ? 'err' : ''); }

/* ---------- Trascina a sinistra per eliminare ---------- */
let openSwipe = null;
function closeSwipe(w) { if (!w) return; w.classList.remove('open'); const r = $('.row', w); if (r) r.style.transform = ''; if (openSwipe === w) openSwipe = null; }
function initSwipes() {
  const W = 96;
  $$('.swipe').forEach((w) => {
    const row = $('.row', w); if (!row) return;
    let down = false, drag = false, moved = false, x0 = 0, y0 = 0, x = 0;
    const setX = (v) => { row.style.transform = v ? `translateX(${v}px)` : ''; };
    row.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button !== 0) return; down = true; drag = false; x0 = e.clientX; y0 = e.clientY; });
    row.addEventListener('pointermove', (e) => {
      if (!down) return; const ddx = e.clientX - x0, ddy = e.clientY - y0;
      if (!drag) { if (Math.abs(ddx) > 8 && Math.abs(ddx) > Math.abs(ddy) * 1.2) { drag = true; moved = true; w.classList.add('dragging'); try { row.setPointerCapture(e.pointerId); } catch (_) {} if (openSwipe && openSwipe !== w) closeSwipe(openSwipe); } else return; }
      const base = w.classList.contains('open') ? -W : 0; x = base + ddx;
      if (x > 0) x = x / 4; if (x < -W) x = -W + (x + W) / 3; // attrito oltre i limiti
      setX(x);
    });
    const end = () => { if (!down) return; down = false; if (!drag) return; drag = false; w.classList.remove('dragging'); if (x < -W / 2) { w.classList.add('open'); openSwipe = w; setX(-W); } else closeSwipe(w); setTimeout(() => (moved = false), 60); };
    row.addEventListener('pointerup', end); row.addEventListener('pointercancel', end);
    row.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); return; } if (w.classList.contains('open')) { e.preventDefault(); e.stopPropagation(); closeSwipe(w); } }, true);
    $('.swipe-del', w).addEventListener('click', (e) => { e.stopPropagation(); const id = w.dataset.id; closeSwipe(w); deleteEntry(id); toast('Eliminata', { label: 'Annulla', fn: () => restoreEntry(id) }); });
  });
}
document.addEventListener('pointerdown', (e) => { if (openSwipe && !openSwipe.contains(e.target)) closeSwipe(openSwipe); }, true);

/* ---------- Tira giù per ricaricare (su qualsiasi pagina) ---------- */
(function pullToRefresh() {
  const app = $('#view'); const el = document.createElement('div'); el.className = 'ptr'; el.innerHTML = `<span class="ptr-ic">${icon('i-undo')}</span><span class="ptr-t">Tira per aggiornare</span>`; document.body.appendChild(el);
  const T = document.querySelector('.ptr-t'), MAX = 110, TRIG = 72; let y0 = 0, pulling = false, dy = 0, busy = false;
  const canPull = () => window.scrollY <= 0 && !$('#sheet-root').firstChild && !busy && !document.body.classList.contains('fixed-screen');
  document.addEventListener('touchstart', (e) => { if (e.touches.length !== 1 || !canPull()) { pulling = false; return; } y0 = e.touches[0].clientY; pulling = true; dy = 0; }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!pulling) return; const d = e.touches[0].clientY - y0;
    if (d <= 0 || window.scrollY > 0) { if (dy > 0) { dy = 0; app.style.transform = ''; el.classList.remove('show', 'ready'); } return; }
    if (e.cancelable) e.preventDefault();
    dy = Math.min(MAX, d * 0.55); app.style.transition = 'none'; app.style.transform = `translateY(${dy}px)`;
    el.classList.add('show'); el.classList.toggle('ready', dy >= TRIG); el.style.setProperty('--p', Math.min(1, dy / TRIG)); T.textContent = dy >= TRIG ? 'Rilascia per ricaricare' : 'Tira per aggiornare';
  }, { passive: false });
  const end = async () => {
    if (!pulling) return; pulling = false; app.style.transition = 'transform .3s var(--ease-out)';
    if (dy >= TRIG) { busy = true; el.classList.add('loading'); T.textContent = 'Aggiorno…'; app.style.transform = `translateY(${TRIG}px)`; try { if (sync.enabled()) await Promise.race([sync.run(true), new Promise((r) => setTimeout(r, 4000))]); } catch (_) {} navigator.serviceWorker?.getRegistration().then((reg) => reg && reg.update()).catch(() => {}); setTimeout(() => location.reload(), 150); return; }
    app.style.transform = ''; el.classList.remove('show', 'ready'); dy = 0;
  };
  document.addEventListener('touchend', end); document.addEventListener('touchcancel', end);
})();

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
importSplitwiseOnce();
materializeRecurring();
(async () => {
  await auth.handleRedirect();
  if (auth.recovery) history.replaceState(null, '', '#/recupero');
  else if (!auth.user()) { if (!/^#\/(accedi|registrati|legale|conferma|join)/.test(location.hash)) history.replaceState(null, '', '#/accedi'); }
  else if (!onboardingDone()) history.replaceState(null, '', '#/benvenuto');
  if (auth.user()) { applyPendingJoin(); showDailyLove(); }
  route();
  auth.refreshIfNeeded().then(() => { if (!auth.user() && currentRoute && currentRoute.name !== 'accedi') render(); });
})();
if (sync.enabled()) sync.run();
document.addEventListener('visibilitychange', () => { if (!document.hidden) { auth.refreshIfNeeded(); materializeRecurring(); if (sync.enabled()) sync.run(); } });
setInterval(() => { if (!document.hidden && sync.enabled()) sync.run(); }, 45000);
if ('serviceWorker' in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; if (navigator.serviceWorker.controller) location.reload(); });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
      reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
      reg.addEventListener('updatefound', () => { const nw = reg.installing; nw && nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('Aggiornamento in arrivo…'); }); });
    }).catch(() => {});
  });
}
window.PARI = { state: () => S, addEntry, balances, monthStats, sync, toast };
})();

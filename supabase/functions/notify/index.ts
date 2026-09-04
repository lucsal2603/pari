// Pari — funzione "notify": avvisa l'altro telefono quando arriva una spesa o un pagamento.
// Deploy:  supabase functions deploy notify --project-ref <REF>
// Segreti: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:tu@esempio.it --project-ref <REF>
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const fmt = (c: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format((c || 0) / 100);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { house, entryIds = [], actor } = await req.json();
    if (!house || !actor) return new Response(JSON.stringify({ error: "house e actor obbligatori" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    const url = Deno.env.get("SUPABASE_URL")!; const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    const rows = await fetch(`${url}/rest/v1/pari_rows?house=eq.${encodeURIComponent(house)}&select=id,kind,data,deleted`, { headers: h }).then((r) => r.json());

    const entries = rows.filter((r: any) => r.kind === "entry" && !r.deleted && r.data && !r.data.deleted).map((r: any) => r.data);
    const members = rows.find((r: any) => r.kind === "members")?.data?.members || [{ id: "m1", name: "Luca" }, { id: "m2", name: "Martina" }];
    const subs = rows.filter((r: any) => r.kind === "push" && !r.deleted && r.data?.sub && r.data.member !== actor);
    const actorName = members.find((m: any) => m.id === actor)?.name || "L'altro";

    // saldo: positivo = deve ricevere
    const bal: Record<string, number> = {}; members.forEach((m: any) => (bal[m.id] = 0));
    entries.forEach((e: any) => { bal[e.paidBy] = (bal[e.paidBy] || 0) + e.amount; for (const [id, c] of Object.entries(e.owed || {})) bal[id] = (bal[id] || 0) - (c as number); });

    webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:lukesalvemini@gmail.com", Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);
    const results: string[] = [];
    for (const id of entryIds) {
      const e = entries.find((x: any) => x.id === id); if (!e) { results.push(`${id}: non trovata`); continue; }
      for (const s of subs) {
        const v = bal[s.data.member] || 0;
        const line = v < 0 ? `Devi ancora: ${fmt(-v)}` : v > 0 ? `${actorName} ti deve ancora: ${fmt(v)}` : "Siete in pari";
        const title = e.kind === "payment" ? `${actorName} ha registrato un pagamento` : `${actorName} ha aggiunto una spesa`;
        const body = `${e.kind === "payment" ? "Pagamento" : e.desc}: ${fmt(e.amount)}\n${line}`;
        try {
          await webpush.sendNotification(s.data.sub, JSON.stringify({ title, body, tag: "pari-" + id, url: "./#/spesa/" + id }), { TTL: 86400 });
          results.push(`${s.id}: ok`);
        } catch (err: any) {
          results.push(`${s.id}: errore ${err?.statusCode || err?.message}`);
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            // sottoscrizione scaduta: la segno cancellata
            await fetch(`${url}/rest/v1/pari_rows?house=eq.${encodeURIComponent(house)}&id=eq.${encodeURIComponent(s.id)}`, { method: "PATCH", headers: h, body: JSON.stringify({ deleted: true, updated_at: new Date().toISOString() }) });
          }
        }
      }
    }
    return new Response(JSON.stringify({ sent: results, subscriptions: subs.length }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});

# Divvy

Le spese di Luca e Martina, divise a metà. Divvy (prima si chiamava Pari) è una web app in stile Splitwise pensata per l'iPhone: si apre in Safari e si aggiunge alla schermata Home come un'app vera (funziona anche senza rete).

**Live:** https://lucsal2603.github.io/pari/

## Cosa fa

- **Home**: saldo totale (chi deve a chi), ultime spese, riepilogo del mese con la divisione fra i due.
- **Spese**: elenco per mese con totali, ricerca, filtro per categoria.
- **Nuova spesa**: descrizione, importo, chi ha pagato, divisione metà e metà o personalizzata (importi, percentuali, quote), categoria, data, note, spesa che si ripete ogni mese (affitto, bollette…).
- **Pagamento**: registra un saldo fra i due (precompilato con il debito attuale).
- **Bilanci**: saldo attuale e dettaglio; per periodo: quanto ha pagato ciascuno in un mese, la sua quota, chi ha anticipato.
- **Statistiche**: mese / 3 mesi / anno; totale, media settimanale, speso a testa, grafico degli ultimi 12 mesi, spese per categoria.
- **Attività**: cronologia di aggiunte, modifiche, eliminazioni, pagamenti.
- **Profilo**: nomi e colori, "io sono" (sul telefono di Martina va scelto Martina), esporta/importa backup, CSV, sincronizzazione.

I riquadri bianchi tratteggiati (illustrazioni e avatar) sono segnaposto: lì vanno le immagini.

## Mettila sulla schermata Home (iPhone)

1. Apri il link in **Safari**.
2. Tocca **Condividi** (il quadrato con la freccia), poi **Aggiungi alla schermata Home**.
3. Da lì in poi si apre a tutto schermo come un'app.

## Vedere le stesse spese su due telefoni

Di base i dati stanno solo sul telefono. Per condividerli serve un piccolo database gratuito su [Supabase](https://supabase.com), circa cinque minuti:

1. Crea un account e un **nuovo progetto** (regione Europa, piano Free).
2. Nel menu a sinistra apri **SQL Editor**, incolla il contenuto di [`supabase.sql`](supabase.sql) ed esegui (**Run**).
3. Vai in **Project Settings → API** e copia **Project URL** e la chiave **anon public**.
4. Nell'app, **Profilo → Backup e sincronizzazione**: incolla URL e chiave, scegli un **codice casa** (una parola segreta qualunque) e premi **Salva e collega**.
5. Fai lo stesso sull'altro telefono con gli **stessi tre valori**. Da quel momento le spese si allineano da sole (ogni volta che si apre l'app e circa ogni 45 secondi mentre è aperta).

In alternativa, senza database: **Profilo → Esporta dati → Backup completo** su un telefono e **Importa backup** sull'altro (non crea doppioni).

## Notifiche (quando l'altro aggiunge una spesa)

Con la sincronizzazione attiva, l'app avvisa già da sola quando è **aperta** e arriva una spesa dell'altro. Per ricevere l'avviso anche ad **app chiusa** (vera notifica push) serve una piccola funzione sul progetto Supabase:

1. Sul Mac, una volta sola: installa la CLI (`brew install supabase/tap/supabase`) e fai `supabase login`.
2. Dalla cartella del progetto: `supabase functions deploy notify --project-ref <REF>` (il REF è nell'URL del progetto: `https://<REF>.supabase.co`).
3. Imposta le chiavi (quelle generate stanno in `.secrets/vapid.json`, che non va mai pubblicato):
   `supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:tu@esempio.it --project-ref <REF>`
4. Su ogni iPhone: app sulla schermata Home (obbligatorio per iOS) → **Profilo → Notifiche → Attiva le notifiche**.

Il testo dell'avviso è ad esempio: **Martina ha aggiunto una spesa** — *Spesa: 10,00 € · Devi ancora: 457,21 €* (oppure *Martina ti deve ancora: …*).

## App nativa iOS (Capacitor)

In `native/` c'è l'involucro nativo: la stessa web app dentro un'app iOS vera, pronta per Xcode.

1. Installa **Xcode** dall'App Store (gratuito) e aprilo una volta per completare l'installazione dei componenti iOS.
2. Dalla cartella `native/`: `npm install`, poi `npm run sync` (copia i file della web app in `www/` e aggiorna il progetto iOS) e `npm run open` (apre Xcode).
3. In Xcode scegli un simulatore o il tuo iPhone e premi **Run**. Per il telefono serve accedere con il tuo Apple ID in Xcode → Settings → Accounts (con un account gratuito l'app resta valida 7 giorni; con l'Apple Developer Program, TestFlight e App Store).

Dopo ogni modifica alla web app: `npm run sync` e di nuovo Run. Nell'app nativa le notifiche web di Safari non esistono: si passa alle notifiche Apple (APNs) con il plugin push di Capacitor, quando ci sarà l'account Developer.

## Sviluppo

È HTML, CSS e JavaScript puro, senza build:

```bash
python3 -m http.server 8078 --directory /Users/lucas/pari
```

- `index.html` — struttura e icone SVG
- `style.css` — stile (crema + verde bosco, Manrope)
- `app.js` — dati (localStorage), conti, pagine, grafici, sincronizzazione
- `sw.js` — service worker per l'uso offline (alzare `VERSION` a ogni pubblicazione)
- `manifest.webmanifest`, `icons/` — installazione sulla Home
- `supabase.sql` — schema per la sincronizzazione

Nella console del browser `PARI.state()` mostra i dati, `PARI.addEntry({...})` ne aggiunge.

## Prossimi passi

- Illustrazioni e avatar al posto dei segnaposto
- Categorie personalizzate
- Dividere con amici (gruppi)
- Pubblicazione su App Store (Capacitor o PWA)

## Lingue

L'interfaccia è in italiano, inglese, spagnolo, francese e tedesco (Profilo → Lingua, bandierine con i colori). La scelta vale solo per il telefono su cui la fai: i dizionari sono in `i18n.js`, con le scritte italiane come chiavi e `{0}`/`{1}` per nomi e importi; le pagine vengono tradotte dopo il disegno, quindi per una scritta nuova basta aggiungerla al dizionario. Date e importi seguono il formato della lingua. Le notifiche push arrivano nella lingua del telefono che le riceve (la funzione `notify` la legge dalla riga `push`).

## Piccoli traguardi

Dal trofeo in alto a destra nella Home si apre la pagina dei traguardi (`#/traguardi`): otto obiettivi calcolati da spese e saldi (tutto in pari, meno del mese scorso, weekend senza extra, 10 spese, primo viaggio, mese da record, tre mesi di fila, primo scontrino letto). Sono uguali per tutti e due i telefoni perché nascono dagli stessi dati; il pallino giallo sul trofeo segnala un traguardo sbloccato non ancora visto. Le illustrazioni stanno in `img/traguardi/` (WebP con trasparenza): dove manca l'immagine resta un riquadro bianco.

## Lettura scontrini (bot)

Tutto sul telefono con Tesseract.js (lingua `ita`), nessun servizio esterno. Prima della lettura la foto viene analizzata una volta (`analyzeGeometry`): soglia di Otsu per trovare il foglio chiaro su sfondo scuro e ritagliarlo (solo se occupa al massimo il 60% della foto, così le notifiche sopra una foto non vengono tagliate) e ricerca dell'angolo di inclinazione (±8°) per raddrizzarlo. Poi fino a sette passaggi in ordine, fermandosi appena trova importo e negozio: scala di grigi (PSM 4), soglia adattiva nelle due polarità, tentativo senza ritaglio, contrasto forzato (PSM 6), foto girata di 90° e 270° se il testo resta illeggibile. Il lettore resta pronto 90 s dopo l'ultima lettura. `parseReceipt` riconosce totale, data, negozio (lista `STORES`, anche con un refuso), categoria dalle parole dello scontrino e le voci con prezzo, che finiscono nelle note; `parseDigital` gestisce notifiche di banca, Satispay, PayPal, Revolut, Amazon e simili (esercente da "presso/a/beneficiario", causale fra virgolette, destinatario di un invio). Immagini di prova in `scontrino-prova*` (ignorate da git).

## Budget

Il tab Budget (al posto di Bilanci, che resta raggiungibile da Home → "Dettaglio saldi") mostra per il mese scelto quanto avete speso rispetto al tetto mensile: barra, quanto resta, giorni rimasti, quanto potete spendere al giorno e la proiezione a fine mese; per i mesi passati dice se il budget è stato rispettato. Ogni categoria può avere il suo budget (tocca la riga). In fondo il grafico degli ultimi sei mesi con la linea del budget. Il budget è personale: ognuno imposta il suo e conta la propria quota delle spese (non il totale della coppia); sta in `S.budget[membro]` e viaggia nelle righe di sync `budget-<membro>` (vince l'ultima modifica). La Home mostra la riga del budget nel mese e "Registra pagamento" sotto il saldo; la pagina di conferma di una spesa dice a che punto è il budget.

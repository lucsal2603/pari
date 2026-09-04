# Pari

Le spese di Luca e Martina, divise a metà. Una web app in stile Splitwise pensata per l'iPhone: si apre in Safari e si aggiunge alla schermata Home come un'app vera (funziona anche senza rete).

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

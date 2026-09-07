# Piano: sezioni con codice (spese condivise a N persone)

Decisioni prese il 7/9/2026 con Lucas:

- Una sezione può avere **quante persone si vuole**, nessun limite.
- Una persona può stare in **più sezioni con persone diverse** (Martina in "Casa", un amico in "Vacanza").
- **Solo chi ha creato la sezione può togliere gli altri**; gli altri possono uscire da soli quando vogliono.
- Chi non condivide nessun codice usa l'app da solo: le sue sezioni sono personali e non c'è mai una divisione.

## Come funziona

Ogni sezione nasce con un **codice** (6 caratteri leggibili, tipo `KX7-4PQ`). Chi riceve il codice lo inserisce nell'app (o apre il link `#/join/CODICE`) ed entra nella sezione: da quel momento vede le spese di quella sezione e le spese si dividono tra i suoi membri. Le sezioni personali hanno il codice ma nessuno lo conosce.

Per te e Martina non cambia niente: la casa attuale diventa il codice della sezione "Spese casa", con voi due dentro.

## Modello dati (dopo)

- **Persona**: id globale (l'id dell'account), nome, avatar. Sostituisce i due membri fissi `m1`/`m2`.
- **Sezione** (`groups[]`): `{ id, name, code, owner, members: [{ id, name, avatar, joinedAt, leftAt }], createdAt, updatedAt, deleted }`.
- **Spesa**: `group`, `paidBy` = id persona, `owed` = `{ idPersona: centesimi }` (equa fra i membri della sezione o su misura).
- **Pagamento**: `paidBy`, `to`, `group`.
- **Sincronizzazione**: su Supabase `house` = codice della sezione. Ogni telefono spinge e scarica le righe di tutte le sezioni di cui è membro. La riga `members` diventa `section` (nome, owner, membri). Le righe `push` (notifiche) e il backup del budget vanno in una "casa" per persona, così le notifiche raggiungono la persona da qualsiasi sezione.
- **Chi esce o viene tolto**: nella lista membri viene segnato `leftAt`; il suo telefono al prossimo scarico vede che non è più membro, smette di sincronizzare quella sezione e la tiene in sola lettura (o la elimina, a scelta dell'utente).
- **Saldi**: per persona, sommando le sezioni in comune. "Metti in pari" con una persona registra un pagamento per ogni sezione in comune con saldo aperto. Il dettaglio saldi mostra sezione per sezione.
- **XP, livelli, missioni, budget, classifica**: già personali, non cambiano.

## Fasi (una per volta, ogni fase finisce pubblicata e usabile)

### Fase 1 — Fondamenta
Persone con id globale, sezioni con codice/owner/membri, migrazione automatica della casa attuale (`sync.house` → sezione "Spese casa" con lo stesso codice, `m1`/`m2` → id di Luca e Martina, spese rimappate), saldi calcolati per persona e per sezione. Nessun cambiamento visibile, a parte il codice nella pagina della sezione. È la fase delicata: si fa con backup e con voi due come collaudo.

### Fase 2 — Entrare e uscire
Pagina "Sezione" dalla matita: codice, condividi (link e testo), lista membri con avatar, "togli" per chi ha creato la sezione, "esci" per gli altri, elimina (solo il creatore). `#/join/CODICE` per entrare. Sincronizzazione di più sezioni insieme. Nuova sezione = nuovo codice.

### Fase 3 — Spese a N persone
Form spesa con "chi ha pagato" e "per chi" a N membri, divisione equa a N o su misura. Sezione personale senza chi-paga e senza divisione. Home con i saldi per persona, "Metti in pari" per persona, dettaglio saldi per sezione. Pagamenti tra due persone qualsiasi.

### Fase 4 — Pagine iniziali
Le 4 pagine nuove: nome e avatar · crea la prima sezione (codice pronto da condividere) oppure "ho un codice" · lingua e valuta · notifiche. Tour aggiornato. Testi nelle 5 lingue.

### Fase 5 — Notifiche e finiture
Funzione `notify` per sezione: avvisa tutti i membri tranne chi ha aggiunto, con il nome vero e la lingua di ciascuno. Pill "Condivisa con Martina e Marco". Classifica per persona con l'id globale. Testi delle missioni al neutro.

## Cosa serve da Lucas

- Il "vai" per la Fase 1.
- Durante la Fase 1: aprire l'app su entrambi i telefoni dopo la pubblicazione, così vedo che la migrazione va bene su tutti e due.

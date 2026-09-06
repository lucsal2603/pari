# Animazioni della mascotte per il tutorial

Sette animazioni in loop, una per passo del tour guidato dentro l'app (`img/tutorial/<id>.webp`, mostrate a circa 110 px di altezza nella card che accompagna ogni passo). Per ognuna, incolla in ChatGPT il **prompt base** seguito dal **prompt del passo**, allegando l'immagine della mascotte (per esempio `img/levelup-mascotte.webp` o `img/fatto.png`).

## Prompt base (da mettere sempre davanti)

> Crea un'animazione in loop perfetto (2–3 secondi, 24 fps, formato quadrato 512×512, sfondo trasparente) della mascotte che ti allego: un telefono cartoon dal corpo verde scuro con lo schermo color crema, due occhi neri ovali e una bocca sorridente con la lingua rosa, braccia e gambe nere sottili, guanti bianchi e scarpe verde acqua lucide, contorni neri spessi in stile flat cartoon anni '30. Mantieni identici proporzioni, colori e stile dell'immagine allegata, niente ombre sotto i piedi, niente testo. L'animazione deve ripartire senza scatti dal primo fotogramma. Consegnamela come GIF o MP4 con sfondo trasparente.

## Passo 1 — `ciao` · "Ciao, sono Divvy!"

> Il telefono è in piedi, guarda verso chi guarda e saluta con la mano destra alzata muovendola avanti e indietro; ogni tanto sbatte le palpebre e inclina leggermente il corpo. Espressione felice e accogliente.

## Passo 2 — `spesa` · "Aggiungi una spesa col +"

> Davanti al telefono galleggia un grande pulsante rotondo verde scuro con un "+" bianco; la mascotte lo tocca con l'indice, il pulsante si schiaccia e si accende, e sopra spunta per un attimo un piccolo scontrino stilizzato che poi svanisce. Ripete il gesto in loop.

## Passo 3 — `scontrino` · "Fotografa lo scontrino"

> La mascotte tiene con la mano sinistra una piccola macchina fotografica retrò e con la destra uno scontrino lungo; scatta una foto allo scontrino: lampo bianco morbido, poi sullo scontrino compaiono tre spunte verdi una dopo l'altra. Loop continuo.

## Passo 4 — `saldi` · "Chi deve cosa"

> La mascotte tiene in equilibrio sulle mani una piccola bilancia a due piatti dorata con una moneta con il simbolo € per parte; la bilancia oscilla piano e poi si ferma in equilibrio, la mascotte annuisce soddisfatta. Loop.

## Passo 5 — `budget` · "Il tuo budget"

> La mascotte infila una moneta dorata con il simbolo € nella fessura di un salvadanaio a forma di maialino rosa; il salvadanaio fa un piccolo rimbalzo contento, la mascotte tira fuori un'altra moneta e ricomincia. Loop.

## Passo 6 — `missioni` · "Missioni, trofei e livelli"

> La mascotte alza con entrambe le mani una coppa dorata e saltella sul posto; intorno esplodono piccole stelle gialle e coriandoli verdi e gialli che ricadono e svaniscono. Loop energico.

## Passo 7 — `pronto` · "Tutto pronto!"

> La mascotte fa il pollice in su con la mano destra e strizza l'occhio; sopra la sua testa vibra una campanella con due lineette di suono, come una notifica in arrivo. Loop rilassato e allegro.

## Quando le hai

Mandamele in chat (GIF o MP4): le converto in WebP animato, le rinomino con l'id del passo e le metto in `img/tutorial/`. Finché mancano, il tutorial mostra un riquadro bianco al posto dell'animazione.

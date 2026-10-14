# Piano — Merce impegnata alla firma, scaricata alla consegna + deposito esterno

Data: 14/10/2026 · Richiesto da Patrizio · Confermato nel principio da Irene (mail del 14/10, 12:00)

## Obiettivo

Il **totale** a video deve essere sempre uguale a quello che c'è fisicamente, anche con ordini firmati e non ancora partiti, e anche con le bottiglie che stanno nel garage di Lucia.

| | Oggi | Dopo |
|---|---|---|
| Firma | merce **tolta** dal disponibile e dal totale | merce **impegnata**: passa in *Riservato*, resta nel totale |
| Consegna (DDT) | nessun movimento | merce **scaricata**: esce da *Riservato* e dal totale |
| Fattura | nessun movimento | nessun movimento |
| Riserva manuale | serve per tenere da parte prima della firma | serve solo per gli accordi a voce prima della firma (rara) |
| Garage di Lucia | non gestito (riserva con nota come ripiego) | stato **"In deposito"**: nel totale, non vendibile, rientrabile |

---

## Fase A — Firma = impegno, consegna = scarico

### Come funziona

1. **Da firmare → Firmato.** Per ogni riga il gestionale crea una **riserva automatica** collegata all'ordine ("Auto: impegno ordine 1025/2026"). Se c'erano già riserve manuali per quell'ordine vengono assorbite, così non si contano due volte. Se non c'è abbastanza disponibile la firma viene bloccata, come oggi.
2. **Firmato → Consegnato** (DDT obbligatorio, come oggi). Il gestionale chiude la riserva e scarica la merce (`riserva_annullata` + `scarico_ordine` con il numero DDT). Lo scarico prende il riferimento DDT subito, non più a posteriori.
3. **Consegnato → Fatturato.** Il magazzino non si muove.
4. **Torna indietro:**
   - Firmato → Da firmare / Annullato: la riserva si libera e la merce torna disponibile. Non serve il DDT di reso, perché la merce non è mai uscita.
   - Consegnato / Fatturato → indietro: resta la regola attuale, rientro solo con il DDT di reso.
   - Togliere il DDT da un ordine consegnato: il magazzino non si muove (il DDT resta in archivio e conta come consegna).

Riuso i movimenti che esistono già (`riserva`, `riserva_annullata`, `scarico_ordine`, `annullo_ordine`): niente tipi nuovi, l'archivio DDT e le riserve attive funzionano senza modifiche.

### Consegne a più riprese (ordini scaglionati)

Oggi "Registra consegna" segna solo la quantità consegnata, senza toccare il magazzino, perché tutto era già scaricato alla firma. Dopo, ogni consegna parziale scarica solo la sua quantità dalla riserva dell'ordine.
**Da decidere:** chiedere il numero DDT a ogni consegna parziale? (Consiglio: sì, per la regola "nessuna merce esce senza DDT".)

### Codice da toccare (index.html)

- `STATI_ORDINE_CON_SCARICO` diventa due liste: **impegno** (`firmato`) e **scarico** (`consegnato`, `fatturato`).
- `applicaTransizioneOrdineMagazzino`: gestire i passaggi da_firmare↔firmato (riserva/rilascio) e firmato→consegnato (scarico dalla riserva). Mantenere l'idempotenza sul netto per ordine.
- `consumaRiserveOrdine`: si sposta dalla firma alla consegna.
- `verificaDisponibilitaOrdine`, `checkDdtReso` / `richiedeDdtReso`, il blocco della riserva manuale su ordini già firmati, l'avviso F#55 sulle righe modificate dopo la firma, la visibilità della sezione "Reso merce".
- `registraConsegna` (consegne scaglionate), firma rapida (`quick_firma`), wizard `confermaTransizioneOrdine`.
- **Report:** il "venduto" e i KPI calcolati sugli `scarico_ordine` passano dalla data di firma alla data di consegna. Va detto a chi legge i report.

### Ordini già esistenti

Oggi un solo ordine è firmato e non consegnato: **1023/2026 Hotel Tornabuoni** (300 da 100 ml, 24 da 250 ml). Nell'inventario del 14/10 Irene non conta più quella merce, quindi probabilmente è già partita.
- Se è partita: Irene lo porta a Consegnato con il DDT. Lo scarico c'è già, il gestionale non scarica di nuovo.
- Se è ancora sullo scaffale: con uno script di migrazione (backup, nessuna cancellazione) storno lo scarico e creo la riserva. Il totale sale di 324, come lo scaffale.
- Il 1024 (Da firmare) non ha bisogno di nulla: alla firma prenderà la riserva in automatico.

---

## Fase B — Deposito esterno (garage di Lucia)

### Come funziona

- Nuovo stato di giacenza **"In deposito"** accanto a Disponibile / Riservato. Conta nel totale, non è vendibile, non scade, nessun avviso.
- **Sposta in deposito** (Disponibile → In deposito) con il nome del deposito (es. "Garage Lucia").
- **Rientro dal deposito** (In deposito → Disponibile) se servono per vendere.
- **Scarico dal deposito** con DDT interno, a fine stagione: esce dal totale.
- Nella scheda SKU: "Totale 300 · di cui 120 in deposito (Garage Lucia) · a scaffale 180". Per la conta Irene confronta lo scaffale con "a scaffale".

### Codice da toccare

`STATI_MAG`, `STATI_MAG_ORDINE`, `ricalcolaGiacenza` (3 nuovi tipi di movimento), `TIPI_MOV`, `MOV_RICHIEDE_DDT` (lo scarico dal deposito vuole il DDT), scheda SKU e riepiloghi, `FONTE_USCITA` (controllo che non si sposti più di quanto c'è).

**Da decidere:** un solo deposito ("Garage Lucia") o più depositi con un nome libero? (Consiglio: nome libero, costa uguale.)
**Da decidere:** lo scarico a fine stagione è "uso proprio / omaggio"? Serve una causale per la contabilità?

---

## Come lo verifico

- Test Node sulle funzioni vere (`ricalcolaGiacenza`, `applicaTransizioneOrdineMagazzino`) con una copia dei dati reali di oggi: ogni giacenza deve restare identica finché non si firma/consegna qualcosa, poi muoversi come previsto.
- Casi: firma, consegna totale, consegne parziali, annullo da firmato, annullo da consegnato con DDT di reso, riserva manuale assorbita, deposito avanti e indietro, scarico deposito.
- Dopo il deploy: prova di Irene su Enrico Travelli, come le volte scorse.

## Ordine di lavoro e tempi indicativi

1. Risposte di Irene: 1023 partito o no? DDT per le consegne parziali? Nome libero per i depositi?
2. Fase A + migrazione del 1023: circa una giornata di lavoro.
3. Fase B: circa mezza giornata. Si può fare anche prima della raccolta 2026, indipendente dalla A.
4. Prova di Irene, poi aggiornamento della Guida magazzino.

## Rischi

- È il cuore del magazzino: un errore sposta le giacenze. Mitigazione: backup prima, test su copia dei dati reali, rilascio quando Irene può provare subito.
- I report di vendita cambiano data di riferimento (firma → consegna).
- Ordini firmati da tablet/altri dispositivi con la versione vecchia aperta: dopo il deploy, ricaricare la pagina ovunque.

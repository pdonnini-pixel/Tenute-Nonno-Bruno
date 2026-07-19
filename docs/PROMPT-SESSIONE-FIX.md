# Prompt pronti per le sessioni di fix post-audit

> Copiare e incollare in una nuova sessione Claude Code sul repo `pdonnini-pixel/Tenute-Nonno-Bruno` il prompt del pacchetto scelto. Un pacchetto per sessione: tenere gli interventi piccoli e verificabili. Ordine consigliato: A → B → C → D → E (oppure C per primo se si vuole partire con fix a basso rischio).

---

## Prompt base (da premettere a ogni pacchetto)

```
Leggi CLAUDE.md, DA-FARE.md e il report docs/AUDIT-Gestionale-2026-07-19.md.
Lavora SOLO sul pacchetto indicato sotto: per ogni finding del pacchetto, rileggi
prima il codice indicato (file:riga) e la scheda corrispondente nel report,
verifica che il problema sia ancora presente, poi applica il fix più piccolo
possibile a comportamento invariato per tutto il resto dell'app.

Regole vincolanti:
- NON pushare su main: lavora su un branch dedicato (es. fix/audit-pacchetto-X)
  e fermati prima del merge; il deploy in produzione va deciso esplicitamente.
- Un commit per finding (o per gruppo strettamente legato), messaggio in italiano.
- Le aree login/RLS/persistenza/PDF sono a rischio: segnala ogni fix che le tocca.
- Dopo ogni fix descrivi come l'hai verificato (l'app è un singolo index.html:
  aprilo in un browser locale e prova il flusso toccato; niente test automatici).
- A fine sessione aggiorna DA-FARE.md: sposta in "Fatto di recente" ciò che hai
  completato, con riferimento ai numeri dei finding del report.
- Se un fix si rivela più invasivo del previsto, NON forzarlo: annotalo in
  DA-FARE.md come punto aperto e passa al finding successivo.
```

---

## Pacchetto A — Persistenza dati (4 finding CRITICI)

```
PACCHETTO A — Persistenza dati. Finding critici n. 1, 2, 3, 4 del report
docs/AUDIT-Gestionale-2026-07-19.md:

1. index.html ~18611 — il catch del caricamento iniziale fa setDati(D0) in
   silenzio: sostituirlo con una schermata di errore bloccante in italiano che
   impedisce qualunque salvataggio finché i dati reali non sono caricati,
   distinguendo il caso legittimo "primo avvio, nessun dato" (r === null).
2. index.html ~18649 e ~709 — upsert last-write-wins dell'intero stato:
   aggiungere un controllo di concorrenza (campo versione/updatedAt nel blob,
   verifica prima della scrittura, avviso e ricarica in caso di conflitto).
3. index.html ~716 — storage.set silenzia il fallimento della scrittura su
   Supabase: far emergere l'errore all'utente (toast/banner persistente
   "modifiche NON salvate sul server") e ritentare.
4. index.html ~696 — storage.get usa la cache localStorage stantia quando
   Supabase non risponde al boot: segnalare chiaramente che si sta lavorando su
   una copia locale potenzialmente vecchia e bloccare (o far confermare) il
   primo salvataggio che sovrascriverebbe il server.

ATTENZIONE: è il cuore della persistenza multi-utente (5+ utenti attivi).
Procedi un finding alla volta, e prima di chiudere descrivi un piano di test
end-to-end multi-dispositivo da eseguire prima di qualunque merge su main.
```

---

## Pacchetto B — Integrità magazzino

```
PACCHETTO B — Integrità magazzino. Finding del report
docs/AUDIT-Gestionale-2026-07-19.md (sezione critica n. 5 + relativi "alti"):

1. index.html ~2596 (CRITICO) — il clamp Math.max(0,…) sugli scarichi unito al
   riaccredito pieno di annullo/resa crea stock fantasma: rendere simmetrici
   scarico e riaccredito (riaccreditare solo quanto effettivamente scaricato)
   o bloccare lo scarico oltre la disponibilità invece di clampare.
2. index.html ~13189 — saveMov non valida la disponibilità per i movimenti di
   uscita: aggiungere il controllo con messaggio chiaro in italiano.
3. index.html ~2844 — riaprire un ordine annullato non rigenera lo scarico di
   magazzino: ripristinare la coerenza documento↔movimento.
4. index.html ~11056 — la rimozione firma (rollback a "Da firmare") non
   ripristina la giacenza: allineare al comportamento dell'annullo.
5. index.html ~13208 — i movimenti retrodatati usano timestamp=Date.now()
   ignorando la data inserita: usare la data del movimento per ordinamenti e
   calcoli, mantenendo il timestamp di inserimento solo come metadato.

Per ogni fix: prova manuale nel browser del flusso carico → scarico → annullo →
verifica giacenze, e descrivi il risultato.
```

---

## Pacchetto C — Coerenza numeri (report e margini) — basso rischio

```
PACCHETTO C — Coerenza numeri tra Dashboard, Report e CostiMargini. Finding
"alti/medi" del report docs/AUDIT-Gestionale-2026-07-19.md. La Dashboard esclude
già gli ordini annullati (riga ~6136): allineare tutti gli altri punti allo
stesso criterio.

1. index.html ~21639 — ReportPeriodo include gli ordini annullati in fatturato,
   conteggi e tabella per canale (e in "clienti attivi", ~21636).
2. index.html ~16819 — CostiMargini "Per Ordine" include gli annullati in
   ricavi/costi/margini (anche nell'export Excel, ~17902).
3. index.html ~4712 — P&L di campagna: annullati inclusi in ricavi e costi.
4. index.html ~6257 — sottotitolo del KPI "Fatturato Vendite": conteggio ordini
   non allineato all'importo mostrato (include annullati e campioni).
5. index.html ~8529 e ~21242 — contatore "Distribuzione" sempre a 0: la chiave
   giusta è "distributore", non "distribuzione".

Fix piccoli e mirati: nessun refactor. Verifica confrontando a mano gli stessi
numeri su Dashboard, Report Periodo e CostiMargini con un ordine annullato di
prova (in locale, senza toccare i dati di produzione).
```

---

## Pacchetto D — Ruoli e log attività

```
PACCHETTO D — Ruoli e log attività. Finding del report
docs/AUDIT-Gestionale-2026-07-19.md:

1. index.html ~18706 — il routing hash non verifica ROLE_ACCESS: qualunque
   utente apre qualunque modulo digitando #produzione, #costi, #log ecc.
   Filtrare in onHash e setModuloNav sui moduli permessi al ruolo corrente.
2. index.html ~19164-19176 — la prop readonly è passata solo a Magazzino:
   passarla (e gestirla) anche in Produzione, Fornitori e CostiMargini, come
   dichiarato da ROLE_READONLY.
3. index.html ~18676-18693 — il log attività "append-only" perde voci: race
   read-modify-write tra utenti, catch vuoto che inghiotte gli errori.
   Minimizzare la finestra di race, non silenziare i fallimenti e segnalare
   in DA-FARE.md il limite architetturale residuo (blob unico).
4. index.html ~18616 — login e logout non vengono registrati nel Report
   Attività: aggiungerli (il log è il requisito di tracciabilità multi-utente,
   vedi DA-FARE.md punto sui nuovi utenti).

NOTA: il problema "auth lato client con password nel bundle" è GIÀ tracciato in
DA-FARE.md (punto 1) e NON va affrontato qui: qui si sistemano solo i controlli
di ruolo interni alla UI e il log.
```

---

## Pacchetto E — Tracciabilità lotti e FIFO

```
PACCHETTO E — Tracciabilità lotti e rotazione FIFO. Finding del report
docs/AUDIT-Gestionale-2026-07-19.md:

1. index.html ~2767 — lo scarico generato dall'ordine non registra il lotto:
   la catena lotto → prodotto → cliente si interrompe alla vendita. Aggiungere
   la selezione del lotto allo scarico ordine (proposta di default: lotto più
   vecchio/più vicino a scadenza), salvarla nel movimento e mostrarla nel DDT.
2. index.html ~13203 — i carichi manuali (incluso carico_produzione) accettano
   merce senza lotto: rendere il lotto obbligatorio per i tipi di movimento che
   movimentano prodotto finito.
3. index.html ~11199 — annate hardcoded ['2025','2024'] nei form ordine:
   derivarle dai lotti/prodotti reali.
4. Prelievo non guidato: nelle schermate di scarico, ordinare e proporre i
   lotti per scadenza/anzianità (FIFO) invece che lasciare la scelta libera
   senza indicazioni.

Questo pacchetto tocca i flussi quotidiani di carico/scarico: mantieni i campi
nuovi opzionali dove renderli obbligatori romperebbe dati storici esistenti, e
segnala ogni compromesso in DA-FARE.md.
```

---

## Pacchetti F+ — Medi e bassi (dopo A–E)

```
PACCHETTO F — Smaltimento finding medi/bassi. Apri il report
docs/AUDIT-Gestionale-2026-07-19.md, sezione "Severità Media" (58 finding) e
"Severità Bassa" (43 finding). Scegli un blocco omogeneo di ~10 finding della
stessa area (es. tutti quelli su validazione input, o su UX, o sulle guide),
verifica ciascuno nel codice e applica i fix, un commit per finding.
Aggiorna DA-FARE.md a fine sessione indicando i numeri dei finding chiusi.
```

# DA-FARE — Cose in sospeso

> Registro delle attività aperte / decisioni in sospeso per **Tenute Nonno Bruno — Gestionale Pro**.
> Aggiornare a ogni sessione (vedi regola di verifica in `CLAUDE.md`).

Ultimo aggiornamento: 2026-07-19 (Pacchetti A, B e C dell'audit in produzione su decisione esplicita di Patrizio)

---

## 🔴 Aperti — richiedono decisione o test (NON fare "al volo")

### 0. Verifica end-to-end multi-dispositivo del Pacchetto A — ora POST-deploy
- **Cosa:** i 4 fix critici di persistenza (finding #1–#4 del report `docs/AUDIT-Gestionale-2026-07-19.md`) sono verificati in locale con backend simulato. Il **2026-07-19 Patrizio ha deciso la messa in produzione senza le prove multi-dispositivo preliminari**: il piano qui sotto resta valido e va eseguito **appena possibile sull'app in produzione** per confermare il comportamento sull'istanza Supabase reale (in particolare il PATCH condizionale, punto 5).
- **Piano di verifica (2 dispositivi, es. PC + telefono, utenti diversi):**
  1. **Conflitto reale:** A e B aprono l'app; A salva una modifica (es. soglia alert 61); B, SENZA ricaricare, salva un'altra modifica → B deve vedere l'avviso "CONFLITTO DI SALVATAGGIO" e la pagina deve ricaricarsi con la modifica di A intatta; B ripete la sua modifica → entrambe presenti.
  2. **Offline e retry:** A attiva la modalità aereo, fa una modifica → banner rosso "Modifiche NON salvate sul server"; riattiva la rete → entro ~1 min toast "Modifiche sincronizzate" e banner sparito; B ricarica e vede la modifica.
  3. **Cache stantia:** A apre l'app offline (dopo averla già usata su quel dispositivo) → banner arancione "copia locale"; nel frattempo B (online) salva una modifica; A torna online e salva → deve comparire "SALVATAGGIO BLOCCATO" con ricarica, e la modifica di B deve sopravvivere.
  4. **Primo avvio bloccato:** su un dispositivo/browser mai usato (nessuna cache), aprire l'app senza rete → deve comparire la schermata "Impossibile caricare i dati del gestionale" SENZA form di login.
  5. **Compatibilità PostgREST:** verificare nel Network del browser che il PATCH condizionale (`updated_at=eq.…`) aggiorni davvero la riga (200 con 1 riga) — il confronto sul timestamp usa il formato restituito dal server, da confermare sull'istanza reale.
  6. **Regressione flussi a rischio:** login/logout, generazione di un PDF ordine, upload/rimozione firma (bucket `tnb-firme`), import/export backup da Impostazioni.
- **Stato:** deploy in produzione eseguito il 2026-07-19 su decisione esplicita di Patrizio; verifiche post-deploy da eseguire. Se qualcosa non torna: rollback = ripristinare su `main` il commit `8c9c70a` (stato pre-Pacchetto A) o usare il rollback deploy di Netlify.

### 1. Autenticazione: password in chiaro + auth lato client — CRITICO
- **Dove:** `index.html` — array `USERS` (~riga 19519) e verifica in `handleLogin` (~riga 19589).
- **Problema:** username/password (`superadmin/tnb2026!`, `admin/azienda2026`, `irene/irene2026`) sono nel bundle e la verifica avviene nel browser → chiunque apra il sorgente legge le credenziali e può bypassare il login. Il codice stesso lo ammette (~riga 19859).
- **Fix corretto:** spostare la verifica lato server (Supabase Auth, oppure una Netlify Function). **Cambia l'architettura del login → non toccare senza test end-to-end.**
- **Stato:** deciso di NON toccare finché non pianificato insieme.

### 2. RLS Supabase da verificare — SICUREZZA
- **Dove:** `index.html:677` (`SUPA_KEY`, anon key JWT, scadenza 2090) + bucket `tnb-firme`.
- **Problema:** la anon key è pubblica per natura; tutta la sicurezza dei dati (firme, ticket, ordini, PDF, marketing) dipende **solo** dalle policy RLS su Supabase.
- **Da fare:** verificare che RLS sia attivo e restrittivo su ogni bucket/tabella. Serve accesso Supabase (connettore MCP da autorizzare in sessione interattiva).
- **Stato:** in attesa di accesso/verifica.

---

## 🟡 Opzionali / pulizia

### 3b. Limiti residui noti del magazzino (post-Pacchetto B, non bloccanti)
- **Storici con clamp su movimenti "terzi" (audit B#5):** il riaccredito di annullo/resa è ora limitato allo scaricato effettivo *di quell'ordine*, e il nuovo controllo in saveMov (B#17) impedisce di creare nuovi scarichi oltre disponibilità. Resta però il caso storico in cui il clamp aveva assorbito un movimento di un ALTRO ordine/scarico manuale: quei pezzi fantasma già presenti nei dati non si correggono da soli → sanabili con un inventario fisico + rettifiche manuali (il bottone "🔄 Ricalcola" evidenzia le discrepanze in console).
- **Riapertura di ordini storici senza scarichi a log:** un ordine vecchio (pre-tracciamento) annullato e poi riaperto genera ora lo scarico coerente con il documento, ma l'annullo precedente non aveva accreditato nulla → il netto magazzino scende. Era già così per la riapertura a "Firmato"; ora vale anche per "Consegnato/Fatturato". Dopo riaperture di ordini storici, controllare la giacenza.
- **Finding magazzino correlati NON in questo pacchetto** (restano aperti nel report): #16 affido_spedizioniere doppio decremento riservato+confezionamento, #18 apertura non-lineare in saveSku, #57 migrazione v49 ordine inverso stesso giorno, #58 verificaDisponibilitaOrdine legge la giacenza memorizzata anziché il ricalcolo.

### 4. Limiti residui noti della persistenza (post-Pacchetto A, non bloccanti)
- **Log attività su blob unico (`tnb-log`):** con il controllo di concorrenza un conflitto in scrittura ora NON sovrascrive più le voci degli altri utenti, ma la voce in conflitto viene scartata (con warning in console). La finestra di race read-modify-write resta: è il finding del **Pacchetto D** (voce #3) del report audit.
- **Primo inserimento di una chiave assente:** usa ancora il POST upsert (nessuna riga da confrontare); una race tra due "primi salvataggi" simultanei resta teoricamente possibile solo al primissimo avvio su DB vuoto.
- **Import backup / reset go-live annullati per errore server:** la copia in `localStorage` resta comunque aggiornata al valore che si tentava di scrivere (comportamento pre-esistente); al riavvio online il server fa fede, e da offline scatta la verifica "cache stantia".

### 3. Env var `ANTHROPIC_MODEL` su Netlify (opzionale)
- La function `netlify/functions/report-ai.mjs` legge il modello da `process.env.ANTHROPIC_MODEL` con fallback `claude-sonnet-4-6`.
- Impostare la variabile su Netlify **solo** se si vuole cambiare modello, senza ridistribuire codice.

---

## ✅ Fatto di recente
- **2026-07-19 — Pacchetto C audit (coerenza numeri Dashboard/Report/CostiMargini): finding #6, #24, #46, #47, #104 del report `docs/AUDIT-Gestionale-2026-07-19.md` corretti e portati IN PRODUZIONE** (merge su `main` deciso esplicitamente da Patrizio). Criterio unico: gli ordini annullati sono esclusi ovunque, come già faceva la Dashboard. NB: i numeri di Report Periodo/P&L/CostiMargini possono risultare più BASSI di prima — non è un calo di fatturato, è la fine del doppio conteggio degli annullati:
  - **#6** — Report Periodo: fatturato, conteggio ordini, tabella per canale e "clienti attivi" escludono gli annullati.
  - **#46** — CostiMargini "Per Ordine": annullati esclusi da tabella, totali ed export Excel (un solo filtro nel memo condiviso).
  - **#24** — P&L di campagna e margini per cliente/canale: annullati esclusi da ricavi, costi variabili, margini e confronti YoY.
  - **#104** — sottotitolo del KPI "Fatturato Vendite": il conteggio ordini ora segue lo stesso criterio dell'importo (esclusi annullati e campioni).
  - **#47** — contatore "Distribuzione" nei riepiloghi Clienti/ClientiCommerciale: chiave corretta `distributore` (mostrava sempre 0). NON toccato il tipo `distribuzione` dei contratti fornitori (dominio diverso). Restano aperti gli aspetti correlati segnalati dal report: `calcolaMargineCanale` non riconosce il canale `distributore` (i distributori finiscono in "Altro" nei margini per canale) e il badge tipo cliente senza label.
  - **Verifica:** browser Chromium con backend simulato e ordine annullato di prova (1004/2026, 140 € netti): prima/dopo l'annullo Dashboard −140, Report Periodo −140 (e coincide con la Dashboard al centesimo), P&L campagna −140, "Per Ordine" senza più l'ordine ed export/totali ridotti, conteggio KPI −1, contatore Distribuzione = numero reale di distributori.
- **2026-07-19 — Pacchetto B audit (integrità magazzino): finding #5 (critico), #15, #17, #19, #56 del report `docs/AUDIT-Gestionale-2026-07-19.md` corretti e portati IN PRODUZIONE** (merge su `main` deciso esplicitamente da Patrizio; consigliata una prova su un ordine reale: firma → annullo → riapertura → controllo giacenze):
  - **#5** — scarico/riaccredito simmetrici nel replay: annullo_ordine e resa_cv riaccreditano al massimo quanto EFFETTIVAMENTE scaricato per quell'ordine (scarichi clampati e annulli doppi non fabbricano più pezzi). Invariato per movimenti manuali senza ordine e ordini senza scarichi a log. Limite residuo documentato al punto 3b.
  - **#17** — saveMov blocca i movimenti in uscita oltre la giacenza dello stato di origine (scarichi/riserve da disponibile, consegnato da in spedizione, affido da riservato+confezionamento) con messaggio chiaro in italiano.
  - **#15** — guard di idempotenza sul NETTO scarichi−annulli: riaprire un ordine annullato rigenera lo scarico (righe correnti, previo check disponibilità) e il secondo annullo compensa esattamente il residuo.
  - **#19** — rimozione firma → "Da firmare": al salvataggio la giacenza viene ripristinata (annullo_ordine con nota "ripristino magazzino"), come promesso dalla Guida; il check disponibilità considera restituibili le quantità dell'ordine stesso (niente falso "stock insufficiente"); alla ri-firma gli scarichi si rigenerano con le righe aggiornate.
  - **#56** — movimenti retrodatati: il timestamp deriva dalla data dichiarata (mezzogiorno + progressivo), così replay e "giacenza al" rispettano la cronologia; l'orario reale resta nel nuovo campo `inseritoTs`.
  - **Verifica:** 17 controlli unitari sulle funzioni reali (ricalcolaGiacenza, applicaTransizioneOrdineMagazzino, timestampPerData) eseguiti nel browser + flusso UI completo in Chromium con backend simulato (mai il DB reale): ricalcolo → rettifica +10 → scarico oltre soglia BLOCCATO → scarico retrodatato con data corretta → annullo ordine (nessun riaccredito fantasma su ordine legacy) → riapertura con scarico rigenerato e giacenze verificate sullo stato persistito.
- **2026-07-19 — Pacchetto A audit (persistenza dati): finding critici #1–#4 del report `docs/AUDIT-Gestionale-2026-07-19.md` corretti e portati IN PRODUZIONE** (merge su `main` deciso esplicitamente da Patrizio; ⚠️ area a rischio persistenza — verifiche post-deploy nel punto aperto #0):
  - **#1** — errore al caricamento iniziale: niente più `setDati(D0)` silenzioso; schermata bloccante in italiano (casi "rete" e "dati illeggibili" distinti dal legittimo primo avvio `r === null`), nessun salvataggio possibile finché i dati reali non sono caricati.
  - **#2** — controllo di concorrenza: le scritture su `app_kv` sono condizionali (PATCH filtrato su `key` + `updated_at` letto in precedenza, riuso della colonna esistente, nessuna migrazione schema) e serializzate per chiave; in caso di conflitto avviso in italiano e ricarica automatica, la modifica altrui sopravvive.
  - **#3** — fallimento di scrittura non più silenzioso: banner rosso persistente "Modifiche NON salvate sul server", retry automatico con backoff (5s→60s) e toast alla risincronizzazione; import backup e reset go-live ora si ANNULLANO con messaggio chiaro se la scrittura remota fallisce (prima mostravano successo anche offline); rimosso il banner morto `window._supaOk`.
  - **#4** — boot da cache locale: banner arancione "copia locale, potrebbero NON essere aggiornati" e verifica del server prima della prima scrittura (blocco con avviso se il server ha dati più recenti); versione server della cache tracciata in `tnb__meta__*`.
  - **Verifica:** 27 controlli automatici in Chromium (Playwright) con backend Supabase **simulato** via intercettazione richieste (mai toccato il DB reale): boot ok/primo avvio/offline/corrotto/cache, PATCH condizionale con avanzamento versione, conflitto da UI con alert+reload, banner offline con retry riuscito. Il report audit e i prompt delle sessioni di fix sono ora in `docs/`.
- **2026-07-09** — nuovi utenti **Elisa Travelli** (`elisa`/`elisa2026`) e **Lucia** (`lucia`/`lucia2026`), entrambi ruolo `admin`, aggiunti all'array `USERS` (`index.html` ~19574) per copertura assenza Irene (~6 settimane). ⚠️ Credenziali in chiaro nel bundle: cambiare password dopo il primo accesso e vedi punto critico #1 (auth lato server). In attesa di merge su `main` per andare online.
  - **Tracciabilità multi-utente:** confermato che il **Report Attività** (`tnb-log`, modulo `log`) registra ogni azione con `userId/userName/userRole` + timestamp + diff campo-per-campo sulle modifiche. È **append-only e non cancellabile** (nemmeno dal superadmin). Filtrabile per utente/modulo/mese/tipo. Attribuzione corretta SOLO se ognuno usa il proprio login (non condividere credenziali). NB: il ruolo `admin` vede anche il log.
  - **Email conferme ordine (NESSUNA modifica codice necessaria):** Elisa chiede che il mittente sia `info@tenutenonnobruno.it` invece di `elisa.travelli@travellisrl.com`. Il codice NON imposta il mittente: apre solo la composizione Gmail (`view=cm`, 7 punti) usando l'account Google del browser e il suo indirizzo "Da" predefinito. `info@` è su **Aruba** (non Google) → soluzione: dentro il Gmail usato, aggiungere `info@` come **"Invia messaggi come"** (SMTP Aruba: `smtps.aruba.it:465` SSL, user = indirizzo completo, pwd della casella), verificarlo, e impostarlo **predefinito**. Da lì le conferme partono da `info@` senza toccare il codice. In attesa che Patrizio/Elisa completino la config in Gmail.
- **2026-07-07** — deduplicazione anagrafica per PDF: `_TNB_ANAG_FALLBACK` (`index.html` ~9395) ora **deriva** da `AZIENDA_DEFAULTS` (unica fonte) con le trasformazioni di formato attese (P.IVA senza `IT`, sede legale composta, web con `www.`). Verificato campo per campo: **output identico** ai valori hardcoded precedenti → nessun cambiamento nei documenti.
- **2026-07-07 (commit `1504a29`)** — rimozione hardcode sicuri (nessun cambio di comportamento), poi merge su `main` e deploy in produzione:
  - `report-ai` fetch su path **relativo** `/.netlify/functions/report-ai` (prima URL Netlify assoluto).
  - Modello AI da env var `ANTHROPIC_MODEL` (fallback invariato).
  - IBAN da **fonte unica** `AZIENDA_DEFAULTS.iban` (`getTnbIban`/`TNB_IBAN`).
  - Nome bucket Supabase in costante **`SUPA_BUCKET`**.

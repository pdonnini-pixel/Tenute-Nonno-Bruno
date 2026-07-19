# DA-FARE — Cose in sospeso

> Registro delle attività aperte / decisioni in sospeso per **Tenute Nonno Bruno — Gestionale Pro**.
> Aggiornare a ogni sessione (vedi regola di verifica in `CLAUDE.md`).

Ultimo aggiornamento: 2026-07-19 (audit completo del gestionale — vedi `docs/AUDIT-Gestionale-2026-07-19.md`)

---

## 🔴 Aperti — richiedono decisione o test (NON fare "al volo")

### 0. Esiti audit 2026-07-19: 5 finding CRITICI su persistenza dati e magazzino
- **Dove:** report completo in `docs/AUDIT-Gestionale-2026-07-19.md` (145 finding confermati: 5 critici, 39 alti, 58 medi, 43 bassi; ogni finding verificato da un revisore avversariale indipendente).
- **I 5 critici, tutti da pianificare con test end-to-end (toccano persistenza/Supabase):**
  1. Catch del caricamento iniziale → `setDati(D0)` silenzioso: al primo salvataggio può **sovrascrivere l'intero DB di produzione** con dati vuoti/demo (`index.html` ~18611).
  2. Salvataggio intero stato con upsert **last-write-wins**: nessun controllo di concorrenza tra i 5+ utenti attivi (`index.html` ~18649/709).
  3. `storage.set`: scrittura Supabase fallita **silenziata** — l'app finge il salvataggio riuscito (`index.html` ~716).
  4. `storage.get`: al boot fallback su cache localStorage **stantia** → il primo salvataggio riporta indietro i dati di tutti (`index.html` ~696).
  5. Magazzino: clamp `Math.max(0,…)` sugli scarichi + riaccredito pieno di annullo/resa → **stock fantasma** (`index.html` ~2596).
- **Stato:** solo analisi fatta, nessuna modifica al codice. Decidere priorità e piano di fix insieme (aree a rischio: login/persistenza/magazzino).

### 0-bis. Piano di lavoro post-audit — pacchetti in ordine di priorità
> Ogni pacchetto è pensato per essere affidato a una sessione di lavoro dedicata (prompt pronto in `docs/PROMPT-SESSIONE-FIX.md`). Dettaglio completo di ogni finding nel report `docs/AUDIT-Gestionale-2026-07-19.md`.

- **Pacchetto A — Persistenza dati (i 4 critici, PRIMA DI TUTTO):** schermata di errore bloccante al posto del reset silenzioso a D0 (~18611); controllo di concorrenza sull'upsert Supabase (versione/timestamp, niente last-write-wins ~18649/709); avviso visibile quando la scrittura Supabase fallisce (~716); niente avvio da cache localStorage stantia senza conferma (~696). ⚠️ Tocca il cuore della persistenza: serve test end-to-end multi-dispositivo prima del merge.
- **Pacchetto B — Integrità magazzino:** stock fantasma da clamp `Math.max(0,…)` + riaccredito pieno di annullo/resa (~2596, critico); `saveMov` senza controllo disponibilità in uscita (~13189); riapertura ordine annullato non rigenera lo scarico (~2844); rollback firma "Da firmare" non ripristina la giacenza (~11056); movimenti retrodatati con `timestamp=Date.now()` (~13208).
- **Pacchetto C — Coerenza numeri (report/margini):** ordini annullati inclusi in ReportPeriodo (~21639), in CostiMargini "Per Ordine" (~16819) e nel P&L di campagna (~4712); sottotitolo KPI Dashboard (~6257); contatore "Distribuzione" sempre a 0 (~8529). Fix piccoli e a basso rischio: buon primo pacchetto se si vuole partire morbidi.
- **Pacchetto D — Ruoli e log attività:** routing hash senza controllo `ROLE_ACCESS` + prop `readonly` non passata a Produzione/Fornitori/CostiMargini (~18706); log attività non realmente append-only (race read-modify-write, catch vuoto, ~18676-18693); login/logout non registrati nel log (~18616).
- **Pacchetto E — Tracciabilità lotti e FIFO:** lo scarico ordine non registra il lotto → catena lotto→cliente interrotta (~2767); carichi manuali senza lotto obbligatorio (~13203); annate hardcoded nei form ordine (~11199); prelievo non guidato FIFO/scadenza.
- **Pacchetti F+ — Medi e bassi:** 58 medi + 43 bassi nel report (UX, validazioni, guide, pulizia codice): da smaltire a lotti dopo A–E.

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

### 3. Env var `ANTHROPIC_MODEL` su Netlify (opzionale)
- La function `netlify/functions/report-ai.mjs` legge il modello da `process.env.ANTHROPIC_MODEL` con fallback `claude-sonnet-4-6`.
- Impostare la variabile su Netlify **solo** se si vuole cambiare modello, senza ridistribuire codice.

---

## ✅ Fatto di recente
- **2026-07-09** — nuovi utenti **Elisa Travelli** (`elisa`/`elisa2026`) e **Lucia** (`lucia`/`lucia2026`), entrambi ruolo `admin`, aggiunti all'array `USERS` (`index.html` ~19574) per copertura assenza Irene (~6 settimane). ⚠️ Credenziali in chiaro nel bundle: cambiare password dopo il primo accesso e vedi punto critico #1 (auth lato server). In attesa di merge su `main` per andare online.
  - **Tracciabilità multi-utente:** confermato che il **Report Attività** (`tnb-log`, modulo `log`) registra ogni azione con `userId/userName/userRole` + timestamp + diff campo-per-campo sulle modifiche. È **append-only e non cancellabile** (nemmeno dal superadmin). Filtrabile per utente/modulo/mese/tipo. Attribuzione corretta SOLO se ognuno usa il proprio login (non condividere credenziali). NB: il ruolo `admin` vede anche il log.
  - **Email conferme ordine (NESSUNA modifica codice necessaria):** Elisa chiede che il mittente sia `info@tenutenonnobruno.it` invece di `elisa.travelli@travellisrl.com`. Il codice NON imposta il mittente: apre solo la composizione Gmail (`view=cm`, 7 punti) usando l'account Google del browser e il suo indirizzo "Da" predefinito. `info@` è su **Aruba** (non Google) → soluzione: dentro il Gmail usato, aggiungere `info@` come **"Invia messaggi come"** (SMTP Aruba: `smtps.aruba.it:465` SSL, user = indirizzo completo, pwd della casella), verificarlo, e impostarlo **predefinito**. Da lì le conferme partono da `info@` senza toccare il codice. In attesa che Patrizio/Elisa completino la config in Gmail.
- **2026-07-07** — deduplicazione anagrafica per PDF: `_TNB_ANAG_FALLBACK` (`index.html` ~9395) ora **deriva** da `AZIENDA_DEFAULTS` (unica fonte) con le trasformazioni di formato attese (P.IVA senza `IT`, sede legale composta, web con `www.`). Verificato campo per campo: **output identico** ai valori hardcoded precedenti → nessun cambiamento nei documenti.
- **2026-07-07 (commit `1504a29`)** — rimozione hardcode sicuri (nessun cambio di comportamento), poi merge su `main` e deploy in produzione:
  - `report-ai` fetch su path **relativo** `/.netlify/functions/report-ai` (prima URL Netlify assoluto).
  - Modello AI da env var `ANTHROPIC_MODEL` (fallback invariato).
  - IBAN da **fonte unica** `AZIENDA_DEFAULTS.iban` (`getTnbIban`/`TNB_IBAN`).
  - Nome bucket Supabase in costante **`SUPA_BUCKET`**.

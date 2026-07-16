# DA-FARE — Cose in sospeso

> Registro delle attività aperte / decisioni in sospeso per **Tenute Nonno Bruno — Gestionale Pro**.
> Aggiornare a ogni sessione (vedi regola di verifica in `CLAUDE.md`).

Ultimo aggiornamento: 2026-07-16 (analisi ordine Shopify #1011 + scoperta schema relazionale abbandonato)

---

## 🔴 Aperti — richiedono decisione o test (NON fare "al volo")

### 0. Schema Supabase relazionale ABBANDONATO ≠ dati live — ATTENZIONE
- **Cosa:** sul progetto Supabase `njwtfmiviijszzxschll` esistono tabelle relazionali popolate (`clienti`, `clienti_privati`, `prodotti`, `ordini`, `ordini_righe`, `magazzino_sku`, …) con `created_at`/`updated_at` **tutti fermi al 2026-04-02**: sono una **migrazione/esperimento una-tantum, non più aggiornata**.
- **I dati veri dell'app** stanno **solo** nel blob KV `app_kv['tnb-pro-v2']` (unico JSON con `clienti`/`ordini`/`listino`/…), aggiornato di continuo (ultimo 2026-07-10). L'`index.html` in repo legge/scrive **solo** quel blob.
- **Conseguenza pratica:** inserire clienti/ordini nelle tabelle relazionali è **inutile** (l'app non le legge). Ogni inserimento va fatto **dall'interfaccia del gestionale** (che aggiorna il blob) o, con estrema cautela, patchando il blob.
- **Decisione aperta:** valutare se (a) completare la migrazione al modello relazionale (richiede nuovo frontend) oppure (b) cancellare le tabelle relazionali per evitare confusione. Per ora **non toccarle**.

### 0-bis. Ordine e-commerce Shopify #1011 (francesco grimaldi) da censire a mano
- **Contesto:** Shopify **non è integrato** nel gestionale (nessun import). Ogni ordine dal sito va inserito a mano: prima il cliente in **Clienti**, poi l'ordine collegato.
- **Ordine #1011 del 14/07/2026, spedito il 16/07/2026.** Dati pronti (mappati sui campi dell'app):
  - **Cliente (privato):** Ragione sociale `Francesco Grimaldi` · tipo `altro` · indirizzo `Via Gaetano Donizetti 7` · CAP `00198` · città `Roma` · prov. `RM` · tel `+39 347 4417180` · **email: MANCANTE nella mail ricevuta** (chiedere a Elisa/recuperare da Shopify per le conferme).
  - **Ordine:** 1 × Olio Fata Morgana **500 ml** annata **2025** a **€28,00** (prezzo pubblico a listino) · spedizione standard **€9,90** (Roma = fuori provincia) · pagamento **Shopify Payments → pagato** · nel campo note: "Shopify #1011 del 14/07/2026". Numero interno assegnato in automatico (prossimo ~`1021/2026`).
- **Stato:** in attesa. Consigliato inserimento da UI (validazioni + numerazione automatiche). NON inserito nelle tabelle relazionali (vedi punto 0).


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

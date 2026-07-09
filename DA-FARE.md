# DA-FARE — Cose in sospeso

> Registro delle attività aperte / decisioni in sospeso per **Tenute Nonno Bruno — Gestionale Pro**.
> Aggiornare a ogni sessione (vedi regola di verifica in `CLAUDE.md`).

Ultimo aggiornamento: 2026-07-09 (specifica ridisegno Magazzino concordata con Patrizio, in attesa conferma cliente)

---

## 🔴 Aperti — richiedono decisione o test (NON fare "al volo")

### 0. Magazzino — ridisegno funzionamento (specifica concordata, ⏳ attesa conferma cliente Lucia)
- **Origine:** richiesta di Irene, mediata da Patrizio. Prima di sviluppare si è concordato **come deve funzionare** (non lo stato attuale). Mail di conferma inviata a Lucia.
- **⚠️ Non iniziare lo sviluppo finché Lucia non conferma i punti sotto.**
- **Contesto codice attuale** (per lo sviluppo): magazzino event-sourced (`ricalcolaGiacenza` `index.html:2535`); regola DDT in `MOV_RICHIEDE_DDT`/`MOV_ENTRATA` (`:1615-1626`); obbligo DDT bloccante in `saveMov` (`:13191`); litri/olio già presenti lato Produzione/Lotti (`qtaOlio`, `litriDisponibiliLotto` `:1657-1659`); movimento tecnico `apertura` esiste ma **non esposto** nel form manuale.

**Specifica (8 punti) — come dovrà funzionare:**
1. **L'olio nasce in Produzione** (regola madre di inserimento): ogni raccolta crea il lotto con i litri. Il magazzino non crea olio, lo eredita dal lotto.
2. **Il magazzino gestisce due unità**: litri (olio sfuso) **e** pezzi (bottiglie). Oggi solo pezzi.
3. **Invio al frantoio = movimento magazzino in litri**: es. 100 L → uscita verso frantoio; al rientro dell'olio molito → movimento di rientro.
4. **Imbottigliamento = i litri diventano bottiglie**: scarico litri dal lotto + carico bottiglie. Passaggio **interno** (già esiste come `carico_produzione`).
5. **Uscite bottiglie tracciate per tipo**: vendita cliente (scarico auto da ordine), omaggio cliente, campione gratuito (già esiste), **omaggio interno azienda**. L'omaggio interno si registra **senza ordine collegato**, con nota/campo "assegnato a" (es. Enrico, Lucia). Omaggi e campioni escono con **DDT interno**.
6. **Regola DDT unica**: su entrate/uscite reali (frantoio, acquisti, vendite) il **numero DDT resta obbligatorio**; il **file cartaceo diventa FACOLTATIVO** (oggi bloccante — modifica in `saveMov`). ⚠️ Era regola voluta dalla proprietà: cambio consapevole.
7. **Passaggi interni SENZA DDT**: imbottigliamento ed etichettatura non devono più richiedere il DDT (oggi `carico_produzione` è in `MOV_RICHIEDE_DDT` — da rivedere).
8. **Pregresso al 31/12/2025 + ricostruzione dal 01/01/2026** (Irene reinserisce movimenti e DDT). Foto di partenza (serve voce **"Apertura/saldo iniziale"** senza DDT nel form):
   - Bottiglie 2024: 865×500ml, 46×5L, 57×3L
   - Bottiglie 2025: 583×250ml, 61×500ml, 125×3L, 99×5L
   - Olio sfuso al frantoio: 173 L
   - Possibile delta col reale → si chiude con una **rettifica** (già supportata).

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
- **2026-07-07** — deduplicazione anagrafica per PDF: `_TNB_ANAG_FALLBACK` (`index.html` ~9395) ora **deriva** da `AZIENDA_DEFAULTS` (unica fonte) con le trasformazioni di formato attese (P.IVA senza `IT`, sede legale composta, web con `www.`). Verificato campo per campo: **output identico** ai valori hardcoded precedenti → nessun cambiamento nei documenti.
- **2026-07-07 (commit `1504a29`)** — rimozione hardcode sicuri (nessun cambio di comportamento), poi merge su `main` e deploy in produzione:
  - `report-ai` fetch su path **relativo** `/.netlify/functions/report-ai` (prima URL Netlify assoluto).
  - Modello AI da env var `ANTHROPIC_MODEL` (fallback invariato).
  - IBAN da **fonte unica** `AZIENDA_DEFAULTS.iban` (`getTnbIban`/`TNB_IBAN`).
  - Nome bucket Supabase in costante **`SUPA_BUCKET`**.

# Piano — Autenticazione lato server e messa in sicurezza dei dati (audit #1 + #2 RLS + #80/#13)

**Tenute Nonno Bruno — Gestionale Pro** · bozza per revisione con Patrizio · 2026-07-19

> Questo è un **piano da rivedere insieme**, non codice già scritto. Nessuna modifica
> verrà applicata finché non è approvato. L'area login/RLS/persistenza è la più
> delicata dell'app: si procede a piccoli passi, con verifica end-to-end e possibilità
> di rollback a ogni passo.

---

## 1. Perché serve (lo stato di oggi)

- **Login solo lato browser.** Utenti e password (`superadmin/tnb2026!`, ecc.) sono
  scritti dentro `index.html` (array `USERS`) e la verifica avviene nel browser.
  Chi apre il codice sorgente della pagina **legge le password** e può entrare.
- **Chiave pubblica = accesso totale ai dati.** L'app parla con Supabase usando la
  "anon key", che è pubblica per natura. La sicurezza dei dati dipende **solo** dalle
  regole RLS sul database.
- **Le regole RLS sono di fatto aperte** (verificato il 2026-07-19 con gli advisor
  Supabase, in sola lettura):
  - tabella `app_kv` (tutti i dati dell'app + registro attività): policy `anon_all`
    con `USING(true) WITH CHECK(true)` → **chiunque abbia la chiave legge e riscrive
    tutto**;
  - bucket `tnb-firme` **pubblico e listabile** → firme, DDT e fatture potenzialmente
    accessibili/elencabili con la sola chiave.

**Conseguenza:** oggi i dati aziendali sono protetti solo dall'oscurità della chiave.
Le mitigazioni già fatte (F14: controllo origine sull'endpoint AI #13, scadenza della
sessione #80) riducono la superficie ma **non** risolvono il nodo: serve un'identità
verificata da un server.

---

## 2. Dove vogliamo arrivare (architettura obiettivo)

Usare **Supabase Auth** (già incluso nel progetto Supabase esistente, nessun nuovo
servizio):

1. Ogni utente reale (Patrizio, Irene, Elisa, Lucia, …) diventa un **account Supabase
   Auth** con email + password (hashate sul server, mai nel bundle).
2. Il login dell'app chiama `supabase.auth.signInWithPassword()` → il server verifica
   e restituisce un **token di sessione firmato** (JWT) con scadenza reale.
3. Il ruolo (superadmin/admin/tester/commerciale) viaggia come **metadato**
   dell'utente Auth (o in una tabellina `profili`), non più in un array nel codice.
4. Il layer di salvataggio (`window.storage`) usa il **token dell'utente autenticato**
   al posto della anon key.
5. Le **policy RLS** vengono strette: solo un utente **autenticato** può leggere/scrivere
   `app_kv`; il bucket `tnb-firme` diventa privato con accesso solo autenticato.

Risultato: niente credenziali nel bundle, sessioni con scadenza/revoca reali, e i dati
non sono più accessibili con la sola chiave pubblica.

---

## 3. Passi (ognuno verificabile e reversibile)

Si lavora su un **branch Supabase di staging** (copia del DB) e su un branch di codice,
così la produzione non viene toccata finché non è tutto verificato.

**Passo 0 — Preparazione (nessun impatto utente)**
- Creare un branch/ambiente Supabase di test.
- Elencare gli utenti reali e i rispettivi ruoli (serve la tua conferma).

**Passo 1 — Account Auth**
- Creare gli utenti in Supabase Auth (email + password iniziale, poi cambio al primo
  accesso). Assegnare il ruolo nei metadati.
- *Ti servirà:* decidere gli indirizzi email/username e le password iniziali.

**Passo 2 — Login dell'app sul server**
- Sostituire la verifica in `handleLogin` con `supabase.auth.signInWithPassword()`.
- Rimuovere le password dall'array `USERS` (restano al massimo nome/ruolo come cache,
  o si leggono dal profilo Auth).
- La "sessione ricordami" (#80) diventa il token Auth con refresh gestito da Supabase.

**Passo 3 — Layer dati con token autenticato**
- `window.storage` usa il token della sessione Auth invece della anon key per
  `app_kv` e per gli upload firma/DDT.
- Mantenere invariati i meccanismi già solidi: PATCH condizionale anti-conflitto (#2),
  banner offline + retry (#3), fallback cache locale (#4), timeout (#54).

**Passo 4 — Stringere le regole (RLS + bucket)**
- Policy `app_kv`: sostituire `anon_all` con policy che richiedono `auth.role() =
  'authenticated'` (lettura/scrittura solo a utenti loggati).
- Bucket `tnb-firme`: da pubblico a **privato**, con accesso via URL firmati (già usati
  nel codice, `getSignedUrl`) solo per utenti autenticati; togliere la policy di
  listing pubblico.
- Hardening minore: fissare `search_path` della funzione `trigger_set_updated_at`.
- ⚠️ **Questo passo va fatto DOPO il Passo 3**, altrimenti l'app (che oggi usa la anon
  key) smetterebbe di salvare all'istante.

**Passo 5 — Verifica end-to-end (staging)**
- Login/logout di ogni ruolo; permessi corretti per ruolo.
- Salvataggio, conflitto tra due dispositivi, offline+retry, boot da cache.
- Upload/lettura firma e DDT (URL firmati).
- Generazione PDF e invio email invariati.

**Passo 6 — Go-live controllato**
- Finestra concordata; comunicare agli utenti che dovranno **ri-accedere** (e che le
  vecchie password nel codice non valgono più).
- Rollback pronto: ripristino del commit precedente + ripristino delle policy RLS
  precedenti sullo snapshot Supabase.

---

## 4. Cosa serve da te (Patrizio)

1. **Elenco utenti definitivi** e ruoli (chi è superadmin/admin/tester/commerciale).
2. **Email e password iniziali** per ogni account (le password non staranno nel codice).
3. Ok a **una breve finestra di go-live** in cui tutti dovranno ri-accedere.
4. Conferma che posso operare sul progetto Supabase `NonnoBruno` (branch di staging
   prima, produzione solo al go-live).

---

## 5. Rischi e come li gestiamo

| Rischio | Mitigazione |
|---|---|
| Stringere RLS prima del token → app non salva più | Ordine dei passi rigido: RLS (Passo 4) SOLO dopo il token (Passo 3), su staging |
| Utenti chiusi fuori al go-live | Account creati e testati prima; comunicazione; rollback pronto |
| Regressioni su conflitto/offline/PDF | Si riusa la verifica del Pacchetto A + test end-to-end del Passo 5 |
| Perdita accessi firme/DDT (bucket privato) | Gli URL firmati sono già nel codice (`getSignedUrl`): si testano nel Passo 5 |

---

## 6. Stima

- Sviluppo + verifica su staging: **lavoro su più sessioni** (non una singola).
- Go-live: **una finestra breve** concordata, con rollback pronto.
- Nessun costo aggiuntivo di servizi: Supabase Auth è già incluso nel progetto.

---

## 7. Alternativa più leggera (se non vuoi Supabase Auth adesso)

Se preferisci non toccare l'architettura ora, la via minima è: **rigenerare la anon
key** e **stringere comunque le policy RLS** legandole a un segreto condiviso passato
in header dalla Netlify Function — ma è un palliativo (il segreto finirebbe comunque
lato client o richiederebbe un proxy server per ogni lettura/scrittura) e non dà
identità per-utente. **Consigliata la via Supabase Auth** del §2-3.

---

*Prossimo passo: rivediamo insieme §4 (utenti, email, finestra). Appena confermi, parto
dal Passo 0 su staging — la produzione non viene toccata finché non è tutto verificato.*

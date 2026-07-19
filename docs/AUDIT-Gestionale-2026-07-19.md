# Audit completo del Gestionale Pro — Tenute Nonno Bruno

**Data:** 19 luglio 2026 · **Ambito:** solo analisi (nessuna modifica al codice, nessuna operazione sul database di produzione)

## Metodologia

16 auditor specializzati hanno analizzato in parallelo il codice del gestionale (`index.html`, ~26.200 righe; `netlify/functions/report-ai.mjs`; `docs/Guida-DDT-Magazzino.md`), uno per area: UI, hooks/stato, backend, integrità magazzino, tracciabilità lotti, costificazione, scadenze/rotazione, anagrafica prodotti, documenti/flussi, validazione input, autenticazione/permessi, performance, gestione errori, usabilità, guide, coerenza del codice.

Ogni finding è poi passato da un **verificatore avversariale indipendente** che ha riletto il codice con l'obiettivo di smontarlo (falsi positivi, mitigazioni già presenti, edge case irrilevanti). **Solo i finding confermati sono in questo report.** In totale: 185 agenti, 169 finding grezzi, 5 scartati dalla verifica, 164 confermati, unificati in **145 finding unici** (i doppioni segnalati da più auditor sono stati fusi — la convergenza indipendente è indicata in ogni scheda).

## Sintesi numerica

| Severità | Finding confermati |
|---|---|
| 🔴 Critica | 5 |
| 🟠 Alta | 39 |
| 🟡 Media | 58 |
| 🟢 Bassa | 43 |
| **Totale** | **145** |

**Legenda severità** — Critica: perdita/corruzione dati o calcoli con impatto economico; Alta: malfunzionamento reale nei flussi quotidiani; Media: problema reale con workaround o impatto limitato; Bassa: pulizia/qualità.

> **Nota:** i problemi già tracciati in `DA-FARE.md` (password in chiaro nel bundle + autenticazione lato client; verifica RLS Supabase) restano aperti e NON sono ripetuti qui come finding, salvo aspetti nuovi emersi dall'audit.

---

## Severità 🔴 Critica (5 finding)

### 1. Errore nel caricamento dati iniziale: reset silenzioso al dataset vuoto D0 con rischio di sovrascrittura totale

- **Dove:** `index.html:18611`
- **Area:** Gestione errori e stati vuoti · Hooks e logica di stato

Nel bootstrap dell'App il catch (righe 18611-18613) intercetta qualunque errore (JSON.parse del valore corrotto, eccezione in una delle 17 migration concatenate a riga 18589, storage.get null perché Supabase e cache locale non rispondono su un nuovo dispositivo) e fa setDati(D0) senza alcun messaggio: l'utente vede il gestionale vuoto come se fosse nuovo. Alla prima azione qualsiasi, setDatiSave scrive il dataset vuoto sulla chiave 'tnb-pro-v2' di Supabase, sovrascrivendo tutti i dati aziendali reali. Perdita dati totale possibile senza che appaia mai un errore.

**Fix proposto:** Distinguere 'nessun dato salvato' (r === null legittimo alla prima esecuzione) da 'errore di caricamento': nel catch mostrare una schermata di errore bloccante in italiano che impedisce qualunque salvataggio, logga il dettaglio e propone di ricaricare o esportare/ripristinare un backup, invece di partire con D0 scrivibile.

*Nota verifica: segnalato indipendentemente da 2 auditor.*

*Aspetto aggiuntivo («Catch del load iniziale sostituisce lo stato con i dati demo D0: rischio sovrascrittura dell'intero DB», `index.html:18612`):* Nell'effetto di mount di App, qualsiasi eccezione nel percorso di caricamento (JSON.parse del blob, una delle 18 migration concatenate a riga 18589, o r=null su nuovo dispositivo con Supabase momentaneamente irraggiungibile) finisce nel catch che esegue setDati(D0), dove D0 (riga 2899) contiene dati seed/demo. L'app parte 'funzionante' senza alcun avviso; al primo salvataggio dell'utente, setDatiSave POSTa su Supabase (chiave tnb-pro-v2) lo stato derivato da D0, sovrascrivendo TUTTI i dati di produzione (clienti, ordini, magazzino, lotti) con i dati demo.

*Fix:* Distinguere 'nessun dato esistente' (r=null da get riuscita) da 'errore di caricamento': nel catch non inizializzare D0 ma mostrare una schermata di errore che blocca l'app (nessun setDati, quindi nessun salvataggio possibile) invitando a ricaricare; inizializzare D0 solo quando la lettura remota è andata a buon fine e la chiave non esiste davvero.

### 2. Salvataggio dell'intero stato con upsert last-write-wins: nessun controllo di concorrenza multi-utente

- **Dove:** `index.html:709`
- **Area:** Backend / edge functions

Ogni salvataggio (setDatiSave, riga 18654) serializza TUTTO lo stato applicativo (clienti, ordini, magazzino, produzione...) e lo scrive nell'unica riga 'tnb-pro-v2' di app_kv con POST + 'Prefer: resolution=merge-duplicates' (riga 709), senza alcun controllo di versione (niente If-Match/ETag, niente campo revision confrontato). Con 5 utenti attivi (superadmin, admin, irene, elisa, lucia): l'utente A carica lo stato alle 9:00, l'utente B salva un ordine alle 9:05, l'utente A salva una modifica a un cliente alle 9:10 → l'intero stato di A (che non contiene l'ordine di B) sovrascrive la riga e l'ordine di B sparisce silenziosamente. Lo stesso avviene anche in singolo utente con due POST in volo che arrivano fuori ordine (nessuna coda/serializzazione delle set).

**Fix proposto:** Aggiungere un campo di versione/revisione nello stato e rifiutare la scrittura se la versione sul server è più recente: es. colonna 'rev' in app_kv, PATCH condizionale con filtro '?key=eq.tnb-pro-v2&rev=eq.N' e verifica che la risposta abbia aggiornato 1 riga (Prefer: return=representation); in caso di conflitto ricaricare lo stato dal server e riapplicare la modifica. Inoltre serializzare le storage.set in una coda per evitare riordino delle richieste in volo.

### 3. storage.set: fallimento della scrittura su Supabase silenziato — l'app finge il salvataggio riuscito

- **Dove:** `index.html:716`
- **Area:** Backend / edge functions · Gestione errori e stati vuoti

Se il POST verso Supabase fallisce (rete, 4xx/5xx, RLS), il catch di window.storage.set (righe 716-722) scrive solo in localStorage e restituisce {key, value}, cioè un valore identico al successo. Il chiamante setDatiSave (riga 18654) usa solo .finally() e non distingue mai l'esito: nessun toast, nessun banner offline. Risultato concreto: l'operatore inserisce ordini/consegne credendoli salvati, ma esistono solo nel browser di quel PC; gli altri utenti non li vedono e al primo salvataggio da un altro dispositivo (o dopo che la connessione torna e un altro client scrive) i dati locali non sincronizzati vengono persi definitivamente.

**Fix proposto:** Far distinguere l'esito: storage.set deve restituire un flag (es. {ok:false, offline:true}) o rilanciare l'errore; setDatiSave deve mostrare un avviso persistente ('⚠ Salvataggio non sincronizzato — dati solo su questo dispositivo') e ritentare la scrittura con backoff quando la rete torna, finché la riga remota non è aggiornata.

*Nota verifica: segnalato indipendentemente da 2 auditor.*

*Aspetto aggiuntivo («Salvataggio su Supabase fallisce in silenzio: fallback a localStorage senza alcun avviso», `index.html:716`):* window.storage.set (righe 704-723) in caso di errore Supabase (rete, RLS, 4xx/5xx) salva solo in localStorage e restituisce lo stesso oggetto di successo {key, value}: non lancia mai eccezioni e il chiamante non può distinguere un salvataggio remoto da uno solo locale. setDatiSave (riga 18654) usa solo .finally(), quindi ogni modifica a clienti/ordini/magazzino può restare confinata nel browser di un utente senza che nessuno lo sappia. Con 4-5 utenti attivi su dispositivi diversi questo produce dati divergenti e perdite reali: l'altro utente non vede l'ordine, e un successivo salvataggio da un altro dispositivo sovrascrive il dato mai sincronizzato.

*Fix:* Far restituire a storage.set un esito esplicito (es. { remoteOk: false }) o rilanciare l'errore dopo il fallback locale; in setDatiSave mostrare un toast/banner persistente ('Salvato solo in locale — modifiche non sincronizzate') e ritentare la sincronizzazione quando la rete torna disponibile.

### 4. storage.get: fallback su cache localStorage stantia al boot → il primo salvataggio riporta indietro i dati di tutti

- **Dove:** `index.html:696`
- **Area:** Backend / edge functions

Se la GET su app_kv fallisce al caricamento dell'app (righe 696-702), window.storage.get restituisce la copia in localStorage ('tnb__tnb-pro-v2'), che può essere vecchia di giorni, senza alcuna segnalazione. L'App (riga 18588) la usa come stato corrente. Appena l'utente fa una qualsiasi modifica e la rete è tornata, setDatiSave sovrascrive la riga condivisa sul server con lo stato derivato dalla copia stantia: tutte le modifiche fatte nel frattempo dagli altri utenti (ordini, movimenti magazzino, incassi) vengono cancellate senza che nessuno se ne accorga.

**Fix proposto:** Marcare il dato di fallback come 'stale' (es. {value, fromCache:true} con timestamp updated_at salvato in cache): al boot in modalità cache mostrare l'app in sola lettura o con banner 'dati non aggiornati', e prima di riabilitare i salvataggi ritentare la GET dal server e riconciliare (o almeno confrontare updated_at remoto prima di scrivere).

### 5. Clamp Math.max(0,…) sugli scarichi + riaccredito pieno di annullo/resa creano stock fantasma

- **Dove:** `index.html:2596`
- **Area:** Integrità dati magazzino

In ricalcolaGiacenza gli scarichi sono clampati a zero (riga 2596: `g.disponibile = Math.max(0, g.disponibile - q)`), ma annullo_ordine/resa_cv riaccreditano la quantità piena (riga 2602: `g.disponibile += q`). Scenario concreto: disponibile 10, ordine A firmato scarica 10 → disp 0; scarico_manuale di 5 (nessuna validazione, vedi finding dedicato) → clamp a 0, i 5 pezzi 'usciti' spariscono dal calcolo; annullo dell'ordine A → +10 → disponibile 10 a fronte di 5 pezzi fisici reali. Il log movimenti non è più sommabile: carico − scarico ≠ giacenza, e ogni coppia scarico-clampato/annullo-pieno fabbrica pezzi inesistenti.

**Fix proposto:** Non clampare silenziosamente durante il replay: registrare gli scarichi per la quantità effettivamente sottratta (o consentire valori negativi interni segnalandoli come anomalia), e far sì che annullo_ordine/resa_cv riaccreditino al massimo la quantità realmente scaricata per quell'ordineId.

---

## Severità 🟠 Alta (39 finding)

### 6. Report Periodo include gli ordini annullati nel fatturato e nei conteggi

- **Dove:** `index.html:21639`
- **Area:** Pagine e componenti UI

In ReportPeriodo `ordiniPeriodo = dati.ordini.filter(o => inRange(o.data))` non esclude gli ordini con `stato === "annullato"`. Di conseguenza il 'Fatturato periodo' (riga 21640), il numero ordini e la tabella per canale (righe 21649-21656) contano anche il valore di ordini annullati. La Dashboard invece li esclude esplicitamente (fix tkt_1781169406976, riga 6136): stessi dati, numeri diversi tra le due pagine, con il report — usato per le analisi di periodo — che sovrastima il fatturato.

**Fix proposto:** Filtrare a monte: `const ordiniPeriodo = dati.ordini.filter(o => o.stato !== "annullato" && inRange(o.data));` (e valutare lo stesso filtro su `haOrd` a riga 21636 per i 'clienti attivi').

### 7. Routing hash senza controllo ruoli: qualsiasi utente apre qualsiasi modulo (e in scrittura)

- **Dove:** `index.html:18706`
- **Area:** Pagine e componenti UI · Autenticazione e permessi

Il listener hashchange fa `if (m) setModulo(m)` senza verificare ROLE_ACCESS: un utente `commerciale` che digita `#produzione`, `#fornitori`, `#costi`, `#log` o `#impostazioni` nell'URL apre moduli non presenti nella sua sidebar. Aggrava il problema il fatto che ROLE_READONLY dichiara `produzione`, `fornitori` e `costi` in sola lettura per il commerciale, ma la prop `readonly` è passata solo a Magazzino (riga 19164): Produzione, Fornitori e CostiMargini vengono renderizzati con pieni permessi di modifica (righe 19166-19176). Il controllo di accesso esiste solo come filtro visivo del menu.

**Fix proposto:** In `onHash` (e in `setModuloNav`) accettare solo moduli inclusi in `ROLE_ACCESS[currentUser.role]` (fallback a 'oggi'/'dashboard'), e passare `readonly: isReadonly(...)` anche a Produzione, Fornitori e CostiMargini gestendo la prop nei tre componenti.

*Nota verifica: segnalato indipendentemente da 2 auditor.*

*Aspetto aggiuntivo («ROLE_ACCESS aggirabile via hash nell'URL: ogni ruolo apre qualsiasi modulo», `index.html:18706`):* Il routing hash (handler 'hashchange', righe 18704-18707: `if (m) setModulo(m);`) e il rendering dei moduli (righe ~19141-19217, condizioni solo `modulo === "x"`) non verificano mai `access.includes(modulo)`: `ROLE_ACCESS` filtra soltanto le voci della sidebar (riga 18861). Un utente `tester` (Irene) può digitare `#impostazioni` e modificare i dati aziendali che finiscono su tutti i PDF/email (il form Impostazioni, righe 24984+, non è protetto da `isSuperAdmin`, che copre solo la danger zone a riga 25278) oppure aprire `#utenti`; un futuro `commerciale` può aprire `#log`, `#magazzino`, `#produzione` ecc. pur non avendoli tra i moduli consentiti.

*Fix:* Centralizzare il controllo: in `setModuloNav` e nell'handler `hashchange` accettare il modulo solo se `ROLE_ACCESS[currentUser.role].includes(m)` (altrimenti redirect a 'oggi'/'dashboard'), e come cintura di sicurezza wrappare il blocco di rendering con `access.includes(modulo) && ...`.

### 8. Salvataggi concorrenti non serializzati: una POST più vecchia può sovrascrivere quella più nuova su Supabase

- **Dove:** `index.html:18654`
- **Area:** Hooks e logica di stato

setDatiSave lancia window.storage.set('tnb-pro-v2', json) fire-and-forget a ogni aggiornamento di stato, senza coda né controllo di versione. Due salvataggi ravvicinati (es. quickComplete di più azioni in 'Oggi', o la raffica di keystroke del finding sui form CostiMargini) producono POST parallele dell'intero stato: se la rete riordina le risposte (frequente su mobile), su Supabase resta persistito lo stato più vecchio. La UI locale appare corretta, ma al prossimo reload (o su un altro dispositivo) le modifiche più recenti sono sparite.

**Fix proposto:** Serializzare i salvataggi con una coda: mantenere solo l'ultimo stato pendente e inviare la POST successiva solo al completamento della precedente (pattern 'latest-wins queue'). In aggiunta, includere un contatore/timestamp monotono nel record e rifiutare lato client (o via funzione RPC) scritture con versione inferiore a quella già persistita.

### 9. Race read-modify-write in logAction: voci del log attività perse

- **Dove:** `index.html:18676`
- **Area:** Hooks e logica di stato · Autenticazione e permessi · Validazione e input utente · Gestione errori e stati vuoti

logAction fa get('tnb-log') → unshift → set('tnb-log') in async senza alcuna serializzazione. Due azioni ravvicinate (es. flussi che chiamano logAction subito dopo un'altra azione loggata, o due utenti/tab attivi contemporaneamente — scenario reale con 5 utenti censiti) leggono entrambe la stessa lista: la seconda set sovrascrive la prima e una voce sparisce definitivamente. Il log è dichiarato append-only e usato per la tracciabilità multi-utente (vedi DA-FARE.md), quindi la perdita silenziosa di voci ne mina la funzione di audit.

**Fix proposto:** Nell'immediato, serializzare le chiamate logAction con una promise-chain locale (accodare le scritture). Fix corretto: sostituire il blob unico con una tabella Supabase in append (INSERT di una riga per voce), eliminando strutturalmente la race anche tra dispositivi diversi.

*Nota verifica: segnalato indipendentemente da 4 auditor.*

*Aspetto aggiuntivo («Log attività non realmente append-only: una lettura fallita azzera l'intero storico», `index.html:18677`):* `logAction` (righe 18674-18693) fa read-modify-write dell'intera chiave `tnb-log`: legge tutto il log, fa `unshift` e riscrive tutto con `window.storage.set`. Se `window.storage.get("tnb-log")` fallisce (Supabase momentaneamente irraggiungibile, riga 693) su un browser senza cache locale `tnb__tnb-log` (dispositivo nuovo), restituisce `null` → `logs = []` → la `set` successiva sovrascrive su Supabase l'INTERO storico con la sola nuova voce. Inoltre due utenti che agiscono in contemporanea si sovrascrivono a vicenda (last-writer-wins: voci perse in silenzio) e il `catch (e) {}` inghiotte ogni errore. Questo smentisce la garanzia "append-only e non cancellabile (nemmeno dal superadmin)" documentata in DA-FARE.md e su cui si basa la tracciabilità multi-utente (Elisa/Lucia).

*Fix:* Rendere il log append-only a livello di storage: una riga per voce (es. tabella Supabase `app_log` con INSERT-only e policy RLS senza UPDATE/DELETE) invece di un'unica chiave KV riscritta; in subordine, non scrivere mai se la `get` è fallita (distinguere 'chiave assente' da 'errore di rete') e segnalare a video il mancato salvataggio del log.

*Aspetto aggiuntivo («Log attività 'append-only' perde voci: read-modify-write non atomico su azioni ravvicinate o utenti concorrenti», `index.html:18690`):* logAction (righe 18674-18693) fa get asincrono di 'tnb-log', unshift della nuova voce e set dell'intero array. Due azioni ravvicinate nella stessa sessione (es. salvataggio ordine che scatena logAction mentre un'altra è in volo) o due utenti su macchine diverse (ora l'app è multi-utente: Irene, Elisa, Lucia) leggono lo stesso snapshot e l'ultima scrittura sovrascrive l'altra: le voci intermedie spariscono definitivamente. Questo contraddice la garanzia 'append-only e non cancellabile' documentata in DA-FARE.md su cui si basa la tracciabilità multi-utente, senza che nessun errore venga mostrato (catch vuoto a riga 18693).

*Fix:* Persistere ogni voce di log come record separato (INSERT su una tabella Supabase dedicata o chiave KV per-voce con id univoco) invece di riscrivere l'intero array; in alternativa serializzare le chiamate logAction con una coda promise-based lato client per eliminare almeno la race nella singola sessione.

*Aspetto aggiuntivo («logAction: catch vuoto — voci del Report Attività perse o sovrascritte in silenzio», `index.html:18693`):* logAction (righe 18674-18693) fa get di 'tnb-log', unshift della voce e set dell'intero array, con catch (e) {} finale: qualsiasi fallimento perde la voce di audit senza traccia. Peggio: se il get fallisce per un problema di rete transitorio, storage.get ripiega sulla copia localStorage del dispositivo (potenzialmente vecchia o vuota) e il set successivo riscrive l'intero 'tnb-log' su Supabase con quella copia stantia, cancellando voci registrate da altri utenti. Il log è dichiarato 'append-only e non cancellabile' (riga 18691 e DA-FARE.md) ed è la base della tracciabilità multi-utente: qui può corrompersi in silenzio.

*Fix:* Non riscrivere mai l'intero log partendo da una copia di fallback: marcare il risultato di storage.get come 'remoto/locale' e, se locale, accodare la voce in una coda di retry invece di fare set; in ogni caso sostituire il catch vuoto con console.error + toast ('⚠ Azione non registrata nel log').

### 10. Bozze dei form salvate nello stato globale: POST dell'intero stato a ogni tasto premuto

- **Dove:** `index.html:17377`
- **Area:** Hooks e logica di stato

I campi bozza delle voci extra e dei costi struttura in CostiMargini (_exDesc/_exImp/_exData/_exSkus a 17377-17382, _csDesc/_csImp/_csDal/_csFornitore a 17553-17559) e i campi di ImpostazioniModule (24988, 24997, textarea template a 25010) chiamano setDati (= setDatiSave) a ogni onChange. Ogni keystroke provoca: JSON.stringify dell'INTERO stato applicativo, una POST a Supabase e il re-render dell'intera app. Digitare una descrizione genera una raffica di POST concorrenti che rende concreta la race di riordino del salvataggio (finding su riga 18654) e causa lag di digitazione percepibile con dataset reali.

**Fix proposto:** Tenere le bozze in useState locale del componente (come già fatto in tutti gli altri moduli con `form`) e chiamare setDati una sola volta al click su 'Aggiungi'/'Salva'; per i campi di Impostazioni, fare commit su blur o con debounce.

### 11. window._supaOk non viene mai impostato: il banner 'Supabase non raggiungibile' è irraggiungibile

- **Dove:** `index.html:18714`
- **Area:** Hooks e logica di stato · Gestione errori e stati vuoti · Accessibilità e usabilità

L'effetto a 18712-18717 mostra il banner 'salvataggio solo locale' se window._supaOk === false dopo 3 secondi dal mount, ma _supaOk non è assegnato in nessun punto del file (unica occorrenza è questa lettura). Dato che window.storage.set ripiega silenziosamente su localStorage in caso di errore rete/RLS restituendo comunque successo, l'utente può lavorare per ore convinto di salvare sul server mentre nulla arriva a Supabase, senza mai vedere l'avviso pensato esattamente per questo caso.

**Fix proposto:** Impostare window._supaOk = true/false dentro window.storage.get/set (false quando scatta il fallback, true su risposta ok) e trasformare il check una-tantum in un controllo ricorrente (setInterval o listener) che mostri/nasconda il banner in base allo stato reale.

*Nota verifica: segnalato indipendentemente da 3 auditor.*

*Aspetto aggiuntivo («Banner 'Supabase non raggiungibile' irraggiungibile: window._supaOk non viene mai impostato», `index.html:18714`):* L'unico meccanismo pensato per avvisare l'utente che i salvataggi avvengono solo in locale è il banner arancione a riga 18863-18872 ('⚠️ Supabase non raggiungibile — salvataggio solo locale'), attivato se window._supaOk === false (riga 18714). Ma _supaOk non è mai assegnato in nessun punto del codice (verificato con grep su tutto il file): il banner è codice morto e non può comparire mai. Risultato: anche quando tutte le chiamate a Supabase falliscono, l'app appare perfettamente funzionante.

*Fix:* Impostare window._supaOk = true/false rispettivamente nel ramo di successo e nei catch di window.storage.get/set (righe 693-696 e 712-716), e valutare un listener continuo (non solo il check una tantum dopo 3 secondi) per mostrare/nascondere il banner quando la connettività cambia.

*Aspetto aggiuntivo («Banner "Supabase non raggiungibile" morto: i salvataggi falliti restano invisibili all'utente», `index.html:18714`):* L'App ha un banner arancione "⚠️ Supabase non raggiungibile — salvataggio solo locale" (riga 18863) che si attiva solo se `window._supaOk === false` (riga 18714), ma `window._supaOk` non viene MAI valorizzato in tutto il file (le uniche 3 occorrenze sono la dichiarazione dello state, il check e il render). In più `window.storage.set` (righe 704-722) in caso di errore Supabase fa fallback silenzioso su localStorage e ritorna comunque successo, e `setDatiSave` (riga 18654) usa `.finally` senza distinguere esito. Risultato concreto: se Supabase è irraggiungibile (offline, RLS, chiave revocata), l'operatore continua a lavorare convinto che tutto sia salvato sul gestionale condiviso, mentre i dati restano solo sul suo browser: i colleghi non li vedono e possono essere sovrascritti al salvataggio successivo da un altro dispositivo.

*Fix:* Far restituire a `window.storage.set` un flag esplicito (es. `{ok:false, fallback:'local'}`) quando la scrittura Supabase fallisce; in `setDatiSave` impostare `window._supaOk = false` (o uno state) in quel caso e mostrare il banner già pronto, più un toast "err" ("⚠ Salvato solo su questo dispositivo, sincronizzazione fallita"). Rimuovere il check basato su una variabile mai assegnata.

### 12. Dopo un salvataggio fallito il fallback localStorage viene scartato al reload: rollback silenzioso

- **Dove:** `index.html:719`
- **Area:** Hooks e logica di stato

window.storage.set in errore scrive solo su localStorage (riga 719) e riferisce successo al chiamante; window.storage.get però preferisce SEMPRE il valore Supabase quando la rete funziona (righe 689-695), usando la cache locale solo se il fetch fallisce. Scenario concreto: cala la rete, l'utente registra ordini/movimenti (toast di conferma regolari, fallback locale), la rete torna, l'utente ricarica la pagina → get restituisce il blob remoto vecchio e tutte le modifiche 'salvate in locale' vengono scartate senza alcun avviso.

**Fix proposto:** Salvare accanto alla cache locale un timestamp/flag 'dirty' quando si ripiega su localStorage; in get, se esiste una versione locale più recente di quella remota, segnalare il conflitto all'utente (o ritentare automaticamente il push della versione locale prima di consegnare i dati).

### 13. Endpoint report-ai pubblico: nessuna autenticazione, CORS aperto a *, nessun rate limit → consumo arbitrario della API key Anthropic

- **Dove:** `netlify/functions/report-ai.mjs:8`
- **Area:** Backend / edge functions

La function accetta POST da chiunque: 'Access-Control-Allow-Origin: *' (riga 8), nessun controllo di origine, token, segreto condiviso o sessione, nessun rate limiting e nessun limite sulla dimensione di domanda/datiProspect. L'URL è standard e indovinabile (https://<sito>/.netlify/functions/report-ai). Chiunque (anche uno script da un altro sito, dato il CORS aperto) può invocarla in loop con prompt arbitrari e far consumare token Anthropic a spese dell'azienda (max_tokens 2500 per chiamata, senza tetto sulle chiamate); di fatto è un proxy LLM gratuito con la chiave aziendale.

**Fix proposto:** Richiedere un header segreto condiviso (es. X-TNB-Token confrontato con una env var Netlify) verificato prima della chiamata ad Anthropic, restringere Access-Control-Allow-Origin al dominio di produzione, e aggiungere un limite di dimensione del body (es. rifiutare > 1 MB) e un rate limit minimo (anche solo in-memory per istanza).

### 14. logAction: read-modify-write dell'intero log ad ogni azione — race che perde voci, payload che cresce senza limite, errori silenziati

- **Dove:** `index.html:18692`
- **Area:** Backend / edge functions · Performance

Ogni azione tracciata fa GET dell'intero array 'tnb-log', unshift di una voce e POST dell'intero array (righe 18676-18692). Tre problemi concreti: (1) due utenti che agiscono nello stesso momento leggono lo stesso array e l'ultimo POST cancella la voce dell'altro — il log 'append-only e non cancellabile' perde voci proprio nell'uso multi-utente per cui è pensato; (2) se la GET cade nel fallback localStorage stantio (riga 696), il POST successivo sovrascrive il log condiviso con una copia vecchia, distruggendo le voci recenti di tutti; (3) l'array non è mai troncato e viene ritrasmesso per intero a ogni singola azione: il payload cresce indefinitamente (upload di MB per aggiungere una riga). In più il catch vuoto a riga 18693 fa sparire qualsiasi errore: l'audit trail non è affidabile.

**Fix proposto:** Trasformare il log in vere righe append-only: tabella dedicata (es. app_log) con una INSERT per voce via PostgREST, niente read-modify-write; in lettura paginare con Range. In alternativa minima: chiave per-mese (tnb-log-YYYY-MM) per limitare la crescita e ridurre la finestra di race, e loggare/segnalare i fallimenti invece del catch vuoto.

*Nota verifica: segnalato indipendentemente da 2 auditor.*

*Aspetto aggiuntivo («Log attività: riscrittura completa del blob a ogni azione, crescita illimitata», `index.html:18692`):* logAction (righe 18674-18693) per OGNI azione registrata scarica l'intero log da Supabase (storage.get "tnb-log"), fa JSON.parse di tutto, unshift di una voce e ri-carica l'intero JSON.stringify(logs) con un POST. Il log è dichiaratamente append-only e mai cancellabile (riga 18691 e clearLog a 19302), quindi cresce senza limite: dopo mesi di uso ogni chiamata, modifica cliente o PDF generato comporta download+upload di un blob da megabyte, con latenza crescente su ogni flusso quotidiano. Due azioni ravvicinate rischiano inoltre di sovrascriversi (read-modify-write non atomico).

*Fix:* Sostituire il blob unico con una tabella Supabase dedicata dove ogni azione è un INSERT di una singola riga (il costo per azione diventa costante). In alternativa, spezzare il log in chunk mensili (tnb-log-2026-07) così da leggere/scrivere solo il mese corrente.

### 15. Riapertura di un ordine annullato non rigenera lo scarico magazzino

- **Dove:** `index.html:2844`
- **Area:** Integrità dati magazzino · Documenti e flussi

Il guard di idempotenza in applicaTransizioneOrdineMagazzino (riga 2844: `giaScaricato = newMov.some(mv => mv.ordineId === ordine.id && mv.tipo === 'scarico_ordine')`) considera solo l'esistenza di scarichi storici, senza tenere conto degli annulli. Flusso reale via UI: ordine firmato (scarico 10 pz) → 'Annulla ordine' (annullo_ordine +10) → '↩ Riapri ordine' (bottone a riga 12056, riporta lo stato a 'firmato' via statoLog) → al salvataggio la transizione →firmato trova gli scarichi vecchi e NON genera nuovi scarichi. Risultato: ordine attivo/firmato ma giacenza mai decrementata → disponibile sovrastimato di 10 pz, possibile doppia vendita dello stesso stock (impatto economico diretto).

**Fix proposto:** In applicaTransizioneOrdineMagazzino confrontare scarichi e annulli per ordineId (es. `numScarichi > numAnnulli` o somma qta scaricata − annullata > 0) invece della sola esistenza di scarichi; se l'ordine è stato annullato e riaperto, rigenerare gli scarichi (previa verificaDisponibilitaOrdine).

*Nota verifica: severità riclassificata dal verificatore da *critica* a *alta*; segnalato indipendentemente da 2 auditor.*

*Aspetto aggiuntivo («Riaprire un ordine annullato non rigenera lo scarico: giacenza gonfiata», `index.html:2844`):* Quando un ordine firmato viene annullato, applicaTransizioneOrdineMagazzino genera movimenti annullo_ordine che restituiscono i pezzi al disponibile. Se poi si usa "↩ Riapri ordine" (riga 12072, updateStatoForm + Salva), la transizione annullato→firmato NON rigenera lo scarico: il check di idempotenza `giaScaricato` (riga 2844) trova i vecchi movimenti scarico_ordine e salta la generazione, senza accorgersi che sono già stati compensati dagli annulli. Risultato: ordine di nuovo attivo (firmato/consegnato) ma il magazzino conta i pezzi come disponibili → si possono firmare altri ordini su stock fantasma.

*Fix:* Nel ramo →firmato di applicaTransizioneOrdineMagazzino, considerare lo scarico "già fatto" solo se esistono scarico_ordine NON compensati: confrontare il numero (o la somma qta) di scarico_ordine e annullo_ordine per l'ordineId e rigenerare gli scarichi se il netto è zero. In alternativa, alla riapertura generare movimenti scarico_ordine di ripristino.

### 16. affido_spedizioniere sottrae la stessa quantità sia da 'riservato' sia da 'in_confezionamento' (doppio decremento)

- **Dove:** `index.html:2589`
- **Area:** Integrità dati magazzino

In ricalcolaGiacenza il caso affido_spedizioniere (righe 2587-2589) aggiunge q a in_spedizione ma sottrae q sia da riservato sia da in_confezionamento (stessa logica in applicaMovimento, righe 2496-2498). Se entrambi gli stati sono valorizzati, il totale si riduce del doppio: es. riservato=10, in_confezionamento=8, affido di 10 → in_spedizione 10, riservato 0, in_confezionamento max(0,8−10)=0: il totale passa da 18 a 10, 8 pezzi svaniscono dalla giacenza pur esistendo fisicamente.

**Fix proposto:** Sottrarre q una sola volta con priorità: prima da riservato, e solo il residuo (q − riservato disponibile) da in_confezionamento; allineare sia ricalcolaGiacenza sia applicaMovimento.

### 17. saveMov non valida la disponibilità per i movimenti di uscita

- **Dove:** `index.html:13189`
- **Area:** Integrità dati magazzino · Validazione e input utente

Nel modal 'Nuovo movimento' del Magazzino, saveMov (riga 13187) valida solo qta > 0 (riga 13189) e il DDT; nessun controllo che la quantità di scarico_manuale, scarico_ordine, riserva, affido_spedizioniere o consegnato sia coperta dalla giacenza dello stato di origine. L'utente può registrare 'consegnato 50' con in_spedizione=0: il movimento viene salvato (con DDT in archivio) ma il clamp lo rende un no-op silenzioso; oppure scaricare 100 con disponibile 60: 40 pezzi si perdono senza alcun errore e il log non torna più con la giacenza. Combinato con annullo_ordine genera stock fantasma (vedi finding sul clamp).

**Fix proposto:** In saveMov, prima del salvataggio, ricalcolare la giacenza corrente dello SKU e bloccare (o chiedere conferma esplicita con motivazione) i movimenti di uscita la cui qta eccede lo stato di origine, mostrando disponibile/riservato/in_spedizione correnti.

*Nota verifica: segnalato indipendentemente da 2 auditor.*

*Aspetto aggiuntivo («Movimenti magazzino in uscita senza controllo disponibilità: l'eccesso viene assorbito in silenzio», `index.html:13189`):* saveMov (riga 13187-13227) valida solo qta > 0 e DDT, ma per i movimenti in uscita (scarico_manuale, consegnato, affido_spedizioniere, riserva…) non confronta mai la quantità con la giacenza disponibile. In ricalcolaGiacenza il clamp Math.max(0, disponibile - q) (riga 2596, e analoghi 2580-2592) azzera silenziosamente lo stato senza segnalare che si è scaricato più del posseduto: con 50 pz disponibili, uno scarico da 500 (refuso) porta a 0 senza alcun avviso, e il movimento da 500 resta per sempre nella cronologia, per cui ogni ricalcolo riproduce la giacenza sbagliata. L'inventario diverge dalla realtà senza che nessuno se ne accorga.

*Fix:* In saveMov, per i tipi in uscita, calcolare la disponibilità dello stato sorgente (dalla giacenza corrente dello SKU) e bloccare — o quantomeno chiedere conferma con avviso esplicito — se qta supera il disponibile. In ricalcolaGiacenza loggare/flaggare i movimenti che causerebbero valori negativi invece di clampare in silenzio.

### 18. saveSku: la giacenza digitata a mano diverge dal ricalcolo event-sourced (apertura non-lineare)

- **Dove:** `index.html:13242`
- **Area:** Integrità dati magazzino

saveSku salva direttamente `giacenza: giacenzaDesiderata` (riga 13242) e riconcilia emettendo un movimento 'apertura' con delta = desiderata − ricalcolo dei soli movimenti reali (righe 13252-13257). Ma il replay è non-lineare per via dei clamp: se lo storico contiene es. uno scarico_manuale di 10 partito da 0 (calc=0) e l'utente imposta disponibile=5, il delta è +5; al replay però l'apertura (+5, timestamp 0) precede lo scarico → max(0, 5−10) = 0 ≠ 5. La giacenza salvata (5) è subito incoerente col log e al primo movimento successivo qualsiasi ricalcolo la azzera 'da sola', apparendo all'utente come sparizione inspiegabile di pezzi.

**Fix proposto:** Dopo aver costruito l'apertura, verificare che ricalcolaGiacenza(apertura + movimenti reali) coincida con la giacenza desiderata; se no, iterare sul delta (o calcolare l'apertura replayando i movimenti a partire dal delta) e salvare in m.giacenza sempre il valore ricalcolato, mai quello digitato.

### 19. Rimozione firma con rollback a 'Da firmare' non ripristina il magazzino

- **Dove:** `index.html:11056`
- **Area:** Integrità dati magazzino · Documenti e flussi

removeFirmaConRollback riporta l'ordine da firmato/consegnato/fatturato a 'da_firmare' (riga 11056) ma applicaTransizioneOrdineMagazzino gestisce solo le transizioni →firmato e →annullato: gli scarichi restano attivi su un ordine non più firmato → disponibile sottostimato finché l'ordine non viene rifirmato o annullato. La Guida in-app (riga 25554) dichiara esplicitamente 'se annulli la firma, il magazzino viene ripristinato', quindi il comportamento contraddice la documentazione utente. Se poi l'ordine viene modificato nelle righe e rifirmato, il guard giaScaricato impedisce il nuovo scarico e le quantità restano quelle vecchie.

**Fix proposto:** Al rollback →da_firmare generare movimenti annullo_ordine per gli scarichi esistenti (come per →annullato), e correggere il guard di ri-firma perché rigeneri gli scarichi; in alternativa, aggiornare guida e UI avvisando che il magazzino resta scaricato.

*Nota verifica: segnalato indipendentemente da 2 auditor.*

*Aspetto aggiuntivo («Rollback a "Da firmare" (rimozione firma) non ripristina la giacenza scaricata», `index.html:11056`):* removeFirmaConRollback riporta l'ordine a "da_firmare" (updateStatoForm, riga 11056) quando si rimuove la firma, ma i movimenti scarico_ordine generati alla firma restano attivi: nessun annullo viene emesso (applicaTransizioneOrdineMagazzino non gestisce firmato→da_firmare). La giacenza resta decrementata per un ordine che risulta non firmato. Inoltre, se prima della nuova firma si modificano le righe (quantità/formati), alla ri-firma il check `giaScaricato` impedisce di rigenerare gli scarichi: i movimenti restano quelli delle righe vecchie, divergendo dal documento.

*Fix:* Alla retrocessione firmato→da_firmare generare movimenti annullo_ordine di compensazione (come per l'annullamento), così la giacenza torna coerente e la ri-firma rigenera scarichi aggiornati alle righe correnti.

### 20. La catena lotto → cliente non viene mai registrata: scarico_ordine ha sempre lottoId null

- **Dove:** `index.html:2767`
- **Area:** Tracciabilità lotti · Scadenze e rotazione

In `generaMovimentiOrdine` (riga 2760-2774) ogni movimento `scarico_ordine` generato alla firma dell'ordine viene creato con `lottoId: null` hardcoded (riga 2767); lo stesso vale per `resa_cv` (riga 2823) e `annullo_ordine` (riga 2870). Le righe ordine portano solo `formato` e `annata`, mai il lotto, e nessun punto del flusso consegna (RigaConsegnaModal, riga 10244+) chiede quale lotto viene spedito. Il commento stesso in `tracciabilitaLotto` (righe 4544-4546) ammette: "non sappiamo con certezza quale lotto ha fornito le bottiglie di uno specifico ordine" e ripiega su un'attribuzione proporzionale. Effetto concreto: per un'azienda alimentare, in caso di richiamo di un lotto (obbligo Reg. UE 178/2002) è impossibile risalire a quali clienti è stato consegnato; il dato non viene mai catturato e non è ricostruibile a posteriori.

**Fix proposto:** Aggiungere il campo lotto allo scarico: alla firma dell'ordine, per ogni SKU proporre i lotti che hanno caricato quello SKU (movimenti `carico_produzione` con `lottoId`) con logica FIFO come default, e salvare `lottoId` (o una lista {lottoId, qta}) sul movimento `scarico_ordine`. Propagare lo stesso lotto a `annullo_ordine`/`resa_cv` copiandolo dallo scarico originale.

*Nota verifica: severità riclassificata dal verificatore da *critica* a *alta*; segnalato indipendentemente da 2 auditor.*

*Aspetto aggiuntivo («Scarico ordine senza lotto: nessun FIFO e tracciabilità lotto persa in uscita», `index.html:2767`):* In generaMovimentiOrdine ogni movimento 'scarico_ordine' viene creato con `lottoId: null` hardcoded (riga 2767); lo stesso vale per 'resa_cv' (riga 2820) e 'annullo_ordine' (riga 2869). Il magazzino è aggregato per SKU (prodotto+formato+annata) e solo i movimenti 'carico_produzione' portano il lottoId (riga 14658). Anche il form movimento manuale non espone alcun campo lotto (nessun input imposta form.lottoId, riga 13203 resta sempre null). Risultato: al momento del prelievo il sistema non suggerisce né registra QUALE lotto esce — non esiste alcun ordine di prelievo FIFO (né suggerito né forzato) e, con più lotti caricati sullo stesso SKU, è impossibile ricostruire a quale cliente è andato un dato lotto (es. in caso di richiamo alimentare o non conformità).

*Fix:* Aggiungere al flusso di scarico la selezione del lotto: proporre di default il lotto con carico più vecchio (FIFO sui movimenti carico_produzione ordinati per data) e salvare lottoId sui movimenti scarico_ordine/resa_cv/annullo_ordine; esporre il campo lotto anche nel form movimento manuale.

### 21. Guardia morta in deleteLotto: un lotto già caricato in magazzino è eliminabile e lascia movimenti orfani

- **Dove:** `index.html:14555`
- **Area:** Tracciabilità lotti

`deleteLotto` blocca l'eliminazione solo se `form.caricoMagazzino` è truthy (riga 14555), ma quel campo a livello di lotto non esiste più: la migrazione `migrateV50ImbottLotto` lo cancella esplicitamente (`delete nuovi.caricoMagazzino`, riga 2109) e da v50 il flag vive solo dentro i singoli imbottigliamenti (`imb.caricoMagazzino`, settato a riga 14673). Quindi la guardia non scatta mai: si può eliminare un lotto i cui imbottigliamenti sono già stati caricati in magazzino. L'eliminazione (riga 14563) rimuove solo il lotto e non tocca `dati.movimenti`: i movimenti `carico_produzione` restano con `lottoId` pendente verso un lotto inesistente, il magazzino conserva pezzi senza origine, la tabella movimenti non risolve più il riferimento (riga 13877) e `tracciabilitaLotto` perde la quota di quei carichi. Anche il pulsante "Elimina lotto" (riga 15711) resta sempre visibile per lo stesso motivo.

**Fix proposto:** Sostituire il check con `(form.imbottigliamenti || []).some(i => i.caricoMagazzino)` sia in `deleteLotto` (riga 14555) sia nella condizione di visibilità del pulsante (riga 15711); in alternativa/in aggiunta, bloccare l'eliminazione se esistono movimenti con `mv.lottoId === form.id`.

### 22. tracciabilitaLotto conta i ricavi più volte se il lotto ha più imbottigliamenti sullo stesso SKU

- **Dove:** `index.html:4589`
- **Area:** Tracciabilità lotti

Il loop `imbottigliamenti.forEach` (riga 4589) calcola per OGNI imbottigliamento la quota e i ricavi dell'INTERO SKU (`carichiLotto`, `scarichi`, `ricavoSku` sono aggregati per SKU, non per imbottigliamento) e li somma a `totRicavi` (riga 4616). Se un lotto ha due o più sessioni di imbottigliamento con la stessa bottiglia/SKU (caso normale: `addImbottigliamento` non lo impedisce e il modello v50 è pensato per imbottigliamenti multipli), gli stessi ricavi e la stessa quantità venduta vengono sommati N volte: `margineLotto`, `marginePct`, `pctVenduto` e il dettaglio per formato nel tab "Per Lotto" di Costi & Margini (riga 17578) risultano gonfiati, fino a mostrare in utile lotti in perdita.

**Fix proposto:** Aggregare gli imbottigliamenti per `sku.id` prima del loop (es. `Map` skuId → qta prodotta totale) e calcolare quota/ricavi una sola volta per SKU, oppure dedupare gli SKU già processati con un `Set` dentro il forEach.

### 23. Carichi manuali (anche "carico_produzione") senza lotto: merce entra in magazzino senza origine e falsa le quote di attribuzione

- **Dove:** `index.html:13203`
- **Area:** Tracciabilità lotti

Il modale "Registra Movimento" (righe 14113-14250) non ha alcun campo per selezionare il lotto: `saveMov` salva sempre `lottoId: form.lottoId || null` (riga 13203), che è sempre null. Tra i tipi selezionabili ci sono sia "Carico (nuova produzione)" sia "Carico da produzione" (riga 13181): registrandoli a mano si crea giacenza vendibile priva di qualunque legame col lotto, aggirando il flusso tracciato di `caricaImbottigliamentoInMagazzino`. Effetto ulteriore: in `tracciabilitaLotto` un `carico_produzione` manuale senza lottoId entra nel denominatore `qtaCaricataTot` (righe 4595-4597) ma in nessun `carichiLotto`, riducendo la quota di TUTTI i lotti reali e lasciando parte dei ricavi non attribuita ad alcun lotto.

**Fix proposto:** Nel modale movimenti, quando `tipo` è `carico` o `carico_produzione`, mostrare un Sel obbligatorio dei lotti (dati.lotti) e salvare `lottoId`; in alternativa rimuovere `carico_produzione` dai tipi manuali forzando il passaggio dal flusso Produzione → "Carica in magazzino" che il lotto lo registra correttamente.

### 24. Ordini annullati inclusi in ricavi e costi del P&L di campagna

- **Dove:** `index.html:4712`
- **Area:** Costificazione FIFO / costo medio ponderato

In calcolaPLCampagna gli ordini della campagna sono filtrati solo per data (`o.data >= range.inizio && o.data <= range.fine`) senza escludere `o.stato === "annullato"`. La Dashboard li esclude esplicitamente (riga 6136, ticket tkt_1781169406976), ma il P&L no: un ordine vendita annullato dopo la firma (le cui bottiglie sono rientrate in magazzino con `annullo_ordine`) continua a gonfiare venditeRicavo, costoVariabile, margine lordo/netto e i confronti YoY. Stesso difetto in calcolaMargineCliente (riga 4768) e nel tab "Per Ordine" di CostiMargini (riga 16819): margini per cliente/canale/ordine calcolati su vendite mai avvenute.

**Fix proposto:** Aggiungere `o.stato !== "annullato"` al filtro di calcolaPLCampagna (riga 4712), calcolaMargineCliente (riga 4768) e all'analisi per ordine di CostiMargini (riga 16819), allineandosi al comportamento della Dashboard (riga 6136).

*Nota verifica: severità riclassificata dal verificatore da *critica* a *alta*.*

### 25. Costo mancante trattato silenziosamente come 0 nel P&L (margini al 100%)

- **Dove:** `index.html:4496`
- **Area:** Costificazione FIFO / costo medio ponderato

costoFormatoTot ritorna 0 quando costoFormatoReale ha fonte "nd" (nessuna bottiglia BOM per il formato) o "parziale" (BOM senza imbottigliamenti: `totale = null` anche se il packaging è noto, riga 4486). calcolaPLCampagna (riga 4725), calcolaMargineCliente (riga 4783) e il tab "Per Ordine" (riga 16824) usano questo 0 senza alcuna segnalazione: per un formato senza BOM completo il costo variabile è 0 e il margine risulta pari al ricavo (100%), gonfiando margine lordo/netto e la classifica clienti. Solo il tab "Per Formato" mostra la fonte; il P&L overview no.

**Fix proposto:** Nel caso "parziale" usare almeno il costo packaging come totale parziale; nel P&L e nei tab per ordine/cliente contare i pezzi con fonte "nd/parziale" e mostrare un avviso esplicito (es. "costo incompleto per N righe") invece di sommare 0 in silenzio.

### 26. Ricavi conto vendita: liquidazioni parziali sparite e CV chiusi valorizzati a totOrdine

- **Dove:** `index.html:4717`
- **Area:** Costificazione FIFO / costo medio ponderato

Due difetti simmetrici: (1) per i CV non "pagato", `importoLiquidazione` viene sottratto da cvInCorso (riga 4718) ma non è sommato né a cvLiquidato né a ricaviTotali → i dati reali lo dimostrano: l'ordine o20 (riga 4204, statoPagamento "parziale", importoLiquidazione 641,37 €) sparisce completamente dai ricavi di campagna. (2) Quando un CV passa a "pagato", cvLiquidato somma `totOrdine(o)` (intero valore consegnato) invece di importoLiquidazione: se parte delle bottiglie è stata resa (movimenti resa_cv), i ricavi sono sovrastimati della quota resa.

**Fix proposto:** Per i CV non pagati sommare `Math.min(importoLiquidazione, totOrdine)` a un ricavo "CV liquidato parziale" incluso in ricaviTotali; per i CV "pagato" usare `o.importoLiquidazione != null ? o.importoLiquidazione : totOrdine(o)` come ricavo liquidato.

### 27. Costo dei pezzi omaggio escluso dal costo variabile

- **Dove:** `index.html:4725`
- **Area:** Costificazione FIFO / costo medio ponderato

Il costo variabile del P&L è `(r.qta || 0) * costoFormatoTot(...)`, ma i pezzi omaggio escono fisicamente dal magazzino esattamente come i venduti (generaMovimentiOrdine scarica `qta + omaggio`, righe 2742-2753). Un ordine promo "1+1" con omaggio: 8 (es. righe 4014, 4071, 4090, 4109 nei dati reali) sostiene il costo pieno di 16 bottiglie ma il P&L ne conteggia 8 → costo variabile sottostimato e margine lordo/netto sovrastimato. Stesso difetto a riga 4730 (costo CV in corso), 4783 (margine cliente) e 16824 (tab Per Ordine).

**Fix proposto:** Usare `((Number(r.qta)||0) + (Number(r.omaggio)||0)) * costoFormatoTot(r.formato, dati)` in tutti i punti dove si calcola il costo variabile di una riga ordine (righe 4725, 4730, 4783, 16824).

### 28. Nessuna data di scadenza/TMC registrabile su lotti e SKU, nessun alert di scadenza prodotto

- **Dove:** `index.html:2052`
- **Area:** Scadenze e rotazione

Il modello dati del lotto definito in migrateV50Produzione (righe 2052-2063: stato, resa, dataImbottigliamento, dataEtichettatura, qualita, costi, codLotto, certificazioni) non prevede alcun campo scadenza/TMC, e nemmeno lo SKU di magazzino (saveSku, righe 13228-13242: formato, prodotto, soglia, prezzoListino, giacenza). Una ricerca di 'scad' nelle sezioni Magazzino (13026+) e Produzione (14387+) non produce alcun risultato. Di conseguenza il centro Alert (l'elenco documentato a riga 25594 conferma: CV, contratti, follow-up, soglia magazzino) non può generare alcun avviso per lotti prossimi alla scadenza o scaduti: per un'azienda alimentare (olio/aceto/vino) il gestionale non traccia in alcun punto il termine minimo di conservazione dei prodotti in giacenza.

**Fix proposto:** Aggiungere il campo dataScadenza (o TMC) al lotto e/o all'imbottigliamento (in etichetta il TMC è per imbottigliamento), mostrarlo nelle card Produzione/Magazzino e generare alert 'lotto in scadenza entro N gg' e 'lotto scaduto ancora in giacenza' nel centro Alert.

### 29. Annate hardcoded ['2025','2024'] nei form ordine: la rotazione verso l'annata nuova è impossibile senza modifica al codice

- **Dove:** `index.html:11199`
- **Area:** Scadenze e rotazione

La riga ordine viene creata con `annata: "2025"` fissa (addRiga, riga 11138), il selettore annata usa `const ANNATE = ["2025", "2024"]` (riga 11199), il wizard ordini `WIZ_ANNATE = ["2025", "2024"]` (riga 8175) e la const LISTINO ha `annata: "2025"` per ogni formato (es. riga 5436). Poiché skuPerRiga (riga 2643+) risolve lo SKU di magazzino per match formato+annata, alla raccolta 2026 i nuovi SKU annata '2026' non saranno selezionabili in nessun ordine: le righe continueranno a puntare (e scaricare) gli SKU 2025 finché non si modifica il sorgente. Inoltre il default fisso non tiene conto della giacenza: non c'è alcuna logica che proponga l'annata più vecchia ancora disponibile (rotazione), né un avviso se si vende l'annata nuova mentre resta stock della vecchia.

**Fix proposto:** Derivare la lista annate dinamicamente dai dati (annate presenti in dati.magazzino/dati.lotti, ordinate) e proporre come default l'annata più vecchia con giacenza disponibile > 0 per il formato scelto, segnalando quando si seleziona un'annata più recente con stock residuo della precedente.

### 30. Formati monodose degli ordini non combaciano con gli SKU di magazzino

- **Dove:** `index.html:11198`
- **Area:** Anagrafica prodotti

I dropdown delle righe ordine (index.html:11198, wizard 8174, preventivi 23881) usano i formati "Olio 20 ml" e "Aceto 20 ml", ma gli SKU di magazzino seed m8/m9 (index.html:3023 e 3040) hanno formato "20 ml". skuPerRiga risolve lo SKU solo per formato+annata (con normalizzazione che NON copre questo caso), quindi ogni ordine monodose finisce in errore "SKU non trovato" e il salvataggio in stato da_firmare / la firma vengono bloccati (check a index.html:10769 e 20711). Anche PreventiviTab (getD a 23888) non trova la disponibilità. Il workaround naturale dell'utente (creare un nuovo SKU "Olio 20 ml") duplica la giacenza su due SKU.

**Fix proposto:** Uniformare la nomenclatura: rinominare i formati degli SKU seed in "Olio 20 ml"/"Aceto 20 ml" (o viceversa) e aggiungere in skuPerRiga una normalizzazione che mappa le varianti (es. tabella alias formato), con migrazione idempotente sui dati esistenti in localStorage.

### 31. Auto-prezzo assente per i formati 20 ml: la riga resta a 19,50 €

- **Dove:** `index.html:5584`
- **Area:** Anagrafica prodotti

getPrezzoListino fa LISTINO[formato] (index.html:5584), ma LISTINO ha la chiave "20 ml" mentre i form ordine passano "Olio 20 ml"/"Aceto 20 ml" → ritorna null. Nei form (index.html:8194 e 11157) `if (p) r.prezzoUnitario = p` non aggiorna nulla: selezionando un formato monodose il prezzo resta silenziosamente quello precedente (default riga 19,50 €, il prezzo del 500 ml) invece di 2,00 €. Anche l'annata non viene auto-impostata (LISTINO[fmt] undefined a 8197/11160) e il placeholder colli usa pezziCollo=1 (8268, 11925). Rischio concreto di ordini monodose emessi a prezzo quasi 10× quello di listino se l'operatore non corregge a mano.

**Fix proposto:** Aggiungere in LISTINO le chiavi "Olio 20 ml" e "Aceto 20 ml" (o una funzione di normalizzazione formato → chiave listino usata da getPrezzoListino/getScaglioneLabel), così auto-prezzo, annata e colli funzionano anche per i monodose.

### 32. getPrezzoListino ignora il listino editabile (dati.listino)

- **Dove:** `index.html:5583`
- **Area:** Anagrafica prodotti · Coerenza generale del codice

Dalla v52 esiste il listino editabile dati.listino (popolato dalla migrazione a index.html:2240 e modificabile da ListinoPage, salvataggio a 25833), e getListino (5551) lo legge correttamente. Ma getPrezzoListino (5583-5592), usato per l'auto-fill del prezzo nelle righe ordine e nel wizard, legge SOLO la const hardcoded LISTINO: se l'utente aggiorna un prezzo da ListinoPage, gli ordini continuano a proporre il prezzo vecchio hardcoded, senza alcun avviso. Stesso problema per getScaglioneLabel (5593).

**Fix proposto:** Far passare getPrezzoListino (e getScaglioneLabel) da getListino(formato, dati) con fallback alla const LISTINO, propagando `dati` dai call site (8194, 11157, 11167).

*Nota verifica: segnalato indipendentemente da 2 auditor.*

*Aspetto aggiuntivo («Auto-prezzo ordini legge la const LISTINO hardcoded ignorando il listino editabile dati.listino», `index.html:5584`):* getPrezzoListino (riga 5583) e la lettura dell'annata (LISTINO[fmt] a righe 8196 e 11160) usano SOLO la costante hardcoded LISTINO. Ma dalla v52 esiste il listino editabile dati.listino (ListinoPage, riga 25776) e l'helper unificato getListino (riga 5551) che lo legge con fallback. Risultato: se l'utente aggiorna un prezzo dalla pagina Listino, l'auto-compilazione del prezzo unitario nel form Ordini (righe 11157 e 11167) e nel wizard Pipeline (riga 8194) continua a inserire i prezzi vecchi hardcoded, mentre i margini in CostiMargini usano getListino → prezzi incoerenti tra moduli con impatto economico diretto sugli ordini.

*Fix:* Far passare getPrezzoListino (e la lettura di annata/pezziCollo nei form) da getListino(formato, dati), aggiungendo il parametro dati ai call site (8194, 11157, 11167); mantenere la const LISTINO solo come fallback dentro getListino.

### 33. PDF ordine: pezziCollo 12 per il 100 ml, ma il collo è da 16 pezzi

- **Dove:** `index.html:9387`
- **Area:** Anagrafica prodotti

LISTINO_PDF dichiara "100 ml|2025": pezziCollo 12 (index.html:9387), ma il collo reale del 100 ml è da 16 pezzi: LISTINO "100 ml" ha pezziCollo 16 e scaglione 1 collo = 16 pz × 9,00 € = 144 € (5488-5493), lo stesso 144 € dello scaglione 1 di LISTINO_PDF. Nel PDF Vendita/CV i colli sono calcolati come qta/pezziCollo (9619-9622): un ordine da 16 pz di 100 ml stampa "1,33" colli invece di 1, e 32 pz stampa "2,67" invece di 2 — documento ufficiale consegnato al cliente/spedizioniere con numero colli errato, mentre la UI (placeholder a 8268/11925) mostra il valore corretto con 16.

**Fix proposto:** Correggere pezziCollo a 16 nella entry "100 ml|2025" di LISTINO_PDF, o meglio derivare pezziCollo da un'unica fonte (getListino) invece di duplicarlo in LISTINO_PDF.

### 34. PDF ordine: colli = numero pezzi per i formati monodose

- **Dove:** `index.html:9614`
- **Area:** Anagrafica prodotti

Il PDF Vendita/CV cerca il listino con chiave formato+"|"+annata (index.html:9613-9614), ma LISTINO_PDF ha solo "20 ml|2025" (9388) mentre le righe ordine hanno formato "Olio 20 ml"/"Aceto 20 ml" → lookup fallito → pezziCollo=1 (9619) → sul documento i colli stampati coincidono con i pezzi: un ordine da 100 monodose stampa "100" colli invece di 2. Il commento a 9617-9618 prevede pezziCollo=1 solo per le latte 3L/5L, non per i monodose.

**Fix proposto:** Aggiungere le chiavi "Olio 20 ml|2025" e "Aceto 20 ml|2025" a LISTINO_PDF (o normalizzare il formato prima del lookup, riusando la stessa mappa alias proposta per skuPerRiga/LISTINO).

### 35. Cambio stato da dropdown a Consegnato/Fatturato salta del tutto lo scarico magazzino

- **Dove:** `index.html:2843`
- **Area:** Documenti e flussi

Il campo "Stato ordine" nel form (Sel riga 11777) permette di portare un ordine da "da_firmare" direttamente a "consegnato" o "fatturato". saveOrdine chiama applicaTransizioneOrdineMagazzino, che però gestisce SOLO le transizioni verso "firmato" (riga 2843) e verso "annullato" (riga 2855): per da_firmare→consegnato non viene generato alcun movimento scarico_ordine né eseguito il check disponibilità (richiedeCheckStock è false, riga 10762). Un ordine non-pregresso registrato così risulta consegnato ma la giacenza non viene mai decrementata, e un eventuale annullo successivo non trova scarichi da compensare.

**Fix proposto:** In applicaTransizioneOrdineMagazzino trattare come "attraversamento di firmato" ogni transizione da uno stato pre-firmato (da_firmare/null) a uno stato ≥ firmato (firmato, consegnato, fatturato), generando lo scarico; oppure vincolare il dropdown a transizioni adiacenti del FLUSSO_ORDINE.

*Nota verifica: severità riclassificata dal verificatore da *critica* a *alta*.*

### 36. L'annullamento cancella i DDT/fatture da Storage ma i movimenti in Archivio DDT li referenziano ancora

- **Dove:** `index.html:11006`
- **Area:** Documenti e flussi

annullaOrdineDiretto (righe 11003-11010, e gli altri percorsi di annullo a 10888 e 12638) cancella definitivamente da Supabase Storage i file DDT e fatture dell'ordine. Ma i movimenti scarico_ordine esistenti conservano ddtDoc con il path cancellato, e i nuovi movimenti annullo_ordine lo copiano (righe 2870-2871). L'Archivio DDT mostra quindi il bottone "🚚 Apri" (riga 14030) su documenti che non esistono più → errore all'apertura e perdita irreversibile del documento di trasporto di una consegna realmente avvenuta (un ordine "consegnato" è annullabile, riga 12078).

**Fix proposto:** Non cancellare i file DDT/fatture da Storage all'annullamento (o farlo solo se nessun movimento li referenzia): marcare l'ordine annullato mantenendo l'archivio documentale, ed eventualmente spostare i file in un prefisso "annullati/".

### 37. Il blocco "niente consegna senza DDT" è in updateStato, che è codice morto

- **Dove:** `index.html:10871`
- **Area:** Documenti e flussi

updateStato (riga 10871) contiene l'unica applicazione della regola di proprietà per gli ordini: blocca la transizione a consegnato/fatturato se non c'è almeno un DDT allegato (righe 10880-10885). Ma updateStato non è mai chiamato da nessuna parte (nessun call-site nel file): le transizioni reali passano da confermaTransizioneOrdine/updateStatoForm e dal dropdown stato, che non hanno alcun controllo — il wizard dice esplicitamente "Nessun DDT caricato. Procedi senza" (riga 12856). Risultato: la merce può risultare consegnata senza alcun DDT né nota, in contrasto con la regola imposta invece ai movimenti manuali di magazzino (riga 13191).

**Fix proposto:** Spostare il controllo DDT (o almeno DDT/nota manuale) dentro confermaTransizioneOrdine e nella validazione di saveOrdine per stato consegnato/fatturato, quindi rimuovere updateStato morto.

### 38. Liquidazione CV: 'Bottiglie rese' senza tetto massimo genera carichi magazzino fantasma

- **Dove:** `index.html:11110`
- **Area:** Validazione e input utente

In saveCv (riga 11102-11133) l'unico controllo è su importoLiquidazione > 0. Il campo 'Bottiglie rese' (input a riga 11601-11608, Number(v) senza vincoli) non viene mai confrontato con le bottiglie effettivamente consegnate nell'ordine. Un refuso (es. 500 invece di 50) produce deltaRese positivo e generaMovimentiResaCv (riga 2781) crea movimenti 'resa_cv' che aumentano la giacenza 'disponibile' di pezzi mai esistiti. La giacenza risulta gonfiata in modo permanente (il movimento resta nel log event-sourced) e i controlli di stock sugli ordini successivi accettano vendite di merce inesistente. Anche 'Bottiglie vendute' non ha alcuna validazione (accetta negativi).

**Fix proposto:** In saveCv validare: bottiglieRese >= 0, bottiglieVendute >= 0 e (bottiglieVendute + bottiglieRese) <= totale pezzi consegnati dell'ordine (somma qta+omaggio delle righe). Bloccare il salvataggio con messaggio esplicito se il vincolo è violato, o chiedere conferma esplicita mostrando il delta che verrà caricato in magazzino.

### 39. ROLE_READONLY dichiarato per 4 moduli ma applicato solo a Magazzino

- **Dove:** `index.html:19166`
- **Area:** Autenticazione e permessi

`ROLE_READONLY.commerciale = ["magazzino","produzione","fornitori","costi"]` (riga 19605), ma la prop `readonly: isReadonly(...)` viene passata solo a `Magazzino` (riga 19164). `Produzione` (riga 19166), `Fornitori` (19170) e `CostiMargini` (19174) non ricevono alcuna prop readonly e nel loro codice non c'è alcun controllo: un utente `commerciale` che raggiunge quei moduli (via hash, vedi finding sul routing) ha piena capacità di scrittura e cancellazione (elimina lotto riga 15712, elimina fornitore riga 16606), vanificando la restrizione dichiarata.

**Fix proposto:** Passare `readonly: isReadonly("produzione")` / `isReadonly("fornitori")` / `isReadonly("costi")` ai rispettivi componenti e usare la prop per nascondere/disabilitare i pulsanti di salvataggio ed eliminazione, come già fatto in Magazzino (righe 13326, 13605, 14372).

### 40. Ogni modifica serializza e trasmette l'INTERO stato applicativo

- **Dove:** `index.html:18651`
- **Area:** Performance

setDatiSave (righe 18641-18673) esegue JSON.stringify(next) dell'intero oggetto dati (tutti gli ordini, clienti, prospect, magazzino, movimenti, tickets, storico) a OGNI singola modifica — anche per un cambio di stato pagamento da select (riga 11196) — e lo POSTa per intero a Supabase (chiave unica "tnb-pro-v2"); window.storage.set inoltre riscrive sincronicamente l'intero JSON in localStorage (riga 714) bloccando il main thread. Il documento cresce senza limite con lo storico (movimenti magazzino, tickets con commenti, righe/consegne ordini): ogni azione quotidiana diventa progressivamente più lenta e più costosa in rete. L'esistenza stessa della strumentazione window.__tnbSavePerf con warning "salvataggio lento" (riga 18660) conferma che il problema si manifesta in produzione.

**Fix proposto:** Spartire lo stato su chiavi Supabase separate per modulo (es. tnb-ordini, tnb-movimenti, tnb-tickets) e salvare solo la chiave modificata; in alternativa introdurre un debounce (500-1000 ms) con coalescing dei salvataggi e spostare la scrittura localStorage in requestIdleCallback. Le collezioni append-only (movimenti, tickets) andrebbero su tabelle Supabase con INSERT di singole righe.

### 41. Import backup: il try/catch sul persist è irraggiungibile e il messaggio di successo può mentire

- **Dove:** `index.html:25204`
- **Area:** Gestione errori e stati vuoti

Nell'import del backup JSON il codice fa 'await window.storage.set(...)' dentro try/catch (righe 25203-25208) proprio per evitare — come dice il commento — che il persist fallisca in silenzio, e poi mostra '✅ Import completato e persistito su Supabase' (riga 25218). Ma storage.set non lancia mai eccezioni (inghiotte l'errore e ripiega su localStorage, riga 716): il catch con il toast '❌ Errore persist Supabase' non può scattare. Se Supabase è giù durante un import, l'utente riceve conferma di persistenza remota mentre i dati importati esistono solo nel browser corrente: al refresh da un altro dispositivo tornano i dati pre-import.

**Fix proposto:** Dopo l'await, verificare un esito esplicito del salvataggio remoto (vedi fix su storage.set: campo remoteOk o eccezione rilanciata) e, se il persist remoto non è riuscito, interrompere l'import con il messaggio d'errore già previsto invece di proseguire con il toast di successo.

### 42. "Registra movimento" magazzino: click senza effetto e senza alcun messaggio se mancano campi obbligatori

- **Dove:** `index.html:13188`
- **Area:** Accessibilità e usabilità

In `saveMov` la prima guardia è `if (!form.magId || !form.tipo || !form.qta) return;` (riga 13188): se l'operatore non ha selezionato lo SKU, il tipo movimento o ha lasciato vuota la quantità, il click su "Registra movimento" (riga 14251) non fa letteralmente nulla — nessun toast, nessun alert, nessun bordo rosso. Nel flusso quotidiano di carico/scarico un utente non tecnico resta a cliccare un pulsante "rotto" senza capire cosa manca (l'alert a riga 13189 scatta solo per qta ≤ 0 digitata, non per qta vuota). Stesso pattern in `saveSku` (riga 13229, `if (!form.formato || !form.prodotto) return;`) e in `saveOF` fornitori (riga 15954, `if (!form.fornitoreId) return;`). Inoltre il salvataggio riuscito del movimento non mostra alcun toast di conferma (righe 13224-13226), a differenza delle rettifiche (riga 13141).

**Fix proposto:** Sostituire i return silenziosi con un toast di errore esplicito che elenca i campi mancanti (come già fa `saveOrdine` alle righe 10683-10687, con `setFormErrors` + toast "err") e aggiungere un toast di conferma dopo la registrazione del movimento (es. "✅ Movimento registrato: -12 pz Olio 500ml").

### 43. La guida promette un blocco Consegnato/Fatturato senza DDT che nell'app non esiste

- **Dove:** `docs/Guida-DDT-Magazzino.md:86`
- **Area:** Guide e testi

La guida afferma che l'ordine "non può passare a « Consegnato » o « Fatturato » se non è stato allegato almeno un DDT" (stessa promessa nella guida in-app, index.html:25559). In realtà il controllo esiste solo in `updateStato` (index.html:10880-10886), funzione MAI chiamata da nessun punto del codice (dead code). Il flusso reale passa dal wizard `confermaTransizioneOrdine`/`updateStatoForm` (index.html:10958/10919), che non fa alcun controllo e anzi mostra il testo "Nessun DDT caricato. Procedi senza, oppure usa le note manuali sotto." (index.html:12856). Un operatore può quindi marcare Consegnato/Fatturato senza alcun DDT, mentre la guida gli garantisce che il sistema lo bloccherebbe: la 'regola della proprietà' documentata come vincolo duro è in pratica facoltativa.

**Fix proposto:** Decidere con la proprietà quale comportamento è quello voluto: (a) reintrodurre il controllo DDT dentro `confermaTransizioneOrdine` (o all'apertura del wizard), oppure (b) correggere docs/Guida-DDT-Magazzino.md §6 e la sezione magazzino di GUIDA_CONTENUTI (index.html:25559) spiegando che il DDT è raccomandato ma il wizard permette di procedere con sole note manuali.

### 44. pezziCollo contraddittori tra LISTINO e LISTINO_PDF: colli diversi a video e sul PDF

- **Dove:** `index.html:9385`
- **Area:** Coerenza generale del codice

LISTINO dichiara pezziCollo 8 per '500 ml' (riga 5438) e 16 per '100 ml' (riga 5488); LISTINO_PDF dichiara 12 per entrambi (righe 9385, 9387). Il placeholder 'auto' dei colli nei form usa LISTINO (righe 8268, 11925), mentre il PDF calcola i colli con LISTINO_PDF (riga 9619): un ordine di 8 bottiglie da 500 ml appare come 1 collo a video ma viene stampato come '0,67' colli sul documento consegnato al cliente. I prezzi a collo di LISTINO_PDF stessi (156 € = 8 × 19,50 €) presuppongono un collo da 8, contraddicendo il suo pezziCollo 12.

**Fix proposto:** Definire un'unica fonte per pezziCollo (idealmente dati.listino/getListino), correggere i valori errati in LISTINO_PDF (500 ml → 8, 100 ml → 16, coerenti con gli scaglioni prezzo) e far leggere sia i placeholder UI sia il PDF dalla stessa fonte.

---

## Severità 🟡 Media (58 finding)

### 45. BarChartSVG: barre raggruppate si sovrappongono ai gruppi adiacenti

- **Dove:** `index.html:984`
- **Area:** Pagine e componenti UI

In BarChartSVG la larghezza per singola barra è calcolata come `totalBarW = bars.length * bw / bars.length` che equivale a `bw` (cioè il 70% dell'intero gruppo), e la x di ogni barra è `PL + i*groupW + bi*totalBarW + gap/2` (riga 990). Con più serie, la seconda barra parte a 0,85·groupW e la terza arriva fino a 2,25·groupW: le barre invadono i gruppi dei formati successivi. L'unico utilizzo reale è il grafico 'CONFRONTO PREZZO / COSTO / MARGINE' in CostiMargini (riga 17856) con 3 serie (prezzo/costo/margine): le barre di un formato finiscono sotto l'etichetta del formato vicino, rendendo il grafico illeggibile e fuorviante per le decisioni di prezzo.

**Fix proposto:** Dividere lo spazio del gruppo tra le serie: `const barW = bw / bars.length;` e `const x = PL + i*groupW + gap/2 + bi*barW;`, usando `barW` anche per width e per la x del testo del valore.

*Nota verifica: severità riclassificata dal verificatore da *alta* a *media*.*

### 46. CostiMargini 'Per Ordine' include gli ordini annullati nell'analisi margini

- **Dove:** `index.html:16819`
- **Area:** Pagine e componenti UI

In CostiMargini l'analisi per ordine filtra solo per modalità (`o.modalita === "vendita" || (includiCV && o.modalita === "conto_vendita")`) senza escludere `stato === "annullato"`. Ricavi, costi e margini di ordini annullati entrano nella classifica per margine e nei totali del tab 'Per Ordine', gonfiando ricavo e margine mostrati rispetto alla Dashboard (che esclude gli annullati a riga 6136).

**Fix proposto:** Aggiungere il filtro stato: `dati.ordini.filter(o => o.stato !== "annullato" && (o.modalita === "vendita" || (includiCV && o.modalita === "conto_vendita")))`.

*Nota verifica: severità riclassificata dal verificatore da *alta* a *media*.*

### 47. Contatore 'Distribuzione' sempre a 0 in Clienti e ClientiCommerciale (valore tipo errato)

- **Dove:** `index.html:8529`
- **Area:** Pagine e componenti UI · Coerenza generale del codice

Il PageSummary della pagina Clienti conta `c.tipo === "distribuzione"`, ma il tipo cliente reale è `"distributore"` ovunque: TIPI a riga 8511, opzioni del filtro a riga 8518, form di modifica a riga 21455 e dati seed (riga 3646). Il contatore 'Distribuzione' mostra quindi sempre 0 anche con distributori in anagrafica. Stesso identico bug in ClientiCommerciale a riga 21242.

**Fix proposto:** Usare il valore corretto in entrambi i punti: `dati.clienti.filter(c => c.tipo === "distributore").length` (righe 8529 e 21242), eventualmente mantenendo l'etichetta 'Distribuzione'.

*Nota verifica: segnalato indipendentemente da 2 auditor.*

*Aspetto aggiuntivo («Chiave 'distributore' vs 'distribuzione' incoerente su cliente.tipo», `index.html:8529`):* Il form clienti e i filtri usano il valore 'distributore' (righe 8511, 8518, 21455, e il seed dati a riga 3646), ma il KPI 'Distribuzione' a riga 8529 (e la copia a riga 21242) conta c.tipo === 'distribuzione' → risulta SEMPRE 0. Inoltre calcolaMargineCanale (riga 4799, CANALI = ['horeca','retail','distribuzione','altro']) non riconosce 'distributore': tutti i clienti distributori (e i 'privato') finiscono nel canale 'Altro' nell'analisi margini per canale di CostiMargini, e il badge a riga 17236 (CANALE_LABEL[c.tipo]) mostra la chiave grezza senza label né colore.

*Fix:* Unificare la chiave: scegliere 'distribuzione' (già usata da CANALE_LABEL/CANALE_COLOR e calcolaMargineCanale) o 'distributore', aggiornare form/filtri/KPI di conseguenza e aggiungere una piccola migrazione idempotente che rinomina il valore sui clienti esistenti. Valutare anche una voce dedicata per 'privato' invece di farlo confluire in 'altro'.

### 48. Badge 'Fornitore collegato — click per aprire' in CostiMargini non apre il fornitore

- **Dove:** `index.html:17543`
- **Area:** Pagine e componenti UI

Il click imposta `window._tnbNav = { fornitoreId: fornitore.id }` e naviga al modulo Fornitori, ma il componente Fornitori (righe 15750+) non ha alcun useEffect che legga `_tnbNav.fornitoreId` (i consumer esistenti gestiscono solo targetId, tab, soloSottoSoglia, targetLottoId/targetBottigliaId/prodTab, targetContrattoId). Risultato: si apre la lista fornitori generica senza selezionare il fornitore promesso dal tooltip, e `window._tnbNav` resta valorizzato finché un altro modulo non lo consuma/azzera.

**Fix proposto:** Aggiungere in Fornitori un useEffect analogo a quello di Produzione (riga 14419): se `window._tnbNav.fornitoreId` esiste, aprire il dettaglio (`setForm(f); setModal("edit")` o equivalente) e azzerare `window._tnbNav`.

### 49. ClienteAutocomplete non trova i clienti cercando per ragione sociale se l'insegna è valorizzata

- **Dove:** `index.html:10368`
- **Area:** Pagine e componenti UI

Il filtro della tendina usa `(c.insegna || c.ragioneSociale || "").toLowerCase().includes(q)`: se un cliente ha l'insegna compilata, la ragione sociale non viene mai considerata nella ricerca. Nel wizard ordini chi digita la ragione sociale (es. quella in fattura, diversa dall'insegna del locale) ottiene 'Nessun cliente trovato' anche se il cliente esiste, con rischio di creare doppioni in anagrafica.

**Fix proposto:** Cercare su entrambi i campi: `.filter(c => (c.insegna || "").toLowerCase().includes(q) || (c.ragioneSociale || "").toLowerCase().includes(q))`.

### 50. Auto-reload al rientro sulla tab non controlla i salvataggi in corso né i modali aperti

- **Dove:** `index.html:26194`
- **Area:** Hooks e logica di stato

Il watcher di auto-update ricarica la pagina al visibilitychange/focus se c'è un deploy pendente, proteggendosi solo con staScrivendo() (document.activeElement è un input). Non controlla se una POST di salvataggio è in volo (stato `saving`) né se c'è un modal con una bozza non salvata ma senza focus su un input (caso tipico: si compila un ordine, si cambia tab per copiare un dato, si torna → reload immediato). location.reload() abortisce la POST in corso e/o butta la bozza del modal.

**Fix proposto:** Esporre flag globali (es. window._tnbSaving impostato da setDatiSave e window._tnbModalOpen dai modali) e verificarli in controlla() prima di chiamare ricarica(); in alternativa posticipare il reload finché saving è true o un modal è montato.

### 51. Effetti collaterali (setState e POST di rete) dentro la funzione updater di setDati

- **Dove:** `index.html:18649`
- **Area:** Hooks e logica di stato

setDatiSave esegue setSaving(true), JSON.stringify, la POST window.storage.set e la mutazione di window._tnbAzienda DENTRO l'updater passato a setDati. Gli updater React devono essere puri: React può rieseguirli (StrictMode, render interrotti/ripresi in React 18), producendo POST duplicate verso Supabase con stati intermedi; inoltre setSaving chiamato durante la fase di render di un altro componente è il pattern che genera 'Cannot update a component while rendering a different component' e rende il flusso di salvataggio non deterministico.

**Fix proposto:** Rendere puro l'updater: calcolare `next` e restituirlo; spostare persistenza, setSaving e aggiornamento di window._tnbAzienda in un useEffect dipendente da `dati` (con ref per saltare il primo run) oppure eseguirli dopo la setDati, fuori dall'updater.

### 52. Fetch streaming del Report AI senza AbortController né guardia di smontaggio

- **Dove:** `index.html:22483`
- **Area:** Hooks e logica di stato

generaReport avvia una fetch streaming verso /.netlify/functions/report-ai e pompa i chunk con setReport in loop. Se l'utente cambia modulo durante la generazione (che può durare decine di secondi), il componente si smonta ma lo stream continua in background: la chiamata AI (a pagamento) viene consumata per intero, il report è perso (lo state riparte vuoto al remount, storicoReport compreso perché mai persistito) e i toast di esito/errore compaiono comunque fuori contesto.

**Fix proposto:** Creare un AbortController per richiesta, passare il signal alla fetch e abortire nel cleanup di un useEffect di smontaggio; in più salvare storicoReport in modo persistente (o in uno stato sollevato in App) così il risultato sopravvive alla navigazione.

### 53. Streaming SSE: eventi 'error' e stop_reason di Anthropic ignorati → report troncato consegnato come completo

- **Dove:** `netlify/functions/report-ai.mjs:132`
- **Area:** Backend / edge functions · Gestione errori e stati vuoti

Il parser dello stream inoltra solo gli eventi 'content_block_delta' con delta.text (riga 132). Gli eventi SSE 'error' che Anthropic può emettere a metà stream (es. overloaded_error) e i 'message_delta' con stop_reason 'max_tokens' (probabile con max_tokens=2500 su dataset grandi) vengono scartati in silenzio e lo stream si chiude normalmente. Il frontend (finalizzaReport, riga 22527) riceve il testo parziale, lo salva nello storico e mostra '✅ Report generato': l'utente ottiene un report interrotto a metà frase credendolo completo, senza alcun indizio dell'errore.

**Fix proposto:** Nel loop di parsing gestire evt.type === 'error' (accodare un marcatore visibile tipo '\n\n[ERRORE: generazione interrotta — riprovare]' o chiudere lo stream con controller.error) e intercettare message_delta.stop_reason === 'max_tokens' aggiungendo in coda una nota '[Report troncato per limite di lunghezza]'.

*Nota verifica: segnalato indipendentemente da 2 auditor.*

*Aspetto aggiuntivo («Report AI: eventi di errore nello stream Anthropic ignorati — report troncato presentato come completato», `netlify/functions/report-ai.mjs:132`):* Il filtro sullo stream SSE (righe 125-135) inoltra al client solo gli eventi content_block_delta; gli eventi 'error' che Anthropic può emettere a metà stream (es. overloaded_error) e il caso stop_reason='max_tokens' (limite 2500 token, riga 91) vengono scartati in silenzio e lo stream si chiude come se fosse finito regolarmente. Lato client (index.html riga 22510) finalizzaReport marca il testo parziale con '✅ Report generato' e lo salva nello storico: l'utente ottiene un report troncato credendolo completo, senza alcun errore.

*Fix:* Nel loop SSE intercettare evt.type === 'error' (inoltrando al client un marker riconoscibile, es. '\n[ERRORE: ...]', o chiudendo lo stream con controller.error) e gestire message_delta con stop_reason='max_tokens' aggiungendo una nota di troncamento; lato client rilevare il marker e mostrare un toast d'errore invece del messaggio di successo.

### 54. Nessun timeout/AbortController su alcuna fetch: una richiesta appesa blocca il caricamento dell'app

- **Dove:** `index.html:689`
- **Area:** Backend / edge functions

Nessuna delle fetch del layer Supabase (get riga 689, set 707, upload 762/825, sign 788) né la chiamata a report-ai (22483) usa AbortController o timeout. Il fallback localStorage di storage.get scatta solo se la promise viene RIGETTATA: se la connessione resta semplicemente appesa (rete mobile instabile, proxy, captive portal), la GET di boot su 'tnb-pro-v2' (riga 18588) non si risolve mai, setDati non viene mai chiamata e l'app resta bloccata sulla schermata di caricamento a tempo indefinito, pur avendo una copia locale valida dei dati. Stesso problema sugli upload firma/DDT: lo spinner resta attivo per sempre senza messaggio.

**Fix proposto:** Introdurre un helper fetchWithTimeout(url, opts, ms) basato su AbortController (es. 15s per le REST app_kv, 30-60s per gli upload) e usarlo in tutte le chiamate del layer storage; sul timeout della GET di boot attivare lo stesso fallback localStorage già previsto per gli errori.

### 55. Modifica delle righe di un ordine già firmato non adegua gli scarichi (nessun avviso)

- **Dove:** `index.html:10762`
- **Area:** Integrità dati magazzino

Per ordini già firmati/consegnati/fatturati saveOrdine dichiara (commento righe 10760-10761) e implementa (richiedeCheckStock, righe 10762-10766) che nessun check e nessuna rigenerazione scarichi avviene: aumentare una riga da 10 a 20 pz lascia in magazzino lo scarico storico di 10, senza alcun avviso né rettifica proposta. La giacenza diverge dal venduto reale e l'annullo successivo riaccredita solo le quantità vecchie. È un comportamento voluto ma completamente silenzioso, quindi nei flussi quotidiani produce giacenze sbagliate difficili da individuare.

**Fix proposto:** Al salvataggio di un ordine firmato con righe cambiate, confrontare le quantità con gli scarichi esistenti per ordineId e proporre movimenti di rettifica/scarico integrativo (o almeno un toast di avviso con il delta non scaricato).

### 56. Movimenti retrodatati: timestamp=Date.now() ignora la data inserita nel form

- **Dove:** `index.html:13208`
- **Area:** Integrità dati magazzino

saveMov permette di scegliere una data passata (riga 13196: `form.data || todayStr()`) ma assegna sempre `timestamp: Date.now()` (riga 13208). Sia l'ordinamento del replay in ricalcolaGiacenza (righe 2546-2548) sia il filtro storico di giacenzaAllaData (riga 2623) privilegiano il timestamp numerico: un carico dimenticato registrato oggi con data della settimana scorsa non compare nella vista 'giacenza al' di quella data (che però lo mostra nell'elenco movimenti filtrato per mv.data) e viene replayato in coda anziché nella posizione cronologica dichiarata — con i clamp questo può cambiare il risultato del ricalcolo.

**Fix proposto:** Se form.data è diversa da oggi, derivare il timestamp dalla data inserita (es. mezzogiorno locale di quel giorno + offset progressivo) così che replay e viste storiche rispettino la data dichiarata.

### 57. Migrazione v49: movimenti legacy dello stesso giorno replayati in ordine inverso

- **Dove:** `index.html:1960`
- **Area:** Integrità dati magazzino

migrateV49Magazzino assegna ai movimenti senza timestamp `ts = new Date(dataStr).getTime()` (righe 1958-1960): tutti i movimenti legacy dello stesso giorno hanno timestamp identico. Il sort di ricalcolaGiacenza è stabile e i movimenti sono storicamente inseriti in testa all'array (più recenti prima), quindi a parità di timestamp il replay avviene in ordine inverso rispetto alla cronologia reale. Con i clamp l'ordine conta: es. stesso giorno carico 10 poi scarico 10 → replay inverso esegue prima lo scarico (clampato a 0) poi il carico → disponibile 10 invece di 0.

**Fix proposto:** In migrazione, assegnare timestamp crescenti ai movimenti dello stesso giorno rispettando l'ordine cronologico originale (es. ts base del giorno + indice decrescente dalla coda dell'array, dato che l'array è newest-first).

### 58. verificaDisponibilitaOrdine legge la giacenza memorizzata, non il ricalcolo dai movimenti

- **Dove:** `index.html:2720`
- **Area:** Integrità dati magazzino

Il check di stock alla firma usa `sku.giacenza.disponibile` (riga 2720), cioè il valore cache in m.giacenza, mentre gli scarichi vengono poi applicati con ricalcolaGiacenza dal log movimenti (riga 2885). L'audit al mount del Magazzino (righe 13056-13077) rileva le divergenze ma non corregge (solo console.warn + bottone manuale '🔄 Ricalcola'): quando la cache è sovrastimata (es. per i bug di riconciliazione apertura o dopo un import/backup), si possono firmare ordini oltre lo stock reale che il ricalcolo poi clampa, innescando la catena di stock fantasma.

**Fix proposto:** In verificaDisponibilitaOrdine calcolare il disponibile con ricalcolaGiacenza(movimentiSku(dati.movimenti, sku.id)) invece della cache, o quantomeno usare il minimo tra cache e ricalcolo.

### 59. deleteSku cancella anche i movimenti carico_produzione/scarico con DDT, spezzando lo storico di tracciabilità

- **Dove:** `index.html:13287`
- **Area:** Tracciabilità lotti

`deleteSku` (righe 13287-13310) elimina lo SKU e TUTTI i movimenti collegati, inclusi i `carico_produzione` con `lottoId` e documento DDT archiviato e gli `scarico_ordine` verso i clienti. Dopo la cancellazione: gli imbottigliamenti dei lotti restano con `caricoMagazzino: true` ma senza più il movimento che lo prova (stato incoerente: il lotto risulta "caricato" senza traccia); l'Archivio DDT perde i riferimenti ai documenti di entrata/uscita; `tracciabilitaLotto` perde ricavi e quote per i lotti che avevano caricato quello SKU. Questo contraddice la regola di proprietà "ogni movimento di merce è collegato al suo documento" (guida, riga 25559): il confirm avvisa del numero di movimenti ma non che tra questi ci sono DDT e collegamenti a lotti.

**Fix proposto:** Non cancellare i movimenti con DDT o `lottoId`: bloccare l'eliminazione dello SKU se esistono movimenti di entrata/uscita documentati (proporre invece un flag `archiviato` sullo SKU), oppure spostare i movimenti in un archivio storico non cancellabile e azzerare il flag `caricoMagazzino` degli imbottigliamenti coinvolti.

### 60. Codice lotto facoltativo e senza controllo di unicità

- **Dove:** `index.html:15351`
- **Area:** Tracciabilità lotti

Nel form lotto il campo "Codice lotto" (righe 15350-15354) non è `req` e la `save()` (righe 14695+) non lo valida: un lotto può percorrere tutto il ciclo fino a `completato`, essere imbottigliato e caricato in magazzino senza alcun codice lotto (identificato solo da annata, che non è univoca: più lotti stessa annata sono previsti da `nextCodLotto`). Inoltre il campo è testo libero senza controllo di unicità: due lotti possono avere lo stesso `codLotto`, rendendo ambigua la corrispondenza tra il codice stampato sulle etichette fisiche e il lotto nel gestionale. Il generatore sequenziale (riga 14498) è solo un suggerimento opzionale.

**Fix proposto:** Rendere `codLotto` obbligatorio almeno al passaggio a `in_imbottigliamento` (auto-popolando con `nextCodLotto(annata)` se vuoto) e aggiungere in `save()` un controllo di unicità su `dati.lotti` con errore bloccante in caso di duplicato.

### 61. Il modulo Produzione non registra nulla nel Report Attività: ciclo di vita dei lotti privo di audit trail

- **Dove:** `index.html:14387`
- **Area:** Tracciabilità lotti

L'App passa `logAction` a Produzione (riga 19169), ma il componente non lo destruttura (`function Produzione({ dati, setDati })`, righe 14387-14390) e non lo invoca mai: creazione/modifica lotto, cambi di stato (`avanzaLottoStato`), aggiunta/rimozione imbottigliamenti, carico in magazzino (`caricaImbottigliamentoInMagazzino`, che crea un movimento di magazzino!) ed eliminazione lotto non lasciano alcuna riga nel log `tnb-log`. Tutti gli altri moduli (Magazzino, Ordini, Clienti) loggano con utente e diff; DA-FARE.md (riga 36) dichiara che il Report Attività "registra ogni azione", ma per i lotti non è vero: non c'è modo di sapere chi ha cambiato stato, cancellato un imbottigliamento o eliminato un lotto, né quando.

**Fix proposto:** Aggiungere `logAction` ai props destrutturati di Produzione e chiamarlo in `save`, `avanzaLottoStato`, `deleteLotto`, `addImbottigliamento`, `removeImbottigliamento` e `caricaImbottigliamentoInMagazzino` con modulo "produzione" e dettaglio (annata/codLotto, stato precedente → nuovo, quantità).

### 62. Ricavi attribuiti al lotto sovrastimati: omaggi a prezzo pieno, rese e annulli non nettati

- **Dove:** `index.html:4610`
- **Area:** Costificazione FIFO / costo medio ponderato

In tracciabilitaLotto il ricavo per SKU è `qtaScaricata * prezzoUnit` sui soli movimenti `scarico_ordine` (riga 4599). Ma: (1) la qta scaricata include i pezzi omaggio (riga 2753) che vengono così valorizzati a prezzo pieno; (2) i movimenti `resa_cv` e `annullo_ordine` che riportano bottiglie in magazzino non vengono sottratti, quindi bottiglie rese o di ordini annullati restano contate come vendute; (3) non c'è filtro su `ordine.stato === "annullato"`. Il tab "Per Lotto" e tracciabilitaBottiglia (qtaVenduta, riga 4671) mostrano ricavi e margini per lotto gonfiati.

**Fix proposto:** Escludere gli ordini annullati, sottrarre la quota omaggio dal ricavo (valorizzarla a 0) e nettare per SKU le quantità di `resa_cv`/`annullo_ordine` da quelle scaricate prima di applicare il prezzo.

### 63. Tracciabilità lotto: prezzo preso dalla prima riga con lo stesso formato, annata ignorata

- **Dove:** `index.html:4606`
- **Area:** Costificazione FIFO / costo medio ponderato

Per valorizzare uno scarico, tracciabilitaLotto cerca la riga ordine con `find(r => _normFmt52(r.formato) === _normFmt52(sku.formato))`: se un ordine ha due righe con lo stesso formato ma annate/prezzi diversi (caso reale: ordine o07, righe 3846 e 3853, "500 ml" annata 2025 e 2024 con prezzi diversi), tutti gli scarichi di quell'ordine — anche quelli dello SKU annata 2024 — vengono valorizzati al prezzo della prima riga trovata. I ricavi per lotto risultano mis-attribuiti tra annate.

**Fix proposto:** Nel match della riga considerare anche l'annata dello SKU (`String(r.annata) === String(sku.annata)`) con fallback al solo formato; in alternativa valorizzare lo scarico usando la riga il cui SKU (via skuPerRiga) coincide con quello del movimento.

### 64. Costo medio ponderato calcolato su tutti i lotti di tutte le campagne

- **Dove:** `index.html:4488`
- **Area:** Costificazione FIFO / costo medio ponderato

costoFormatoReale calcola l'olio/L come media ponderata su TUTTI gli imbottigliamenti storici di quella bottiglia, senza filtro per campagna/annata. calcolaPLCampagna usa questo stesso costo unitario sia per la campagna selezionata sia per la precedente (confronto YoY a riga 16948): due campagne con costi olio molto diversi mostrano lo stesso costo unitario, e ogni nuovo lotto inserito ricalcola retroattivamente i P&L storici. Il margine per campagna non riflette il costo effettivo dell'olio venduto in quella campagna.

**Fix proposto:** Passare l'anno campagna a costoFormatoReale e ponderare solo sui lotti/imbottigliamenti dell'annata pertinente (con fallback alla media globale se assente), così che il P&L di ogni campagna usi il costo olio della propria raccolta.

### 65. Voci extra senza data sommate nel P&L di ogni campagna (doppio conteggio)

- **Dove:** `index.html:4732`
- **Area:** Costificazione FIFO / costo medio ponderato

Il filtro `!v.data || (v.data >= range.inizio && v.data <= range.fine)` include le voci extra prive di data nel costoExtra di TUTTE le campagne. La data è facoltativa nel form (riga 17388: `data: d.costiConfig._exData` che può essere ""): una voce da 1.000 € senza data viene sottratta dal margine lordo della campagna 2024, della 2025 e di ogni futura, moltiplicando il costo nei confronti YoY e nell'export Excel P&L.

**Fix proposto:** Rendere obbligatoria la data della voce extra nel form, oppure attribuire le voci senza data solo alla campagna corrente (o a una campagna scelta esplicitamente), non a tutte.

### 66. Margine per lotto: ricavi del solo venduto contro costo dell'intera produzione

- **Dove:** `index.html:4623`
- **Area:** Costificazione FIFO / costo medio ponderato

margineLotto = totRicavi − costoTotaleProduzione confronta i ricavi attribuiti (solo bottiglie già vendute, per di più in quota proporzionale) con il costo TOTALE del lotto (tutto l'olio, incluso quello non ancora imbottigliato, e tutte le bottiglie prodotte, incluse le invendute in giacenza). Qualsiasi lotto non ancora esaurito risulta con margine negativo e il tab "Per Lotto" lo conta come "IN PERDITA — lotti sotto costo" (righe 17585, 17592), segnalando false perdite su lotti perfettamente redditizi.

**Fix proposto:** Confrontare grandezze omogenee: margine = totRicavi − (costo unitario bottiglia × quantità venduta attribuita), mostrando separatamente il costo della giacenza invenduta; oppure rietichettare il KPI come "costo non ancora recuperato" invece di "in perdita".

### 67. Formato fantasma "Olio 20 ml" nel tab Per Formato: il vero "20 ml" escluso dall'analisi

- **Dove:** `index.html:16855`
- **Area:** Costificazione FIFO / costo medio ponderato · Anagrafica prodotti

La lista hardcoded FORMATI include "Olio 20 ml", ma ovunque nei dati il formato è "20 ml" (magazzino m8/m9 righe 3023/3040, LISTINO riga 5502, costiConfig.voci riga 4445). getListino fa match esatto e il lookup magazzino usa `m.formato === fmt`, quindi la riga "Olio 20 ml" mostra sempre prezzo 0 e fonte "nd", mentre il formato reale "20 ml" non compare mai nell'analisi margini per formato.

**Fix proposto:** Sostituire "Olio 20 ml" con "20 ml" nella costante FORMATI (o derivare la lista dai formati presenti in costiConfig.voci/magazzino invece di hardcodarla).

*Nota verifica: segnalato indipendentemente da 2 auditor.*

*Aspetto aggiuntivo («CostiMargini "Per Formato": aceto escluso e prezzo 0 per l'olio monodose», `index.html:16855`):* Il tab Per Formato analizza una lista hardcoded senza "Aceto 20 ml" (index.html:16855): i margini dell'aceto monodose non compaiono mai. Inoltre per "Olio 20 ml" il prezzo risulta 0: getListino cerca match esatto sul formato (5553) ma dati.listino è seedato con "20 ml" (migrazione 2241 da LISTINO), e il fallback magazzino (16859-16861) cerca m.formato === "Olio 20 ml" mentre lo SKU seed è "20 ml" → prezzoL = 0 e margine mostrato negativo pari a -costo, dato fuorviante nel modulo economico.

*Fix:* Aggiungere "Aceto 20 ml" alla lista e normalizzare il match formato (stessa mappa alias di listino/magazzino) prima dei lookup su dati.listino e dati.magazzino.

### 68. Impostazione 'Scadenza riserva pre-firma' mai applicata: le riserve non si annullano automaticamente

- **Dove:** `index.html:24999`
- **Area:** Scadenze e rotazione

La pagina Impostazioni espone 'Scadenza riserva pre-firma (giorni)' con la descrizione esplicita 'Giorni entro cui il cliente deve firmare un ordine prima che la riserva si annulli automaticamente' (riga 24999) e la migrazione v41 imposta il default `scadenzaRiservaGg: 7` (riga 1802). Ma in tutto il codice `impostazioni.scadenzaRiservaGg` viene solo scritto (default a 1802/4404 e input a 24996-24997): non esiste alcuna logica che confronti la data della riserva con la soglia, generi un alert o emetta un movimento 'riserva_annullata'. Un ordine mai firmato lascia i pezzi in stato 'riservato' per sempre, sottraendoli alla giacenza disponibile e quindi alla vendita, senza che nessuno venga avvisato.

**Fix proposto:** Implementare il comportamento promesso: alert nel centro notifiche per riserve più vecchie di scadenzaRiservaGg (confrontando la data del movimento 'riserva' con oggi) con azione rapida 'annulla riserva', oppure rimuovere/riformulare l'impostazione finché la funzione non esiste.

### 69. Alert 'lotto senza imbottigliamento >30gg' silenziato per sempre dal primo imbottigliamento parziale

- **Dove:** `index.html:22017`
- **Area:** Scadenze e rotazione

Il filtro dell'alert esclude il lotto appena esiste almeno un imbottigliamento: `if (imb.length > 0) return false; // già imbottigliato almeno una volta` (riga 22017). Un lotto da 3.000 L che imbottiglia una sola volta 50 L smette definitivamente di generare l'alert, anche se i restanti 2.950 L di olio grezzo restano fermi in serbatoio per mesi (esattamente il 'rischio ossidazione / valore commerciale fermo' che il commento a riga 22013 dichiara di coprire). L'helper litriDisponibiliLotto (riga 1659) che calcola i litri residui esiste già ma non viene usato qui.

**Fix proposto:** Basare l'alert sui litri residui invece che sull'esistenza di imbottigliamenti: segnalare i lotti con litriDisponibiliLotto(l) > 0 la cui data di riferimento (ultimo imbottigliamento o frangitura) è più vecchia di 30 giorni.

### 70. todayStr() usa la data UTC: tra mezzanotte e le 01:00/02:00 italiane 'oggi' è il giorno precedente

- **Dove:** `index.html:1508`
- **Area:** Scadenze e rotazione · Validazione e input utente

`const todayStr = () => new Date().toISOString().slice(0, 10)` (riga 1508) restituisce la data UTC, non quella locale. In Italia (UTC+1/+2), usando l'app tra le 00:00 e le 01:00 (inverno) o le 02:00 (estate): 1) tutti i movimenti magazzino auto e manuali vengono datati al giorno precedente (`dataMov = todayStr()` riga 2745 e 13196), incluse le date sui movimenti con DDT obbligatorio; 2) tutti i confronti di scadenza basati su `oggi = todayStr()` (es. CV scadute riga 6157, alert riga 18862, agenda riga 20815) slittano di un giorno: una scadenza di ieri non risulta ancora 'scaduta'. Lo stesso pattern locale/UTC misto è in calcolaScadenzaFollowUp (righe 19936-19943), dove setDate opera in ora locale ma la data finale esce da toISOString in UTC.

**Fix proposto:** Sostituire todayStr con una versione in ora locale, es. `const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }`, e applicare la stessa correzione ai toISOString().slice(0,10) usati per calcolare scadenze (es. calcolaScadenzaFollowUp).

*Nota verifica: segnalato indipendentemente da 2 auditor.*

*Aspetto aggiuntivo («todayStr() usa la data UTC: documenti e movimenti registrati col giorno precedente tra mezzanotte e le 2», `index.html:1508`):* todayStr = new Date().toISOString().slice(0,10) restituisce la data UTC, non quella italiana (UTC+1/+2). Ogni registrazione fatta tra le 00:00 e le 01:00 (ora solare) o le 02:00 (ora legale) riceve la data del giorno prima. La funzione è usata ovunque: data ordine di default (riga 10526), data movimenti magazzino (righe 13113, 13196, 14650), consegne registrate (riga 10480-10481), emailLog, e soprattutto l'anno per la numerazione ordini (riga 10690: anno = (form.data || todayStr()).slice(0,4)) — a capodanno un ordine creato dopo mezzanotte finirebbe nella numerazione dell'anno vecchio. Le date dei movimenti con DDT hanno rilevanza fiscale.

*Fix:* Sostituire l'implementazione con la data locale, es.: const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` (o toLocaleDateString('sv-SE')).

### 71. pezziCollo del 20 ml incoerente: 25 in LISTINO, 50 in LISTINO_PDF e negli scaglioni

- **Dove:** `index.html:5505`
- **Area:** Anagrafica prodotti

LISTINO "20 ml" dichiara pezziCollo 25 (index.html:5505) ma il suo stesso scaglione dice 1 collo = qta 50 pezzi (5510), e LISTINO_PDF usa pezziCollo 50 (9388). La semantica "combo 20ml olio + 20ml aceto" (5507, e il "×2" mostrato in ListinoPage a 26019) non è codificata da nessuna parte nei calcoli: il placeholder colli in UI calcola qta/25 (8268/11925) mentre listino e PDF ragionano a 50 pz/collo → per 50 bottiglie la UI suggerisce 2 colli, il listino ne prevede 1. Ambiguità sistematica su cosa sia un "collo" monodose (25 combo o 50 bottiglie).

**Fix proposto:** Decidere l'unità (bottiglie singole) e uniformare: pezziCollo 50 ovunque per il 20 ml, gestendo la combo solo come nota descrittiva, oppure introdurre un campo esplicito pezziPerCombo usato coerentemente da UI e PDF.

### 72. Annata default 2024 per la latta 5 L, ma in magazzino esiste solo la 2025

- **Dove:** `index.html:5533`
- **Area:** Anagrafica prodotti

LISTINO "5 L (latta)" ha annata "2024" (index.html:5533). Quando l'operatore seleziona il formato 5 L in una riga ordine, l'annata viene auto-impostata a 2024 (r.annata = l.annata, index.html:11162 e 8198), ma l'unico SKU 5 L in magazzino è annata 2025 (m7, index.html:3007). Risultato: alla firma scatta "SKU non trovato — 5 L (latta) · annata 2024" e l'ordine si blocca finché l'utente non corregge a mano l'annata.

**Fix proposto:** Aggiornare l'annata della entry "5 L (latta)" a "2025" (allineata al magazzino), o derivare l'annata proposta dagli SKU effettivamente disponibili invece che dalla const.

### 73. Numero ordine riusato dagli annullati: duplicato se l'ordine viene riaperto

- **Dove:** `index.html:10662`
- **Area:** Documenti e flussi

nextNum esclude gli ordini annullati dal calcolo del progressivo (riga 10662, per scelta tkt_1781163213633). Se l'ordine con il numero più alto (es. 1005/2026) viene annullato, il prossimo ordine riceve di nuovo 1005/2026. Ma l'annullato può essere riaperto con "↩ Riapri ordine" (riga 12056), che ripristina lo stato senza rigenerare il numero: si ottengono due ordini attivi con lo stesso numero documento, con ambiguità su PDF, email di conferma, causali bonifico ("Ord. 1005/2026 TNB") e report.

**Fix proposto:** Alla riapertura verificare se il numero è stato nel frattempo riassegnato a un altro ordine attivo e, in tal caso, riassegnare un nuovo numero (o avvisare l'utente); in alternativa non riusare mai i numeri di ordini annullati.

### 74. Il riferimento DDT dei movimenti auto usa la nota o il nome file, mai il numero DDT compilato

- **Dove:** `index.html:2737`
- **Area:** Documenti e flussi

ddtFromOrdine (riga 2737) costruisce il ddtNum del movimento prendendo ordine.ddtNote oppure il nome file del primo allegato, ignorando il campo "Numero" che l'utente compila su ogni voce DDT (riga 12342). Inoltre gli scarico_ordine sono generati alla FIRMA, quando l'ordine non ha ancora DDT (viene allegato alla consegna): nascono con ddtNum/ddtDoc null e non esiste alcun backfill successivo. Risultato: in Archivio DDT gli scarichi da ordine compaiono per sempre come "⚠ mancante" o con il nome file (es. "IMG_1234.jpg") al posto del vero numero DDT.

**Fix proposto:** In ddtFromOrdine privilegiare doc.numero (poi ddtNote, poi nomeOriginale); alla conferma di consegna (confermaTransizioneOrdine) aggiornare ddtNum/ddtDoc dei movimenti scarico_ordine esistenti dell'ordine con il DDT appena allegato.

### 75. Wizard prospect→ordine: salva righe con quantità zero/negative e prezzi negativi senza validazione

- **Dove:** `index.html:8322`
- **Area:** Validazione e input utente

Il pulsante 'Salva ordine' del wizard in Pipeline (riga 8322-8330) verifica solo che ci sia almeno una riga e la modalità di pagamento. A differenza di saveOrdine in Ordini (righe 10674-10682, che blocca prezzi/qta/omaggi negativi o NaN), qui una riga con qta svuotata diventa 0 (Number('')||0 a riga 8345), e valori negativi di qta, prezzoUnitario e omaggio passano senza errori (updateRiga a riga 8189 li salva con Number(val)). Ne risultano ordini con totali errati o negativi che entrano nel flusso ufficiale (numero ordine assegnato, statoLog, scarico magazzino alla firma) con impatto economico diretto.

**Fix proposto:** Replicare nel wizard la stessa validazione di saveOrdine: per ogni riga rifiutare qta <= 0, prezzoUnitario < 0, omaggio < 0 o NaN, con messaggio che indica la riga incriminata. Idealmente estrarre la validazione righe in una funzione condivisa usata da entrambi i flussi.

*Nota verifica: severità riclassificata dal verificatore da *alta* a *media*.*

### 76. saveOrdine accetta ordini senza alcuna riga e righe con quantità 0

- **Dove:** `index.html:10668`
- **Area:** Validazione e input utente

La validazione di saveOrdine (righe 10667-10688) controlla cliente, modalità, stato e valori negativi, ma non richiede che (form.righe || []) contenga almeno una riga, né che qta sia > 0 (blocca solo qta < 0, riga 10678). Si può quindi salvare un ordine 'vendita' completamente vuoto o con righe a 0 pezzi: riceve un numero ordine ufficiale (nextNum), entra nelle statistiche/CLV con totale 0, genera PDF di conferma privi di contenuto e occupa la numerazione progressiva. Il wizard Pipeline invece questo controllo lo fa (riga 8323), quindi i due flussi sono incoerenti.

**Fix proposto:** In saveOrdine aggiungere: se (form.righe||[]).length === 0 → errore 'Aggiungi almeno una riga'; e includere qta <= 0 (non solo < 0) tra le condizioni di riga non valida, salvo righe esplicitamente omaggio.

### 77. Codice cliente auto-generato per conteggio: crea duplicati dopo la cancellazione di un cliente

- **Dove:** `index.html:8458`
- **Area:** Validazione e input utente

In saveCliente il codiceCliente viene generato contando i clienti esistenti con prefisso 'TNB-anno-' (righe 8456-8460: counts + 1). Poiché i clienti si possono eliminare (righe 8947 e 8975), il conteggio non è più allineato al progressivo massimo: con clienti TNB-2026-001/002/003, eliminando 002 il conteggio scende a 2 e il prossimo nuovo cliente riceve TNB-2026-003, duplicato di un codice già assegnato. Nessun controllo di unicità impedisce la collisione, e il codice cliente finisce su documenti e anagrafiche.

**Fix proposto:** Calcolare il progressivo come max dei suffissi numerici esistenti + 1 (come già fa nextCodLotto a riga 14498-14507 per i lotti), invece del conteggio; in più verificare l'unicità del codice generato prima di salvare.

### 78. saveCliente: fallimento silenzioso senza ragione sociale ed email non validata

- **Dove:** `index.html:8441`
- **Area:** Validazione e input utente

saveCliente esce con 'return' muto se manca ragioneSociale (riga 8441): l'utente clicca 'Salva cliente' (riga 9007) e non succede nulla — nessun toast, nessuna evidenziazione del campo — dando l'impressione che l'app sia bloccata o che il cliente sia stato salvato. Inoltre il campo email non ha alcuna validazione di formato (viene validata solo la PEC, righe 8450-8453) benché l'email sia usata per il confronto duplicati (riga 8442-8444) e per l'invio delle conferme ordine via Gmail (riga 10803): un'email malformata ('mario.rossi', 'xx@') passa il salvataggio e fa fallire in modo poco chiaro il flusso email.

**Fix proposto:** Sostituire il return silenzioso con toast di errore ed evidenziazione del campo (il componente Inp supporta già la prop error); applicare all'email la stessa regex già usata per la PEC.

### 79. statoLog ordini attribuito sempre a "irene" hardcoded su upload firma e wizard prospect

- **Dove:** `index.html:12143`
- **Area:** Autenticazione e permessi

Le transizioni di stato registrate al caricamento della firma scrivono `utente: "irene"` fisso (righe 12143 e 12191), e lo stesso fa la creazione ordine dal wizard prospect (riga 8366, `trigger: "wizard_prospect"`). Con più utenti reali attivi (Patrizio, Elisa, Lucia), lo storico stati dell'ordine attribuisce a Irene azioni compiute da altri: la tracciabilità per-utente promessa in DA-FARE.md è falsata proprio nei flussi quotidiani (firma ordine). Nota: altrove il pattern corretto esiste già (`(currentUser && currentUser.username) || "irene"`, es. riga 10702).

**Fix proposto:** Sostituire i tre `utente: "irene"` con `(currentUser && currentUser.username) || "sconosciuto"`, passando `currentUser` come prop ai componenti che non lo ricevono (il wizard a riga ~8363); eliminare anche il fallback "irene" dagli altri punti per evitare false attribuzioni.

### 80. Sessione = id utente prevedibile in localStorage, senza scadenza

- **Dove:** `index.html:18585`
- **Area:** Autenticazione e permessi

Il ripristino sessione (righe 18580-18587) accetta come 'token' il solo id utente (`"su"`, `"ad"`, `"co"`...) letto da `tnb__tnb-session`/`tnb__session_temp` e fa `USERS.find(x => x.id === sessionId)`. Oltre al bypass del login già noto (DA-FARE #1), questo è un aspetto ulteriore: chiunque acceda al dispositivo può scalare i privilegi impostando `localStorage.setItem('tnb__tnb-session','su')` senza conoscere alcuna password, e la sessione 'ricordami' non scade mai (nessun timestamp, nessuna invalidazione: revocare un utente richiede un deploy e comunque non disconnette i dispositivi già loggati).

**Fix proposto:** Nel breve termine: salvare insieme all'id un token casuale con scadenza (es. 30 giorni) e verificarlo al ripristino; nel medio termine confluisce nel fix architetturale già pianificato (Supabase Auth con sessioni server-side revocabili).

### 81. Eliminazione definitiva cliente aperta ad admin e tester, incoerente con la protezione degli ordini

- **Dove:** `index.html:8959`
- **Area:** Autenticazione e permessi

L'eliminazione dell'ordine è riservata al superadmin con blocco esplicito (`deleteOrdine`, righe 10841-10846: "Operazione riservata al Super Admin"), ma l'eliminazione definitiva di un cliente (bottone a riga 8959, handler 8963-8980) non ha alcun controllo di ruolo: il componente `Clienti` non riceve nemmeno `currentUser` (riga 19152). Un `tester` o `admin` può cancellare irreversibilmente un cliente e, in cascata, anche i suoi ordini annullati (riga 8973), cioè proprio i record che singolarmente non potrebbe eliminare.

**Fix proposto:** Passare `currentUser` a `Clienti` e mostrare/eseguire l'eliminazione cliente (almeno quando cancella ordini annullati in cascata) solo per `role === "superadmin"`, replicando il pattern di `deleteOrdine`.

### 82. Gestione e cancellazione definitiva dei ticket senza controllo di ruolo e senza traccia nel log

- **Dove:** `index.html:18560`
- **Area:** Autenticazione e permessi

Nel TicketDashboard la riga di azioni (righe 18542-18562: "Prendi in carico", "Risolvi", "Chiudi", "Riapri", 🗑 elimina) è renderizzata per tutti gli utenti, non solo per il superadmin (`isSuperadmin` a riga 18255 è usato solo per filtrare la lista e i titoli): un tester può marcare risolti/chiudere/eliminare definitivamente i propri ticket, alterando il flusso di verifica bug gestito da Patrizio. Inoltre `deleteTicket` (righe 18314-18322) rimuove il ticket in modo permanente senza chiamare `logAction`: la cancellazione non lascia alcuna traccia nel Report Attività.

**Fix proposto:** Avvolgere le azioni di gestione (in carico/risolvi/chiudi/elimina) in `isSuperadmin && ...` lasciando agli altri solo commento e riapertura dei propri ticket, e aggiungere `logAction("Elimina ticket", "ticket", t.titolo)` dentro `deleteTicket`.

### 83. Ordini: tabella completa non paginata e ricalcoli O(n·m) a ogni render

- **Dove:** `index.html:11175`
- **Area:** Performance

A ogni render di Ordini vengono ricreati senza memoizzazione: allOrdini con spread+sort di tutti gli ordini (riga 11175), 6 filtri views (11177-11185), consegnePianificate(ordiniAttivi) solo per il contatore del tab (riga 11379). La vista "Lista" passa l'intero array a Tbl senza paginazione (riga 11474, data: lista) e ogni riga chiama nCl che fa dati.clienti.find (definita a 10543, usata a 11250) → O(ordini×clienti). Poiché i form dei modal (setForm per keystroke) vivono nello stesso componente, digitare nel form di un ordine ri-renderizza e ricalcola tutta la tabella a ogni carattere.

**Fix proposto:** Avvolgere allOrdini/views/consegne in useMemo con dipendenza [dati.ordini]; costruire una Map clienteId→cliente una volta per render; aggiungere paginazione (come già fatto in Pipeline, riga 7287) o virtualizzazione; estrarre il modal di creazione/modifica in un componente figlio con stato proprio.

*Nota verifica: severità riclassificata dal verificatore da *alta* a *media*.*

### 84. Clienti: filter di tutti gli ordini per OGNI card, ricalcolato a ogni keystroke della ricerca

- **Dove:** `index.html:8538`
- **Area:** Performance

La griglia Clienti renderizza tutte le card senza paginazione e per ciascun cliente esegue dati.ordini.filter(o => o.clienteId === c.id …) (riga 8538) → O(clienti×ordini) a ogni render; il campo "Cerca" (riga 8515) aggiorna lo stato per carattere, quindi ogni tasto rifà l'intero calcolo, inclusi i 4 filter+reduce del PageSummary (righe 8526-8530) che riattraversano tutti gli ordini. Lo stesso identico pattern è replicato in ClientiCommerciale alla riga 21254 e in ReportUltimiDocCliente alla riga 21501. Con centinaia di clienti e migliaia di ordini la digitazione nella ricerca diventa visibilmente lenta.

**Fix proposto:** Precomputare con useMemo (dipendenza [dati.ordini]) una Map clienteId→{ordini, haCV} da riusare nelle card — clvMap e lastOrderDate (righe 8493-8494) mostrano già il pattern corretto; memoizzare anche i totali del PageSummary; valutare paginazione della griglia.

### 85. Archivio DDT: join O(movimenti×ordini) ricostruito a ogni carattere digitato nella ricerca

- **Dove:** `index.html:13936`
- **Area:** Performance

Nel tab "ddt" di Magazzino, a ogni render movDDT viene ricostruito facendo per OGNI movimento un dati.magazzino.find e un dati.ordini.find (righe 13936-13937) → O(movimenti×(sku+ordini)); il campo di ricerca ddtSearch (riga 13977, Inp per keystroke) e il filtro direzione innescano il ricalcolo completo a ogni carattere, e la tabella risultante è renderizzata per intero senza paginazione (riga 13991, data: filtrati). L'array movimenti cresce a ogni entrata/uscita di magazzino, quindi il costo aumenta linearmente con l'operatività.

**Fix proposto:** Avvolgere la costruzione di movDDT in useMemo con dipendenze [dati.movimenti, dati.magazzino, dati.ordini] usando Map id→sku e id→ordine (costo O(n)); applicare il filtro testo in un secondo useMemo dipendente da ddtSearch con debounce; paginare la tabella.

### 86. Report Attività: intero log renderizzato senza paginazione con doppio passaggio regex per render

- **Dove:** `index.html:19446`
- **Area:** Performance

ActivityLog carica in memoria tutto tnb-log (riga 19295) — che è append-only e mai potato — e renderizza TUTTE le voci filtrate senza paginazione (riga 19446, filtered.map). A ogni keystroke nel campo cerca (riga 19363) l'intero array viene rifiltrato con toLowerCase+regex tipoDiAzione per voce (riga 19306) e in più i contatori dei chip rieseguono tipoDiAzione su tutto il log una seconda volta (riga 19341). Con decine di migliaia di voci la pagina diventa lentissima da aprire e da filtrare (DOM con migliaia di nodi).

**Fix proposto:** Paginare o virtualizzare l'elenco (es. 100 voci per pagina con pulsante "carica altre"), memoizzare i conteggi per tipo con useMemo su [logs] e applicare il filtro testo con debounce; a monte, caricare il log a chunk (vedi finding sul salvataggio del log).

### 87. Bundle monolitico da 1,9 MB invalidato integralmente a ogni deploy

- **Dove:** `index.html:672`
- **Area:** Performance

Tutta l'app è un unico index.html da 1.902.202 byte (492 KB gzip): ~579 KB sono librerie vendorizzate immutabili (React, ReactDOM, jsPDF, righe 1-671) inline nello stesso file del codice applicativo (che inizia a riga 672). stamp-build.sh riscrive index.html a ogni deploy (timestamp build), quindi ogni release — anche una correzione di una riga — costringe tutti gli utenti a riscaricare l'intero file, incluse le librerie che non cambiano mai; netlify.toml non definisce alcun header di cache. Su connessioni mobili in campo (agenti) il primo caricamento post-deploy è pesante e il parse di 1,9 MB di JS ritarda il time-to-interactive.

**Fix proposto:** Estrarre le librerie vendorizzate in file separati (es. vendor-react.min.js, vendor-jspdf.min.js) referenziati con <script src> e serviti con Cache-Control: immutable (nome file con hash), lasciando in index.html solo il codice applicativo; il peso riscaricato a ogni deploy scenderebbe di ~580 KB raw.

### 88. Report Attività: errore di caricamento e caricamento in corso indistinguibili dallo stato vuoto

- **Dove:** `index.html:19296`
- **Area:** Gestione errori e stati vuoti

ActivityLog carica 'tnb-log' in un useEffect con catch che fa solo console.warn e setLogs([]) (righe 19291-19300). Sia durante il fetch (stato iniziale []) sia in caso di errore, la pagina mostra lo stato vuoto 'Nessuna attività registrata ancora' (riga 19427-19439). Un admin che apre il report con un problema di rete conclude erroneamente che non ci sia attività registrata — grave per una funzione usata proprio per controllare l'operato multi-utente — e non c'è nessun indicatore di caricamento.

**Fix proposto:** Aggiungere uno stato loading (spinner/testo 'Caricamento attività…') e uno stato errore distinto: nel catch impostare un flag e renderizzare 'Impossibile caricare il registro attività — riprova' con pulsante di retry, invece del messaggio di lista vuota.

### 89. Dialog di conferma eliminazione: focus automatico sul pulsante distruttivo e Invio che conferma

- **Dove:** `index.html:1428`
- **Area:** Accessibilità e usabilità

In `window.tnbConfirm` il pulsante OK (rosso, "Elimina" in quasi tutti gli usi) riceve il focus automatico dopo 100ms (riga 1428: `setTimeout(() => btnOk.focus(), 100)`) e il listener globale su document conferma con Invio (riga 1423). Tutte le eliminazioni irreversibili dell'app (ordini riga 10850, clienti 8973, SKU con movimenti 13294, fornitori 15867, reset TUTTI gli ordini 25302) passano da qui: un utente che preme Invio per abitudine — o che ha ancora il dito sul tasto dopo aver compilato un campo — conferma l'eliminazione definitiva senza aver letto il messaggio. Il default sicuro per conferme distruttive è il contrario (focus su Annulla).

**Fix proposto:** Quando `opts.danger` è true, dare il focus a `btnCancel` invece che a `btnOk` e non mappare Invio sulla conferma (lasciare solo il click esplicito ed Escape per annullare). Eventualmente mantenere Invio=conferma solo per i confirm non-danger.

### 90. Stato pagamento modificabile al volo dalla riga ordine senza conferma, feedback né log

- **Dove:** `index.html:11339`
- **Area:** Accessibilità e usabilità

Nella tabella Ordini ogni riga ha una `<select>` (righe 11339-11347) che cambia `statoPagamento` (Da pagare → Pagato ecc.) immediatamente al change: nessuna conferma, nessun toast, nessuna chiamata a `logAction` (a differenza di quasi tutte le altre modifiche, tracciate nel Report Attività). La select è a font 10px ed è nella stessa cella, a `gap: 4` (riga 11296), dei pulsanti PDF/modifica/🗑 elimina: una selezione sbagliata o un tap impreciso su tablet marca un ordine come "Pagato" (dato con impatto economico) in modo silenzioso e non attribuibile nel log.

**Fix proposto:** Dopo il change mostrare un toast di conferma ("Ordine 1006/2026 → Pagato") e registrare la modifica con `logAction` come avviene in `saveOrdine`; valutare un `tnbConfirm` leggero per il passaggio a "Pagato". Aumentare la separazione dal pulsante 🗑.

### 91. Il componente Btn scarta la prop `title`: tooltip e nome accessibile persi su tutti i pulsanti-icona

- **Dove:** `index.html:5644`
- **Area:** Accessibilità e usabilità

`Btn` destruttura solo `{ch, onClick, v, sz, dis, style}` (righe 5644-5651) e non passa altro al `<button>` (righe 5690-5708). In vari punti il codice passa fiducioso `title` a Btn — es. "Genera PDF & Invia" (riga 11302), "Elimina ordine (Super Admin)" (riga 11319), "Elimina questa call" (riga 7503) — ma l'attributo viene silenziosamente perso: al passaggio del mouse non appare alcun tooltip. I pulsanti-icona (matita ✏️, 🗑, icona CV, X di chiusura dei Modal a riga 5899) restano così senza etichetta visibile né nome accessibile (nessun aria-label), e un utente non tecnico deve indovinare cosa fanno tre icone adiacenti nella riga ordine.

**Fix proposto:** Aggiungere `title` (e idealmente `"aria-label": title`) alla firma di Btn e propagarlo al `<button>`: `React.createElement("button", { onClick, disabled: dis, title, "aria-label": ariaLabel || title, ... })`. Una modifica di 2 righe che riattiva tutti i tooltip già scritti nel codice.

### 92. Label mai associate ai campi in Inp e Sel (niente htmlFor/id)

- **Dove:** `index.html:5748`
- **Area:** Accessibilità e usabilità

I componenti base `Inp` (label a riga 5748, input a riga 5776) e `Sel` (label a riga 5815, select a riga 5826) renderizzano `<label>` e campo come fratelli senza `htmlFor`/`id` e senza annidamento. Conseguenze concrete su tutti i form dell'app (ordini, magazzino, clienti, produzione): cliccare/toccare l'etichetta non porta il focus nel campo (target touch effettivo ridotto al solo input), e uno screen reader annuncia i campi come "modifica testo" senza nome. Anche l'asterisco rosso dei campi obbligatori (riga 5755) non è annunciato.

**Fix proposto:** Generare un id stabile nel componente (es. `const id = React.useId()`), impostare `htmlFor: id` sulla label e `id` su input/select/textarea. In alternativa annidare il campo dentro la `<label>`.

### 93. Badge di stato con testo bianco 10-11px su oro/grigio chiaro: contrasto ~2,3:1 (soglia WCAG 4,5:1)

- **Dove:** `index.html:5638`
- **Area:** Accessibilità e usabilità

Il componente `Bdg` scrive sempre in bianco (`color: "#fff"`, riga 5638) a 10-11px uppercase sul colore di stato. Con le mappe realmente usate il contrasto crolla sotto la soglia: `STATO_FUNNEL.interessato` usa `C.oro` #c9a84c (riga 5392) → ~2,3:1; `STATO_FUNNEL.da_contattare` (riga 5380) e `STATO_PAG.n_a` (riga 5374) usano `C.grigio400` #a09d95 → ~2,7:1; il fallback per valori sconosciuti è anch'esso grigio400 (riga 5628). Questi badge sono l'informazione principale di stato nelle liste Pipeline e Ordini usate ogni giorno: per chi ha vista non perfetta o su tablet al sole i testi "INTERESSATO"/"DA CONTATTARE" risultano quasi illeggibili.

**Fix proposto:** Per i colori chiari (oro, giallo, grigio400) usare testo scuro (es. #5c4a12 su fondo oro, o pattern già usato altrove: testo colorato su fondo tinta al 13% come a riga 16575 ma con colore scurito), oppure scurire i colori di sfondo dei badge fino a contrasto ≥ 4,5:1.

### 94. Il form "movimento manuale" offre anche i tipi automatici/di sistema, con etichette fuorvianti

- **Dove:** `index.html:14162`
- **Area:** Accessibilità e usabilità

La select "Tipo movimento" del form manuale usa l'intera lista `TIPI_MOV` (riga 14162, `opts: TIPI_MOV`), che include tipi pensati per essere generati dai flussi automatici: "📤 Scarico automatico per ordine" (scarico_ordine), "🔄 Annullo scarico ordine", "🫒 Carico da produzione", oltre a "✏️ Rettifica manuale" che duplica il form rettifiche dedicato (riga 13104) senza però il campo motivo obbligatorio. Un utente non tecnico che seleziona "Scarico automatico per ordine" crea un movimento etichettato come automatico ma con `ordineId: null` (il form non ha alcun campo per collegare l'ordine, riga 13202), inquinando lo storico e l'Archivio DDT con movimenti ambigui non riconciliabili.

**Fix proposto:** Nel form manuale filtrare la lista ai soli tipi legittimamente manuali (carico, transizioni interne, riserva/annullo riserva, affido, consegnato, scarico manuale, resa CV) ed escludere scarico_ordine/annullo_ordine/carico_produzione/rettifica; per la rettifica reindirizzare al form dedicato che pretende il motivo.

### 95. La guida istruisce a "regolarizzare" i movimenti senza DDT, ma la funzione non esiste

- **Dove:** `docs/Guida-DDT-Magazzino.md:102`
- **Area:** Guide e testi

La guida dice che i movimenti evidenziati "⚠ mancante / assente" "vanno regolarizzati allegando il documento" e la FAQ (riga 121) conferma "puoi recuperarli con calma allegando il documento"; identica istruzione nella guida in-app (index.html:25559: "allega il documento mancante"). Nel codice però NON esiste alcun percorso per aggiungere ddtNum/ddtDoc a un movimento già registrato: l'Archivio DDT è di sola visualizzazione (unico pulsante "🚚 Apri", index.html:14027-14034) e nessun punto del codice aggiorna `ddtNum`/`ddtDoc` dopo la creazione del movimento (gli unici assegnamenti sono in fase di creazione: index.html:13204, 2768, 2821, 14659). L'operatore che segue la guida cerca una funzione inesistente e il contatore rosso "da regolarizzare" resta tale per sempre.

**Fix proposto:** O aggiungere nell'Archivio DDT un'azione "Allega DDT" sulla riga del movimento (edit di ddtNum/ddtDoc con upload su Storage), oppure correggere docs/Guida-DDT-Magazzino.md (§7 e FAQ) e la guida in-app togliendo l'istruzione di regolarizzazione e spiegando che i movimenti storici senza DDT restano solo segnalati.

*Nota verifica: severità riclassificata dal verificatore da *alta* a *media*.*

### 96. Lo "Scarico per ordine" alla firma avviene senza DDT, contrariamente alla tabella della guida

- **Dove:** `docs/Guida-DDT-Magazzino.md:35`
- **Area:** Guide e testi

La tabella §2 elenca "Scarico per ordine — Scarico automatico alla firma dell'ordine" tra i movimenti che richiedono il DDT, e la §1 afferma che senza numero+documento "l'operazione non si può registrare". In realtà alla firma dell'ordine lo scarico automatico viene creato da `generaMovimentiOrdine` (index.html:2743-2777) prendendo il DDT da `ddtFromOrdine` (index.html:2734-2739): se l'ordine non ha ancora DDT allegato (caso normale, il DDT si allega alla consegna) il movimento viene registrato con `ddtNum: null` senza alcun blocco (vedi anche la firma da Agenda, index.html:20722-20728, che verifica solo lo stock). Il vincolo dichiarato vale quindi solo per i movimenti manuali.

**Fix proposto:** Correggere la §2 spostando "Scarico per ordine" in una nota dedicata: chiarire che lo scarico automatico alla firma eredita il DDT dell'ordine SE presente, altrimenti il movimento nasce senza DDT e compare in Archivio DDT come mancante.

### 97. Guida Impostazioni: afferma che i reset cancellano i log, ma il codice li conserva (e contraddice la sezione Registro Attività)

- **Dove:** `index.html:25614`
- **Area:** Guide e testi

La sezione Impostazioni di GUIDA_CONTENUTI dice "Reset completo D0: ... Cancella anche tutti i log" e "Reset Go-Live: ... Cancella log, firme, DDT...". Il codice fa l'opposto per policy esplicita: "il report attività (tnb-log) NON viene azzerato dal reset — traccia permanente" (index.html:25379 per il reset D0 e 25476 per il Go-Live). La stessa guida, nella sezione Registro Attività (index.html:25609), dice correttamente che il log "sopravvive anche ai reset dati (D0 e Go-Live)": due sezioni della stessa guida si contraddicono su un'operazione della zona pericolosa, disorientando il SuperAdmin che deve decidere se procedere.

**Fix proposto:** Correggere il corpo della sezione impostazioni: rimuovere "Cancella anche tutti i log" dal Reset D0 e "log" dall'elenco del Reset Go-Live, precisando che il Registro Attività (tnb-log) è permanente e sopravvive a entrambi i reset.

### 98. Guida Listino: lo "sconto senza confezione" è descritto come percentuale ma è un importo fisso in euro

- **Dove:** `index.html:25579`
- **Area:** Guide e testi

La sezione listino di GUIDA_CONTENUTI dice "Sconto senza confezione: percentuale di sconto per ordini senza packaging". Nel codice `scontoSenzaConfezione` è un importo assoluto in euro sottratto al prezzo unitario: `prezzo -= l.scontoSenzaConfezione` (index.html:5590), valori di default 2.00 € (index.html:5457, 5482) e visualizzazione "Senza confezione: -€X a pezzo" (index.html:26049). Chi segue la guida e inserisce ad es. "10" pensando al 10% applica in realtà uno sconto di 10 € a pezzo, con effetto diretto sui prezzi degli ordini.

**Fix proposto:** Correggere il testo in: "Sconto senza confezione: importo fisso in euro detratto dal prezzo di ogni pezzo per ordini senza packaging (es. 2,00 €), con eventuali note sconto".

### 99. Guida Clienti: "le modifiche si salvano automaticamente" è falso, serve premere Salva

- **Dove:** `index.html:25549`
- **Area:** Guide e testi

La sezione clienti di GUIDA_CONTENUTI dice, sotto 'AZIONI DAL DETTAGLIO': "'Modifica': apri la scheda e modifica i campi. Le modifiche si salvano automaticamente." In realtà la scheda cliente si salva solo premendo il pulsante "Salva" del modale (index.html:9006), che invoca `saveCliente` (index.html:8454) con toast "✅ Cliente salvato". Chiudendo il modale senza premere Salva le modifiche vanno perse: la guida induce l'utente a chiudere la scheda credendo che i dati siano già persistiti.

**Fix proposto:** Correggere il testo in: "'Modifica': apri la scheda, modifica i campi e premi Salva per confermare — chiudendo la finestra senza salvare le modifiche vengono perse".

### 100. Aliquota IVA 4% come magic number duplicato in almeno 7 punti, con divergenze

- **Dove:** `index.html:24247`
- **Area:** Coerenza generale del codice

Esiste l'helper totIVA/ivaOrdine (righe 2892-2895, con arrotondamento al centesimo e gestione reverse charge), ma l'aliquota 0.04 è ricalcolata inline a righe 9268, 9701, 9745, 11643, 23887 e 24247. Il testo contratto generato a riga 24247 applica sempre 'IVA 4%' senza controllare il reverse charge del cliente (che invece la vicina riga 23887 gestisce), e alcuni punti non arrotondano come totIVA. Se l'aliquota cambiasse, andrebbe aggiornata in 7+ posti con alto rischio di dimenticanze.

**Fix proposto:** Estrarre una costante IVA_ALIQUOTA (0.04) usata da totIVA e sostituire tutti i calcoli inline con ivaOrdine/totIVA; nel generatore contratti (riga 24247) passare dal helper con il flag reverseCharge del cliente.

### 101. Logica auto-prezzo riga ordine duplicata (Ordini vs wizard Pipeline) e già divergente

- **Dove:** `index.html:8194`
- **Area:** Coerenza generale del codice

updateRiga del wizard Pipeline (righe 8185-8204) è una riscrittura in stile ES5 di updRiga di Ordini (righe 11146-11173). Le due copie sono già divergenti: in Ordini il cambio del flag 'confezione' riprezzo la riga (riga 11167), nel wizard non esiste il ramo k === 'confezione' né un toggle confezione, ma la riga di default nasce con confezione: false e prezzoUnitario 19.50 (riga 8209), cioè il prezzo CON confezione abbinato al flag SENZA confezione: un ordine salvato senza toccare qta/formato stampa sul PDF la nota 'senza conf.' (riga 9645) con il prezzo pieno.

**Fix proposto:** Estrarre una funzione condivisa (es. applicaListinoRiga(riga, key, val, dati)) usata da entrambi i form, e correggere il default della riga wizard rendendo coerenti flag confezione e prezzo iniziale.

### 102. Ordine del funnel pipeline contraddittorio tra STATI_PROGRESSIONE e l'array stati della UI

- **Dove:** `index.html:6904`
- **Area:** Coerenza generale del codice

STATI_PROGRESSIONE (riga 5407) definisce la progressione da_contattare → contattato → interessato → in_trattativa → acquisito, mentre l'array 'stati' della Pipeline (riga 6904) e l'ordine di dichiarazione di STATO_FUNNEL (riga 5377) mettono in_trattativa PRIMA di interessato. Il pulsante '▶ avanza stato' (prossimoStatoId, righe 6768-6770, usato a riga 7510) porta quindi un prospect da 'in_trattativa' direttamente ad 'acquisito' saltando 'interessato', in contraddizione con l'ordine delle colonne/filtri mostrato all'utente.

**Fix proposto:** Decidere l'ordine canonico del funnel (verosimilmente interessato prima di in_trattativa), derivare l'array 'stati' della UI da STATI_PROGRESSIONE + stati fuori-flusso (non_interessato, in_sospeso) e riordinare la dichiarazione di STATO_FUNNEL per coerenza.

---

## Severità 🟢 Bassa (43 finding)

### 103. BarChartSVG: prop 'fmtFn' passata ma il componente si aspetta 'fmt' — valori senza formato euro

- **Dove:** `index.html:17863`
- **Area:** Pagine e componenti UI

BarChartSVG destruttura `fmt: fmtFn` (riga 927), cioè legge una prop chiamata `fmt`; la chiamata in CostiMargini passa invece `fmtFn: fmt`. Il formatter risulta undefined e asse Y ed etichette delle barre del grafico 'CONFRONTO PREZZO / COSTO / MARGINE' mostrano numeri grezzi (es. '12' invece di '€ 12,00'), in modo incoerente con gli altri grafici della stessa pagina (AreaChartSVG e HBarChartSVG usano correttamente `fmtFn`).

**Fix proposto:** Uniformare il nome della prop: cambiare la firma di BarChartSVG in `fmtFn` (come gli altri chart) oppure passare `fmt: fmt` alla chiamata di riga 17863.

*Nota verifica: severità riclassificata dal verificatore da *media* a *bassa*.*

### 104. Dashboard: sottotitolo del KPI 'Fatturato Vendite' conta anche ordini annullati e campioni

- **Dove:** `index.html:6257`
- **Area:** Pagine e componenti UI

Il valore del KPI (totVendita) esclude gli ordini annullati (return a riga 6136), ma il sottotitolo usa `dati.ordini.filter(o => o.modalita === "vendita").length`, che include sia gli annullati sia gli omaggi/campioni: il numero di ordini mostrato non corrisponde agli ordini che compongono l'importo. Gli altri KPI della stessa griglia (righe 6265 e 6273) filtrano correttamente `o.stato !== "annullato"`.

**Fix proposto:** Allineare il conteggio: `dati.ordini.filter(o => o.stato !== "annullato" && o.modalita === "vendita").length` (ed eventualmente escludere `o.campione` per coerenza con la vista 'vendita' di Ordini, riga 11180).

*Nota verifica: severità riclassificata dal verificatore da *media* a *bassa*.*

### 105. Report Periodo: data 'Dal' predefinita al 31 dicembre dell'anno precedente (bug timezone)

- **Dove:** `index.html:21631`
- **Area:** Pagine e componenti UI

Lo stato iniziale è `new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)`: il 1° gennaio a mezzanotte locale (Italia, UTC+1/+2) convertito in ISO UTC diventa il 31 dicembre dell'anno precedente. Il report 'anno corrente' all'apertura include quindi anche l'ultimo giorno dell'anno prima; il preset 'Anno corrente' (riga 21714), costruito come stringa, dà invece la data giusta — comportamento incoerente tra default e pulsante.

**Fix proposto:** Costruire la data come stringa locale, come già fatto nel preset: `useState(\`${new Date().getFullYear()}-01-01\`)` (stessa correzione per i preset che usano `toISOString()` dopo `setDate`).

### 106. Ordini 'Per cliente': colSpan incoerenti tra intestazione (5 colonne) e righe (8 colonne)

- **Dove:** `index.html:11196`
- **Area:** Pagine e componenti UI

La vista raggruppata per cliente ha un thead di 5 colonne ('Cliente','Ordini','Alert','Totale','N° Ordini' — riga 11474), ma la riga di gruppo genera 4 celle più una con `colSpan:4`, per un totale di 8 slot colonna; la riga di dettaglio espansa usa `colSpan:5` coprendo solo 5 slot su 8. Il browser allarga la tabella a 8 colonne: le celle di dettaglio non si estendono per tutta la larghezza e l'ultima colonna dell'header non corrisponde più alla struttura reale delle righe.

**Fix proposto:** Rendere coerenti i colSpan: l'ultima cella della riga di gruppo con `colSpan:1` (totale 5 colonne) e la riga di dettaglio con `colSpan:5`, oppure aggiornare l'header a 8 colonne.

### 107. PieChartSVG: con un'unica categoria al 100% la ciambella non viene disegnata

- **Dove:** `index.html:1136`
- **Area:** Pagine e componenti UI

Quando `data` contiene una sola voce (o una voce vale il 100% del totale), l'angolo della fetta è 2π e il path SVG parte e arriva nello stesso punto: per la specifica SVG un arco con estremi coincidenti non viene renderizzato. Nel grafico 'CANALE ACQUISIZIONE CLIENTI' della Dashboard (riga 6398), se tutti i clienti hanno lo stesso canale (caso tipico a inizio attività) compare solo la legenda senza alcun grafico.

**Fix proposto:** Gestire il caso fetta piena: se `d.value === total` disegnare due semi-archi (spezzare la fetta in due da π ciascuna) o un elemento `circle` con `fill-rule` ad anello, invece del singolo path ad arco.

### 108. useMemo con dipendenze ricreate a ogni render: memoizzazione sempre invalidata

- **Dove:** `index.html:11189`
- **Area:** Hooks e logica di stato · Performance

In Ordini, gruppiClienti dipende da [lista, tab, navTarget] ma `lista` (riga 11186) è un array nuovo a ogni render (deriva da `views`, oggetto letterale con .filter ricreato ogni volta), quindi la memo ricalcola sempre e non memoizza nulla; usa inoltre allOrdini/views/dati.clienti non dichiarati nelle deps (funziona solo grazie all'invalidazione permanente). Stesso pattern in Pipeline a riga 7098: sortedFiltered dipende da `filtered`, anch'esso ricreato a ogni render. Con centinaia di ordini/prospect il raggruppamento+sort gira a ogni battitura nei filtri.

**Fix proposto:** Memoizzare a monte la base: calcolare views/filtered dentro useMemo con deps sui dati sorgente (dati.ordini, dati.prospect, filtri), poi far dipendere le memo derivate da quei valori memoizzati; oppure sostituire le deps con quelle reali (dati.ordini, tab, navTarget).

*Nota verifica: segnalato indipendentemente da 2 auditor.*

*Aspetto aggiuntivo («useMemo di gruppiClienti inefficace: dipendenza su array ricreato a ogni render», `index.html:11189`):* gruppiClienti è dentro useMemo ma la dipendenza `lista` è un nuovo array a ogni render (deriva da filter/sort non memoizzati alla riga 11186), quindi il memo ricalcola SEMPRE. Il corpo esegue dati.clienti.find(c => c.id === cid) per ogni ordine della lista → O(ordini×clienti) a ogni render della vista "Per cliente", inclusi i re-render causati da ogni keystroke nei form del componente. La memoizzazione dà una falsa sensazione di ottimizzazione senza produrre alcun beneficio.

*Fix:* Cambiare le dipendenze in [dati.ordini, dati.clienti, tab, navTarget] ricavando la lista dentro il memo (o memoizzando prima allOrdini/views), e usare una Map id→cliente costruita una sola volta invece di find nel loop.

### 109. setTimeout nei mount-effect di navigazione senza clearTimeout nel cleanup

- **Dove:** `index.html:10513`
- **Area:** Hooks e logica di stato

Gli effetti di consumo di window._tnbNav in Ordini (10513), Pipeline (6709), Magazzino (13052) e Produzione (14419) programmano un setTimeout di 80ms senza restituire un cleanup che lo cancelli. Se l'utente cambia subito modulo, il timer scatta dopo lo smontaggio: le setState sono no-op in React 18, ma il callback consuma comunque window._tnbNav (lo azzera) e in Ordini può chiamare setForm/setModal su un'istanza smontata, con il risultato che una navigazione cross-modulo appena richiesta viene silenziosamente persa.

**Fix proposto:** In ogni effetto salvare l'id del timer e restituire () => clearTimeout(id) come cleanup; valutare di sostituire il meccanismo window._tnbNav + timeout con un passaggio esplicito di prop/stato da App (es. navPayload consegnato al modulo al mount).

### 110. Validazione input assente lato server: body 'null' fa crashare la function, campi non controllati

- **Dove:** `netlify/functions/report-ai.mjs:43`
- **Area:** Backend / edge functions

Dopo req.json(), il body viene destrutturato direttamente (riga 43) senza verificare che sia un oggetto: un POST con body 'null' (JSON valido, quindi il catch di riga 38 non scatta) fa lanciare TypeError sulla destrutturazione → eccezione non gestita → 500 generico di Netlify senza header CORS, che il frontend mostra come errore criptico. Inoltre nessun campo è validato: domanda può essere undefined (il prompt diventa 'DOMANDA: undefined'), datiProspect può essere una stringa gigante o assente, e non c'è alcun limite di dimensione sul payload serializzato nel prompt.

**Fix proposto:** Dopo il parse: if (!body || typeof body !== 'object' || typeof body.domanda !== 'string' || !body.domanda.trim()) → 400 JSON con CORS; limitare la lunghezza di domanda (es. 2000 caratteri) e la dimensione serializzata di datiProspect/datiClienti/datiOrdini (es. 500 KB) rispondendo 413 oltre soglia.

*Nota verifica: severità riclassificata dal verificatore da *media* a *bassa*.*

### 111. window.storage.delete e window.storage.list: codice morto con esito DELETE mai verificato

- **Dove:** `index.html:724`
- **Area:** Backend / edge functions

window.storage.delete (righe 724-736) non controlla resp.ok: una DELETE respinta da Supabase (es. policy RLS) restituisce comunque {deleted:true} dopo aver rimosso la copia locale, quindi un eventuale chiamante crederebbe la chiave eliminata mentre resta sul server. window.storage.list (737-749) in errore restituisce {keys:[]} indistinguibile da 'nessuna chiave'. Oggi nessuno dei due metodi ha chiamanti nel codice (verificato con grep), quindi l'impatto è nullo ma il contratto ingannevole è una trappola per usi futuri.

**Fix proposto:** Controllare resp.ok nella delete (throw o {deleted:false} su errore HTTP) e distinguere l'errore nella list (es. {keys:null, error:true}); in alternativa rimuovere i due metodi se destinati a restare inutilizzati.

### 112. applicaMovimento è codice morto e diverge da ricalcolaGiacenza

- **Dove:** `index.html:2464`
- **Area:** Integrità dati magazzino

applicaMovimento (riga 2464) non è più chiamata da nessun punto del codice (tutti i flussi usano ricalcolaGiacenza dal v49) ma resta definita con logica divergente: la 'rettifica' è clampata a zero (riga 2517: `Math.max(0, disponibile + q)`) mentre in ricalcolaGiacenza non lo è per-step (riga 2606), e il caso affido replica il doppio decremento. Se venisse riutilizzata (il nome invita a farlo) produrrebbe giacenze diverse dal ricalcolo event-sourced.

**Fix proposto:** Rimuovere applicaMovimento, oppure ridurla a un wrapper che delega a ricalcolaGiacenza per garantire un'unica fonte di verità sulla logica dei movimenti.

### 113. FLUSSO_LOTTO aggirabile: il form di modifica lotto permette qualunque salto di stato senza validazione

- **Dove:** `index.html:15362`
- **Area:** Tracciabilità lotti

I pulsanti rapidi sulla card usano correttamente `FLUSSO_LOTTO` (riga 14908) per proporre solo lo stato successivo, ma il Sel "Stato" nel form di modifica (righe 15361-15369) offre TUTTI gli stati di `STATI_LOTTO` e la `save()` (righe 14695 e seguenti) non valida alcuna transizione: si può portare un lotto da `completato` a `pianificato`, saltare fasi, o marcare `completato` un lotto senza `qtaOlio` né imbottigliamenti. Inoltre `avanzaLottoStato` (riga 14530) applica qualunque `nuovoStato` gli venga passato senza ricontrollare `FLUSSO_LOTTO`. Il workflow a 7 stati dichiarato in guida (riga 25564) è quindi solo cosmetico: la timeline non è una garanzia dello storico reale del lotto.

**Fix proposto:** In `save()` e in `avanzaLottoStato` validare la transizione contro `FLUSSO_LOTTO[statoCorrente]` (accettando al più il salto multiplo in avanti solo con conferma esplicita), oppure limitare le opzioni del Sel "Stato" agli stati raggiungibili dallo stato attuale del lotto.

*Nota verifica: severità riclassificata dal verificatore da *media* a *bassa*.*

### 114. Costi struttura: mesi conteggiati per intero indipendentemente dal giorno

- **Dove:** `index.html:4743`
- **Area:** Costificazione FIFO / costo medio ponderato

Il calcolo dei mesi attivi usa solo anno e mese (`(yF - yI) * 12 + (mF - mI) + 1`): un costo con attivoDal l'ultimo giorno del mese (es. 2026-04-30) conta l'intero aprile, e un costo attivo un solo giorno a cavallo di due mesi conta 2 mensilità. Su importi mensili rilevanti la distorsione del margine netto può valere fino a quasi 2 mensilità per voce.

**Fix proposto:** Prorare il primo e l'ultimo mese in base ai giorni effettivi di sovrapposizione, oppure documentare/forzare che attivoDal/attivoAl siano sempre il primo/ultimo giorno del mese.

### 115. Lista formati hardcoded e duplicata in 6+ punti, già divergente

- **Dove:** `index.html:8174`
- **Area:** Anagrafica prodotti

L'elenco dei formati vendibili è copiato a mano in almeno sei posti: wizard ordini (index.html:8174), Ordini (11198), form SKU Magazzino (14292), CostiMargini (16855), Preventivi (23881), Contratti (24289). Le copie sono già divergenti (16855 e 24289 non hanno "Aceto 20 ml") e nessuna deriva da dati.listino, quindi aggiungere un prodotto/formato reale (es. una nuova monodose o un aceto 250 ml) richiede modifiche sparse nel codice invece di una configurazione.

**Fix proposto:** Estrarre una costante unica (o meglio derivare l'elenco da dati.listino con attivo !== false) e usarla in tutti i moduli.

### 116. Contratti: impossibile inserire righe "Aceto 20 ml"

- **Dove:** `index.html:24289`
- **Area:** Anagrafica prodotti

La lista FORMATI del modulo Contratti/Accordi (index.html:24289) omette "Aceto 20 ml" (presente invece in Ordini e Preventivi): un accordo quadro che includa l'aceto monodose — prodotto a listino con combo dedicata — non può essere registrato con il formato corretto, costringendo a note manuali o formati impropri.

**Fix proposto:** Aggiungere "Aceto 20 ml" alla lista (o riusare la lista formati unificata proposta nel finding sulla duplicazione).

### 117. costiConfig.voci: chiave "20 ml" unica per olio e aceto, non allineata ai formati dei moduli

- **Dove:** `index.html:4445`
- **Area:** Anagrafica prodotti

Il fallback costi ha una sola voce "20 ml" (index.html:4445-4450) condivisa tra olio e aceto (packaging/etichetta identici per ipotesi non dichiarata) e con chiave che non corrisponde ai formati "Olio 20 ml"/"Aceto 20 ml" usati da Ordini/Magazzino/CostiMargini: il PageSummary di CostiMargini itera queste chiavi (16881) cercando SKU con formato "20 ml" mentre i nuovi SKU creati da UI avranno "Olio 20 ml", e il tab Configurazione mostra una voce non riconducibile ai due prodotti distinti.

**Fix proposto:** Sdoppiare la voce in "Olio 20 ml" e "Aceto 20 ml" (con migrazione idempotente della chiave legacy "20 ml") o rimuovere il fallback ora che la fonte di verità è il BOM.

### 118. Annullamento via dropdown non esegue il cleanup di firma/DDT/fatture

- **Dove:** `index.html:11777`
- **Area:** Documenti e flussi

Selezionando "Annullato" dal dropdown "Stato ordine" (riga 11777) e salvando, saveOrdine applica lo stato e genera gli annulli magazzino, ma — a differenza degli altri tre percorsi di annullamento (updateStato 10888, annullaOrdineDiretto 11003, modal lista 12638) — non azzera firma/ddt/fatture sull'ordine né cancella i file. Lo stesso ordine annullato ha quindi contenuto diverso a seconda del percorso usato, e i controlli/rollback basati sulla presenza dei documenti danno esiti incoerenti.

**Fix proposto:** Centralizzare l'annullamento in un'unica funzione (es. annullaOrdineDiretto) e farla usare anche dal percorso dropdown di saveOrdine, oppure escludere "annullato" dalle opzioni del dropdown lasciando solo il bottone dedicato.

### 119. Quick-complete "firma" dalla pagina Oggi non registra la transizione in statoLog

- **Dove:** `index.html:20725`
- **Area:** Documenti e flussi

In OggiAzioni, quickComplete per il tipo "firma" imposta stato: "firmato" direttamente (riga 20725) senza appendere l'entry a statoLog, a differenza di tutti gli altri percorsi di transizione. La timeline dell'ordine (TimelineStato legge statoLog per data/utente, riga 5280) non mostra chi e quando ha firmato, e il Report Attività perde il dettaglio della transizione.

**Fix proposto:** Nel setDati di quickComplete aggiungere l'entry statoLog { stato: "firmato", data, utente: currentUser.username, trigger: "quick_firma", prev } come fanno gli altri percorsi.

### 120. generateModuloPDF è codice morto con logica errata su omaggi e totale

- **Dove:** `index.html:9253`
- **Area:** Documenti e flussi

generateModuloPDF (riga 9188) non è chiamata da nessuna parte (i PDF reali passano da _generaPdfModulo). Contiene però bug latenti pericolosi se venisse riattivata: alla riga 9253 `if (r.omaggio)` marca l'INTERA riga come "Omaggio" senza totale anche quando r.omaggio è solo un extra su una riga venduta (es. 100 vendute + 2 omaggio → totale riga azzerato nel PDF); alla riga 9267 usa `ordine.totale` che non esiste sul modello ordine (il totale si calcola con totOrdine) → imponibile stampato €0.00.

**Fix proposto:** Rimuovere la funzione morta generateModuloPDF (e il suo blocco 9188-9295) per evitare che venga riusata per errore; se serve un fallback, farlo delegare a _generaPdfModulo.

### 121. Consegna ricorrente: valori negativi non bloccati generano schedule corrotto da 200 stacchi

- **Dove:** `index.html:10264`
- **Area:** Validazione e input utente

In RigaConsegnaModal la validazione della modalità ricorrente (riga 10264: !qtaPerStacco || !frequenza || !primaData) blocca solo vuoto e zero, non i negativi: gli input type=number (righe 10315 e 10319) non hanno min. Con qtaPerStacco negativo, generaScheduleRicorrente (righe 2370-2384) entra nel loop dove q = Math.min(negativo, residuo) fa crescere il residuo: il safety cap a 200 evita il freeze ma produce uno schedule di 200 stacchi con quantità negative salvato sulla riga ordine. Con frequenzaGiorni negativa le date degli stacchi vanno all'indietro nel tempo.

**Fix proposto:** Validare qtaPerStacco > 0 e frequenzaGiorni > 0 (e aggiungere min: 1 agli input); in generaScheduleRicorrente uscire subito se qtaPerStacco <= 0 o frequenzaGiorni <= 0.

### 122. Numero ordine pregresso libero: nessun controllo di unicità e possibile interferenza con la numerazione automatica

- **Dove:** `index.html:11729`
- **Area:** Validazione e input utente

Per gli ordini pregressi il campo 'Numero ordine' è testo libero (righe 11728-11732) senza controllo di formato né di unicità: due ordini possono ricevere lo stesso numero (es. '23B') senza alcun avviso, e un numero come '0050/2026' (anno corrente) entra nel pool di nextNum (riga 10662: parseInt sui numeri contenenti '/'+anno), facendo saltare la numerazione automatica a 0051 anche se gli ordini reali sono molti meno — o creando collisioni con numeri già assegnati. I numeri ordine compaiono su conferme, DDT e fatture.

**Fix proposto:** Al salvataggio verificare che form.numero non sia già usato da un altro ordine (warning con conferma esplicita in caso di duplicato) e avvisare quando un numero manuale ricade nel formato NNNN/annoCorrente della numerazione automatica.

### 123. Nessun limite di lunghezza su alcun campo di input dell'app

- **Dove:** `index.html:5776`
- **Area:** Validazione e input utente

Il componente Inp (input a riga 5776, textarea a riga 5759) non supporta né applica maxLength, e nessun form dell'app (note ordine, descrizioni, motivi rettifica, ticket, anagrafiche) impone limiti: una ricerca di 'maxLength' nel file non produce risultati. Ogni carattere digitato finisce nel blob unico 'tnb-pro-v2' che viene ri-serializzato e ri-salvato per intero su Supabase/localStorage a ogni modifica (JSON.stringify a riga 18651): testi molto lunghi (es. incolla accidentale di un documento nelle note) gonfiano permanentemente il payload rallentando tutti i salvataggi successivi — il codice stesso monitora già i salvataggi lenti (riga 18660).

**Fix proposto:** Aggiungere la prop maxLength a Inp (passandola a input/textarea) e impostare limiti ragionevoli nei form (es. 200 caratteri per i campi anagrafici, 2000 per le note), con contatore visivo sui campi lunghi.

### 124. La schermata di login pubblica elenca tutti gli utenti (nome, username, ruolo)

- **Dove:** `index.html:19796`
- **Area:** Autenticazione e permessi

Il box "ACCESSI DISPONIBILI" (righe 19781-19808, `USERS.map(...)`) mostra a chiunque visiti l'URL di produzione — prima di qualsiasi autenticazione — l'elenco completo di nomi reali, username e ruoli (incluso quale account è Super Admin). A prescindere dal problema noto delle password nel bundle, questa è un'esposizione visibile senza nemmeno aprire il sorgente: enumera gli account e indica quello a massimi privilegi.

**Fix proposto:** Rimuovere il box dalla LoginScreen (o al massimo mostrarlo solo dopo il login nella pagina Gestione Utenti, dove le stesse informazioni sono già presenti).

### 125. Login e logout non vengono registrati nel Report Attività

- **Dove:** `index.html:18616`
- **Area:** Autenticazione e permessi

`handleLogin` (righe 18616-18630) e `handleLogout` (18631-18638) non chiamano mai `logAction`: nel log attività (`tnb-log`) non esiste alcuna voce di accesso o uscita, e in tutto il file non c'è nessuna `logAction("Login"...)`. Per un sistema multi-utente la cui tracciabilità è dichiarata requisito (DA-FARE.md, nota 2026-07-09), non è possibile ricostruire chi era collegato e quando, né accorgersi di accessi anomali o di credenziali condivise.

**Fix proposto:** In `handleLogin` chiamare `logAction("Login", "auth", user.username)` (costruendo la entry con l'utente appena autenticato, dato che `currentUser` nello stato non è ancora aggiornato) e in `handleLogout` registrare "Logout" prima di azzerare `currentUser`.

### 126. Font PDF: ~1 MB scaricato da CDN a ogni sessione e conversione base64 byte-per-byte

- **Dove:** `index.html:9336`
- **Area:** Performance

loadPdfFonts scarica 4 TTF (Karla + EB Garamond, centinaia di KB l'uno) da jsdelivr alla prima generazione PDF della sessione — la cache è solo in window._tnbPdfFonts, quindi si ripete a ogni reload — e li converte in base64 con `binary += String.fromCharCode(bytes[i])` in un for byte-per-byte (righe 9333-9337): per ~1 MB di font sono ~1 milione di concatenazioni di stringhe sul main thread, che congelano la UI per centinaia di ms proprio mentre l'utente attende il PDF; il fetch CDN aggiunge latenza e un punto di fallimento esterno (fallback helvetica = documenti esteticamente diversi).

**Fix proposto:** Self-hostare i 4 TTF in /assets (serviti da Netlify con cache HTTP del browser) e convertire a chunk: `String.fromCharCode.apply(null, bytes.subarray(i, i+8192))` in blocchi, oppure usare FileReader.readAsDataURL sul blob; eventualmente precaricare i font in requestIdleCallback dopo il login.

### 127. Logo PNG da ~100-210 KB incorporato a piena risoluzione in ogni PDF generato

- **Dove:** `index.html:9935`
- **Area:** Performance

loadTnbLogo carica assets/logo_tnb_payoff.png (99 KB; la variante nopayoff è 210 KB) e lo converte in dataURL (righe 9299-9313); ogni PDF ordine/privacy lo incorpora com'è (doc.addImage alle righe 9441, 9471, 9987) per stamparlo a soli 11-20 mm di larghezza. Ogni documento generato porta ~100 KB di immagine sovradimensionata: PDF più pesanti da generare, scaricare, allegare alle email e archiviare su Supabase Storage, moltiplicato per ogni ordine.

**Fix proposto:** Creare una versione del logo ridimensionata alla dimensione di stampa reale (es. ~240 px di larghezza, PNG ottimizzato da pochi KB) dedicata ai PDF, oppure ridimensionare runtime una volta sola su canvas prima di cacharlo in window._tnbLogos.

### 128. Validazioni con window.alert bloccante invece del sistema toast usato nel resto dell'app

- **Dove:** `index.html:13189`
- **Area:** Gestione errori e stati vuoti

Il modulo Magazzino usa window.alert per gli errori di validazione (righe 13189, 13192, 13193, 13230, 13231), come pure la liquidazione CV (riga 11104) e i catch dei PDF preventivo/contratto (righe 23929 e 24191), mentre tutto il resto dell'app usa window.tnbToast con stile coerente. Inoltre a riga 13188 saveMov ritorna in silenzio senza alcun messaggio se manca magId o tipo: il click su Salva non produce nulla. Incoerenza UX e popup nativi bloccanti che su alcuni browser/kiosk possono essere soppressi.

**Fix proposto:** Sostituire le chiamate window.alert/alert con window.tnbToast(..., 'err') come nel resto dell'app, e aggiungere un messaggio toast anche al return silenzioso di riga 13188 (es. '⚠ Seleziona prodotto e tipo movimento').

### 129. Ticket bug: fallimento upload dello screenshot ignorato senza avvisare l'utente

- **Dove:** `index.html:18039`
- **Area:** Gestione errori e stati vuoti

Nel BugReportWidget, se l'upload dello screenshot su Supabase fallisce, il catch (righe 18039-18041) chiama salvaTicket(null): il ticket viene creato senza immagine e il toast di conferma '✅ Ticket creato' non segnala nulla. L'utente, che ha visto l'anteprima dello screenshot catturato automaticamente nel modal, crede che sia allegato; chi gestisce il ticket si trova senza il contesto visivo del bug.

**Fix proposto:** Nel catch mostrare un toast dedicato (es. '⚠ Ticket creato ma screenshot non caricato: riprova ad allegarlo') o marcare il ticket con un campo screenshotError, così l'informazione mancante è visibile sia all'autore che al superadmin.

### 130. Copia report AI: promise di clipboard.writeText senza gestione dell'errore

- **Dove:** `index.html:22541`
- **Area:** Gestione errori e stati vuoti

copiaReport (righe 22539-22542) chiama navigator.clipboard.writeText(report).then(...) senza .catch: se la scrittura negli appunti viene rifiutata (permessi negati, documento non focalizzato, contesto non sicuro) si genera una unhandled promise rejection visibile solo in console e l'utente non riceve né il toast '📋 Report copiato' né un messaggio di errore — il click sembra semplicemente non fare nulla.

**Fix proposto:** Aggiungere .catch(function(){ window.tnbToast('⚠ Copia non riuscita — seleziona e copia manualmente il testo', 'err'); }) alla promise di writeText.

### 131. Pulsanti "sm" con altezza ~24px e azioni di riga a 4px di distanza: target touch insufficienti

- **Dove:** `index.html:5674`
- **Area:** Accessibilità e usabilità

La taglia `sm` di Btn ha padding "4px 12px" e font 12 (righe 5675-5678) → altezza effettiva ~23-25px, circa metà dei 44-48px raccomandati per il touch. È la taglia usata per le azioni di riga della tabella Ordini, affiancate con `gap: 4` (riga 11296): PDF, modifica, 🗑 elimina e select pagamento sono contigui. Altrove il cestino è addirittura una `<span>` emoji a font 12 (riga 22836, materiali marketing) o 10 (riga 23575). Su tablet — il contesto d'uso dichiarato (firme, consegne) — un dito medio copre 2-3 controlli, con rischio concreto di aprire l'eliminazione al posto della modifica.

**Fix proposto:** Portare i pulsanti di riga ad area cliccabile minima ~36-44px (padding verticale maggiore o min-height con area estesa), aumentare il gap ad almeno 8-10px e separare visivamente il 🗑 dagli altri; sostituire le span-emoji cliccabili con veri `<button>` con padding.

### 132. Modal principale non chiudibile con Escape (incoerente con i dialog di conferma)

- **Dove:** `index.html:5849`
- **Area:** Accessibilità e usabilità

Il componente `Modal` (righe 5849-5925) usato per tutti i form dell'app non ha alcun listener tastiera: Escape non chiude (l'unico useEffect resetta lo scroll, righe 5857-5860) e il backdrop non è cliccabile. I dialog `tnbConfirm` invece si chiudono con Escape (riga 1423) e col click sul backdrop (riga 1426): l'utente impara un comportamento nella conferma e se lo ritrova negato in tutti i form. Manca inoltre qualsiasi gestione del focus (nessun focus trap, nessun `role="dialog"`): con Tab si finisce sui controlli sotto l'overlay.

**Fix proposto:** Aggiungere nel Modal un useEffect con listener `keydown` che su Escape chiami `onClose` (comportamento sicuro: i form non salvano nulla alla chiusura), più `role: "dialog"` e `aria-modal: true` sul contenitore. Il click sul backdrop può restare disabilitato per evitare perdite accidentali di dati digitati.

### 133. Login: niente autocomplete/form per i password manager e Invio inattivo nel campo username

- **Dove:** `index.html:19701`
- **Area:** Accessibilità e usabilità

Il form di login non è un `<form>` e i campi non hanno attributi `name`/`autocomplete`: l'input password (righe 19701-19714) è privo di `autocomplete="current-password"` e lo username usa il generico `Inp` (riga 19679) senza `autocomplete="username"`. I password manager dei browser spesso non propongono salvataggio/compilazione automatica, spingendo utenti non tecnici ad annotarsi le credenziali. Inoltre Invio funziona solo nel campo password (riga 19705): premendo Invio nel campo username non succede nulla, perché `Inp` non supporta `onKeyDown`.

**Fix proposto:** Avvolgere i campi in un `<form onSubmit>` con `autocomplete="username"` e `autocomplete="current-password"` sui rispettivi input e un `<button type="submit">`: si ottengono gratis sia i password manager sia Invio-per-accedere da entrambi i campi.

### 134. Guida Clienti: istruzione di eliminazione cliente obsoleta e non eseguibile dai non-SuperAdmin

- **Dove:** `index.html:25549`
- **Area:** Guide e testi

La guida dice "Non puoi eliminare un cliente che ha ordini associati — prima elimina gli ordini". È doppiamente inesatta: (1) dal fix tkt_1781162734882 gli ordini ANNULLATI non bloccano più l'eliminazione e vengono rimossi insieme al cliente (index.html:8963-8973); (2) l'eliminazione di un ordine è riservata al SuperAdmin (`deleteOrdine`, index.html:10843-10845), quindi per un admin/commerciale l'istruzione "prima elimina gli ordini" non è percorribile — la via reale è annullare gli ordini.

**Fix proposto:** Aggiornare il testo: "Non puoi eliminare un cliente con ordini attivi: prima annullali (gli ordini annullati vengono rimossi insieme al cliente). L'eliminazione diretta degli ordini è riservata al SuperAdmin."

### 135. Sezione guida "Accordi Fornitori" (contratti) esclusa dall'indice della GuidaPage

- **Dove:** `index.html:25651`
- **Area:** Guide e testi

GUIDA_CONTENUTI contiene la sezione `contratti` ("Accordi Fornitori", index.html:25596-25599), ma l'array `sezioni` di GuidaPage (index.html:25651) non la include: la sezione non compare né nell'indice né nella navigazione avanti/indietro della guida completa. Il modulo Contratti però è tuttora raggiungibile dall'app: dalla scheda fornitore si naviga con `window._nav("contratti")` (index.html:16582) e la pagina è renderizzata (index.html:19201). Un utente che ci arriva e apre la "guida completa" non trova la sezione corrispondente.

**Fix proposto:** Aggiungere "contratti" all'array `sezioni` di GuidaPage (eventualmente in coda, vicino a fornitori), oppure — se il modulo resta nascosto di proposito — rimuovere anche il link di navigazione da Fornitori per coerenza.

### 136. Guida Agenda: "i 5 KPI aprono il modulo filtrato" ma 3 su 5 non fanno nulla o quasi

- **Dove:** `index.html:25529`
- **Area:** Guide e testi

La sezione oggi di GUIDA_CONTENUTI dice "I 5 KPI in alto (Scadute, Oggi, Prossime, Da firmare, Da riscuotere) sono cliccabili e aprono il modulo filtrato" (analogo claim nell'intro, index.html:25519). Nel codice `kpiClick` (index.html:20966-20972) i click su "scadute" e "oggi" sono no-op (commenti "already visible"), "prossimi" si limita ad allargare l'orizzonte a 3 giorni; solo "firma" e "pagamento" aprono davvero il modulo Ordini filtrato. L'utente clicca Scadute/Oggi aspettandosi una navigazione che non avviene.

**Fix proposto:** Correggere il testo: "I KPI 'Da firmare' e 'Da riscuotere' aprono Ordini già filtrato; 'Prossime' estende l'orizzonte; 'Scadute' e 'Oggi' sono già visibili nella pagina" (oppure implementare uno scroll/filtn reale sui primi tre KPI).

### 137. Guida Report Periodo: consiglia il preset "ultimi 7gg" che non esiste

- **Dove:** `index.html:25604`
- **Area:** Guide e testi

La sezione report di GUIDA_CONTENUTI elenca correttamente i preset ("questo mese, ultimi 30gg, 90gg, anno corrente") ma poi nei suggerimenti dice "Usa il report settimanale (ultimi 7gg) per la riunione del lunedì mattina". In ReportPeriodo i preset reali sono solo Questo mese / Ultimi 30gg / Ultimi 90gg / Anno corrente (index.html:21688-21716): il periodo di 7 giorni va impostato a mano con le date Dal/Al, cosa che la guida non spiega.

**Fix proposto:** Riformulare il suggerimento: "Per il report settimanale imposta manualmente le date Dal/Al sugli ultimi 7 giorni (non esiste un preset dedicato)", oppure aggiungere un preset "Ultimi 7gg" in ReportPeriodo.

### 138. Nomi dei movimenti nella guida DDT non corrispondono alle etichette dell'interfaccia

- **Dove:** `docs/Guida-DDT-Magazzino.md:34`
- **Area:** Guide e testi

Le tabelle §2 usano nomi diversi da quelli che l'operatore vede nel menu "Tipo movimento" (TIPI_MOV, index.html:13144-13186): "Affido allo spedizioniere" vs "🚛 Affidato allo spedizioniere" (index.html:13164), "Scarico per ordine" vs "📤 Scarico automatico per ordine" (index.html:13173), "Carico da produzione interna" vs "🫒 Carico da produzione" (index.html:13179). Chi cerca nel menu la voce col nome scritto in guida non la trova con lo stesso testo.

**Fix proposto:** Allineare i nomi dei movimenti nelle tabelle §2 alle etichette esatte di TIPI_MOV ("Affidato allo spedizioniere", "Scarico automatico per ordine", "Carico da produzione").

### 139. Guida Doppioni: il pulsante indicato ("Scansione doppioni") in Pipeline si chiama "🔍 Doppioni"

- **Dove:** `index.html:25544`
- **Area:** Guide e testi

La sezione doppioni di GUIDA_CONTENUTI istruisce: "Pipeline → clicca 'Scansione doppioni' nella barra superiore". Nella barra della Pipeline il pulsante reale è etichettato "🔍 Doppioni" (index.html:7159); "Scansione doppioni" è solo il titolo del modal che si apre dopo (index.html:7729). Piccola incoerenza terminologica guida/UI che può far cercare un pulsante inesistente.

**Fix proposto:** Correggere il passo 1 della guida in: "Pipeline → clicca il pulsante '🔍 Doppioni' nella barra superiore (si apre la 'Scansione doppioni prospect')".

### 140. getTnbIban mai chiamata: il PDF usa l'alias legacy statico TNB_IBAN

- **Dove:** `index.html:9515`
- **Area:** Coerenza generale del codice

getTnbIban (riga 9411) è stata introdotta per leggere l'IBAN da window._tnbAzienda (override utente di dati.azienda) ma non è mai invocata in tutto il file. Il blocco 'Pagamento' dei PDF ordine (riga 9515) usa l'alias legacy TNB_IBAN (riga 9412), congelato ad AZIENDA_DEFAULTS.iban. A differenza di tutta l'altra anagrafica PDF (che passa da getTnbAnag e rispetta gli override), un eventuale dati.azienda.iban diverso (es. importato da backup o aggiunto in futuro al form Dati Aziendali, che oggi non espone il campo IBAN) verrebbe ignorato nei documenti con istruzioni di bonifico.

**Fix proposto:** Sostituire TNB_IBAN con getTnbIban() a riga 9515, rimuovere l'alias TNB_IBAN ormai unico consumatore, e valutare l'aggiunta del campo IBAN al form Dati Aziendali per chiudere il cerchio.

*Nota verifica: severità riclassificata dal verificatore da *media* a *bassa*.*

### 141. Codice morto: due Card disattivate con 'null &&' che tengono in vita stub legacy sempre-0

- **Dove:** `index.html:17405`
- **Area:** Coerenza generale del codice

In CostiMargini le due sezioni 'PARAMETRI PRODUZIONE (stima)' e 'COSTI PER FORMATO' sono disattivate permanentemente con 'null && React.createElement(...)' (righe 17405 e 17449, ~100 righe mai renderizzate), nonostante il commento a righe 17403-17404 dica che sono state 'DEFINITIVAMENTE rimosse'. Sono gli unici call site degli stub legacy costoOlioPerLitro e costoFormato (righe 4458-4459) che ritornano sempre 0: chi riattivasse per errore quelle Card vedrebbe costi a 0,00 € plausibili ma fasulli.

**Fix proposto:** Eliminare i due blocchi 'null && ...' (righe 17405-17449 e 17449-17510) e con essi gli stub costoOlioPerLitro/costoFormato a righe 4458-4459, non più referenziati da codice vivo.

### 142. CANALI_LABEL locale mai usata e con chiavi incompatibili con la mappa canonica CANALE

- **Dove:** `index.html:6905`
- **Area:** Coerenza generale del codice

La costante locale CANALI_LABEL nella Pipeline (riga 6905) non è referenziata da nessuna parte (unica occorrenza nel file) e le sue chiavi contraddicono la mappa canonica CANALE (riga 5418): usa 'email' e 'contatto_aziendale' che non esistono in CANALE (che ha 'email_in'), e omette linkedin, campagna_m, irene, lucia, nb. Se qualcuno la usasse credendola la mappa dei canali, metà dei prospect resterebbe senza label.

**Fix proposto:** Eliminare la costante CANALI_LABEL a riga 6905; per le label dei canali usare sempre la mappa CANALE già esistente.

### 143. Funzione getScaglioneLabel definita ma mai chiamata

- **Dove:** `index.html:5593`
- **Area:** Coerenza generale del codice

getScaglioneLabel (righe 5593-5600) calcola l'etichetta dello scaglione ('N colli') dal listino hardcoded, ma non ha alcun call site nel file: è codice morto che oltretutto legge solo la const LISTINO, quindi se venisse riusata ignorerebbe il listino editabile dati.listino, propagando l'incoerenza già presente in getPrezzoListino.

**Fix proposto:** Rimuovere la funzione; se in futuro servisse l'etichetta scaglione, reimplementarla sopra getListino(formato, dati).

### 144. Ternario con rami identici su ddtDoc nel salvataggio movimento magazzino

- **Dove:** `index.html:13205`
- **Area:** Coerenza generale del codice

In saveMov la riga 13205 è 'ddtDoc: movRichiedeDDT(form.tipo) ? (form.ddtDoc || null) : (form.ddtDoc || null)': i due rami sono identici, quindi il ternario è inutile. Confrontata con la riga precedente 13204 (che per ddtNum normalizza con trim solo quando il DDT è richiesto), sembra perso l'intento originale di azzerare/ignorare il documento DDT per i movimenti interni che non lo richiedono: un file caricato e poi cambiato tipo movimento resta allegato al movimento.

**Fix proposto:** Chiarire l'intento: o semplificare in 'ddtDoc: form.ddtDoc || null', o (più coerente con la regola DDT) usare 'movRichiedeDDT(form.tipo) ? (form.ddtDoc || null) : null' per non salvare documenti su movimenti interni.

### 145. Doppio nome campo skuId/magId sui movimenti magazzino mantenuto anche nel codice nuovo

- **Dove:** `index.html:13123`
- **Area:** Coerenza generale del codice

I movimenti hanno storicamente due nomi per lo stesso campo: il codice nuovo scrive entrambi (es. righe 13123-13124 'skuId: rettForm.magId, magId: rettForm.magId', e analoghi a 2873-2874, 14662-14663) e ~25 punti di lettura usano il pattern difensivo '(mv.skuId || mv.magId)' (es. 2631, 13219, 13486, 17068), nonostante esista già una migrazione che normalizza skuId al load (riga 1966). Il doppio alias rende fragile ogni nuova query: alcuni punti leggono solo mv.skuId (es. 11119, 2849) e funzionano solo perché operano su movimenti appena creati.

**Fix proposto:** Consolidare su skuId: la migrazione a riga 1966 già lo garantisce al load, quindi smettere di scrivere magId nei nuovi movimenti, sostituire i fallback '(mv.skuId || mv.magId)' con mv.skuId e rimuovere gradualmente l'alias.

---

## Appendice — Finding scartati dalla verifica avversariale (5)

- **[Integrità dati magazzino] Annullamento ordine cancella i file DDT da Storage ma i movimenti in Archivio DDT li referenziano ancora** (`index.html:11006`) — Il meccanismo centrale del finding è un falso positivo. (1) annullaOrdineDiretto passa a applicaTransizioneOrdineMagazzino l'ordine GIÀ svuotato (riga 11026 'ddt: []', riga 11030), quindi ddtFromOrdine a riga 2861 restituisce ddtDoc=null e la riga 2871 non copia alcun path dall'ordine. (2) Gli scarico_ordine sono generati solo alla prima transizione → firmato (2843-2852) copiando ddtFromOrdine in quel momento, ma l'upload DDT è disponibile solo con stato consegnato/fatturato (riga 12272; wizard 12798+; updateStato blocca consegnato senza DDT a 10880-10885): al momento dello scarico l'ordine non ha DDT, quindi i movimenti hanno ddtDoc=null e l'annullo eredita null — nessun link rotto nell'Archivio DDT nel flusso descritto. (3) I movimenti 'consegnato'/'affido_spedizioniere' usano documenti caricati ad hoc nel form Magazzino (13191-13210), non i file dell'ordine. L'unico vettore reale di path pendente è resa_cv (2810/2822, ddtDoc copiato quando il DDT esiste) + successivo annullamento: caso diverso e più stretto, non quello descritto. (4) La parte sui movimenti orfani è vera (eliminazione cliente 8948/8975 e deleteOrdine 10862 non toccano movimenti) ma benigna: l'Archivio DDT mostra '—' se l'ordine manca (14022-14025), il numero ordine è già denormalizzato nella nota del movimento (2756, 2867), e l'eliminazione cliente richiede ordini tutti annullati (8964-8967) quindi giacenza a saldo zero. La descrizione non è sostanzialmente corretta → scartato.
- **[Costificazione FIFO / costo medio ponderato] Annata target sbagliata (+1) nel tab Per Formato: prezzo listino preso dallo SKU errato** (`index.html:16854`) — Il +1 esiste ed è semanticamente incoerente con i dati (dataToCampagna righe 4688-4692: oggi 2026-07 → campagna 2025; magazzino seed righe 2901-3044 usa annata "2025"), ma l'impatto denunciato non si verifica: in tutte e tre le occorrenze (16861, 16885, 17032) il prezzo è `(listEntry && listEntry.pubblico) || (sku && sku.prezzoListino) || 0`, e getListino (5551-5582) risolve SEMPRE per i formati iterati — legge dati.listino (popolato da migrateV52CostiMargini, 2235-2263) e in fallback la const LISTINO (5434-5544), che copre tutti i formati di FORMATI (16855) e di costiConfig.voci (4414-4451) con pubblico > 0 (es. 500 ml = 28,00 €). Il ramo `sku.prezzoListino` con la ricerca per annata è quindi codice morto per ogni formato processato: margini per formato e alert "venduti sotto costo" usano il prezzo di listino indipendente dall'annata, mai i 19,50/16,50 € citati nell'esempio dell'auditor. L'unico formato dove il fallback SKU conterebbe è "Olio 20 ml", che non matcha né listino né magazzino (che usa "20 ml") → prezzo 0 a prescindere dal +1 (problema diverso, di naming). Anche il reset Go-Live (25455-25471) svuota listino e magazzino insieme, senza creare lo scenario descritto. Bug mitigato/irraggiungibile nella pratica → finding scartato.
- **[Scadenze e rotazione] Attribuzione ricavi per lotto dichiarata 'FIFO implicito' ma in realtà proporzionale: margini per lotto distorti** (`index.html:4614`) — Il meccanismo descritto è vero (righe 4593-4615: quota = qtaCaricataLotto/qtaCaricataTot e ricavoLotto = ricavoSku * quota, senza ordinamento temporale), ma il finding è da scartare perché il problema è già mitigato/documentato esattamente nel modo che l'auditor stesso propone come fix alternativo. (1) Il commento in testa alla funzione (righe 4544-4547) dichiara esplicitamente: "LIMITE FIFO IMPLICITO: se più lotti hanno caricato lo stesso skuId, non sappiamo con certezza quale lotto ha fornito le bottiglie... Distribuiamo i ricavi proporzionalmente... Documentato qui" — il codice non spaccia l'attribuzione per FIFO. (2) Soprattutto, il tab "Per Lotto" mostra all'utente un disclaimer visibile (righe 17601-17604): "Se più lotti hanno caricato lo stesso SKU, i ricavi sono attribuiti proporzionalmente alla quota di carico_produzione di ciascun lotto" — quindi i numeri non sono presentati come tracciabilità FIFO esatta ma come stima proporzionale dichiarata. (3) L'unica incongruenza residua è la locuzione "(FIFO implicito, documentato)" nel changelog interno a riga 1321, un'etichetta imprecisa in un commento non user-facing: questione di documentazione/stile, non un bug di severità media. (4) Inoltre una "vera attribuzione FIFO" non sarebbe comunque una verità di tracciabilità ma un'altra stima: i movimenti scarico_ordine vengono generati con lottoId: null (riga 2767), quindi il modello dati non registra da quale lotto escono fisicamente le bottiglie; la scelta proporzionale è una strategia di stima consapevole e dichiarata a fronte di un limite strutturale del modello dati. La descrizione del finding ("dichiarata FIFO ma in realtà proporzionale: margini distorti") omette entrambe le mitigazioni esistenti e quindi non è sostanzialmente corretta.
- **[Anagrafica prodotti] skuPerRiga ignora il campo prodotto: olio e aceto 20 ml indistinguibili** (`index.html:2647`) — Il meccanismo descritto esiste (index.html:2647-2662: skuPerRiga matcha solo formato+annata e mags.find prende il primo) e i due SKU collidenti esistono davvero nel seed (m8 "Olio Fata Morgana"/"20 ml"/"2025" a 3021-3024; m9 "Aceto Fata Morgana"/"20 ml"/"2025" a 3038-3041). Ma lo scenario di danno affermato — riga che matcha "20 ml" aggancia sempre m8 e uno scarico aceto finisce sulla giacenza olio — è irraggiungibile: nessuna riga ordine può avere formato "20 ml". Tutti i punti che creano righe ordine usano Sel a opzioni vincolate con etichette distinte "Olio 20 ml" e "Aceto 20 ml" (wizard 8174/8252, form Ordini 11198 + Sel a 11900-11903, punto vendita 23881, contratti 24289/24818); nessun flusso copia il formato dal magazzino nella riga (grep su formato: *.formato senza match) e nessuna riga seed ha formato "20 ml" (le uniche occorrenze sono m8/m9 stessi, più tabelle costi/listino a 4445/5502/9388 che non sono righe ordine). Per una riga "Olio 20 ml"/"Aceto 20 ml" tutti e tre i livelli di match falliscono (esatto: stringhe diverse; normalizzato: "olio 20 ml" ≠ "20 ml"; formato-only a 2666-2668 richiede annata magazzino vuota, ma m8/m9 hanno "2025") → skuPerRiga ritorna null e il caso è gestito esplicitamente: verificaDisponibilitaOrdine segnala errore "sku_mancante" (2697-2710, chiamato a 10769 e 20711) e generaMovimentiOrdine salta la riga (2750-2751). Il difetto reale è quindi diverso e opposto: ENTRAMBI gli SKU 20 ml (olio E aceto) sono non agganciabili dagli ordini per mismatch di etichetta formato, con errore visibile, non una registrazione silenziosa sul prodotto sbagliato. La descrizione del finding ("scarico di aceto registrato sulla giacenza dell'olio", "m9 irraggiungibile mentre m8 viene sempre agganciato") non corrisponde al comportamento reale → scartato come falso positivo nello scenario di impatto. Il problema del mismatch "Olio/Aceto 20 ml" vs "20 ml" non risulta tracciato in DA-FARE.md e meriterebbe un finding separato, formulato correttamente.
- **[Performance] Input inline salvano l'intero database a ogni tasto premuto** (`index.html:17424`) — Falso positivo: i campi citati sono codice morto mai renderizzato. La Card che contiene i tre Inp "Costo olive"/"Resa media"/"Costo frangitura" (righe 17420-17434) è preceduta da "null && React.createElement(Card, ...)" alla riga 17405, e la Card "COSTI PER FORMATO" con updVoce (riga 17490) è anch'essa dietro "null &&" alla riga 17449: l'operatore && corto-circuita, quindi createElement non viene mai eseguito e quegli input non esistono nella UI. Il commento alle righe 17403-17404 lo conferma esplicitamente: "v52-C6: le 2 sezioni legacy PARAMETRI PRODUZIONE (stima) e COSTI PER FORMATO sono state DEFINITIVAMENTE rimosse. Fonte unica BOM". Un grep sull'intero index.html mostra che updCfg (def. riga 16797) e updVoce (def. riga 16804) hanno come UNICI call site le righe 17424/17429/17434/17490, tutte dentro i blocchi morti: nessun percorso vivo può invocarle. È vero che setDatiSave (riga 18641) serializza l'intero stato e persiste via window.storage.set a ogni chiamata (righe 18651-18654), ma lo scenario descritto ("digitare 12.50 produce 5 salvataggi completi") è impossibile perché i campi non sono mai montati; resta al più codice morto da ripulire, non un problema di performance reale.

# Guida operativa — Gestione Magazzino con DDT

**Tenute Nonno Bruno — Gestionale Pro**
Documento per l'operatore · Versione del processo: giugno 2026

---

## 1. La regola in una riga

> **Nessun prodotto entra o esce dal magazzino senza un numero di DDT e il documento archiviato digitalmente.**

Ogni volta che della merce si muove **fisicamente** dentro o fuori dall'azienda, il sistema richiede:

1. il **numero del DDT** (Documento di Trasporto);
2. il **file del documento** (PDF o foto/scansione), che viene salvato in archivio.

Finché mancano questi due dati, **l'operazione non si può registrare**. In questo modo ogni movimento di merce è sempre tracciabile e collegato al suo documento.

---

## 2. Quali movimenti richiedono il DDT

### 📥 Entrate (la merce arriva in magazzino)
| Movimento | Quando si usa |
|---|---|
| **Carico (nuova produzione)** | Ingresso di prodotto finito nuovo |
| **Carico da produzione** | Carico in magazzino dei lotti imbottigliati |
| **Resa conto vendita** | Reso di merce da un cliente in conto vendita |
| **Annullo scarico ordine** | Rientro merce per annullamento di un ordine firmato |

### 📤 Uscite (la merce lascia il magazzino)
| Movimento | Quando si usa |
|---|---|
| **Affidato allo spedizioniere** | La merce viene consegnata al corriere |
| **Scarico automatico per ordine** | Scarico automatico alla firma dell'ordine |
| **Consegnato al cliente** | Conferma di avvenuta consegna |

---

## 3. Quali movimenti NON richiedono il DDT

Questi movimenti **non** spostano merce dentro/fuori dall'azienda, quindi si registrano liberamente:

- Frantoio completato, Etichettatura completata, Confezionamento completato *(passaggi interni di lavorazione)*
- Riserva per ordine / Annulla riserva *(blocco interno di disponibilità)*
- Rettifica manuale *(correzione di inventario — richiede comunque un motivo)*
- Scarico manuale / perdita *(rottura, ammanco, omaggio: non è un trasporto)*

---

## 4. Registrare un'ENTRATA o un'USCITA con DDT (passo-passo)

1. Vai in **Magazzino → ⚡ Movimento** (oppure usa i pulsanti rapidi sulla card di un SKU).
2. Seleziona lo **SKU** e il **tipo di movimento**.
3. Inserisci la **quantità** e la **data**.
4. Se il movimento richiede il DDT, compare un riquadro azzurro **« 🚚 DDT obbligatorio »**:
   - scrivi il **Numero DDT** (es. `42/2026`);
   - premi **📎 Carica documento DDT** e seleziona il PDF o la foto del documento.
   - Quando il file è caricato compare **✅ con il nome del documento**.
5. Premi **Registra movimento**.

> ⚠️ Se provi a registrare senza numero o senza documento, il sistema **blocca** l'operazione e ti avvisa cosa manca.

---

## 5. Carico da produzione (dai lotti al magazzino)

Quando carichi in magazzino un imbottigliamento prodotto:

1. Vai in **Produzione → apri il lotto → imbottigliamenti**.
2. Premi **📥 Carica** sull'imbottigliamento.
3. Si apre la finestra **« Carico in magazzino — DDT obbligatorio »**:
   - inserisci il **Numero DDT**;
   - carica il **documento DDT**.
4. Premi **📥 Conferma carico**.

Il prodotto entra in magazzino solo dopo che il DDT è stato inserito e archiviato.

---

## 6. Uscite legate agli ordini

Gli ordini hanno una **gestione DDT propria**, a livello di documento dell'ordine.

- Alla **firma** dell'ordine, il sistema scarica automaticamente la merce dal magazzino.
- L'ordine **non può passare a « Consegnato » o « Fatturato »** se non è stato **allegato almeno un DDT** all'ordine. In quel caso compare l'avviso:
  > ⛔ *Allega prima il DDT all'ordine: la merce non può uscire senza documento di trasporto.*
- I movimenti di magazzino generati dall'ordine (scarico, resa, annullo) vengono **automaticamente collegati al DDT dell'ordine** e compaiono nell'Archivio DDT.

**Come allegare il DDT a un ordine:** apri l'ordine → sezione documenti → carica il DDT (numero nella nota DDT + file).

---

## 7. Archivio DDT

In **Magazzino → 🚚 Archivio DDT** trovi l'elenco completo di tutte le entrate e uscite con DDT:

- **Riepilogo in alto:** quanti DDT sono archiviati e quanti movimenti sono ancora **senza DDT (da regolarizzare)**.
- **Filtri:** per direzione (📥 Entrate / 📤 Uscite) e ricerca per numero DDT, SKU o numero ordine.
- **Per ogni riga:** data, direzione, numero DDT, tipo movimento, SKU, quantità, ordine collegato e pulsante **🚚 Apri** per visualizzare il documento.

I movimenti evidenziati in **rosso « ⚠ mancante / assente »** sono operazioni di entrata/uscita registrate **prima** dell'attivazione di questa regola, oppure ordini ancora privi di DDT: vanno regolarizzati allegando il documento.

---

## 8. Domande frequenti

**Devo avere il file del DDT pronto prima di registrare il movimento?**
Sì. Numero e documento sono entrambi obbligatori. Tieni il PDF o una foto/scansione del DDT a portata di mano.

**Posso usare una foto del DDT cartaceo?**
Sì: sono accettati sia PDF sia immagini (foto/scansione).

**Una rettifica di inventario richiede il DDT?**
No. Le rettifiche richiedono solo il **motivo** obbligatorio (es. inventario, rottura).

**Una perdita/rottura richiede il DDT?**
No. Lo « Scarico manuale / perdita » non è un trasporto, quindi non richiede DDT.

**Cosa succede ai movimenti vecchi senza DDT?**
Restano validi ma vengono segnalati nell'Archivio DDT come « da regolarizzare », così puoi recuperarli con calma allegando il documento.

---

*Per assistenza sul gestionale contattare il referente tecnico.*

# Tenute Nonno Bruno, dossier dati per la strategia commerciale della campagna 2026

**Data di estrazione:** 7 settembre 2026
**Fonte:** database Supabase `NonnoBruno`, stato applicativo `app_kv / tnb-pro-v2` (fonte di verità del gestionale in produzione) più le tabelle relazionali `produzione`, `magazzino_sku`, `prodotti`.
**Perimetro:** 54 ordini, 30 clienti, 960 prospect, 10 SKU a magazzino, 5 voci di listino attivo, 11 fornitori.

> **Istruzioni per chi legge (ChatGPT o altro assistente).** Questo documento contiene solo dati verificati estratti dal gestionale, più i calcoli derivati esplicitamente segnalati come tali. Dove un dato manca è scritto che manca: non inventarlo, chiedilo. La sezione 12 elenca le lacune da colmare prima di fissare numeri di budget. La sezione 13 dice cosa serve produrre.

---

## 1. identità dell'azienda e del prodotto

| Voce | Dato |
|---|---|
| Ragione sociale | Tenute Nonno Bruno, Società Agricola S.r.l. |
| Sede | Via del Fornaccio 40, 50012 Bagno a Ripoli (FI) |
| Partita IVA | IT07267640485 |
| Payoff | «L'olio nell'anima» |
| Sito | www.tenutenonnobruno.it |
| Referente commerciale | Irene Paggetti, Key Account Manager HoReCa & Retail, 338 1427611 |
| Certificazioni | Biologico, Toscano IGP |
| Prodotto principale | Olio EVO «Olio della Fata Morgana» |
| Blend | Frantoio, Moraiolo, Leccino |
| Metodo | raccolta manuale, frangitura a freddo entro poche ore |
| Secondo prodotto | Aceto di vino rosso, formato monodose 20 ml |
| Premio | Japan Olive Oil Prize, Gold 2026 (monodose olio + aceto) |

Formati a catalogo: 100 ml, 250 ml, 500 ml, latta 3 L, latta 5 L, monodose olio 20 ml, monodose aceto 20 ml.

---

## 2. il fatto centrale: lo stock supera di molto la velocità di vendita

Questo è il vincolo attorno a cui va costruita la strategia. Tutto il resto ne discende.

| Grandezza | Valore |
|---|---|
| Olio a magazzino oggi (litri equivalenti) | **1.728,8 L** |
| Venduto negli ultimi 8 mesi (gen-ago 2026) | 302,4 L |
| Ritmo medio di vendita 2026 | **37,8 L al mese** |
| Copertura dello stock attuale al ritmo corrente | **circa 45,7 mesi, cioè 3,8 anni** |
| Litri della raccolta 2024 ancora invenduti | **805,0 L** (46,6% dello stock) |
| Litri della raccolta 2025 ancora invenduti | 923,8 L (53,4% dello stock) |

La frangitura 2026 arriva su questa base. Se la nuova campagna avesse un volume simile alla precedente (stima ricostruita: circa 1.350 L nel 2025, vedi sezione 3), lo stock post frangitura salirebbe intorno ai **3.000 litri**, pari a circa 6,7 anni di vendite al ritmo attuale.

**Per svuotare il magazzino esistente in dodici mesi servirebbero 144 L al mese: 3,8 volte il ritmo di oggi.** Se l'obiettivo è invece smaltire il magazzino esistente più la nuova produzione entro due anni, servono circa 125 L al mese, cioè un fattore 3,3.

Il problema secondario, ma urgente, è l'anzianità: 805 litri sono raccolta 2024, quindi a novembre 2026 avranno due campagne alle spalle. Un olio EVO di due annate prima è ancora vendibile ma non è più raccontabile come «novello» e regge male il prezzo pieno.

---

## 3. produzione e resa

**Attenzione, dato parzialmente mancante.** La sezione Produzione del gestionale (tabelle `lotti` e `bottiglie`, che alimentano la distinta base) è **vuota**: nessun lotto reale è stato registrato. La tabella relazionale `produzione` contiene due righe (2024 «Prima raccolta TNB», 2025 «Seconda raccolta TNB») con kg olive, litri, resa e date tutti a `null`.

Le uniche cifre di produzione ricostruibili derivano dalla somma di giacenza più venduto per annata:

| Annata | Venduto (L) | Giacenza residua (L) | **Produzione minima stimata (L)** |
|---|---|---|---|
| 2024 | 123,5 | 805,0 | **≥ 928,5** |
| 2025 | 424,4 | 923,8 | **≥ 1.348,2** |

Sono stime al ribasso: non tengono conto di olio ceduto sfuso, autoconsumo, cali, rotture o omaggi non registrati come righe d'ordine.

I parametri di riferimento presenti nel codice come valori di default (non come dati reali di campagna) sono: costo olive 2,80 €/kg, resa media 14,5%, costo frangitura 18,00 € per 100 kg di olive. Vanno confermati con le fatture del frantoio prima di usarli in un conto economico.

Il frantoio conto terzi è tracciato tra i fornitori (categoria `frantoio`) con fatture caricate per molitura e imbottigliamento, novembre e dicembre 2025. Gli importi non sono digitalizzati nei campi del gestionale, restano dentro i PDF.

---

## 4. magazzino, dettaglio per SKU

| Formato | Annata | Disponibili (pz) | Litri eq. | Prezzo listino | Valore a listino |
|---|---|---|---|---|---|
| 500 ml | 2024 | 798 | 399,0 | 16,50 € | 13.167,00 € |
| 5 L latta | 2025 | 87 | 435,0 | 85,00 € | 7.395,00 € |
| 3 L latta | 2025 | 111 | 333,0 | 55,00 € | 6.105,00 € |
| 5 L latta | 2024 | 47 | 235,0 | non valorizzato | n.d. |
| 3 L latta | 2024 | 57 | 171,0 | non valorizzato | n.d. |
| 250 ml | 2025 | 311 | 77,8 | 13,00 € | 4.043,00 € |
| 500 ml | 2025 | 105 | 52,5 | 19,50 € | 2.047,50 € |
| Olio 20 ml | 2025 | 664 | 13,3 | 2,00 € | 1.328,00 € |
| Aceto 20 ml | 2025 | 613 | 12,3 | 2,00 € | 1.226,00 € |
| 100 ml | 2025 | **0** | 0,0 | 9,00 € | 0,00 € |
| **Totale** | | **2.793 pz** | **1.728,8 L** | | **35.311,50 €** (parziale) |

Note operative rilevanti:

- il **100 ml è esaurito**, ed è il formato con la resa per litro più alta di tutto il catalogo (vedi sezione 6). È una rottura di stock su un articolo redditizio;
- le due latte annata 2024 (104 pezzi, 406 litri, quasi un quarto dello stock totale) **non hanno prezzo di listino impostato**, quindi non entrano in nessun calcolo di valore né di margine;
- la soglia di alert è impostata a 50 pezzi solo su cinque SKU, le latte ne sono prive.

---

## 5. listino ufficiale attivo, raccolta 2025

Prezzi netti per il canale professionale, IVA 4% esclusa. Sconto senza confezione dove indicato.

### 500 ml, collo da 8, prezzo al pubblico consigliato 28,00 €
| Quantità | Colli | Prezzo unitario | Sconto vs base |
|---|---|---|---|
| 8 | 1 | 19,50 € | base |
| 24 | 3 | 18,00 € | -7,7% |
| 40 | 5 | 16,50 € | -15,4% |
| 80 | 10 | 15,00 € | -23,1% |

Sconto ulteriore senza confezione regalo: 2,00 €. Uso dichiarato: servizio al tavolo, tavoli VIP, degustazioni, eventi, preparazioni a crudo, piatti d'autore, corner vendita.

### 250 ml, collo da 12, prezzo al pubblico consigliato 19,00 €
| Quantità | Colli | Prezzo unitario | Sconto vs base |
|---|---|---|---|
| 12 | 1 | 13,00 € | base |
| 36 | 3 | 11,50 € | -11,5% |
| 60 | 5 | 10,00 € | -23,1% |
| 120 | 10 | 8,50 € | -34,6% |

### 100 ml, collo da 16, prezzo al pubblico consigliato 12,00 €
| Quantità | Colli | Prezzo unitario | Sconto vs base |
|---|---|---|---|
| 16 | 1 | 9,00 € | base |
| 32 | 2 | 8,10 € | -10,0% |

Uso dichiarato: omaggio clienti VIP, gift menu degustazione, room service.

### Monodose olio 20 ml e aceto 20 ml, collo da 50, pubblico 7,00 €
| Quantità | Colli | Prezzo unitario |
|---|---|---|
| 50 | 1 | 2,00 € |
| 100 | 2 | 1,80 € |

Confezione mista: 25 olio più 25 aceto, bottiglie senza confezione. Portano il Japan Olive Oil Prize Gold 2026.

### Latte
Le latte 3 L e 5 L **non sono nel listino attivo del gestionale**. I prezzi usati in magazzino sono 55,00 € (3 L) e 85,00 € (5 L) per l'annata 2025. I valori di default nel codice indicano invece un pubblico di 48,00 € (3 L) e 62,88 € (5 L), con un prezzo professionale 3 L a 32,94 €. **C'è un'incoerenza da chiarire: è il buco più grosso del listino, e riguarda il 44% dello stock in litri.**

Spedizione: gratuita in provincia di Firenze, 15,00 € fuori provincia.

---

## 6. resa per litro dei formati, il dato che dovrebbe guidare il mix

Calcolato sul prezzo unitario realmente incassato nello storico ordini.

| Formato | Prezzo medio realizzato | **Ricavo per litro** | Pezzi venduti | Litri venduti |
|---|---|---|---|---|
| 100 ml | 9,15 € | **91,50 €/L** | 222 | 22,2 |
| Monodose 20 ml (olio) | 1,50 € | **75,00 €/L** | 180 | 3,6 |
| Monodose 20 ml (aceto) | 1,50 € | **75,00 €/L** | 180 | 3,6 |
| 250 ml | 12,59 € | **50,36 €/L** | 350 | 87,5 |
| 500 ml | 17,48 € | **34,96 €/L** | 688 | 344,0 |
| 3 L latta | 44,11 € | **14,70 €/L** | 29 | 87,0 |
| 5 L latta | mai venduta | n.d. | 0 | 0 |

Lettura secca: il piccolo formato vale sei volte la latta per litro venduto. Eppure il magazzino è pieno di latte (768 litri tra 3 L e 5 L, il 44% dello stock) e il 100 ml è a zero. **La 5 L non è mai stata venduta a nessun cliente, in nessun ordine dello storico.**

---

## 7. vendite, quadro complessivo

Storico completo: 54 ordini, di cui 5 annullati. I 49 validi valgono **17.424,64 €** di merce, più 238 € di spedizioni, per un totale di **17.662,54 €**.

| Periodo | Ordini | Valore merce | Litri | Prezzo medio |
|---|---|---|---|---|
| 2025 (12 mesi) | 22 | 8.063,50 € | 245,5 | 32,85 €/L |
| 2026 (gen-ago, 8 mesi) | 27 | 9.361,14 € | 302,4 | 30,96 €/L |

Nota metodologica: 43 ordini su 54 sono marcati `pregresso`, cioè caricati a posteriori quando il gestionale è stato messo in uso. Gli ordini nati dentro l'applicazione sono 11, da giugno 2026 in poi. Lo storico 2025 è quindi una ricostruzione, e possono mancare movimenti.

### stagionalità mese per mese

| Mese | Ordini | Valore | Litri |
|---|---|---|---|
| 2025-01 | 1 | 396,00 € | 12,0 |
| 2025-06 | 1 | 792,00 € | 24,0 |
| 2025-07 | 1 | 372,00 € | 12,0 |
| 2025-08 | 1 | 132,00 € | 4,0 |
| 2025-09 | 2 | 321,00 € | 8,0 |
| 2025-10 | 3 | 1.452,00 € | 44,0 |
| 2025-11 | 6 | **3.015,50 €** | 81,0 |
| 2025-12 | 7 | 1.583,00 € | 60,5 |
| 2026-01 | 3 | 883,50 € | 32,0 |
| 2026-02 | 2 | 1.406,00 € | 23,0 |
| 2026-03 | 4 | 736,00 € | 20,1 |
| 2026-04 | 1 | 1.352,00 € | 52,0 |
| 2026-05 | 10 | **3.096,40 €** | 118,0 |
| 2026-06 | 5 | 1.558,40 € | 50,0 |
| 2026-07 | 1 | 26,92 € | 0,5 |
| 2026-08 | 1 | 301,92 € | 6,8 |

Due picchi: novembre-dicembre 2025 (57% del fatturato dell'anno, effetto nuova raccolta più regalistica natalizia) e maggio-giugno 2026 (49% del fatturato dell'anno in due mesi, coincidente con l'avvio dell'attività strutturata di prospecting). Luglio e agosto 2026 sono praticamente fermi: 328,84 € in due mesi.

### erosione del prezzo rispetto al listino

Confronto tra incassato reale e valore degli stessi pezzi al prezzo base di listino (primo scaglione).

| Formato | Realizzato | A listino base | Scarto |
|---|---|---|---|
| 500 ml | 10.625,30 € | 13.396,50 € | **-20,7%** |
| 250 ml | 3.659,64 € | 4.550,00 € | **-19,6%** |
| 100 ml | 1.467,10 € | 1.998,00 € | **-26,6%** |
| Monodose olio | 270,00 € | 360,00 € | -25,0% |
| Monodose aceto | 270,00 € | 360,00 € | -25,0% |

Lo sconto medio effettivo è del 21%, con punte che vanno oltre gli scaglioni previsti: sul 500 ml il prezzo minimo praticato è 11,75 €, cioè sotto il gradino più basso del listino (15,00 € per 80 pezzi), su ordini che non raggiungono quel volume. Il listino esiste, ma nella pratica viene aggirato. Il massimo praticato è 26,92 €, quindi la forbice interna è di oltre il doppio.

Pezzi ceduti in omaggio nello storico: 49.

---

## 8. clienti

30 clienti in anagrafica, tutti con almeno un ordine. Composizione:

| Tipo | Clienti | Ordini | Fatturato | Quota | Litri | Ticket medio |
|---|---|---|---|---|---|---|
| HoReCa | 11 | 28 | 11.832,30 € | **67,9%** | 380,3 | 422,58 € |
| Retail | 12 | 13 | 3.612,00 € | 20,7% | 112,2 | 277,85 € |
| Altro | 4 | 4 | 1.335,50 € | 7,7% | 37,0 | 333,88 € |
| Privati | 3 | 4 | 644,84 € | 3,7% | 18,4 | 161,21 € |

### concentrazione, il rischio numero uno

| Cliente | Tipo | Ordini | Fatturato | Quota | Ultimo ordine |
|---|---|---|---|---|---|
| Hotel Tornabuoni, Il Magnifico | HoReCa, Firenze | 7 | 5.421,30 € | **31,1%** | 2026-06-18 |
| Maestrodolio di Fausto Borella | HoReCa | 9 | 3.750,00 € | **21,5%** | 2026-05-21 |
| Minolive | Retail | 1 | 1.352,00 € | 7,8% | 2026-04-08 |
| Villa Cassia di Baccano | HoReCa | 1 | 824,00 € | 4,7% | 2025-11-26 |
| Voip Service | Altro | 1 | 660,00 € | 3,8% | 2025-10-21 |
| Enoteca Colle S. Elena | Retail | 2 | 616,00 € | 3,5% | 2026-01-22 |
| Allianz Barlondi | Altro | 1 | 432,00 € | 2,5% | 2025-10-01 |
| Dimora Palanca | HoReCa | 1 | 360,00 € | 2,1% | 2026-05-20 |
| Massimo Lucchini | Privato | 2 | 316,00 € | 1,8% | 2026-05-27 |
| Macelleria Martini | Retail | 1 | 315,50 € | 1,8% | 2025-11-26 |

**Due clienti valgono il 52,6% del fatturato. I primi cinque valgono il 68,9%.** I restanti 25 clienti si dividono il 31%, con un fatturato medio di 217 € ciascuno.

### riacquisto

Solo **7 clienti su 30 (23%) hanno ordinato più di una volta**. Gli altri 23 hanno comprato una volta sola e non sono tornati. È il dato più critico dopo la concentrazione: l'azienda acquisisce clienti ma non li fidelizza, oppure il ciclo di riacquisto è annuale e legato alla raccolta, ipotesi che va verificata.

Canale di acquisizione dei 30 clienti: campagna marketing 13, contatto diretto della proprietà 7, Irene 4, web 3, visita 1, Lucia 1, altro 1.

Distribuzione geografica: Firenze 14, non indicata 12, Arezzo 2, Livorno 1, Padova 1.

### modalità commerciali

- pagamento: bonifico 41 ordini, rimessa diretta 4, contanti 1, altro 2;
- **conto vendita: 7 ordini, 1.992,50 €**, con scadenze da novembre 2026 a maggio 2027. Di questi, 4 risultano ancora da pagare e 1 parziale;
- **crediti aperti totali: 5.281,22 €**, pari al 30,3% del fatturato storico. Il più vecchio è del settembre 2025 (Ticcu Ticcu, 165 €). I due più pesanti sono di Hotel Tornabuoni: 1.245,40 € del 15 maggio e 986,40 € del 18 giugno 2026.

---

## 9. pipeline commerciale

960 prospect censiti. È il vero asset commerciale dell'azienda, e per larga parte è ancora inesplorato.

### stato di lavorazione

| Stato | Numero | Quota |
|---|---|---|
| Da contattare | **495** | 51,6% |
| Non interessato | 214 | 22,3% |
| Contattato | 206 | 21,5% |
| In sospeso | 35 | 3,6% |
| Acquisito | 5 | 0,5% |
| In trattativa | 4 | 0,4% |
| Interessato | 1 | 0,1% |

Metà della lista non è mai stata toccata. Sui 465 lavorati, i clienti attivi sono 30: **tasso di conversione del 6,5% sui contattati, del 3,1% sul totale della lista.**

### composizione

| Tipo | Numero |
|---|---|
| HoReCa (ristoranti) | 609 |
| Enoteche | 269 |
| Alberghi | 34 |
| Retail | 27 |
| Altro | 20 |
| Privato | 1 |

Categorie merceologiche: Ristorante 571, Enoteca 283, Alimentari 30, Enoteca-Ristorante 27, Hotel 12.

### geografia

| Regione | Prospect | Quota |
|---|---|---|
| Toscana | **678** | 70,6% |
| Lazio | 107 | 11,1% |
| Piemonte | 42 | 4,4% |
| Veneto | 36 | 3,8% |
| Abruzzo | 21 | 2,2% |
| Lombardia | 20 | 2,1% |
| Liguria | 18 | 1,9% |
| Trentino | 16 | 1,7% |

Province: Firenze 536, Roma 105, Livorno 54, Torino 25, Prato 23, Padova 21, Siena 16, Lucca 15.
Città: Firenze 454, Roma 100, Livorno 38, Prato 23, Sesto Fiorentino 21, Torino 20.

Concentrazione HoReCa più enoteche più alberghi in Toscana: **645 nominativi, di cui 265 mai contattati e 320 con email disponibile.**

### contattabilità

| Dato disponibile | Numero | Copertura |
|---|---|---|
| Telefono | 946 | **98,5%** |
| Email | 383 | 39,9% |
| Referente nominativo | 334 | 34,8% |
| Sito web | 0 | 0% |
| Valore potenziale valorizzato | 0 | 0% |

La lista è telefonica, non è una lista email. Qualsiasi strategia basata su campagne di posta parte con un tetto di 383 contatti, e va detto che nessun prospect ha una stima di valore potenziale compilata: la priorizzazione oggi non esiste come dato.

### attività registrata

- 346 chiamate su prospect (esito non compilato in nessuna delle 346);
- 69 chiamate su clienti, di cui 65 con risposta e 4 senza;
- 136 prospect hanno una nota che cita l'invio di mail o brochure;
- email tracciate sui clienti: 4 conferme ordine, 2 ordini, 2 campionature, 1 primo contatto;
- **campioni inviati registrati sui prospect: 0.** La campionatura viene fatta (le note lo dimostrano) ma non è tracciata nel campo dedicato.

### obiezioni ricorrenti, dalle note dei venditori

Analisi testuale su 430 note compilate.

| Obiezione | Ricorrenze | Di cui su «non interessato» |
|---|---|---|
| Prezzo troppo alto | 38 | 36 |
| Già fornito, provvisto, ha il proprio olio o lo prende sfuso | 17 | 14 |
| Target o standard non in linea | 21 | 21 |
| Nessuna risposta dopo il contatto | 4 | 2 |

Citazioni testuali dai record: «non interessati, prezzo troppo alto», «non interessati, lo prendono sfuso e lo imbottigliano», «non interessati, catena con loro prodotti», «prodotto non adatto al loro target», «prezzo elevato ma doveva parlare coi soci».

**Il prezzo è la prima obiezione, e distacca tutte le altre.** Va incrociata con il dato della sezione 7: in media si sconta già del 21%, e i clienti che comprano lo fanno sotto listino. Questo apre una domanda strategica precisa: il listino è tarato troppo alto per il mercato che l'azienda sta davvero aggredendo, oppure il posizionamento non riesce a giustificarlo.

### la lista di riattivazione già pronta

**29 prospect hanno una nota che dice esplicitamente di richiamare alla raccolta 2026.** Sono i 35 «in sospeso» più alcuni classificati come non interessati con riserva. Alcuni esempi: Alimentari Innocenti, Azzo Vini, Casa Ciabattini, Cru cucina rustica urbana, Cucchietta, Diverso Firenze, Enoteca Gensini, Enoteca Piazza Nobili, Irene, L'Ortone, La Loggia del Piazzale Michelangelo, Lungarno 23, Macelleria Antella, Nedo, Rapid Wine, Relais Le Jardin, Ristorante Santa Elisabetta, Trattoria Donnini, Trattoria Osvaldo, note di vino.

Il motivo del rinvio è quasi sempre lo stesso: erano già forniti. La nuova frangitura è esattamente l'occasione che questi contatti hanno indicato da soli. È la lista da lavorare per prima, ha il costo di acquisizione più basso di tutta la pipeline.

### trattative aperte oggi

| Nome | Tipo | Città | Nota |
|---|---|---|---|
| Chalet Fontana | HoReCa | Firenze | proprietà non interessata, ma il responsabile è da chiamare per fissare |
| Franco enoteca | Enoteca | Castiglione della Pescaia | richiamare a giugno |
| Le Bontà di Giulia | HoReCa | Sesto Fiorentino | richiamare per capire se vuole acquistare |
| Pegna dal 1860 Srl | Retail | Firenze | chiamato l'11 maggio, referente assente |
| Bistrot cafè 19.26 | HoReCa | Firenze | brochure inviata, richiamare (unico «interessato») |

---

## 10. materiali di marketing disponibili

Cinque documenti caricati nel gestionale e scaricabili:

| Materiale | Categoria | Note |
|---|---|---|
| Listino commerciale | brochure | con prezzi |
| Brochure Gift | presentazione | senza prezzi, tutti i formati |
| Scheda tecnica olio EVO 2025 | scheda tecnica | varietà, processo, certificazioni |
| Brochure HoReCa in inglese | brochure | 11 pagine, storia, certificazioni, formati |
| Brochure HoReCa in italiano | scheda tecnica | 9 pagine, radici, storia, metodo, formati, ristorazione |

Esistono modelli email per primo contatto, campionatura e conferma ordine. Il testo del primo contatto punta su: oliveti pluricentenari sulle colline di Bagno a Ripoli, blend Frantoio-Moraiolo-Leccino, raccolta manuale, frangitura a freddo entro poche ore, produzione limitata, certificazione biologica, fruttato medio-intenso equilibrato in amaro e piccante, offerta di campione senza impegno.

Non risultano attivi: e-commerce proprio, presenza su marketplace, campagne pubblicitarie a pagamento, attività social tracciata nel gestionale.

---

## 11. costi, quello che si sa e quello che manca

**Questa è la lacuna più seria del dossier.** La distinta base reale (`bottiglie` e `lotti`) è vuota, quindi il gestionale non calcola margini reali su nessuno SKU.

Gli unici valori disponibili sono i parametri di default presenti nel codice, mai confermati con dati di campagna:

| Voce | Valore di default |
|---|---|
| Costo olive | 2,80 €/kg |
| Resa media | 14,5% |
| Costo frangitura | 18,00 € per 100 kg di olive |

Costi packaging di default, per pezzo:

| Formato | Bottiglia | Etichetta | Packaging | Logistica | **Totale** |
|---|---|---|---|---|---|
| 100 ml | 0,45 € | 0,18 € | 0,30 € | 0,20 € | **1,13 €** |
| 250 ml | 0,95 € | 0,22 € | 0,50 € | 0,30 € | **1,97 €** |
| 500 ml | 1,52 € | 0,25 € | 0,65 € | 0,45 € | **2,87 €** |
| 3 L latta | 3,80 € | 0,35 € | 0,00 € | 1,20 € | **5,35 €** |
| 5 L latta | 5,60 € | 0,40 € | 0,00 € | 1,50 € | **7,50 €** |
| Monodose 20 ml | 0,18 € | 0,10 € | 0,15 € | 0,10 € | **0,53 €** |

Con questi parametri il costo dell'olio sarebbe di circa 19,31 €/L di olio finito (2,80 € al kg diviso 0,145 di resa), a cui si aggiunge la frangitura, circa 1,24 €/L. Totale indicativo 20,55 €/L. **Se questo numero fosse vero, la latta 3 L venduta a 14,70 €/L sarebbe in perdita secca, e il 500 ml a 34,96 €/L avrebbe un margine lordo intorno al 60% al netto del packaging.** Va verificato prima di qualsiasi decisione: il costo delle olive dipende dal fatto che siano di proprietà o acquistate, e il dossier non lo sa.

Fornitori censiti, 11 in totale. I tracciati con documentazione sono:

| Fornitore | Categoria | Documenti |
|---|---|---|
| Frantoio (conto terzi) | frantoio | fatture molitura e imbottigliamento nov-dic 2025, fatture latte 3 L e 5 L |
| Stampa Digitale La Progressiva, Firenze | etichette | fatture etichette 100 ml, pendagli, biglietti da visita |
| Mail Boxes Etc | logistica | tariffario spese di spedizione |

Costi di struttura registrati nel gestionale: nessuno. Il campo esiste ed è vuoto, quindi non esiste un margine netto calcolabile.

---

## 12. dati mancanti da colmare prima di fissare un budget

Ordinati per impatto sulla strategia.

1. **Volume atteso della frangitura 2026.** Kg di olive stimati, resa attesa, litri previsti. Senza questo numero non si dimensiona niente.
2. **Costo reale dell'olio.** Le olive sono di proprietà o acquistate? A che prezzo? Qual è stato il costo effettivo di molitura e imbottigliamento fatturato dal frantoio nel 2025?
3. **Prezzo di listino delle latte 3 L e 5 L.** Oggi non esiste nel listino attivo, e riguarda il 44% dello stock.
4. **Capacità produttiva del nuovo impianto**, se «nuova frangitura» significa un frantoio di proprietà e non la nuova campagna presso terzi. Il dossier non ha elementi per distinguere i due casi: **va chiarito, perché cambia tutta la strategia.** Se l'azienda sta per avere un frantoio proprio, si apre una linea di ricavo completamente nuova (molitura conto terzi per altri olivicoltori) che oggi non è tracciata in nessun dato.
5. Costi di struttura mensili: personale commerciale, marketing, logistica, gestionale, ammortamenti.
6. Obiettivo di fatturato e di litri per la campagna 2026-2027 fissato dalla proprietà.
7. Politica di sconto autorizzata: qual è il prezzo minimo sotto cui non si scende.
8. Vita commerciale utile dell'olio secondo l'azienda: entro quanti mesi dalla frangitura si considera vendibile a prezzo pieno.
9. Budget disponibile per la campagna commerciale 2026.
10. Esito reale delle 346 chiamate registrate senza esito: il campo è vuoto, il dato è perso.

---

## 13. cosa serve produrre

Elementi già disponibili per costruire il piano, senza aspettare i dati mancanti:

- una lista di 29 contatti che hanno chiesto di essere richiamati alla raccolta 2026, con nome, telefono e motivo del rinvio;
- 495 prospect mai contattati, di cui 265 HoReCa ed enoteche in Toscana;
- 23 clienti che hanno comprato una volta sola e non sono più tornati;
- 383 indirizzi email utilizzabili;
- 5 materiali di vendita pronti, italiano e inglese;
- un premio internazionale del 2026 sul formato monodose, mai usato come leva narrativa nei testi commerciali censiti.

Le domande strategiche che il piano deve risolvere:

1. Come si porta il ritmo di vendita da 38 a oltre 120 litri al mese, che è la condizione perché la nuova frangitura non peggiori un magazzino già saturo.
2. Che cosa si fa degli 805 litri di annata 2024 prima che arrivi la 2026: canale di smaltimento dedicato, prezzo, racconto.
3. Come si riduce la dipendenza da due clienti che valgono il 52,6%.
4. Come si risponde all'obiezione prezzo, che è la prima causa di rifiuto, senza continuare a scontare del 21% in modo non governato.
5. Se conviene spostare il mix verso i formati piccoli, che rendono da 50 a 91 € al litro, e cosa fare dei 768 litri fermi nelle latte, di cui la 5 L non è mai stata venduta a nessuno.
6. Come si trasforma una lista telefonica di 960 nominativi in un processo commerciale ripetibile, dato che oggi l'esito delle chiamate non viene registrato e nessun prospect ha una stima di valore.

---

## appendice, avvertenze sulla qualità dei dati

- 43 ordini su 54 sono inserimenti retroattivi: lo storico 2025 è ricostruito e potrebbe essere incompleto;
- un ordine ha la data digitata come `0026-07-14`, evidentemente 2026, ed è stato trattato come tale nei calcoli;
- due ordini di Maestrodolio hanno righe a valore zero, quindi il fatturato reale di quel cliente potrebbe essere superiore ai 3.750 € qui riportati;
- l'esito delle 346 chiamate ai prospect non è mai stato compilato;
- il campo «campione inviato» è a zero su tutti i 960 prospect, pur essendoci evidenza testuale di campionature effettuate;
- 19 prospect non hanno regione, 27 non hanno categoria;
- le tabelle relazionali `movimenti_magazzino`, `fornitori`, `documenti` ed `email_log` in Supabase sono vuote: la fonte di verità operativa è lo stato applicativo, non lo schema relazionale;
- i valori di costo della sezione 11 sono default di codice, non consuntivi.

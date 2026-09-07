# Dossier commerciale Tenute Nonno Bruno, base dati per il piano olio 2026/27

Estrazione del **7 settembre 2026** dal gestionale (Supabase, progetto `NonnoBruno`, chiave `app_kv → tnb-pro-v2`, che è la fonte operativa reale usata dall'app).
Documento pensato per essere dato in pasto a un modello che deve costruire la strategia commerciale della nuova raccolta.

> Nota sulle fonti: nel database esistono anche tabelle normalizzate (`prospect` 2.200 righe, `clienti` 42, `ordini` 24). Sono un import Excel del maggio 2026 con duplicati, non allineato. **Usare solo i numeri di questo dossier**, che vengono dallo stato vivo dell'applicazione.

---

## 1. Identikit azienda

| Voce | Dato |
|---|---|
| Ragione sociale | Tenute Nonno Bruno, Società Agricola S.r.l. |
| Sede | Via del Fornaccio 40, 50012 Bagno a Ripoli (FI) |
| P.IVA / CF | IT07267640485 |
| Sito | www.tenutenonnobruno.it |
| Payoff | «L'olio nell'anima» |
| Certificazioni | Biologico, Toscano IGP |
| Riconoscimenti | Japan Olive Oil Prize, premio Gold 2026 |
| Referente commerciale | Irene Paggetti, Key Account Manager HoReCa & Retail, 338 1427611 |
| Marchio prodotto | Olio EVO «Fata Morgana», più Aceto di vino rosso «della Fata Morgana» |
| Annate a sistema | 2024 (prima raccolta), 2025 (seconda raccolta) |
| Forza vendita | 1 persona sul campo (Irene), più contatti diretti del titolare |

Il gestionale registra **due annate di storia commerciale**: la 2026/27 sarà la terza. Non esistono a sistema dati di resa agronomica: la tabella `produzione` ha le due annate ma i campi kg olive, litri e resa sono vuoti.

---

## 2. Listino attivo (raccolta 2025), prezzi netti IVA 4%

| Formato | Prezzo pubblico | Base (1 collo) | Scaglione 2 | Scaglione 3 | Scaglione 4 | Pezzi/collo |
|---|---|---|---|---|---|---|
| 500 ml | 28,00 | 19,50 (8 pz) | 18,00 (24 pz) | 16,50 (40 pz) | 15,00 (80 pz) | 8 |
| 250 ml | 19,00 | 13,00 (12 pz) | 11,50 (36 pz) | 10,00 (60 pz) | 8,50 (120 pz) | 12 |
| 100 ml | 12,00 | 9,00 (16 pz) | 8,10 (32 pz) | | | 16 |
| Olio 20 ml | 7,00 | 2,00 (50 pz) | 1,80 (100 pz) | | | 50 |
| Aceto 20 ml | 7,00 | 2,00 (50 pz) | 1,80 (100 pz) | | | 50 |
| 3 L latta | non a listino | 55,00 (prezzo magazzino) | | | | |
| 5 L latta | non a listino | 85,00 (prezzo magazzino) | | | | |

Sul 500 ml è previsto uno sconto di 2,00 € per la versione senza astuccio. Le monodose 20 ml sono vendute in confezione mista, 25 olio più 25 aceto.

**Nota strategica**: le latte da 3 e 5 litri non hanno un listino strutturato con scaglioni, pur pesando in magazzino per oltre 1.100 litri. È un buco da colmare prima della campagna.

### Prezzi effettivamente praticati (49 ordini validi)

| Formato | Medio | Minimo | Massimo | Base listino | Delta medio vs base |
|---|---|---|---|---|---|
| 500 ml | 17,48 | 11,75 | 26,92 | 19,50 | −10,4% |
| 250 ml | 12,45 | 5,87 | 18,24 | 13,00 | −4,2% |
| 100 ml | 9,12 | 6,25 | 11,60 | 9,00 | +1,3% |
| 3 L latta | 44,11 | 32,94 | 55,00 | 55,00 | −19,8% |
| Olio 20 ml | 1,50 | 1,50 | 1,50 | 2,00 | −25,0% |
| Aceto 20 ml | 1,50 | 1,50 | 1,50 | 2,00 | −25,0% |

La forbice sul 500 ml va da 11,75 a 26,92 euro. Undici euro di differenza sullo stesso prodotto. La disciplina di prezzo è il primo tema da normare nel piano.

---

## 3. Risultati commerciali storici

### Volumi complessivi

| Indicatore | Valore |
|---|---|
| Ordini registrati | 54, di cui 5 annullati |
| Ordini validi | 49 |
| Fatturato netto IVA cumulato | **17.424,64 €** |
| Ticket medio ordine | 355,60 € |
| Litri di olio venduti (cumulati) | **544,3 L** |
| Pezzi venduti (tutti i formati) | 1.649 |
| Clienti che hanno ordinato | 30 su 30 a anagrafica |
| Fatturato medio per cliente | 580,82 € |

### Per anno

| Anno | Ordini | Fatturato |
|---|---|---|
| 2025 | 22 | 8.063,50 € |
| 2026 (a fine agosto) | 27 | 9.361,14 € |

Crescita del 16% anno su anno sul fatturato, del 23% sul numero di ordini. Con otto mesi di 2026 contro dodici di 2025.

### Stagionalità mensile

| Mese | Ordini | Fatturato |
|---|---|---|
| 2025-01 | 1 | 396,00 |
| 2025-06 | 1 | 792,00 |
| 2025-07 | 1 | 372,00 |
| 2025-08 | 1 | 132,00 |
| 2025-09 | 2 | 321,00 |
| 2025-10 | 3 | 1.452,00 |
| 2025-11 | 6 | 3.015,50 |
| 2025-12 | 7 | 1.583,00 |
| 2026-01 | 3 | 883,50 |
| 2026-02 | 2 | 1.406,00 |
| 2026-03 | 4 | 736,00 |
| 2026-04 | 1 | 1.352,00 |
| 2026-05 | 10 | 3.096,40 |
| 2026-06 | 5 | 1.558,40 |
| 2026-07 | 1 | 26,92 |
| 2026-08 | 1 | 301,92 |

Due picchi netti: **ottobre-dicembre** (5.850 € nel 2025, il 73% dell'anno) e **maggio** (3.096 €, spinto dalla campagna di contatto). Luglio e agosto sono praticamente morti. La nuova raccolta arriva proprio all'ingresso della finestra migliore.

### Mix per formato

| Formato | Pezzi | Fatturato | Litri | % fatturato | Omaggi |
|---|---|---|---|---|---|
| 500 ml | 688 | 10.625,30 € | 344,0 | 61,0% | 38 |
| 250 ml | 350 | 3.659,64 € | 87,5 | 21,0% | 8 |
| 100 ml | 222 | 1.467,10 € | 22,2 | 8,4% | 3 |
| 3 L latta | 29 | 1.132,60 € | 87,0 | 6,5% | 0 |
| Olio 20 ml | 180 | 270,00 € | 3,6 | 1,5% | 0 |
| Aceto 20 ml | 180 | 270,00 € | 3,6 | 1,5% | 0 |

Il 500 ml è il prodotto. Le monodose e il 100 ml hanno la funzione di apripista, non di ricavo. La 5 litri non è mai stata venduta, pur essendo a magazzino per 134 pezzi.

### Mix per annata venduta

| Annata | Pezzi | Fatturato |
|---|---|---|
| 2024 | 242 | 3.514,50 € |
| 2025 | 1.407 | 13.910,14 € |

---

## 4. Portafoglio clienti

30 clienti attivi, tutti con almeno un ordine.

| Tipologia | Clienti |
|---|---|
| Retail (alimentari, macellerie, enoteche, pescherie) | 12 |
| HoReCa (ristoranti, hotel) | 11 |
| Altro (aziende, uffici, regalistica) | 4 |
| Privati | 3 |

| Canale di acquisizione | Clienti |
|---|---|
| Campagna marketing (`campagna_m`) | 13 |
| Contatto diretto titolare (`nb`) | 7 |
| Irene | 4 |
| Web | 3 |
| Altro, Lucia, visita | 3 |

Geografia: 14 clienti in provincia di Firenze, 2 Arezzo, 1 Livorno, 1 Padova, 12 senza provincia compilata. Il business è **fiorentino**, di fatto.

### Classifica clienti per fatturato

| Cliente | Tipo | Zona | Canale | Ordini | Fatturato | Primo → ultimo |
|---|---|---|---|---|---|---|
| Hotel Tornabuoni, Il Magnifico | HoReCa | Firenze | campagna_m | 7 | 5.421,30 | 12/2025 → 06/2026 |
| Maestrodolio di Fausto Borella | HoReCa | n.d. | diretto | 9 | 3.750,00 | 01/2025 → 05/2026 |
| Minolive | Retail | n.d. | web | 1 | 1.352,00 | 04/2026 |
| Villa Cassia di Baccano | HoReCa | Arezzo | diretto | 1 | 824,00 | 11/2025 |
| Voip Service | Altro | Firenze | Irene | 1 | 660,00 | 10/2025 |
| Enoteca Colle S. Elena | Retail | Padova | web | 2 | 616,00 | 11/2025 → 01/2026 |
| Allianz Barlondi | Altro | Firenze | Irene | 1 | 432,00 | 10/2025 |
| Dimora Palanca | HoReCa | n.d. | campagna_m | 1 | 360,00 | 05/2026 |
| Massimo Lucchini | Privato | n.d. | Irene | 2 | 316,00 | 03/2026 → 05/2026 |
| Macelleria Martini | Retail | Firenze | diretto | 1 | 315,50 | 11/2025 |
| Enoteca La Cantina | Retail | Firenze | campagna_m | 1 | 312,00 | 12/2025 |
| Don Elliott | Privato | n.d. | visita | 1 | 301,92 | 08/2026 |
| Terrazza 45 | HoReCa | Fiesole | campagna_m | 2 | 288,00 | 09/2025 → 06/2026 |
| Il Cacito | HoReCa | n.d. | altro | 2 | 288,00 | 08/2025 → 06/2026 |
| Buca Poldo | HoReCa | n.d. | Lucia | 2 | 284,00 | 06/2026 |
| Ticcu Ticcu | HoReCa | n.d. | diretto | 1 | 165,00 | 09/2025 |
| Mariano | Retail | Firenze | campagna_m | 1 | 156,00 | 11/2025 |
| Macelleria Giannelli | Retail | Firenze | campagna_m | 1 | 156,00 | 12/2025 |
| Gilda Bistrot | HoReCa | Firenze | campagna_m | 1 | 156,00 | 02/2026 |
| F.lli Micheli | Retail | Firenze | campagna_m | 1 | 156,00 | 12/2025 |
| Ciro in Florence, Columbus Hotel | HoReCa | n.d. | campagna_m | 1 | 156,00 | 03/2026 |
| Centro Tennis Olimpia | Altro | Livorno | Irene | 1 | 156,00 | 12/2025 |
| Alimentari Murino | Retail | Vaglia | campagna_m | 1 | 156,00 | 12/2025 |
| Enoteca Enotria | Retail | Cortona | diretto | 1 | 144,00 | 05/2026 |
| Pescheria Marisa | Retail | Bagno a Ripoli | campagna_m | 1 | 140,00 | 03/2026 |
| L'Angolo del Mare | HoReCa | Firenze | campagna_m | 1 | 140,00 | 01/2026 |
| Masiero Silva Luciana Carla | Altro | n.d. | diretto | 1 | 87,50 | 05/2026 |
| Enoteca Cusi | Retail | Firenze | campagna_m | 1 | 78,00 | 11/2025 |
| Liquorama Firenze | Retail | n.d. | diretto | 1 | 30,50 | 05/2026 |
| Grimaldi Francesco | Privato | n.d. | web | 1 | 26,92 | 07/2026 |

### Concentrazione e fedeltà

| Indicatore | Valore |
|---|---|
| Peso dei primi 3 clienti | **60,4%** del fatturato |
| Peso dei primi 5 clienti | 68,9% |
| Clienti con più di un ordine | **7 su 30** (23%) |
| Clienti mono-ordine | 23 su 30 (77%) |
| Fatturato mediano per cliente | circa 156 € |

Il rischio è evidente: due clienti valgono metà del giro d'affari e tre quarti della base non ha mai riordinato. Il **tasso di riacquisto** è la leva con il ritorno più alto in assoluto per la 26/27, prima ancora di cercare clienti nuovi.

---

## 5. Conto vendita

7 ordini su 49 sono in conto vendita, per **1.992,50 €** di merce collocata.

| Ordine | Data | Cliente | Valore | Scadenza CV | Stato |
|---|---|---|---|---|---|
| 1008/2025 | 26/11/2025 | Villa Cassia di Baccano | 824,00 | 26/11/2026 | consegnato, da pagare |
| 1006/2025 | 18/11/2025 | Enoteca Colle S. Elena | 460,00 | 18/11/2026 | consegnato, pagato in parte |
| 1010/2025 | 01/12/2025 | Enoteca La Cantina | 312,00 | 20/05/2027 | consegnato, da pagare |
| 1013/2025 | 15/12/2025 | F.lli Micheli | 156,00 | 20/05/2027 | fatturato, da pagare |
| 0009/2025 | 26/08/2025 | Il Cacito | 132,00 | 26/08/2026 | fatturato, scaduto |
| 1004/2025 | 17/11/2025 | Enoteca Cusi | 78,00 | 17/11/2026 | fatturato |
| 0007/2026 | 20/05/2026 | Liquorama Firenze | 30,50 | 20/05/2027 | consegnato, da pagare |

Tre scadenze cadono tra novembre 2026 e maggio 2027, cioè dentro la campagna 26/27: sono occasioni naturali di rientro in punto vendita, o per incassare o per rinnovare con l'annata nuova.

---

## 6. Magazzino, la variabile che condiziona tutto

Giacenze disponibili al 7 settembre 2026, prima della nuova raccolta.

| Prodotto | Annata | Pezzi | Litri | Valore a listino |
|---|---|---|---|---|
| 500 ml | 2024 | 798 | 399,0 | 15.561,00 € |
| 5 L latta | 2024 | 47 | 235,0 | 3.995,00 € |
| 3 L latta | 2024 | 57 | 171,0 | 3.135,00 € |
| 5 L latta | 2025 | 87 | 435,0 | 7.395,00 € |
| 3 L latta | 2025 | 111 | 333,0 | 6.105,00 € |
| 250 ml | 2025 | 311 | 77,8 | 4.043,00 € |
| 500 ml | 2025 | 105 | 52,5 | 2.047,50 € |
| 100 ml | 2025 | 0 | 0 | 0 |
| Olio 20 ml | 2025 | 664 | 13,3 | 1.328,00 € |
| Aceto 20 ml | 2025 | 613 | 12,3 | 1.226,00 € |

| Sintesi | Valore |
|---|---|
| Litri di olio a stock | **1.716,5 L** |
| Valore a prezzo di listino | **44.835,50 €** |
| Di cui annata 2024 | 805 litri, 22.691,00 € |
| Litri venduti in due annate | 544,3 L |
| Copertura dello stock ai ritmi attuali | oltre **6 anni** di vendite |

Questo è il punto più critico dell'intero quadro. C'è a magazzino più di tre volte l'olio venduto in tutta la storia dell'azienda, e metà è di due raccolte fa. Il 100 ml è invece **esaurito**, cioè manca proprio il formato apripista che serve alla campionatura.

Alcune conseguenze dirette per il piano 26/27:
- serve una linea di smaltimento dedicata alla 2024, separata per prezzo e per canale, in modo da non cannibalizzare la nuova annata;
- le latte da 3 e 5 litri (1.174 litri fermi) chiedono un canale che oggi non esiste: ristorazione per il fritto e la cucina, gastronomie, catering, vendita sfusa;
- va deciso quanto imbottigliare della 26/27 e in quali formati, perché il 100 ml a zero e il 500 ml 2025 quasi finito (105 pezzi) convivono con 798 pezzi di 500 ml 2024.

---

## 7. Pipeline prospect

960 anagrafiche censite nel gestionale.

### Funnel per stato

| Stato | Numero | % |
|---|---|---|
| Da contattare | **495** | 51,6% |
| Contattato | 206 | 21,5% |
| Non interessato | 214 | 22,3% |
| In sospeso | 35 | 3,6% |
| In trattativa | 4 | 0,4% |
| Interessato | 1 | 0,1% |
| Acquisito | 5 | 0,5% |

Sui 465 prospect effettivamente lavorati (tutti tranne i «da contattare»), i «non interessato» sono 214: **tasso di rifiuto del 46%**. I convertiti a cliente risultano 5 nel campo stato, ma l'anagrafica clienti ne conta 30, quindi il campo è aggiornato solo in parte.

### Per tipologia

| Tipo | Totale | Da contattare |
|---|---|---|
| HoReCa | 609 | 301 |
| Enoteca | 269 | 181 |
| Albergo | 34 | 8 |
| Retail | 27 | 1 |
| Altro | 20 | 4 |
| Privato | 1 | 0 |

### Per categoria merceologica

| Categoria | Totale |
|---|---|
| Ristorante | 571 |
| Enoteca | 283 |
| Alimentari | 30 |
| Enoteca-ristorante | 27 |
| Hotel | 12 |
| Bar, rosticceria, altro | 9 |

### Geografia del bacino

| Regione | Prospect | Da contattare |
|---|---|---|
| Toscana | 678 | 267 |
| Lazio | 107 | 106 |
| Piemonte | 42 | 40 |
| Veneto | 36 | 23 |
| Abruzzo | 21 | 21 |
| Lombardia | 20 | 15 |
| Liguria | 18 | 17 |
| Trentino | 16 | 4 |
| Altre | 3 | 2 |

Province principali: Firenze 536, Roma 105, Livorno 54, Torino 25, Prato 23, Padova 21, Siena 16, Lucca 15, Brescia 14, Genova 13.

Il Lazio è **quasi intatto**: 106 nomi su 107 mai contattati, quasi tutti a Roma. È il primo bacino di espansione già disponibile senza costi di lista.

### Origine delle liste

| Fonte | Prospect |
|---|---|
| Campagna marketing | 476 |
| Report prospect (lavoro di Irene) | 428 |
| Entrambi | 37 |

### Qualità dei dati di contatto

| Dato | Copertura |
|---|---|
| Telefono o cellulare | 946 su 960 (98,5%) |
| Email | 383 su 960 (**39,9%**) |

L'email manca su sei prospect su dieci. Qualsiasi piano che preveda campagne di mailing deve mettere in conto una fase di arricchimento dei contatti.

---

## 8. Attività commerciale svolta

| Indicatore | Valore |
|---|---|
| Chiamate registrate su prospect | 346, su 181 prospect distinti |
| Chiamate registrate su clienti | 69 (65 con risposta, 4 senza) |
| Email tracciate verso clienti | 9 (4 conferme ordine, 2 ordini, 2 campionature, 1 primo contatto) |
| Prospect con richiamo già in agenda | 63, di cui **26 datati settembre 2026** |
| Campioni formalmente registrati come inviati | 0 (il campo non viene compilato) |

### Chiamate per mese

| Mese | Chiamate |
|---|---|
| 2025-09 | 14 |
| 2025-10 | 19 |
| 2025-11 | 15 |
| 2025-12 | 32 |
| 2026-01 | 66 |
| 2026-02 | 21 |
| 2026-03 | 13 |
| 2026-04 | 42 |
| 2026-05 | 33 |
| 2026-06 | 89 |
| 2026-09 | 2 |

Media di circa 31 chiamate al mese, con picchi a giugno (89) e gennaio (66). Rapporto grezzo: 346 chiamate a prospect hanno prodotto una trentina di clienti, quindi **circa 11 chiamate per cliente acquisito**, e un ordine medio da 355 €.

Il periodo luglio-agosto 2026 è a zero chiamate. La ripartenza di settembre è appena cominciata: 2 chiamate e 26 richiami in agenda.

---

## 9. Pipeline calda da riprendere subito

46 nominativi hanno un interesse dichiarato positivo o sono in trattativa. I più concreti:

**In trattativa (4)**
- Chalet Fontana, ristorante, Firenze
- Pegna dal 1860 Srl, alimentari storico, Firenze
- Le Bontà di Giulia, alimentari, Sesto Fiorentino
- Franco Enoteca, Castiglione della Pescaia

**Interessati o in sospeso con richiamo già fissato a settembre 2026 (26 richiami)**
- Alimentari Innocenti, Bagno a Ripoli
- Alimentari Serni, Antella
- Macelleria Antella, con nota esplicita «da richiamare per la prossima raccolta 2026»
- Enoteca Piazza Nobili, Firenze
- Azzo Vini, Bardolino
- Giubbe Rosse, Firenze, interesse «sì»
- Vini di Toscana, Arezzo, interesse «sì»
- Obsequium Enoteca, Firenze
- Bistrot Cafè 19.26, Firenze

Altri 30 e passa nominativi sono marcati «in valutazione» in tutta la Toscana, più Bolzano, Verona, Padova e Ancona. Molti sono classificati «non interessato» ma con interesse «in valutazione», cioè segnalano un no legato al momento e non al prodotto: sono candidati naturali per la riapertura con l'annata nuova.

---

## 10. Situazione finanziaria del ciclo commerciale

| Indicatore | Valore |
|---|---|
| Crediti aperti | **5.281,22 €**, su 12 ordini |
| Peso sul fatturato cumulato | 30,3% |
| Ordini incassati | 36 su 49 |
| Modalità di pagamento prevalente | bonifico (46 ordini su 54) |
| Spese di spedizione addebitate | solo 3 ordini, 237,90 € totali |

Il conteggio somma il valore pieno degli ordini con pagamento aperto, incluso un ordine incassato in parte (Colle S. Elena). Le posizioni più rilevanti: Hotel Tornabuoni 2.231,80 € su due ordini, Villa Cassia 824,00 €, Enoteca Colle S. Elena 460,00 €, Dimora Palanca 360,00 €.

Le spedizioni sono quasi sempre a carico dell'azienda: 3 ordini su 49 addebitano il trasporto. Con un ticket medio di 355 € è una voce che va normata (soglia di porto franco).

---

## 11. Asset di supporto alla vendita

Materiali già disponibili nel gestionale:
- listino commerciale in PDF
- brochure gift senza prezzi, tutti i formati
- scheda tecnica olio EVO 2025 con varietà, processo e certificazioni
- brochure HoReCa in italiano, 9 pagine
- brochure HoReCa in inglese, 11 pagine

Fornitori censiti: 11, tra cui Mail Boxes Etc per la logistica e La Progressiva per le etichette (fatture di etichette 100 ml e pendagli olio 8x5 caricate a sistema).

---

## 12. Indicatori sintetici per il modello di piano

| KPI | Valore attuale |
|---|---|
| Fatturato annuo di riferimento | circa 9.400 € (2026 a 8 mesi), 8.064 € (2025) |
| Ticket medio ordine | 355,60 € |
| Fatturato medio per cliente | 580,82 € |
| Fatturato mediano per cliente | circa 156 € |
| Litri per cliente (cumulato su due annate) | circa 18 L |
| Prezzo medio realizzato al litro | 32,01 €/L |
| Tasso di riacquisto | 23% |
| Chiamate per cliente acquisito | circa 11 |
| Tasso di rifiuto sui contattati | 46% |
| Concentrazione top 3 | 60,4% |
| Stock in litri / venduto annuo | oltre 6 anni di copertura |
| Prospect ancora vergini | 495 |
| Crediti aperti / fatturato | 30,3% |

---

## 13. Cosa manca a sistema e va chiesto prima di chiudere il piano

1. **Stima di produzione 26/27**: quintali di olive attesi, resa, litri previsti. La tabella `produzione` è vuota su tutti i campi numerici.
2. **Costi**: `costiConfig` è vuoto, non c'è costo pieno per bottiglia, né costo di packaging, etichetta, astuccio, frangitura, stoccaggio. Senza questi non si calcola marginalità né si può fissare un floor di prezzo.
3. **Politica sull'invenduto 2024**: si svende, si declassa, si regala in campionatura, si destina a sfuso o a private label?
4. **Capacità operativa**: quante bottiglie si riescono a etichettare e spedire al mese, e quanto tempo settimanale Irene può davvero dedicare alle chiamate.
5. **Budget di marketing** per la campagna 26/27 e disponibilità a produrre campioni da 100 ml (formato oggi a zero).
6. **Obiettivo dichiarato dal cliente**: fatturato, litri o numero di clienti. Cambia radicalmente la strategia.
7. **Listino latte 3 L e 5 L**, oggi inesistente a scaglioni.
8. **Anagrafiche incomplete**: 12 clienti su 30 senza provincia, email presente solo sul 40% dei prospect.

---

## Allegato: elenco cronologico degli ordini validi

| Data | Numero | Cliente | Modalità | Netto € |
|---|---|---|---|---|
| 2025-01-29 | 0016/2025 | Maestrodolio di Fausto Borella | vendita | 396.00 |
| 2025-06-23 | 0017/2025 | Maestrodolio di Fausto Borella | vendita | 792.00 |
| 2025-07-21 | 0018/2025 | Maestrodolio di Fausto Borella | vendita | 372.00 |
| 2025-08-26 | 0009/2025 | Il cacito | conto_vendita | 132.00 |
| 2025-09-03 | 1014/2025 | Ticcu Ticcu | vendita | 165.00 |
| 2025-09-29 | 1001/2025 | Terrazza 45 | vendita | 156.00 |
| 2025-10-01 | 1002/2025 | Allianz assicurazioni di Barlondi | vendita | 432.00 |
| 2025-10-08 | 0019/2025 | Maestrodolio di Fausto Borella | vendita | 360.00 |
| 2025-10-21 | 1003/2025 | Voip Service | vendita | 660.00 |
| 2025-11-14 | 0020/2025 | Maestrodolio di Fausto Borella | vendita | 1182.00 |
| 2025-11-17 | 1004/2025 | Enoteca Cusi | conto_vendita | 78.00 |
| 2025-11-17 | 1005/2025 | Mariano | vendita | 156.00 |
| 2025-11-18 | 1006/2025 | Enoteca Colle S. Elena | conto_vendita | 460.00 |
| 2025-11-26 | 1007/2025 | MACELLERIA MARTINI | vendita | 315.50 |
| 2025-11-26 | 1008/2025 | Villa Cassia di Baccano | conto_vendita | 824.00 |
| 2025-12-01 | 1009/2025 | Centro Tennis Olimpia | vendita | 156.00 |
| 2025-12-01 | 1010/2025 | Enoteca La cantina | conto_vendita | 312.00 |
| 2025-12-09 | 1011/2025 | Macelleria Giannelli | vendita | 156.00 |
| 2025-12-11 | 1012/2025 | Alimentari Murino | vendita | 156.00 |
| 2025-12-15 | 1013/2025 | F.lli Micheli | conto_vendita | 156.00 |
| 2025-12-19 | 0021/2025 | Maestrodolio di Fausto Borella | vendita | 0.00 |
| 2025-12-23 | 0009/2026 | Hotel Tornabuoni - Il Magnifico restaurant | vendita | 647.00 |
| 2026-01-07 | 1001/2026 | L' Angolo del Mare | vendita | 140.00 |
| 2026-01-15 | 0010/2026 | Hotel Tornabuoni - Il Magnifico restaurant | vendita | 587.50 |
| 2026-01-22 | 1002/2026 | Enoteca Colle S. Elena | vendita | 156.00 |
| 2026-02-10 | 1003/2026 | Gilda bistrot | vendita | 156.00 |
| 2026-02-23 | 0011/2026 | Hotel Tornabuoni - Il Magnifico restaurant | vendita | 1250.00 |
| 2026-03-05 | 1004/2026 | Pescheria Marisa | vendita | 140.00 |
| 2026-03-17 | 1005/2026 | Massimo Lucchini | vendita | 176.00 |
| 2026-03-19 | 0017/2026 | Maestrodolio di Fausto Borella | vendita | 264.00 |
| 2026-03-23 | 1006/2026 | Ciro in Florence - Columbus Hotel | vendita | 156.00 |
| 2026-04-08 | 1009/2026 | Minolive | vendita | 1352.00 |
| 2026-05-15 | 0014/2026 | Hotel Tornabuoni - Il Magnifico restaurant | vendita | 1245.40 |
| 2026-05-15 | 0016/2026 | Masiero Silva Luciana Carla | vendita | 87.50 |
| 2026-05-15 | 0019/2026 | Maestrodolio di Fausto Borella | vendita | 0.00 |
| 2026-05-20 | 0007/2026 | Liquorama Firenze | conto_vendita | 30.50 |
| 2026-05-20 | 1007/2026 | Dimora Palanca | vendita | 360.00 |
| 2026-05-20 | 1010/2026 | Enoteca Enotria | vendita | 144.00 |
| 2026-05-21 | 0018/2026 | Maestrodolio di Fausto Borella | vendita | 384.00 |
| 2026-05-25 | 0012/2026 | Hotel Tornabuoni - Il Magnifico restaurant | vendita | 141.00 |
| 2026-05-25 | 0013/2026 | Hotel Tornabuoni - Il Magnifico restaurant | vendita | 564.00 |
| 2026-05-27 | 0020/2026 | Massimo Lucchini | vendita | 140.00 |
| 2026-06-10 | 1013/2026 | Buca Poldo | vendita | 0.00 |
| 2026-06-12 | 1014/2026 | Buca Poldo | vendita | 284.00 |
| 2026-06-18 | 1016/2026 | Hotel Tornabuoni - Il Magnifico restaurant | vendita | 986.40 |
| 2026-06-22 | 1017/2026 | Il cacito | vendita | 156.00 |
| 2026-06-25 | 1019/2026 | Terrazza 45 | vendita | 132.00 |
| 2026-07-14 | 0001/0026 | Grimaldi Francesco | vendita | 26.92 |
| 2026-08-31 | 1020/2026 | Don Elliott | vendita | 301.92 |

---

Estrazione a cura del gestionale Tenute Nonno Bruno, 7 settembre 2026. Tutti gli importi sono netti IVA.

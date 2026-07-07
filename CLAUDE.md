# CLAUDE.md — istruzioni per il progetto

Gestionale Pro di **Tenute Nonno Bruno**: single-page app (tutto in `index.html`, React compilato), hosting **Netlify** (produzione dal branch `main`), backend **Supabase** (storage bucket `tnb-firme`) + Netlify Function `netlify/functions/report-ai.mjs`.

## ⚠️ Regola di verifica (SEMPRE)

1. **All'inizio di ogni sessione**, leggi **`DA-FARE.md`**: contiene le cose in sospeso e le decisioni aperte. Tienilo presente prima di proporre o fare modifiche.
2. **Prima di chiudere un task**, aggiorna **`DA-FARE.md`**: sposta in "✅ Fatto di recente" ciò che hai completato e aggiungi eventuali nuovi punti in sospeso.
3. Non considerare un lavoro concluso finché `DA-FARE.md` non riflette lo stato reale.

## Note operative
- La produzione va online solo con push/merge su **`main`** (Netlify ridepolya in automatico). Non pushare su `main` senza ok esplicito.
- Preferire modifiche **a comportamento invariato**; segnalare sempre ciò che tocca login/RLS/PDF perché sono aree a rischio (vedi `DA-FARE.md`).

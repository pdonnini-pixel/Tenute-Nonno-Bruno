// Netlify Functions v2 (ESM) — streaming.
// Genera il report AI in streaming: i token di Anthropic vengono inoltrati al
// client come testo semplice man mano che arrivano. Questo evita il 504
// "Inactivity Timeout" di Netlify (i byte fluiscono di continuo) e mostra il
// report progressivamente nel frontend.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

export default async (req) => {
  // Rileva il metodo HTTP in modo robusto. In alcuni adapter/runtime Netlify il
  // metodo puo' non essere esposto come req.method (es. event.httpMethod), e un
  // confronto diretto "req.method !== POST" generava un 405 spurio sul report AI.
  const method = (req.method || req.httpMethod || "").toUpperCase();
  if (method === "OPTIONS") {
    return new Response("", { status: 200, headers: CORS });
  }
  // Rifiuta solo se il metodo e' NOTO e diverso da POST. Se il metodo non e'
  // determinabile, proseguiamo: una eventuale richiesta senza body valido verra'
  // comunque gestita piu' sotto con un 400 chiaro, non con un 405 fuorviante.
  if (method && method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY non configurata" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" }
    });
  }

  let body;
  try {
    body = await req.json();
  } catch (_) {
    return new Response(JSON.stringify({ error: "Body non valido" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" }
    });
  }
  const { domanda, datiProspect, datiClienti, datiOrdini, contesto } = body;

  const systemPrompt = `Sei l'assistente AI di Tenute Nonno Bruno, un'azienda agricola toscana che produce olio EVO e vino.
Analizzi i dati dei prospect e clienti e generi report professionali per la proprietà.

REGOLE:
- Scrivi in italiano, tono professionale ma chiaro
- Usa dati concreti: numeri, date, percentuali
- Evidenzia trend positivi e criticità
- Suggerisci azioni concrete per ogni situazione
- Se un prospect non ha attività recenti, segnalalo
- Raggruppa per categoria/stato quando ha senso
- Sii sintetico e diretto: vai al punto, niente preamboli
- Alla fine aggiungi sempre un RIEPILOGO ESECUTIVO di 3-5 righe per la proprietà

FORMATTAZIONE (IMPORTANTE):
- Scrivi in TESTO SEMPLICE. Il report viene mostrato senza rendering: NON usare sintassi Markdown.
- VIETATO usare: ## (cancelletti per i titoli), ** (asterischi per il grassetto), --- (righe di separazione), tabelle con il carattere |
- Per i titoli di sezione usa il TESTO MAIUSCOLO, eventualmente con un'emoji iniziale (es. "📋 ANAGRAFICA E STATO")
- Per gli elenchi usa un trattino semplice "- " a inizio riga
- Per evidenziare un dato scrivilo in chiaro (es. "Chiamate effettuate: 0"), senza asterischi
- Separa le sezioni con una riga vuota, non con trattini

DATI AZIENDALI:
${contesto || "Tenute Nonno Bruno — olio EVO e vino, Bagno a Ripoli (FI)"}`;

  const userMessage = `DOMANDA: ${domanda}

DATI PROSPECT/CLIENTI SELEZIONATI:
${JSON.stringify(datiProspect, null, 2)}

${datiClienti ? "DATI CLIENTI CORRELATI:\n" + JSON.stringify(datiClienti, null, 2) : ""}

${datiOrdini ? "ORDINI CORRELATI:\n" + JSON.stringify(datiOrdini, null, 2) : ""}

Genera il report richiesto basandoti su questi dati.`;

  let upstream;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
        max_tokens: 2500,
        stream: true,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }]
      })
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Errore di rete verso Anthropic: " + err.message }), {
      status: 502, headers: { ...CORS, "Content-Type": "application/json" }
    });
  }

  if (!upstream.ok) {
    const txt = await upstream.text().catch(() => "");
    console.error("Anthropic API error:", upstream.status, txt);
    return new Response(JSON.stringify({ error: "Errore API: " + upstream.status }), {
      status: 502, headers: { ...CORS, "Content-Type": "application/json" }
    });
  }

  // Trasforma lo stream SSE di Anthropic in testo semplice (solo i text_delta).
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) { controller.close(); return; }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // ultima riga (potenzialmente incompleta) resta nel buffer
        for (const line of lines) {
          const l = line.trim();
          if (!l.startsWith("data:")) continue;
          const data = l.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const evt = JSON.parse(data);
            if (evt.type === "content_block_delta" && evt.delta && typeof evt.delta.text === "string") {
              controller.enqueue(encoder.encode(evt.delta.text));
            }
          } catch (_) { /* riga SSE non-JSON: ignora */ }
        }
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() { try { reader.cancel(); } catch (_) {} }
  });

  return new Response(stream, {
    status: 200,
    headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" }
  });
};

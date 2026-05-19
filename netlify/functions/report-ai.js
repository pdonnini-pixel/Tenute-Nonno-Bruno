const https = require("https");

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST" }, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "ANTHROPIC_API_KEY non configurata" }) };
  }

  try {
    const { domanda, datiProspect, datiClienti, datiOrdini, contesto } = JSON.parse(event.body);

    const systemPrompt = `Sei l'assistente AI di Tenute Nonno Bruno, un'azienda agricola toscana che produce olio EVO e vino.
Analizzi i dati dei prospect e clienti e generi report professionali per la proprietà.

REGOLE:
- Scrivi in italiano, tono professionale ma chiaro
- Usa dati concreti: numeri, date, percentuali
- Evidenzia trend positivi e criticità
- Suggerisci azioni concrete per ogni situazione
- Se un prospect non ha attività recenti, segnalalo
- Raggruppa per categoria/stato quando ha senso
- Alla fine aggiungi sempre un RIEPILOGO ESECUTIVO di 3-5 righe per la proprietà

DATI AZIENDALI:
${contesto || "Tenute Nonno Bruno — olio EVO e vino, Bagno a Ripoli (FI)"}`;

    const userMessage = `DOMANDA: ${domanda}

DATI PROSPECT/CLIENTI SELEZIONATI:
${JSON.stringify(datiProspect, null, 2)}

${datiClienti ? "DATI CLIENTI CORRELATI:\n" + JSON.stringify(datiClienti, null, 2) : ""}

${datiOrdini ? "ORDINI CORRELATI:\n" + JSON.stringify(datiOrdini, null, 2) : ""}

Genera il report richiesto basandoti su questi dati.`;

    const requestBody = JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }]
    });

    const response = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        }
      }, (res) => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => resolve({ statusCode: res.statusCode, body: data }));
      });
      req.on("error", reject);
      req.write(requestBody);
      req.end();
    });

    if (response.statusCode !== 200) {
      console.error("Anthropic API error:", response.body);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Errore API: " + response.statusCode })
      };
    }

    const result = JSON.parse(response.body);
    const reportText = result.content[0].text;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ report: reportText })
    };

  } catch (err) {
    console.error("Report AI error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message })
    };
  }
};

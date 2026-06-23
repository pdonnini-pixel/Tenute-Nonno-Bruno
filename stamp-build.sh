#!/usr/bin/env bash
# Stampa la data/ora di pubblicazione (fuso Europe/Rome) dentro index.html,
# sostituendo la costante window.__TNB_BUILD__. Eseguito da Netlify ad ogni deploy.
# Non deve mai far fallire il build: in caso di problemi esce comunque con 0.
set +e

TS="$(TZ='Europe/Rome' date '+%Y-%m-%d %H:%M')"

if [ -f index.html ]; then
  TS="$TS" perl -i -pe 's/window\.__TNB_BUILD__ = "[^"]*";/window.__TNB_BUILD__ = "$ENV{TS}";/' index.html
  echo "TNB stamp: window.__TNB_BUILD__ = \"$TS\" (Europe/Rome)"
else
  echo "TNB stamp: index.html non trovato, salto."
fi

exit 0

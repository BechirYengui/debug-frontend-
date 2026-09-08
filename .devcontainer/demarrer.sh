#!/usr/bin/env bash
# Démarre Debug Frontend dans un Codespace, avec la seconde origine que le défi 15
# (CORS) doit viser : dans un Codespace, le port 3001 est publié sur un autre nom
# d'hôte que le port 3000, donc le calcul « port + 1 » ne convient pas.
set -u

if [ -n "${CODESPACE_NAME:-}" ]; then
  export DOJO_ALT_ORIGIN="https://${CODESPACE_NAME}-3001.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
  echo "Seconde origine (défi 15) : $DOJO_ALT_ORIGIN"
  echo "Pour partager le lien et pour que le défi 15 se comporte comme en production,"
  echo "rends les deux ports publics :"
  echo "  gh codespace ports visibility 3000:public 3001:public -c \"$CODESPACE_NAME\""
fi

exec npm start

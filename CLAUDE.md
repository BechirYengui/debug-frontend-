# Debug Frontend : consignes pour Claude

## Nom du projet

Le projet s'appelle **Debug Frontend** (avec un espace) partout où le nom est visible : navbar,
titres, README, documentation, `package.json`. Ne pas réintroduire « Debug Dojo ». Les
identifiants internes (routes `/_dojo/`, cookie `dojo_user`, classes CSS `dojo-*`, variables
d'environnement `DOJO_*`) gardent leur préfixe : ils ne sont pas visibles par les joueurs.

## Typographie

- **Aucun tiret long** dans les textes : ni « — » (em dash), ni « – » (en dash), ni `&mdash;`,
  ni `&ndash;`. Cela vaut pour l'interface, les corrigés, la documentation, les chaînes JS et
  les commentaires. Séparer avec « : », « · », une virgule ou une parenthèse. Pour un
  placeholder « pas encore de valeur », utiliser « … ».
- Français correct avec accents et apostrophes droites `'` dans tout texte visible. Les
  identifiants techniques restent en ASCII.
- Vérification rapide avant de livrer : `grep -rnE "—|–|&mdash;|&ndash;" --include=*.{js,html,md,css} . | grep -v node_modules`

## Bilingue FR / EN

- Tout texte d'interface passe par `lib/i18n.js` (clés `{{t:clé}}` dans les gabarits, `t(lang, clé)`
  côté serveur, `T(clé)` dans `dojo.js`). Toute nouvelle clé existe dans les deux langues.
- Le contenu pédagogique d'un défi est écrit dans `data/challenges.js` (FR) ET `data/challenges.en.js`
  (EN, même ordre des choix de quiz) ; le corrigé dans `solutions/NN.md` ET `solutions/en/NN.md`.
- Les fausses applications à déboguer (`challenges/NN.html`, `public/c/NN.*`) restent en français.

## Règles du projet

- Un défi = une seule anomalie volontaire ; tout le reste de la page fonctionne. Aucun
  commentaire ne révèle le bug. Voir `docs/ecrire-un-defi.md`.
- Le chrome commun (`public/static/dojo.js`, `dojo.css`, `views/`) ne fait jamais partie de
  l'exercice ; le bug est toujours dans `public/c/NN.*` ou `challenges/NN.html`.
- Les corrigés `solutions/` ne sont jamais servis comme fichiers statiques.
- Après toute modification : `npm test`, et `node test/browser-check.js` si un défi ou le chrome
  a changé.

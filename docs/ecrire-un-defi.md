# Écrire un nouveau défi

Un défi Debug Frontend, c'est une fausse page métier crédible, **une seule anomalie** volontaire,
et une couche pédagogique complète : contexte, indices, débrief, quiz, corrigé. Cette page
décrit les fichiers à créer et les règles à respecter pour qu'un défi soit juste, honnête et
formateur.

## 1. Choisir le bug

Un bon défi repose sur un bug **réel**, rencontré en production, dont la cause est unique et
la démonstration nette. Avant d'écrire une ligne, réponds à ces questions :

- **Quelle famille ?** `dom` (le clic n'atteint pas le bouton), `js` (le clic arrive, le code
  déraille) ou `net` (la requête part, mais elle ne convient pas).
- **Quel geste DevTools veut-on enseigner ?** Un défi = un geste principal (Pause on caught
  exceptions, Copy as fetch, Block request URL, panneau Application…). Vérifie qu'aucun défi
  existant ne l'enseigne déjà de la même façon.
- **Quel symptôme voit le joueur au premier clic ?** Il doit être reproductible et sans
  ambiguïté.
- **Quels chemins de résolution existent ?** Au moins trois : réparer en direct (Elements /
  Sources), corriger à chaud pendant une pause, et rejouer la requête depuis la Console.
- **Le défi peut-il se résoudre par accident ?** Une requête qui atteint parfois le serveur, un
  état qui dépend du hasard, un timer court : à proscrire.

## 2. Les fichiers

Pour un défi `NN` (deux chiffres) :

| Fichier | Rôle |
|---|---|
| `data/challenges.js` | Une entrée dans `CHALLENGES` : métadonnées et texte pédagogique |
| `challenges/NN.html` | Fragment en trois sections : `<!--HEAD-->`, `<!--WORKSPACE-->`, `<!--SCRIPTS-->` |
| `public/c/NN.js` | Le code de la page (lisible pour ★ et ★★, minifié sur une ligne pour ★★★) |
| `public/c/NN.css` | Styles propres au défi |
| `solutions/NN.md` | Le corrigé complet (jamais servi avant résolution ou demande explicite) |
| `solutions/sources/NN.src.js` | La source lisible d'un fichier minifié |

Aucun autre fichier n'a besoin de changer : le serveur découvre le défi via `data/challenges.js`.

## 3. L'entrée dans `data/challenges.js`

```js
{
  id: '19', stars: 2, minutes: 15, family: 'net', tabs: ['Network', 'Console'],
  minified: false, requiresToken: false,
  title: "Titre court, une action métier",
  subtitle: "Contexte : ce que le bouton est censé faire.",
  intro: "Pourquoi ce défi : le sens du problème, pourquoi il arrive en vrai, ce qu'il apprend.",
  symptom: "Ce que le joueur observe au premier clic.",
  learn: ["Objectif 1", "Objectif 2", "Objectif 3"],
  hints: [
    "Niveau 1 : quel onglet ouvrir.",
    "Niveau 2 : quelle zone, quel élément regarder.",
    "Niveau 3 : la nature exacte du problème, sans la solution."
  ],
  debrief: {
    cause: "Ce qui cassait, en citant les noms réels du code.",
    reflex: "Le réflexe à garder, transférable à d'autres situations."
  },
  quiz: {
    question: "Une question qui vérifie la compréhension de la cause.",
    choices: ["Distracteur plausible", "Bonne réponse", "Distracteur", "Distracteur"],
    answer: 1,
    why: "Pourquoi c'est la bonne réponse, en une ou deux phrases."
  }
}
```

Règles d'écriture :

- **`intro`** est le paragraphe le plus important : il explique *à quoi sert* le problème. Cite
  la situation réelle (composant, motif de code, erreur humaine) et le réflexe entraîné.
- **`hints`** progressent du général au précis et **ne donnent jamais la solution**. Le
  niveau 3 nomme la nature du problème (« un ancêtre coupe la propagation »), pas le nœud ni
  la ligne.
- **`quiz`** : les distracteurs correspondent à d'autres défis ou à des idées reçues. Une
  seule bonne réponse. Le `why` enseigne quelque chose même à qui a répondu juste.
- **`tabs`** : les onglets réellement nécessaires (Elements, Console, Network, Sources,
  Application). Ils s'affichent sur la carte.

## 4. Le fragment HTML

```html
<!--HEAD-->
<link rel="stylesheet" href="/c/NN.css">
<!--/HEAD-->

<!--WORKSPACE-->
<div class="card"> … </div>
<!--/WORKSPACE-->

<!--SCRIPTS-->
<script src="/c/NN.js" defer></script>
<!--/SCRIPTS-->
```

- Le bouton principal porte **exactement** le libellé `Valider la commande` et la classe
  `btn btn-primary`.
- Utilise les classes du chrome commun (`.card`, `.grid-2`, `.field`, `.stat`, `.checks`,
  `.kv`, `.chip`, `.log`…) : la page doit ressembler aux autres.
- Le workspace est en `z-index: 1`, les panneaux du dojo en `z-index: 10000` : un overlay de
  défi (`z-index: 9000`) recouvre le terrain de jeu sans jamais gêner les indices ni le verdict.
- Ne référence jamais `window.DOJO` ni les éléments `dojo-*` : le chrome ne fait pas partie de
  l'exercice.

## 5. Le code du défi

- Une IIFE en mode strict, `var`, pas de dépendance. Des fausses données réalistes, un
  `refresh()` branché sur `input`/`change`, un journal `.log` honnête qui insère la ligne la
  plus récente en haut.
- **Tout fonctionne sauf l'anomalie.** Les compteurs, tableaux, contrôles et messages doivent
  être justes : un faux indice détourne le joueur et décrédibilise le défi.
- Le payload envoyé contient `challengeId`, `action: 'validate'` et deux ou trois champs
  métier. Les champs supplémentaires sont acceptés par le serveur.
- Aucun commentaire ne révèle le bug. Pas de `// BUG`, pas de `TODO`.
- Pour un ★★★, écris d'abord `solutions/sources/NN.src.js` (lisible, noms courts), puis colle
  le tout sur une ligne dans `public/c/NN.js`. Vérifie avec `node --check`.
- Si le défi laisse une trace dans le navigateur (localStorage, cookie), ajoute la clé dans
  `BROWSER_STATE` de `public/static/home.js` pour que le bouton *reset* la purge.

## 6. Le corrigé `solutions/NN.md`

Même structure que les corrigés existants :

```markdown
# Défi NN : Titre

**Difficulté :** ★★☆ · **Famille :** la requête part, mais elle ne convient pas.

## Cause
## Diagnostic pas à pas
## Contournements
## Le réflexe à garder
```

- **Cause** : cite les lignes réelles du code, explique le mécanisme, puis pourquoi ce bug
  existe dans la vraie vie.
- **Diagnostic pas à pas** : l'enchaînement d'onglets et de gestes, dans l'ordre où un
  ingénieur les ferait, avec les commandes Console exactes.
- **Contournements** : au moins trois variantes (**A.**, **B.**, **C.**…), dont toujours
  « Rejouer la requête depuis la Console » avec le `fetch` complet.
- **Le réflexe à garder** : ce qui reste quand on a oublié le défi.

## 7. Vérifier

1. `npm test` : le serveur accepte la requête cible du nouveau défi et refuse les variantes.
2. Ouvre le défi dans un navigateur, clique : le symptôme est exactement celui décrit dans
   `symptom`. Vérifie que la page se charge sans erreur et que rien d'autre ne cloche.
3. Résous-le par chacun des contournements du corrigé, en remettant le défi à zéro entre deux.
4. Fais-le tester par quelqu'un qui ne connaît pas le bug : chronomètre, note les indices
   utilisés, ajuste `stars` et `minutes`.
5. Relis `intro`, `hints`, `debrief` et `quiz` à voix haute : accents, apostrophes, et surtout
   aucune solution dans les indices.

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
| `data/challenges.js` | Une entrée dans `CHALLENGES` : métadonnées et texte pédagogique (français) |
| `data/challenges.en.js` | La même entrée en anglais, sous la clé `'NN'` (voir § 3 bis) |
| `challenges/NN.html` | Fragment en trois sections : `<!--HEAD-->`, `<!--WORKSPACE-->`, `<!--SCRIPTS-->` |
| `public/c/NN.js` | Le code de la page (lisible pour ★ et ★★, minifié sur une ligne pour ★★★) |
| `public/c/NN.css` | Styles propres au défi |
| `solutions/NN.md` | Le corrigé complet en français (jamais servi avant résolution ou demande explicite) |
| `solutions/en/NN.md` | Le même corrigé en anglais |
| `solutions/sources/NN.src.js` | La source lisible d'un fichier minifié |

Aucun autre fichier n'a besoin de changer : le serveur découvre le défi via `data/challenges.js`.
Si le défi laisse une trace dans le navigateur (localStorage, cookie), ajoute aussi la clé dans
`BROWSER_STATE` de `public/static/home.js` (voir § 5).

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

## 3 bis. La version anglaise dans `data/challenges.en.js`

L'interface est bilingue : un joueur en anglais lit le même défi, avec les mêmes indices et le
même quiz. Ajoute une entrée sous la clé `'NN'` de `CHALLENGES` :

```js
'19': {
  title: 'Short title, one business action',
  subtitle: 'Context: what the button is supposed to do.',
  intro: '...', symptom: '...',
  learn: ['...', '...', '...'],
  hints: ['...', '...', '...'],
  debrief: { cause: '...', reflex: '...' },
  quiz: { question: '...', choices: ['...', '...', '...', '...'], why: '...' }
}
```

Règles :

- Mêmes tailles qu'en français : 3 indices, autant d'objectifs `learn`, 4 choix de quiz **dans le
  même ordre**. L'index de la bonne réponse (`answer`) n'est lu qu'en français : ne le redéfinis
  pas en anglais. Les métadonnées (`stars`, `family`, `tabs`, `minified`…) viennent aussi du FR.
- La fausse application reste en français (`challenges/NN.html`, `public/c/NN.*`). Quand un texte
  anglais cite un libellé de la page, garde-le en français avec une traduction entre parenthèses :
  `"prêt à expédier" (ready to ship)`. En revanche, les éléments du chrome se nomment par leur
  libellé anglais : `"Server log" panel`, `"Goal" box`, `Profile page`.
- Les messages du serveur (`lib/i18n.js`, clés `api.*`) existent dans les deux langues : le joueur
  anglais reçoit la version anglaise. Cite chaque message tel quel dans la langue du texte.

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

Puis écris `solutions/en/NN.md`, même structure, titre `# Challenge NN: Title`, sections
`## Cause`, `## Step-by-step diagnosis`, `## Workarounds`, `## The reflex to keep`, et le même
nombre de blocs de code que la version française (les extraits de code sont identiques, seuls les
commentaires et le texte changent). Le serveur sert `solutions/en/NN.md` aux joueurs en anglais et
se rabat sur la version française si elle manque.

Deux limites du moteur Markdown maison (`lib/markdown.js`) à connaître : une ligne composée
uniquement d'un segment en gras est rendue comme un sous-titre (c'est ce qui sert pour **A.**,
**B.**…), donc ne coupe jamais un paragraphe de façon à laisser une telle ligne seule ; et un
bloc de code imbriqué dans une liste doit être indenté sous son élément.

## 7. Vérifier

1. `npm test` : `test/api.test.js` vérifie que le serveur accepte la requête cible du nouveau défi
   et refuse les variantes ; `test/content.test.js` vérifie, sans serveur, tout ce que cette page
   demande : les deux entrées FR/EN (tailles, champs non vides, familles, onglets), les mêmes clés
   dans les dictionnaires i18n, le fragment HTML (trois sections, un seul bouton « Valider la
   commande », `<script src="/c/NN.js" defer>`), les fichiers `public/c/NN.*`, les deux corrigés
   (titres, quatre sections, même nombre de blocs de code, rejeu `fetch` de la requête cible), la
   source lisible d'un fichier minifié, l'absence de tiret long et de commentaire révélateur, et
   que les indices ne contiennent pas l'identifiant clé du bug. Pour un nouveau défi, ajoute cet
   identifiant à la liste `LEAKS` du test (une entrée par défi, sinon le test échoue).
2. Ouvre le défi dans un navigateur, clique : le symptôme est exactement celui décrit dans
   `symptom`. Vérifie que la page se charge sans erreur et que rien d'autre ne cloche.
3. Résous-le par chacun des contournements du corrigé, en remettant le défi à zéro entre deux.
4. Fais-le tester par quelqu'un qui ne connaît pas le bug : chronomètre, note les indices
   utilisés, ajuste `stars` et `minutes`.
5. Relis `intro`, `hints`, `debrief` et `quiz` à voix haute : accents, apostrophes, et surtout
   aucune solution dans les indices.

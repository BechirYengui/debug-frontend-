# Debug Frontend

Plateforme d'entraînement au debugging front-end. **Dix-huit pages web volontairement
cassées**, à réparer **avec les DevTools du navigateur uniquement**. Chaque défi est une fausse
application métier crédible (déploiement, banque, IoT, supervision, comptabilité…) dont le
bouton principal ne marche pas, ou marche mal.

Le projet s'adresse aux ingénieurs qui veulent apprendre, réviser ou évaluer les réflexes de
diagnostic front : lire un DOM, suivre une exécution, comparer ce que le code croit envoyer et
ce qui arrive vraiment au serveur. C'est aussi un excellent support d'atelier d'équipe ou
d'entretien technique du type : « voilà une page, le bouton ne marche pas, fais partir la
requête ».

Stack : Node.js + Express, front en HTML/CSS/JS **vanilla**. Pas de React, pas de bundler,
pas de sourcemaps. Du DOM brut à inspecter. Aucune dépendance autre qu'Express.

---

## Lancement

```bash
npm install
npm start
```

Puis ouvre **http://localhost:3000**.

**Garde le terminal visible pendant que tu joues.** Le serveur y journalise, pour chaque
requête reçue sur `/api/`, le verbe, l'URL, le port, les en-têtes pertinents et le corps brut :

```
  ┌──────────────────────────────────────────────────────────────────────
  │ [14:02:11] POST /api/challenge/11/solve   sur le port 3000  ·  profil Bechir
  ├──────────────────────────────────────────────────────────────────────
  │ content-type    : application/json
  │ content-length  : 15
  │ x-api-token     : (absent)
  │ body brut       : "[object Object]" [15 octets]
  └─> 400  Corps reçu illisible en JSON (15 octets). Ce qui est arrivé commence par : « [object Object] ».
```

C'est ton miroir : il te permet de comparer **ce que tu crois envoyer** et **ce qui arrive
vraiment**. La moitié du travail de debug est là.

Le serveur écoute aussi sur le port suivant (3001 par défaut) : il sert la même application et
n'existe que pour le défi 15 (CORS).

---

## Règle du jeu

Chaque page contient un bouton **« Valider la commande »**. Il ne marche pas, ou il marche mal.
L'objectif est **toujours le même** : faire arriver au serveur cette requête exacte.

```
POST /api/challenge/<id>/solve
Content-Type: application/json

{"challengeId":"<id>","action":"validate"}
```

Le serveur répond soit un succès, soit **la raison précise pour laquelle la requête reçue ne
convient pas**, jamais comment la réparer. Des champs supplémentaires dans le corps JSON sont
acceptés : seuls `challengeId` et `action` sont vérifiés.

Tous les chemins sont légitimes : réparer le DOM ou le CSS en direct dans **Elements**, poser
un point d'arrêt et corriger une valeur à chaud dans **Sources**, rejouer la requête depuis la
**Console** avec `fetch`, partir de la requête existante avec **Copy as fetch** dans
**Network**, bloquer un script, purger un stockage dans **Application**.

Ce qui compte n'est pas de réussir, c'est de savoir **pourquoi** ça cassait.

### Le parcours d'un défi

1. **Pourquoi ce défi** : un paragraphe explique le sens du problème, pourquoi il arrive en
   production et ce que le défi entraîne, avec les objectifs d'apprentissage et le symptôme
   attendu.
2. **Le terrain de jeu** : la fausse application, à réparer avec les DevTools.
3. **La dernière réponse du serveur** : verdict, verbe, en-têtes et corps reçus, mis à jour en
   direct même si tu envoies la requête depuis la Console ou avec `curl`.
4. **Les indices** : trois niveaux (quel onglet, quelle zone, la nature du problème), jamais la
   solution. Un bouton **« Je sèche »** ouvre le corrigé complet en marquant le défi.
5. **Le débrief** (après résolution) : ce qui cassait, le réflexe à garder, un **quiz de
   compréhension** validé côté serveur, le corrigé complet et le défi suivant conseillé.

---

## Les trois parcours

Les défis sont regroupés par famille de bug, dans l'ordre naturel d'un diagnostic.

### Parcours 1 · DOM & CSS : le clic n'atteint pas le bouton

| # | Défi | ★ | Ce qu'il enseigne |
|---|---|---|---|
| 01 | Promotion de release | ★☆☆ | Un overlay en `opacity: 0` capte les clics. « Inspecter » sur le bouton, `elementFromPoint` |
| 02 | Ouverture de vanne | ★☆☆ | `disabled` dans le HTML alors que le style dit « actif ». Lire les attributs |
| 03 | Rotation de clé API | ★★☆ | `pointer-events: none` hérité d'un ancêtre. Panneau Computed, remonter l'arbre |
| 04 | Publication d'un article | ★★☆ | Un `::after` décoratif déborde sur le bouton. Pseudo-éléments et empilement |

### Parcours 2 · JavaScript : le clic arrive, le code déraille

| # | Défi | ★ | Ce qu'il enseigne |
|---|---|---|---|
| 13 | Blocage d'un compte marchand | ★☆☆ | Lire une stack trace, `null (reading 'value')`, id HTML mal orthographié |
| 05 | Envoi d'un lot de notifications | ★★☆ | Script exécuté avant le DOM, abonnement silencieusement raté. Event Listeners |
| 14 | Mise en pause d'une campagne | ★★☆ | Erreur d'unité (s / ms) dans un `setTimeout`. Modifier une variable pendant une pause |
| 07 | Expédition d'une commande | ★★★ | `stopPropagation()` sur un ancêtre casse la délégation. Listeners des ancêtres |
| 08 | Clôture d'un ticket | ★★★ | Exception avalée par un `catch {}` vide. Pause on caught exceptions |
| 18 | Réarmement d'une alarme | ★★★ | Écouteur `{ once: true }` consommé par un événement synthétique. `isTrusted`, closures |

### Parcours 3 · Réseau : la requête part, mais elle ne convient pas

| # | Défi | ★ | Ce qu'il enseigne |
|---|---|---|---|
| 06 | Réservation de salle | ★★☆ | Bouton `submit` dans un `<form>` : la navigation tue la requête. Preserve log |
| 09 | Mise à jour de firmware | ★★☆ | Wrapper HTTP avec `GET` par défaut. Colonne Method |
| 15 | Signature d'un bon de commande | ★★☆ | URL vers une autre origine : preflight `OPTIONS`, erreur CORS |
| 16 | Publication d'une grille tarifaire | ★★☆ | Jeton périmé mis en cache dans `localStorage`. Onglet Application, 401 vs 403 |
| 10 | Virement interne | ★★★ | `Content-Type` manquant, `text/plain` ajouté par le navigateur. Headers bruts |
| 11 | Import d'un fichier CSV | ★★★ | `JSON.stringify` oublié, `[object Object]` sur le fil. Payload → view source |
| 12 | Ouverture du coffre-fort | ★★★ | En-tête `X-Api-Token` manquant, jeton reçu au chargement. Toutes les requêtes de la page |
| 17 | Export des écritures comptables | ★★★ | `window.fetch` remplacé par un script tiers qui répond 202 à la place du serveur. Verbose, Block request URL |

Les défis ★★★ ont leur logique dans un fichier JS **minifié sur une seule ligne** : le bouton
**Pretty print `{}`** de l'onglet Sources et les points d'arrêt y sont obligatoires.

---

## Progression, score, profils

- **Comptes** : chaque joueur crée un compte (pseudo + mot de passe, haché avec scrypt) depuis
  la page d'accueil. La session est un cookie signé, valable 30 jours. La page **Profil**
  (`/profile`) porte les compteurs, la règle du jeu, le barème, la langue, l'export et la
  suppression du compte. Un profil hérité d'une ancienne version (sans mot de passe) est
  réclamé à la première connexion sous ce pseudo.
- **Attribution** : seules les requêtes envoyées depuis le navigateur connecté (page ou Console,
  qui portent le cookie de session) sont créditées. Une requête `curl` sans session est évaluée
  et reçoit le verdict, mais n'est pas comptée.
- **Langues** : toute la plateforme existe en français et en anglais (interface, contexte des
  défis, indices, débrief, quiz, corrigés, guide). Bascule FR / EN dans la barre de navigation ;
  le choix est mémorisé sur le compte. Les fausses applications à déboguer restent en français,
  comme des applications clientes réelles.
- **Chrono** : démarre au premier chargement de la page du défi, survit aux rechargements, se
  fige à la résolution.
- **Score** : base = étoiles × 100 points ; −10 % par indice révélé ; −50 % si le corrigé est
  ouvert avant de résoudre ; +25 points si le quiz est juste du premier coup (+10 sinon).
- **Ceintures** : une ceinture tous les 3 défis résolus (blanche, jaune, orange, verte, bleue,
  marron, noire). « Noire 1er dan » : tout résolu sans corrigé et tous les quiz justes.
- **Classement** : sur la page `/classement` (lien « Classement » dans la navbar).
- **Export** : « Exporter mes résultats » télécharge un JSON du profil (utile pour un mentor
  ou un bilan d'atelier).
- **Guide DevTools** : `/guide`, la checklist complète des réflexes, onglet par onglet.

Tout est persisté côté serveur dans `progress.json`. Un fichier de l'ancienne version (un seul
joueur) est migré automatiquement.

### Remise à zéro

Un bouton `reset` par carte sur le tableau de bord, et « Tout réinitialiser (ce profil) » sur la page Profil.
Le reset d'une carte purge aussi ce que le défi a pu laisser dans le navigateur (défi 16).

```bash
npm run reset                    # tous les défis du profil actif
npm run reset 7                  # seulement le défi 07
npm run reset 3 9 11             # une sélection
npm run reset -- --user=alice    # un autre profil
npm run reset -- --all           # tous les profils
npm run reset -- --list          # lister les profils
```

Refaire un défi une semaine plus tard, sans les indices, est le meilleur test.

---

## Utiliser le projet en atelier ou en entretien

- **Atelier d'équipe** : une instance hébergée (ou une machine partagée), un profil par
  personne, le classement au projecteur. Compter 2 à 3 heures pour un parcours complet, ou un
  parcours (4 à 8 défis) par session.
- **Entretien** : choisir un défi par famille selon le niveau visé (★☆☆ pour un profil
  junior, ★★★ pour un senior). Observer la démarche plus que le résultat : quel onglet en
  premier, quelle hypothèse, comment elle est vérifiée. Le débrief et le quiz font une
  excellente base de discussion.
- **Auto-formation** : suivre l'ordre conseillé (le tableau de bord le propose), lire le
  paragraphe « Pourquoi ce défi » avant de cliquer, et ne jamais ouvrir le corrigé avant
  d'avoir épuisé les trois indices.

Variables d'environnement utiles :

| Variable | Rôle | Défaut |
|---|---|---|
| `PORT` | port principal | `3000` |
| `DOJO_ALT_PORT` | port secondaire (défi 15) ; `0` pour le désactiver | `PORT + 1` |
| `DOJO_ALT_ORIGIN` | origine complète du « réplica » visé par le défi 15 quand l'app est derrière un reverse proxy | vide (hôte:port+1) |
| `DOJO_PROGRESS_FILE` | chemin du fichier de progression | `./progress.json` |
| `DOJO_QUIET` | désactive le journal du terminal | non défini |
| `DOJO_SECRET` | clé de signature des cookies de session (sinon générée et stockée dans `progress.json`) | générée |

---

## Déploiement sur un VPS

Le projet est prévu pour être hébergé et joué à distance : les joueurs n'ont pas besoin du
terminal, le panneau **« Journal du serveur »** de chaque défi leur montre ce qui est réellement
arrivé. Recette minimale :

```bash
git clone <ton dépôt> debug-frontend && cd debug-frontend
npm ci --omit=dev
PORT=3000 DOJO_ALT_ORIGIN=https://replica.debug.example.com npm start   # ou via pm2 / systemd
```

- **Reverse proxy** : proxifie `https://debug.example.com` vers `127.0.0.1:3000`. Le défi 15 (CORS) a
  besoin d'une **seconde origine** qui sert la même application sans en-têtes CORS : déclare un
  second nom (`replica.debug.example.com`, ou un autre port ouvert) proxifié vers le même
  processus, et indique-le dans `DOJO_ALT_ORIGIN`. Sans cette variable, le défi vise `hôte:port+1`,
  ce qui ne convient qu'en local.
- **Persistance** : `progress.json` est écrit dans le dossier du projet (ou `DOJO_PROGRESS_FILE`).
  Sauvegarde-le si la progression compte.
- **Comptes** : pseudo + mot de passe, sessions signées (`DOJO_SECRET` recommandé en production,
  sinon une clé est générée dans `progress.json`). Sers l'instance en HTTPS : les cookies de
  session sont `HttpOnly` et `SameSite=Lax`.
- **Journal terminal** : `DOJO_QUIET=1` pour le couper sur le serveur.

Exemple nginx :

```nginx
server {
  server_name debug.example.com replica.debug.example.com;
  listen 443 ssl;
  location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; }
}
```

## Développement

```bash
npm test                    # tests d'intégration du serveur (API, indices, corrigé, quiz, profils)
npm run check               # vérification de syntaxe de tous les fichiers JS
node test/browser-check.js  # bout en bout dans Chrome headless : chaque défi casse comme prévu
                            # au vrai clic souris, puis se résout et affiche son débrief
npm run dev                 # serveur avec rechargement automatique
```

### Structure

```
server.js                 serveur Express : pages, comptes, API de l'exercice, journal, débrief
data/challenges.js        catalogue des 18 défis (FR) : métadonnées, contexte, indices, débrief, quiz
data/challenges.en.js     les mêmes textes en anglais
lib/i18n.js               dictionnaire FR / EN de l'interface, choix de la langue, gabarits
lib/i18n.pages.js         textes de la landing page et des écrans de compte
lib/store.js              comptes, sessions signées, progression, score, ceintures, classement
lib/markdown.js           rendu Markdown des corrigés et du guide (sans dépendance)
views/                    gabarits : landing, connexion, inscription, tableau de bord, profil, défi, doc
public/static/            dojo.css, site.css (landing), dojo.js (chrome des défis), home.js, img/
challenges/NN.html        fragment propre à chaque défi (head / workspace / scripts)
public/c/NN.js|css        le code de chaque défi : c'est là que tu vas fouiller
solutions/NN.md           les corrigés (FR), servis uniquement après résolution ou « Je sèche »
solutions/en/NN.md        les corrigés en anglais
solutions/sources/        les sources lisibles des fichiers minifiés
docs/guide.md             le guide DevTools (servi sur /guide) ; docs/guide.en.md en anglais
docs/ecrire-un-defi.md    comment ajouter un défi
scripts/reset.js          npm run reset
test/                     tests d'intégration et vérification navigateur
```

Le chrome de la page (barre du haut, contexte, objectif, chrono, verdict, indices, débrief) est
fourni par `public/static/dojo.js` et `dojo.css`. Il ne fait jamais partie de l'exercice : le
bug est toujours dans `public/c/NN.*` ou dans le markup de `challenges/NN.html`.

### Ajouter un défi

Tout est dans [docs/ecrire-un-defi.md](docs/ecrire-un-defi.md) : choisir un bug réel et unique,
écrire la page, l'entrée du catalogue (contexte, indices, débrief, quiz) et le corrigé, puis
vérifier avec les tests et dans le navigateur. Les contributions sont bienvenues : un bon défi
enseigne **un** geste DevTools que les autres n'enseignent pas encore.

# Guide DevTools

Ce guide est le compagnon des défis de Debug Frontend. Il ne donne aucune solution : il rappelle **où regarder,
dans quel ordre, et avec quel geste**. C'est le cheminement naturel d'un diagnostic front-end,
celui qu'on attend d'un ingénieur en entretien comme en astreinte.

## 0. Trier avant de chercher

La première minute décide de tout. Trois questions, dans cet ordre :

1. **Le clic arrive-t-il au bouton ?** (Elements)
2. **Le code s'exécute-t-il jusqu'au bout ?** (Sources / Console)
3. **La requête qui part est-elle celle attendue ?** (Network)

| Symptôme | Où aller en premier |
|---|---|
| Rien ne se passe, Console vide, Network vide | **Elements** : qui reçoit le clic ? |
| Le bouton réagit visuellement mais rien ne part | **Sources** : le handler s'interrompt |
| Le journal de la page annonce un succès que le serveur n'a pas vu | **Network** + **Console** : quelque chose répond à la place du serveur |
| La page clignote, l'URL change | **Network** avec *Preserve log* |
| Une requête part mais échoue | **Network** : Method, Status, Headers, Payload, Response |
| Erreur rouge dans la Console | **Console** : lis la stack, clique le lien source |
| Un jeton est là mais refusé | **Application** : stockage local, cookies |

## 1. Elements

- [ ] **Clic droit sur l'élément → Inspecter** : DevTools sélectionne ce qui est *réellement*
      sous le curseur. Si ce n'est pas le bouton, tu tiens déjà la cause.
- [ ] Lire la balise **en entier** : `disabled`, `readonly`, `inert`, `hidden`, `aria-*`,
      `data-*`, pas seulement `class`.
- [ ] Panneau **Computed** + filtre : `pointer-events`, `display`, `visibility`, `opacity`,
      `z-index`, `position`. La flèche à côté de la valeur remonte à la règle et à l'élément
      qui l'impose.
- [ ] **Remonter l'arbre** : plusieurs contrôles morts d'un coup = un ancêtre est en cause.
- [ ] Déplier les **pseudo-éléments** `::before` / `::after` et les survoler pour voir la zone
      qu'ils occupent vraiment. Ils sont cliquables et absents du HTML source.
- [ ] Panneau **Event Listeners**, avec et sans *Ancestors*. Vide = le problème est en amont
      du handler (jamais posé, ou retiré) ; sur un ancêtre = délégation. Les options
      (`once`, `passive`, `capture`) y sont visibles.
- [ ] Éditer / supprimer un nœud, forcer un état (`:hover`, `:focus`), ajouter une règle CSS
      à la volée, glisser un nœud ailleurs dans l'arbre.

## 2. Console

- [ ] **Lire l'erreur jusqu'au bout** : `Cannot read properties of null (reading 'value')` dit
      *quel* objet vaut null. Cliquer le lien `fichier:ligne` ouvre Sources au bon endroit.
- [ ] Vérifier le **niveau de log** : *Verbose* masqué par défaut, *Preserve log*, filtres
      actifs. Une Console « vide » l'est parfois à cause d'un filtre.
- [ ] `document.elementFromPoint(x, y)` : qui capte le clic à cet endroit.
- [ ] `getComputedStyle(el).pointerEvents` : la valeur effective, pas celle du fichier CSS.
- [ ] `getEventListeners(el)` (Chrome) : les handlers, leurs options et leur référence exacte.
- [ ] `monitorEvents(el, 'click')` (Chrome) : voir si l'événement arrive, tout simplement.
- [ ] `$0` = élément sélectionné dans Elements, `$$('sel')` = `querySelectorAll`.
- [ ] Taper `fetch` : une fonction native affiche `ƒ fetch() { [native code] }`. Si tu vois du
      code, quelqu'un l'a remplacée.
- [ ] Rejouer une requête avec `fetch` : le geste qui débloque tout, sauf si `fetch` lui-même
      est compromis dans la page (alors `XMLHttpRequest`, un autre onglet, ou `curl`).
- [ ] Monkey-patcher pour tester une hypothèse :
      `Event.prototype.stopPropagation = function(){}`, ou envelopper `window.fetch`.

## 3. Network

- [ ] **Preserve log** coché par défaut. Sans lui, une navigation efface la preuve.
- [ ] La requête est-elle seulement **partie** ? C'est la question qui sépare les familles
      de bugs.
- [ ] Colonnes **Method** et **Status** (clic droit sur l'en-tête pour les afficher). Un
      statut `(canceled)`, `CORS error` ou `(blocked)` est une information, pas un bruit.
- [ ] **Headers → Request Headers**, en vue **Raw** : un en-tête présent ici mais absent du
      code a été ajouté par le navigateur (`Content-Type`, `Content-Length`, `Origin`,
      `Sec-Fetch-*`).
- [ ] **Payload → view source** : les octets réellement transmis, pas la vue embellie.
- [ ] **Response** : le serveur explique souvent exactement ce qui cloche.
- [ ] **Copy → Copy as fetch** : repartir de la requête réelle et ne changer qu'une chose à la
      fois. Le geste le plus rentable en entretien.
- [ ] Regarder **toutes** les requêtes de la page, pas seulement celle qui échoue :
      une réponse reçue au chargement contient souvent ce qui manque à la suivante.
- [ ] Un `OPTIONS` que tu n'as pas écrit = **preflight CORS**. Compare les deux origines
      (schéma + hôte + port) citées dans le message de la Console.
- [ ] **Block request URL** (clic droit sur une ressource) : empêcher un script tiers de se
      charger au prochain rechargement pour tester une hypothèse.
- [ ] Colonne **Initiator** : quel script a déclenché la requête.

## 4. Sources

- [ ] **Pretty print `{}`** avant tout sur du code minifié. Sans lui, tout est en ligne 1.
- [ ] **Pause on uncaught exceptions** ET **Pause on caught exceptions** : la seconde révèle
      tout ce qu'un `try/catch` vide dissimule. Presque personne ne la coche.
- [ ] **Event Listener Breakpoints** → *Mouse → click*, *Control → submit*, *Timer →
      setTimeout* : s'arrêter sur l'événement sans savoir où est le code. Un événement
      synthétique (`dispatchEvent`) déclenche aussi la pause : regarde `event.isTrusted`.
- [ ] Pas à pas : `F9` (step), `F10` (over), `F11` (into), `F8` (resume). Suivre le flux
      jusqu'à l'endroit où il dévie.
- [ ] Sur une pause, la **Console évalue dans le scope courant** : lire et **modifier** des
      variables de closure inaccessibles autrement, réattacher un écouteur, restaurer une
      fonction native.
- [ ] **Breakpoints conditionnels** et **Logpoints** : instrumenter sans modifier le fichier.
      Astuce : une condition `(x = valeurCorrigee) && false` corrige à la volée sans jamais
      s'arrêter.
- [ ] **Call Stack** : d'où vient l'appel, qui a déclenché quoi. Les cadres asynchrones
      (`setTimeout`, promesses) apparaissent sous *Async*.
- [ ] **XHR/fetch Breakpoints** : s'arrêter quand une URL contenant un motif est demandée.
- [ ] **Overrides** (Local overrides) : servir une version corrigée d'un fichier au prochain
      rechargement, sans toucher au serveur.

## 5. Application

- [ ] `localStorage`, `sessionStorage`, cookies, IndexedDB : un jeton ou un flag d'état s'y
      cache souvent. Comparer sa date d'émission et sa valeur avec la source de vérité.
- [ ] Supprimer ou éditer une entrée, puis observer si le code la régénère au chargement.
- [ ] Service workers : un SW peut intercepter et répondre à la place du réseau.

## 6. Le journal du serveur, ton miroir

Chaque page de défi a un panneau **« Journal du serveur »** : pour chaque requête reçue sur son
endpoint, le verbe, le port, les en-têtes pertinents, le corps brut en octets et le verdict. (En
local, le terminal où tourne `npm start` affiche la même chose.) C'est la seule source qui dit
**ce qui est réellement arrivé** :

- Rien dans le journal = la requête n'est pas partie, ou pas vers ce serveur.
- Un verbe inattendu (`GET`, `OPTIONS`) = le code ou le navigateur a choisi à ta place.
- `content-type : (absent)` ou `text/plain` = le navigateur a complété.
- `body brut : "[object Object]" [15 octets]` = sérialisation manquante.

## 7. Les trois familles de bugs de Debug Frontend

| Famille | Question | Outils |
|---|---|---|
| Le clic n'atteint pas le bouton | Qui reçoit vraiment l'événement ? | Elements, Computed, Event Listeners |
| Le clic arrive, le code déraille | Où l'exécution s'arrête-t-elle ? | Sources, points d'arrêt, Console |
| La requête part, mais elle ne convient pas | Qu'est-ce qui est réellement transmis ? | Network, Application, journal du serveur |

Ce qui compte n'est pas de réussir, c'est de savoir **pourquoi** ça cassait. Après chaque
défi, le débrief et le quiz sont là pour ça.

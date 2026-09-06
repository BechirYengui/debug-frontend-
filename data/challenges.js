'use strict';

/*
 * Catalogue des défis : métadonnées, texte pédagogique, indices, débrief, quiz.
 *
 * C'est le seul fichier à éditer pour ajouter un défi (voir docs/ecrire-un-defi.md),
 * avec le fragment challenges/NN.html, le code public/c/NN.* et le corrigé solutions/NN.md.
 *
 * Champs :
 *   id            identifiant à deux chiffres, aussi le nom des fichiers
 *   stars         difficulté 1 à 3
 *   minutes       durée indicative
 *   family        'dom' | 'js' | 'net'  (voir FAMILIES)
 *   tabs          onglets DevTools mobilisés (affichés sur la carte)
 *   minified      le code du défi est servi minifié sur une ligne
 *   requiresToken l'endpoint exige l'en-tête X-Api-Token
 *   title / subtitle
 *   intro         « Pourquoi ce défi » : le sens du problème, ce qu'il apprend, pourquoi ça arrive en vrai
 *   symptom       ce que le joueur observe au premier clic
 *   learn         objectifs d'apprentissage (3 à 4 puces)
 *   hints         trois niveaux : quel onglet, quelle zone, la nature du problème. Jamais la solution.
 *   debrief       { cause, reflex } : montré une fois le défi résolu (ou le corrigé révélé)
 *   quiz          { question, choices, answer, why } : vérifie que la cause est comprise
 */

const FAMILIES = {
  dom: {
    key: 'dom',
    name: "Le clic n'atteint pas le bouton",
    short: 'DOM & CSS',
    description: "Le code est correct, le gestionnaire est bien posé, mais l'événement n'arrive jamais jusqu'à lui : un élément le capte avant, un attribut le bloque, une propriété CSS le neutralise. Console vide, Network vide. La première question est toujours : qui reçoit vraiment le clic ?",
    method: "Clic droit → Inspecter directement sur le bouton, panneau Computed, panneau Event Listeners, remonter les ancêtres."
  },
  js: {
    key: 'js',
    name: 'Le clic arrive, le code déraille',
    short: 'JavaScript',
    description: "L'événement atteint bien le bouton, parfois la page réagit visuellement, mais l'exécution s'interrompt avant la requête : exception avalée, écouteur jamais posé, propagation coupée, minuterie fantaisiste. Il faut suivre le flux d'exécution pas à pas.",
    method: "Sources : Pretty print, points d'arrêt, Pause on caught exceptions, Event Listener Breakpoints, Call Stack, modifier une variable pendant une pause."
  },
  net: {
    key: 'net',
    name: "La requête part, mais elle ne convient pas",
    short: 'Réseau',
    description: "Le navigateur émet bien quelque chose, mais pas ce que le serveur attend : mauvais verbe, mauvais en-tête, corps mal sérialisé, jeton absent ou périmé, origine différente, navigation qui tue la requête. Le serveur explique presque toujours ce qui cloche : il faut lire sa réponse et comparer octet pour octet.",
    method: "Network : Preserve log, colonnes Method et Status, Headers en vue brute, Payload → view source, Response, Copy as fetch."
  }
};

const CHALLENGES = [
  {
    id: '01', stars: 1, minutes: 10, family: 'dom', tabs: ['Elements', 'Console'],
    title: 'Promotion de release',
    subtitle: 'Console de déploiement : promouvoir la version candidate en production.',
    intro: "Le bug le plus fréquent des interfaces modernes n'est pas dans le JavaScript : c'est un élément invisible qui traîne au-dessus de la page. Écrans de transition, modales fermées à l'opacité, toasts, overlays de chargement : quand on les anime au lieu de les démonter, ils continuent de recevoir les clics. Ce défi t'apprend le premier réflexe de tout diagnostic front : avant de lire une ligne de code, vérifier qui reçoit réellement le clic.",
    symptom: "Le bouton ne réagit pas du tout. Aucune erreur dans la Console, aucune requête dans Network, rien dans le journal de la page.",
    learn: [
      "Utiliser « Inspecter » sur l'élément réellement sous le curseur et lire ce que DevTools sélectionne",
      "Vérifier une hypothèse avec document.elementFromPoint(x, y)",
      "Distinguer opacity: 0 / visibility: hidden (qui laissent passer les clics ou non) de display: none et pointer-events: none",
      "Neutraliser un nœud en direct depuis l'onglet Elements"
    ],
    hints: [
      "Onglet Elements. Le document rendu contient plus de nœuds que ce que ton œil perçoit.",
      "Clic droit → Inspecter directement SUR le bouton. Compare le nœud que DevTools sélectionne avec celui que tu visais.",
      "Un élément occupe toute la fenêtre, au-dessus du reste, et capte les clics à la place du bouton."
    ],
    debrief: {
      cause: "Un <div id=\"view-transition\"> en position: fixed couvre toute la fenêtre avec un z-index élevé. Le script le passe à opacity: 0 au premier rendu : il devient invisible, mais reste dans l'arbre et continue de recevoir tous les clics. Le gestionnaire du bouton est correct, il n'est simplement jamais appelé.",
      reflex: "Bouton muet + Console vide + Network vide : commence par « Inspecter » sur le bouton, pas par le JS. opacity: 0 ne désactive jamais les événements ; display: none et pointer-events: none, si."
    },
    quiz: {
      question: "Pourquoi le clic n'arrivait-il pas au bouton ?",
      choices: [
        "Le gestionnaire de clic n'était pas attaché au bon élément",
        "Un élément invisible mais toujours présent (opacity: 0) recouvrait la page et interceptait les clics",
        "Le bouton portait l'attribut disabled",
        "Une erreur JavaScript interrompait le gestionnaire avant le fetch"
      ],
      answer: 1,
      why: "opacity: 0 rend un élément transparent, pas inerte : il participe toujours au hit-testing. Seuls display: none, visibility: hidden (pour les clics) ou pointer-events: none le retirent du chemin du pointeur."
    }
  },
  {
    id: '02', stars: 1, minutes: 8, family: 'dom', tabs: ['Elements'],
    title: 'Ouverture de vanne',
    subtitle: 'Supervision industrielle : ouvrir la vanne V-204 du circuit primaire.',
    intro: "Beaucoup d'interfaces gèrent l'état « prêt / pas prêt » d'un bouton à deux endroits à la fois : une classe CSS pour l'apparence, un attribut HTML pour le comportement. Quand les deux se désynchronisent, le bouton a l'air actif mais reste inerte. Ce défi entraîne un réflexe simple et rentable : lire la balise en entier dans l'onglet Elements, attributs compris, au lieu de faire confiance à ce que l'on voit.",
    symptom: "Le bouton semble actif (couleur, ombre, curseur) une fois les verrouillages levés, mais le clic ne produit rien : ni erreur, ni requête.",
    learn: [
      "Lire tous les attributs d'un élément (disabled, readonly, inert, hidden, aria-*) et pas seulement ses classes",
      "Comprendre qu'un bouton disabled ne reçoit aucun événement souris, quel que soit son style",
      "Distinguer aria-disabled (sémantique) de disabled (comportement)",
      "Modifier un attribut à chaud dans Elements ou avec removeAttribute"
    ],
    hints: [
      "Onglet Elements, panneau des attributs du bouton.",
      "Lis les ATTRIBUTS du <button>, pas seulement ses classes CSS. L'apparence et l'état réel peuvent diverger.",
      "Le bouton est inerte au niveau du HTML lui-même : aucun événement souris ne lui sera jamais délivré."
    ],
    debrief: {
      cause: "Le <button> est livré avec l'attribut disabled dans le HTML. Le script met à jour aria-disabled et une classe .is-ready quand les verrouillages sont levés, mais ne retire jamais disabled. Un bouton disabled ne reçoit aucun événement de clic : le gestionnaire n'est jamais invoqué.",
      reflex: "Un bouton qui « a l'air » actif ne l'est pas forcément. Le seul juge est la balise elle-même : disabled, inert ou un ancêtre inert bloquent les événements quoi que dise le CSS."
    },
    quiz: {
      question: "Quelle affirmation est vraie à propos d'un <button disabled> ?",
      choices: [
        "Il reçoit les clics mais ne peut pas soumettre un formulaire",
        "Il ne reçoit aucun événement souris, même s'il est stylé comme actif",
        "Il reçoit les clics uniquement si aria-disabled vaut « false »",
        "Il est retiré du DOM par le navigateur"
      ],
      answer: 1,
      why: "disabled est un attribut de comportement : le navigateur ne délivre pas les événements de pointeur à l'élément. aria-disabled n'a d'effet que pour les technologies d'assistance et le CSS est purement cosmétique."
    }
  },
  {
    id: '03', stars: 2, minutes: 12, family: 'dom', tabs: ['Elements', 'Console'],
    title: 'Rotation de clé API',
    subtitle: 'Console sécurité : déclencher la rotation de la clé de service.',
    intro: "Le CSS hérite, et c'est parfois un problème : une propriété posée sur un ancêtre pour gérer un état transitoire (chargement, synchronisation) peut geler tout un sous-arbre longtemps après que l'état a changé, si le code met à jour le mauvais nœud. Ce défi t'apprend à lire les valeurs calculées plutôt que les feuilles de style, et à remonter l'arbre DOM quand plusieurs contrôles meurent en même temps.",
    symptom: "Le bouton et la case à cocher voisine sont tous deux insensibles, même une fois l'inventaire annoncé « à jour ». Le curseur ne change pas au survol. Console et Network restent vides.",
    learn: [
      "Utiliser le panneau Computed et sa flèche pour remonter à la règle et à l'élément qui impose une valeur",
      "Comprendre que pointer-events est hérité et bloque toute interaction sur le sous-arbre",
      "Remonter l'arbre DOM quand plusieurs contrôles sont morts d'un coup",
      "Vérifier une valeur effective avec getComputedStyle(el).pointerEvents"
    ],
    hints: [
      "Onglet Elements → sous-panneau Computed, en sélectionnant le bouton.",
      "Remonte l'arbre DOM : un ancêtre du bouton porte un état qui n'a jamais été levé.",
      "Une propriété CSS héritée neutralise toute interaction souris sur ce sous-arbre."
    ],
    debrief: {
      cause: "Le conteneur .rotation-footer porte data-state=\"syncing\", et une règle CSS lui applique pointer-events: none dans cet état. À la fin de la synchronisation, le script met à jour le data-state de la pastille d'en-tête, pas celui du pied de carte : le conteneur reste « syncing » et tout ce qu'il contient reste insensible au pointeur.",
      reflex: "Plusieurs contrôles morts ensemble = cherche l'ancêtre commun. Le panneau Computed filtré sur pointer-events te donne la règle et le nœud responsable en un clic."
    },
    quiz: {
      question: "Pourquoi la case à cocher « prévenir les propriétaires » était-elle inerte elle aussi ?",
      choices: [
        "Elle avait son propre attribut disabled",
        "pointer-events: none posé sur leur ancêtre commun est hérité par tout le sous-arbre",
        "Le script retirait ses écouteurs pendant la synchronisation",
        "Un overlay recouvrait uniquement cette zone"
      ],
      answer: 1,
      why: "pointer-events est une propriété héritée : appliquée à un conteneur, elle vaut pour chaque descendant tant qu'aucun d'eux ne la redéfinit. C'est pour cela qu'un seul état oublié fige toute une zone."
    }
  },
  {
    id: '04', stars: 2, minutes: 12, family: 'dom', tabs: ['Elements'],
    title: "Publication d'un article",
    subtitle: 'CMS éditorial : passer le brouillon en ligne.',
    intro: "Les pseudo-éléments ::before et ::after servent partout à décorer : halos, dégradés, séparateurs. Ils sont absents du HTML source mais bien présents dans le rendu, avec une géométrie propre, et ils peuvent déborder de leur parent et se retrouver au-dessus de ce qui suit. Ce défi t'apprend à les voir dans l'arbre de l'onglet Elements et à survoler les nœuds pour découvrir la zone qu'ils occupent vraiment.",
    symptom: "Le bouton ne répond pas, mais seulement dans sa partie haute ou sur toute sa surface selon la taille de la fenêtre. Rien dans la Console ni dans Network.",
    learn: [
      "Déplier et survoler les pseudo-éléments ::before / ::after dans l'onglet Elements",
      "Comprendre qu'un pseudo-élément positionné peut déborder de son parent et capter les clics",
      "Lire l'ordre d'empilement : z-index, position, ordre dans le flux",
      "Corriger une règle CSS en direct dans le panneau Styles"
    ],
    hints: [
      "Onglet Elements. Survole les nœuds un par un et observe la zone surlignée dans la page.",
      "Le bloc visuel situé juste AU-DESSUS de la barre d'action déborde. Déplie ses nœuds générés.",
      "Un pseudo-élément décoratif est peint par-dessus le bouton et intercepte le pointeur."
    ],
    debrief: {
      cause: "La carte .editor-metrics a un ::after décoratif en position: absolute, haut de 250 px, qui commence à top: 100 % : il déborde sous la carte et recouvre la carte d'actions qui suit. Comme .editor-metrics a un z-index supérieur, le dégradé (quasi transparent) passe au-dessus du bouton et reçoit ses clics.",
      reflex: "Quand la zone morte a une forme géométrique étrange, pense « pseudo-élément ». Ils n'apparaissent pas dans le HTML source, seulement dans l'arbre rendu : survole-les pour voir leur emprise réelle."
    },
    quiz: {
      question: "Comment repérer un pseudo-élément qui recouvre un bouton ?",
      choices: [
        "En cherchant ::after dans le HTML source de la page",
        "En dépliant le nœud parent dans l'onglet Elements et en survolant ::before / ::after pour voir leur zone",
        "En lisant la Console : le navigateur signale les chevauchements",
        "En désactivant JavaScript"
      ],
      answer: 1,
      why: "Les pseudo-éléments sont générés par le CSS et n'existent pas dans le HTML. L'onglet Elements les affiche sous leur parent, et le survol dessine leur boîte réelle dans la page."
    }
  },
  {
    id: '05', stars: 2, minutes: 15, family: 'js', tabs: ['Elements', 'Sources'],
    title: "Envoi d'un lot de notifications",
    subtitle: "Plateforme d'envoi : expédier la campagne préparée.",
    intro: "L'ordre de chargement des scripts est une source classique de bugs silencieux : un script exécuté trop tôt cherche des éléments qui n'existent pas encore, et si la fonction d'abonnement tolère l'absence sans rien dire, aucun écouteur n'est jamais posé. Ce défi te fait observer la différence entre un script dans le <head>, un script defer et le moment où le DOM est réellement disponible.",
    symptom: "Le bouton se laisse cliquer (curseur, focus) mais rien ne se passe. Le panneau Event Listeners du bouton est vide.",
    learn: [
      "Lire le panneau Event Listeners pour savoir si un gestionnaire est réellement attaché",
      "Comprendre l'ordre d'exécution des scripts : <head> sans defer, defer, DOMContentLoaded",
      "Repérer une fonction qui échoue silencieusement (retourne false au lieu de lever)",
      "Rejouer l'abonnement depuis la Console une fois le DOM prêt"
    ],
    hints: [
      "Onglet Elements → panneau Event Listeners, bouton sélectionné. Puis onglet Sources.",
      "Compare l'ordre d'exécution des scripts avec la position du bouton dans le document.",
      "Au moment où l'abonnement au clic est tenté, la cible n'existe pas encore, et l'échec est avalé sans bruit."
    ],
    debrief: {
      cause: "Le fichier 05-bindings.js est chargé dans le <head> sans defer : il s'exécute avant que le <button id=\"dispatch-batch\"> soit analysé. Son helper on(selector, ...) fait un querySelector, ne trouve rien et retourne false sans erreur. Aucun écouteur n'est posé ; le script principal (defer) ne s'occupe que de l'affichage.",
      reflex: "Event Listeners vide sur un élément qui devrait en avoir = l'abonnement n'a jamais eu lieu. Regarde alors QUAND le script s'exécute par rapport au DOM, et méfie-toi des helpers qui tolèrent l'absence d'élément."
    },
    quiz: {
      question: "Pourquoi l'écouteur de clic n'était-il jamais attaché ?",
      choices: [
        "Le script d'abonnement s'exécutait dans le <head> avant que le bouton existe, et l'échec était silencieux",
        "addEventListener était appelé avec le mauvais type d'événement",
        "Le bouton était remplacé par un clone après l'abonnement",
        "Le script était chargé deux fois et le second retirait l'écouteur"
      ],
      answer: 0,
      why: "Un script sans defer ni module dans le <head> s'exécute immédiatement, avant l'analyse du <body>. querySelector renvoie null, et le helper retourne false sans lever d'erreur : rien n'apparaît dans la Console."
    }
  },
  {
    id: '06', stars: 2, minutes: 15, family: 'net', tabs: ['Network', 'Elements'],
    title: 'Réservation de salle',
    subtitle: 'Intranet : confirmer la réservation du créneau sélectionné.',
    intro: "Un <button> à l'intérieur d'un <form> est de type submit par défaut. Si le gestionnaire de clic lance un traitement asynchrone sans empêcher la soumission, le navigateur navigue, le document est détruit et la requête en cours meurt avec lui. C'est un bug très courant, et il est invisible si l'onglet Network se vide à chaque navigation. Ce défi t'apprend à activer Preserve log et à lire la barre d'adresse comme un indice.",
    symptom: "La page « clignote » au clic, l'URL se remplit de paramètres, le journal se vide. Aucune requête solve n'apparaît, ou elle apparaît un instant et disparaît.",
    learn: [
      "Activer Preserve log dans Network pour survivre à une navigation",
      "Reconnaître une soumission de formulaire implicite (GET avec query string dans l'URL)",
      "Comprendre type=\"submit\" par défaut et event.preventDefault()",
      "Différencier « la requête n'est pas partie » de « la requête a été annulée par une navigation »"
    ],
    hints: [
      "Onglet Network, coche « Preserve log » avant de cliquer.",
      "Regarde la barre d'adresse et la toute première entrée du Network juste après le clic.",
      "Le clic déclenche une navigation qui détruit le contexte avant que la requête ne parte."
    ],
    debrief: {
      cause: "Le bouton est dans un <form> et n'a pas type=\"button\" : c'est un submit. Le gestionnaire de clic attend 120 ms (collecte de contexte) avant d'appeler fetch, mais la soumission du formulaire a déjà déclenché une navigation GET vers la même page. Le document est déchargé et la promesse ne se termine jamais.",
      reflex: "Page qui clignote + URL qui change = navigation. Coche Preserve log AVANT de cliquer, sinon la preuve disparaît. Un bouton dans un form doit être type=\"button\" ou le handler doit appeler preventDefault()."
    },
    quiz: {
      question: "Pourquoi la requête fetch n'aboutissait-elle jamais ?",
      choices: [
        "Le serveur rejetait la requête à cause d'un en-tête manquant",
        "Le formulaire se soumettait (navigation GET) et déchargeait la page avant que le fetch parte",
        "fetch n'était jamais appelé à cause d'une exception",
        "La requête partait en double et la seconde annulait la première"
      ],
      answer: 1,
      why: "Un <button> dans un <form> soumet par défaut. La navigation qui en résulte détruit le document et toutes ses requêtes en cours. Preserve log permet de voir la requête de navigation puis, éventuellement, la requête annulée."
    }
  },
  {
    id: '07', stars: 3, minutes: 20, family: 'js', tabs: ['Elements', 'Sources', 'Console'], minified: true,
    title: "Expédition d'une commande",
    subtitle: 'WMS logistique : libérer la commande vers le transporteur.',
    intro: "La délégation d'événements (un seul écouteur sur document qui route les clics selon un attribut data-*) est un motif très répandu. Il repose sur la propagation : si un ancêtre intermédiaire appelle stopPropagation() pour ses propres besoins (fermer un popover, par exemple), tout ce qui est délégué plus haut cesse de fonctionner. Ce défi t'apprend à lire les écouteurs des ancêtres, pas seulement ceux de la cible, et à chercher qui coupe la remontée.",
    symptom: "Le bouton ne fait rien, mais aussi la sélection de commande dans le tableau et l'infobulle « ? ». Les <select> et l'<input> fonctionnent. Console et Network vides.",
    learn: [
      "Lire le panneau Event Listeners avec la case Ancestors pour voir la chaîne complète",
      "Comprendre bubbling, délégation et l'effet de stopPropagation()",
      "Repérer que plusieurs comportements délégués meurent ensemble",
      "Neutraliser un écouteur à chaud (getEventListeners, monkey-patch) pour tester une hypothèse"
    ],
    hints: [
      "Onglet Elements → Event Listeners, sur le bouton PUIS sur chacun de ses ancêtres.",
      "Le gestionnaire utile n'est pas sur le bouton : il écoute beaucoup plus haut. Quelque chose se trouve entre les deux.",
      "Un ancêtre interrompt la remontée de l'événement avant qu'il n'atteigne l'écouteur qui compte."
    ],
    debrief: {
      cause: "Tout est délégué à un écouteur posé sur document qui lit data-cmd. Mais la carte #order-panel, ancêtre du bouton, a son propre écouteur click qui appelle e.stopPropagation() pour gérer la fermeture des popovers. L'événement naît sur le bouton, remonte jusqu'à la carte et y meurt : document ne le voit jamais.",
      reflex: "Quand tout ce qui est délégué dans une zone meurt alors que les contrôles natifs répondent, cherche un stopPropagation() sur un ancêtre. Event Listeners + Ancestors montre toute la chaîne."
    },
    quiz: {
      question: "Quel mécanisme le stopPropagation() de la carte cassait-il ?",
      choices: [
        "La phase de capture, qui empêche le bouton de recevoir l'événement",
        "La délégation d'événements : l'écouteur sur document ne recevait plus le clic remontant",
        "Le comportement par défaut du bouton (soumission)",
        "L'exécution du fetch, interrompue par une exception"
      ],
      answer: 1,
      why: "stopPropagation() arrête le bubbling vers les ancêtres. Un écouteur délégué sur document dépend justement de cette remontée : il ne reçoit plus rien de ce qui se passe sous la carte."
    }
  },
  {
    id: '08', stars: 3, minutes: 20, family: 'js', tabs: ['Sources', 'Console'], minified: true,
    title: "Clôture d'un ticket",
    subtitle: "Support N2 : clore l'incident et notifier le client.",
    intro: "Un try/catch vide est l'une des pires choses qu'on puisse trouver dans un code de production : il transforme une erreur nette en un silence total. Le bouton réagit, le libellé clignote, et rien ne part. Ce défi t'apprend l'option la plus sous-utilisée des DevTools, Pause on caught exceptions, ainsi que le pas-à-pas dans du code minifié après Pretty print.",
    symptom: "Le bouton passe un instant en « envoi... » puis revient à la normale. Aucune requête, aucune erreur visible. Le journal de la page ne mentionne même pas de tentative.",
    learn: [
      "Activer Pause on uncaught ET Pause on caught exceptions",
      "Pretty-printer un fichier minifié avant de poser des points d'arrêt",
      "Utiliser les Event Listener Breakpoints (Mouse → click) pour s'arrêter sans connaître le code",
      "Corriger une donnée dans une closure depuis la Console pendant une pause, ou via un point d'arrêt conditionnel"
    ],
    hints: [
      "Onglet Sources → coche « Pause on caught exceptions » en plus de « uncaught ».",
      "Event Listener Breakpoints → Mouse → click, puis avance en pas à pas dans le handler.",
      "Une erreur est levée avant l'envoi et interceptée par un bloc qui n'en fait rien : le flux s'arrête sans laisser de trace."
    ],
    debrief: {
      cause: "Le handler construit le payload dans un try dont le catch est vide. payload() lit ss.profile.handle, mais ss.profile n'est défini que si la session a le rôle « supervisor », ce qui n'est pas le cas : TypeError, avalée par le catch. tx(), qui contient un fetch correct, n'est jamais atteint. busy(true) puis busy(false) font croire qu'il se passe quelque chose.",
      reflex: "Un handler qui réagit visuellement mais n'envoie rien s'arrête au milieu. Pause on caught exceptions révèle tout ce qu'un catch {} cache. Sur du code minifié, Pretty print d'abord."
    },
    quiz: {
      question: "Pourquoi la Console restait-elle vide malgré l'exception ?",
      choices: [
        "Les exceptions dans les gestionnaires d'événements ne sont jamais affichées",
        "L'exception était interceptée par un catch vide : rien n'était journalisé ni relancé",
        "Le niveau de log de la Console était réglé sur « Errors » uniquement",
        "L'exception survenait dans un Web Worker"
      ],
      answer: 1,
      why: "Une exception attrapée n'atteint jamais la Console : c'est au code du catch de la signaler. Un catch vide la fait disparaître. Seule l'option Pause on caught exceptions du débogueur permet de la voir."
    }
  },
  {
    id: '09', stars: 2, minutes: 12, family: 'net', tabs: ['Network', 'Sources'],
    title: 'Mise à jour de firmware',
    subtitle: 'Flotte IoT : pousser le firmware sur le groupe pilote.',
    intro: "Les petites couches d'abstraction autour de fetch (api.request, http.post…) ont des valeurs par défaut, et ces défauts finissent toujours par mordre : ici, une méthode HTTP implicite. Ce défi t'apprend à ne jamais présumer de ce que le code envoie et à lire la colonne Method et la section General de la requête réelle dans Network, puis à remonter dans le wrapper pour comprendre d'où vient le défaut.",
    symptom: "Une requête part, le serveur répond 405 avec un message précis. Le journal de la page affiche la réponse d'erreur.",
    learn: [
      "Afficher et lire la colonne Method dans Network",
      "Lire la section General / Request Method d'une requête",
      "Remonter d'un symptôme réseau à la ligne de code d'un wrapper HTTP",
      "Corriger l'appel à la volée avec un point d'arrêt ou rejouer avec Copy as fetch"
    ],
    hints: [
      "Onglet Network, colonne Method de la ligne qui apparaît au clic.",
      "Ouvre la requête → Headers → « Request Method », et compare avec l'encart Objectif.",
      "La requête sort avec un verbe HTTP que l'endpoint refuse."
    ],
    debrief: {
      cause: "api.request(url, opts) utilise GET par défaut et l'appel push() ne passe pas method: 'POST'. Comme la méthode est GET, le wrapper n'attache ni Content-Type ni corps. Le serveur reçoit GET /api/challenge/09/solve et répond 405.",
      reflex: "Regarde toujours la colonne Method. Les wrappers HTTP ont des défauts implicites ; la requête réelle dans Network est la seule vérité."
    },
    quiz: {
      question: "Que révélait la colonne Method de la requête envoyée ?",
      choices: [
        "POST, mais vers la mauvaise URL",
        "GET, parce que le wrapper HTTP utilisait GET par défaut et que l'appel ne précisait pas la méthode",
        "OPTIONS, à cause d'une requête preflight CORS",
        "PUT, à cause d'une confusion entre création et mise à jour"
      ],
      answer: 1,
      why: "Le wrapper lisait opts.method || 'GET'. L'appel ne fournissait pas method, donc la requête partait en GET sans corps, ce que l'endpoint refuse avec 405."
    }
  },
  {
    id: '10', stars: 3, minutes: 18, family: 'net', tabs: ['Network'], minified: true,
    title: 'Virement interne',
    subtitle: 'Back-office bancaire : exécuter le virement entre deux comptes internes.',
    intro: "Le navigateur complète tes requêtes : s'il manque un Content-Type et que le corps est une chaîne, il ajoute text/plain;charset=UTF-8 de lui-même. Le JSON est parfait, le verbe est bon, et pourtant le serveur refuse. Ce défi t'apprend à lire les en-têtes réellement envoyés (vue brute), à distinguer ceux que le code a fournis de ceux que le navigateur a ajoutés, et à ne pas confondre « le corps est du JSON » avec « le corps est déclaré comme du JSON ».",
    symptom: "La requête part en POST avec un corps JSON correct, mais le serveur répond 415.",
    learn: [
      "Lire Request Headers en vue brute et repérer les en-têtes ajoutés par le navigateur",
      "Comprendre le rôle de Content-Type et la valeur par défaut text/plain de fetch avec un corps chaîne",
      "Retrouver dans du code minifié l'objet d'en-têtes partagé et sa lacune",
      "Rejouer avec Copy as fetch en ne changeant qu'une chose"
    ],
    hints: [
      "Onglet Network → la requête → Headers → section « Request Headers ».",
      "Le navigateur complète lui-même certains en-têtes quand le code ne les fournit pas. Trouve lequel il a choisi à ta place.",
      "Le corps envoyé est correct, mais l'en-tête qui décrit son type ne l'est pas."
    ],
    debrief: {
      cause: "L'objet d'en-têtes partagé E.hdr contient Accept, X-Client et X-Request-Id, mais pas Content-Type. fetch reçoit une chaîne en corps et applique son défaut : text/plain;charset=UTF-8. Le serveur, qui n'accepte que application/json, répond 415 en citant le type reçu.",
      reflex: "« Le corps est du JSON » ne suffit pas : il faut le déclarer. Compare les Request Headers avec le code ; tout en-tête présent dans Network mais absent du code a été ajouté par le navigateur."
    },
    quiz: {
      question: "Que fait fetch quand on lui passe une chaîne en body sans en-tête Content-Type ?",
      choices: [
        "Il refuse d'envoyer la requête et lève une erreur",
        "Il devine application/json si la chaîne commence par « { »",
        "Il envoie Content-Type: text/plain;charset=UTF-8 par défaut",
        "Il n'envoie aucun Content-Type"
      ],
      answer: 2,
      why: "La spécification Fetch attribue text/plain;charset=UTF-8 à un corps de type chaîne quand aucun Content-Type n'est fourni. Le serveur voit donc du texte, pas du JSON."
    }
  },
  {
    id: '11', stars: 3, minutes: 18, family: 'net', tabs: ['Network', 'Sources'], minified: true,
    title: "Import d'un fichier CSV",
    subtitle: "Outil data : lancer l'import du lot de contacts.",
    intro: "Oublier JSON.stringify est une erreur d'une ligne aux conséquences déroutantes : fetch convertit l'objet en chaîne avec toString(), et le serveur reçoit littéralement « [object Object] ». Ce défi t'apprend à regarder les octets réellement transmis (Payload → view source) plutôt que la vue embellie, et à comparer ce que le code manipule avec ce qui part sur le fil.",
    symptom: "La requête part en POST avec le bon Content-Type, mais le serveur répond 400 : le corps est illisible en JSON.",
    learn: [
      "Lire Payload → view source pour voir les octets bruts",
      "Comprendre la sérialisation implicite d'un objet passé à body (toString)",
      "Poser un point d'arrêt juste avant fetch pour inspecter l'argument réel",
      "Utiliser le journal du serveur (taille en octets, début du corps) comme miroir"
    ],
    hints: [
      "Onglet Network → la requête → onglet Payload (ou Request).",
      "Compare octet pour octet ce qui est réellement transmis avec l'objet manipulé dans le code (Sources, pretty-print, point d'arrêt).",
      "Ce qui part sur le réseau est la représentation texte par défaut d'un objet JavaScript, pas du JSON."
    ],
    debrief: {
      cause: "tx() passe directement l'objet construit par bld() dans body au lieu de JSON.stringify(p). fetch le convertit en chaîne via toString() : « [object Object] », 15 octets. Le Content-Type annonce du JSON, le serveur tente JSON.parse et échoue.",
      reflex: "Payload → view source montre les vrais octets. Un corps de 15 octets pour un objet qui devrait en faire des centaines est un signal immédiat. Le journal du serveur affiche la même chose."
    },
    quiz: {
      question: "Pourquoi le serveur recevait-il « [object Object] » ?",
      choices: [
        "Le Content-Type était text/plain, donc le navigateur a converti le JSON",
        "L'objet était passé tel quel à body ; fetch l'a converti en chaîne avec toString()",
        "Le serveur ne supportait pas les objets imbriqués",
        "Le CSV contenait un caractère invalide"
      ],
      answer: 1,
      why: "body accepte des chaînes, FormData, Blob, etc. Un objet ordinaire n'est pas dans la liste : il est converti en chaîne, ce qui donne « [object Object] ». JSON.stringify est indispensable."
    }
  },
  {
    id: '12', stars: 3, minutes: 20, family: 'net', tabs: ['Network', 'Sources', 'Console'], minified: true, requiresToken: true,
    title: 'Ouverture du coffre-fort',
    subtitle: 'Gestionnaire de secrets : déverrouiller le coffre applicatif.',
    intro: "En production, la doc d'un endpoint est souvent incomplète et c'est la réponse 401 qui t'apprend ce qu'il exige. Le secret nécessaire est presque toujours déjà quelque part dans la page : une réponse reçue au chargement, une variable dans une closure, un stockage local. Ce défi t'apprend à regarder toutes les requêtes de la page et pas seulement celle qui échoue, et à rejouer une requête en y ajoutant une seule chose.",
    symptom: "La requête est impeccable (POST, JSON, corps valide) mais le serveur répond 401 en nommant un en-tête manquant que l'encart Objectif ne mentionne pas.",
    learn: [
      "Lire une réponse 401/403 comme « il manque un secret », pas « il manque un format »",
      "Explorer toutes les requêtes de la page, y compris celles émises au chargement",
      "Extraire une valeur d'une réponse réseau ou d'une closure via un point d'arrêt",
      "Rejouer avec Copy as fetch + un en-tête, ou envelopper window.fetch pour corriger la page"
    ],
    hints: [
      "Onglet Network : regarde TOUTES les requêtes de la page, pas seulement celle du bouton.",
      "Une réponse reçue au chargement de la page contient une valeur que la requête d'envoi ne réutilise jamais.",
      "L'endpoint exige un en-tête d'authentification que le code ne joint pas à sa requête."
    ],
    debrief: {
      cause: "Au chargement, la page appelle GET /api/session et reçoit un jeton qu'elle stocke dans une closure et affiche masqué. La requête d'ouverture ne l'envoie jamais : il manque l'en-tête X-Api-Token exigé par l'endpoint, d'où le 401. Le jeton complet est lisible dans la réponse de /api/session, ou dans la variable K.t sur un point d'arrêt.",
      reflex: "401/403 sur une requête par ailleurs correcte = un secret manque. Le contexte d'authentification est posé au chargement : ne filtre pas Network sur la seule requête qui échoue."
    },
    quiz: {
      question: "Où pouvait-on trouver la valeur du jeton exigé ?",
      choices: [
        "Dans le code source HTML de la page, en clair",
        "Dans la réponse de la requête GET /api/session émise au chargement (ou dans une variable sur un point d'arrêt)",
        "Dans la réponse 401 du serveur",
        "Nulle part : il fallait le deviner"
      ],
      answer: 1,
      why: "La page négocie sa session au chargement : la réponse complète est dans Network. L'affichage masqué (ops_....xxxx) ne montre que les extrémités, mais la réponse brute contient le jeton entier."
    }
  },

  /* ------------------------------------------------------------------ */
  /* Nouveaux défis                                                     */
  /* ------------------------------------------------------------------ */

  {
    id: '13', stars: 1, minutes: 8, family: 'js', tabs: ['Console', 'Elements'],
    title: "Blocage d'un compte marchand",
    subtitle: 'Console anti-fraude : suspendre un compte marchand suspect.',
    intro: "Avant toute technique avancée, il y a une compétence que beaucoup négligent : lire une erreur. Une stack trace dit quel fichier, quelle ligne, quelle valeur était null, et le lien est cliquable. Ce défi t'apprend à exploiter la Console comme première source d'information : lire le message, suivre le lien vers Sources, comprendre ce que le code cherchait et pourquoi il ne l'a pas trouvé.",
    symptom: "Au clic, une erreur rouge apparaît dans la Console. Aucune requête ne part.",
    learn: [
      "Lire un message d'erreur et sa stack trace, cliquer le lien vers la source",
      "Interpréter « Cannot read properties of null » : quel appel a renvoyé null et pourquoi",
      "Comparer l'identifiant cherché par le code avec celui présent dans le DOM",
      "Corriger le DOM à chaud dans Elements et retester"
    ],
    hints: [
      "Onglet Console : lis l'erreur rouge en entier, puis clique sur le lien fichier:ligne à droite.",
      "Sur la ligne pointée, une fonction renvoie null. Regarde quel identifiant elle cherche, puis cherche-le dans l'onglet Elements.",
      "L'identifiant écrit dans le HTML ne correspond pas à celui que le code demande : une lettre diffère."
    ],
    debrief: {
      cause: "Le gestionnaire lit le champ « seuil » avec document.getElementById('threshold'), mais le HTML déclare id=\"treshold\" (sans h). getElementById renvoie null, l'accès à .value lève TypeError avant le fetch. La Console affiche l'erreur avec la ligne exacte.",
      reflex: "Une erreur rouge est un cadeau : lis-la jusqu'au bout, clique le lien, regarde la valeur incriminée. « null (reading 'value') » signifie presque toujours qu'un sélecteur n'a rien trouvé."
    },
    quiz: {
      question: "Que signifie « Cannot read properties of null (reading 'value') » ?",
      choices: [
        "Le champ existe mais sa valeur est vide",
        "L'expression avant .value vaut null : le sélecteur n'a trouvé aucun élément",
        "La propriété value est privée",
        "Le navigateur bloque l'accès au formulaire"
      ],
      answer: 1,
      why: "Le message décrit l'objet sur lequel on lit la propriété : il vaut null. Avec getElementById, cela signifie qu'aucun élément ne porte cet identifiant."
    }
  },
  {
    id: '14', stars: 2, minutes: 15, family: 'js', tabs: ['Sources', 'Console'],
    title: "Mise en pause d'une campagne publicitaire",
    subtitle: 'Régie publicitaire : mettre en pause la campagne qui dépasse son budget.',
    intro: "Les erreurs d'unité (secondes contre millisecondes, centimes contre euros) sont parmi les plus fréquentes et les plus difficiles à voir : le code est syntaxiquement parfait, il fait juste quelque chose d'absurde. Ici, une confirmation censée être quasi immédiate est programmée un quart d'heure plus tard. Ce défi t'apprend à suivre un flux différé (setTimeout) avec le débogueur et à modifier une variable locale pendant une pause pour tester une hypothèse.",
    symptom: "Le bouton passe en « mise en pause programmée... » et reste ainsi. Aucune requête, aucune erreur. Si tu attends assez longtemps, ça finit par partir.",
    learn: [
      "Poser un point d'arrêt dans un gestionnaire et lire les arguments d'un setTimeout",
      "Modifier une variable locale dans la Console pendant une pause, puis reprendre",
      "Utiliser un point d'arrêt conditionnel pour corriger à la volée sans s'arrêter",
      "Reconnaître une erreur d'unité (s / ms) dans un calcul de délai"
    ],
    hints: [
      "Onglet Sources : pose un point d'arrêt dans le gestionnaire de clic (ou Event Listener Breakpoints → Mouse → click).",
      "Avance pas à pas jusqu'à l'appel qui programme l'envoi. Regarde la valeur numérique passée en second argument.",
      "Le délai est calculé dans la mauvaise unité : ce qui devrait être des millisecondes est multiplié comme si c'était des secondes."
    ],
    debrief: {
      cause: "La configuration déclare confirmDelay: 900 avec unit: 's'. La fonction delay() multiplie par 1000 quand l'unité est « s » : setTimeout(send, 900000), soit 15 minutes. L'interface affiche « programmée » et attend. Rien n'est cassé, tout est juste absurdement lent.",
      reflex: "Quand rien ne part et que rien ne casse, cherche un différé. Sur une pause dans le handler, la Console évalue dans le scope courant : tu peux lire et corriger la valeur avant de reprendre."
    },
    quiz: {
      question: "Quelle technique permet de corriger le délai sans modifier le fichier ?",
      choices: [
        "Recharger la page avec le cache désactivé",
        "S'arrêter sur un point d'arrêt avant setTimeout et réaffecter la variable de délai dans la Console (ou via un point d'arrêt conditionnel)",
        "Désactiver JavaScript puis le réactiver",
        "Changer la colonne Time dans Network"
      ],
      answer: 1,
      why: "Pendant une pause, la Console s'exécute dans le scope de la fonction arrêtée : modifier une variable locale change la suite de l'exécution. Un point d'arrêt conditionnel du type (ms = 10) && false fait la même chose sans jamais s'arrêter."
    }
  },
  {
    id: '15', stars: 2, minutes: 18, family: 'net', tabs: ['Network', 'Console'],
    title: "Signature d'un bon de commande",
    subtitle: 'Achats : signer électroniquement le bon de commande fournisseur.',
    intro: "CORS est le sujet réseau que le plus de développeurs front subissent sans le comprendre. Une origine, c'est schéma + hôte + port : localhost:3000 et 127.0.0.1:3000 sont deux origines différentes, tout comme deux ports du même hôte. Pour un POST en JSON vers une autre origine, le navigateur envoie d'abord tout seul une requête OPTIONS (preflight) que tu n'as jamais écrite. Ce défi te fait voir cette requête fantôme dans le journal du serveur et t'apprend à lire un message CORS au lieu de le craindre.",
    symptom: "Erreur rouge « blocked by CORS policy » dans la Console. Dans Network, la requête est marquée « CORS error » et le journal du serveur reçoit un OPTIONS que tu n'as pas envoyé.",
    learn: [
      "Définir une origine (schéma + hôte + port) et reconnaître une requête cross-origin",
      "Comprendre la requête preflight OPTIONS et pourquoi le navigateur l'émet",
      "Lire un message d'erreur CORS et le journal du serveur comme miroir",
      "Identifier dans le code d'où vient l'URL absolue fautive et rejouer en relatif"
    ],
    hints: [
      "Onglet Console d'abord : lis le message CORS jusqu'au bout, il nomme l'origine de la page et l'URL visée. Puis onglet Network.",
      "Compare l'hôte et le port de l'URL appelée avec ceux de la barre d'adresse. Regarde aussi ce que le journal du serveur a reçu (verbe).",
      "Le code construit une URL absolue vers une autre origine (un autre port). Le navigateur envoie un preflight OPTIONS, le serveur ne l'autorise pas, et le POST n'est jamais émis."
    ],
    debrief: {
      cause: "Le code choisit une « passerelle de secours » sur le port suivant : http://<hôte>:<port+1>/api/... . C'est une autre origine. Pour un POST application/json, le navigateur envoie d'abord OPTIONS (preflight). Le serveur répond 405 sans en-têtes Access-Control-Allow-*, donc le navigateur bloque et ne fait jamais partir le POST. Le journal du serveur montre bien l'OPTIONS arrivé.",
      reflex: "« blocked by CORS policy » : compare les deux origines citées dans le message. Un OPTIONS que tu n'as pas écrit dans le journal du serveur = preflight. La correction côté client est presque toujours d'appeler la même origine (URL relative)."
    },
    quiz: {
      question: "Pourquoi le serveur a-t-il reçu une requête OPTIONS ?",
      choices: [
        "Le code appelait explicitement fetch avec method: 'OPTIONS'",
        "Le navigateur envoie un preflight OPTIONS avant un POST JSON vers une origine différente",
        "Express convertit les POST invalides en OPTIONS",
        "C'est une requête de keep-alive du navigateur"
      ],
      answer: 1,
      why: "Une requête cross-origin « non simple » (POST avec Content-Type application/json) déclenche un preflight OPTIONS. Si la réponse ne contient pas les en-têtes CORS attendus, le navigateur n'émet jamais la vraie requête."
    }
  },
  {
    id: '16', stars: 2, minutes: 15, family: 'net', tabs: ['Application', 'Network'], requiresToken: true,
    title: "Publication d'une grille tarifaire",
    subtitle: 'Pricing : publier la nouvelle grille tarifaire.',
    intro: "Mettre un jeton en cache dans localStorage est une optimisation courante, et une source classique de bugs fantômes : le cache survit aux redéploiements, aux nouvelles sessions, aux changements de serveur. L'application préfère alors un jeton périmé à un jeton frais, et le serveur répond 403 sur une requête qui a pourtant tout ce qu'il faut. Ce défi t'apprend à ouvrir l'onglet Application, à inspecter et modifier le stockage local, et à raisonner sur l'ordre de priorité entre cache et source de vérité.",
    symptom: "La requête part avec un en-tête X-Api-Token, mais le serveur répond 403 : le jeton est présent mais ne correspond pas à la session en cours.",
    learn: [
      "Inspecter localStorage / sessionStorage dans l'onglet Application",
      "Distinguer 401 (secret absent) et 403 (secret présent mais refusé)",
      "Retrouver dans le code la logique « cache d'abord » et comprendre pourquoi elle n'expire jamais",
      "Supprimer ou périmer une entrée de stockage pour forcer le code à redemander une session fraîche"
    ],
    hints: [
      "Onglet Network : lis la réponse 403 en entier. Puis onglet Application → Local Storage.",
      "Une entrée du stockage local contient un jeton et une date d'émission. Compare cette date à aujourd'hui, et compare la fin du jeton à celui que le serveur délivre sur /api/session.",
      "Le code préfère le jeton mis en cache, dont l'expiration est loin dans le futur, et ne redemande jamais une session fraîche."
    ],
    debrief: {
      cause: "Au chargement, un bloc « SSO handoff » embarqué dans la page est copié dans localStorage sous la clé pricing.session s'il n'y est pas déjà. Ce bloc contient un jeton d'une session passée, avec une expiration en 2027. getToken() lit le cache d'abord, le trouve « valide », et n'appelle jamais /api/session. Le serveur compare au jeton de la session en cours : 403.",
      reflex: "403 avec un jeton présent = mauvaise valeur, pas format. Ouvre Application → Local Storage : un cache de session est le premier suspect. Supprimer l'entrée (puis cliquer, sans recharger : le rechargement la réinjecte) ou périmer sa date d'expiration force le code à repasser par la source de vérité."
    },
    quiz: {
      question: "Quelle différence entre le 401 du défi 12 et le 403 de celui-ci ?",
      choices: [
        "Aucune, ce sont des synonymes",
        "401 : l'en-tête d'authentification est absent ; 403 : il est présent mais sa valeur est refusée",
        "401 concerne les GET, 403 concerne les POST",
        "403 signifie que le serveur est en maintenance"
      ],
      answer: 1,
      why: "Le serveur du dojo répond 401 quand X-Api-Token manque et 403 quand il est là mais ne correspond pas à la session. La distinction oriente immédiatement le diagnostic : format vs valeur."
    }
  },
  {
    id: '17', stars: 3, minutes: 25, family: 'net', tabs: ['Network', 'Console', 'Sources'], minified: true,
    title: 'Export des écritures comptables',
    subtitle: 'Comptabilité : transmettre les écritures du mois au cabinet.',
    intro: "Les scripts tiers (analytics, consentement, « garde-fous » de sécurité) adorent envelopper window.fetch. Quand l'un d'eux décide de retenir une requête et de répondre à sa place, l'application croit avoir réussi alors que le serveur n'a rien vu. Le piège est double : la Console est vide au niveau par défaut, et rejouer la requête depuis la Console passe par le même fetch remplacé. Ce défi t'apprend à recouper trois miroirs (journal de la page, panneau Network, journal du serveur), à vérifier l'identité d'une fonction native, à utiliser le niveau Verbose, et à bloquer un script au chargement depuis DevTools.",
    symptom: "Le journal de la page annonce une réponse 202 « mise en quarantaine ». Pourtant Network ne montre aucune requête solve et le panneau « Journal du serveur » reste vide.",
    learn: [
      "Recouper journal applicatif, Network et journal du serveur : quand ils divergent, quelque chose répond à la place du serveur",
      "Vérifier qu'une fonction est native (fetch.toString(), [native code]) et repérer un monkey-patch",
      "Afficher le niveau Verbose de la Console",
      "Bloquer une URL de script (Network → Block request URL) ou restaurer la fonction native pendant une pause"
    ],
    hints: [
      "Compare les trois miroirs : le journal de la page dit 202, mais Network et le panneau « Journal du serveur » ne voient rien. Quelque chose répond à la place du serveur, dans la page.",
      "Console : tape simplement fetch et lis ce qui s'affiche. Passe aussi le niveau de log sur « Verbose » et reclique.",
      "Un script tiers chargé dans le <head> a remplacé window.fetch et met en quarantaine les POST vers l'API sans les envoyer. Rejouer depuis la Console passe par ce même fetch."
    ],
    debrief: {
      cause: "17-guard.js, chargé avant le code de la page, remplace window.fetch par une enveloppe : tout POST vers /api/ hors liste blanche est « mis en quarantaine », c'est-à-dire jamais envoyé, et l'enveloppe renvoie une fausse Response 202. La page affiche cette réponse comme si elle venait du serveur. Un console.debug (niveau Verbose, masqué par défaut) trahit l'opération.",
      reflex: "Quand le journal de l'app et Network se contredisent, c'est la page qui ment. Tape fetch dans la Console : une fonction native affiche [native code]. Bloquer l'URL du script tiers dans Network puis recharger est le moyen le plus propre de tester l'hypothèse."
    },
    quiz: {
      question: "Pourquoi rejouer la requête depuis la Console ne fonctionnait-il pas dans cette page ?",
      choices: [
        "La Console n'a pas le droit d'appeler l'API",
        "window.fetch de la page était remplacé par l'enveloppe du script tiers ; la Console utilise ce même fetch",
        "Le serveur bloquait les requêtes sans en-tête Referer",
        "Le jeton de session avait expiré"
      ],
      answer: 1,
      why: "La Console s'exécute dans le contexte de la page : elle voit le même window.fetch, donc la même enveloppe. Il faut soit passer par une fonction native (iframe, XMLHttpRequest), soit empêcher le script tiers de se charger."
    }
  },
  {
    id: '18', stars: 3, minutes: 25, family: 'js', tabs: ['Elements', 'Sources', 'Console'], minified: true,
    title: "Réarmement d'une alarme",
    subtitle: "Supervision datacenter : réarmer l'alarme température après intervention.",
    intro: "Les options d'addEventListener (once, passive, capture, signal) changent le comportement d'un écouteur de façon invisible dans le HTML. Un écouteur once disparaît après sa première exécution, quelle qu'en soit l'origine : si un auto-test dispatch un événement synthétique au démarrage, l'écouteur est consommé avant le premier clic humain. Ce défi t'apprend à distinguer événement de confiance et événement synthétique (isTrusted), à lire les options d'un écouteur, et à atteindre une closure depuis le débogueur pour réparer un état sans toucher au fichier.",
    symptom: "Le bouton ne réagit pas. Le journal de la page mentionne pourtant un « auto-test du bouton OK » au chargement. Le panneau Event Listeners du bouton ne liste aucun click.",
    learn: [
      "Lire les options d'un écouteur (once, passive, capture) et comprendre once",
      "Différencier un événement de confiance (isTrusted) d'un événement synthétique (dispatchEvent)",
      "Interrompre le démarrage avec un point d'arrêt et neutraliser un appel avant qu'il ait lieu",
      "Réattacher un écouteur depuis la Console en accédant à une closure pendant une pause"
    ],
    hints: [
      "Onglet Elements → Event Listeners sur le bouton : il n'y a aucun click. Pourtant le code en enregistre un. Il a donc été retiré.",
      "Onglet Sources, pretty print : regarde les OPTIONS passées à addEventListener, et ce que fait le journal « auto-test » au chargement.",
      "Un événement synthétique déclenché au démarrage a consommé l'écouteur à usage unique avant ton premier clic."
    ],
    debrief: {
      cause: "L'écouteur est posé avec { once: true } (« pour éviter le double réarmement »). Au démarrage, un auto-test appelle E.go.dispatchEvent(new MouseEvent('click')) ; le handler voit isTrusted === false, journalise « auto-test OK » et sort, mais once a déjà retiré l'écouteur. Le clic humain n'a plus personne pour l'entendre.",
      reflex: "Event Listeners vide + un écouteur bel et bien dans le code = il a été retiré. once et AbortSignal sont les suspects. Sur une pause dans la closure, la Console peut réattacher l'écouteur ou neutraliser le dispatch fautif."
    },
    quiz: {
      question: "Pourquoi l'écouteur avait-il disparu avant le premier clic humain ?",
      choices: [
        "Le bouton avait été remplacé par un clone",
        "L'option once l'a retiré après l'événement synthétique de l'auto-test, même si le handler a ignoré cet événement",
        "removeEventListener était appelé dans un setTimeout",
        "Le navigateur retire les écouteurs passifs après 1 seconde"
      ],
      answer: 1,
      why: "once retire l'écouteur dès qu'il a été invoqué une fois, indépendamment de ce que fait le handler ou de l'origine de l'événement. dispatchEvent compte comme une invocation."
    }
  }
];

const BY_ID = new Map(CHALLENGES.map((c) => [c.id, c]));
const IDS = CHALLENGES.map((c) => c.id);

// Ordre conseillé : par famille, puis par difficulté, puis par identifiant.
const FAMILY_ORDER = ['dom', 'js', 'net'];
const RECOMMENDED = CHALLENGES.slice().sort((a, b) =>
  FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family) || a.stars - b.stars || a.id.localeCompare(b.id)
).map((c) => c.id);

module.exports = { CHALLENGES, BY_ID, IDS, FAMILIES, FAMILY_ORDER, RECOMMENDED };

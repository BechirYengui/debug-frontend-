'use strict';

/*
 * Internationalisation : dictionnaires FR / EN de l'interface, choix de la langue,
 * remplissage des gabarits ({{t:clé}} puis {{VARIABLE}}).
 *
 * Les textes de la landing page et des écrans de compte vivent dans lib/i18n.pages.js
 * et sont fusionnés ici. Le contenu pédagogique des défis est dans data/challenges.js
 * (FR) et data/challenges.en.js (EN).
 */

const LANGS = ['fr', 'en'];
const DEFAULT_LANG = 'fr';
const COOKIE = 'dojo_lang';

const CORE = {
  fr: {
    /* navigation */
    'nav.dashboard': 'Mes défis',
    'nav.profile': 'Profil',
    'nav.guide': 'Guide DevTools',
    'nav.leaderboard': 'Classement',
    'nav.login': 'Connexion',
    'nav.signup': 'Créer un compte',
    'nav.logout': 'Déconnexion',
    'nav.belt': 'ceinture {belt}',

    /* générique */
    'g.brand': 'Debug Frontend',
    'g.points': 'points',
    'g.pts': 'pts',
    'g.min': 'min',
    'g.hours': 'h',
    'g.seconds': 's',
    'g.none': '…',
    'g.back': 'tableau de bord',
    'g.404.title': '404',
    'g.404.text': 'Rien ici. <a href="/">Retour à l\'accueil</a>',

    /* familles / parcours */
    'fam.track': 'Parcours {n}',
    'fam.method': 'Méthode :',

    /* cartes */
    'card.solved': 'résolu',
    'card.half': 'résolu · quiz à faire',
    'card.seen': 'corrigé vu',
    'card.todo': 'à faire',
    'card.never': 'jamais tenté',
    'card.attempt': '{n} tentative',
    'card.attempts': '{n} tentatives',
    'card.hint': '{n} indice',
    'card.hints': '{n} indices',
    'card.minified': 'minifié',
    'card.token': 'jeton',
    'card.reset': 'reset',
    'card.reset.title': 'Remettre ce défi à zéro',
    'card.recommended': 'conseillé',
    'card.minutes': '~{n} min',
    'card.difficulty': 'difficulté',

    /* tableau de bord */
    'dash.title': 'Debug Frontend : tableau de bord',
    'dash.kicker': 'Tableau de bord',
    'dash.h1': 'Les 18 défis',
    'dash.lead': 'Trois parcours, du clic qui n\'arrive pas à la requête qui ne convient pas. Règle du jeu, barème et compte : <a href="/profile">page Profil</a>.',
    'dash.next': 'Prochain défi conseillé :',
    'dash.filter.all': 'Tous',
    'dash.filter.todo': 'À faire',
    'dash.filter.done': 'Résolus',
    'dash.foot': '{name} · {done}/{total} résolus · {score} points · ceinture {belt}. Compte, langue, export ou remise à zéro : <a href="/profile">page Profil</a>.',

    /* profil */
    'profile.title': 'Debug Frontend : profil et règle du jeu',
    'profile.kicker': 'Entraînement au debugging front-end',
    'profile.lead': 'Dix-huit pages cassées, un seul objectif à chaque fois : faire arriver au serveur la requête <code>POST</code> attendue, avec les DevTools pour seule boîte à outils. <strong>Ce qui compte n\'est pas de réussir, mais de savoir pourquoi ça cassait.</strong>',
    'profile.account': 'Mon compte',
    'profile.lang': 'Langue de l\'interface',
    'profile.export': 'Exporter mes résultats',
    'profile.logout': 'Se déconnecter',
    'profile.delete': 'Supprimer mon compte',
    'profile.delete.confirm': 'Supprimer définitivement ton compte et toute ta progression ?',
    'profile.reset.all': 'Tout réinitialiser',
    'profile.reset.confirm': 'Remettre tous les défis à zéro ?',
    'profile.reset.note': 'La remise à zéro ne concerne que ton compte. Les corrigés ne s\'ouvrent qu\'après résolution, ou via « Je sèche ».',
    'profile.go': 'Aller aux défis',
    'score.done': 'résolus',
    'score.points': 'points',
    'score.quiz': 'quiz réussis',
    'score.hints': 'indices utilisés',
    'score.time': 'temps cumulé',
    'rules.title': 'Règle du jeu',
    'rules.p1': 'Sur chaque page il y a un bouton <strong>« Valider la commande »</strong>. Il ne marche pas, ou il marche mal. Tu dois faire parvenir au serveur cette requête exacte :',
    'rules.p2': 'Peu importe comment : réparer le DOM en direct, neutraliser du CSS, poser un point d\'arrêt, rejouer la requête depuis la Console. Le panneau « Journal du serveur » de chaque défi montre tout ce qui arrive réellement sur <code>/api/</code> : verbe, en-têtes, corps brut. C\'est ton miroir.',
    'rules.how': 'Comment ça marche',
    'rules.s1': 'Lis le contexte',
    'rules.s1.d': 'pourquoi ce défi, ce que tu vas apprendre',
    'rules.s2': 'Répare avec les DevTools',
    'rules.s2.d': 'Elements, Console, Sources, Network',
    'rules.s3': 'Lis la réponse du serveur',
    'rules.s3.d': 'succès, ou la raison précise du refus',
    'rules.s4': 'Débrief + quiz',
    'rules.s4.d': 'ce qui cassait, le réflexe à garder',
    'rules.scoring': 'Barème',
    'rules.base': 'base : les étoiles de difficulté fois cent',
    'rules.hint': 'par indice révélé',
    'rules.revealed': 'si le corrigé est ouvert avant de résoudre',
    'rules.quiz': 'si le quiz est juste du premier coup',
    'rules.belts': 'Ceintures',
    'rules.belts.p': 'Une ceinture tous les 3 défis résolus.',
    'rules.dan': '« Noire 1<sup>er</sup> dan » si tout est résolu sans corrigé et tous les quiz justes.',

    /* ceintures */
    'belt.white': 'blanche', 'belt.yellow': 'jaune', 'belt.orange': 'orange', 'belt.green': 'verte',
    'belt.blue': 'bleue', 'belt.brown': 'marron', 'belt.black': 'noire', 'belt.dan': '1er dan',

    /* classement */
    'board.title': 'Classement',
    'board.intro': 'Classement par défis résolus, puis par points, puis par temps cumulé. Le barème est rappelé sur la page Profil.',
    'board.solo': 'Tu es seul pour l\'instant : invite des collègues à créer un compte pour comparer vos progressions.',
    'board.player': 'Joueur', 'board.belt': 'Ceinture', 'board.solved': 'Résolus', 'board.points': 'Points',
    'board.quiz': 'Quiz', 'board.hints': 'Indices', 'board.revealed': 'Corrigés vus', 'board.time': 'Temps',

    /* guide */
    'guide.title': 'Guide DevTools',

    /* page de défi */
    'ch.title': 'Défi {id} : {title}',
    'ch.chrono': 'temps écoulé sur ce défi',
    'ch.status.todo': 'non résolu',
    'ch.status.done': 'résolu',
    'ch.status.seen': 'corrigé vu',
    'ch.why': 'Pourquoi ce défi',
    'ch.learn': 'Ce que tu vas apprendre',
    'ch.symptom': 'Symptôme',
    'ch.objective': 'Objectif',
    'ch.objective.p': 'Peu importe le chemin emprunté : fais arriver au serveur <strong>cette requête exacte</strong>.',
    'ch.objective.note': 'Le serveur répond soit un succès, soit la raison précise pour laquelle la requête reçue ne convient pas. Le panneau « Journal du serveur », plus bas, montre verbe, en-têtes et corps brut de tout ce qui arrive réellement sur <code>/api/</code> : c\'est ton miroir. Les requêtes envoyées depuis ce navigateur (page ou Console) sont créditées à ton compte.',
    'ch.log': 'Journal du serveur',
    'ch.log.p': 'Ce que le serveur a <strong>réellement reçu</strong> sur cet endpoint, requête par requête : la seule vérité quand la page et Network se contredisent.',
    'ch.log.empty': 'Aucune requête reçue sur cet endpoint pour l\'instant.',
    'ch.hints': 'Indices',
    'ch.hints.count': '{n} / 3 utilisés',
    'ch.hints.btn': 'Révéler un indice',
    'ch.hints.none': 'plus d\'indice',
    'ch.hints.cost': 'Chaque indice coûte 10 % du score du défi. Ouvrir le corrigé avant de résoudre en coûte 50 %.',
    'ch.hints.level': 'niveau {n}',
    'ch.reveal': 'Je sèche : ouvrir le corrigé',
    'ch.reveal.note': 'Le défi reste jouable, mais il sera marqué « corrigé vu ».',
    'ch.reveal.confirm': 'Ouvrir le corrigé maintenant ? Le défi restera jouable, mais il sera marqué « corrigé vu » et vaudra 50 % des points.',
    'ch.debrief': 'Débrief',
    'ch.debrief.cause': 'Ce qui cassait',
    'ch.debrief.reflex': 'Le réflexe à garder',
    'ch.quiz': 'As-tu compris ?',
    'ch.quiz.bonus': '+25 pts si juste du premier coup',
    'ch.quiz.first': 'Juste du premier coup, +25 pts.',
    'ch.quiz.later': 'Juste, +10 pts.',
    'ch.quiz.after': 'Juste après {n} essais.',
    'ch.quiz.wrong': 'Pas celle-là. Relis « Ce qui cassait » et réessaie.',
    'ch.quiz.pending': '{n} essai(s) pour l\'instant. Réessaie : le bonus complet n\'est plus en jeu, mais comprendre reste l\'essentiel.',
    'ch.quiz.toast': 'Quiz réussi : {pts} pts',
    'ch.solution.show': 'Voir le corrigé complet',
    'ch.solution.hide': 'Masquer le corrigé',
    'ch.solution.unavailable': 'Corrigé indisponible.',
    'ch.prev': 'précédent',
    'ch.next': 'Défi {id} · {title}',
    'ch.solved.toast': 'Défi résolu en {time}{pts}. Passe au débrief.',
    'ch.received.method': 'méthode', 'ch.received.ct': 'content-type', 'ch.received.token': 'X-Api-Token',
    'ch.received.bytes': 'corps (octets)', 'ch.received.body': 'corps reçu', 'ch.received.absent': '(absent)', 'ch.received.empty': '(vide)',
    'ch.log.body': 'corps', 'ch.log.bytes': 'octets', 'ch.log.port': 'port',

    /* messages serveur (API de l'exercice) */
    'api.unknown': 'Aucun défi ne porte cet identifiant.',
    'api.options': 'Verbe reçu : OPTIONS. Ce verbe n\'est pas dans le code de la page : le navigateur l\'a émis lui-même avant une requête vers une autre origine (preflight CORS){origin}. Cette réponse n\'autorise rien : le vrai POST ne suivra jamais.',
    'api.options.from': ', depuis l\'origine {o}',
    'api.method': 'Verbe reçu : {m}. Cet endpoint ne traite pas ce verbe.',
    'api.noct': 'Aucun en-tête Content-Type dans la requête reçue.',
    'api.badct': 'Content-Type reçu : « {ct} ». Ce n\'est pas le type de média que cet endpoint accepte.',
    'api.empty': 'Corps de requête vide (0 octet).',
    'api.badjson': 'Corps reçu illisible en JSON ({n} octets). Ce qui est arrivé commence par : « {head} ».',
    'api.notobject': 'Le JSON reçu est valide mais ce n\'est pas un objet.',
    'api.noid': 'Champ « challengeId » absent du JSON reçu. Clés reçues : {keys}.',
    'api.badid': 'Champ « challengeId » reçu avec la valeur « {v} » alors que l\'URL cible « {id} ».',
    'api.noaction': 'Champ « action » absent du JSON reçu. Clés reçues : {keys}.',
    'api.badaction': 'Champ « action » reçu avec la valeur {v}, inattendue ici.',
    'api.notoken': 'En-tête « X-Api-Token » absent de la requête reçue.',
    'api.badtoken': 'En-tête « X-Api-Token » présent mais sa valeur ne correspond pas à la session en cours (jeton reçu se terminant par « …{got} », attendu « …{want} »).',
    'api.already': 'Commande acceptée (ce défi était déjà résolu).',
    'api.solved': 'Commande acceptée. Défi {id} résolu en {time} avec {hints} indice(s){revealed} : {pts} pts.',
    'api.solved.revealed': ' et le corrigé ouvert',
    'api.anonymous': 'Commande acceptée, mais non créditée : aucune session de joueur (envoie la requête depuis ton navigateur connecté).',
    'api.noroute': 'Aucune route API ne correspond à {url}',

    /* endpoints internes */
    'dojo.auth': 'Connexion requise.',
    'dojo.solution.locked': 'Le corrigé s\'ouvre après résolution, ou explicitement via « Je sèche ».',
    'dojo.quiz.locked': 'Le quiz s\'ouvre avec le débrief.',
    'dojo.quiz.bad': 'Choix invalide.',
    'dojo.lang.bad': 'Langue inconnue.',

    /* authentification */
    'auth.err.username': 'Le pseudo doit faire entre 3 et 32 caractères (lettres, chiffres, espace, tiret, point, underscore).',
    'auth.err.password': 'Le mot de passe doit faire au moins 8 caractères.',
    'auth.err.match': 'Les deux mots de passe ne correspondent pas.',
    'auth.err.taken': 'Ce pseudo est déjà pris.',
    'auth.err.login': 'Pseudo ou mot de passe incorrect.',
    'auth.err.claimed': 'Ce profil existait déjà sans mot de passe : il vient d\'être associé à celui que tu as saisi.'
  },

  en: {
    'nav.dashboard': 'My challenges',
    'nav.profile': 'Profile',
    'nav.guide': 'DevTools guide',
    'nav.leaderboard': 'Leaderboard',
    'nav.login': 'Sign in',
    'nav.signup': 'Create an account',
    'nav.logout': 'Sign out',
    'nav.belt': '{belt} belt',

    'g.brand': 'Debug Frontend',
    'g.points': 'points',
    'g.pts': 'pts',
    'g.min': 'min',
    'g.hours': 'h',
    'g.seconds': 's',
    'g.none': '…',
    'g.back': 'dashboard',
    'g.404.title': '404',
    'g.404.text': 'Nothing here. <a href="/">Back to the home page</a>',

    'fam.track': 'Track {n}',
    'fam.method': 'Method:',

    'card.solved': 'solved',
    'card.half': 'solved · quiz pending',
    'card.seen': 'solution viewed',
    'card.todo': 'to do',
    'card.never': 'never attempted',
    'card.attempt': '{n} attempt',
    'card.attempts': '{n} attempts',
    'card.hint': '{n} hint',
    'card.hints': '{n} hints',
    'card.minified': 'minified',
    'card.token': 'token',
    'card.reset': 'reset',
    'card.reset.title': 'Reset this challenge',
    'card.recommended': 'recommended',
    'card.minutes': '~{n} min',
    'card.difficulty': 'difficulty',

    'dash.title': 'Debug Frontend: dashboard',
    'dash.kicker': 'Dashboard',
    'dash.h1': 'The 18 challenges',
    'dash.lead': 'Three tracks, from the click that never lands to the request the server refuses. Rules, scoring and account: <a href="/profile">Profile page</a>.',
    'dash.next': 'Recommended next challenge:',
    'dash.filter.all': 'All',
    'dash.filter.todo': 'To do',
    'dash.filter.done': 'Solved',
    'dash.foot': '{name} · {done}/{total} solved · {score} points · {belt} belt. Account, language, export or reset: <a href="/profile">Profile page</a>.',

    'profile.title': 'Debug Frontend: profile and rules',
    'profile.kicker': 'Front-end debugging training',
    'profile.lead': 'Eighteen broken pages, one goal every time: get the expected <code>POST</code> request to the server, with DevTools as your only toolbox. <strong>What matters is not succeeding, it is knowing why it was broken.</strong>',
    'profile.account': 'My account',
    'profile.lang': 'Interface language',
    'profile.export': 'Export my results',
    'profile.logout': 'Sign out',
    'profile.delete': 'Delete my account',
    'profile.delete.confirm': 'Permanently delete your account and all your progress?',
    'profile.reset.all': 'Reset everything',
    'profile.reset.confirm': 'Reset all challenges?',
    'profile.reset.note': 'Resetting only affects your account. Solutions open only after solving, or through "I give up".',
    'profile.go': 'Go to the challenges',
    'score.done': 'solved',
    'score.points': 'points',
    'score.quiz': 'quizzes passed',
    'score.hints': 'hints used',
    'score.time': 'total time',
    'rules.title': 'Rules of the game',
    'rules.p1': 'Every page has a <strong>"Valider la commande"</strong> (Submit) button. It does not work, or it works badly. You must get this exact request to the server:',
    'rules.p2': 'However you like: fix the DOM live, neutralise CSS, set a breakpoint, replay the request from the Console. The "Server log" panel of each challenge shows everything that really reaches <code>/api/</code>: verb, headers, raw body. It is your mirror.',
    'rules.how': 'How it works',
    'rules.s1': 'Read the context',
    'rules.s1.d': 'why this challenge, what you will learn',
    'rules.s2': 'Fix it with DevTools',
    'rules.s2.d': 'Elements, Console, Sources, Network',
    'rules.s3': 'Read the server response',
    'rules.s3.d': 'success, or the precise reason for the refusal',
    'rules.s4': 'Debrief + quiz',
    'rules.s4.d': 'what was broken, the reflex to keep',
    'rules.scoring': 'Scoring',
    'rules.base': 'base: difficulty stars times one hundred',
    'rules.hint': 'per revealed hint',
    'rules.revealed': 'if the solution is opened before solving',
    'rules.quiz': 'if the quiz is right on the first try',
    'rules.belts': 'Belts',
    'rules.belts.p': 'One belt every 3 solved challenges.',
    'rules.dan': '"Black, 1st dan" when everything is solved without opening a solution and every quiz is right.',

    'belt.white': 'white', 'belt.yellow': 'yellow', 'belt.orange': 'orange', 'belt.green': 'green',
    'belt.blue': 'blue', 'belt.brown': 'brown', 'belt.black': 'black', 'belt.dan': '1st dan',

    'board.title': 'Leaderboard',
    'board.intro': 'Ranked by solved challenges, then points, then total time. Scoring is detailed on the Profile page.',
    'board.solo': 'You are alone for now: invite colleagues to create an account and compare your progress.',
    'board.player': 'Player', 'board.belt': 'Belt', 'board.solved': 'Solved', 'board.points': 'Points',
    'board.quiz': 'Quiz', 'board.hints': 'Hints', 'board.revealed': 'Solutions viewed', 'board.time': 'Time',

    'guide.title': 'DevTools guide',

    'ch.title': 'Challenge {id}: {title}',
    'ch.chrono': 'time spent on this challenge',
    'ch.status.todo': 'unsolved',
    'ch.status.done': 'solved',
    'ch.status.seen': 'solution viewed',
    'ch.why': 'Why this challenge',
    'ch.learn': 'What you will learn',
    'ch.symptom': 'Symptom',
    'ch.objective': 'Goal',
    'ch.objective.p': 'Whatever path you take: get <strong>this exact request</strong> to the server.',
    'ch.objective.note': 'The server answers either a success or the precise reason why the received request does not fit. The "Server log" panel below shows verb, headers and raw body of everything that really reaches <code>/api/</code>: it is your mirror. Requests sent from this browser (page or Console) are credited to your account.',
    'ch.log': 'Server log',
    'ch.log.p': 'What the server <strong>actually received</strong> on this endpoint, request by request: the only truth when the page and Network disagree.',
    'ch.log.empty': 'No request received on this endpoint yet.',
    'ch.hints': 'Hints',
    'ch.hints.count': '{n} / 3 used',
    'ch.hints.btn': 'Reveal a hint',
    'ch.hints.none': 'no more hints',
    'ch.hints.cost': 'Each hint costs 10% of the challenge score. Opening the solution before solving costs 50%.',
    'ch.hints.level': 'level {n}',
    'ch.reveal': 'I give up: open the solution',
    'ch.reveal.note': 'The challenge stays playable, but it will be marked "solution viewed".',
    'ch.reveal.confirm': 'Open the solution now? The challenge stays playable, but it will be marked "solution viewed" and be worth 50% of the points.',
    'ch.debrief': 'Debrief',
    'ch.debrief.cause': 'What was broken',
    'ch.debrief.reflex': 'The reflex to keep',
    'ch.quiz': 'Did you get it?',
    'ch.quiz.bonus': '+25 pts if right on the first try',
    'ch.quiz.first': 'Right on the first try, +25 pts.',
    'ch.quiz.later': 'Right, +10 pts.',
    'ch.quiz.after': 'Right after {n} tries.',
    'ch.quiz.wrong': 'Not that one. Re-read "What was broken" and try again.',
    'ch.quiz.pending': '{n} attempt(s) so far. Try again: the full bonus is gone, but understanding is what matters.',
    'ch.quiz.toast': 'Quiz passed: {pts} pts',
    'ch.solution.show': 'Show the full solution',
    'ch.solution.hide': 'Hide the solution',
    'ch.solution.unavailable': 'Solution unavailable.',
    'ch.prev': 'previous',
    'ch.next': 'Challenge {id} · {title}',
    'ch.solved.toast': 'Challenge solved in {time}{pts}. On to the debrief.',
    'ch.received.method': 'method', 'ch.received.ct': 'content-type', 'ch.received.token': 'X-Api-Token',
    'ch.received.bytes': 'body (bytes)', 'ch.received.body': 'body received', 'ch.received.absent': '(absent)', 'ch.received.empty': '(empty)',
    'ch.log.body': 'body', 'ch.log.bytes': 'bytes', 'ch.log.port': 'port',

    'api.unknown': 'No challenge has this identifier.',
    'api.options': 'Verb received: OPTIONS. This verb is not in the page code: the browser sent it on its own before a request to another origin (CORS preflight){origin}. This response allows nothing: the real POST will never follow.',
    'api.options.from': ', from origin {o}',
    'api.method': 'Verb received: {m}. This endpoint does not handle that verb.',
    'api.noct': 'No Content-Type header in the received request.',
    'api.badct': 'Content-Type received: "{ct}". That is not the media type this endpoint accepts.',
    'api.empty': 'Empty request body (0 bytes).',
    'api.badjson': 'Received body is not readable as JSON ({n} bytes). What arrived starts with: "{head}".',
    'api.notobject': 'The received JSON is valid but it is not an object.',
    'api.noid': 'Field "challengeId" missing from the received JSON. Keys received: {keys}.',
    'api.badid': 'Field "challengeId" received with value "{v}" while the URL targets "{id}".',
    'api.noaction': 'Field "action" missing from the received JSON. Keys received: {keys}.',
    'api.badaction': 'Field "action" received with value {v}, unexpected here.',
    'api.notoken': 'Header "X-Api-Token" missing from the received request.',
    'api.badtoken': 'Header "X-Api-Token" is present but its value does not match the current session (token received ends with "…{got}", expected "…{want}").',
    'api.already': 'Command accepted (this challenge was already solved).',
    'api.solved': 'Command accepted. Challenge {id} solved in {time} with {hints} hint(s){revealed}: {pts} pts.',
    'api.solved.revealed': ' and the solution opened',
    'api.anonymous': 'Command accepted, but not credited: no player session (send the request from your signed-in browser).',
    'api.noroute': 'No API route matches {url}',

    'dojo.auth': 'Sign-in required.',
    'dojo.solution.locked': 'The solution opens after solving, or explicitly through "I give up".',
    'dojo.quiz.locked': 'The quiz opens with the debrief.',
    'dojo.quiz.bad': 'Invalid choice.',
    'dojo.lang.bad': 'Unknown language.',

    'auth.err.username': 'The username must be 3 to 32 characters (letters, digits, space, dash, dot, underscore).',
    'auth.err.password': 'The password must be at least 8 characters.',
    'auth.err.match': 'The two passwords do not match.',
    'auth.err.taken': 'This username is already taken.',
    'auth.err.login': 'Incorrect username or password.',
    'auth.err.claimed': 'This profile existed without a password: it has just been linked to the one you entered.'
  }
};

let pages = { fr: {}, en: {} };
try { pages = require('./i18n.pages'); } catch (e) { /* les pages publiques ne sont pas encore là */ }

const DICT = {
  fr: Object.assign({}, CORE.fr, pages.fr || {}),
  en: Object.assign({}, CORE.en, pages.en || {})
};

function normLang(l) {
  l = String(l || '').toLowerCase().slice(0, 2);
  return LANGS.indexOf(l) !== -1 ? l : null;
}

function t(lang, key, vars) {
  const d = DICT[lang] || DICT[DEFAULT_LANG];
  let s = d[key];
  if (s === undefined) s = DICT[DEFAULT_LANG][key];
  if (s === undefined) return key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
  return s;
}

/* Langue d'une requête : cookie, sinon préférence du compte, sinon Accept-Language. */
function pickLang(req, accountLang) {
  const raw = req.headers.cookie || '';
  const m = raw.match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  if (m && normLang(m[1])) return normLang(m[1]);
  if (normLang(accountLang)) return normLang(accountLang);
  const al = String(req.headers['accept-language'] || '');
  const first = al.split(',')[0];
  return normLang(first) || DEFAULT_LANG;
}

function cookieHeader(lang) {
  return COOKIE + '=' + lang + '; Path=/; Max-Age=31536000; SameSite=Lax';
}

/* Remplit un gabarit : {{t:clé}} puis {{VARIABLE}}. */
function fill(tpl, vars, lang) {
  let out = tpl.replace(/\{\{t:([\w.-]+)\}\}/g, (m, k) => t(lang, k));
  out = out.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : ''));
  return out;
}

/* Sous-ensemble du dictionnaire exposé aux scripts client. */
function clientStrings(lang) {
  const d = DICT[lang] || DICT[DEFAULT_LANG];
  const out = {};
  Object.keys(d).forEach((k) => { if (/^(ch\.|card\.reset|profile\.(delete|reset)\.confirm|g\.)/.test(k)) out[k] = d[k]; });
  return out;
}

module.exports = { LANGS, DEFAULT_LANG, COOKIE, DICT, t, pickLang, normLang, cookieHeader, fill, clientStrings };

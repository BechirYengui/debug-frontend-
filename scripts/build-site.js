'use strict';

/*
 * Génère le site vitrine publié sur GitHub Pages :
 *
 *   node scripts/build-site.js            écrit site/index.html
 *
 * La page est bilingue (un seul fichier, les deux langues présentes, bascule en
 * CSS sur l'attribut lang de <html>) et la liste des défis est construite à
 * partir de data/challenges.js et data/challenges.en.js : elle ne peut donc pas
 * se désynchroniser du contenu réel de la plateforme.
 *
 * Les captures de site/img sont produites à la main depuis l'application qui
 * tourne en local ; seul index.html est généré.
 */

const fs = require('fs');
const path = require('path');

const FR = require('../data/challenges');
const EN = require('../data/challenges.en');

const OUT = path.join(__dirname, '..', 'site');
const REPO = 'https://github.com/BechirYengui/debug-frontend-';
const CODESPACE = 'https://codespaces.new/BechirYengui/debug-frontend-?quickstart=1';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Deux langues côte à côte : <span class="fr">…</span><span class="en">…</span>. */
const bi = (fr, en, tag) => {
  const t = tag || 'span';
  return '<' + t + ' class="fr">' + fr + '</' + t + '><' + t + ' class="en">' + en + '</' + t + '>';
};

/* alt bilingue : l'attribut porte le texte FR, le script pose l'EN à la bascule. */
const biAlt = (fr, en) => 'alt="' + esc(fr) + '" data-alt-fr="' + esc(fr) + '" data-alt-en="' + esc(en) + '"';

const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

function cards(family) {
  return FR.CHALLENGES.filter((c) => c.family === family).map((c) => {
    const e = EN.CHALLENGES[c.id] || {};
    return `      <article class="card" data-family="${c.family}">
        <div class="card-top">
          <span class="cid">${c.id}</span>
          <span class="stars" title="${c.stars}/3">${stars(c.stars)}</span>
          <span class="mins">~${c.minutes} min</span>
        </div>
        <h4>${bi(esc(c.title), esc(e.title || c.title))}</h4>
        <p>${bi(esc(c.subtitle), esc(e.subtitle || c.subtitle))}</p>
        <div class="tabs">${c.tabs.map((t) => '<span>' + esc(t) + '</span>').join('')}</div>
      </article>`;
  }).join('\n');
}

function families() {
  return FR.FAMILY_ORDER.map((key, i) => {
    const f = FR.FAMILIES[key];
    const e = (EN.FAMILIES && EN.FAMILIES[key]) || {};
    const n = FR.CHALLENGES.filter((c) => c.family === key).length;
    return `    <section class="parcours" data-family="${key}">
      <div class="parcours-head">
        <p class="eyebrow">${bi('Parcours ' + (i + 1) + ' · ' + esc(f.short), 'Track ' + (i + 1) + ' · ' + esc(e.short || f.short))}</p>
        <h3>${bi(esc(f.name), esc(e.name || f.name))}</h3>
        <p class="lede">${bi(esc(f.description), esc(e.description || f.description))}</p>
        <p class="method"><strong>${bi('Méthode :', 'Method:')}</strong> ${bi(esc(f.method), esc(e.method || f.method))}</p>
        <p class="count">${bi(n + ' défis', n + ' challenges')}</p>
      </div>
      <div class="cards">
${cards(key)}
      </div>
    </section>`;
  }).join('\n');
}

const total = FR.CHALLENGES.length;
const minutes = FR.CHALLENGES.reduce((s, c) => s + c.minutes, 0);

const HTML = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Debug Frontend : ${total} pages cassées à réparer avec les DevTools</title>
<meta name="description" content="Plateforme bilingue d'entraînement au debugging front-end : ${total} fausses applications métier volontairement cassées, à réparer avec les seuls DevTools du navigateur.">
<meta property="og:title" content="Debug Frontend">
<meta property="og:description" content="${total} pages web volontairement cassées, à réparer avec les seuls DevTools. Une anomalie par défi, un objectif clair, un corrigé.">
<meta property="og:image" content="img/defi.webp">
<meta property="og:type" content="website">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><text y='26' font-size='26'>🐛</text></svg>">
<style>
:root{
  --bg:#0b0e14;--bg-2:#0f131c;--panel:#141a26;--panel-2:#1a2233;--ink:#080b11;
  --line:#26324a;--line-2:#34435f;
  --txt:#e2e8f3;--txt-2:#c3cee0;--muted:#94a1b6;--faint:#7c89a0;
  --accent:#5eead4;--accent-2:#7dd3fc;--warn:#fbbf24;--ok:#4ade80;
  --radius:12px;--radius-l:16px;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;
  --sans:system-ui,-apple-system,"Segoe UI",Roboto,Ubuntu,sans-serif;
  --wrap:1120px;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--txt);font-family:var(--sans);line-height:1.65;
  -webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
a{color:var(--accent-2)}
h1,h2,h3,h4{line-height:1.2;margin:0}
.wrap{max-width:var(--wrap);margin:0 auto;padding:0 22px}

/* bascule de langue : une seule langue visible à la fois */
html[lang="fr"] .en,html[lang="en"] .fr{display:none}

/* barre */
header.top{position:sticky;top:0;z-index:20;background:rgba(11,14,20,.86);
  backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.top .wrap{display:flex;align-items:center;gap:18px;height:58px}
.brand{font-weight:700;font-size:16px;letter-spacing:-.01em;text-decoration:none;color:var(--txt)}
.brand b{color:var(--accent)}
.top nav{margin-left:auto;display:flex;align-items:center;gap:6px}
.top nav a{color:var(--muted);text-decoration:none;font-size:13.5px;padding:6px 10px;border-radius:8px}
.top nav a:hover{color:var(--txt);background:var(--panel)}
.lang{display:flex;border:1px solid var(--line-2);border-radius:8px;overflow:hidden;margin-left:6px}
.lang button{background:transparent;border:0;color:var(--muted);font:600 11.5px/1 var(--mono);
  letter-spacing:.06em;padding:7px 9px;cursor:pointer}
.lang button[aria-pressed="true"]{background:var(--accent);color:var(--ink)}

/* héros */
.hero{padding:76px 0 56px;border-bottom:1px solid var(--line);
  background:radial-gradient(1100px 420px at 50% -10%,rgba(94,234,212,.10),transparent 70%)}
.eyebrow{font:600 11.5px/1.5 var(--mono);letter-spacing:.14em;text-transform:uppercase;
  color:var(--accent);margin:0 0 14px}
.hero h1{font-size:clamp(32px,5.2vw,54px);letter-spacing:-.025em;font-weight:800;max-width:21ch}
.hero h1 em{font-style:normal;color:var(--accent)}
.hero .lede{max-width:60ch;color:var(--txt-2);font-size:17px;margin:18px 0 0}
.cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
.btn{display:inline-flex;align-items:center;gap:9px;padding:12px 20px;border-radius:10px;
  font-weight:650;font-size:14.5px;text-decoration:none;border:1px solid transparent}
.btn-1{background:var(--accent);color:var(--ink)}
.btn-1:hover{filter:brightness(1.08)}
.btn-2{border-color:var(--line-2);color:var(--txt);background:var(--panel)}
.btn-2:hover{border-color:var(--accent-2)}
.note{color:var(--faint);font:400 12.5px/1.6 var(--mono);margin:14px 0 0}
.stats{display:flex;gap:38px;margin-top:38px;flex-wrap:wrap}
.stats div strong{display:block;font-size:26px;color:var(--accent-2);font-weight:800}
.stats div span{font:600 11px/1.4 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}

/* sections */
section.band{padding:64px 0;border-bottom:1px solid var(--line)}
section.band h2{font-size:clamp(24px,3.4vw,34px);letter-spacing:-.02em}
section.band > .wrap > .lede{color:var(--txt-2);max-width:66ch;margin:14px 0 0}

/* captures */
.shots{display:grid;gap:22px;margin-top:34px;grid-template-columns:1fr}
@media(min-width:860px){.shots{grid-template-columns:1fr 1fr}}
figure{margin:0;border:1px solid var(--line);border-radius:var(--radius-l);overflow:hidden;background:var(--panel)}
figure img{width:100%;height:auto}
figcaption{padding:12px 16px;color:var(--muted);font-size:13.5px;border-top:1px solid var(--line);background:var(--bg-2)}
.shots-2{display:grid;gap:22px;grid-template-columns:1fr}
@media(min-width:860px){.shots-2{grid-template-columns:1fr 1fr}}

/* étapes */
.steps{display:grid;gap:18px;margin-top:34px;grid-template-columns:1fr}
@media(min-width:820px){.steps{grid-template-columns:repeat(3,1fr)}}
.step{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:20px}
.step b{display:block;font:700 11.5px/1 var(--mono);color:var(--accent);letter-spacing:.1em;margin-bottom:10px}
.step h3{font-size:17px;margin-bottom:8px}
.step p{margin:0;color:var(--txt-2);font-size:14.5px}

/* parcours et cartes */
.parcours{margin-top:52px}
.parcours[data-family="dom"]{--fam:var(--accent)}
.parcours[data-family="js"]{--fam:var(--accent-2)}
.parcours[data-family="net"]{--fam:var(--warn)}
.parcours .eyebrow{color:var(--fam)}
.parcours h3{font-size:23px;letter-spacing:-.015em}
.parcours .lede{color:var(--txt-2);max-width:70ch;margin:12px 0 0;font-size:15px}
.parcours .method{color:var(--muted);font-size:14px;border-left:2px solid var(--fam);padding-left:12px;margin:14px 0 0}
.parcours .method strong{color:var(--txt-2)}
.parcours .count{font:600 11.5px/1 var(--mono);color:var(--faint);letter-spacing:.1em;text-transform:uppercase;margin:18px 0 0}
.cards{display:grid;gap:14px;margin-top:16px;grid-template-columns:1fr}
@media(min-width:700px){.cards{grid-template-columns:1fr 1fr}}
@media(min-width:1000px){.cards{grid-template-columns:repeat(3,1fr)}}
.card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:16px;
  border-top:2px solid var(--fam)}
.card-top{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.cid{font:600 11px/1.5 var(--mono);color:var(--faint);border:1px solid var(--line);border-radius:5px;padding:1px 6px}
.stars{color:var(--warn);font-size:12px;letter-spacing:.08em}
.mins{margin-left:auto;font:400 11.5px/1 var(--mono);color:var(--faint)}
.card h4{font-size:15.5px;margin-bottom:6px}
.card p{margin:0;color:var(--muted);font-size:13.5px;line-height:1.55}
.tabs{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.tabs span{font:400 11px/1.6 var(--mono);color:var(--faint);border:1px solid var(--line);border-radius:5px;padding:0 6px}

/* jouer */
.ways{display:grid;gap:18px;margin-top:32px;grid-template-columns:1fr}
@media(min-width:820px){.ways{grid-template-columns:1fr 1fr}}
.way{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:22px}
.way h3{font-size:18px;margin-bottom:10px}
.way p{color:var(--txt-2);font-size:14.5px;margin:0 0 14px}
pre{background:var(--ink);border:1px solid var(--line);border-radius:8px;padding:12px 14px;
  overflow-x:auto;margin:0;font-family:var(--mono);font-size:12.5px;color:var(--accent-2)}
.warn{border-left:2px solid var(--warn);padding-left:14px;color:var(--muted);font-size:14px;margin-top:34px}

footer{padding:40px 0;color:var(--faint);font-size:13.5px}
footer a{color:var(--muted)}
footer .wrap{display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between}
</style>
</head>
<body>

<header class="top">
  <div class="wrap">
    <a class="brand" href="#">Debug <b>Frontend</b></a>
    <nav>
      <a href="#defis">${bi('Les défis', 'Challenges')}</a>
      <a href="#jouer">${bi('Jouer', 'Play')}</a>
      <a href="${REPO}">GitHub</a>
      <span class="lang">
        <button type="button" data-lang="fr" aria-pressed="true">FR</button>
        <button type="button" data-lang="en" aria-pressed="false">EN</button>
      </span>
    </nav>
  </div>
</header>

<div class="hero">
  <div class="wrap">
    <p class="eyebrow">${bi('Entraînement au debugging front-end', 'Front-end debugging practice')}</p>
    <h1>${bi('Apprends à déboguer le front-end <em>comme un senior</em>', 'Learn to debug the front end <em>like a senior</em>')}</h1>
    <p class="lede">${bi(
      'Dix-huit pages réellement cassées, un seul objectif à chaque fois : faire partir la bonne requête. Les DevTools pour seule boîte à outils. Ce qui compte n\'est pas de réussir, mais de savoir <strong>pourquoi ça cassait</strong>.',
      'Eighteen genuinely broken pages, one goal every time: get the right request to leave the browser. The DevTools are your only toolbox. What matters is not fixing it, but knowing <strong>why it broke</strong>.')}</p>
    <div class="cta">
      <a class="btn btn-1" href="${CODESPACE}">${bi('Ouvrir dans un Codespace', 'Open in a Codespace')}</a>
      <a class="btn btn-2" href="${REPO}">${bi('Voir le code', 'View the code')}</a>
    </div>
    <p class="note">${bi('Aucune installation : GitHub lance le serveur et t\'ouvre la plateforme.', 'No install: GitHub starts the server and opens the platform for you.')}</p>
    <div class="stats">
      <div><strong>${total}</strong><span>${bi('défis', 'challenges')}</span></div>
      <div><strong>3</strong><span>${bi('parcours', 'tracks')}</span></div>
      <div><strong>~${Math.round(minutes / 60)} h</strong><span>${bi('de pratique', 'of practice')}</span></div>
      <div><strong>0</strong><span>framework</span></div>
    </div>
  </div>
</div>

<section class="band">
  <div class="wrap">
    <h2>${bi('À quoi ça ressemble', 'What it looks like')}</h2>
    <p class="lede">${bi(
      'Chaque défi est une fausse application métier crédible : console de déploiement, supervision industrielle, back-office bancaire. Le briefing t\'explique le symptôme et l\'objectif, l\'atelier contient l\'application cassée, et le journal du serveur montre ce qui est <strong>réellement</strong> arrivé.',
      'Every challenge is a believable business app: a deployment console, an industrial supervision panel, a banking back office. The briefing gives you the symptom and the goal, the workshop holds the broken app, and the server log shows what <strong>actually</strong> arrived.')}</p>
    <div class="shots">
      <figure>
        <img src="img/defi.webp" ${biAlt('Page d\'un défi : briefing, symptôme et objectif', 'A challenge page: briefing, symptom and goal')} width="2160" height="1350" loading="lazy">
        <figcaption>${bi('Le briefing : pourquoi ce défi, ce que tu vas apprendre, le symptôme observé et la requête exacte à faire partir.', 'The briefing: why this challenge, what you will learn, the observed symptom and the exact request to send.')}</figcaption>
      </figure>
      <figure>
        <img src="img/atelier.webp" ${biAlt('L\'atelier : l\'application cassée et le journal du serveur', 'The workshop: the broken app and the server log')} width="2160" height="1350" loading="lazy">
        <figcaption>${bi('L\'atelier : l\'application à déboguer, puis le journal du serveur qui montre verbe, en-têtes et corps brut de tout ce qui arrive.', 'The workshop: the app to debug, then the server log showing the verb, headers and raw body of everything that arrives.')}</figcaption>
      </figure>
    </div>
    <div class="shots-2" style="margin-top:22px">
      <figure>
        <img src="img/tableau-de-bord.webp" ${biAlt('Tableau de bord des ' + total + ' défis', 'Dashboard of the ' + total + ' challenges')} width="2160" height="1350" loading="lazy">
        <figcaption>${bi('Le tableau de bord : trois parcours, progression et défi conseillé.', 'The dashboard: three tracks, progress and a recommended next challenge.')}</figcaption>
      </figure>
      <figure>
        <img src="img/accueil.webp" ${biAlt('Page d\'accueil de la plateforme', 'Platform home page')} width="2160" height="1350" loading="lazy">
        <figcaption>${bi('La plateforme est bilingue FR / EN, du briefing jusqu\'au corrigé.', 'The platform is bilingual FR / EN, from the briefing to the solution.')}</figcaption>
      </figure>
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <h2>${bi('Comment ça marche', 'How it works')}</h2>
    <div class="steps">
      <div class="step">
        <b>01</b>
        <h3>${bi('Un bug, un seul', 'One bug, exactly one')}</h3>
        <p>${bi('Chaque page contient une anomalie volontaire et une seule ; tout le reste fonctionne. Aucun commentaire ne trahit le coupable, aucune sourcemap ne fait le travail à ta place.', 'Each page contains exactly one deliberate flaw; everything else works. No comment gives the culprit away, and no sourcemap does the work for you.')}</p>
      </div>
      <div class="step">
        <b>02</b>
        <h3>${bi('Les DevTools, rien d\'autre', 'DevTools, nothing else')}</h3>
        <p>${bi('Elements, Console, Network, Sources. HTML, CSS et JavaScript vanilla : pas de React, pas de bundler, du DOM brut à inspecter.', 'Elements, Console, Network, Sources. Vanilla HTML, CSS and JavaScript: no React, no bundler, just raw DOM to inspect.')}</p>
      </div>
      <div class="step">
        <b>03</b>
        <h3>${bi('Le serveur ne ment pas', 'The server does not lie')}</h3>
        <p>${bi('Le défi est résolu quand la bonne requête arrive vraiment. Ensuite viennent le débrief, un quiz et le corrigé détaillé.', 'A challenge is solved when the right request truly arrives. Then come the debrief, a quiz and the detailed solution.')}</p>
      </div>
    </div>
  </div>
</section>

<section class="band" id="defis">
  <div class="wrap">
    <h2>${bi('Les ' + total + ' défis', 'The ' + total + ' challenges')}</h2>
    <p class="lede">${bi(
      'Trois parcours, du clic qui n\'arrive pas jusqu\'à la requête qui ne convient pas. Les niveaux vont d\'une étoile (dix minutes) à trois étoiles (une vraie enquête).',
      'Three tracks, from the click that never lands to the request that is not accepted. Levels range from one star (ten minutes) to three stars (a real investigation).')}</p>
${families()}
  </div>
</section>

<section class="band" id="jouer">
  <div class="wrap">
    <h2>${bi('Jouer', 'Play')}</h2>
    <div class="ways">
      <div class="way">
        <h3>${bi('Dans un Codespace, sans rien installer', 'In a Codespace, with nothing to install')}</h3>
        <p>${bi('GitHub démarre une machine, installe les dépendances et lance le serveur. Tu obtiens une URL en app.github.dev avec la plateforme complète.', 'GitHub starts a machine, installs the dependencies and runs the server. You get an app.github.dev URL with the full platform.')}</p>
        <a class="btn btn-1" href="${CODESPACE}">${bi('Ouvrir un Codespace', 'Open a Codespace')}</a>
      </div>
      <div class="way">
        <h3>${bi('En local', 'Locally')}</h3>
        <p>${bi('Node.js 22.13 ou plus récent, une seule dépendance (Express).', 'Node.js 22.13 or newer, a single dependency (Express).')}</p>
        <pre>git clone ${REPO}.git
cd debug-frontend-
npm install
npm start</pre>
        <p class="note">${bi('Puis ouvre http://localhost:3000', 'Then open http://localhost:3000')}</p>
      </div>
    </div>
    <p class="warn">${bi(
      'Cette page est une vitrine statique : elle est hébergée par GitHub Pages, qui ne sait servir que des fichiers. La plateforme, elle, est un serveur Node avec une base SQLite, et la moitié des défis repose sur de vraies réponses HTTP (403, 405, préflight CORS) qu\'un hébergement statique ne peut pas produire. D\'où le Codespace ou le lancement en local.',
      'This page is a static showcase: it is hosted on GitHub Pages, which only serves files. The platform itself is a Node server with a SQLite database, and half the challenges rely on real HTTP responses (403, 405, CORS preflight) that static hosting cannot produce. Hence the Codespace, or running it locally.')}</p>
  </div>
</section>

<footer>
  <div class="wrap">
    <span>${bi('Debug <b>Frontend</b> · plateforme d\'entraînement au debugging front-end', 'Debug <b>Frontend</b> · front-end debugging practice platform')}</span>
    <span><a href="${REPO}">${bi('Code source sur GitHub', 'Source code on GitHub')}</a></span>
  </div>
</footer>

<script>
(function () {
  var root = document.documentElement;
  var buttons = document.querySelectorAll('.lang button');
  function apply(lang) {
    root.lang = lang;
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
    document.querySelectorAll('img[data-alt-fr]').forEach(function (img) {
      img.alt = img.getAttribute('data-alt-' + lang) || img.alt;
    });
    try { localStorage.setItem('df_lang', lang); } catch (e) {}
  }
  var saved = null;
  try { saved = localStorage.getItem('df_lang'); } catch (e) {}
  apply(saved || (navigator.language && navigator.language.slice(0, 2) === 'en' ? 'en' : 'fr'));
  buttons.forEach(function (b) { b.addEventListener('click', function () { apply(b.dataset.lang); }); });
})();
</script>

</body>
</html>
`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), HTML);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log('site/index.html écrit (' + total + ' défis, ' + Math.round(HTML.length / 1024) + ' Ko)');

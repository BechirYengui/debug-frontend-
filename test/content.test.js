'use strict';

/*
 * Tests statiques du contenu pédagogique : catalogue FR/EN, dictionnaires i18n,
 * fragments HTML, code des défis, corrigés FR/EN, typographie, indices.
 *
 *   DOJO_QUIET=1 node --test test/content.test.js
 *
 * Aucun serveur n'est démarré : tout se vérifie sur les fichiers.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FR = require('../data/challenges');
const EN = require('../data/challenges.en');
const i18n = require('../lib/i18n');
const pages = require('../lib/i18n.pages');

const FAMILIES = ['dom', 'js', 'net'];
const TABS = ['Elements', 'Console', 'Network', 'Sources', 'Application'];

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function nonEmpty(v, label) {
  assert.equal(typeof v, 'string', label + ' : chaîne attendue');
  assert.ok(v.trim().length > 0, label + ' : vide');
}
function fenceCount(md) { return md.split('\n').filter((l) => /^\s*```/.test(l)).length; }

/* Fichiers parcourus par les contrôles typographiques. */
function walk(rel, filter) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return [];
  const st = fs.statSync(abs);
  if (st.isFile()) return filter(rel) ? [rel] : [];
  return fs.readdirSync(abs).reduce((acc, name) => {
    if (name === 'node_modules') return acc;
    return acc.concat(walk(path.join(rel, name), filter));
  }, []);
}
const TEXT_EXT = (rel) => /\.(js|html|md|css)$/.test(rel);
const TYPO_FILES = []
  .concat(walk('data', TEXT_EXT), walk('docs', TEXT_EXT), walk('solutions', TEXT_EXT))
  .concat(walk('challenges', TEXT_EXT), walk('public/c', TEXT_EXT), walk('views', TEXT_EXT))
  .concat(walk('public/static', (rel) => /\.(css|js)$/.test(rel)))
  .concat(['lib/i18n.js', 'lib/i18n.pages.js']);

/* ------------------------------------------------------------------ */
/* Catalogue FR                                                        */
/* ------------------------------------------------------------------ */

test('data/challenges.js : 18 défis, identifiants 01..18 uniques et ordonnés', () => {
  assert.equal(FR.CHALLENGES.length, 18);
  const ids = FR.CHALLENGES.map((c) => c.id);
  assert.deepEqual(ids, Array.from({ length: 18 }, (_, i) => String(i + 1).padStart(2, '0')));
  assert.equal(new Set(ids).size, 18);
  assert.deepEqual(FR.IDS, ids);
});

test('data/challenges.js : chaque entrée est complète et bien formée', () => {
  FR.CHALLENGES.forEach((c) => {
    const at = 'défi ' + c.id;
    assert.ok(Number.isInteger(c.stars) && c.stars >= 1 && c.stars <= 3, at + ' : stars');
    assert.ok(Number.isInteger(c.minutes) && c.minutes > 0, at + ' : minutes');
    assert.ok(FAMILIES.includes(c.family), at + ' : family');
    assert.ok(Array.isArray(c.tabs) && c.tabs.length > 0, at + ' : tabs');
    c.tabs.forEach((tab) => assert.ok(TABS.includes(tab), at + ' : onglet inconnu ' + tab));
    nonEmpty(c.title, at + ' title');
    nonEmpty(c.subtitle, at + ' subtitle');
    nonEmpty(c.symptom, at + ' symptom');
    nonEmpty(c.intro, at + ' intro');
    assert.ok(c.intro.length >= 200, at + ' : intro trop courte (' + c.intro.length + ' caractères)');
    assert.ok(Array.isArray(c.learn) && c.learn.length >= 3 && c.learn.length <= 4, at + ' : learn (3 à 4)');
    c.learn.forEach((l, i) => nonEmpty(l, at + ' learn[' + i + ']'));
    assert.ok(Array.isArray(c.hints) && c.hints.length === 3, at + ' : 3 indices attendus');
    c.hints.forEach((h, i) => nonEmpty(h, at + ' hints[' + i + ']'));
    nonEmpty(c.debrief && c.debrief.cause, at + ' debrief.cause');
    nonEmpty(c.debrief && c.debrief.reflex, at + ' debrief.reflex');
    nonEmpty(c.quiz && c.quiz.question, at + ' quiz.question');
    nonEmpty(c.quiz && c.quiz.why, at + ' quiz.why');
    assert.ok(Array.isArray(c.quiz.choices) && c.quiz.choices.length === 4, at + ' : 4 choix attendus');
    c.quiz.choices.forEach((ch, i) => nonEmpty(ch, at + ' quiz.choices[' + i + ']'));
    assert.ok(Number.isInteger(c.quiz.answer) && c.quiz.answer >= 0 && c.quiz.answer <= 3, at + ' : quiz.answer');
    if (c.minified !== undefined) assert.equal(typeof c.minified, 'boolean', at + ' : minified');
    if (c.requiresToken !== undefined) assert.equal(typeof c.requiresToken, 'boolean', at + ' : requiresToken');
  });
});

test('data/challenges.js : FAMILIES et RECOMMENDED cohérents', () => {
  FAMILIES.forEach((k) => {
    const f = FR.FAMILIES[k];
    assert.ok(f, 'famille ' + k);
    ['name', 'short', 'description', 'method'].forEach((field) => nonEmpty(f[field], 'FAMILIES.' + k + '.' + field));
  });
  assert.deepEqual(FR.RECOMMENDED.slice().sort(), FR.IDS.slice().sort());
});

/* ------------------------------------------------------------------ */
/* Catalogue EN                                                        */
/* ------------------------------------------------------------------ */

test('data/challenges.en.js : mêmes identifiants, mêmes tailles, tous champs non vides', () => {
  assert.deepEqual(Object.keys(EN.CHALLENGES).sort(), FR.IDS.slice().sort());
  FR.CHALLENGES.forEach((c) => {
    const e = EN.CHALLENGES[c.id];
    const at = 'défi ' + c.id + ' (en)';
    ['title', 'subtitle', 'intro', 'symptom'].forEach((k) => nonEmpty(e[k], at + ' ' + k));
    assert.equal(e.learn.length, c.learn.length, at + ' : learn');
    e.learn.forEach((l, i) => nonEmpty(l, at + ' learn[' + i + ']'));
    assert.equal(e.hints.length, c.hints.length, at + ' : hints');
    e.hints.forEach((h, i) => nonEmpty(h, at + ' hints[' + i + ']'));
    nonEmpty(e.debrief && e.debrief.cause, at + ' debrief.cause');
    nonEmpty(e.debrief && e.debrief.reflex, at + ' debrief.reflex');
    nonEmpty(e.quiz && e.quiz.question, at + ' quiz.question');
    nonEmpty(e.quiz && e.quiz.why, at + ' quiz.why');
    assert.equal(e.quiz.choices.length, c.quiz.choices.length, at + ' : choices');
    e.quiz.choices.forEach((ch, i) => nonEmpty(ch, at + ' quiz.choices[' + i + ']'));
    // La bonne réponse vient du FR : l'EN ne doit pas la redéfinir différemment.
    if (e.quiz.answer !== undefined) assert.equal(e.quiz.answer, c.quiz.answer, at + ' : quiz.answer divergent');
  });
});

test('data/challenges.en.js : FAMILIES dom/js/net traduites', () => {
  assert.deepEqual(Object.keys(EN.FAMILIES).sort(), FAMILIES.slice().sort());
  FAMILIES.forEach((k) => {
    ['name', 'short', 'description', 'method'].forEach((field) => nonEmpty(EN.FAMILIES[k][field], 'EN.FAMILIES.' + k + '.' + field));
  });
});

/* ------------------------------------------------------------------ */
/* Dictionnaires i18n                                                  */
/* ------------------------------------------------------------------ */

function sameKeys(fr, en, label) {
  const kf = Object.keys(fr).sort();
  const ke = Object.keys(en).sort();
  assert.deepEqual(kf, ke, label + ' : clés fr/en différentes');
  kf.forEach((k) => { nonEmpty(fr[k], label + '.fr.' + k); nonEmpty(en[k], label + '.en.' + k); });
}

test('lib/i18n.js : DICT.fr et DICT.en ont les mêmes clés, aucune valeur vide', () => {
  sameKeys(i18n.DICT.fr, i18n.DICT.en, 'DICT');
});

test('lib/i18n.pages.js : mêmes clés fr/en, aucune valeur vide', () => {
  sameKeys(pages.fr, pages.en, 'pages');
});

/* ------------------------------------------------------------------ */
/* Fichiers de chaque défi                                             */
/* ------------------------------------------------------------------ */

const FR_SECTIONS = ['## Cause', '## Diagnostic pas à pas', '## Contournements', '## Le réflexe à garder'];
const EN_SECTIONS = ['## Cause', '## Step-by-step diagnosis', '## Workarounds', '## The reflex to keep'];

FR.CHALLENGES.forEach((c) => {
  const id = c.id;

  test('défi ' + id + ' : fragment challenges/' + id + '.html', () => {
    const rel = 'challenges/' + id + '.html';
    assert.ok(exists(rel), rel + ' manquant');
    const html = read(rel);
    ['HEAD', 'WORKSPACE', 'SCRIPTS'].forEach((s) => {
      assert.ok(new RegExp('<!--\\s*' + s + '\\s*-->[\\s\\S]*?<!--\\s*/' + s + '\\s*-->').test(html), rel + ' : section ' + s + ' absente');
    });
    const buttons = html.match(/<button class="btn btn-primary"[^>]*>[^<]*<\/button>/g) || [];
    assert.equal(buttons.length, 1, rel + ' : exactement un bouton .btn.btn-primary attendu');
    assert.ok(/>Valider la commande<\/button>$/.test(buttons[0]), rel + ' : le libellé doit être « Valider la commande »');
    assert.ok(html.includes('<script src="/c/' + id + '.js" defer></script>'), rel + ' : <script src="/c/' + id + '.js" defer> absent');
    assert.ok(html.includes('href="/c/' + id + '.css"'), rel + ' : feuille /c/' + id + '.css non référencée');
  });

  test('défi ' + id + ' : code public/c/' + id + '.js et .css', () => {
    assert.ok(exists('public/c/' + id + '.js'), 'public/c/' + id + '.js manquant');
    assert.ok(exists('public/c/' + id + '.css'), 'public/c/' + id + '.css manquant');
    if (c.minified) {
      const js = read('public/c/' + id + '.js').trim();
      assert.equal(js.split('\n').length, 1, 'public/c/' + id + '.js doit tenir sur une ligne (minified: true)');
      assert.ok(exists('solutions/sources/' + id + '.src.js'), 'solutions/sources/' + id + '.src.js manquant');
    }
  });

  test('défi ' + id + ' : corrigés solutions/' + id + '.md et solutions/en/' + id + '.md', () => {
    const frRel = 'solutions/' + id + '.md';
    const enRel = 'solutions/en/' + id + '.md';
    assert.ok(exists(frRel), frRel + ' manquant');
    assert.ok(exists(enRel), enRel + ' manquant');
    const fr = read(frRel);
    const en = read(enRel);
    assert.ok(fr.startsWith('# Défi ' + id), frRel + ' doit commencer par « # Défi ' + id + ' »');
    assert.ok(en.startsWith('# Challenge ' + id), enRel + ' doit commencer par « # Challenge ' + id + ' »');
    FR_SECTIONS.forEach((s) => assert.ok(fr.includes('\n' + s + '\n'), frRel + ' : section « ' + s + ' » absente'));
    EN_SECTIONS.forEach((s) => assert.ok(en.includes('\n' + s + '\n'), enRel + ' : section « ' + s + ' » absente'));
    assert.equal(fenceCount(fr) % 2, 0, frRel + ' : bloc ``` non fermé');
    assert.equal(fenceCount(en), fenceCount(fr), enRel + ' : nombre de blocs ``` différent de la version française');
    assert.ok(fr.includes('/api/challenge/' + id + '/solve'), frRel + ' : le rejeu fetch de la requête cible manque');
    assert.ok(en.includes('/api/challenge/' + id + '/solve'), enRel + ' : le rejeu fetch de la requête cible manque');
  });
});

/* ------------------------------------------------------------------ */
/* Typographie et commentaires                                         */
/* ------------------------------------------------------------------ */

// Construit sans écrire les motifs en clair, pour que le grep de CLAUDE.md reste muet sur ce fichier.
const LONG_DASH = new RegExp('\\u2014|\\u2013|&' + 'mdash;|&' + 'ndash;');

test('aucun tiret long (em dash, en dash, entités HTML) dans le contenu', () => {
  const bad = [];
  TYPO_FILES.forEach((rel) => {
    read(rel).split('\n').forEach((line, i) => {
      if (LONG_DASH.test(line)) bad.push(rel + ':' + (i + 1));
    });
  });
  assert.deepEqual(bad, [], 'tirets longs trouvés');
});

test('aucun commentaire révélateur dans public/c/*.js et challenges/*.html', () => {
  const files = walk('public/c', (r) => /\.js$/.test(r)).concat(walk('challenges', (r) => /\.html$/.test(r)));
  const bad = [];
  files.forEach((rel) => {
    read(rel).split('\n').forEach((line, i) => {
      if (/\b(bug|todo|fixme|bogue|volontaire)\b/i.test(line)) bad.push(rel + ':' + (i + 1) + ' ' + line.trim().slice(0, 80));
    });
  });
  assert.deepEqual(bad, [], 'mots interdits trouvés');
});

/* ------------------------------------------------------------------ */
/* Les indices ne donnent pas la solution                              */
/* ------------------------------------------------------------------ */

/*
 * Pour chaque défi, les chaînes qui identifient la solution (sélecteur, identifiant,
 * valeur ou API précise) et qu'aucun indice, FR ou EN, ne doit contenir. Un indice de
 * niveau 3 peut nommer le mécanisme (« un ancêtre coupe la propagation », « un jeton en
 * cache », « un écouteur à usage unique ») sans nommer l'identifiant.
 *
 * Choix commentés :
 *   09 : `method` seul est exclu de la liste, car l'indice 2 cite la colonne DevTools
 *        « Request Method », qui est un geste et pas la réponse ; ce qui est interdit,
 *        c'est le défaut du wrapper (opts.method, 'GET') et le nom du wrapper.
 *   10 : `Content-Type` est interdit ; l'indice 3 parle de « l'en-tête qui décrit son type ».
 *   17 : « quarantaine » n'est pas interdit : le symptôme l'affiche déjà au joueur. Sont
 *        interdits le nom du script et de son enveloppe.
 *   18 : `once` est vérifié en mot entier pour ne pas déclencher sur d'autres mots.
 */
const LEAKS = {
  '01': ['view-transition', 'is-idle'],
  '02': ['disabled'],
  '03': ['pointer-events', 'rotation-footer', 'data-state'],
  '04': ['::after', '::before', 'editor-metrics'],
  '05': ['05-bindings', 'querySelector'],
  '06': ['type="submit"', 'preventDefault', /\bsubmit\b/],
  '07': ['stopPropagation', 'order-panel'],
  '08': [/\bcatch\b/, 'ss.profile', 'supervisor'],
  '09': ['opts.method', "'GET'", 'api.request'],
  '10': ['Content-Type', 'text/plain', 'E.hdr'],
  '11': ['JSON.stringify', '[object Object]', 'toString'],
  '12': ['X-Api-Token', 'K.t'],
  '13': ['treshold', 'threshold'],
  '14': [/\b900\b/, 'confirmDelay', 'CFG'],
  '15': ['GATEWAY', 'replica', 'réplica'],
  '16': ['pricing.session', 'sso-handoff', 'expiresAt'],
  '17': ['17-guard', 'privacy-guard', 'ALLOW'],
  '18': [/\bonce\b/, 'dispatchEvent', 'selftest']
};

test('la liste LEAKS couvre les 18 défis', () => {
  assert.deepEqual(Object.keys(LEAKS).sort(), FR.IDS.slice().sort());
});

FR.CHALLENGES.forEach((c) => {
  test('défi ' + c.id + ' : les indices FR et EN ne contiennent pas la solution', () => {
    const hints = c.hints.map((h, i) => ['fr', i + 1, h]).concat(EN.CHALLENGES[c.id].hints.map((h, i) => ['en', i + 1, h]));
    const bad = [];
    hints.forEach(([lang, level, text]) => {
      LEAKS[c.id].forEach((needle) => {
        const hit = needle instanceof RegExp ? needle.test(text) : text.includes(needle);
        if (hit) bad.push(lang + ' niveau ' + level + ' contient « ' + String(needle) + ' »');
      });
    });
    assert.deepEqual(bad, [], 'indice(s) révélateur(s)');
  });
});

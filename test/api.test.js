'use strict';

/*
 * Tests d'intégration du serveur : comptes et sessions, pages FR/EN, API de
 * l'exercice, couche pédagogique (indices, corrigé, quiz), journal du serveur,
 * classement, remise à zéro.
 *
 *   npm test
 *
 * Le serveur est démarré sur un port libre avec un progress.json temporaire :
 * la progression réelle n'est jamais touchée.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DOJO_QUIET = '1';
process.env.DOJO_PROGRESS_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dojo-')), 'progress.json');

const { app, SESSION_TOKEN, CHALLENGES } = require('../server');

let server;
let base;
let COOKIE = ''; // session du compte de test principal

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = 'http://127.0.0.1:' + server.address().port;
  const r = await signup('Testeur Un', 'motdepasse1', 'fr');
  COOKIE = r.cookie;
});

after(() => new Promise((r) => server.close(r)));

/* ---------------- helpers ---------------- */

function cookiesOf(res) {
  const all = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie') || ''];
  return all.filter(Boolean);
}

function sessionOf(res) {
  const c = cookiesOf(res).find((x) => /^dojo_session=/.test(x));
  return c ? c.split(';')[0] : '';
}

async function form(p, fields, cookie) {
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(base + p, { method: 'POST', redirect: 'manual', headers, body: new URLSearchParams(fields).toString() });
  return { status: res.status, location: res.headers.get('location'), cookie: sessionOf(res), body: await res.text(), res };
}

function signup(username, password, lang) {
  return form('/signup', { username, password, password2: password, lang: lang || 'fr' });
}

function solveUrl(id) { return base + '/api/challenge/' + id + '/solve'; }

async function solve(id, opts) {
  opts = opts || {};
  const headers = Object.assign({ 'Content-Type': 'application/json', Cookie: opts.cookie === undefined ? COOKIE : opts.cookie }, opts.headers || {});
  if (!headers.Cookie) delete headers.Cookie;
  const body = opts.body !== undefined ? opts.body : JSON.stringify({ challengeId: id, action: 'validate' });
  const res = await fetch(solveUrl(id), { method: opts.method || 'POST', headers, body: opts.method === 'GET' ? undefined : body });
  return { status: res.status, json: await res.json() };
}

async function dojo(method, p, data, cookie) {
  const headers = { 'Content-Type': 'application/json' };
  const ck = cookie === undefined ? COOKIE : cookie;
  if (ck) headers.Cookie = ck;
  const res = await fetch(base + p, { method, headers, body: data ? JSON.stringify(data) : undefined, redirect: 'manual' });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, headers: res.headers, body: ct.includes('json') ? await res.json() : await res.text() };
}

/* ---------------------------------------------------------------- */
/* Comptes et sessions                                              */
/* ---------------------------------------------------------------- */

test('inscription : validation des champs, cookie de session, redirection', async () => {
  assert.equal((await signup('ab', 'motdepasse1')).status, 400, 'pseudo trop court');
  assert.equal((await signup('Bon Pseudo', 'court')).status, 400, 'mot de passe trop court');
  const mismatch = await form('/signup', { username: 'Bon Pseudo', password: 'motdepasse1', password2: 'autre', lang: 'fr' });
  assert.equal(mismatch.status, 400);
  assert.ok(mismatch.body.includes('auth-error'));
  const ok = await signup('Bon Pseudo', 'motdepasse1', 'en');
  assert.equal(ok.status, 302);
  assert.equal(ok.location, '/dashboard');
  assert.match(ok.cookie, /^dojo_session=/);
  assert.equal((await signup('bon pseudo', 'motdepasse1')).status, 400, 'pseudo déjà pris (insensible à la casse)');
});

test('connexion : mauvais identifiants refusés, bons acceptés, déconnexion', async () => {
  const bad = await form('/login', { username: 'Testeur Un', password: 'faux' });
  assert.equal(bad.status, 401);
  assert.ok(bad.body.includes('auth-error'));
  const ok = await form('/login', { username: 'testeur un', password: 'motdepasse1', next: '/challenge/03' });
  assert.equal(ok.status, 302);
  assert.equal(ok.location, '/challenge/03');
  assert.match(ok.cookie, /^dojo_session=/);
  const evil = await form('/login', { username: 'Testeur Un', password: 'motdepasse1', next: 'https://evil.example' });
  assert.equal(evil.location, '/dashboard', 'redirection ouverte refusée');
  const out = await form('/logout', {}, ok.cookie);
  assert.equal(out.status, 302);
  assert.match(cookiesOf(out.res).join(';'), /dojo_session=;/);
});

test('pages protégées : redirection vers /login sans session, 401 JSON pour /_dojo', async () => {
  const dash = await dojo('GET', '/dashboard', null, '');
  assert.equal(dash.status, 302);
  assert.match(dash.headers.get('location'), /^\/login\?next=/);
  const ch = await dojo('GET', '/challenge/01', null, '');
  assert.equal(ch.status, 302);
  const st = await dojo('GET', '/_dojo/state/01', null, '');
  assert.equal(st.status, 401);
  for (const p of ['/', '/login', '/signup', '/guide', '/leaderboard']) {
    assert.equal((await dojo('GET', p, null, '')).status, 200, p + ' est public');
  }
});

test('profil hérité sans mot de passe : réclamé à la première connexion', async () => {
  const raw = JSON.parse(fs.readFileSync(process.env.DOJO_PROGRESS_FILE, 'utf8'));
  raw.users['legacy'] = { name: 'Legacy Player', createdAt: 1, challenges: {} };
  fs.writeFileSync(process.env.DOJO_PROGRESS_FILE, JSON.stringify(raw));
  // Le store en mémoire n'a pas relu le fichier : on passe par l'API de création qui détecte le pseudo existant.
  const { store } = require('../server');
  store.data.users['legacy'] = { name: 'Legacy Player', createdAt: 1, lang: 'fr', challenges: {} };
  CHALLENGES.forEach((c) => { store.data.users['legacy'].challenges[c.id] = store.blankEntry(); });
  const claim = await form('/login', { username: 'Legacy Player', password: 'nouveaumdp1' });
  assert.equal(claim.status, 302, 'première connexion fixe le mot de passe');
  const again = await form('/login', { username: 'Legacy Player', password: 'autrechose1' });
  assert.equal(again.status, 401, 'le mot de passe est désormais exigé');
});

/* ---------------------------------------------------------------- */
/* Pages et langues                                                 */
/* ---------------------------------------------------------------- */

test('landing, tableau de bord, profil, guide, classement : rendu sans marqueur oublié', async () => {
  const landing = await dojo('GET', '/', null, '');
  assert.ok(landing.body.includes('/signup'));
  assert.ok(landing.body.includes('lp-hero'));
  const dash = await dojo('GET', '/dashboard');
  assert.equal(dash.status, 200);
  CHALLENGES.forEach((c) => assert.ok(dash.body.includes('href="/challenge/' + c.id + '"'), 'carte ' + c.id));
  assert.ok(dash.body.includes('Parcours 1'));
  for (const page of [landing, dash, await dojo('GET', '/profile'), await dojo('GET', '/guide'), await dojo('GET', '/leaderboard')]) {
    assert.ok(!/\{\{(t:[\w.-]+|[A-Z_]+)\}\}/.test(page.body), 'aucun marqueur non remplacé');
  }
  const profile = await dojo('GET', '/profile');
  assert.ok(profile.body.includes('Règle du jeu'));
  assert.ok(profile.body.includes('id="lang-select"'));
  assert.ok(!profile.body.includes('npm run reset'), 'aucune consigne de développeur sur la page joueur');
});

test('langue : cookie via /lang, préférence du compte, contenu anglais servi', async () => {
  const sw = await dojo('GET', '/lang/en?next=/dashboard');
  assert.equal(sw.status, 302);
  assert.match(cookiesOf(sw.headers && { headers: sw.headers, ...sw }).join(';') || sw.headers.get('set-cookie'), /dojo_lang=en/);
  const en = await dojo('GET', '/dashboard', null, COOKIE + '; dojo_lang=en');
  assert.ok(en.body.includes('Track 1'), 'parcours en anglais');
  assert.ok(en.body.includes('The 18 challenges'));
  assert.ok(en.body.includes('lang="en"'));
  const ch = await dojo('GET', '/challenge/01', null, COOKIE + '; dojo_lang=en');
  assert.ok(ch.body.includes('Why this challenge'));
  assert.ok(ch.body.includes('Release promotion') || ch.body.includes('Promot'), 'titre traduit');
  const guide = await dojo('GET', '/guide', null, 'dojo_lang=en');
  assert.ok(guide.body.includes('DevTools guide'));
  // La préférence du compte suit le dernier choix, et est réinjectée à la connexion.
  const back = await form('/login', { username: 'Testeur Un', password: 'motdepasse1' });
  assert.match(cookiesOf(back.res).join(';'), /dojo_lang=en/);
  await dojo('POST', '/_dojo/account/lang', { lang: 'fr' });
  const fr = await dojo('GET', '/dashboard', null, COOKIE + '; dojo_lang=fr');
  assert.ok(fr.body.includes('Les 18 défis'));
});

test('chaque page de défi se rend avec son contexte pédagogique, en FR et en EN', async () => {
  for (const c of CHALLENGES) {
    const fr = await dojo('GET', '/challenge/' + c.id, null, COOKIE + '; dojo_lang=fr');
    assert.equal(fr.status, 200, 'défi ' + c.id);
    assert.ok(fr.body.includes('Pourquoi ce défi'), c.id + ' : intro');
    assert.ok(fr.body.includes('Valider la commande'), c.id + ' : bouton');
    assert.ok(fr.body.includes('/c/' + c.id + '.js'), c.id + ' : script');
    assert.ok(!/\{\{(t:[\w.-]+|[A-Z_]+)\}\}/.test(fr.body), c.id + ' : marqueurs');
    const en = await dojo('GET', '/challenge/' + c.id, null, COOKIE + '; dojo_lang=en');
    assert.ok(en.body.includes('Why this challenge'), c.id + ' : intro EN');
    assert.ok(!en.body.includes('Pourquoi ce défi'), c.id + ' : pas de FR résiduel dans le chrome');
    const js = await fetch(base + '/c/' + c.id + '.js');
    assert.equal(js.status, 200, c.id + ' : fichier JS servi');
  }
});

test('les corrigés ne sont pas servis comme fichiers statiques', async () => {
  for (const p of ['/solutions/01.md', '/solutions/en/01.md', '/static/../solutions/01.md', '/c/../../solutions/01.md']) {
    const res = await fetch(base + p);
    assert.notEqual(res.status, 200, p);
  }
});

/* ---------------------------------------------------------------- */
/* API de l'exercice                                                */
/* ---------------------------------------------------------------- */

test('la requête cible est acceptée pour chaque défi (avec jeton quand requis) et créditée', async () => {
  for (const c of CHALLENGES) {
    const headers = c.requiresToken ? { 'X-Api-Token': SESSION_TOKEN } : {};
    const r = await solve(c.id, { headers });
    assert.equal(r.status, 200, 'défi ' + c.id + ' : ' + JSON.stringify(r.json));
    assert.equal(r.json.credited, true);
  }
  const st = await dojo('GET', '/_dojo/state/01');
  assert.equal(st.body.solved, true);
  assert.ok(st.body.debrief && st.body.debrief.cause, 'le débrief est disponible après résolution');
  const profile = await dojo('GET', '/profile');
  assert.ok(profile.body.includes('18<span class="score-d">/18'));
  await dojo('POST', '/_dojo/reset');
  assert.equal((await dojo('GET', '/_dojo/state/01')).body.solved, false);
});

test('sans session : la requête est évaluée mais pas créditée', async () => {
  const r = await solve('02', { cookie: '' });
  assert.equal(r.status, 200);
  assert.equal(r.json.credited, false);
  assert.equal((await dojo('GET', '/_dojo/state/02')).body.solved, false);
});

test('les champs supplémentaires sont tolérés', async () => {
  const r = await solve('03', { body: JSON.stringify({ challengeId: '03', action: 'validate', extra: 1, nested: { a: [1, 2] } }) });
  assert.equal(r.status, 200);
  await dojo('POST', '/_dojo/reset/03');
});

test('mauvais verbe : 405 avec le verbe reçu, message dans la langue du compte', async () => {
  const r = await solve('09', { method: 'GET' });
  assert.equal(r.status, 405);
  assert.match(r.json.error, /Verbe reçu : GET/);
  const en = await fetch(solveUrl('09'), { headers: { Cookie: COOKIE + '; dojo_lang=en' } });
  assert.match((await en.json()).error, /Verb received: GET/);
});

test('preflight OPTIONS : 405 qui nomme le preflight CORS et l\'origine', async () => {
  const res = await fetch(solveUrl('15'), {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:3000', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type', Cookie: COOKIE }
  });
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('access-control-allow-origin'), null, 'aucun en-tête CORS');
  const j = await res.json();
  assert.match(j.error, /preflight/);
  assert.match(j.error, /localhost:3000/);
  assert.equal(j.received.origin, 'http://localhost:3000');
});

test('Content-Type absent ou text/plain : 415', async () => {
  const noCt = await fetch(solveUrl('10'), { method: 'POST', body: JSON.stringify({ challengeId: '10', action: 'validate' }), headers: { Cookie: COOKIE } });
  // fetch ajoute text/plain quand le corps est une chaîne : c'est précisément le bug du défi 10.
  assert.equal(noCt.status, 415);
  const j = await noCt.json();
  assert.match(j.error, /text\/plain/);
});

test('corps « [object Object] » : 400, et le journal du serveur garde la requête', async () => {
  const r = await solve('11', { body: '[object Object]' });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /\[object Object\]/);
  assert.equal(r.json.received.bodyBytes, 15);
  const st = await dojo('GET', '/_dojo/state/11');
  assert.ok(Array.isArray(st.body.log) && st.body.log.length >= 1);
  assert.equal(st.body.log[0].bodyPreview, '[object Object]');
  assert.equal(st.body.log[0].code, 400);
  assert.equal(st.body.log[0].method, 'POST');
});

test('corps vide, JSON non-objet, champs manquants ou incorrects : 400 / 422', async () => {
  assert.equal((await solve('01', { body: '' })).status, 400);
  assert.equal((await solve('01', { body: '[1,2]' })).status, 400);
  assert.equal((await solve('01', { body: '{}' })).status, 422);
  assert.equal((await solve('01', { body: '{"challengeId":"02","action":"validate"}' })).status, 422);
  assert.equal((await solve('01', { body: '{"challengeId":"01"}' })).status, 422);
  assert.equal((await solve('01', { body: '{"challengeId":"01","action":"go"}' })).status, 422);
});

test('défis à jeton : 401 sans en-tête, 403 avec un mauvais jeton, 200 avec le bon', async () => {
  for (const id of ['12', '16']) {
    assert.equal((await solve(id)).status, 401, id + ' sans jeton');
    const bad = await solve(id, { headers: { 'X-Api-Token': 'ops_7c1e4b0a9d2f6e8c3b5a1f0d' } });
    assert.equal(bad.status, 403, id + ' mauvais jeton');
    assert.match(bad.json.error, /1f0d/);
    assert.equal((await solve(id, { headers: { 'X-Api-Token': SESSION_TOKEN } })).status, 200, id + ' bon jeton');
  }
  await dojo('POST', '/_dojo/reset');
});

test('/api/session délivre le jeton de la session ; routes inconnues en 404', async () => {
  const j = await (await fetch(base + '/api/session')).json();
  assert.equal(j.token, SESSION_TOKEN);
  assert.equal((await solve('99')).status, 404);
  assert.equal((await fetch(base + '/api/nope')).status, 404);
});

/* ---------------------------------------------------------------- */
/* Couche pédagogique                                               */
/* ---------------------------------------------------------------- */

test('indices : trois niveaux, compteur persistant, jamais au-delà de 3, traduits', async () => {
  const h1 = await dojo('POST', '/_dojo/hint/07?level=1');
  assert.equal(h1.body.level, 1);
  assert.equal(h1.body.hints, 1);
  const h3 = await dojo('POST', '/_dojo/hint/07?level=3');
  assert.equal(h3.body.hints, 3);
  const h9 = await dojo('POST', '/_dojo/hint/07?level=9');
  assert.equal(h9.body.level, 3);
  const en = await dojo('POST', '/_dojo/hint/07?level=1', null, COOKIE + '; dojo_lang=en');
  assert.notEqual(en.body.text, h1.body.text, 'indice traduit');
  assert.equal((await dojo('GET', '/_dojo/state/07')).body.hints, 3);
  await dojo('POST', '/_dojo/reset/07');
});

test('corrigé : refusé avant résolution, accessible après « je sèche » ou après résolution, version anglaise', async () => {
  assert.equal((await dojo('GET', '/_dojo/solution/08')).status, 403);
  assert.equal((await dojo('GET', '/_dojo/state/08')).body.debrief, null);
  const rev = await dojo('POST', '/_dojo/reveal/08');
  assert.equal(rev.body.revealed, true);
  assert.ok(rev.body.html.includes('<h1'), 'le corrigé est rendu en HTML');
  assert.equal(rev.body.debrief.quiz.choices.length, 4);
  assert.equal(rev.body.debrief.quiz.answer, null, 'la bonne réponse n\'est pas divulguée');
  const fr = await dojo('GET', '/_dojo/solution/08');
  assert.equal(fr.status, 200);
  assert.ok(fr.body.html.includes('Diagnostic pas à pas'));
  const en = await dojo('GET', '/_dojo/solution/08', null, COOKIE + '; dojo_lang=en');
  assert.ok(en.body.html.includes('Step-by-step diagnosis'));
  await dojo('POST', '/_dojo/reset/08');
  await solve('08');
  assert.equal((await dojo('GET', '/_dojo/solution/08')).status, 200);
  await dojo('POST', '/_dojo/reset/08');
});

test('quiz : fermé avant le débrief, bonus complet au premier essai, réduit ensuite', async () => {
  assert.equal((await dojo('POST', '/_dojo/quiz/05', { choice: 0 })).status, 403);
  await solve('05');
  const ch = CHALLENGES.find((c) => c.id === '05');
  const wrong = (ch.quiz.answer + 1) % 4;
  const w = await dojo('POST', '/_dojo/quiz/05', { choice: wrong });
  assert.equal(w.body.correct, false);
  assert.equal(w.body.tries, 1);
  assert.equal(w.body.answer, null);
  const ok = await dojo('POST', '/_dojo/quiz/05', { choice: ch.quiz.answer });
  assert.equal(ok.body.correct, true);
  assert.equal(ok.body.tries, 2);
  assert.ok(ok.body.why);
  assert.equal(ok.body.score, 200 + 10, 'base 2★ + bonus réduit');
  await dojo('POST', '/_dojo/reset/05');
  await solve('01');
  const first = await dojo('POST', '/_dojo/quiz/01', { choice: CHALLENGES[0].quiz.answer });
  assert.equal(first.body.score, 100 + 25, 'base 1★ + bonus complet');
  await dojo('POST', '/_dojo/reset/01');
});

test('score : indices et corrigé ouvert réduisent les points', async () => {
  await dojo('POST', '/_dojo/hint/10?level=2');
  await dojo('POST', '/_dojo/reveal/10');
  await solve('10');
  // base 300, −20 % (2 indices) = 240, −50 % de la base (150) = 90
  assert.equal((await dojo('GET', '/_dojo/state/10')).body.score, 90);
  await dojo('POST', '/_dojo/reset/10');
});

/* ---------------------------------------------------------------- */
/* Comptes multiples, classement, export, suppression               */
/* ---------------------------------------------------------------- */

test('deux comptes : progressions séparées, classement, export, suppression de son propre compte', async () => {
  const alice = await signup('Alice Test', 'alicealice1', 'fr');
  const res = await fetch(solveUrl('02'), {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: alice.cookie },
    body: JSON.stringify({ challengeId: '02', action: 'validate' })
  });
  assert.equal(res.status, 200);
  assert.equal((await dojo('GET', '/_dojo/state/02', null, alice.cookie)).body.solved, true);
  assert.equal((await dojo('GET', '/_dojo/state/02')).body.solved, false, 'le compte principal n\'est pas crédité');

  const board = await dojo('GET', '/leaderboard', null, '');
  assert.ok(board.body.indexOf('Alice Test') < board.body.indexOf('Testeur Un'), 'Alice devant');

  const exp = await fetch(base + '/_dojo/export', { headers: { Cookie: alice.cookie } });
  assert.match(exp.headers.get('content-disposition'), /attachment/);
  const j = await exp.json();
  assert.equal(j.profile.name, 'Alice Test');
  assert.equal(Object.keys(j.challenges).length, CHALLENGES.length);

  const del = await dojo('POST', '/_dojo/account/delete', null, alice.cookie);
  assert.equal(del.body.ok, true);
  assert.equal((await dojo('GET', '/_dojo/state/02', null, alice.cookie)).status, 401, 'session invalidée');
  const login = await form('/login', { username: 'Alice Test', password: 'alicealice1' });
  assert.equal(login.status, 401, 'compte supprimé');
});

test('progress.json est au format v3 avec des mots de passe hachés', async () => {
  const raw = JSON.parse(fs.readFileSync(process.env.DOJO_PROGRESS_FILE, 'utf8'));
  assert.equal(raw.version, 3);
  assert.ok(raw.secret && raw.secret.length >= 32);
  const u = Object.values(raw.users).find((x) => x.name === 'Testeur Un');
  assert.ok(u.passwordHash && u.salt);
  assert.ok(!JSON.stringify(raw).includes('motdepasse1'), 'aucun mot de passe en clair');
});

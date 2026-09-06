'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FR = require('./data/challenges');
const { CHALLENGES, BY_ID, IDS, FAMILY_ORDER, RECOMMENDED } = FR;
const { createStore } = require('./lib/store');
const markdown = require('./lib/markdown');
const i18n = require('./lib/i18n');

let EN = { FAMILIES: {}, CHALLENGES: {} };
try { EN = require('./data/challenges.en'); } catch (e) { /* traduction absente : repli sur le français */ }

const app = express();
const ROOT = __dirname;
const PORT = parseInt(process.env.PORT, 10) || 3000;
// Second port servant la même application : nécessaire au défi 15 (CORS) en local.
const ALT_PORT = process.env.DOJO_ALT_PORT === '0' ? 0 : (parseInt(process.env.DOJO_ALT_PORT, 10) || PORT + 1);
// Origine du « réplica » utilisé par le défi 15 derrière un reverse proxy. Vide : hôte:port+1.
const ALT_ORIGIN = process.env.DOJO_ALT_ORIGIN || '';
const PROGRESS_FILE = process.env.DOJO_PROGRESS_FILE || path.join(ROOT, 'progress.json');
const SESSION_TOKEN = 'ops_' + crypto.randomBytes(12).toString('hex');
const SESSION_STARTED = new Date().toISOString();

const store = createStore({ file: PROGRESS_FILE, ids: IDS, challenges: CHALLENGES });
const lastAttempt = {}; // clé : slug + '/' + id
const serverLog = {};   // clé : slug + '/' + id : dernières requêtes reçues (miroir du terminal)
const LOG_KEEP = 8;

const t = i18n.t;
const esc = markdown.esc;

/* ------------------------------------------------------------------ */
/* Contenu pédagogique dans la langue demandée                        */
/* ------------------------------------------------------------------ */

const TEXT_FIELDS = ['title', 'subtitle', 'intro', 'symptom', 'learn', 'hints'];

function challengeIn(id, lang) {
  const c = BY_ID.get(id);
  if (!c) return null;
  if (lang !== 'en' || !EN.CHALLENGES[id]) return c;
  const e = EN.CHALLENGES[id];
  const out = Object.assign({}, c);
  TEXT_FIELDS.forEach((k) => { if (e[k] !== undefined) out[k] = e[k]; });
  if (e.debrief) out.debrief = Object.assign({}, c.debrief, e.debrief);
  if (e.quiz) out.quiz = Object.assign({}, c.quiz, { question: e.quiz.question, choices: e.quiz.choices, why: e.quiz.why });
  return out;
}

function familiesIn(lang) {
  const out = {};
  FAMILY_ORDER.forEach((k) => {
    out[k] = Object.assign({}, FR.FAMILIES[k], lang === 'en' && EN.FAMILIES[k] ? EN.FAMILIES[k] : {});
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Journal console                                                    */
/* ------------------------------------------------------------------ */

const ESC = '\x1b[';
const C = {
  dim: (s) => ESC + '2m' + s + ESC + '0m',
  bold: (s) => ESC + '1m' + s + ESC + '0m',
  green: (s) => ESC + '32m' + s + ESC + '0m',
  red: (s) => ESC + '31m' + s + ESC + '0m',
  yellow: (s) => ESC + '33m' + s + ESC + '0m',
  cyan: (s) => ESC + '36m' + s + ESC + '0m'
};
const QUIET = !!process.env.DOJO_QUIET;
function out(s) { if (!QUIET) console.log(s); }

const LOGGED_HEADERS = [
  'content-type', 'content-length', 'x-api-token', 'authorization',
  'accept', 'x-requested-with', 'origin', 'referer', 'sec-fetch-mode', 'sec-fetch-dest',
  'access-control-request-method', 'access-control-request-headers'
];

function collectRawBody(req, res, next) {
  let raw = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 1000000) { raw = raw.slice(0, 1000000); req.destroy(); }
  });
  req.on('end', () => { req.rawBody = raw; next(); });
  req.on('error', () => { req.rawBody = raw; next(); });
}

function logApiRequest(req, res, next) {
  const time = new Date().toTimeString().slice(0, 8);
  const bar = '─'.repeat(70);
  const lines = [];
  const who = store.getUser(store.resolve(req));
  lines.push(C.dim('  ┌' + bar));
  lines.push('  ' + C.dim('│ ') + C.dim('[' + time + '] ') + C.bold(C.cyan(req.method)) + ' ' + C.bold(req.originalUrl) +
    C.dim('   port ' + req.socket.localPort + (who ? '  ·  ' + who.name : '  ·  (sans session)')));
  lines.push(C.dim('  ├' + bar));
  LOGGED_HEADERS.forEach((h) => {
    if (req.headers[h] !== undefined) lines.push('  ' + C.dim('│ ') + h.padEnd(16) + C.dim(': ') + req.headers[h]);
  });
  if (req.headers['x-api-token'] === undefined) lines.push('  ' + C.dim('│ ') + 'x-api-token'.padEnd(16) + C.dim(': ') + C.dim('(absent)'));
  if (req.headers['content-type'] === undefined) lines.push('  ' + C.dim('│ ') + 'content-type'.padEnd(16) + C.dim(': ') + C.dim('(absent)'));
  const raw = req.rawBody || '';
  const size = Buffer.byteLength(raw, 'utf8');
  lines.push('  ' + C.dim('│ ') + 'body brut'.padEnd(16) + C.dim(': ') +
    (size === 0 ? C.dim('(vide)') : JSON.stringify(raw.slice(0, 400))) + ' ' + C.dim('[' + size + ' octets]'));
  out(lines.join('\n'));
  next();
}

function logVerdict(code, ok, message) {
  const tag = ok ? C.green('  └─> ' + code + '  ') : C.red('  └─> ' + code + '  ');
  out(tag + (ok ? C.green(message) : C.yellow(message)) + '\n');
}

/* ------------------------------------------------------------------ */
/* Rendu                                                              */
/* ------------------------------------------------------------------ */

function readFile() {
  return fs.readFileSync(path.join.apply(path, [ROOT].concat(Array.prototype.slice.call(arguments))), 'utf8');
}
function hasView(name) { return fs.existsSync(path.join(ROOT, 'views', name)); }

function stars(n) { return '★'.repeat(n) + '☆'.repeat(3 - n); }

function section(src, name) {
  const m = src.match(new RegExp('<!--\\s*' + name + '\\s*-->([\\s\\S]*?)<!--\\s*/' + name + '\\s*-->'));
  return m ? m[1] : '';
}

function fmtDuration(ms, lang) {
  if (ms == null) return t(lang, 'g.none');
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return h + ' ' + t(lang, 'g.hours') + ' ' + String(m).padStart(2, '0');
  return (m > 0 ? m + ' ' + t(lang, 'g.min') + ' ' : '') + (s % 60) + ' ' + t(lang, 'g.seconds');
}

function fmtInt(n, lang) { return Number(n || 0).toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR'); }

function beltLabel(s, lang) {
  return t(lang, 'belt.' + s.beltKey) + (s.dan ? ' ' + t(lang, 'belt.dan') : '');
}

function noStore(res) {
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
}

function safeNext(v) {
  v = String(v || '');
  return /^\/(?!\/)[^\s]*$/.test(v) ? v : '/dashboard';
}

/* Contexte d'une requête : compte (session) et langue. */
function ctxOf(req) {
  const slug = store.readSession(req);
  const user = store.getUser(slug);
  const lang = i18n.pickLang(req, user && user.lang);
  return { slug: user ? slug : null, user, lang };
}

function render(res, view, vars, lang) {
  res.type('html').send(i18n.fill(readFile('views', view), vars, lang));
}

function langToggle(lang, currentPath) {
  const next = encodeURIComponent(currentPath || '/');
  return ['fr', 'en'].map((l) =>
    '<a class="lang' + (l === lang ? ' is-on' : '') + '" href="/lang/' + l + '?next=' + next + '" hreflang="' + l + '">' + l.toUpperCase() + '</a>'
  ).join('');
}

function navHtml(ctx, active, currentPath) {
  const lang = ctx.lang;
  const link = (href, label, key) => '<a href="' + href + '"' + (active === key ? ' class="active"' : '') + '>' + label + '</a>';
  const lines = ['<nav class="topnav">', '  <a class="brand" href="/">Debug <b>Frontend</b></a>', '  <div class="topnav-links">'];
  if (ctx.user) {
    lines.push('    ' + link('/dashboard', t(lang, 'nav.dashboard'), 'home'));
    lines.push('    ' + link('/profile', t(lang, 'nav.profile'), 'profile'));
  }
  lines.push('    ' + link('/guide', t(lang, 'nav.guide'), 'guide'));
  lines.push('    ' + link('/leaderboard', t(lang, 'nav.leaderboard'), 'board'));
  lines.push('  </div>');
  lines.push('  <div class="topnav-auth">');
  lines.push('    <span class="lang-switch">' + langToggle(lang, currentPath) + '</span>');
  if (ctx.user) {
    const s = store.summary(ctx.slug);
    lines.push('    <a class="who" href="/profile" style="--belt:' + s.beltColor + '" title="' + esc(t(lang, 'nav.belt', { belt: beltLabel(s, lang) })) + '">' +
      '<span class="who-belt"></span><span class="who-name">' + esc(s.name) + '</span></a>');
    lines.push('    <form method="post" action="/logout" class="logout-form"><button class="btn btn-ghost" type="submit">' + t(lang, 'nav.logout') + '</button></form>');
  } else {
    lines.push('    <a class="btn btn-ghost" href="/login">' + t(lang, 'nav.login') + '</a>');
    lines.push('    <a class="btn btn-primary" href="/signup">' + t(lang, 'nav.signup') + '</a>');
  }
  lines.push('  </div>');
  lines.push('</nav>');
  return lines.join('\n');
}

function beltHtml(s, lang) {
  return '<span class="belt" style="--belt:' + s.beltColor + '"><i></i>' + esc(beltLabel(s, lang)) + '</span>';
}

function nextRecommended(slug, afterId) {
  const order = RECOMMENDED;
  const start = afterId ? order.indexOf(afterId) + 1 : 0;
  for (let k = 0; k < order.length; k++) {
    const id = order[(start + k) % order.length];
    if (id === afterId) continue;
    if (!store.entry(slug, id).solved) return id;
  }
  return null;
}

function entryState(e) {
  if (e.solved) return e.quiz && e.quiz.correct ? 'done' : 'half';
  if (e.revealed) return 'seen';
  return 'todo';
}

function cardHtml(c, e, isNext, lang) {
  const state = entryState(e);
  const cls = ['cc'];
  if (e.solved) cls.push('is-done');
  else if (e.revealed) cls.push('is-seen');
  if (isNext) cls.push('is-next');
  const badge = {
    done: '<span class="badge badge-ok">' + t(lang, 'card.solved') + '</span>',
    half: '<span class="badge badge-half">' + t(lang, 'card.half') + '</span>',
    seen: '<span class="badge badge-seen">' + t(lang, 'card.seen') + '</span>',
    todo: '<span class="badge badge-todo">' + t(lang, 'card.todo') + '</span>'
  }[state];
  const nh = e.hints || 0;
  const hintsTxt = t(lang, nh > 1 ? 'card.hints' : 'card.hint', { n: nh });
  const meta = e.solved
    ? fmtDuration(e.durationMs, lang) + ' · ' + hintsTxt + ' · ' + fmtInt(store.scoreEntry(e, c), lang) + ' ' + t(lang, 'g.pts')
    : (e.attempts ? t(lang, e.attempts > 1 ? 'card.attempts' : 'card.attempt', { n: e.attempts }) : t(lang, 'card.never')) + ' · ' + hintsTxt;
  const tags = c.tabs.map((x) => '<span class="tag">' + esc(x) + '</span>').join('') +
    (c.minified ? '<span class="tag tag-min">' + t(lang, 'card.minified') + '</span>' : '') +
    (c.requiresToken ? '<span class="tag tag-token">' + t(lang, 'card.token') + '</span>' : '');
  return [
    '<article class="' + cls.join(' ') + '" data-id="' + c.id + '" data-stars="' + c.stars + '" data-state="' + state + '" data-recommended="' + esc(t(lang, 'card.recommended')) + '">',
    '  <a class="cc-link" href="/challenge/' + c.id + '">',
    '    <div class="cc-top"><span class="cc-id">' + c.id + '</span><span class="cc-stars" title="' + t(lang, 'card.difficulty') + '">' + stars(c.stars) + '</span><span class="cc-min">' + t(lang, 'card.minutes', { n: c.minutes }) + '</span></div>',
    '    <h3>' + esc(c.title) + '</h3>',
    '    <p class="cc-sub">' + esc(c.subtitle) + '</p>',
    '    <div class="cc-tags">' + tags + '</div>',
    '  </a>',
    '  <div class="cc-foot">' + badge + '<span class="cc-meta">' + meta + '</span>',
    '    <button class="cc-reset" data-id="' + c.id + '" title="' + t(lang, 'card.reset.title') + '">' + t(lang, 'card.reset') + '</button>',
    '  </div>',
    '</article>'
  ].join('\n');
}

function familiesHtml(slug, nextId, lang) {
  const fams = familiesIn(lang);
  return FAMILY_ORDER.map((key, idx) => {
    const f = fams[key];
    const list = CHALLENGES.filter((c) => c.family === key).sort((a, b) => a.stars - b.stars || a.id.localeCompare(b.id));
    const done = list.filter((c) => store.entry(slug, c.id).solved).length;
    const pct = list.length ? Math.round((done / list.length) * 100) : 0;
    return [
      '<section class="family" id="family-' + key + '" data-family="' + key + '">',
      '  <header class="family-head">',
      '    <div class="family-text">',
      '      <span class="family-kicker">' + t(lang, 'fam.track', { n: idx + 1 }) + ' · ' + esc(f.short) + '</span>',
      '      <h2>' + esc(f.name) + '</h2>',
      '      <p class="family-desc">' + esc(f.description) + '</p>',
      '      <p class="family-method"><strong>' + t(lang, 'fam.method') + '</strong> ' + esc(f.method) + '</p>',
      '    </div>',
      '    <div class="family-progress"><span class="family-count">' + done + '<small>/' + list.length + '</small></span><div class="bar"><i style="width:' + pct + '%"></i></div></div>',
      '  </header>',
      '  <div class="grid-cards">',
      list.map((c) => cardHtml(challengeIn(c.id, lang), store.entry(slug, c.id), c.id === nextId, lang)).join('\n'),
      '  </div>',
      '</section>'
    ].join('\n');
  }).join('\n');
}

function boardTable(slug, lang) {
  const rows = store.leaderboard();
  const th = ['#', 'board.player', 'board.belt', 'board.solved', 'board.points', 'board.quiz', 'board.hints', 'board.revealed', 'board.time']
    .map((k) => '<th>' + (k === '#' ? '#' : t(lang, k)) + '</th>').join('');
  return '<div class="table-wrap"><table class="board"><thead><tr>' + th + '</tr></thead><tbody>' +
    rows.map((r, i) => '<tr' + (r.slug === slug ? ' class="me"' : '') + '><td>' + (i + 1) + '</td><td>' + esc(r.name) + '</td><td>' + beltHtml(r, lang) +
      '</td><td>' + r.done + '/' + r.total + '</td><td>' + fmtInt(r.score, lang) + '</td><td>' + r.understood + '</td><td>' + r.hints +
      '</td><td>' + r.revealed + '</td><td>' + (r.done ? fmtDuration(r.timeMs, lang) : t(lang, 'g.none')) + '</td></tr>').join('') +
    '</tbody></table></div>';
}

/* ------------------------------------------------------------------ */
/* Fichiers statiques                                                 */
/* ------------------------------------------------------------------ */

const staticOpts = { etag: false, lastModified: false, setHeaders: (res) => res.setHeader('Cache-Control', 'no-store') };
app.use('/static/img', express.static(path.join(ROOT, 'public', 'static', 'img'), { maxAge: '7d' }));
app.use('/static', express.static(path.join(ROOT, 'public', 'static'), staticOpts));
app.use('/c', express.static(path.join(ROOT, 'public', 'c'), staticOpts));
app.get('/favicon.ico', (req, res) => res.status(204).end());

/* ------------------------------------------------------------------ */
/* Langue, comptes                                                    */
/* ------------------------------------------------------------------ */

const forms = express.urlencoded({ extended: false, limit: '10kb' });

app.get('/lang/:code', (req, res) => {
  const lang = i18n.normLang(req.params.code);
  const next = safeNext(req.query.next);
  if (!lang) return res.redirect(next);
  res.setHeader('Set-Cookie', i18n.cookieHeader(lang));
  const slug = store.readSession(req);
  if (slug) store.setLang(slug, lang);
  res.redirect(next === '/dashboard' && !slug ? '/' : next);
});

function authPage(req, res, view, extra) {
  const ctx = ctxOf(req);
  noStore(res);
  const vars = Object.assign({
    NAV: navHtml(ctx, null, req.originalUrl), LANG: ctx.lang, ERROR: '', USERNAME: '',
    NEXT: esc(safeNext(req.query.next || (req.body && req.body.next))),
    LANG_FR_SELECTED: ctx.lang === 'fr' ? 'selected' : '', LANG_EN_SELECTED: ctx.lang === 'en' ? 'selected' : '',
    YEAR: new Date().getFullYear()
  }, extra || {});
  if (vars.ERROR_KEY) vars.ERROR = '<p class="auth-error" role="alert">' + t(ctx.lang, vars.ERROR_KEY) + '</p>';
  render(res, view, vars, ctx.lang);
}

app.get('/login', (req, res) => {
  if (store.readSession(req)) return res.redirect('/dashboard');
  authPage(req, res, 'login.html');
});

app.post('/login', forms, (req, res) => {
  const r = store.login(req.body.username, req.body.password);
  if (!r.ok) {
    res.status(401);
    return authPage(req, res, 'login.html', { ERROR_KEY: r.error === 'password' ? 'auth.err.password' : 'auth.err.login', USERNAME: esc(req.body.username || '') });
  }
  const user = store.getUser(r.slug);
  res.setHeader('Set-Cookie', [store.sessionCookie(r.slug), i18n.cookieHeader(user.lang || 'fr')]);
  res.redirect(safeNext(req.body.next));
});

app.get('/signup', (req, res) => {
  if (store.readSession(req)) return res.redirect('/dashboard');
  authPage(req, res, 'signup.html');
});

app.post('/signup', forms, (req, res) => {
  const lang = i18n.normLang(req.body.lang) || ctxOf(req).lang;
  const extra = { USERNAME: esc(req.body.username || ''), LANG_FR_SELECTED: lang === 'fr' ? 'selected' : '', LANG_EN_SELECTED: lang === 'en' ? 'selected' : '' };
  if (String(req.body.password || '') !== String(req.body.password2 || '')) {
    res.status(400);
    return authPage(req, res, 'signup.html', Object.assign({ ERROR_KEY: 'auth.err.match' }, extra));
  }
  const r = store.createAccount(req.body.username, req.body.password, lang);
  if (!r.ok) {
    res.status(400);
    return authPage(req, res, 'signup.html', Object.assign({ ERROR_KEY: 'auth.err.' + r.error }, extra));
  }
  res.setHeader('Set-Cookie', [store.sessionCookie(r.slug), i18n.cookieHeader(lang)]);
  res.redirect(safeNext(req.body.next));
});

app.post('/logout', forms, (req, res) => {
  res.setHeader('Set-Cookie', store.clearSessionCookie());
  res.redirect('/');
});

function requireAuth(req, res, next) {
  const slug = store.readSession(req);
  if (slug) { req.slug = slug; return next(); }
  if (req.baseUrl === '/_dojo' || req.xhr || (req.headers.accept || '').indexOf('application/json') !== -1) {
    return res.status(401).json({ ok: false, error: t(ctxOf(req).lang, 'dojo.auth') });
  }
  res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
}

/* ------------------------------------------------------------------ */
/* Pages                                                              */
/* ------------------------------------------------------------------ */

app.get('/', (req, res) => {
  const ctx = ctxOf(req);
  noStore(res);
  if (!hasView('landing.html')) return res.redirect(ctx.user ? '/dashboard' : '/login');
  render(res, 'landing.html', { NAV: navHtml(ctx, 'landing', '/'), LANG: ctx.lang, YEAR: new Date().getFullYear() }, ctx.lang);
});

function dashboardVars(ctx, active, currentPath) {
  const s = store.summary(ctx.slug);
  const nextId = nextRecommended(ctx.slug, null) || '01';
  const lang = ctx.lang;
  return {
    NAV: navHtml(ctx, active, currentPath),
    LANG: lang,
    PLAYER_NAME: esc(s.name),
    BELT: esc(beltLabel(s, lang)),
    BELT_COLOR: s.beltColor,
    DONE: s.done, TOTAL: s.total, SCORE: fmtInt(s.score, lang), UNDERSTOOD: s.understood, HINTS: s.hints,
    TIME: s.done ? fmtDuration(s.timeMs, lang) : t(lang, 'g.none'),
    NEXT_ID: nextId, NEXT_TITLE: esc(challengeIn(nextId, lang).title),
    LANG_FR_SELECTED: lang === 'fr' ? 'selected' : '', LANG_EN_SELECTED: lang === 'en' ? 'selected' : '',
    FOOT: t(lang, 'dash.foot', { name: esc(s.name), done: s.done, total: s.total, score: fmtInt(s.score, lang), belt: esc(beltLabel(s, lang)) }),
    FAMILIES: familiesHtml(ctx.slug, nextId, lang)
  };
}

app.get('/dashboard', requireAuth, (req, res) => {
  const ctx = ctxOf(req);
  noStore(res);
  store.setActive(ctx.slug);
  render(res, 'index.html', dashboardVars(ctx, 'home', '/dashboard'), ctx.lang);
});

app.get('/profile', requireAuth, (req, res) => {
  const ctx = ctxOf(req);
  noStore(res);
  render(res, 'profile.html', dashboardVars(ctx, 'profile', '/profile'), ctx.lang);
});

app.get('/leaderboard', (req, res) => {
  const ctx = ctxOf(req);
  noStore(res);
  const rows = store.leaderboard();
  const content = '<h1>' + t(ctx.lang, 'board.title') + '</h1><p>' + t(ctx.lang, 'board.intro') + (rows.length > 1 ? '' : ' ' + t(ctx.lang, 'board.solo')) + '</p>' +
    boardTable(ctx.slug, ctx.lang);
  render(res, 'page.html', { NAV: navHtml(ctx, 'board', '/leaderboard'), LANG: ctx.lang, TITLE: t(ctx.lang, 'board.title'), CONTENT: content }, ctx.lang);
});

app.get('/guide', (req, res) => {
  const ctx = ctxOf(req);
  noStore(res);
  const file = ctx.lang === 'en' && fs.existsSync(path.join(ROOT, 'docs', 'guide.en.md')) ? 'guide.en.md' : 'guide.md';
  render(res, 'page.html', { NAV: navHtml(ctx, 'guide', '/guide'), LANG: ctx.lang, TITLE: t(ctx.lang, 'guide.title'), CONTENT: markdown.render(readFile('docs', file)) }, ctx.lang);
});

app.get('/classement', (req, res) => res.redirect(301, '/leaderboard'));
app.get('/profil', (req, res) => res.redirect(301, '/profile'));

app.get('/challenge/:id', requireAuth, (req, res, next) => {
  const ctx = ctxOf(req);
  const c = challengeIn(req.params.id, ctx.lang);
  if (!c) return next();
  noStore(res);
  store.setActive(ctx.slug);
  const lang = ctx.lang;
  const e = store.entry(ctx.slug, c.id);
  if (!e.solved && !e.startedAt) { e.startedAt = Date.now(); store.save(); }

  const frag = readFile('challenges', c.id + '.html');
  const family = familiesIn(lang)[c.family];
  const pos = RECOMMENDED.indexOf(c.id);
  const prevId = RECOMMENDED[(pos - 1 + RECOMMENDED.length) % RECOMMENDED.length];
  const nextId = nextRecommended(ctx.slug, c.id) || RECOMMENDED[(pos + 1) % RECOMMENDED.length];
  const cfg = {
    id: c.id, title: c.title, stars: c.stars, lang,
    startedAt: e.startedAt || Date.now(), solved: !!e.solved, hints: e.hints || 0,
    durationMs: e.durationMs, revealed: !!e.revealed, quiz: e.quiz || { tries: 0, correct: false },
    nextId, i18n: i18n.clientStrings(lang)
  };

  render(res, 'challenge.html', {
    NAV: navHtml(ctx, null, '/challenge/' + c.id),
    LANG: lang,
    CONFIG: JSON.stringify(cfg).replace(/</g, '\\u003c'),
    PAGE_TITLE: esc(t(lang, 'ch.title', { id: c.id, title: c.title })),
    ID: c.id, TITLE: esc(c.title), SUBTITLE: esc(c.subtitle), STARS: stars(c.stars), MINUTES: c.minutes,
    FAMILY_KEY: c.family, FAMILY_NAME: esc(family.name),
    TABS: c.tabs.map((x) => '<span class="tag">' + esc(x) + '</span>').join('') +
      (c.minified ? '<span class="tag tag-min">' + t(lang, 'card.minified') + '</span>' : '') + (c.requiresToken ? '<span class="tag tag-token">' + t(lang, 'card.token') + '</span>' : ''),
    INTRO: esc(c.intro), SYMPTOM: esc(c.symptom),
    LEARN: c.learn.map((l) => '<li>' + esc(l) + '</li>').join(''),
    HEAD: section(frag, 'HEAD'), WORKSPACE: section(frag, 'WORKSPACE'), SCRIPTS: section(frag, 'SCRIPTS'),
    ALT_ORIGIN_META: ALT_ORIGIN ? '<meta name="gateway-replica" content="' + esc(ALT_ORIGIN) + '">' : '',
    PREV_HREF: '/challenge/' + prevId,
    NEXT_HREF: '/challenge/' + nextId,
    NEXT_LABEL: t(lang, 'ch.next', { id: nextId, title: esc(challengeIn(nextId, lang).title) })
  }, lang);
});

/* ------------------------------------------------------------------ */
/* API de l'exercice (journalisée)                                    */
/* ------------------------------------------------------------------ */

app.use('/api', collectRawBody, logApiRequest);

app.get('/api/session', (req, res) => {
  logVerdict(200, true, 'session servie');
  res.json({
    ok: true,
    session: 'ops-console',
    issuedAt: SESSION_STARTED,
    expiresIn: 3600,
    scopes: ['vault:read', 'vault:unlock', 'pricing:publish', 'challenge:solve'],
    token: SESSION_TOKEN
  });
});

function received(req) {
  const raw = req.rawBody || '';
  return {
    method: req.method,
    url: req.originalUrl,
    origin: req.headers.origin || null,
    contentType: req.headers['content-type'] || null,
    bodyBytes: Buffer.byteLength(raw, 'utf8'),
    bodyPreview: raw.length > 160 ? raw.slice(0, 160) + '…' : raw,
    apiToken: req.headers['x-api-token'] ? 'présent' : 'absent'
  };
}

function remember(req, slug, id, code, ok, message, rec) {
  if (!slug) return;
  const key = slug + '/' + id;
  const h = req.headers;
  const entry = {
    at: Date.now(), method: req.method, url: req.originalUrl, port: req.socket.localPort,
    headers: {
      'content-type': h['content-type'] || null, 'content-length': h['content-length'] || null,
      'x-api-token': h['x-api-token'] ? '… ' + String(h['x-api-token']).slice(-4) : null,
      origin: h.origin || null, 'access-control-request-method': h['access-control-request-method'] || null,
      'access-control-request-headers': h['access-control-request-headers'] || null
    },
    bodyBytes: rec.bodyBytes, bodyPreview: rec.bodyPreview, code, ok, message
  };
  serverLog[key] = [entry].concat(serverLog[key] || []).slice(0, LOG_KEEP);
  lastAttempt[key] = { ok, code, message, received: rec, at: entry.at };
}

function fail(req, res, slug, id, code, message) {
  const rec = received(req);
  remember(req, slug, id, code, false, message, rec);
  logVerdict(code, false, message);
  res.status(code).json({ ok: false, error: message, received: rec });
}

app.all('/api/challenge/:id/solve', (req, res) => {
  const id = req.params.id;
  const c = BY_ID.get(id);
  const ctx = ctxOf(req);
  const lang = ctx.lang;
  const slug = ctx.slug;
  if (!c) {
    logVerdict(404, false, t(lang, 'api.unknown'));
    return res.status(404).json({ ok: false, error: t(lang, 'api.unknown') });
  }
  const e = slug ? store.entry(slug, id) : null;
  if (e) {
    e.attempts = (e.attempts || 0) + 1;
    if (!e.startedAt) e.startedAt = Date.now();
    store.save();
  }

  if (req.method === 'OPTIONS') {
    return fail(req, res, slug, id, 405, t(lang, 'api.options', { origin: req.headers.origin ? t(lang, 'api.options.from', { o: req.headers.origin }) : '' }));
  }
  if (req.method !== 'POST') return fail(req, res, slug, id, 405, t(lang, 'api.method', { m: req.method }));

  const rawCt = req.headers['content-type'];
  const ct = (rawCt || '').split(';')[0].trim().toLowerCase();
  if (!rawCt) return fail(req, res, slug, id, 415, t(lang, 'api.noct'));
  if (ct !== 'application/json') return fail(req, res, slug, id, 415, t(lang, 'api.badct', { ct: rawCt }));

  const raw = req.rawBody || '';
  if (!raw.length) return fail(req, res, slug, id, 400, t(lang, 'api.empty'));
  let body;
  try {
    body = JSON.parse(raw);
  } catch (err) {
    return fail(req, res, slug, id, 400, t(lang, 'api.badjson', { n: Buffer.byteLength(raw, 'utf8'), head: raw.slice(0, 60) }));
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return fail(req, res, slug, id, 400, t(lang, 'api.notobject'));
  const keys = JSON.stringify(Object.keys(body));
  if (!Object.prototype.hasOwnProperty.call(body, 'challengeId')) return fail(req, res, slug, id, 422, t(lang, 'api.noid', { keys }));
  if (String(body.challengeId) !== id) return fail(req, res, slug, id, 422, t(lang, 'api.badid', { v: String(body.challengeId), id }));
  if (!Object.prototype.hasOwnProperty.call(body, 'action')) return fail(req, res, slug, id, 422, t(lang, 'api.noaction', { keys }));
  if (body.action !== 'validate') return fail(req, res, slug, id, 422, t(lang, 'api.badaction', { v: JSON.stringify(body.action) }));
  if (c.requiresToken) {
    const tok = req.headers['x-api-token'];
    if (!tok) return fail(req, res, slug, id, 401, t(lang, 'api.notoken'));
    if (tok !== SESSION_TOKEN) return fail(req, res, slug, id, 403, t(lang, 'api.badtoken', { got: String(tok).slice(-4), want: SESSION_TOKEN.slice(-4) }));
  }

  if (!e) {
    const msg = t(lang, 'api.anonymous');
    logVerdict(200, true, msg);
    return res.status(200).json({ ok: true, credited: false, message: msg, challengeId: id });
  }
  const already = e.solved;
  if (!already) {
    e.solved = true;
    e.solvedAt = Date.now();
    e.durationMs = e.startedAt ? e.solvedAt - e.startedAt : null;
    store.save();
  }
  const pts = store.scoreEntry(e, c);
  const msg = already
    ? t(lang, 'api.already')
    : t(lang, 'api.solved', { id, time: fmtDuration(e.durationMs, lang), hints: e.hints || 0, revealed: e.revealed ? t(lang, 'api.solved.revealed') : '', pts });
  remember(req, slug, id, 200, true, msg, received(req));
  logVerdict(200, true, msg);
  res.status(200).json({ ok: true, credited: true, message: msg, challengeId: id, durationMs: e.durationMs, hints: e.hints || 0, score: pts });
});

app.all('/api/*', (req, res) => {
  const msg = t(ctxOf(req).lang, 'api.noroute', { url: req.originalUrl });
  logVerdict(404, false, msg);
  res.status(404).json({ ok: false, error: msg });
});

/* ------------------------------------------------------------------ */
/* Endpoints internes (session requise, non journalisés)              */
/* ------------------------------------------------------------------ */

app.use('/_dojo', express.json({ limit: '50kb' }), (req, res, next) => { noStore(res); next(); }, requireAuth);

function debriefPayload(c, e) {
  if (!(e.solved || e.revealed)) return null;
  return {
    cause: c.debrief.cause,
    reflex: c.debrief.reflex,
    quiz: { question: c.quiz.question, choices: c.quiz.choices, tries: e.quiz.tries, correct: e.quiz.correct,
      answer: e.quiz.correct ? c.quiz.answer : null, why: e.quiz.correct ? c.quiz.why : null }
  };
}

app.get('/_dojo/state/:id', (req, res) => {
  const ctx = ctxOf(req);
  const c = challengeIn(req.params.id, ctx.lang);
  if (!c) return res.status(404).json({ ok: false });
  const e = store.entry(ctx.slug, c.id);
  res.json({
    ok: true, id: c.id, profile: ctx.slug,
    solved: !!e.solved, hints: e.hints || 0, attempts: e.attempts || 0, revealed: !!e.revealed,
    startedAt: e.startedAt, durationMs: e.durationMs, score: store.scoreEntry(e, c),
    quiz: e.quiz,
    lastAttempt: lastAttempt[ctx.slug + '/' + c.id] || null,
    log: serverLog[ctx.slug + '/' + c.id] || [],
    debrief: debriefPayload(c, e),
    nextId: nextRecommended(ctx.slug, c.id)
  });
});

app.post('/_dojo/hint/:id', (req, res) => {
  const ctx = ctxOf(req);
  const c = challengeIn(req.params.id, ctx.lang);
  if (!c) return res.status(404).json({ ok: false });
  const level = Math.max(1, Math.min(3, parseInt(req.query.level, 10) || 1));
  const e = store.entry(ctx.slug, c.id);
  if (level > (e.hints || 0)) { e.hints = level; store.save(); }
  res.json({ ok: true, level, text: c.hints[level - 1], hints: e.hints || 0 });
});

function solutionHtml(id, lang) {
  const candidates = lang === 'en' ? [path.join('solutions', 'en', id + '.md'), path.join('solutions', id + '.md')] : [path.join('solutions', id + '.md')];
  for (const rel of candidates) {
    const file = path.join(ROOT, rel);
    if (fs.existsSync(file)) return markdown.render(fs.readFileSync(file, 'utf8'));
  }
  return '<p>' + t(lang, 'ch.solution.unavailable') + '</p>';
}

app.post('/_dojo/reveal/:id', (req, res) => {
  const ctx = ctxOf(req);
  const c = challengeIn(req.params.id, ctx.lang);
  if (!c) return res.status(404).json({ ok: false });
  const e = store.entry(ctx.slug, c.id);
  if (!e.solved && !e.revealed) { e.revealed = true; store.save(); }
  res.json({ ok: true, revealed: !!e.revealed, solved: !!e.solved, html: solutionHtml(c.id, ctx.lang), debrief: debriefPayload(c, e) });
});

app.get('/_dojo/solution/:id', (req, res) => {
  const ctx = ctxOf(req);
  const c = challengeIn(req.params.id, ctx.lang);
  if (!c) return res.status(404).json({ ok: false });
  const e = store.entry(ctx.slug, c.id);
  if (!(e.solved || e.revealed)) return res.status(403).json({ ok: false, error: t(ctx.lang, 'dojo.solution.locked') });
  res.json({ ok: true, html: solutionHtml(c.id, ctx.lang) });
});

app.post('/_dojo/quiz/:id', (req, res) => {
  const ctx = ctxOf(req);
  const c = challengeIn(req.params.id, ctx.lang);
  if (!c) return res.status(404).json({ ok: false });
  const e = store.entry(ctx.slug, c.id);
  if (!(e.solved || e.revealed)) return res.status(403).json({ ok: false, error: t(ctx.lang, 'dojo.quiz.locked') });
  const choice = parseInt(req.body && req.body.choice, 10);
  if (isNaN(choice) || choice < 0 || choice >= c.quiz.choices.length) return res.status(400).json({ ok: false, error: t(ctx.lang, 'dojo.quiz.bad') });
  if (!e.quiz.correct) {
    e.quiz.tries = (e.quiz.tries || 0) + 1;
    e.quiz.correct = choice === c.quiz.answer;
    store.save();
  }
  const correct = choice === c.quiz.answer;
  res.json({
    ok: true, correct, tries: e.quiz.tries, quizCorrect: e.quiz.correct,
    answer: e.quiz.correct ? c.quiz.answer : null, why: correct ? c.quiz.why : null,
    score: store.scoreEntry(e, c)
  });
});

app.post('/_dojo/reset/:id', (req, res) => {
  if (!BY_ID.has(req.params.id)) return res.status(404).json({ ok: false });
  store.resetEntries(req.slug, [req.params.id]);
  delete lastAttempt[req.slug + '/' + req.params.id];
  delete serverLog[req.slug + '/' + req.params.id];
  res.json({ ok: true });
});

app.post('/_dojo/reset', (req, res) => {
  store.resetEntries(req.slug, null);
  IDS.forEach((id) => { delete lastAttempt[req.slug + '/' + id]; delete serverLog[req.slug + '/' + id]; });
  res.json({ ok: true });
});

app.post('/_dojo/account/lang', (req, res) => {
  const lang = i18n.normLang(req.body && req.body.lang);
  if (!lang) return res.status(400).json({ ok: false, error: t(ctxOf(req).lang, 'dojo.lang.bad') });
  store.setLang(req.slug, lang);
  res.setHeader('Set-Cookie', i18n.cookieHeader(lang));
  res.json({ ok: true, lang });
});

app.post('/_dojo/account/delete', (req, res) => {
  store.deleteUser(req.slug);
  IDS.forEach((id) => { delete lastAttempt[req.slug + '/' + id]; delete serverLog[req.slug + '/' + id]; });
  res.setHeader('Set-Cookie', store.clearSessionCookie());
  res.json({ ok: true });
});

app.get('/_dojo/export', (req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="debug-frontend-' + req.slug + '.json"');
  res.json(store.exportUser(req.slug));
});

app.get('/_dojo/summary', (req, res) => {
  res.json({ ok: true, me: store.summary(req.slug), board: store.leaderboard() });
});

/* ------------------------------------------------------------------ */
/* 404                                                                */
/* ------------------------------------------------------------------ */

app.use((req, res) => {
  const ctx = ctxOf(req);
  res.status(404);
  render(res, 'page.html', {
    NAV: navHtml(ctx, null, '/'), LANG: ctx.lang, TITLE: t(ctx.lang, 'g.404.title'),
    CONTENT: '<h1>' + t(ctx.lang, 'g.404.title') + '</h1><p>' + t(ctx.lang, 'g.404.text') + '</p>'
  }, ctx.lang);
});

/* ------------------------------------------------------------------ */
/* Démarrage                                                          */
/* ------------------------------------------------------------------ */

function start(port, altPort) {
  port = port === undefined ? PORT : port;
  altPort = altPort === undefined ? ALT_PORT : altPort;
  const servers = [];
  const main = app.listen(port, () => {
    const p = main.address().port;
    out('');
    out(C.bold('  DEBUG FRONTEND') + C.dim('  ·  entraînement au debugging front-end'));
    out('  ' + C.cyan('http://localhost:' + p));
    out(C.dim('  Ce terminal journalise chaque requête reçue sur /api/. Les joueurs ont la même chose dans le panneau « Journal du serveur ».'));
    out('');
  });
  servers.push(main);
  if (altPort) {
    const alt = app.listen(altPort, () => {
      out(C.dim('  Port secondaire ' + alt.address().port + ' actif (défi 15, CORS).' + (ALT_ORIGIN ? ' Origine annoncée : ' + ALT_ORIGIN : '')));
    });
    alt.on('error', (err) => {
      out(C.yellow('  Port secondaire ' + altPort + ' indisponible (' + err.code + ') : le défi 15 affichera « Failed to fetch » au lieu d\'une erreur CORS. ' +
        'Définis DOJO_ALT_PORT ou DOJO_ALT_ORIGIN.'));
    });
    servers.push(alt);
  }
  return servers;
}

if (require.main === module) start();

module.exports = { app, start, store, SESSION_TOKEN, CHALLENGES };

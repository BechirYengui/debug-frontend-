'use strict';

/*
 * Rendu partagé par les routes : catalogue dans la langue demandée, navigation,
 * cartes et familles du tableau de bord, table du classement, helpers de format,
 * contexte de requête (compte + langue) et garde d'authentification.
 */

const fs = require('fs');
const path = require('path');
const i18n = require('./i18n');
const markdown = require('./markdown');

const FR = require('../data/challenges');
const { CHALLENGES, BY_ID, FAMILY_ORDER, RECOMMENDED } = FR;

let EN = { FAMILIES: {}, CHALLENGES: {} };
try { EN = require('../data/challenges.en'); } catch (e) { /* traduction absente : repli sur le français */ }

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
/* Helpers de format (indépendants du store)                          */
/* ------------------------------------------------------------------ */

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

function langToggle(lang, currentPath) {
  const next = encodeURIComponent(currentPath || '/');
  return ['fr', 'en'].map((l) =>
    '<a class="lang' + (l === lang ? ' is-on' : '') + '" href="/lang/' + l + '?next=' + next + '" hreflang="' + l + '">' + l.toUpperCase() + '</a>'
  ).join('');
}

function beltHtml(s, lang) {
  return '<span class="belt" style="--belt:' + s.beltColor + '"><i></i>' + esc(beltLabel(s, lang)) + '</span>';
}

/* Prochain défi conseillé d'après la carte des entrées du compte (ids -> entry). */
function nextRecommended(entries, afterId) {
  const order = RECOMMENDED;
  const start = afterId ? order.indexOf(afterId) + 1 : 0;
  for (let k = 0; k < order.length; k++) {
    const id = order[(start + k) % order.length];
    if (id === afterId) continue;
    if (!entries[id] || !entries[id].solved) return id;
  }
  return null;
}

function entryState(e) {
  if (e.solved) return e.quiz && e.quiz.correct ? 'done' : 'half';
  if (e.revealed) return 'seen';
  return 'todo';
}

function tagsHtml(c, lang) {
  return c.tabs.map((x) => '<span class="tag">' + esc(x) + '</span>').join('') +
    (c.minified ? '<span class="tag tag-min">' + t(lang, 'card.minified') + '</span>' : '') +
    (c.requiresToken ? '<span class="tag tag-token">' + t(lang, 'card.token') + '</span>' : '');
}

/* ------------------------------------------------------------------ */
/* Helpers liés au store et aux vues                                  */
/* ------------------------------------------------------------------ */

function createRender(opts) {
  const ROOT = opts.root;
  const store = opts.store;

  function readFile() {
    return fs.readFileSync(path.join.apply(path, [ROOT].concat(Array.prototype.slice.call(arguments))), 'utf8');
  }
  function hasView(name) { return fs.existsSync(path.join(ROOT, 'views', name)); }

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

  function requireAuth(req, res, next) {
    const slug = store.readSession(req);
    if (slug) { req.slug = slug; return next(); }
    if (req.baseUrl === '/_dojo' || req.xhr || (req.headers.accept || '').indexOf('application/json') !== -1) {
      return res.status(401).json({ ok: false, error: t(ctxOf(req).lang, 'dojo.auth') });
    }
    res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
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
    return [
      '<article class="' + cls.join(' ') + '" data-id="' + c.id + '" data-stars="' + c.stars + '" data-state="' + state + '" data-recommended="' + esc(t(lang, 'card.recommended')) + '">',
      '  <a class="cc-link" href="/challenge/' + c.id + '">',
      '    <div class="cc-top"><span class="cc-id">' + c.id + '</span><span class="cc-stars" title="' + t(lang, 'card.difficulty') + '">' + stars(c.stars) + '</span><span class="cc-min">' + t(lang, 'card.minutes', { n: c.minutes }) + '</span></div>',
      '    <h3>' + esc(c.title) + '</h3>',
      '    <p class="cc-sub">' + esc(c.subtitle) + '</p>',
      '    <div class="cc-tags">' + tagsHtml(c, lang) + '</div>',
      '  </a>',
      '  <div class="cc-foot">' + badge + '<span class="cc-meta">' + meta + '</span>',
      '    <button class="cc-reset" data-id="' + c.id + '" title="' + t(lang, 'card.reset.title') + '">' + t(lang, 'card.reset') + '</button>',
      '  </div>',
      '</article>'
    ].join('\n');
  }

  /* entries : carte ids -> entry du compte (store.entries), lue une seule fois. */
  function familiesHtml(entries, nextId, lang) {
    const fams = familiesIn(lang);
    return FAMILY_ORDER.map((key, idx) => {
      const f = fams[key];
      const list = CHALLENGES.filter((c) => c.family === key).sort((a, b) => a.stars - b.stars || a.id.localeCompare(b.id));
      const done = list.filter((c) => entries[c.id].solved).length;
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
        list.map((c) => cardHtml(challengeIn(c.id, lang), entries[c.id], c.id === nextId, lang)).join('\n'),
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

  function solutionHtml(id, lang) {
    const candidates = lang === 'en' ? [path.join('solutions', 'en', id + '.md'), path.join('solutions', id + '.md')] : [path.join('solutions', id + '.md')];
    for (const rel of candidates) {
      const file = path.join(ROOT, rel);
      if (fs.existsSync(file)) return markdown.render(fs.readFileSync(file, 'utf8'));
    }
    return '<p>' + t(lang, 'ch.solution.unavailable') + '</p>';
  }

  return {
    ROOT, t, esc, i18n, markdown,
    readFile, hasView, ctxOf, render, requireAuth,
    stars, section, fmtDuration, fmtInt, beltLabel, noStore, safeNext, langToggle, beltHtml,
    nextRecommended, entryState, tagsHtml, navHtml, cardHtml, familiesHtml, boardTable, solutionHtml,
    challengeIn, familiesIn
  };
}

module.exports = { createRender, challengeIn, familiesIn, FR, EN, CHALLENGES, BY_ID, IDS: FR.IDS, FAMILY_ORDER, RECOMMENDED, t, esc };

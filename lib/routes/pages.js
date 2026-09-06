'use strict';

/*
 * Pages HTML : landing, tableau de bord, profil, classement, guide, page de défi, 404.
 */

const fs = require('fs');
const path = require('path');
const i18n = require('../i18n');
const { RECOMMENDED } = require('../render');

function mount(app, ctx) {
  const { store, render: R, ROOT, ALT_ORIGIN } = ctx;
  const { t, esc, markdown, ctxOf, noStore, render, requireAuth, readFile, hasView, navHtml, fmtDuration, fmtInt, beltLabel,
    stars, section, tagsHtml, nextRecommended, familiesHtml, boardTable, challengeIn, familiesIn } = R;

  app.get('/', (req, res) => {
    const c = ctxOf(req);
    noStore(res);
    if (!hasView('landing.html')) return res.redirect(c.user ? '/dashboard' : '/login');
    render(res, 'landing.html', { NAV: navHtml(c, 'landing', '/'), LANG: c.lang, YEAR: new Date().getFullYear() }, c.lang);
  });

  function dashboardVars(c, active, currentPath) {
    const s = store.summary(c.slug);
    const entries = store.entries(c.slug);
    const nextId = nextRecommended(entries, null) || '01';
    const lang = c.lang;
    return {
      NAV: navHtml(c, active, currentPath),
      LANG: lang,
      PLAYER_NAME: esc(s.name),
      BELT: esc(beltLabel(s, lang)),
      BELT_COLOR: s.beltColor,
      DONE: s.done, TOTAL: s.total, SCORE: fmtInt(s.score, lang), UNDERSTOOD: s.understood, HINTS: s.hints,
      TIME: s.done ? fmtDuration(s.timeMs, lang) : t(lang, 'g.none'),
      NEXT_ID: nextId, NEXT_TITLE: esc(challengeIn(nextId, lang).title),
      LANG_FR_SELECTED: lang === 'fr' ? 'selected' : '', LANG_EN_SELECTED: lang === 'en' ? 'selected' : '',
      FOOT: t(lang, 'dash.foot', { name: esc(s.name), done: s.done, total: s.total, score: fmtInt(s.score, lang), belt: esc(beltLabel(s, lang)) }),
      FAMILIES: familiesHtml(entries, nextId, lang)
    };
  }

  app.get('/dashboard', requireAuth, (req, res) => {
    const c = ctxOf(req);
    noStore(res);
    store.setActive(c.slug);
    render(res, 'index.html', dashboardVars(c, 'home', '/dashboard'), c.lang);
  });

  app.get('/profile', requireAuth, (req, res) => {
    const c = ctxOf(req);
    noStore(res);
    render(res, 'profile.html', dashboardVars(c, 'profile', '/profile'), c.lang);
  });

  app.get('/leaderboard', (req, res) => {
    const c = ctxOf(req);
    noStore(res);
    const rows = store.leaderboard();
    const content = '<h1>' + t(c.lang, 'board.title') + '</h1><p>' + t(c.lang, 'board.intro') + (rows.length > 1 ? '' : ' ' + t(c.lang, 'board.solo')) + '</p>' +
      boardTable(c.slug, c.lang);
    render(res, 'page.html', { NAV: navHtml(c, 'board', '/leaderboard'), LANG: c.lang, TITLE: t(c.lang, 'board.title'), CONTENT: content }, c.lang);
  });

  app.get('/guide', (req, res) => {
    const c = ctxOf(req);
    noStore(res);
    const file = c.lang === 'en' && fs.existsSync(path.join(ROOT, 'docs', 'guide.en.md')) ? 'guide.en.md' : 'guide.md';
    render(res, 'page.html', { NAV: navHtml(c, 'guide', '/guide'), LANG: c.lang, TITLE: t(c.lang, 'guide.title'), CONTENT: markdown.render(readFile('docs', file)) }, c.lang);
  });

  app.get('/classement', (req, res) => res.redirect(301, '/leaderboard'));
  app.get('/profil', (req, res) => res.redirect(301, '/profile'));

  app.get('/challenge/:id', requireAuth, (req, res, next) => {
    const c0 = ctxOf(req);
    const c = challengeIn(req.params.id, c0.lang);
    if (!c) return next();
    noStore(res);
    store.setActive(c0.slug);
    const lang = c0.lang;
    const entries = store.entries(c0.slug);
    let e = entries[c.id];
    if (!e.solved && !e.startedAt) e = store.startEntry(c0.slug, c.id); // le chrono démarre au premier affichage

    const frag = readFile('challenges', c.id + '.html');
    const family = familiesIn(lang)[c.family];
    const pos = RECOMMENDED.indexOf(c.id);
    const prevId = RECOMMENDED[(pos - 1 + RECOMMENDED.length) % RECOMMENDED.length];
    const nextId = nextRecommended(entries, c.id) || RECOMMENDED[(pos + 1) % RECOMMENDED.length];
    const cfg = {
      id: c.id, title: c.title, stars: c.stars, lang,
      startedAt: e.startedAt || Date.now(), solved: !!e.solved, hints: e.hints || 0,
      durationMs: e.durationMs, revealed: !!e.revealed, quiz: e.quiz || { tries: 0, correct: false },
      nextId, i18n: i18n.clientStrings(lang)
    };

    render(res, 'challenge.html', {
      NAV: navHtml(c0, null, '/challenge/' + c.id),
      LANG: lang,
      CONFIG: JSON.stringify(cfg).replace(/</g, '\\u003c'),
      PAGE_TITLE: esc(t(lang, 'ch.title', { id: c.id, title: c.title })),
      ID: c.id, TITLE: esc(c.title), SUBTITLE: esc(c.subtitle), STARS: stars(c.stars), MINUTES: c.minutes,
      FAMILY_KEY: c.family, FAMILY_NAME: esc(family.name),
      TABS: tagsHtml(c, lang),
      INTRO: esc(c.intro), SYMPTOM: esc(c.symptom),
      LEARN: c.learn.map((l) => '<li>' + esc(l) + '</li>').join(''),
      HEAD: section(frag, 'HEAD'), WORKSPACE: section(frag, 'WORKSPACE'), SCRIPTS: section(frag, 'SCRIPTS'),
      ALT_ORIGIN_META: ALT_ORIGIN ? '<meta name="gateway-replica" content="' + esc(ALT_ORIGIN) + '">' : '',
      PREV_HREF: '/challenge/' + prevId,
      NEXT_HREF: '/challenge/' + nextId,
      NEXT_LABEL: t(lang, 'ch.next', { id: nextId, title: esc(challengeIn(nextId, lang).title) })
    }, lang);
  });
}

/* Page 404, montée en dernier. */
function mountNotFound(app, ctx) {
  const { t, ctxOf, render, navHtml } = ctx.render;
  app.use((req, res) => {
    const c = ctxOf(req);
    res.status(404);
    render(res, 'page.html', {
      NAV: navHtml(c, null, '/'), LANG: c.lang, TITLE: t(c.lang, 'g.404.title'),
      CONTENT: '<h1>' + t(c.lang, 'g.404.title') + '</h1><p>' + t(c.lang, 'g.404.text') + '</p>'
    }, c.lang);
  });
}

module.exports = { mount, mountNotFound };

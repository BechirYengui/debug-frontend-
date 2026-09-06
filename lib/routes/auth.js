'use strict';

/*
 * Langue et comptes : /lang/:code, /login, /signup, /logout.
 *
 * Les mots de passe sont hachés en asynchrone (scrypt), un limiteur de débit en
 * mémoire freine les essais répétés : au-delà de LIMIT.max échecs en LIMIT.windowMs
 * depuis la même adresse, /login et /signup répondent 429 ; une réussite efface le
 * compteur. Il est local à chaque processus (voir DOJO_WORKERS dans le README).
 */

const express = require('express');
const i18n = require('../i18n');

const LIMIT = { max: 20, windowMs: 10 * 60 * 1000 };

function createLimiter(opts) {
  const max = (opts && opts.max) || LIMIT.max;
  const windowMs = (opts && opts.windowMs) || LIMIT.windowMs;
  const buckets = new Map(); // ip -> { n, resetAt }
  let lastSweep = 0;

  function sweep(now) {
    if (now - lastSweep < windowMs) return;
    lastSweep = now;
    buckets.forEach((b, ip) => { if (b.resetAt <= now) buckets.delete(ip); });
  }
  function ipOf(req) { return req.ip || (req.socket && req.socket.remoteAddress) || '?'; }

  return {
    /* Secondes à attendre si l'adresse est bloquée, 0 sinon. */
    blocked(req) {
      const now = Date.now();
      sweep(now);
      const b = buckets.get(ipOf(req));
      if (!b || b.resetAt <= now || b.n < max) return 0;
      return Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    },
    failure(req) {
      const now = Date.now();
      const ip = ipOf(req);
      const b = buckets.get(ip);
      if (!b || b.resetAt <= now) buckets.set(ip, { n: 1, resetAt: now + windowMs });
      else b.n += 1;
    },
    success(req) { buckets.delete(ipOf(req)); },
    reset() { buckets.clear(); }
  };
}

const limiter = createLimiter();

function mount(app, ctx) {
  const { store, render: R } = ctx;
  const { t, esc, ctxOf, noStore, safeNext, navHtml, render } = R;
  const forms = express.urlencoded({ extended: false, limit: '10kb' });
  const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

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
    const c = ctxOf(req);
    noStore(res);
    const vars = Object.assign({
      NAV: navHtml(c, null, req.originalUrl), LANG: c.lang, ERROR: '', USERNAME: '',
      NEXT: esc(safeNext(req.query.next || (req.body && req.body.next))),
      LANG_FR_SELECTED: c.lang === 'fr' ? 'selected' : '', LANG_EN_SELECTED: c.lang === 'en' ? 'selected' : '',
      YEAR: new Date().getFullYear()
    }, extra || {});
    if (vars.ERROR_KEY) vars.ERROR = '<p class="auth-error" role="alert">' + t(c.lang, vars.ERROR_KEY) + '</p>';
    render(res, view, vars, c.lang);
  }

  function tooMany(req, res, view, extra) {
    const wait = limiter.blocked(req);
    if (!wait) return false;
    res.status(429);
    res.setHeader('Retry-After', String(wait));
    authPage(req, res, view, Object.assign({ ERROR_KEY: 'auth.err.login', USERNAME: esc(req.body.username || '') }, extra || {}));
    return true;
  }

  app.get('/login', (req, res) => {
    if (store.readSession(req)) return res.redirect('/dashboard');
    authPage(req, res, 'login.html');
  });

  app.post('/login', forms, wrap(async (req, res) => {
    if (tooMany(req, res, 'login.html')) return;
    const r = await store.login(req.body.username, req.body.password);
    if (!r.ok) {
      limiter.failure(req);
      res.status(401);
      return authPage(req, res, 'login.html', { ERROR_KEY: r.error === 'password' ? 'auth.err.password' : 'auth.err.login', USERNAME: esc(req.body.username || '') });
    }
    limiter.success(req);
    const user = store.getUser(r.slug);
    res.setHeader('Set-Cookie', [store.sessionCookie(r.slug), i18n.cookieHeader(user.lang || 'fr')]);
    res.redirect(safeNext(req.body.next));
  }));

  app.get('/signup', (req, res) => {
    if (store.readSession(req)) return res.redirect('/dashboard');
    authPage(req, res, 'signup.html');
  });

  app.post('/signup', forms, wrap(async (req, res) => {
    const lang = i18n.normLang(req.body.lang) || ctxOf(req).lang;
    const extra = { USERNAME: esc(req.body.username || ''), LANG_FR_SELECTED: lang === 'fr' ? 'selected' : '', LANG_EN_SELECTED: lang === 'en' ? 'selected' : '' };
    if (tooMany(req, res, 'signup.html', extra)) return;
    if (String(req.body.password || '') !== String(req.body.password2 || '')) {
      res.status(400);
      return authPage(req, res, 'signup.html', Object.assign({ ERROR_KEY: 'auth.err.match' }, extra));
    }
    const r = await store.createAccount(req.body.username, req.body.password, lang);
    if (!r.ok) {
      if (r.error === 'taken') limiter.failure(req);
      res.status(400);
      return authPage(req, res, 'signup.html', Object.assign({ ERROR_KEY: 'auth.err.' + r.error }, extra));
    }
    limiter.success(req);
    res.setHeader('Set-Cookie', [store.sessionCookie(r.slug), i18n.cookieHeader(lang)]);
    res.redirect(safeNext(req.body.next));
  }));

  app.post('/logout', forms, (req, res) => {
    res.setHeader('Set-Cookie', store.clearSessionCookie());
    res.redirect('/');
  });
}

module.exports = { mount, limiter, createLimiter, LIMIT };

'use strict';

/*
 * Persistance : comptes, sessions et progression. Le fichier progress.json est
 * réécrit à chaque changement.
 *
 *   {
 *     version: 3,
 *     secret: "…",                 // clé HMAC des sessions (sauf DOJO_SECRET)
 *     activeUser: "slug",          // dernier compte actif (pour scripts/reset.js)
 *     users: {
 *       "slug": { name, createdAt, lang, passwordHash, salt, challenges: { "01": entry } }
 *     }
 *   }
 *
 * entry = { solved, hints, attempts, startedAt, solvedAt, durationMs, revealed, quiz: { tries, correct } }
 *
 * Les profils hérités des versions précédentes n'ont pas de mot de passe : la
 * première connexion (ou inscription) sous ce pseudo le fixe (« réclamation »).
 */

const fs = require('fs');
const crypto = require('crypto');

const SESSION_COOKIE = 'dojo_session';
const SESSION_DAYS = 30;
const DEFAULT_NAME = 'Joueur 1';
const USERNAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,30}[\p{L}\p{N}._-]$/u;

function blankEntry() {
  return {
    solved: false, hints: 0, attempts: 0,
    startedAt: null, solvedAt: null, durationMs: null,
    revealed: false, quiz: { tries: 0, correct: false }
  };
}

function normalizeEntry(e) {
  const b = blankEntry();
  if (!e || typeof e !== 'object') return b;
  Object.keys(b).forEach((k) => { if (e[k] === undefined) e[k] = b[k]; });
  if (!e.quiz || typeof e.quiz !== 'object') e.quiz = { tries: 0, correct: false };
  return e;
}

function slugify(name) {
  return String(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'joueur';
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 32).toString('hex');
}

function safeEqual(a, b) {
  const A = Buffer.from(String(a)); const B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

function createStore(opts) {
  const file = opts.file;
  const ids = opts.ids.slice();
  const challenges = opts.challenges;
  const byId = new Map(challenges.map((c) => [c.id, c]));
  let data = load();

  function load() {
    let d = null;
    try {
      if (fs.existsSync(file)) d = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) { d = null; }
    if (!d || typeof d !== 'object') d = { version: 3, users: {} };

    // v1 : un seul joueur, clés au premier niveau.
    if (!d.users) {
      const legacy = d.challenges || {};
      const slug = slugify(DEFAULT_NAME);
      d = { version: 3, activeUser: slug, users: {} };
      d.users[slug] = { name: DEFAULT_NAME, createdAt: Date.now(), challenges: legacy };
    }
    d.version = 3;
    if (!d.secret) d.secret = crypto.randomBytes(32).toString('hex');
    Object.keys(d.users).forEach((slug) => {
      const u = d.users[slug];
      if (!u.challenges) u.challenges = {};
      if (!u.lang) u.lang = 'fr';
      ids.forEach((id) => { u.challenges[id] = normalizeEntry(u.challenges[id]); });
    });
    if (!d.activeUser || !d.users[d.activeUser]) d.activeUser = Object.keys(d.users)[0] || null;
    return d;
  }

  function save() {
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
  save();

  const secret = () => process.env.DOJO_SECRET || data.secret;

  /* ---------------- comptes ---------------- */

  function listUsers() {
    return Object.keys(data.users).map((slug) => ({ slug, name: data.users[slug].name, createdAt: data.users[slug].createdAt, lang: data.users[slug].lang }));
  }

  function getUser(slug) { return (slug && data.users[slug]) || null; }

  function findByName(name) {
    const clean = String(name || '').trim().toLowerCase();
    return Object.keys(data.users).find((s) => data.users[s].name.toLowerCase() === clean) || null;
  }

  function validUsername(name) { return USERNAME_RE.test(String(name || '').trim()); }

  function newUserRecord(name, lang) {
    const u = { name: String(name).trim(), createdAt: Date.now(), lang: lang === 'en' ? 'en' : 'fr', challenges: {} };
    ids.forEach((id) => { u.challenges[id] = blankEntry(); });
    return u;
  }

  function setPassword(slug, password) {
    const u = data.users[slug];
    u.salt = crypto.randomBytes(16).toString('hex');
    u.passwordHash = hashPassword(password, u.salt);
  }

  /* Inscription. Un profil hérité sans mot de passe portant ce pseudo est réclamé. */
  function createAccount(name, password, lang) {
    if (!validUsername(name)) return { ok: false, error: 'username' };
    if (String(password || '').length < 8) return { ok: false, error: 'password' };
    const existing = findByName(name);
    if (existing) {
      if (data.users[existing].passwordHash) return { ok: false, error: 'taken' };
      setPassword(existing, password);
      if (lang) data.users[existing].lang = lang === 'en' ? 'en' : 'fr';
      data.activeUser = existing;
      save();
      return { ok: true, slug: existing, claimed: true };
    }
    let slug = slugify(name);
    const base = slug;
    let n = 2;
    while (data.users[slug]) { slug = base + '-' + n; n += 1; }
    data.users[slug] = newUserRecord(name, lang);
    setPassword(slug, password);
    data.activeUser = slug;
    save();
    return { ok: true, slug };
  }

  function login(name, password) {
    const slug = findByName(name);
    if (!slug) return { ok: false };
    const u = data.users[slug];
    if (!u.passwordHash) {
      if (String(password || '').length < 8) return { ok: false, error: 'password' };
      setPassword(slug, password);
      data.activeUser = slug;
      save();
      return { ok: true, slug, claimed: true };
    }
    if (!safeEqual(hashPassword(password, u.salt), u.passwordHash)) return { ok: false };
    if (data.activeUser !== slug) { data.activeUser = slug; save(); }
    return { ok: true, slug };
  }

  function deleteUser(slug) {
    if (!data.users[slug]) return false;
    delete data.users[slug];
    if (data.activeUser === slug) data.activeUser = Object.keys(data.users)[0] || null;
    save();
    return true;
  }

  function setLang(slug, lang) {
    const u = data.users[slug];
    if (!u) return false;
    u.lang = lang === 'en' ? 'en' : 'fr';
    save();
    return true;
  }

  function setActive(slug) {
    if (data.users[slug] && data.activeUser !== slug) { data.activeUser = slug; save(); }
  }
  function activeSlug() { return data.activeUser; }

  /* ---------------- sessions ---------------- */

  function sign(payload) {
    return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  }

  function sessionToken(slug) {
    const exp = Date.now() + SESSION_DAYS * 86400000;
    const payload = Buffer.from(slug).toString('base64url') + '.' + exp;
    return payload + '.' + sign(payload);
  }

  function readToken(token) {
    if (!token) return null;
    const parts = String(token).split('.');
    if (parts.length !== 3) return null;
    const payload = parts[0] + '.' + parts[1];
    if (!safeEqual(sign(payload), parts[2])) return null;
    if (Number(parts[1]) < Date.now()) return null;
    const slug = Buffer.from(parts[0], 'base64url').toString();
    return data.users[slug] ? slug : null;
  }

  function readSession(req) {
    const raw = req.headers.cookie || '';
    const m = raw.match(new RegExp('(?:^|;\\s*)' + SESSION_COOKIE + '=([^;]+)'));
    return m ? readToken(decodeURIComponent(m[1])) : null;
  }

  function sessionCookie(slug) {
    return SESSION_COOKIE + '=' + encodeURIComponent(sessionToken(slug)) + '; Path=/; Max-Age=' + (SESSION_DAYS * 86400) + '; HttpOnly; SameSite=Lax';
  }

  function clearSessionCookie() {
    return SESSION_COOKIE + '=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax';
  }

  /* Compte auquel une requête est attribuée : uniquement via une session valide. */
  function resolve(req) { return readSession(req); }

  /* ---------------- état par défi ---------------- */

  function entry(slug, id) {
    const u = data.users[slug];
    if (!u) return null;
    if (!u.challenges[id]) u.challenges[id] = blankEntry();
    return u.challenges[id];
  }

  function resetEntries(slug, only) {
    const u = data.users[slug];
    if (!u) return;
    ids.forEach((id) => { if (!only || only.indexOf(id) !== -1) u.challenges[id] = blankEntry(); });
    save();
  }

  /* ---------------- score ---------------- */

  function scoreEntry(e, ch) {
    if (!e || !e.solved) return 0;
    const base = (ch ? ch.stars : 1) * 100;
    let s = base;
    s -= Math.min(3, e.hints || 0) * base * 0.10;
    if (e.revealed) s -= base * 0.5;
    if (e.quiz && e.quiz.correct) s += e.quiz.tries === 1 ? 25 : 10;
    return Math.max(0, Math.round(s));
  }

  const BELTS = [
    { min: 0, key: 'white', color: '#e5e7eb' },
    { min: 3, key: 'yellow', color: '#fde047' },
    { min: 6, key: 'orange', color: '#fb923c' },
    { min: 9, key: 'green', color: '#4ade80' },
    { min: 12, key: 'blue', color: '#60a5fa' },
    { min: 15, key: 'brown', color: '#a16207' },
    { min: 18, key: 'black', color: '#1f2937' }
  ];

  function belt(done) {
    let b = BELTS[0];
    BELTS.forEach((x) => { if (done >= x.min) b = x; });
    return b;
  }

  function summary(slug) {
    const u = data.users[slug];
    if (!u) return null;
    let done = 0, hints = 0, revealed = 0, understood = 0, time = 0, score = 0, attempts = 0;
    ids.forEach((id) => {
      const e = u.challenges[id];
      if (e.solved) { done += 1; time += e.durationMs || 0; }
      hints += e.hints || 0;
      attempts += e.attempts || 0;
      if (e.revealed) revealed += 1;
      if (e.quiz && e.quiz.correct) understood += 1;
      score += scoreEntry(e, byId.get(id));
    });
    const b = belt(done);
    const dan = done === ids.length && revealed === 0 && understood === ids.length;
    return {
      slug, name: u.name, lang: u.lang || 'fr', done, total: ids.length, hints, revealed, understood, timeMs: time,
      score, attempts, beltKey: b.key, dan, beltColor: b.color
    };
  }

  function leaderboard() {
    return Object.keys(data.users).map(summary).sort((a, b) =>
      b.done - a.done || b.score - a.score || a.timeMs - b.timeMs || a.name.localeCompare(b.name));
  }

  function exportUser(slug) {
    const u = data.users[slug];
    if (!u) return null;
    return { exportedAt: new Date().toISOString(), profile: { slug, name: u.name, lang: u.lang }, summary: summary(slug), challenges: u.challenges };
  }

  return {
    SESSION_COOKIE, blankEntry, save,
    listUsers, getUser, findByName, validUsername, createAccount, login, deleteUser, setLang, setActive, activeSlug,
    readSession, sessionCookie, clearSessionCookie, resolve,
    entry, resetEntries, scoreEntry, summary, leaderboard, exportUser, belt,
    get data() { return data; }
  };
}

module.exports = { createStore, blankEntry, slugify, SESSION_COOKIE, DEFAULT_NAME };

'use strict';

/*
 * Persistance : comptes, sessions, progression et journal des tentatives, dans une
 * base SQLite (lib/db.js). Chaque écriture ne touche que la ligne concernée.
 *
 *   users(slug, name, name_lower, lang, password_hash, salt, created_at)
 *   progress(slug, id, solved, hints, attempts, started_at, solved_at, duration_ms,
 *            revealed, quiz_tries, quiz_correct, updated_at)
 *   attempts(slug, id, at, method, url, port, headers_json, body_bytes, body_preview, code, ok, message)
 *   meta(key, value) : secret HMAC des sessions, dernier compte actif, version du schéma
 *
 * Une entrée de progression exposée au reste du code garde la forme historique :
 *   { solved, hints, attempts, startedAt, solvedAt, durationMs, revealed, quiz: { tries, correct } }
 * Elle est en lecture seule : les changements passent par recordAttempt, markSolved,
 * setHints, markRevealed, answerQuiz, startEntry, resetEntries.
 *
 * Au premier démarrage, un progress.json (v1, v2 ou v3) présent à côté est importé,
 * puis renommé progress.json.migrated. Les profils hérités sans mot de passe sont
 * « réclamés » à la première connexion sous ce pseudo.
 */

const fs = require('fs');
const crypto = require('crypto');
const util = require('util');
const dbmod = require('./db');

const SESSION_COOKIE = 'dojo_session';
const SESSION_DAYS = 30;
const DEFAULT_NAME = 'Joueur 1';
const USERNAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,30}[\p{L}\p{N}._-]$/u;
const LOG_KEEP = 8;           // tentatives conservées par (compte, défi)
const BOARD_TTL_MS = 5000;    // durée de vie du classement en cache

const scrypt = util.promisify(crypto.scrypt);

function blankEntry() {
  return {
    solved: false, hints: 0, attempts: 0,
    startedAt: null, solvedAt: null, durationMs: null,
    revealed: false, quiz: { tries: 0, correct: false }
  };
}

function slugify(name) {
  return String(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'joueur';
}

async function hashPassword(password, salt) {
  return (await scrypt(String(password), salt, 32)).toString('hex');
}

function safeEqual(a, b) {
  const A = Buffer.from(String(a)); const B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

function num(v) { return v == null ? null : Number(v); }

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

function scoreEntry(e, ch) {
  if (!e || !e.solved) return 0;
  const base = (ch ? ch.stars : 1) * 100;
  let s = base;
  s -= Math.min(3, e.hints || 0) * base * 0.10;
  if (e.revealed) s -= base * 0.5;
  if (e.quiz && e.quiz.correct) s += e.quiz.tries === 1 ? 25 : 10;
  return Math.max(0, Math.round(s));
}

/*
 * opts : { dbFile, progressFile (source de migration, optionnel), ids, challenges }
 * `file` reste accepté comme alias de dbFile.
 */
function createStore(opts) {
  const dbFile = opts.dbFile || opts.file;
  const progressFile = opts.progressFile || null;
  const ids = opts.ids.slice();
  const challenges = opts.challenges;
  const byId = new Map(challenges.map((c) => [c.id, c]));
  const quiet = !!process.env.DOJO_QUIET;

  ids.forEach((id) => { if (!/^[\w-]+$/.test(id)) throw new Error('identifiant de défi invalide : ' + id); });
  const ID_LIST = ids.map((id) => "'" + id + "'").join(',');
  const BASE_SQL = 'CASE p.id ' + ids.map((id) => "WHEN '" + id + "' THEN " + ((byId.get(id) || { stars: 1 }).stars * 100)).join(' ') + ' ELSE 100 END';
  // Même barème que scoreEntry, en arithmétique entière (base multiple de 100).
  const SCORE_SQL = 'CASE WHEN p.solved THEN MAX(0, ' + BASE_SQL + ' - MIN(3, p.hints) * (' + BASE_SQL + ') / 10' +
    ' - CASE WHEN p.revealed THEN (' + BASE_SQL + ') / 2 ELSE 0 END' +
    ' + CASE WHEN p.quiz_correct THEN CASE WHEN p.quiz_tries = 1 THEN 25 ELSE 10 END ELSE 0 END) ELSE 0 END';
  const AGG_SQL =
    'COALESCE(SUM(p.solved), 0) AS done, ' +
    'COALESCE(SUM(CASE WHEN p.solved THEN COALESCE(p.duration_ms, 0) ELSE 0 END), 0) AS time_ms, ' +
    'COALESCE(SUM(p.hints), 0) AS hints, COALESCE(SUM(p.attempts), 0) AS attempts, ' +
    'COALESCE(SUM(p.revealed), 0) AS revealed, COALESCE(SUM(p.quiz_correct), 0) AS understood, ' +
    'COALESCE(SUM(' + SCORE_SQL + '), 0) AS score';

  const h = dbmod.open(dbFile);
  const { tx, prepare } = h;

  let cachedSecret = null;
  let board = null;      // { at, rows } : classement mémoïsé
  let dirty = true;      // une écriture locale invalide le cache

  function touched() { dirty = true; }

  /* ---------------- secret et jetons ---------------- */

  function ensureSecret() {
    return tx(() => {
      let s = h.getMeta('secret');
      if (!s) { s = crypto.randomBytes(32).toString('hex'); h.setMeta('secret', s); }
      return s;
    });
  }
  function secret() {
    if (process.env.DOJO_SECRET) return process.env.DOJO_SECRET;
    if (!cachedSecret) cachedSecret = ensureSecret();
    return cachedSecret;
  }
  /* Jeton de l'API de l'exercice (défis 12 et 16) : dérivé du secret, donc identique
   * entre workers et stable d'un redémarrage à l'autre. */
  function apiToken() {
    return 'ops_' + crypto.createHmac('sha256', secret()).update('session-token').digest('hex').slice(0, 24);
  }

  /* ---------------- migration depuis progress.json ---------------- */

  function isBlank(e) {
    return !e.solved && !e.hints && !e.attempts && !e.startedAt && !e.revealed && !(e.quiz && e.quiz.tries);
  }

  function importProgressJson(file) {
    let d;
    try { d = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return false; }
    if (!d || typeof d !== 'object') return false;
    if (!d.users) { // v1 : un seul joueur, clés au premier niveau
      const legacy = d.challenges || {};
      d = { activeUser: slugify(DEFAULT_NAME), users: { [slugify(DEFAULT_NAME)]: { name: DEFAULT_NAME, createdAt: Date.now(), challenges: legacy } } };
    }
    const now = Date.now();
    let users = 0, rows = 0;
    tx(() => {
      if (d.secret && !h.getMeta('secret')) h.setMeta('secret', String(d.secret));
      Object.keys(d.users).forEach((slug) => {
        const u = d.users[slug] || {};
        const name = String(u.name || slug).trim() || slug;
        try {
          insertUser.run(slug, name, name.toLowerCase(), u.lang === 'en' ? 'en' : 'fr', u.passwordHash || null, u.salt || null, Number(u.createdAt) || now);
        } catch (e) { return; } // slug ou pseudo en doublon dans un fichier corrompu : ignoré
        users += 1;
        const ch = u.challenges || {};
        ids.forEach((id) => {
          const e = ch[id];
          if (!e || typeof e !== 'object' || isBlank(e)) return;
          writeEntry(slug, id, Object.assign(blankEntry(), e, { quiz: Object.assign({ tries: 0, correct: false }, e.quiz || {}) }), now);
          rows += 1;
        });
      });
      if (d.activeUser && d.users[d.activeUser]) h.setMeta('active_user', String(d.activeUser));
    });
    try { fs.renameSync(file, file + '.migrated'); } catch (e) { /* lecture seule : la base fait foi désormais */ }
    if (!quiet) console.log('  progress.json importé dans ' + dbFile + ' (' + users + ' compte(s), ' + rows + ' entrée(s)), renommé en progress.json.migrated');
    return true;
  }

  /* ---------------- requêtes préparées ---------------- */

  const insertUser = prepare('INSERT INTO users (slug, name, name_lower, lang, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const selectUser = prepare('SELECT slug, name, lang, created_at, password_hash, salt FROM users WHERE slug = ?');
  const selectSlugByName = prepare('SELECT slug FROM users WHERE name_lower = ?');
  const selectUsers = prepare('SELECT slug, name, lang, created_at FROM users ORDER BY created_at, slug');
  const userExists = prepare('SELECT 1 FROM users WHERE slug = ?');
  const updatePassword = prepare('UPDATE users SET password_hash = ?, salt = ? WHERE slug = ?');
  const updateLang = prepare('UPDATE users SET lang = ? WHERE slug = ?');
  const deleteUserRow = prepare('DELETE FROM users WHERE slug = ?');
  const deleteProgressOf = prepare('DELETE FROM progress WHERE slug = ?');
  const deleteAttemptsOf = prepare('DELETE FROM attempts WHERE slug = ?');
  const deleteAttemptsOfId = prepare('DELETE FROM attempts WHERE slug = ? AND id = ?');
  const selectEntry = prepare('SELECT * FROM progress WHERE slug = ? AND id = ?');
  const selectEntries = prepare('SELECT * FROM progress WHERE slug = ?');
  const upsertEntry = prepare(
    'INSERT INTO progress (slug, id, solved, hints, attempts, started_at, solved_at, duration_ms, revealed, quiz_tries, quiz_correct, updated_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(slug, id) DO UPDATE SET ' +
    'solved = excluded.solved, hints = excluded.hints, attempts = excluded.attempts, started_at = excluded.started_at, ' +
    'solved_at = excluded.solved_at, duration_ms = excluded.duration_ms, revealed = excluded.revealed, ' +
    'quiz_tries = excluded.quiz_tries, quiz_correct = excluded.quiz_correct, updated_at = excluded.updated_at');
  const selectSummary = prepare('SELECT ' + AGG_SQL + ' FROM progress p WHERE p.slug = ? AND p.id IN (' + ID_LIST + ')');
  const selectBoard = prepare('SELECT u.slug, u.name, u.lang, ' + AGG_SQL + ' FROM users u LEFT JOIN progress p ON p.slug = u.slug AND p.id IN (' + ID_LIST + ') GROUP BY u.slug');
  const insertAttempt = prepare('INSERT INTO attempts (slug, id, at, method, url, port, headers_json, body_bytes, body_preview, code, ok, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const purgeAttempts = prepare('DELETE FROM attempts WHERE slug = ? AND id = ? AND rowid NOT IN (SELECT rowid FROM attempts WHERE slug = ? AND id = ? ORDER BY at DESC, rowid DESC LIMIT ' + LOG_KEEP + ')');
  const selectAttempts = prepare('SELECT * FROM attempts WHERE slug = ? AND id = ? ORDER BY at DESC, rowid DESC LIMIT ' + LOG_KEEP);
  const countUsers = prepare('SELECT COUNT(*) AS n FROM users');

  /* Premier démarrage : import de l'ancien fichier si la base est vide. */
  if (progressFile && fs.existsSync(progressFile) && countUsers.get().n === 0) importProgressJson(progressFile);
  secret();

  /* ---------------- comptes ---------------- */

  function userOf(r) {
    return r ? { slug: r.slug, name: r.name, createdAt: num(r.created_at), lang: r.lang || 'fr', hasPassword: !!r.password_hash } : null;
  }

  function listUsers() { return selectUsers.all().map(userOf); }

  function getUser(slug) { return slug ? userOf(selectUser.get(String(slug))) : null; }

  function findByName(name) {
    const r = selectSlugByName.get(String(name || '').trim().toLowerCase());
    return r ? r.slug : null;
  }

  function validUsername(name) { return USERNAME_RE.test(String(name || '').trim()); }

  function setActive(slug) {
    if (!slug) return;
    tx(() => {
      if (h.getMeta('active_user') !== slug && userExists.get(slug)) h.setMeta('active_user', slug);
    });
  }
  function activeSlug() {
    const s = h.getMeta('active_user');
    return s && userExists.get(s) ? s : (selectUsers.get() || {}).slug || null;
  }

  /* Inscription. Un profil hérité sans mot de passe portant ce pseudo est réclamé. */
  async function createAccount(name, password, lang) {
    if (!validUsername(name)) return { ok: false, error: 'username' };
    if (String(password || '').length < 8) return { ok: false, error: 'password' };
    const clean = String(name).trim();
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await hashPassword(password, salt);
    const wantedLang = lang ? (lang === 'en' ? 'en' : 'fr') : null;
    return tx(() => {
      const existing = findByName(clean);
      if (existing) {
        if (selectUser.get(existing).password_hash) return { ok: false, error: 'taken' };
        updatePassword.run(hash, salt, existing);
        if (wantedLang) updateLang.run(wantedLang, existing);
        h.setMeta('active_user', existing);
        touched();
        return { ok: true, slug: existing, claimed: true };
      }
      let slug = slugify(clean);
      const base = slug;
      let n = 2;
      while (userExists.get(slug)) { slug = base + '-' + n; n += 1; }
      insertUser.run(slug, clean, clean.toLowerCase(), wantedLang || 'fr', hash, salt, Date.now());
      h.setMeta('active_user', slug);
      touched();
      return { ok: true, slug };
    });
  }

  async function login(name, password) {
    const slug = findByName(name);
    if (!slug) return { ok: false };
    const u = selectUser.get(slug);
    if (!u) return { ok: false };
    if (!u.password_hash) {
      if (String(password || '').length < 8) return { ok: false, error: 'password' };
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = await hashPassword(password, salt);
      tx(() => {
        const again = selectUser.get(slug);
        if (again && !again.password_hash) updatePassword.run(hash, salt, slug);
        h.setMeta('active_user', slug);
      });
      return { ok: true, slug, claimed: true };
    }
    if (!safeEqual(await hashPassword(password, u.salt), u.password_hash)) return { ok: false };
    setActive(slug);
    return { ok: true, slug };
  }

  function deleteUser(slug) {
    return tx(() => {
      if (!userExists.get(slug)) return false;
      deleteAttemptsOf.run(slug);
      deleteProgressOf.run(slug);
      deleteUserRow.run(slug);
      if (h.getMeta('active_user') === slug) h.setMeta('active_user', (selectUsers.get() || {}).slug || null);
      touched();
      return true;
    });
  }

  function setLang(slug, lang) {
    const r = updateLang.run(lang === 'en' ? 'en' : 'fr', slug);
    if (r.changes) touched();
    return r.changes > 0;
  }

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
    return userExists.get(slug) ? slug : null;
  }

  /* Le résultat est mémorisé sur la requête : plusieurs couches l'interrogent. */
  function readSession(req) {
    if (req._dojoSlug !== undefined) return req._dojoSlug;
    const raw = req.headers.cookie || '';
    const m = raw.match(new RegExp('(?:^|;\\s*)' + SESSION_COOKIE + '=([^;]+)'));
    const slug = m ? readToken(decodeURIComponent(m[1])) : null;
    req._dojoSlug = slug;
    return slug;
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

  function entryOf(r) {
    return {
      solved: !!r.solved, hints: num(r.hints) || 0, attempts: num(r.attempts) || 0,
      startedAt: num(r.started_at), solvedAt: num(r.solved_at), durationMs: num(r.duration_ms),
      revealed: !!r.revealed, quiz: { tries: num(r.quiz_tries) || 0, correct: !!r.quiz_correct }
    };
  }

  function writeEntry(slug, id, e, now) {
    upsertEntry.run(slug, id, e.solved ? 1 : 0, e.hints || 0, e.attempts || 0, e.startedAt || null, e.solvedAt || null,
      e.durationMs == null ? null : e.durationMs, e.revealed ? 1 : 0, (e.quiz && e.quiz.tries) || 0, e.quiz && e.quiz.correct ? 1 : 0, now || Date.now());
    touched();
  }

  /* Entrée d'un défi (vierge si jamais touchée), null si le compte n'existe pas. */
  function entry(slug, id) {
    if (!slug) return null;
    const r = selectEntry.get(slug, id);
    if (r) return entryOf(r);
    return userExists.get(slug) ? blankEntry() : null;
  }

  /* Toutes les entrées d'un compte en une requête, plus un numéro de version
   * (dernière écriture) utile pour les réponses conditionnelles. */
  function snapshot(slug) {
    if (!slug || !userExists.get(slug)) return null;
    const entries = {};
    let version = 0;
    ids.forEach((id) => { entries[id] = blankEntry(); });
    selectEntries.all(slug).forEach((r) => {
      if (entries[r.id]) entries[r.id] = entryOf(r);
      version = Math.max(version, num(r.updated_at) || 0);
    });
    return { entries, version };
  }
  function entries(slug) {
    const s = snapshot(slug);
    return s ? s.entries : null;
  }

  /* Lecture-modification-écriture d'une entrée sous verrou. */
  function mutate(slug, id, fn) {
    return tx(() => {
      const e = entry(slug, id);
      if (!e) return null;
      if (fn(e) !== false) writeEntry(slug, id, e);
      return e;
    });
  }

  function startEntry(slug, id) {
    return mutate(slug, id, (e) => {
      if (e.solved || e.startedAt) return false;
      e.startedAt = Date.now();
    });
  }

  function recordAttempt(slug, id) {
    return mutate(slug, id, (e) => {
      e.attempts += 1;
      if (!e.startedAt) e.startedAt = Date.now();
    });
  }

  function markSolved(slug, id) {
    return mutate(slug, id, (e) => {
      if (e.solved) return false;
      e.solved = true;
      e.solvedAt = Date.now();
      e.durationMs = e.startedAt ? e.solvedAt - e.startedAt : null;
    });
  }

  function setHints(slug, id, level) {
    return mutate(slug, id, (e) => {
      if (level <= e.hints) return false;
      e.hints = level;
    });
  }

  function markRevealed(slug, id) {
    return mutate(slug, id, (e) => {
      if (e.solved || e.revealed) return false;
      e.revealed = true;
    });
  }

  function answerQuiz(slug, id, correct) {
    return mutate(slug, id, (e) => {
      if (e.quiz.correct) return false;
      e.quiz.tries += 1;
      e.quiz.correct = !!correct;
    });
  }

  /* Remise à zéro : entrées vierges (horodatées, pour que la version change) et journal purgé. */
  function resetEntries(slug, only) {
    tx(() => {
      if (!userExists.get(slug)) return;
      const now = Date.now();
      ids.forEach((id) => {
        if (only && only.indexOf(id) === -1) return;
        writeEntry(slug, id, blankEntry(), now);
        deleteAttemptsOfId.run(slug, id);
      });
    });
  }

  /* ---------------- journal des tentatives ---------------- */

  /* rec = { at, method, url, port, headers, bodyBytes, bodyPreview, code, ok, message } */
  function recordVerdict(slug, id, rec) {
    if (!slug) return;
    tx(() => {
      insertAttempt.run(slug, id, rec.at, rec.method, rec.url, rec.port == null ? null : rec.port, JSON.stringify(rec.headers || {}),
        rec.bodyBytes || 0, rec.bodyPreview || '', rec.code, rec.ok ? 1 : 0, rec.message);
      purgeAttempts.run(slug, id, slug, id);
    });
  }

  function attemptOf(r) {
    let headers = {};
    try { headers = JSON.parse(r.headers_json) || {}; } catch (e) { headers = {}; }
    return {
      at: num(r.at), method: r.method, url: r.url, port: num(r.port), headers,
      bodyBytes: num(r.body_bytes) || 0, bodyPreview: r.body_preview || '', code: num(r.code), ok: !!r.ok, message: r.message
    };
  }

  /* Dernières tentatives (la plus récente en premier). */
  function attempts(slug, id) {
    return slug ? selectAttempts.all(slug, id).map(attemptOf) : [];
  }

  /* Dernier verdict au format attendu par le client (miroir de l'ancien lastAttempt). */
  function lastAttemptOf(a) {
    if (!a) return null;
    const hd = a.headers || {};
    return {
      ok: a.ok, code: a.code, message: a.message,
      received: {
        method: a.method, url: a.url, origin: hd.origin || null, contentType: hd['content-type'] || null,
        bodyBytes: a.bodyBytes, bodyPreview: a.bodyPreview, apiToken: hd['x-api-token'] ? 'présent' : 'absent'
      },
      at: a.at
    };
  }

  function clearAttempts(slug, only) {
    tx(() => {
      if (!only) return deleteAttemptsOf.run(slug);
      only.forEach((id) => deleteAttemptsOfId.run(slug, id));
    });
  }

  /* ---------------- score ---------------- */

  function summaryOf(slug, name, lang, r) {
    const done = num(r.done) || 0;
    const revealed = num(r.revealed) || 0;
    const understood = num(r.understood) || 0;
    const b = belt(done);
    const dan = done === ids.length && revealed === 0 && understood === ids.length;
    return {
      slug, name, lang: lang || 'fr', done, total: ids.length, hints: num(r.hints) || 0, revealed, understood, timeMs: num(r.time_ms) || 0,
      score: num(r.score) || 0, attempts: num(r.attempts) || 0, beltKey: b.key, dan, beltColor: b.color
    };
  }

  function summary(slug) {
    const u = slug ? selectUser.get(slug) : null;
    if (!u) return null;
    return summaryOf(slug, u.name, u.lang, selectSummary.get(slug));
  }

  function sortBoard(rows) {
    return rows.sort((a, b) => b.done - a.done || b.score - a.score || a.timeMs - b.timeMs || a.name.localeCompare(b.name));
  }

  /* Classement : une requête agrégée, mémoïsée jusqu'à la prochaine écriture locale
   * et au plus BOARD_TTL_MS (les autres workers écrivent aussi). */
  function leaderboard() {
    const now = Date.now();
    if (board && !dirty && now - board.at < BOARD_TTL_MS) return board.rows.slice();
    const rows = sortBoard(selectBoard.all().map((r) => summaryOf(r.slug, r.name, r.lang, r)));
    board = { at: now, rows };
    dirty = false;
    return rows.slice();
  }

  function exportUser(slug) {
    const u = getUser(slug);
    if (!u) return null;
    return { exportedAt: new Date().toISOString(), profile: { slug, name: u.name, lang: u.lang }, summary: summary(slug), challenges: entries(slug) };
  }

  function close() { h.close(); }

  return {
    SESSION_COOKIE, blankEntry, dbFile, close,
    listUsers, getUser, findByName, validUsername, createAccount, login, deleteUser, setLang, setActive, activeSlug,
    readSession, sessionCookie, clearSessionCookie, resolve, apiToken,
    entry, entries, snapshot, startEntry, recordAttempt, markSolved, setHints, markRevealed, answerQuiz, resetEntries,
    recordVerdict, attempts, lastAttemptOf, clearAttempts,
    scoreEntry, summary, leaderboard, exportUser, belt
  };
}

module.exports = { createStore, blankEntry, slugify, scoreEntry, belt, SESSION_COOKIE, DEFAULT_NAME, LOG_KEEP };

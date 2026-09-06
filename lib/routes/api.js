'use strict';

/*
 * API de l'exercice (/api/*), journalisée dans le terminal et dans la table
 * attempts (panneau « Journal du serveur » des joueurs).
 */

const { BY_ID } = require('../render');

/* ---------------- journal terminal ---------------- */

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

function logVerdict(code, ok, message) {
  const tag = ok ? C.green('  └─> ' + code + '  ') : C.red('  └─> ' + code + '  ');
  out(tag + (ok ? C.green(message) : C.yellow(message)) + '\n');
}

function mount(app, ctx) {
  const { store, render: R, SESSION_TOKEN, SESSION_STARTED } = ctx;
  const { t, ctxOf, fmtDuration } = R;

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

  /* Mémorise le verdict pour le panneau « Journal du serveur » (comptes connectés seulement). */
  function remember(req, slug, id, code, ok, message, rec) {
    if (!slug) return;
    const h = req.headers;
    store.recordVerdict(slug, id, {
      at: Date.now(), method: req.method, url: req.originalUrl, port: req.socket.localPort,
      headers: {
        'content-type': h['content-type'] || null, 'content-length': h['content-length'] || null,
        'x-api-token': h['x-api-token'] ? '… ' + String(h['x-api-token']).slice(-4) : null,
        origin: h.origin || null, 'access-control-request-method': h['access-control-request-method'] || null,
        'access-control-request-headers': h['access-control-request-headers'] || null
      },
      bodyBytes: rec.bodyBytes, bodyPreview: rec.bodyPreview, code, ok, message
    });
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
    const c0 = ctxOf(req);
    const lang = c0.lang;
    const slug = c0.slug;
    if (!c) {
      logVerdict(404, false, t(lang, 'api.unknown'));
      return res.status(404).json({ ok: false, error: t(lang, 'api.unknown') });
    }
    const e = slug ? store.recordAttempt(slug, id) : null;

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
    const done = already ? e : store.markSolved(slug, id);
    const pts = store.scoreEntry(done, c);
    const msg = already
      ? t(lang, 'api.already')
      : t(lang, 'api.solved', { id, time: fmtDuration(done.durationMs, lang), hints: done.hints || 0, revealed: done.revealed ? t(lang, 'api.solved.revealed') : '', pts });
    remember(req, slug, id, 200, true, msg, received(req));
    logVerdict(200, true, msg);
    res.status(200).json({ ok: true, credited: true, message: msg, challengeId: id, durationMs: done.durationMs, hints: done.hints || 0, score: pts });
  });

  app.all('/api/*', (req, res) => {
    const msg = t(ctxOf(req).lang, 'api.noroute', { url: req.originalUrl });
    logVerdict(404, false, msg);
    res.status(404).json({ ok: false, error: msg });
  });
}

module.exports = { mount, term: { C, out } };

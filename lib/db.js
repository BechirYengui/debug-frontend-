'use strict';

/*
 * Base SQLite (module intégré node:sqlite, sans dépendance) : ouverture, pragmas,
 * schéma et migrations. La logique métier vit dans lib/store.js.
 *
 * Fichier : DOJO_DB_FILE, sinon ./dojo.sqlite à la racine du projet. Si seul
 * DOJO_PROGRESS_FILE est défini (ancien réglage), la base est créée à côté de ce
 * fichier, qui sert de source de migration.
 */

const path = require('path');

/* node:sqlite est encore marqué « expérimental » dans certaines versions : on masque
 * uniquement cet avertissement, le module est stable depuis Node 22.13 sans flag. */
const { DatabaseSync } = (() => {
  const orig = process.emitWarning;
  process.emitWarning = function (warning, ...rest) {
    const type = typeof rest[0] === 'string' ? rest[0] : (rest[0] && rest[0].type);
    if (type === 'ExperimentalWarning' && /SQLite/i.test(String(warning))) return;
    return orig.call(process, warning, ...rest);
  };
  try { return require('node:sqlite'); } finally { process.emitWarning = orig; }
})();

/* Chemins par défaut (serveur et scripts partagent la même règle). */
function defaultPaths(root) {
  const progressFile = process.env.DOJO_PROGRESS_FILE || path.join(root, 'progress.json');
  const dbFile = process.env.DOJO_DB_FILE ||
    (process.env.DOJO_PROGRESS_FILE ? path.join(path.dirname(progressFile), 'dojo.sqlite') : path.join(root, 'dojo.sqlite'));
  return { dbFile, progressFile };
}

/* Migrations : chaque entrée s'applique une fois, dans l'ordre ; meta.schema_version retient l'état. */
const MIGRATIONS = [
  `
  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS users (
    slug          TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    name_lower    TEXT NOT NULL UNIQUE,
    lang          TEXT NOT NULL DEFAULT 'fr',
    password_hash TEXT,
    salt          TEXT,
    created_at    INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS progress (
    slug         TEXT NOT NULL,
    id           TEXT NOT NULL,
    solved       INTEGER NOT NULL DEFAULT 0,
    hints        INTEGER NOT NULL DEFAULT 0,
    attempts     INTEGER NOT NULL DEFAULT 0,
    started_at   INTEGER,
    solved_at    INTEGER,
    duration_ms  INTEGER,
    revealed     INTEGER NOT NULL DEFAULT 0,
    quiz_tries   INTEGER NOT NULL DEFAULT 0,
    quiz_correct INTEGER NOT NULL DEFAULT 0,
    updated_at   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (slug, id)
  );
  CREATE TABLE IF NOT EXISTS attempts (
    rowid        INTEGER PRIMARY KEY AUTOINCREMENT,
    slug         TEXT NOT NULL,
    id           TEXT NOT NULL,
    at           INTEGER NOT NULL,
    method       TEXT,
    url          TEXT,
    port         INTEGER,
    headers_json TEXT,
    body_bytes   INTEGER,
    body_preview TEXT,
    code         INTEGER,
    ok           INTEGER NOT NULL DEFAULT 0,
    message      TEXT
  );
  CREATE INDEX IF NOT EXISTS attempts_by_entry ON attempts (slug, id, at DESC);
  `
];

function open(file) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA foreign_keys = ON');

  let depth = 0;
  /* Transaction (BEGIN IMMEDIATE : prend le verrou d'écriture tout de suite, ce qui
   * sérialise proprement les lectures-modifications entre workers). Réentrante. */
  function tx(fn) {
    if (depth > 0) return fn();
    db.exec('BEGIN IMMEDIATE');
    depth += 1;
    try {
      const r = fn();
      db.exec('COMMIT');
      return r;
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch (e2) { /* déjà annulée */ }
      throw e;
    } finally {
      depth -= 1;
    }
  }

  const cache = new Map();
  function prepare(sql) {
    let st = cache.get(sql);
    if (!st) { st = db.prepare(sql); cache.set(sql, st); }
    return st;
  }

  function getMeta(key) {
    const r = prepare('SELECT value FROM meta WHERE key = ?').get(key);
    return r ? r.value : null;
  }
  function setMeta(key, value) {
    prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value == null ? null : String(value));
  }

  /* Schéma et migrations, sous verrou d'écriture : plusieurs workers peuvent démarrer ensemble. */
  tx(() => {
    db.exec(MIGRATIONS[0]); // la table meta doit exister pour lire la version
    let version = parseInt(getMeta('schema_version'), 10) || 0;
    for (let v = version; v < MIGRATIONS.length; v++) {
      db.exec(MIGRATIONS[v]);
      version = v + 1;
    }
    setMeta('schema_version', version);
  });

  return {
    db, tx, prepare, getMeta, setMeta,
    close() { cache.clear(); db.close(); }
  };
}

module.exports = { open, defaultPaths, SCHEMA_VERSION: MIGRATIONS.length };

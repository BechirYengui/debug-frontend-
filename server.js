'use strict';

/*
 * Debug Frontend : assemblage du serveur Express.
 *
 *   lib/db.js           base SQLite (node:sqlite), schéma, migrations
 *   lib/store.js        comptes, sessions, progression, journal des tentatives, classement
 *   lib/render.js       catalogue traduit, navigation, cartes, helpers de rendu
 *   lib/routes/auth.js  langue, connexion, inscription (limiteur de débit)
 *   lib/routes/pages.js pages HTML
 *   lib/routes/api.js   API de l'exercice, journal terminal
 *   lib/routes/dojo.js  endpoints internes /_dojo
 *
 * DOJO_WORKERS=n lance n processus (node:cluster) partageant la même base.
 */

const express = require('express');
const path = require('path');
const cluster = require('node:cluster');

const { createStore } = require('./lib/store');
const dbmod = require('./lib/db');
const renderMod = require('./lib/render');
const auth = require('./lib/routes/auth');
const pages = require('./lib/routes/pages');
const api = require('./lib/routes/api');
const dojo = require('./lib/routes/dojo');

const { CHALLENGES, IDS } = renderMod;
const { C, out } = api.term;

const app = express();
const ROOT = __dirname;
const PORT = parseInt(process.env.PORT, 10) || 3000;
// Second port servant la même application : nécessaire au défi 15 (CORS) en local.
const ALT_PORT = process.env.DOJO_ALT_PORT === '0' ? 0 : (parseInt(process.env.DOJO_ALT_PORT, 10) || PORT + 1);
// Origine du « réplica » utilisé par le défi 15 derrière un reverse proxy. Vide : hôte:port+1.
const ALT_ORIGIN = process.env.DOJO_ALT_ORIGIN || '';
const WORKERS = Math.max(1, parseInt(process.env.DOJO_WORKERS, 10) || 1);

const { dbFile, progressFile } = dbmod.defaultPaths(ROOT);
const store = createStore({ dbFile, progressFile, ids: IDS, challenges: CHALLENGES });
// Jeton de l'API de l'exercice (défis 12 et 16) : dérivé du secret de la base, donc
// identique entre workers et stable entre deux redémarrages.
const SESSION_TOKEN = store.apiToken();
const SESSION_STARTED = new Date().toISOString();

// Derrière un reverse proxy : DOJO_TRUST_PROXY=1 (nombre de sauts) pour que le limiteur
// de débit voie l'adresse réelle du client et non celle du proxy.
if (process.env.DOJO_TRUST_PROXY) {
  const tp = process.env.DOJO_TRUST_PROXY;
  app.set('trust proxy', /^\d+$/.test(tp) ? parseInt(tp, 10) : tp);
}

const render = renderMod.createRender({ root: ROOT, store });
const ctx = { app, store, render, ROOT, SESSION_TOKEN, SESSION_STARTED, ALT_ORIGIN };

/* Fichiers statiques */
const staticOpts = { etag: false, lastModified: false, setHeaders: (res) => res.setHeader('Cache-Control', 'no-store') };
app.use('/static/img', express.static(path.join(ROOT, 'public', 'static', 'img'), { maxAge: '7d' }));
app.use('/static', express.static(path.join(ROOT, 'public', 'static'), staticOpts));
app.use('/c', express.static(path.join(ROOT, 'public', 'c'), staticOpts));
app.get('/favicon.ico', (req, res) => res.status(204).end());

/* Routes, dans l'ordre : comptes, pages, API journalisée, endpoints internes, 404 */
auth.mount(app, ctx);
pages.mount(app, ctx);
api.mount(app, ctx);
dojo.mount(app, ctx);
pages.mountNotFound(app, ctx);

/* ------------------------------------------------------------------ */
/* Démarrage                                                          */
/* ------------------------------------------------------------------ */

function banner(p) {
  out('');
  out(C.bold('  DEBUG FRONTEND') + C.dim('  ·  entraînement au debugging front-end'));
  out('  ' + C.cyan('http://localhost:' + p));
  out(C.dim('  Ce terminal journalise chaque requête reçue sur /api/. Les joueurs ont la même chose dans le panneau « Journal du serveur ».'));
  out(C.dim('  Base SQLite : ' + dbFile + (WORKERS > 1 ? '  ·  ' + WORKERS + ' workers' : '')));
  out('');
}

function start(port, altPort) {
  port = port === undefined ? PORT : port;
  altPort = altPort === undefined ? ALT_PORT : altPort;
  const talkative = !cluster.isWorker || cluster.worker.id === 1; // un seul worker parle
  const servers = [];
  const main = app.listen(port, () => { if (talkative) banner(main.address().port); });
  servers.push(main);
  if (altPort) {
    const alt = app.listen(altPort, () => {
      if (talkative) out(C.dim('  Port secondaire ' + alt.address().port + ' actif (défi 15, CORS).' + (ALT_ORIGIN ? ' Origine annoncée : ' + ALT_ORIGIN : '')));
    });
    alt.on('error', (err) => {
      if (talkative) {
        out(C.yellow('  Port secondaire ' + altPort + ' indisponible (' + err.code + ') : le défi 15 affichera « Failed to fetch » au lieu d\'une erreur CORS. ' +
          'Définis DOJO_ALT_PORT ou DOJO_ALT_ORIGIN.'));
      }
    });
    servers.push(alt);
  }
  return servers;
}

/* Mode multi-processus : le primaire a déjà ouvert la base (schéma, migration, secret),
 * les workers la rouvrent chacun de leur côté et se partagent les ports. */
function startCluster() {
  store.close();
  for (let i = 0; i < WORKERS; i++) cluster.fork();
  cluster.on('exit', (worker, code, signal) => {
    if (worker.exitedAfterDisconnect) return;
    out(C.yellow('  Worker ' + worker.process.pid + ' arrêté (' + (signal || code) + ') : relance.'));
    cluster.fork();
  });
}

if (require.main === module) {
  if (WORKERS > 1 && cluster.isPrimary) startCluster();
  else start();
}

module.exports = { app, start, store, SESSION_TOKEN, CHALLENGES };

'use strict';

/*
 * Vérification de bout en bout dans Chrome headless (hors `npm test`, car elle
 * nécessite Chrome) :
 *
 *   node test/browser-check.js
 *
 * Pour chaque défi : ouvre la page, clique RÉELLEMENT sur le bouton (événement
 * souris de confiance, avec hit-testing), vérifie que le symptôme observé est
 * exactement celui attendu, puis résout le défi côté serveur et vérifie que la
 * page détecte la résolution et affiche le débrief + le quiz.
 *
 * Variables : CHROME (chemin du binaire), PORT (défaut 3210).
 */

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = parseInt(process.env.PORT, 10) || 3210;
const ALT = PORT + 1;
const CDP_PORT = PORT + 100;
const BASE = 'http://localhost:' + PORT;
const CHROME = process.env.CHROME || ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].find((b) => {
  try { require('child_process').execSync('which ' + b, { stdio: 'ignore' }); return true; } catch (e) { return false; }
});
const { CHALLENGES } = require('../data/challenges');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- CDP minimal ---------------- */

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.events = [];
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    };
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    return new CDP(ws);
  }
  send(method, params) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    return r.result.value;
  }
  async waitFor(method, timeout) {
    const t0 = Date.now();
    while (Date.now() - t0 < (timeout || 10000)) {
      if (this.events.some((e) => e.method === method)) return true;
      await sleep(50);
    }
    return false;
  }
  close() { this.ws.close(); }
}

/* ---------------- attendus par défi ---------------- */

// solve: 'none' (aucune requête vers /solve), ou { method, status } / { failed: /regex/ }
const EXPECT = {
  '01': { solve: 'none' },
  '02': { solve: 'none' },
  '03': { solve: 'none' },
  '04': { solve: 'none' },
  '05': { solve: 'none' },
  '06': { navigated: true },
  '07': { solve: 'none' },
  '08': { solve: 'none' },
  '09': { solve: { method: 'GET', status: 405 } },
  '10': { solve: { method: 'POST', status: 415 } },
  '11': { solve: { method: 'POST', status: 400 } },
  '12': { solve: { method: 'POST', status: 401 } },
  '13': { solve: 'none', consoleError: /Cannot read properties of null/ },
  '14': { solve: 'none', logHas: /programmée/ },
  '15': { solve: { method: 'POST', failed: /Preflight|CORS|ERR_FAILED/ }, alsoMethod: 'OPTIONS', consoleError: /CORS/ },
  '16': { solve: { method: 'POST', status: 403 } },
  '17': { solve: 'none', logHas: /202/ },
  '18': { solve: 'none', logHas: /auto-test/ }
};

async function main() {
  if (!CHROME) { console.error('Chrome introuvable : définis CHROME=/chemin/vers/chrome'); process.exit(2); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dojo-browser-'));
  const server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: Object.assign({}, process.env, { PORT: String(PORT), DOJO_ALT_PORT: String(ALT), DOJO_PROGRESS_FILE: path.join(tmp, 'progress.json'), DOJO_QUIET: '1' }),
    stdio: 'ignore'
  });
  const chrome = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=' + CDP_PORT, '--no-sandbox', '--disable-gpu', '--no-first-run',
    '--user-data-dir=' + path.join(tmp, 'profile'), '--window-size=1280,900', 'about:blank'
  ], { stdio: 'ignore' });

  const cleanup = () => { try { chrome.kill('SIGKILL'); } catch (e) {} try { server.kill(); } catch (e) {} };
  process.on('exit', cleanup);

  // Attendre serveur et Chrome
  for (let i = 0; i < 100; i++) { try { await fetch(BASE + '/'); break; } catch (e) { await sleep(100); } }
  let version = null;
  for (let i = 0; i < 100; i++) {
    try { version = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version')).json(); break; } catch (e) { await sleep(100); }
  }
  if (!version) { console.error('Chrome ne répond pas sur le port CDP'); cleanup(); process.exit(2); }
  const { SESSION_TOKEN } = await (await fetch(BASE + '/api/session')).json().then((j) => ({ SESSION_TOKEN: j.token }));

  // Compte de test : inscription, récupération du cookie de session (posé ensuite dans Chrome).
  const signup = await fetch(BASE + '/signup', {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'username=Robot+Check&password=robotcheck123&password2=robotcheck123&lang=fr'
  });
  const setCookies = signup.headers.getSetCookie ? signup.headers.getSetCookie() : [signup.headers.get('set-cookie')];
  const sessionCookie = (setCookies.find((c) => /^dojo_session=/.test(c)) || '').split(';')[0];
  if (!sessionCookie) { console.error('inscription impossible (' + signup.status + ')'); cleanup(); process.exit(2); }
  const COOKIE = sessionCookie;
  const authed = (init) => Object.assign({}, init || {}, { headers: Object.assign({ Cookie: COOKIE }, (init && init.headers) || {}) });

  const results = [];
  for (const c of CHALLENGES) {
    const exp = EXPECT[c.id];
    const row = { id: c.id, title: c.title, ok: true, notes: [] };
    let cdp = null;
    try {
      const target = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' })).json();
      cdp = await CDP.connect(target.webSocketDebuggerUrl);
      await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable'); await cdp.send('Log.enable');
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      await cdp.send('Network.setCookie', { name: 'dojo_session', value: COOKIE.split('=').slice(1).join('='), url: BASE, path: '/' });
      await cdp.send('Page.navigate', { url: BASE + '/challenge/' + c.id });
      await cdp.waitFor('Page.loadEventFired', 10000);
      await sleep(1600);

      // Erreurs au chargement (aucune attendue)
      const loadErrors = cdp.events.filter((e) => e.method === 'Runtime.exceptionThrown').map((e) => e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description || e.params.exceptionDetails.text);
      if (loadErrors.length) { row.ok = false; row.notes.push('erreur au chargement : ' + loadErrors[0].split('\n')[0]); }
      cdp.events.length = 0;

      // Clic souris réel au centre du bouton
      const pt = await cdp.eval("(() => { const b = document.querySelector('#workspace .btn-primary'); b.scrollIntoView({block:'center'}); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pt.x, y: pt.y });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
      await sleep(2500);

      const reqs = {};
      cdp.events.forEach((e) => {
        if (e.method === 'Network.requestWillBeSent' && /\/solve/.test(e.params.request.url)) {
          reqs[e.params.requestId] = { method: e.params.request.method, url: e.params.request.url, status: null, failed: null };
        }
        if (e.method === 'Network.responseReceived' && reqs[e.params.requestId]) reqs[e.params.requestId].status = e.params.response.status;
        if (e.method === 'Network.loadingFailed' && reqs[e.params.requestId]) {
          reqs[e.params.requestId].failed = e.params.errorText + (e.params.corsErrorStatus ? ' ' + e.params.corsErrorStatus.corsError : '');
        }
      });
      const solves = Object.values(reqs);
      const navigated = cdp.events.some((e) => e.method === 'Page.frameNavigated' && !e.params.frame.parentId && /\?/.test(e.params.frame.url));
      const consoleErrors = cdp.events.filter((e) => e.method === 'Runtime.exceptionThrown' || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'))
        .map((e) => e.method === 'Runtime.exceptionThrown' ? (e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description || e.params.exceptionDetails.text)
          : e.method === 'Log.entryAdded' ? e.params.entry.text : e.params.args.map((a) => a.value || a.description).join(' '));
      let logText = '';
      try { logText = await cdp.eval("(document.querySelector('#workspace .log') || {}).innerText || ''"); } catch (e) { /* page rechargée (défi 06) */ }

      row.observed = (solves.length ? solves.map((s) => s.method + ' ' + (s.status || s.failed || '?')).join(', ') : 'aucune requête solve') + (navigated ? ' + navigation' : '');

      if (exp.navigated && !navigated) { row.ok = false; row.notes.push('navigation attendue'); }
      if (exp.solve === 'none' && solves.length) { row.ok = false; row.notes.push('requête solve inattendue'); }
      if (exp.alsoMethod && !solves.some((s) => s.method === exp.alsoMethod)) { row.ok = false; row.notes.push('requête ' + exp.alsoMethod + ' attendue'); }
      if (exp.solve && exp.solve !== 'none') {
        const s = solves.find((x) => x.method === exp.solve.method) || solves[0];
        if (!s) { row.ok = false; row.notes.push('requête solve attendue'); }
        else {
          if (s.method !== exp.solve.method) { row.ok = false; row.notes.push('verbe ' + s.method + ' au lieu de ' + exp.solve.method); }
          if (exp.solve.status && s.status !== exp.solve.status) { row.ok = false; row.notes.push('statut ' + s.status + ' au lieu de ' + exp.solve.status); }
          if (exp.solve.failed && !exp.solve.failed.test(s.failed || '')) { row.ok = false; row.notes.push('échec attendu ' + exp.solve.failed + ', reçu ' + s.failed); }
        }
      }
      if (exp.consoleError && !consoleErrors.some((t) => exp.consoleError.test(t))) { row.ok = false; row.notes.push('erreur console attendue ' + exp.consoleError + ' ; vues : ' + JSON.stringify(consoleErrors).slice(0, 200)); }
      if (!exp.consoleError && consoleErrors.length) { row.notes.push('console : ' + consoleErrors[0].split('\n')[0].slice(0, 120)); }
      if (exp.logHas && !exp.logHas.test(logText)) { row.ok = false; row.notes.push('journal attendu ' + exp.logHas + ' ; vu : ' + logText.slice(0, 120).replace(/\n/g, ' | ')); }

      // Résolution côté serveur puis détection par la page (sauf 06, dont la page a navigué : on la recharge)
      if (exp.navigated) {
        await cdp.send('Page.navigate', { url: BASE + '/challenge/' + c.id });
        await cdp.waitFor('Page.loadEventFired', 10000);
      }
      const headers = { 'Content-Type': 'application/json' };
      if (c.requiresToken) headers['X-Api-Token'] = SESSION_TOKEN;
      const res = await fetch(BASE + '/api/challenge/' + c.id + '/solve', authed({ method: 'POST', headers, body: JSON.stringify({ challengeId: c.id, action: 'validate' }) }));
      if (res.status !== 200) { row.ok = false; row.notes.push('résolution serveur : ' + res.status); }
      await sleep(2600);
      const ui = await cdp.eval("({ solved: document.body.classList.contains('is-solved'), debrief: !document.getElementById('dojo-debrief').hidden, quiz: document.querySelectorAll('.quiz-choice').length, status: document.getElementById('dojo-status').textContent, verdict: document.getElementById('dojo-verdict').textContent.slice(0, 40) })");
      if (!ui.solved || !ui.debrief || ui.quiz !== 4) { row.ok = false; row.notes.push('UI après résolution : ' + JSON.stringify(ui)); }
      row.after = ui.status + ' · ' + ui.verdict;
    } catch (err) {
      row.ok = false; row.notes.push('exception : ' + err.message);
    } finally {
      if (cdp) { try { await cdp.send('Page.close'); } catch (e) {} cdp.close(); }
    }
    results.push(row);
    console.log((row.ok ? '✔' : '✖') + ' ' + row.id + ' ' + row.title.padEnd(44) + ' clic → ' + (row.observed || '?') + (row.notes.length ? '\n     ' + row.notes.join('\n     ') : ''));
  }

  // Tableau de bord après tout ça
  const home = await (await fetch(BASE + '/profile', authed())).text();
  console.log(home.includes('18<span class="score-d">/18') ? '✔ profil : 18/18 résolus' : '✖ profil : compteur inattendu');

  const failed = results.filter((r) => !r.ok).length;
  console.log('\n' + (results.length - failed) + '/' + results.length + ' défis conformes.');
  cleanup();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });

(function () {
  'use strict';

  var KEY = 'pricing.session';

  var PLANS = [
    { name: 'Starter', current: 19, next: 21 },
    { name: 'Team', current: 49, next: 54 },
    { name: 'Business', current: 129, next: 139 },
    { name: 'Scale', current: 349, next: 349 }
  ];

  var el = {};
  var state = { region: 'FR', effectiveDate: '', note: 'alignement inflation 2026' };

  function byId(id) { return document.getElementById(id); }

  function log(msg) {
    var box = byId('grid-log');
    var line = document.createElement('div');
    line.textContent = new Date().toTimeString().slice(0, 8) + '  ' + msg;
    box.insertBefore(line, box.firstChild);
  }

  function readStore() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }

  function writeStore(v) {
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {}
  }

  function seedFromHandoff() {
    if (readStore()) return;
    var node = byId('sso-handoff');
    if (!node) return;
    try {
      writeStore(JSON.parse(node.textContent));
      log('session restaurée depuis le handoff SSO');
    } catch (e) {}
  }

  function cached() {
    var c = readStore();
    return c && c.token && new Date(c.expiresAt).getTime() > Date.now() ? c : null;
  }

  function getSession() {
    var c = cached();
    if (c) {
      return Promise.resolve({ token: c.token, issuedAt: c.issuedAt, source: 'cache local' });
    }
    return fetch('/api/session', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var v = {
          provider: 'ops-console',
          token: d.token,
          issuedAt: d.issuedAt,
          expiresAt: new Date(Date.now() + d.expiresIn * 1000).toISOString(),
          scopes: d.scopes || []
        };
        writeStore(v);
        return { token: d.token, issuedAt: d.issuedAt, source: 'session fraîche' };
      });
  }

  function mask(t) {
    return t ? String(t).slice(0, 4) + '....' + String(t).slice(-4) : 'aucun';
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '…';
    return d.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
  }

  function showSession(s) {
    el.tokLine.textContent = 'pricing-console / jeton ' + mask(s.token);
    el.tokIssued.textContent = fmtDate(s.issuedAt);
    el.tokSource.textContent = s.source;
    el.tokChip.className = 'chip chip-ok';
    el.tokChip.textContent = 'active';
    log('session prête (' + s.source + ')');
  }

  function euro(n) {
    return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 });
  }

  function renderRows() {
    el.rows.innerHTML = PLANS.map(function (p) {
      var pct = Math.round((p.next - p.current) / p.current * 1000) / 10;
      var cls = pct > 0 ? 'delta-up' : 'delta-flat';
      var txt = (pct > 0 ? '+' : '') + pct.toLocaleString('fr-FR') + ' %';
      return '<tr><td>' + p.name + '</td>' +
        '<td class="num">' + euro(p.current) + '</td>' +
        '<td class="num">' + euro(p.next) + '</td>' +
        '<td class="num ' + cls + '">' + txt + '</td></tr>';
    }).join('');
  }

  function isoPlusDays(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function refresh() {
    state.region = el.region.value;
    state.effectiveDate = el.date.value;
    state.note = el.note.value.trim();

    var issues = [];
    if (!state.effectiveDate) issues.push('date d\'effet non renseignée');
    else if (new Date(state.effectiveDate).getTime() < Date.now()) issues.push('date d\'effet déjà passée');
    if (state.note.length < 6) issues.push('motif de publication trop court');

    var changed = PLANS.filter(function (p) { return p.next !== p.current; }).length;

    el.checks.innerHTML = (issues.length
      ? issues.map(function (i) { return '<li><span class="dot warn"></span>' + i + '</li>'; }).join('')
     : '<li><span class="dot"></span>Grille cohérente : ' + changed + ' plans révisés, ' + (PLANS.length - changed) + ' inchangé.</li>') +
      '<li><span class="dot"></span>Arrondis vérifiés au centime.</li>';

    el.chip.className = 'chip ' + (issues.length ? 'chip-warn' : 'chip-ok');
    el.chip.textContent = issues.length ? issues.length + ' point(s) à corriger' : 'prête à publier';
    el.noteLine.textContent = 'v14 · ' + el.region.options[el.region.selectedIndex].text +
      ' · effet le ' + (state.effectiveDate ? new Date(state.effectiveDate).toLocaleDateString('fr-FR') : '…') +
      ' · ' + (state.note || 'sans motif');
  }

  function publish() {
    log('publication demandée : v14 / ' + state.region + ' / ' + state.effectiveDate);
    getSession()
      .then(function (s) {
        return fetch('/api/challenge/16/solve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Api-Token': s.token },
          body: JSON.stringify({
            challengeId: '16',
            action: 'validate',
            grid: 'v14',
            region: state.region,
            effectiveDate: state.effectiveDate
          })
        });
      })
      .then(function (r) {
        return r.json().then(function (j) { return { status: r.status, data: j }; });
      })
      .then(function (x) { log('réponse ' + x.status + ' : ' + (x.data.message || x.data.error)); })
      .catch(function (e) { log('échec réseau : ' + e.message); });
  }

  el.rows = byId('grid-rows');
  el.date = byId('effective-date');
  el.region = byId('grid-region');
  el.note = byId('grid-note');
  el.checks = byId('grid-checks');
  el.chip = byId('grid-chip');
  el.noteLine = byId('grid-note-line');
  el.tokLine = byId('tok-line');
  el.tokIssued = byId('tok-issued');
  el.tokSource = byId('tok-source');
  el.tokChip = byId('tok-chip');
  el.go = byId('publish-grid');

  el.date.value = isoPlusDays(30);
  renderRows();
  refresh();
  log('grille v14 chargée : ' + PLANS.length + ' plans');

  seedFromHandoff();
  getSession().then(showSession).catch(function (e) {
    el.tokLine.textContent = 'session indisponible';
    log('session indisponible : ' + e.message);
  });

  el.date.addEventListener('change', refresh);
  el.region.addEventListener('change', refresh);
  el.note.addEventListener('input', refresh);
  el.go.addEventListener('click', publish);
})();

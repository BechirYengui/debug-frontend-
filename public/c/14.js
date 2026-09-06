(function () {
  'use strict';

  var CFG = { confirmDelay: 900, unit: 's', maxRetries: 2 };

  var SCOPES = {
    campaign: 'campagne entière',
    brand: 'groupe d’annonces « marque »',
    generic: 'mots-clés génériques'
  };

  var CHECKS = [
    { label: 'Budget mensuel : 3 540 € consommés sur 3 000 €', level: 'warn' },
    { label: 'Enchères automatiques actives (CPA cible 18 €)', level: 'ok' },
    { label: 'Aucune autre modification en attente sur la campagne', level: 'ok' }
  ];

  var el = {};
  var lines = [];
  var pending = null;
  var state = { scope: 'campaign', until: '', reason: '' };

  function byId(id) { return document.getElementById(id); }

  function log(msg) {
    lines.unshift(new Date().toTimeString().slice(0, 8) + '  ' + msg);
    lines = lines.slice(0, 12);
    el.log.innerHTML = lines.map(function (l) { return '<div>' + l + '</div>'; }).join('');
  }

  function delay() {
    return CFG.unit === 's' ? CFG.confirmDelay * 1000 : CFG.confirmDelay;
  }

  function isoDate(d) {
    var m = String(d.getMonth() + 1);
    var j = String(d.getDate());
    return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (j.length < 2 ? '0' + j : j);
  }

  function frDate(iso) {
    var p = iso.split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
  }

  function renderChecks() {
    el.checks.innerHTML = CHECKS.map(function (c) {
      var warn = c.level === 'warn';
      return '<li><span class="dot ' + (warn ? 'warn' : '') + '"></span>' + c.label +
        '<span class="chip ' + (warn ? 'chip-warn' : 'chip-ok') + '">' +
        (warn ? 'à traiter' : 'ok') + '</span></li>';
    }).join('');
  }

  function refresh() {
    state.scope = el.scope.value;
    state.until = el.until.value;
    state.reason = el.reason.value.trim();
    el.note.textContent = 'Pause de « ' + SCOPES[state.scope] + ' » jusqu’au ' +
      (state.until ? frDate(state.until) : 'date à définir') +
      ' : motif : ' + (state.reason || 'non renseigné') + '.';
  }

  function busy(on) {
    el.pause.textContent = on ? 'mise en pause programmée…' : 'Valider la commande';
    el.pause.classList.toggle('is-busy', on);
  }

  function send() {
    log('envoi de la mise en pause : ' + SCOPES[state.scope]);
    fetch('/api/challenge/14/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: '14',
        action: 'validate',
        scope: state.scope,
        until: state.until,
        reason: state.reason
      })
    })
      .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
      .then(function (res) { log('réponse ' + res.s + ' : ' + (res.d.message || res.d.error)); busy(false); })
      .catch(function (err) { log('échec réseau : ' + err.message); busy(false); });
  }

  function schedule() {
    clearTimeout(pending);
    var ms = delay();
    busy(true);
    log('mise en pause programmée, confirmation en cours…');
    pending = setTimeout(function () { send(); }, ms);
  }

  el.scope = byId('pause-scope');
  el.until = byId('pause-until');
  el.reason = byId('pause-reason');
  el.checks = byId('cmp-checks');
  el.chip = byId('cmp-chip');
  el.note = byId('cmp-note');
  el.log = byId('cmp-log');
  el.pause = byId('pause-campaign');

  el.until.value = isoDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  renderChecks();
  refresh();
  log('campagne chargée : ' + CHECKS.length + ' contrôles évalués, 1 anomalie');

  el.scope.addEventListener('change', refresh);
  el.until.addEventListener('change', refresh);
  el.reason.addEventListener('input', refresh);
  el.pause.addEventListener('click', schedule);
})();

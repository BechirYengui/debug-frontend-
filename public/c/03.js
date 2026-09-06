(function () {
  'use strict';

  var KEYS = [
    { id: 'svc-billing-2024-q1', algo: 'ed25519', age: 91 },
    { id: 'svc-search-2024-q1', algo: 'rsa-4096', age: 88 },
    { id: 'svc-gateway-2023-q4', algo: 'ecdsa-p384', age: 174 }
  ];

  var CONSUMERS = [
    { name: 'billing-worker', env: 'prod', last: '2 min', weight: 3 },
    { name: 'invoice-export', env: 'prod', last: '41 min', weight: 2 },
    { name: 'recon-batch', env: 'staging', last: '6 h', weight: 1 },
    { name: 'sandbox-cli', env: 'dev', last: '12 j', weight: 0 }
  ];

  var IMPACT = ['aucun', 'faible', 'modéré', 'élevé'];

  var state = { keyId: KEYS[0].id, algo: 'ed25519', overlap: 12, reason: '', notify: true };
  var el = {};
  var trail = [];

  function byId(id) { return document.getElementById(id); }

  function audit(msg) {
    trail.unshift(new Date().toTimeString().slice(0, 8) + '  ' + msg);
    trail = trail.slice(0, 12);
    el.audit.innerHTML = trail.map(function (t) { return '<div>' + t + '</div>'; }).join('');
  }

  function fillKeys() {
    el.keyId.innerHTML = KEYS.map(function (k) {
      return '<option value="' + k.id + '">' + k.id + ' (' + k.age + ' j)</option>';
    }).join('');
  }

  function renderConsumers() {
    el.consumers.innerHTML = CONSUMERS.map(function (c) {
      var w = state.overlap === 0 ? Math.min(3, c.weight + 1) : c.weight;
      return '<tr><td>' + c.name + '</td><td><span class="chip">' + c.env + '</span></td><td>' + c.last +
        '</td><td><span class="chip ' + (w >= 2 ? 'chip-warn' : 'chip-ok') + '">' + IMPACT[w] + '</span></td></tr>';
    }).join('');
  }

  function clampOverlap() {
    var n = parseInt(el.overlap.value, 10);
    if (isNaN(n)) n = 12;
    n = Math.min(72, Math.max(0, n));
    if (String(n) !== el.overlap.value) el.overlap.value = n;
    state.overlap = n;
  }

  function renderImpact() {
    var hot = CONSUMERS.filter(function (c) { return c.env === 'prod'; }).length;
    el.impactNote.textContent = hot + ' consommateurs en production, chevauchement ' + state.overlap +
      ' h, algorithme ' + state.algo + '.';
  }

  function refresh() {
    clampOverlap();
    state.keyId = el.keyId.value;
    state.algo = el.algo.value;
    state.reason = el.reason.value.trim();
    state.notify = el.notify.checked;
    renderConsumers();
    renderImpact();
  }

  function finishSync() {
    el.syncChip.dataset.state = 'ready';
    el.syncChip.textContent = 'inventaire à jour';
    el.syncChip.className = 'chip chip-ok';
    audit('inventaire des consommateurs synchronisé');
  }

  function send() {
    audit('rotation demandée sur ' + state.keyId);
    fetch('/api/challenge/03/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: '03',
        action: 'validate',
        keyId: state.keyId,
        algorithm: state.algo,
        overlapHours: state.overlap
      })
    })
      .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
      .then(function (res) { audit('réponse ' + res.s + ' : ' + (res.d.message || res.d.error)); })
      .catch(function (err) { audit('échec réseau : ' + err.message); });
  }

  el.keyId = byId('key-id');
  el.algo = byId('algo');
  el.overlap = byId('overlap');
  el.reason = byId('reason');
  el.notify = byId('notify');
  el.consumers = byId('consumers');
  el.impactNote = byId('impact-note');
  el.audit = byId('audit');
  el.rotate = byId('rotate');
  el.syncChip = byId('sync-chip');

  fillKeys();
  refresh();
  audit('3 clés de service chargées');

  el.keyId.addEventListener('change', refresh);
  el.algo.addEventListener('change', refresh);
  el.overlap.addEventListener('input', refresh);
  el.reason.addEventListener('input', refresh);
  el.notify.addEventListener('change', refresh);
  el.rotate.addEventListener('click', send);

  setTimeout(finishSync, 900);
})();

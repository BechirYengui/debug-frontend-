(function () {
  'use strict';

  var CATALOG = {
    'edge-router': { versions: ['4.11.2', '4.11.1', '4.10.7'], owner: 'platform', slo: 99.95 },
    'billing-api': { versions: ['2.31.0', '2.30.4', '2.30.3'], owner: 'finops', slo: 99.9 },
    'search-index': { versions: ['0.9.14', '0.9.13'], owner: 'discovery', slo: 99.5 }
  };

  var GATES = [
    { key: 'tests', label: "Suite d'intégration (1 284 cas)" },
    { key: 'sec', label: 'Analyse de vulnérabilités' },
    { key: 'perf', label: 'Budget de performance p99' },
    { key: 'quota', label: 'Capacité disponible sur le cluster' }
  ];

  var state = {
    service: 'edge-router',
    version: '4.11.2',
    canary: 10,
    window: '03:00',
    notes: ''
  };

  var el = {};
  var history = [];

  function byId(id) { return document.getElementById(id); }

  function trace(line) {
    history.unshift(new Date().toTimeString().slice(0, 8) + '  ' + line);
    history = history.slice(0, 14);
    el.activity.innerHTML = history.map(function (h) { return '<div>' + h + '</div>'; }).join('');
  }

  function fillVersions() {
    var entry = CATALOG[state.service];
    el.version.innerHTML = entry.versions.map(function (v) {
      return '<option value="' + v + '">' + v + '</option>';
    }).join('');
    state.version = entry.versions[0];
  }

  function gateStatus(key) {
    if (key === 'quota') return state.canary > 35 ? 'warn' : 'ok';
    return 'ok';
  }

  function renderGates() {
    el.gates.innerHTML = GATES.map(function (g) {
      var s = gateStatus(g.key);
      return '<li><span class="dot ' + (s === 'warn' ? 'warn' : '') + '"></span>' + g.label +
        ' <span class="chip ' + (s === 'warn' ? 'chip-warn' : 'chip-ok') + '">' + s + '</span></li>';
    }).join('');
  }

  function normalizeCanary() {
    var n = parseInt(el.canary.value, 10);
    if (isNaN(n)) n = 10;
    n = Math.min(50, Math.max(1, n));
    if (String(n) !== el.canary.value) el.canary.value = n;
    state.canary = n;
  }

  function renderSummary() {
    var entry = CATALOG[state.service];
    el.summary.textContent = state.service + ' ' + state.version + ' -> ' + state.canary +
      ' % du trafic à ' + state.window + ' (équipe ' + entry.owner + ', SLO ' + entry.slo + ' %)';
    el.pipelineChip.className = 'chip ' + (state.canary > 35 ? 'chip-warn' : 'chip-ok');
    el.pipelineChip.textContent = state.canary > 35 ? 'canari agressif' : 'pipeline vert';
  }

  function refresh() {
    normalizeCanary();
    state.service = el.service.value;
    state.version = el.version.value;
    state.window = el.windowStart.value || '03:00';
    state.notes = el.notes.value.trim();
    renderGates();
    renderSummary();
  }

  function send() {
    trace('promotion demandée : ' + state.service + '@' + state.version);
    fetch('/api/challenge/01/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: '01',
        action: 'validate',
        service: state.service,
        version: state.version,
        canary: state.canary
      })
    })
      .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
      .then(function (res) { trace('réponse ' + res.s + ' : ' + (res.d.message || res.d.error)); })
      .catch(function (err) { trace('échec réseau : ' + err.message); });
  }

  el.service = byId('service');
  el.version = byId('version');
  el.canary = byId('canary');
  el.windowStart = byId('window-start');
  el.notes = byId('notes');
  el.gates = byId('gates');
  el.summary = byId('summary');
  el.activity = byId('activity');
  el.pipelineChip = byId('pipeline-chip');
  el.promote = byId('promote');
  el.transition = byId('view-transition');

  fillVersions();
  refresh();
  trace('catalogue chargé : ' + Object.keys(CATALOG).length + ' services');

  el.service.addEventListener('change', function () { state.service = el.service.value; fillVersions(); refresh(); });
  el.version.addEventListener('change', refresh);
  el.canary.addEventListener('input', refresh);
  el.windowStart.addEventListener('change', refresh);
  el.notes.addEventListener('input', refresh);
  el.promote.addEventListener('click', send);

  requestAnimationFrame(function () { el.transition.classList.add('is-idle'); });
})();

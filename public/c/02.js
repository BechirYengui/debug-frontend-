(function () {
  'use strict';

  var INTERLOCKS = [
    { key: 'pressure', label: 'Pression amont dans la plage 3.0 - 6.0 bar' },
    { key: 'temp', label: 'Température fluide sous 85 C' },
    { key: 'operator', label: 'Opérateur habilité renseigné' },
    { key: 'order', label: 'Ordre de travail valide (OT-AAAA-NNNN)' },
    { key: 'setpoint', label: "Consigne d'ouverture entre 5 et 100 %" }
  ];

  var telemetry = { pressure: 4.2, temp: 61, flow: 0 };
  var form = { setpoint: 35, ramp: 20, operator: '', order: '' };

  var el = {};
  var lines = [];

  function byId(id) { return document.getElementById(id); }

  function journal(msg) {
    lines.unshift(new Date().toTimeString().slice(0, 8) + '  ' + msg);
    lines = lines.slice(0, 12);
    el.journal.innerHTML = lines.map(function (l) { return '<div>' + l + '</div>'; }).join('');
  }

  function readForm() {
    form.setpoint = parseInt(el.setpoint.value, 10);
    form.ramp = parseInt(el.ramp.value, 10);
    form.operator = el.operator.value.trim();
    form.order = el.workOrder.value.trim();
  }

  function checkOne(key) {
    switch (key) {
      case 'pressure': return telemetry.pressure >= 3 && telemetry.pressure <= 6;
      case 'temp': return telemetry.temp < 85;
      case 'operator': return form.operator.length >= 3;
      case 'order': return /^OT-\d{4}-\d{4}$/.test(form.order);
      case 'setpoint': return form.setpoint >= 5 && form.setpoint <= 100;
      default: return false;
    }
  }

  function renderInterlocks() {
    var okCount = 0;
    el.interlocks.innerHTML = INTERLOCKS.map(function (i) {
      var ok = checkOne(i.key);
      if (ok) okCount += 1;
      return '<li><span class="dot ' + (ok ? '' : 'warn') + '"></span>' + i.label +
        ' <span class="chip ' + (ok ? 'chip-ok' : 'chip-warn') + '">' + (ok ? 'ok' : 'à vérifier') + '</span></li>';
    }).join('');
    return okCount === INTERLOCKS.length;
  }

  function applyReadiness(ready) {
    el.open.setAttribute('aria-disabled', ready ? 'false' : 'true');
    el.open.classList.toggle('is-ready', ready);
    el.readiness.textContent = ready
      ? 'Tous les verrouillages sont levés. Consigne ' + form.setpoint + ' % sur ' + form.ramp + ' s.'
      : 'Verrouillages en attente : la commande reste bloquée.';
  }

  function refresh() {
    readForm();
    var ready = renderInterlocks();
    applyReadiness(ready);
    el.statPressure.textContent = telemetry.pressure.toFixed(1);
    el.statTemp.textContent = Math.round(telemetry.temp);
    el.statTemp.classList.toggle('hot', telemetry.temp > 78);
    el.statFlow.textContent = telemetry.flow.toFixed(0);
  }

  function drift() {
    telemetry.pressure = Math.min(6, Math.max(3, telemetry.pressure + (Math.random() - 0.5) * 0.14));
    telemetry.temp = Math.min(84, Math.max(48, telemetry.temp + (Math.random() - 0.5) * 1.4));
    refresh();
  }

  function send() {
    journal("ordre d'ouverture transmis (" + form.setpoint + ' %)');
    fetch('/api/challenge/02/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: '02',
        action: 'validate',
        setpoint: form.setpoint,
        ramp: form.ramp,
        workOrder: form.order
      })
    })
      .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
      .then(function (res) {
        journal('réponse ' + res.s + ' : ' + (res.d.message || res.d.error));
        if (res.s === 200) {
          el.valveChip.textContent = 'ouverte';
          el.valveChip.className = 'chip chip-ok';
          telemetry.flow = form.setpoint * 1.8;
          refresh();
        }
      })
      .catch(function (err) { journal('échec réseau : ' + err.message); });
  }

  el.setpoint = byId('setpoint');
  el.ramp = byId('ramp');
  el.operator = byId('operator');
  el.workOrder = byId('work-order');
  el.interlocks = byId('interlocks');
  el.readiness = byId('readiness');
  el.journal = byId('journal');
  el.open = byId('open-valve');
  el.valveChip = byId('valve-chip');
  el.statPressure = byId('stat-pressure');
  el.statTemp = byId('stat-temp');
  el.statFlow = byId('stat-flow');

  ['input', 'change'].forEach(function (evt) {
    [el.setpoint, el.ramp, el.operator, el.workOrder].forEach(function (node) {
      node.addEventListener(evt, refresh);
    });
  });
  el.open.addEventListener('click', send);

  refresh();
  journal('télémétrie connectée, 3 capteurs');
  setInterval(drift, 3000);
})();

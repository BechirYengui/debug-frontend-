(function () {
  'use strict';

  var SIGNALS = [
    { label: 'Taux de rétrofacturation sur 30 jours : 6,3 % (seuil 1 %)', level: 'warn' },
    { label: 'Pic de transactions nocturnes depuis 4 jours', level: 'warn' },
    { label: 'Documents KYC vérifiés le 12/03/2026', level: 'ok' },
    { label: 'Panier moyen : 214 € (référence secteur 190 €)', level: 'ok' }
  ];

  var REASONS = {
    fraud: 'fraude avérée',
    chargebacks: 'rétrofacturations anormales',
    kyc: 'documents KYC expirés',
    legal: 'réquisition judiciaire'
  };

  var el = {};
  var lines = [];

  function byId(id) { return document.getElementById(id); }

  function log(msg) {
    lines.unshift(new Date().toTimeString().slice(0, 8) + '  ' + msg);
    lines = lines.slice(0, 12);
    el.log.innerHTML = lines.map(function (l) { return '<div>' + l + '</div>'; }).join('');
  }

  function renderSignals() {
    el.signals.innerHTML = SIGNALS.map(function (s) {
      var warn = s.level === 'warn';
      return '<li><span class="dot ' + (warn ? 'warn' : '') + '"></span>' + s.label +
        '<span class="chip ' + (warn ? 'chip-warn' : 'chip-ok') + '">' +
        (warn ? 'anomalie' : 'normal') + '</span></li>';
    }).join('');
  }

  function refresh() {
    var reason = REASONS[el.reason.value];
    var notify = el.notify.checked;
    el.note.textContent = 'Suspension pour « ' + reason + ' », ' +
      (notify ? 'le marchand sera prévenu par courriel.' : 'sans notification au marchand.');
  }

  function collect() {
    return {
      merchant: el.merchant.value,
      reason: el.reason.value,
      threshold: Number(byId('threshold').value),
      notify: el.notify.checked,
      note: el.analystNote.value.trim()
    };
  }

  function block() {
    var payload = collect();
    log('suspension demandée pour ' + payload.merchant + ' (' + REASONS[payload.reason] + ')');
    fetch('/api/challenge/13/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: '13',
        action: 'validate',
        merchant: payload.merchant,
        reason: payload.reason,
        threshold: payload.threshold,
        notify: payload.notify
      })
    })
      .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
      .then(function (res) { log('réponse ' + res.s + ' : ' + (res.d.message || res.d.error)); })
      .catch(function (err) { log('échec réseau : ' + err.message); });
  }

  el.merchant = byId('merchant');
  el.reason = byId('reason');
  el.notify = byId('notify-merchant');
  el.analystNote = byId('analyst-note');
  el.signals = byId('signals');
  el.riskChip = byId('risk-chip');
  el.note = byId('block-note');
  el.log = byId('fraud-log');
  el.block = byId('block-account');

  renderSignals();
  refresh();
  log('dossier chargé : ' + el.merchant.value + ', ' + SIGNALS.length + ' signaux analysés');

  el.reason.addEventListener('change', refresh);
  el.notify.addEventListener('change', refresh);
  el.block.addEventListener('click', block);
})();

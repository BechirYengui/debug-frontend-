(function () {
  'use strict';

  var replicaMeta = document.querySelector('meta[name="gateway-replica"]');

  var GATEWAY = {
    primary: location.origin,
    replica: (replicaMeta && replicaMeta.content) || (location.protocol + '//' + location.hostname + ':' +
      (parseInt(location.port || (location.protocol === 'https:' ? '443' : '80'), 10) + 1)),
    prefer: 'replica'
  };

  var ORDER = 'BC-2026-0917';

  var LINES = [
    { label: 'Écran tactile 24" ITX-2400', qty: 6, unit: 389.00 },
    { label: 'Support VESA articulé', qty: 6, unit: 74.50 },
    { label: 'Câble HDMI 2.1 : 3 m', qty: 12, unit: 12.90 },
    { label: 'Prestation d’installation sur site', qty: 1, unit: 1250.00 }
  ];

  var SIGNERS = {
    'l.fabre': { name: 'L. Fabre', role: 'acheteur principal', limit: 25000 },
    'n.okoro': { name: 'N. Okoro', role: 'directrice achats', limit: 50000 }
  };

  var el = {};
  var lines = [];
  var state = { signer: 'l.fabre', otp: '', comment: '' };

  function byId(id) { return document.getElementById(id); }

  function apiBase() {
    return GATEWAY.prefer === 'replica' ? GATEWAY.replica : GATEWAY.primary;
  }

  function log(msg) {
    lines.unshift(new Date().toTimeString().slice(0, 8) + '  ' + msg);
    lines = lines.slice(0, 12);
    el.log.innerHTML = lines.map(function (l) { return '<div>' + l + '</div>'; }).join('');
  }

  function eur(n) {
    var parts = n.toFixed(2).split('.');
    var whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return whole + ',' + parts[1] + ' €';
  }

  function totalHT() {
    return LINES.reduce(function (sum, l) { return sum + l.qty * l.unit; }, 0);
  }

  function renderLines() {
    el.linesBody.innerHTML = LINES.map(function (l) {
      return '<tr><td>' + l.label + '</td><td>' + l.qty + '</td><td>' + eur(l.unit) +
        '</td><td>' + eur(l.qty * l.unit) + '</td></tr>';
    }).join('');
    var ht = totalHT();
    el.ht.textContent = eur(ht);
    el.tva.textContent = eur(ht * 0.2);
    el.ttc.textContent = eur(ht * 1.2);
  }

  function checks() {
    var signer = SIGNERS[state.signer];
    var ttc = totalHT() * 1.2;
    var otpOk = /^\d{6}$/.test(state.otp);
    return [
      { label: 'Code de signature reçu par SMS (6 chiffres)', ok: otpOk },
      { label: 'Montant TTC dans la délégation de ' + signer.name + ' (' + eur(signer.limit) + ')', ok: ttc <= signer.limit },
      { label: 'Fournisseur référencé : Nordis (n° F-0412)', ok: true }
    ];
  }

  function renderChecks() {
    var list = checks();
    el.checks.innerHTML = list.map(function (c) {
      return '<li><span class="dot ' + (c.ok ? '' : 'warn') + '"></span>' + c.label +
        '<span class="chip ' + (c.ok ? 'chip-ok' : 'chip-warn') + '">' + (c.ok ? 'ok' : 'bloquant') + '</span></li>';
    }).join('');
    return list.every(function (c) { return c.ok; });
  }

  function refresh() {
    state.signer = el.signer.value;
    state.otp = el.otp.value.replace(/\s+/g, '');
    state.comment = el.comment.value.trim();
    var ready = renderChecks();
    var signer = SIGNERS[state.signer];
    el.chip.className = 'chip ' + (ready ? 'chip-ok' : 'chip-warn');
    el.chip.textContent = ready ? 'prêt à signer' : 'signature bloquée';
    el.note.textContent = 'Signature de ' + ORDER + ' (' + eur(totalHT() * 1.2) + ' TTC) par ' +
      signer.name + ', ' + signer.role + '.';
  }

  function sign() {
    log('signature demandée par ' + SIGNERS[state.signer].name + ' sur ' + ORDER);
    fetch(apiBase() + '/api/challenge/15/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: '15',
        action: 'validate',
        order: ORDER,
        signer: state.signer,
        otp: state.otp
      })
    })
      .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
      .then(function (res) { log('réponse ' + res.s + ' : ' + (res.d.message || res.d.error)); })
      .catch(function (err) { log('échec réseau : ' + err.message); });
  }

  el.linesBody = byId('po-lines');
  el.signer = byId('signer');
  el.otp = byId('po-otp');
  el.comment = byId('po-comment');
  el.ht = byId('po-ht');
  el.tva = byId('po-tva');
  el.ttc = byId('po-ttc');
  el.checks = byId('po-checks');
  el.chip = byId('po-chip');
  el.note = byId('po-note');
  el.log = byId('po-log');
  el.sign = byId('sign-po');

  renderLines();
  refresh();
  log('bon de commande chargé : ' + LINES.length + ' lignes, ' + eur(totalHT()) + ' HT');
  log('passerelle sélectionnée : ' + (GATEWAY.prefer === 'replica' ? 'réplica' : 'principale'));

  el.signer.addEventListener('change', refresh);
  el.otp.addEventListener('input', refresh);
  el.comment.addEventListener('input', refresh);
  el.sign.addEventListener('click', sign);
})();

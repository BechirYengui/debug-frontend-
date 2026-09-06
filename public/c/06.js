(function () {
  'use strict';

  var OCCUPANCY = {
    '09:00-10:00': ['équipe data'],
    '10:00-11:30': [],
    '14:00-15:00': [],
    '16:30-18:00': ['comité éditorial', 'entretien RH']
  };

  var el = {};
  var lines = [];

  function byId(id) { return document.getElementById(id); }

  function logLine(msg) {
    lines.unshift(new Date().toTimeString().slice(0, 8) + '  ' + msg);
    lines = lines.slice(0, 10);
    el.log.innerHTML = lines.map(function (l) { return '<div>' + l + '</div>'; }).join('');
  }

  function readForm() {
    return {
      date: el.date.value,
      slot: el.slot.value,
      seats: parseInt(el.seats.value, 10) || 1,
      costCenter: el.costCenter.value.trim(),
      purpose: el.purpose.value.trim(),
      visio: el.visio.checked
    };
  }

  function validate(f) {
    var problems = [];
    if (!f.date) problems.push('date absente');
    if (f.seats < 1 || f.seats > 12) problems.push('capacité de la salle dépassée');
    if (!/^[A-Z]{2}-\d{4}$/.test(f.costCenter)) problems.push('centre de coût mal formé');
    if (f.purpose.length < 5) problems.push('objet trop court');
    if ((OCCUPANCY[f.slot] || []).length) problems.push('créneau déjà pris par ' + OCCUPANCY[f.slot].join(', '));
    return problems;
  }

  function renderConflicts() {
    var f = readForm();
    var problems = validate(f);
    if (!problems.length) {
      el.conflicts.innerHTML = '<li><span class="dot"></span>Aucun conflit détecté sur ce créneau.</li>';
    } else {
      el.conflicts.innerHTML = problems.map(function (p) {
        return '<li><span class="dot warn"></span>' + p + '</li>';
      }).join('');
    }
    el.slotChip.className = 'chip ' + (problems.length ? 'chip-warn' : 'chip-ok');
    el.slotChip.textContent = problems.length ? problems.length + ' point(s) à régler' : 'créneau libre';
    el.bookingNote.textContent = f.seats + ' participants, ' + (f.visio ? 'visio activée' : 'présentiel seul') +
      ', imputation ' + (f.costCenter || 'non définie') + '.';
    return problems;
  }

  function collectClientContext() {
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve({
          viewport: window.innerWidth + 'x' + window.innerHeight,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          locale: navigator.language
        });
      }, 120);
    });
  }

  function confirmBooking() {
    var f = readForm();
    logLine('réservation demandée : ' + f.slot);
    collectClientContext().then(function (ctx) {
      return fetch('/api/challenge/06/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: '06',
          action: 'validate',
          slot: f.slot,
          seats: f.seats,
          context: ctx
        })
      });
    })
      .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (res) { logLine('réponse ' + res.s + ' : ' + (res.j.message || res.j.error)); })
      .catch(function (err) { logLine('échec réseau : ' + err.message); });
  }

  el.date = byId('date');
  el.slot = byId('slot');
  el.seats = byId('seats');
  el.costCenter = byId('cost-center');
  el.purpose = byId('purpose');
  el.visio = byId('visio');
  el.conflicts = byId('conflicts');
  el.bookingNote = byId('booking-note');
  el.slotChip = byId('slot-chip');
  el.log = byId('booking-log');
  el.confirm = byId('confirm-booking');
  el.form = byId('booking-form');

  if (!el.date.value) el.date.value = new Date().toISOString().slice(0, 10);

  [el.date, el.slot, el.seats, el.costCenter, el.purpose, el.visio].forEach(function (node) {
    node.addEventListener('change', renderConflicts);
    node.addEventListener('input', renderConflicts);
  });

  el.confirm.addEventListener('click', confirmBooking);

  renderConflicts();
  logLine('planning de la salle Kepler chargé');
})();

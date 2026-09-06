(function () {
  'use strict';

  var CONTACTS = [
    { mail: 'a.moreau@nordis.fr', segment: 'late', last: '7 j', ok: true },
    { mail: 'contact@grivel-sa.com', segment: 'vip', last: '2 j', ok: true },
    { mail: 'compta@laforet.io', segment: 'late', last: '19 j', ok: true },
    { mail: 'no-reply@bouncing.tld', segment: 'all', last: '…', ok: false },
    { mail: 'f.diallo@atlaslog.fr', segment: 'vip', last: '31 j', ok: true },
    { mail: 'billing@petitpas.coop', segment: 'all', last: '4 j', ok: true }
  ];

  var COST = { email: 1, sms: 6, push: 2 };

  var el = {};
  var view = { channel: 'email', segment: 'all' };

  function byId(id) { return document.getElementById(id); }

  function matching() {
    return CONTACTS.filter(function (c) {
      if (!c.ok) return false;
      return view.segment === 'all' || c.segment === view.segment;
    });
  }

  function renderTable() {
    el.recipients.innerHTML = CONTACTS.map(function (c) {
      var kept = c.ok && (view.segment === 'all' || c.segment === view.segment);
      return '<tr style="opacity:' + (kept ? 1 : .38) + '">' +
        '<td>' + c.mail + '</td>' +
        '<td><span class="chip">' + c.segment + '</span></td>' +
        '<td>' + c.last + '</td>' +
        '<td><span class="chip ' + (c.ok ? 'chip-ok' : 'chip-warn') + '">' + (c.ok ? 'joignable' : 'rejeté') + '</span></td>' +
        '</tr>';
    }).join('');
  }

  function renderPreview() {
    var sample = matching()[0];
    var text = el.template.value
      .replace('{{prenom}}', sample ? sample.mail.split('@')[0] : 'client')
      .replace('{{ref}}', 'FA-2026-0412')
      .replace('{{date}}', new Date(Date.now() + 6048e5).toLocaleDateString('fr-FR'));
    el.preview.textContent = text;
  }

  function refresh() {
    view.channel = el.channel.value;
    view.segment = el.segment.value;
    var kept = matching();
    el.sTotal.textContent = CONTACTS.length;
    el.sSelected.textContent = kept.length;
    el.sCost.textContent = kept.length * COST[view.channel];
    el.dispatchNote.textContent = kept.length + ' envois ' + view.channel + ' pour ' +
      (kept.length * COST[view.channel]) + ' crédits.';
    el.batchChip.className = 'chip ' + (kept.length ? 'chip-ok' : 'chip-warn');
    el.batchChip.textContent = kept.length ? 'prêt à expédier' : 'aucun destinataire';
    renderTable();
    renderPreview();
  }

  el.channel = byId('channel');
  el.segment = byId('segment');
  el.template = byId('template');
  el.recipients = byId('recipients');
  el.sTotal = byId('s-total');
  el.sSelected = byId('s-selected');
  el.sCost = byId('s-cost');
  el.dispatchNote = byId('dispatch-note');
  el.batchChip = byId('batch-chip');
  el.outbox = byId('outbox');

  el.preview = document.createElement('p');
  el.preview.className = 'preview';
  el.template.parentNode.appendChild(el.preview);

  el.channel.addEventListener('change', refresh);
  el.segment.addEventListener('change', refresh);
  el.template.addEventListener('input', renderPreview);

  refresh();
  el.outbox.innerHTML = '<div>' + new Date().toTimeString().slice(0, 8) +
    '  carnet chargé : ' + CONTACTS.length + ' contacts</div>';
})();

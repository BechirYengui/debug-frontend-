(function () {
  'use strict';

  var IMAGES = [
    { id: 'gw-fw-3.8.2', size: 1840, notes: 'correctif watchdog' },
    { id: 'gw-fw-3.8.1', size: 1836, notes: 'stabilisation radio' },
    { id: 'gw-fw-3.7.9', size: 1791, notes: 'version en production' }
  ];

  var DEVICES = [
    { id: 'gw-pilot-001', fw: '3.7.9', batt: 88, rssi: -71, online: true },
    { id: 'gw-pilot-002', fw: '3.7.9', batt: 54, rssi: -83, online: true },
    { id: 'gw-pilot-003', fw: '3.8.1', batt: 31, rssi: -78, online: true },
    { id: 'gw-pilot-004', fw: '3.7.9', batt: 92, rssi: -64, online: false },
    { id: 'gw-pilot-005', fw: '3.7.9', batt: 47, rssi: -90, online: true }
  ];

  var api = {
    request: function (url, opts) {
      opts = opts || {};
      var method = (opts.method || 'GET').toUpperCase();
      var init = { method: method, headers: {} };
      Object.keys(opts.headers || {}).forEach(function (h) {
        init.headers[h] = opts.headers[h];
      });
      if (opts.json !== undefined && method !== 'GET' && method !== 'HEAD') {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(opts.json);
      }
      return fetch(url, init).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          return { status: res.status, data: data };
        });
      });
    }
  };

  var el = {};
  var state = { image: IMAGES[0].id, group: 'pilot', minBattery: 40, window: '02:30' };
  var lines = [];

  function byId(id) { return document.getElementById(id); }

  function log(msg) {
    lines.unshift(new Date().toTimeString().slice(0, 8) + '  ' + msg);
    lines = lines.slice(0, 12);
    el.log.innerHTML = lines.map(function (l) { return '<div>' + l + '</div>'; }).join('');
  }

  function fillImages() {
    el.image.innerHTML = IMAGES.map(function (i) {
      return '<option value="' + i.id + '">' + i.id + ' (' + i.size + ' Ko, ' + i.notes + ')</option>';
    }).join('');
  }

  function eligible(d) {
    if (!d.online) return false;
    if (d.batt < state.minBattery) return false;
    return state.image.indexOf(d.fw) === -1;
  }

  function signalBar(rssi) {
    var pct = Math.max(5, Math.min(100, Math.round((rssi + 110) * 2)));
    return '<span class="sig"><i style="width:' + pct + '%"></i></span>';
  }

  function renderDevices() {
    el.devices.innerHTML = DEVICES.map(function (d) {
      var ok = eligible(d);
      return '<tr style="opacity:' + (ok ? 1 : .45) + '">' +
        '<td>' + d.id + '</td>' +
        '<td>' + d.fw + '</td>' +
        '<td>' + d.batt + ' %</td>' +
        '<td>' + signalBar(d.rssi) + '</td>' +
        '<td><span class="chip ' + (ok ? 'chip-ok' : 'chip-warn') + '">' +
        (d.online ? (ok ? 'éligible' : 'écartée') : 'hors ligne') + '</span></td></tr>';
    }).join('');
  }

  function refresh() {
    state.image = el.image.value;
    state.group = el.group.value;
    var b = parseInt(el.minBattery.value, 10);
    state.minBattery = isNaN(b) ? 40 : Math.min(100, Math.max(10, b));
    state.window = el.window.value || '02:30';

    var targets = DEVICES.filter(eligible);
    var online = DEVICES.filter(function (d) { return d.online; });
    el.fOnline.textContent = online.length;
    el.fTarget.textContent = targets.length;
    el.fBattery.textContent = targets.length
      ? Math.min.apply(null, targets.map(function (d) { return d.batt; }))
      : 0;
    el.fleetChip.className = 'chip ' + (targets.length ? 'chip-ok' : 'chip-warn');
    el.fleetChip.textContent = targets.length ? targets.length + ' à mettre à jour' : 'rien à pousser';
    el.fleetNote.textContent = 'Image ' + state.image + ' vers le groupe ' + state.group +
      ' à ' + state.window + ', batterie mini ' + state.minBattery + ' %.';
    renderDevices();
  }

  function push() {
    var targets = DEVICES.filter(eligible).map(function (d) { return d.id; });
    log('déploiement demandé sur ' + targets.length + ' passerelles');
    api.request('/api/challenge/09/solve', {
      headers: { Accept: 'application/json' },
      json: {
        challengeId: '09',
        action: 'validate',
        image: state.image,
        group: state.group,
        devices: targets
      }
    })
      .then(function (res) { log('réponse ' + res.status + ' : ' + (res.data.message || res.data.error)); })
      .catch(function (err) { log('échec réseau : ' + err.message); });
  }

  el.image = byId('image');
  el.group = byId('group');
  el.minBattery = byId('min-battery');
  el.window = byId('window');
  el.devices = byId('devices');
  el.fOnline = byId('f-online');
  el.fTarget = byId('f-target');
  el.fBattery = byId('f-battery');
  el.fleetChip = byId('fleet-chip');
  el.fleetNote = byId('fleet-note');
  el.log = byId('fleet-log');
  el.push = byId('push-firmware');

  fillImages();
  refresh();
  log('inventaire flotte chargé : ' + DEVICES.length + ' passerelles');

  el.image.addEventListener('change', refresh);
  el.group.addEventListener('change', refresh);
  el.minBattery.addEventListener('input', refresh);
  el.window.addEventListener('change', refresh);
  el.push.addEventListener('click', push);
})();

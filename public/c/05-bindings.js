(function (w, d) {
  'use strict';

  var bound = 0;

  function on(selector, type, handler, opts) {
    var node = d.querySelector(selector);
    if (!node) return false;
    node.addEventListener(type, handler, opts || false);
    bound += 1;
    return true;
  }

  function outbox(msg) {
    var box = d.getElementById('outbox');
    if (!box) return;
    var line = d.createElement('div');
    line.textContent = new Date().toTimeString().slice(0, 8) + '  ' + msg;
    box.insertBefore(line, box.firstChild);
  }

  function currentBatch() {
    var channel = d.getElementById('channel');
    var segment = d.getElementById('segment');
    return {
      channel: channel ? channel.value : 'email',
      segment: segment ? segment.value : 'all'
    };
  }

  function onDispatch() {
    var batch = currentBatch();
    outbox('expédition demandée (' + batch.channel + ' / ' + batch.segment + ')');
    fetch('/api/challenge/05/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: '05',
        action: 'validate',
        channel: batch.channel,
        segment: batch.segment
      })
    })
      .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (res) { outbox('réponse ' + res.s + ' : ' + (res.j.message || res.j.error)); })
      .catch(function (err) { outbox('échec réseau : ' + err.message); });
  }

  function onBeforeUnload() {
    w.__batchDirty = false;
  }

  function onVisibility() {
    if (d.visibilityState === 'visible') w.__batchSeenAt = Date.now();
  }

  on('#dispatch-batch', 'click', onDispatch);
  on('#template', 'input', function () { w.__batchDirty = true; });

  w.addEventListener('beforeunload', onBeforeUnload);
  d.addEventListener('visibilitychange', onVisibility);

  w.__batchBindings = bound;
})(window, document);

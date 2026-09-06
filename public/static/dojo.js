/*
 * Chrome commun des pages de défi : chrono, statut, dernière réponse du serveur,
 * indices, corrigé, débrief et quiz. Ce fichier ne fait jamais partie de
 * l'exercice : le bug est toujours dans public/c/NN.* ou challenges/NN.html.
 */
(function () {
  'use strict';

  var C = window.DOJO || {};
  var $ = function (id) { return document.getElementById(id); };
  var I = C.i18n || {};

  /* Texte traduit (clés fournies par le serveur), avec substitution {var}. */
  function T(key, vars) {
    var s = I[key] !== undefined ? I[key] : key;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? String(vars[k]) : m; });
    return s;
  }

  var chronoEl = $('dojo-chrono');
  var statusEl = $('dojo-status');
  var scoreEl = $('dojo-score');
  var verdictEl = $('dojo-verdict');
  var receivedEl = $('dojo-received');
  var hintBtn = $('dojo-hint-btn');
  var hintList = $('dojo-hint-list');
  var hintCount = $('dojo-hint-count');
  var revealBtn = $('dojo-reveal-btn');
  var debriefEl = $('dojo-debrief');
  var debriefBadge = $('dojo-debrief-badge');
  var causeEl = $('dojo-debrief-cause');
  var reflexEl = $('dojo-debrief-reflex');
  var quizQ = $('dojo-quiz-q');
  var quizChoices = $('dojo-quiz-choices');
  var quizResult = $('dojo-quiz-result');
  var solutionBtn = $('dojo-solution-btn');
  var solutionEl = $('dojo-solution');
  var nextLink = $('dojo-next');
  var toastEl = $('dojo-toast');

  var solved = !!C.solved;
  var revealed = !!C.revealed;
  var startedAt = C.startedAt || Date.now();
  var frozenMs = C.durationMs;
  var shownHints = 0;
  var renderedAttemptAt = 0;
  var debriefRendered = false;
  var quizState = C.quiz || { tries: 0, correct: false };
  var quizRenderedKey = '';
  var solutionLoaded = false;

  /* ---------------- utilitaires ---------------- */

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function fmt(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    return (h ? pad(h) + ':' : '') + pad(m) + ':' + pad(s % 60);
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function postJSON(url, data) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data || {})
    }).then(function (r) { return r.json(); });
  }

  var toastTimer = null;
  function toast(text, kind) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.className = 'toast' + (kind ? ' ' + kind : '');
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 6000);
  }

  /* ---------------- chrono ---------------- */

  function tick() {
    if (solved && frozenMs != null) {
      chronoEl.textContent = fmt(frozenMs);
      chronoEl.classList.add('frozen');
      return;
    }
    chronoEl.textContent = fmt(Date.now() - startedAt);
  }
  tick();
  setInterval(tick, 500);

  /* ---------------- statut ---------------- */

  function setStatus() {
    if (solved) {
      statusEl.textContent = T('ch.status.done');
      statusEl.className = 'badge badge-ok';
    } else if (revealed) {
      statusEl.textContent = T('ch.status.seen');
      statusEl.className = 'badge badge-seen';
    } else {
      statusEl.textContent = T('ch.status.todo');
      statusEl.className = 'badge badge-todo';
    }
    document.body.classList.toggle('is-solved', solved);
    document.body.classList.toggle('is-seen', !solved && revealed);
  }

  function setScore(pts) {
    if (!scoreEl) return;
    if (typeof pts === 'number' && solved) {
      scoreEl.textContent = pts + ' ' + T('g.pts');
      scoreEl.hidden = false;
    }
  }

  /* ---------------- dernière réponse du serveur ---------------- */

  function showAttempt(a) {
    if (!a || a.at === renderedAttemptAt) return;
    renderedAttemptAt = a.at;
    verdictEl.className = 'verdict ' + (a.ok ? 'ok' : 'ko');
    verdictEl.innerHTML = '<span class="code">' + a.code + '</span>' + esc(a.message);
    var r = a.received || {};
    receivedEl.innerHTML =
      '<dt>' + T('ch.received.method') + '</dt><dd>' + esc(r.method || '?') + '</dd>' +
      (r.origin ? '<dt>origin</dt><dd>' + esc(r.origin) + '</dd>' : '') +
      '<dt>' + T('ch.received.ct') + '</dt><dd>' + esc(r.contentType || T('ch.received.absent')) + '</dd>' +
      '<dt>' + T('ch.received.token') + '</dt><dd>' + esc(r.apiToken || '?') + '</dd>' +
      '<dt>' + T('ch.received.bytes') + '</dt><dd>' + esc(r.bodyBytes != null ? r.bodyBytes : '?') + '</dd>' +
      '<dt>' + T('ch.received.body') + '</dt><dd>' + (r.bodyPreview ? esc(r.bodyPreview) : T('ch.received.empty')) + '</dd>';
    receivedEl.hidden = false;
  }

  /* ---------------- journal du serveur ---------------- */

  var logEl = $('dojo-server-log');
  var renderedLogKey = '';

  function renderLog(entries) {
    if (!logEl || !entries) return;
    var key = entries.map(function (e) { return e.at; }).join(',');
    if (key === renderedLogKey) return;
    renderedLogKey = key;
    if (!entries.length) { logEl.hidden = true; logEl.innerHTML = ''; return; }
    logEl.innerHTML = entries.map(function (e) {
      var t = new Date(e.at).toTimeString().slice(0, 8);
      var hs = Object.keys(e.headers || {}).filter(function (k) { return e.headers[k]; }).map(function (k) {
        return '<dt>' + esc(k) + '</dt><dd>' + esc(e.headers[k]) + '</dd>';
      }).join('');
      var body = '<dt>' + T('ch.log.body') + '</dt><dd>' + (e.bodyBytes ? esc(e.bodyPreview) + ' <span class="sl-port">[' + e.bodyBytes + ' ' + T('ch.log.bytes') + ']</span>' : T('ch.received.empty')) + '</dd>';
      return '<li class="' + (e.ok ? 'ok' : 'ko') + '">' +
        '<div class="sl-head"><span class="sl-time">' + t + '</span><span class="sl-method">' + esc(e.method) + '</span>' +
        '<span>' + esc(e.url) + '</span><span class="sl-port">' + T('ch.log.port') + ' ' + esc(e.port) + '</span><span class="sl-code">' + e.code + '</span></div>' +
        '<dl class="sl-headers">' + hs + body + '</dl>' +
        '<p class="sl-msg">' + esc(e.message) + '</p></li>';
    }).join('');
    logEl.hidden = false;
  }

  /* ---------------- indices ---------------- */

  function updateHintCounter(n) {
    if (typeof n === 'number' && n > shownHints && hintList.children.length >= n) shownHints = n;
    hintCount.textContent = T('ch.hints.count', { n: Math.max(shownHints, n || 0) });
    if (shownHints >= 3) {
      hintBtn.disabled = true;
      hintBtn.textContent = T('ch.hints.none');
    }
  }

  function reveal(level) {
    return fetch('/_dojo/hint/' + C.id + '?level=' + level, { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) return;
        var li = document.createElement('li');
        li.innerHTML = '<span class="lvl">' + T('ch.hints.level', { n: d.level }) + '</span>' + esc(d.text);
        hintList.appendChild(li);
        shownHints = Math.max(shownHints, d.level);
        updateHintCounter(d.hints);
      });
  }

  hintBtn.addEventListener('click', function () {
    if (shownHints >= 3) return;
    reveal(shownHints + 1);
  });

  (function restoreHints() {
    var n = C.hints || 0;
    var chain = Promise.resolve();
    for (var i = 1; i <= n; i++) {
      (function (lvl) { chain = chain.then(function () { return reveal(lvl); }); })(i);
    }
  })();

  /* ---------------- corrigé ---------------- */

  function showSolution(html) {
    solutionEl.innerHTML = html;
    solutionEl.hidden = false;
    solutionLoaded = true;
    solutionBtn.textContent = T('ch.solution.hide');
  }

  solutionBtn.addEventListener('click', function () {
    if (solutionLoaded) {
      solutionEl.hidden = !solutionEl.hidden;
      solutionBtn.textContent = solutionEl.hidden ? T('ch.solution.show') : T('ch.solution.hide');
      return;
    }
    fetch('/_dojo/solution/' + C.id, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok) showSolution(d.html);
        else toast(d.error || T('ch.solution.unavailable'), 'ko');
      });
  });

  revealBtn.addEventListener('click', function () {
    if (!solved && !revealed) {
      var ok = window.confirm(T('ch.reveal.confirm'));
      if (!ok) return;
    }
    postJSON('/_dojo/reveal/' + C.id).then(function (d) {
      if (!d.ok) return;
      revealed = d.revealed;
      setStatus();
      renderDebrief(d.debrief);
      showSolution(d.html);
      debriefEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* ---------------- débrief + quiz ---------------- */

  function renderQuiz(q) {
    if (!q) return;
    var key = q.tries + '/' + q.correct + '/' + (q.answer == null ? '-' : q.answer);
    if (key === quizRenderedKey) return;
    quizRenderedKey = key;
    quizQ.textContent = q.question;
    quizChoices.innerHTML = '';
    q.choices.forEach(function (label, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'quiz-choice';
      b.dataset.i = String(i);
      b.textContent = label;
      if (q.correct) {
        b.disabled = true;
        if (i === q.answer) b.classList.add('is-right');
      }
      b.addEventListener('click', function () { answerQuiz(i); });
      quizChoices.appendChild(b);
    });
    if (q.correct) {
      quizResult.hidden = false;
      quizResult.className = 'quiz-result ok';
      quizResult.textContent = (q.tries === 1 ? T('ch.quiz.first') : T('ch.quiz.after', { n: q.tries })) + ' ' + (q.why || '');
    } else if (q.tries > 0) {
      quizResult.hidden = false;
      quizResult.className = 'quiz-result ko';
      quizResult.textContent = T('ch.quiz.pending', { n: q.tries });
    } else {
      quizResult.hidden = true;
    }
  }

  function answerQuiz(i) {
    var buttons = quizChoices.querySelectorAll('.quiz-choice');
    buttons.forEach(function (b) { b.disabled = true; });
    postJSON('/_dojo/quiz/' + C.id, { choice: i }).then(function (d) {
      if (!d.ok) { buttons.forEach(function (b) { b.disabled = false; }); toast(d.error || 'Erreur', 'ko'); return; }
      quizState = { tries: d.tries, correct: d.quizCorrect };
      quizResult.hidden = false;
      if (d.correct) {
        buttons[i].classList.add('is-right');
        quizResult.className = 'quiz-result ok';
        quizResult.textContent = (d.tries === 1 ? T('ch.quiz.first') : T('ch.quiz.later')) + ' ' + (d.why || '');
        setScore(d.score);
        toast(T('ch.quiz.toast', { pts: d.tries === 1 ? '+25' : '+10' }), 'ok');
      } else {
        buttons[i].classList.add('is-wrong');
        quizResult.className = 'quiz-result ko';
        quizResult.textContent = T('ch.quiz.wrong');
        setTimeout(function () {
          buttons.forEach(function (b) { if (!b.classList.contains('is-wrong')) b.disabled = false; });
        }, 400);
      }
      quizRenderedKey = 'manual';
    });
  }

  function renderDebrief(d) {
    if (!d) return;
    if (!debriefRendered) {
      causeEl.textContent = d.cause;
      reflexEl.textContent = d.reflex;
      debriefEl.hidden = false;
      debriefRendered = true;
    }
    debriefBadge.textContent = solved ? T('ch.status.done') : T('ch.status.seen');
    debriefBadge.className = 'badge ' + (solved ? 'badge-ok' : 'badge-seen');
    renderQuiz(d.quiz);
  }

  /* ---------------- synchronisation avec le serveur ---------------- */

  function celebrate(s) {
    document.body.classList.add('is-solved');
    verdictEl.className = 'verdict ok';
    chronoEl.classList.add('frozen');
    var pts = typeof s.score === 'number' ? s.score : null;
    toast(T('ch.solved.toast', { time: fmt(s.durationMs || 0), pts: pts != null ? ' · ' + pts + ' ' + T('g.pts') : '' }), 'ok');
    setTimeout(function () { debriefEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 900);
  }

  function applyState(s) {
    if (!s || !s.ok) return;
    if (s.startedAt) startedAt = s.startedAt;
    if (s.solved && !solved) {
      solved = true;
      frozenMs = s.durationMs;
      celebrate(s);
    }
    if (s.solved) frozenMs = s.durationMs;
    if (s.revealed) revealed = true;
    setStatus();
    setScore(s.score);
    updateHintCounter(s.hints);
    showAttempt(s.lastAttempt);
    renderLog(s.log);
    if (s.debrief) renderDebrief(s.debrief);
    if (nextLink && s.nextId && nextLink.dataset.autoNext !== '0') {
      nextLink.href = '/challenge/' + s.nextId;
    }
  }

  function poll() {
    fetch('/_dojo/state/' + C.id, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(applyState)
      .catch(function () {});
  }
  setInterval(poll, 1200);

  setStatus();
  updateHintCounter(C.hints || 0);
  if (solved) { document.body.classList.add('is-solved'); chronoEl.classList.add('frozen'); }
  poll();
})();

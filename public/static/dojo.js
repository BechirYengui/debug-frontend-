/*
 * Chrome commun des pages de défi : chrono, statut, journal du serveur, indices,
 * corrigé, débrief et quiz. Ce fichier ne fait jamais partie de l'exercice : le bug
 * est toujours dans public/c/NN.* ou challenges/NN.html.
 *
 * Servi tel quel (ES2017, sans bundler). Sections :
 *   1. configuration et utilitaires      6. indices
 *   2. toast                             7. corrigé et « je sèche »
 *   3. chrono                            8. débrief et quiz
 *   4. statut et score                   9. synchronisation : polling adaptatif
 *   5. réponse et journal du serveur    10. démarrage
 *
 * Aucun élément du chrome n'est obligatoire : chaque fonction tolère son absence.
 */
(() => {
  'use strict';

  /* ---------- 1. configuration et utilitaires ---------- */

  const C = window.DOJO || {};
  const I = C.i18n || {};
  const $ = (id) => document.getElementById(id);

  /* Texte traduit (clés fournies par le serveur), avec substitution {var}. */
  const T = (key, vars) => {
    let s = I[key] !== undefined ? I[key] : key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
    return s;
  };

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const fmt = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return (h ? pad(h) + ':' : '') + pad(m) + ':' + pad(s % 60);
  };

  const setText = (el, text) => { if (el) el.textContent = text; };
  const setClass = (el, cls) => { if (el) el.className = cls; };
  const setHidden = (el, hidden) => { if (el) el.hidden = !!hidden; };
  const on = (el, type, fn, opts) => { if (el) el.addEventListener(type, fn, opts); };

  const reducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const scrollTo = (el) => { if (el) el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }); };

  const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const getJSON = (url) => fetch(url, { headers: { Accept: 'application/json' } }).then((r) => r.json());
  const postJSON = (url, data) => fetch(url, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data || {}) }).then((r) => r.json());

  const el = {
    chrono: $('dojo-chrono'),
    status: $('dojo-status'),
    score: $('dojo-score'),
    verdict: $('dojo-verdict'),
    received: $('dojo-received'),
    log: $('dojo-server-log'),
    hintBtn: $('dojo-hint-btn'),
    hintList: $('dojo-hint-list'),
    hintCount: $('dojo-hint-count'),
    revealBtn: $('dojo-reveal-btn'),
    debrief: $('dojo-debrief'),
    debriefBadge: $('dojo-debrief-badge'),
    cause: $('dojo-debrief-cause'),
    reflex: $('dojo-debrief-reflex'),
    quizQ: $('dojo-quiz-q'),
    quizChoices: $('dojo-quiz-choices'),
    quizResult: $('dojo-quiz-result'),
    solutionBtn: $('dojo-solution-btn'),
    solution: $('dojo-solution'),
    next: $('dojo-next'),
    toast: $('dojo-toast'),
    workspace: $('workspace')
  };

  let solved = !!C.solved;
  let revealed = !!C.revealed;
  let startedAt = C.startedAt || Date.now();
  let frozenMs = C.durationMs;

  /* ---------- 2. toast ---------- */

  let toastTimer = null;

  const toast = (text, kind) => {
    const t = el.toast;
    if (!t) return;
    if (!t.getAttribute('role')) t.setAttribute('role', 'status');
    if (!t.getAttribute('aria-live')) t.setAttribute('aria-live', 'polite');
    t.textContent = text;
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 6000);
  };

  /* ---------- 3. chrono ---------- */

  const tickChrono = () => {
    if (!el.chrono) return;
    if (solved && frozenMs != null) {
      el.chrono.textContent = fmt(frozenMs);
      el.chrono.classList.add('frozen');
      return;
    }
    el.chrono.textContent = fmt(Date.now() - startedAt);
  };

  /* ---------- 4. statut et score ---------- */

  const setStatus = () => {
    if (solved) {
      setText(el.status, T('ch.status.done'));
      setClass(el.status, 'badge badge-ok');
    } else if (revealed) {
      setText(el.status, T('ch.status.seen'));
      setClass(el.status, 'badge badge-seen');
    } else {
      setText(el.status, T('ch.status.todo'));
      setClass(el.status, 'badge badge-todo');
    }
    document.body.classList.toggle('is-solved', solved);
    document.body.classList.toggle('is-seen', !solved && revealed);
    if (solved && el.chrono) el.chrono.classList.add('frozen');
  };

  const setScore = (pts) => {
    if (!el.score || typeof pts !== 'number' || !solved) return;
    el.score.textContent = pts + ' ' + T('g.pts');
    el.score.hidden = false;
  };

  /* ---------- 5. réponse et journal du serveur ---------- */

  let renderedAttemptAt = 0;
  let renderedLogKey = '';

  const dtdd = (k, v) => '<dt>' + k + '</dt><dd>' + v + '</dd>';

  const showAttempt = (a) => {
    if (!a || a.at === renderedAttemptAt) return;
    renderedAttemptAt = a.at;
    if (el.verdict) {
      el.verdict.className = 'verdict ' + (a.ok ? 'ok' : 'ko');
      el.verdict.innerHTML = '<span class="code">' + esc(a.code) + '</span>' + esc(a.message);
    }
    if (!el.received) return;
    const r = a.received || {};
    el.received.innerHTML =
      dtdd(T('ch.received.method'), esc(r.method || '?')) +
      (r.origin ? dtdd('origin', esc(r.origin)) : '') +
      dtdd(T('ch.received.ct'), esc(r.contentType || T('ch.received.absent'))) +
      dtdd(T('ch.received.token'), esc(r.apiToken || '?')) +
      dtdd(T('ch.received.bytes'), esc(r.bodyBytes != null ? r.bodyBytes : '?')) +
      dtdd(T('ch.received.body'), r.bodyPreview ? esc(r.bodyPreview) : T('ch.received.empty'));
    el.received.hidden = false;
  };

  /* Le journal n'est re-rendu que si la liste des horodatages change. */
  const renderLog = (entries) => {
    if (!el.log || !entries) return;
    const key = entries.map((e) => e.at).join(',');
    if (key === renderedLogKey) return;
    renderedLogKey = key;
    if (!entries.length) { el.log.hidden = true; el.log.innerHTML = ''; return; }
    el.log.innerHTML = entries.map((e) => {
      const time = new Date(e.at).toTimeString().slice(0, 8);
      const headers = e.headers || {};
      const hs = Object.keys(headers).filter((k) => headers[k]).map((k) => dtdd(esc(k), esc(headers[k]))).join('');
      const body = dtdd(T('ch.log.body'), e.bodyBytes
        ? esc(e.bodyPreview) + ' <span class="sl-port">[' + esc(e.bodyBytes) + ' ' + T('ch.log.bytes') + ']</span>'
        : T('ch.received.empty'));
      return '<li class="' + (e.ok ? 'ok' : 'ko') + '">' +
        '<div class="sl-head"><span class="sl-time">' + time + '</span><span class="sl-method">' + esc(e.method) + '</span>' +
        '<span>' + esc(e.url) + '</span><span class="sl-port">' + T('ch.log.port') + ' ' + esc(e.port) + '</span>' +
        '<span class="sl-code">' + esc(e.code) + '</span></div>' +
        '<dl class="sl-headers">' + hs + body + '</dl>' +
        '<p class="sl-msg">' + esc(e.message) + '</p></li>';
    }).join('');
    el.log.hidden = false;
  };

  /* ---------- 6. indices ---------- */

  const MAX_HINTS = 3;
  let shownHints = 0;

  const updateHintCounter = (n) => {
    const listed = el.hintList ? el.hintList.children.length : 0;
    if (typeof n === 'number' && n > shownHints && listed >= n) shownHints = n;
    setText(el.hintCount, T('ch.hints.count', { n: Math.max(shownHints, n || 0) }));
    if (shownHints >= MAX_HINTS && el.hintBtn) {
      el.hintBtn.disabled = true;
      el.hintBtn.textContent = T('ch.hints.none');
    }
  };

  /* Révèle (ou restaure) l'indice `level` ; `focus` déplace le focus sur le texte révélé. */
  const revealHint = (level, focus) => postJSON('/_dojo/hint/' + C.id + '?level=' + level).then((d) => {
    if (!d.ok || !el.hintList) return;
    const li = document.createElement('li');
    li.tabIndex = -1;
    li.innerHTML = '<span class="lvl">' + T('ch.hints.level', { n: d.level }) + '</span>' + esc(d.text);
    el.hintList.appendChild(li);
    shownHints = Math.max(shownHints, d.level);
    if (focus) li.focus({ preventScroll: true });
    updateHintCounter(d.hints);
  }).catch(() => {});

  on(el.hintBtn, 'click', () => {
    if (shownHints >= MAX_HINTS) return;
    revealHint(shownHints + 1, true);
  });

  const restoreHints = () => {
    let chain = Promise.resolve();
    for (let lvl = 1; lvl <= (C.hints || 0); lvl++) chain = chain.then(() => revealHint(lvl, false));
  };

  /* ---------- 7. corrigé et « je sèche » ---------- */

  let solutionLoaded = false;

  const setSolutionVisible = (visible) => {
    setHidden(el.solution, !visible);
    setText(el.solutionBtn, visible ? T('ch.solution.hide') : T('ch.solution.show'));
    if (el.solutionBtn) el.solutionBtn.setAttribute('aria-expanded', visible ? 'true' : 'false');
  };

  const showSolution = (html) => {
    if (!el.solution) return;
    el.solution.innerHTML = html;
    solutionLoaded = true;
    setSolutionVisible(true);
  };

  on(el.solutionBtn, 'click', () => {
    if (solutionLoaded) { setSolutionVisible(!!el.solution && el.solution.hidden); return; }
    getJSON('/_dojo/solution/' + C.id).then((d) => {
      if (d.ok) showSolution(d.html);
      else toast(d.error || T('ch.solution.unavailable'), 'ko');
    }).catch(() => toast(T('ch.solution.unavailable'), 'ko'));
  });

  on(el.revealBtn, 'click', () => {
    if (!solved && !revealed && !window.confirm(T('ch.reveal.confirm'))) return;
    postJSON('/_dojo/reveal/' + C.id).then((d) => {
      if (!d.ok) return;
      revealed = d.revealed;
      setStatus();
      renderDebrief(d.debrief);
      showSolution(d.html);
      scrollTo(el.debrief);
      schedulePoll(0);
    }).catch(() => {});
  });

  /* ---------- 8. débrief et quiz ---------- */

  let debriefRendered = false;
  let quizRenderedKey = '';

  const quizButtons = () => (el.quizChoices ? Array.from(el.quizChoices.querySelectorAll('.quiz-choice')) : []);
  const lockChoice = (b, locked) => b.setAttribute('aria-disabled', locked ? 'true' : 'false');
  const isLocked = (b) => b.getAttribute('aria-disabled') === 'true';

  const setQuizResult = (kind, text) => {
    if (!el.quizResult) return;
    el.quizResult.hidden = false;
    el.quizResult.className = 'quiz-result ' + kind;
    el.quizResult.textContent = text;
  };

  const renderQuiz = (q) => {
    if (!q || !el.quizChoices) return;
    const key = q.tries + '/' + q.correct + '/' + (q.answer == null ? '-' : q.answer);
    if (key === quizRenderedKey) return;
    quizRenderedKey = key;
    setText(el.quizQ, q.question);
    el.quizChoices.innerHTML = '';
    (q.choices || []).forEach((label, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'quiz-choice';
      b.dataset.i = String(i);
      b.textContent = label;
      b.setAttribute('aria-pressed', q.correct && i === q.answer ? 'true' : 'false');
      lockChoice(b, !!q.correct);
      if (q.correct && i === q.answer) b.classList.add('is-right');
      b.addEventListener('click', () => { if (!isLocked(b)) answerQuiz(i); });
      el.quizChoices.appendChild(b);
    });
    if (q.correct) {
      setQuizResult('ok', (q.tries === 1 ? T('ch.quiz.first') : T('ch.quiz.after', { n: q.tries })) + ' ' + (q.why || ''));
    } else if (q.tries > 0) {
      setQuizResult('ko', T('ch.quiz.pending', { n: q.tries }));
    } else {
      setHidden(el.quizResult, true);
    }
  };

  const answerQuiz = (i) => {
    const buttons = quizButtons();
    buttons.forEach((b) => { lockChoice(b, true); b.setAttribute('aria-pressed', 'false'); });
    postJSON('/_dojo/quiz/' + C.id, { choice: i }).then((d) => {
      if (!d.ok) {
        buttons.forEach((b) => lockChoice(b, false));
        toast(d.error || T('ch.quiz.wrong'), 'ko');
        return;
      }
      const chosen = buttons[i];
      if (chosen) chosen.setAttribute('aria-pressed', 'true');
      if (d.correct) {
        if (chosen) chosen.classList.add('is-right');
        setQuizResult('ok', (d.tries === 1 ? T('ch.quiz.first') : T('ch.quiz.later')) + ' ' + (d.why || ''));
        setScore(d.score);
        toast(T('ch.quiz.toast', { pts: d.tries === 1 ? '+25' : '+10' }), 'ok');
      } else {
        if (chosen) chosen.classList.add('is-wrong');
        setQuizResult('ko', T('ch.quiz.wrong'));
        setTimeout(() => {
          buttons.forEach((b) => { if (!b.classList.contains('is-wrong')) lockChoice(b, false); });
        }, 400);
      }
      /* même clé que celle que le serveur renverra : le prochain poll ne re-rend pas le quiz */
      quizRenderedKey = d.tries + '/' + d.quizCorrect + '/' + (d.answer == null ? '-' : d.answer);
    }).catch(() => buttons.forEach((b) => lockChoice(b, false)));
  };

  const renderDebrief = (d) => {
    if (!d) return;
    if (!debriefRendered) {
      setText(el.cause, d.cause);
      setText(el.reflex, d.reflex);
      setHidden(el.debrief, false);
      debriefRendered = true;
    }
    setText(el.debriefBadge, solved ? T('ch.status.done') : T('ch.status.seen'));
    setClass(el.debriefBadge, 'badge ' + (solved ? 'badge-ok' : 'badge-seen'));
    renderQuiz(d.quiz);
  };

  /* ---------- 9. synchronisation : polling adaptatif ---------- */

  /*
   * Cadence de /_dojo/state/:id :
   *   - 1,5 s pendant les 10 s qui suivent une action du joueur (clic dans le
   *     terrain de jeu, clavier) ou le chargement de la page ;
   *   - 4 s au repos ;
   *   - 15 s une fois le défi résolu ;
   *   - rien quand l'onglet est caché ; un poll immédiat au retour ou au focus.
   * Le dernier ETag est renvoyé en If-None-Match : un 304 ne coûte rien à lire.
   * Une erreur réseau est silencieuse : on réessaie au tick suivant.
   */
  const POLL = { active: 1500, idle: 4000, solved: 15000, activeWindow: 10000, minGap: 1500 };
  let lastActivity = Date.now();
  let lastPollAt = 0;
  let pollDueAt = 0;
  let pollTimer = null;
  let inFlight = false;
  let etag = null;

  const isVisible = () => document.visibilityState !== 'hidden';
  const cadence = () => {
    if (solved) return POLL.solved;
    return Date.now() - lastActivity < POLL.activeWindow ? POLL.active : POLL.idle;
  };

  const celebrate = (s) => {
    document.body.classList.add('is-solved');
    setClass(el.verdict, 'verdict ok');
    if (el.chrono) el.chrono.classList.add('frozen');
    const pts = typeof s.score === 'number' ? s.score : null;
    toast(T('ch.solved.toast', { time: fmt(s.durationMs || 0), pts: pts != null ? ' · ' + pts + ' ' + T('g.pts') : '' }), 'ok');
    setTimeout(() => scrollTo(el.debrief), 900);
  };

  const applyState = (s) => {
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
    if (el.next && s.nextId && el.next.dataset.autoNext !== '0') el.next.href = '/challenge/' + s.nextId;
  };

  const poll = () => {
    if (inFlight || !C.id) return Promise.resolve();
    inFlight = true;
    lastPollAt = Date.now();
    const headers = { Accept: 'application/json' };
    if (etag) headers['If-None-Match'] = etag;
    return fetch('/_dojo/state/' + C.id, { headers })
      .then((r) => {
        if (r.status === 304) return null;
        const tag = r.headers.get('ETag');
        if (tag) etag = tag;
        return r.ok ? r.json() : null;
      })
      .then(applyState)
      .catch(() => {})
      .then(() => { inFlight = false; });
  };

  /* Programme le prochain poll dans `delay` ms (cadence courante par défaut). */
  const schedulePoll = (delay) => {
    clearTimeout(pollTimer);
    pollTimer = null;
    if (!isVisible()) { pollDueAt = 0; return; }
    const wait = delay == null ? cadence() : delay;
    pollDueAt = Date.now() + wait;
    pollTimer = setTimeout(() => poll().then(() => schedulePoll()), wait);
  };

  /* Poll immédiat (retour d'onglet, focus), sans rafale si un poll vient d'avoir lieu. */
  const pollNow = () => {
    if (!isVisible()) return;
    if (Date.now() - lastPollAt < POLL.minGap) { schedulePoll(); return; }
    schedulePoll(0);
  };

  const noteActivity = () => {
    lastActivity = Date.now();
    if (solved || !isVisible()) return;
    if (!pollTimer || pollDueAt - lastActivity > POLL.active) schedulePoll(POLL.active);
  };

  on(el.workspace, 'click', noteActivity, true);
  on(document, 'keydown', noteActivity, { capture: true, passive: true });
  on(document, 'visibilitychange', () => { if (isVisible()) pollNow(); else schedulePoll(); });
  on(window, 'focus', pollNow);
  on(window, 'pageshow', (e) => { if (e.persisted) pollNow(); });
  on(window, 'pagehide', () => { clearTimeout(pollTimer); pollTimer = null; });

  /* ---------- 10. démarrage ---------- */

  tickChrono();
  setInterval(tickChrono, 500);
  setStatus();
  updateHintCounter(C.hints || 0);
  restoreHints();
  poll().then(() => schedulePoll());
})();

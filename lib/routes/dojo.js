'use strict';

/*
 * Endpoints internes /_dojo/* (session requise, non journalisés) : état d'un défi,
 * indices, corrigé, quiz, remise à zéro, compte, export, résumé.
 */

const express = require('express');
const i18n = require('../i18n');
const { BY_ID } = require('../render');

function mount(app, ctx) {
  const { store, render: R } = ctx;
  const { t, ctxOf, noStore, requireAuth, nextRecommended, challengeIn, solutionHtml } = R;

  app.use('/_dojo', express.json({ limit: '50kb' }), (req, res, next) => { noStore(res); next(); }, requireAuth);

  function debriefPayload(c, e) {
    if (!(e.solved || e.revealed)) return null;
    return {
      cause: c.debrief.cause,
      reflex: c.debrief.reflex,
      quiz: { question: c.quiz.question, choices: c.quiz.choices, tries: e.quiz.tries, correct: e.quiz.correct,
        answer: e.quiz.correct ? c.quiz.answer : null, why: e.quiz.correct ? c.quiz.why : null }
    };
  }

  /* État complet d'un défi : deux requêtes (entrées du compte, journal). ETag faible
   * dérivé de la langue, de la dernière écriture de progression et du dernier verdict :
   * 304 uniquement si le client envoie un If-None-Match identique. */
  app.get('/_dojo/state/:id', (req, res) => {
    const c0 = ctxOf(req);
    const c = challengeIn(req.params.id, c0.lang);
    if (!c) return res.status(404).json({ ok: false });
    const snap = store.snapshot(c0.slug);
    const e = snap.entries[c.id];
    const log = store.attempts(c0.slug, c.id);
    const last = store.lastAttemptOf(log[0]);
    const etag = 'W/"' + c0.lang + '.' + snap.version + '.' + (last ? last.at : 0) + '"';
    res.setHeader('ETag', etag);
    if (req.headers['if-none-match'] && req.headers['if-none-match'] === etag) return res.status(304).end();
    res.json({
      ok: true, id: c.id, profile: c0.slug,
      solved: !!e.solved, hints: e.hints || 0, attempts: e.attempts || 0, revealed: !!e.revealed,
      startedAt: e.startedAt, durationMs: e.durationMs, score: store.scoreEntry(e, c),
      quiz: e.quiz,
      lastAttempt: last,
      log,
      debrief: debriefPayload(c, e),
      nextId: nextRecommended(snap.entries, c.id)
    });
  });

  app.post('/_dojo/hint/:id', (req, res) => {
    const c0 = ctxOf(req);
    const c = challengeIn(req.params.id, c0.lang);
    if (!c) return res.status(404).json({ ok: false });
    const level = Math.max(1, Math.min(3, parseInt(req.query.level, 10) || 1));
    const e = store.setHints(c0.slug, c.id, level);
    res.json({ ok: true, level, text: c.hints[level - 1], hints: e.hints || 0 });
  });

  app.post('/_dojo/reveal/:id', (req, res) => {
    const c0 = ctxOf(req);
    const c = challengeIn(req.params.id, c0.lang);
    if (!c) return res.status(404).json({ ok: false });
    const e = store.markRevealed(c0.slug, c.id);
    res.json({ ok: true, revealed: !!e.revealed, solved: !!e.solved, html: solutionHtml(c.id, c0.lang), debrief: debriefPayload(c, e) });
  });

  app.get('/_dojo/solution/:id', (req, res) => {
    const c0 = ctxOf(req);
    const c = challengeIn(req.params.id, c0.lang);
    if (!c) return res.status(404).json({ ok: false });
    const e = store.entry(c0.slug, c.id);
    if (!(e.solved || e.revealed)) return res.status(403).json({ ok: false, error: t(c0.lang, 'dojo.solution.locked') });
    res.json({ ok: true, html: solutionHtml(c.id, c0.lang) });
  });

  app.post('/_dojo/quiz/:id', (req, res) => {
    const c0 = ctxOf(req);
    const c = challengeIn(req.params.id, c0.lang);
    if (!c) return res.status(404).json({ ok: false });
    let e = store.entry(c0.slug, c.id);
    if (!(e.solved || e.revealed)) return res.status(403).json({ ok: false, error: t(c0.lang, 'dojo.quiz.locked') });
    const choice = parseInt(req.body && req.body.choice, 10);
    if (isNaN(choice) || choice < 0 || choice >= c.quiz.choices.length) return res.status(400).json({ ok: false, error: t(c0.lang, 'dojo.quiz.bad') });
    const correct = choice === c.quiz.answer;
    if (!e.quiz.correct) e = store.answerQuiz(c0.slug, c.id, correct);
    res.json({
      ok: true, correct, tries: e.quiz.tries, quizCorrect: e.quiz.correct,
      answer: e.quiz.correct ? c.quiz.answer : null, why: correct ? c.quiz.why : null,
      score: store.scoreEntry(e, c)
    });
  });

  app.post('/_dojo/reset/:id', (req, res) => {
    if (!BY_ID.has(req.params.id)) return res.status(404).json({ ok: false });
    store.resetEntries(req.slug, [req.params.id]);
    res.json({ ok: true });
  });

  app.post('/_dojo/reset', (req, res) => {
    store.resetEntries(req.slug, null);
    res.json({ ok: true });
  });

  app.post('/_dojo/account/lang', (req, res) => {
    const lang = i18n.normLang(req.body && req.body.lang);
    if (!lang) return res.status(400).json({ ok: false, error: t(ctxOf(req).lang, 'dojo.lang.bad') });
    store.setLang(req.slug, lang);
    res.setHeader('Set-Cookie', i18n.cookieHeader(lang));
    res.json({ ok: true, lang });
  });

  app.post('/_dojo/account/delete', (req, res) => {
    store.deleteUser(req.slug);
    res.setHeader('Set-Cookie', store.clearSessionCookie());
    res.json({ ok: true });
  });

  app.get('/_dojo/export', (req, res) => {
    res.setHeader('Content-Disposition', 'attachment; filename="debug-frontend-' + req.slug + '.json"');
    res.json(store.exportUser(req.slug));
  });

  app.get('/_dojo/summary', (req, res) => {
    res.json({ ok: true, me: store.summary(req.slug), board: store.leaderboard() });
  });
}

module.exports = { mount };

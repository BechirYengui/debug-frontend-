/*
 * Tableau de bord et page Profil : remise à zéro, filtres, langue, compte.
 * Servi tel quel (ES2017, sans bundler). Chaque bloc tolère l'absence de son élément.
 */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const H = window.DOJO_HOME || {};

  const postJSON = (url, data) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data || {})
  }).then((r) => r.json());

  /* Certains défis laissent une trace dans le stockage du navigateur : on la purge
     à la remise à zéro pour que le défi soit rejouable dans les mêmes conditions. */
  const BROWSER_STATE = { '16': ['pricing.session'] };
  const purgeBrowserState = (id) => {
    const keys = id ? (BROWSER_STATE[id] || []) : Object.keys(BROWSER_STATE).reduce((acc, k) => acc.concat(BROWSER_STATE[k]), []);
    keys.forEach((k) => { try { localStorage.removeItem(k); } catch (e) { /* stockage indisponible */ } });
  };

  /* ---------- remise à zéro ---------- */

  document.querySelectorAll('.cc-reset').forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.dataset.id;
      purgeBrowserState(id);
      postJSON('/_dojo/reset/' + id).then(() => location.reload());
    });
  });

  const resetAll = $('reset-all');
  if (resetAll) {
    resetAll.addEventListener('click', () => {
      if (!window.confirm(H.confirmReset || 'Reset all challenges?')) return;
      purgeBrowserState(null);
      postJSON('/_dojo/reset').then(() => location.reload());
    });
  }

  /* ---------- compte ---------- */

  const langSelect = $('lang-select');
  if (langSelect) {
    langSelect.addEventListener('change', () => {
      postJSON('/_dojo/account/lang', { lang: langSelect.value }).then(() => location.reload());
    });
  }

  const del = $('account-delete');
  if (del) {
    del.addEventListener('click', () => {
      if (!window.confirm(H.confirmDelete || 'Delete your account?')) return;
      purgeBrowserState(null);
      postJSON('/_dojo/account/delete').then(() => { location.href = '/'; });
    });
  }

  /* ---------- filtres ---------- */

  const filters = $('filters');
  if (filters) {
    const cards = Array.from(document.querySelectorAll('.cc'));
    let current = 'all';
    try { current = localStorage.getItem('dojo.filter') || 'all'; } catch (e) { /* stockage indisponible */ }

    const apply = (f) => {
      current = f;
      try { localStorage.setItem('dojo.filter', f); } catch (e) { /* stockage indisponible */ }
      filters.querySelectorAll('.filter').forEach((b) => {
        const onIt = b.dataset.filter === f;
        b.classList.toggle('is-on', onIt);
        b.setAttribute('aria-pressed', onIt ? 'true' : 'false');
      });
      cards.forEach((c) => {
        const state = c.dataset.state;
        let show = true;
        if (f === 'todo') show = state === 'todo' || state === 'seen';
        else if (f === 'done') show = state === 'done' || state === 'half';
        else if (/^s[123]$/.test(f)) show = c.dataset.stars === f.slice(1);
        c.hidden = !show;
      });
      document.querySelectorAll('.family').forEach((fam) => {
        fam.classList.toggle('is-empty', fam.querySelectorAll('.cc:not([hidden])').length === 0);
      });
    };

    filters.addEventListener('click', (e) => {
      const b = e.target.closest('.filter');
      if (b) apply(b.dataset.filter);
    });
    apply(current);
  }
})();

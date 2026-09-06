/* Tableau de bord et page Profil : remise à zéro, filtres, langue, compte. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var H = window.DOJO_HOME || {};

  function postJSON(url, data) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data || {})
    }).then(function (r) { return r.json(); });
  }

  /* Certains défis laissent une trace dans le stockage du navigateur : on la purge
     à la remise à zéro pour que le défi soit rejouable dans les mêmes conditions. */
  var BROWSER_STATE = { '16': ['pricing.session'] };
  function purgeBrowserState(id) {
    var keys = id ? (BROWSER_STATE[id] || []) : Object.keys(BROWSER_STATE).reduce(function (acc, k) { return acc.concat(BROWSER_STATE[k]); }, []);
    keys.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
  }

  /* ---------------- remise à zéro ---------------- */

  document.querySelectorAll('.cc-reset').forEach(function (b) {
    b.addEventListener('click', function () {
      var id = b.dataset.id;
      purgeBrowserState(id);
      postJSON('/_dojo/reset/' + id).then(function () { location.reload(); });
    });
  });

  var resetAll = $('reset-all');
  if (resetAll) {
    resetAll.addEventListener('click', function () {
      if (!window.confirm(H.confirmReset || 'Reset all challenges?')) return;
      purgeBrowserState(null);
      postJSON('/_dojo/reset').then(function () { location.reload(); });
    });
  }

  /* ---------------- compte ---------------- */

  var langSelect = $('lang-select');
  if (langSelect) {
    langSelect.addEventListener('change', function () {
      postJSON('/_dojo/account/lang', { lang: langSelect.value }).then(function () { location.reload(); });
    });
  }

  var del = $('account-delete');
  if (del) {
    del.addEventListener('click', function () {
      if (!window.confirm(H.confirmDelete || 'Delete your account?')) return;
      purgeBrowserState(null);
      postJSON('/_dojo/account/delete').then(function () { location.href = '/'; });
    });
  }

  /* ---------------- filtres ---------------- */

  var filters = $('filters');
  if (filters) {
    var cards = Array.prototype.slice.call(document.querySelectorAll('.cc'));
    var current = 'all';
    try { current = localStorage.getItem('dojo.filter') || 'all'; } catch (e) {}

    function apply(f) {
      current = f;
      try { localStorage.setItem('dojo.filter', f); } catch (e) {}
      filters.querySelectorAll('.filter').forEach(function (b) {
        b.classList.toggle('is-on', b.dataset.filter === f);
      });
      cards.forEach(function (c) {
        var state = c.dataset.state;
        var show = true;
        if (f === 'todo') show = state === 'todo' || state === 'seen';
        else if (f === 'done') show = state === 'done' || state === 'half';
        else if (/^s[123]$/.test(f)) show = c.dataset.stars === f.slice(1);
        c.hidden = !show;
      });
      document.querySelectorAll('.family').forEach(function (fam) {
        var visible = fam.querySelectorAll('.cc:not([hidden])').length;
        fam.classList.toggle('is-empty', visible === 0);
      });
    }

    filters.addEventListener('click', function (e) {
      var b = e.target.closest('.filter');
      if (b) apply(b.dataset.filter);
    });
    apply(current);
  }
})();

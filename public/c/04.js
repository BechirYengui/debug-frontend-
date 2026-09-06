(function () {
  'use strict';

  var SEO_RULES = [
    { key: 'title-len', label: 'Titre entre 20 et 70 caractères' },
    { key: 'slug-shape', label: 'Slug en minuscules, tirets uniquement' },
    { key: 'excerpt-len', label: 'Chapô entre 15 et 45 mots' },
    { key: 'date-set', label: 'Date de publication renseignée' }
  ];

  var el = {};
  var revisions = [];
  var doc = { title: '', slug: '', section: '', excerpt: '', publishAt: '' };

  function byId(id) { return document.getElementById(id); }

  function logRevision(msg) {
    revisions.unshift(new Date().toTimeString().slice(0, 8) + '  ' + msg);
    revisions = revisions.slice(0, 10);
    el.revisions.innerHTML = revisions.map(function (r) { return '<div>' + r + '</div>'; }).join('');
  }

  function words(text) {
    return text.trim().split(/\s+/).filter(Boolean);
  }

  function slugify(text) {
    return text.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function evaluate(key) {
    switch (key) {
      case 'title-len': return doc.title.length >= 20 && doc.title.length <= 70;
      case 'slug-shape': return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(doc.slug);
      case 'excerpt-len': {
        var n = words(doc.excerpt).length;
        return n >= 15 && n <= 45;
      }
      case 'date-set': return !!doc.publishAt;
      default: return false;
    }
  }

  function renderSeo() {
    var passed = 0;
    el.seo.innerHTML = SEO_RULES.map(function (r) {
      var ok = evaluate(r.key);
      if (ok) passed += 1;
      return '<li><span class="dot ' + (ok ? '' : 'warn') + '"></span>' + r.label +
        ' <span class="chip ' + (ok ? 'chip-ok' : 'chip-warn') + '">' + (ok ? 'ok' : 'à revoir') + '</span></li>';
    }).join('');
    return Math.round((passed / SEO_RULES.length) * 100);
  }

  function readDoc() {
    doc.title = el.title.value;
    doc.slug = el.slug.value;
    doc.section = el.section.value;
    doc.excerpt = el.excerpt.value;
    doc.publishAt = el.publishAt.value;
  }

  function refresh() {
    readDoc();
    var w = words(doc.excerpt).length;
    el.mWords.textContent = w;
    el.mSlug.textContent = doc.slug.length;
    el.mRead.textContent = Math.max(1, Math.round(w / 40));
    var score = renderSeo();
    el.scoreChip.textContent = 'score ' + score;
    el.scoreChip.className = 'chip ' + (score === 100 ? 'chip-ok' : 'chip-warn');
    el.publishNote.textContent = score === 100
      ? 'Toutes les vérifications passent. Publication possible dans la rubrique ' + doc.section + '.'
      : score + ' % des vérifications passent.';
  }

  function send() {
    logRevision('publication demandée : ' + doc.slug);
    fetch('/api/challenge/04/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: '04',
        action: 'validate',
        slug: doc.slug,
        section: doc.section
      })
    })
      .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
      .then(function (res) {
        logRevision('réponse ' + res.s + ' : ' + (res.d.message || res.d.error));
        if (res.s === 200) {
          el.docState.textContent = 'en ligne';
          el.docState.className = 'chip chip-ok';
        }
      })
      .catch(function (err) { logRevision('échec réseau : ' + err.message); });
  }

  el.title = byId('title');
  el.slug = byId('slug');
  el.section = byId('section');
  el.excerpt = byId('excerpt');
  el.publishAt = byId('publish-at');
  el.seo = byId('seo');
  el.mWords = byId('m-words');
  el.mSlug = byId('m-slug');
  el.mRead = byId('m-read');
  el.scoreChip = byId('score-chip');
  el.publishNote = byId('publish-note');
  el.revisions = byId('revisions');
  el.publish = byId('publish');
  el.docState = byId('doc-state');

  el.publishAt.value = new Date().toISOString().slice(0, 10);

  el.title.addEventListener('input', function () {
    if (el.slug.dataset.touched !== '1') el.slug.value = slugify(el.title.value);
    refresh();
  });
  el.slug.addEventListener('input', function () { el.slug.dataset.touched = '1'; refresh(); });
  el.section.addEventListener('change', refresh);
  el.excerpt.addEventListener('input', refresh);
  el.publishAt.addEventListener('change', refresh);
  el.publish.addEventListener('click', send);

  refresh();
  logRevision('brouillon chargé, révision 7');
})();

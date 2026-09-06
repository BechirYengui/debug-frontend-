'use strict';

/*
 * Rendu Markdown minimal, sans dépendance, suffisant pour les corrigés et la
 * documentation du dojo : titres, paragraphes, listes (avec continuation et
 * blocs de code imbriqués), blocs de code, tableaux, code inline, gras,
 * italique, liens. Tout le texte est échappé avant l'injection dans le HTML.
 */

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inline(text) {
  // Le code inline est isolé par des jetons pour ne pas subir les autres transformations,
  // tout en laissant le gras / l'italique / les liens englober un fragment de code.
  var codes = [];
  var s = String(text).replace(/`([^`]*)`/g, function (m, c) {
    codes.push('<code>' + esc(c) + '</code>');
    return '\u0000' + (codes.length - 1) + '\u0000';
  });
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, label, href) {
    var safe = /^(https?:\/\/|\/|#)/.test(href) ? href : '#';
    return '<a href="' + esc(safe) + '"' + (/^https?:/.test(safe) ? ' target="_blank" rel="noopener"' : '') + '>' + label + '</a>';
  });
  s = s.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[\s(])_([^_\s][^_]*?)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  s = s.replace(/\u0000(\d+)\u0000/g, function (m, i) { return codes[Number(i)]; });
  return s;
}

function slug(text) {
  return String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function render(md) {
  var lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  var html = [];
  var i = 0;
  var listStack = []; // { type: 'ul'|'ol', indent }
  var paragraph = [];

  function flushParagraph() {
    if (paragraph.length) {
      html.push('<p>' + inline(paragraph.join(' ')) + '</p>');
      paragraph = [];
    }
  }

  function closeLists(toIndent) {
    while (listStack.length && (toIndent === undefined || listStack[listStack.length - 1].indent >= toIndent)) {
      var l = listStack.pop();
      html.push('</li></' + l.type + '>');
    }
  }

  function readFence(startIdx, fenceIndent) {
    var m = lines[startIdx].match(/^(\s*)```\s*([\w-]*)\s*$/);
    var lang = m ? m[2] : '';
    var buf = [];
    var j = startIdx + 1;
    while (j < lines.length && !/^\s*```\s*$/.test(lines[j])) {
      buf.push(lines[j].slice(0, fenceIndent).trim() === '' ? lines[j].slice(fenceIndent) : lines[j].replace(/^\s+/, ''));
      j += 1;
    }
    var code = '<pre class="code"' + (lang ? ' data-lang="' + esc(lang) + '"' : '') + '><code>' + esc(buf.join('\n')) + '</code></pre>';
    return { html: code, next: j + 1 };
  }

  while (i < lines.length) {
    var line = lines[i];

    // Ligne vide : ferme le paragraphe courant ; les listes restent ouvertes
    // (un élément peut être suivi d'un bloc indenté).
    if (/^\s*$/.test(line)) {
      flushParagraph();
      i += 1;
      continue;
    }

    var indent = line.match(/^\s*/)[0].length;

    // Bloc de code
    if (/^\s*```/.test(line)) {
      flushParagraph();
      if (listStack.length && indent > 0) {
        var fenced = readFence(i, indent);
        html.push(fenced.html);
        i = fenced.next;
        continue;
      }
      closeLists();
      var f = readFence(i, 0);
      html.push(f.html);
      i = f.next;
      continue;
    }

    // Titre
    var h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushParagraph();
      closeLists();
      var level = h[1].length;
      var text = h[2].replace(/\s+#+\s*$/, '');
      html.push('<h' + level + ' id="' + slug(text) + '">' + inline(text) + '</h' + level + '>');
      i += 1;
      continue;
    }

    // Séparateur
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flushParagraph();
      closeLists();
      html.push('<hr>');
      i += 1;
      continue;
    }

    // Tableau (ligne d'en-tête suivie d'une ligne de séparation)
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      flushParagraph();
      closeLists();
      var cells = function (l) {
        return l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); });
      };
      var head = cells(line);
      var rows = [];
      var j = i + 2;
      while (j < lines.length && /^\s*\|.*\|\s*$/.test(lines[j])) { rows.push(cells(lines[j])); j += 1; }
      var t = '<div class="table-wrap"><table><thead><tr>' +
        head.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; }).join('') +
        '</tbody></table></div>';
      html.push(t);
      i = j;
      continue;
    }

    // Citation
    if (/^\s*>\s?/.test(line)) {
      flushParagraph();
      closeLists();
      var q = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, '')); i += 1; }
      html.push('<blockquote>' + render(q.join('\n')) + '</blockquote>');
      continue;
    }

    // Élément de liste
    var li = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (li) {
      flushParagraph();
      var type = /^\d/.test(li[2]) ? 'ol' : 'ul';
      var top = listStack[listStack.length - 1];
      if (!top || indent > top.indent) {
        listStack.push({ type: type, indent: indent });
        html.push('<' + type + '><li>');
      } else {
        closeLists(indent + 1);
        top = listStack[listStack.length - 1];
        if (top && top.indent === indent) {
          html.push('</li><li>');
        } else {
          listStack.push({ type: type, indent: indent });
          html.push('<' + type + '><li>');
        }
      }
      var body = li[3];
      var cb = body.match(/^\[( |x|X)\]\s+(.*)$/);
      if (cb) {
        body = '<span class="cb' + (cb[1] === ' ' ? '' : ' on') + '"></span>' + cb[2];
        html.push('<span class="li-text">' + body.slice(0, body.indexOf('</span>') + 7) + inline(body.slice(body.indexOf('</span>') + 7)) + '</span>');
      } else {
        html.push('<span class="li-text">' + inline(body) + '</span>');
      }
      i += 1;
      continue;
    }

    // Continuation d'un élément de liste (ligne indentée sous un item)
    if (listStack.length && indent > 0) {
      html.push(' ' + inline(line.trim()));
      i += 1;
      continue;
    }

    // Ligne composée uniquement d'un segment en gras, en début de bloc : sous-titre
    // (ex. « **A. Variante** »). Au milieu d'un paragraphe, c'est du gras ordinaire.
    if (!paragraph.length && /^\*\*[^*]+\*\*\s*$/.test(line.trim())) {
      flushParagraph();
      closeLists();
      html.push('<h4>' + inline(line.trim().replace(/^\*\*|\*\*$/g, '')) + '</h4>');
      i += 1;
      continue;
    }

    // Paragraphe
    if (listStack.length && indent === 0) closeLists();
    paragraph.push(line.trim());
    i += 1;
  }
  flushParagraph();
  closeLists();
  return html.join('\n');
}

module.exports = { render: render, esc: esc, inline: inline };

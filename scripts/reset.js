'use strict';

/*
 * Remise à zéro de la progression.
 *
 *   npm run reset                    tous les défis du profil actif
 *   npm run reset 7                  seulement le défi 07 (profil actif)
 *   npm run reset 3 9 11             une sélection
 *   npm run reset -- --user=alice    un autre profil (slug ou nom)
 *   npm run reset -- --all           tous les profils, tous les défis
 *   npm run reset -- --list          lister les profils
 *
 * Le serveur relit progress.json à chaque démarrage : si `npm start` tourne,
 * redémarre-le après une remise à zéro faite ici (ou utilise les boutons du
 * tableau de bord, qui passent par le serveur).
 */

const fs = require('fs');
const path = require('path');
const { IDS } = require('../data/challenges');
const { createStore } = require('../lib/store');

const ROOT = path.join(__dirname, '..');
const FILE = process.env.DOJO_PROGRESS_FILE || path.join(ROOT, 'progress.json');

const args = process.argv.slice(2);
const flags = {};
const ids = [];
args.forEach((a) => {
  const m = a.match(/^--([a-z]+)(?:=(.*))?$/);
  if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
  else if (/^\d{1,2}$/.test(a)) ids.push(a.padStart(2, '0'));
});

const unknown = ids.filter((id) => IDS.indexOf(id) === -1);
if (unknown.length) {
  console.error('Défis inconnus : ' + unknown.join(', ') + ' (valides : ' + IDS.join(', ') + ')');
  process.exit(1);
}

const store = createStore({ file: FILE, ids: IDS, challenges: require('../data/challenges').CHALLENGES });

if (flags.list) {
  store.listUsers().forEach((u) => {
    const s = store.summary(u.slug);
    console.log((u.slug === store.activeSlug() ? '* ' : '  ') + u.slug.padEnd(20) + u.name.padEnd(24) + s.done + '/' + s.total + '  ' + s.score + ' pts  ceinture ' + s.beltKey + (s.dan ? ' (1er dan)' : ''));
  });
  process.exit(0);
}

if (flags.all) {
  store.listUsers().forEach((u) => store.resetEntries(u.slug, ids.length ? ids : null));
  console.log('Remis à zéro pour tous les profils : ' + (ids.length ? ids.join(', ') : 'les ' + IDS.length + ' défis') + '.');
  process.exit(0);
}

let slug = store.activeSlug();
if (flags.user) {
  const wanted = String(flags.user).toLowerCase();
  const found = store.listUsers().find((u) => u.slug === wanted || u.name.toLowerCase() === wanted);
  if (!found) {
    console.error('Profil inconnu : ' + flags.user + '. Utilise --list pour voir les profils.');
    process.exit(1);
  }
  slug = found.slug;
}

store.resetEntries(slug, ids.length ? ids : null);
console.log('Profil « ' + store.getUser(slug).name + ' » : ' + (ids.length ? 'défi(s) ' + ids.join(', ') : 'les ' + IDS.length + ' défis') + ' remis à zéro.');

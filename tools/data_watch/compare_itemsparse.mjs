// Compares the sim's item database against ItemSparse from the Forever beta client
// (wago.tools build 1.60.1.69893) — the authoritative source, unlike the gear-planner
// snapshot that left the question open last time.
//
// ItemSparse stores stats as (StatModifier_bonusStat_N, StatPercentEditor_N) pairs.
// bonusStat is the ITEM_MOD_* enum; -1 means the slot is unused. StatPercentEditor is an
// allocation budget, not the displayed value, so absolute numbers are not comparable —
// but WHICH stats an item carries is, and that is what settles whether an item was retuned.
import fs from 'fs';
import { fileURLToPath } from 'url';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
// Pass the ItemSparse CSV path as argv[2]; fetch it with
// curl -H 'User-Agent: wowsims-forever-data-watch' 'https://wago.tools/db2/ItemSparse/csv?build=1.60.1.69893'
const CSV = process.argv[2];
if (!CSV) { console.error('usage: node compare_itemsparse.mjs <ItemSparse.csv>'); process.exit(2); }

// ITEM_MOD_* -> the sim's Stat name, for the ones both sides model. These are the retail
// ids, which the beta client uses: 45 is spell power (Choker of the Fire Lord carries it,
// and 1019 items do), 38 attack power, 31/32 hit and crit rating. An earlier pass guessed
// 31 for spell power and reported 821 false "retunes" off the back of it.
const MOD = {
  3: 'Agility', 4: 'Strength', 5: 'Intellect', 6: 'Spirit', 7: 'Stamina',
  12: 'Defense', 13: 'Dodge', 14: 'Parry', 15: 'Block',
  31: 'Hit', 32: 'Crit',
  38: 'AttackPower', 45: 'SpellPower',
  // Resistance ids pinned by the items that carry them: 51 Fiery Cloak, 52 Icy Cloak,
  // 54 Ring of the Shadow, 55 Dragonscale (nature), 56 the remaining school. 53 is a lone
  // test item and 50 is generic armor resistance, so neither is mapped.
  51: 'FireResistance', 52: 'FrostResistance', 54: 'ShadowResistance',
  55: 'NatureResistance', 56: 'ArcaneResistance',
};

function splitCsv(line) {
  const out = [];
  let cur = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === ',' && !quoted) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

const lines = fs.readFileSync(CSV, 'utf8').split(/\r?\n/).filter(Boolean);
const header = splitCsv(lines[0]);
const idCol = header.indexOf('ID');
const nameCol = header.indexOf('Display_lang');
const statCols = [...Array(10)].map((_, i) => header.indexOf(`StatModifier_bonusStat_${i}`));

// Which stat ids each client item carries.
const client = new Map();
for (const line of lines.slice(1)) {
  const cells = splitCsv(line);
  const ids = statCols.map(c => Number(cells[c])).filter(v => v >= 0);
  client.set(Number(cells[idCol]), { name: cells[nameCol], stats: new Set(ids) });
}
console.log(`client items: ${client.size}`);

// Which stats each sim item carries.
const protoSource = fs.readFileSync(REPO + 'sim/core/proto/common.pb.go', 'utf8');
const statName = {};
for (const m of protoSource.matchAll(/Stat_Stat(\w+)\s+Stat = (\d+)/g)) statName[m[2]] = m[1];

const db = JSON.parse(fs.readFileSync(REPO + 'assets/database/db.json', 'utf8'));
console.log(`sim items:    ${(db.items ?? []).length}`);

// Only compare stats both sides actually model, so an unmapped client stat is not a false hit.
const modelled = new Set(Object.values(MOD));

// The client has one generic hit/crit rating (mods 31/32); the sim splits each into a melee
// and a spell variant and picks by item type. Fold the sim's back down so the comparison is
// about which stats an item carries, not about a distinction only one side draws.
const fold = name => name.replace(/^(Melee|Spell|Ranged)(Hit|Crit)$/, '$2');

let compared = 0;
const retuned = [];
for (const item of db.items ?? []) {
  const theirs = client.get(item.id);
  if (!theirs) continue;
  compared++;

  const ourStats = new Set(
    (item.stats ?? [])
      .map((v, i) => (v ? statName[i] : null))
      .filter(Boolean)
      .map(fold)
      .filter(n => modelled.has(n)),
  );
  const theirStats = new Set(
    [...theirs.stats].map(id => MOD[id]).filter(n => n && modelled.has(n)).map(fold),
  );

  const onlyClient = [...theirStats].filter(s => !ourStats.has(s));
  const onlySim = [...ourStats].filter(s => !theirStats.has(s));
  if (onlyClient.length || onlySim.length) {
    retuned.push({
      id: item.id, name: item.name,
      ilvl: item.ilvl ?? item.itemLevel ?? 0,
      onlyClient, onlySim,
    });
  }
}

console.log(`\ncompared ${compared} items present in both`);
console.log(`${retuned.length} carry a different SET of stats\n`);

retuned.sort((a, b) => b.ilvl - a.ilvl);
for (const r of retuned.slice(0, 30)) {
  const parts = [];
  if (r.onlyClient.length) parts.push(`client adds ${r.onlyClient.join('/')}`);
  if (r.onlySim.length) parts.push(`sim has ${r.onlySim.join('/')} the client lacks`);
  console.log(`  [ilvl ${String(r.ilvl).padStart(3)}] ${r.name} (${r.id}): ${parts.join('; ')}`);
}

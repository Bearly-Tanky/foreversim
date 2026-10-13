// Reads a talent's per-rank values straight out of the beta client's Trait tables.
//
// The chain is: SpellName (or TraitDefinition.OverrideName_lang) -> TraitDefinition ->
// TraitDefinitionEffectPoints -> CurvePoint. CurvePoint stores (Pos_0, Pos_1) pairs where
// Pos_0 is the rank and Pos_1 the value at that rank — this is the only place the per-rank
// numbers live. SpellEffect.EffectBasePointsF holds only the max-rank value and is
// sometimes stale, so it must not be used for this.
//
//   node trait-curve.mjs "Moonfury" "Lethality" ...
import https from 'https';

const BUILD = '1.60.1.69893';
const UA = { 'User-Agent': 'wowsims-forever-data-watch' };

const get = url => new Promise((resolve, reject) => {
  https.get(url, { headers: UA }, res => {
    let body = '';
    res.on('data', c => (body += c));
    res.on('end', () => resolve(body));
  }).on('error', reject);
});

function parse(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = splitCsv(lines[0]);
  return lines.slice(1).map(line => {
    const cells = splitCsv(line);
    const row = {};
    header.forEach((k, i) => (row[k] = cells[i]));
    return row;
  });
}

function splitCsv(line) {
  const out = [];
  let cur = '', quoted = false;
  for (const ch of line) {
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === ',' && !quoted) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

const wanted = process.argv.slice(2);
if (!wanted.length) {
  console.error('usage: node trait-curve.mjs <talent name> [...]');
  process.exit(2);
}

const [spellNames, definitions, effectPoints, curvePoints] = await Promise.all([
  get(`https://wago.tools/db2/SpellName/csv?build=${BUILD}`).then(parse),
  get(`https://wago.tools/db2/TraitDefinition/csv?build=${BUILD}`).then(parse),
  get(`https://wago.tools/db2/TraitDefinitionEffectPoints/csv?build=${BUILD}`).then(parse),
  get(`https://wago.tools/db2/CurvePoint/csv?build=${BUILD}`).then(parse),
]);

const byCurve = new Map();
for (const point of curvePoints) {
  if (!byCurve.has(point.CurveID)) byCurve.set(point.CurveID, []);
  byCurve.get(point.CurveID).push(point);
}

for (const name of wanted) {
  const lower = name.toLowerCase();
  const spellIds = new Set(
    spellNames.filter(s => (s.Name_lang ?? '').toLowerCase() === lower).map(s => s.ID),
  );
  const defs = definitions.filter(
    d => spellIds.has(d.SpellID) || (d.OverrideName_lang ?? '').toLowerCase() === lower,
  );

  if (!defs.length) {
    console.log(`${name}: no trait definition`);
    continue;
  }

  const defIds = new Set(defs.map(d => d.ID));
  const points = effectPoints.filter(p => defIds.has(p.TraitDefinitionID));
  if (!points.length) {
    console.log(`${name}: definition found but no effect points (value may be in the spell itself)`);
    continue;
  }

  console.log(name + ':');
  for (const point of points) {
    const curve = (byCurve.get(point.CurveID) ?? [])
      .sort((a, b) => Number(a.OrderIndex) - Number(b.OrderIndex))
      .map(c => `${c.Pos_0}:${c.Pos_1}`);
    console.log(`  effect ${point.EffectIndex} curve ${point.CurveID} -> ${curve.join('  ')}`);
  }
}

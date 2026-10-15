// "You against the sim": a fight's casts and damage per ability next to the sim's own rotation in
// the same fight (the average of 1,000), with the biggest differences called out.

import { actionInfo, iconUrl, names, parseAction } from './replay.js';

const fmt = (n, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const cleanName = name => name.replace(/\s*\(Rank \d+\)$/, '');

/** "{SpellID: 23894, Tag: 1}" or "pet:{…}" → the action shape the log parser makes. */
export const actionOf = key => parseAction(key.replace(/^pet:/, '').replace(/^\{|\}$/g, ''));

/** Resolves a name and icon (data URL) for an action, cached. */
export async function infoOf(action) {
	const info = await (names.get(action.key) ?? actionInfo(action));
	info.iconUrl ??= await iconUrl(info.icon);
	return info;
}

/**
 * Fills `box` with the comparison. `you` and `reference` are {dps, duration, actions: {key:
 * {casts, damage, pet}}}; `pressable` (a Set of keys) limits the advice to abilities the player
 * presses, `again` adds a button.
 */
export async function renderComparison(box, { you, reference }, { pressable = null, again = null, againLabel = 'Fight again', youLabel = 'You' } = {}) {
	if (reference.error) throw new Error(reference.error);
	// The sim's numbers for a fight as long as yours.
	const scale = you.duration / (reference.duration || you.duration);
	const keys = new Set([...Object.keys(you.actions), ...Object.keys(reference.actions)]);
	const rows = [];
	for (const key of keys) {
		const mine = you.actions[key] ?? { casts: 0, damage: 0 };
		const theirs = reference.actions[key] ?? { casts: 0, damage: 0 };
		if (mine.damage <= 0 && theirs.damage <= 0 && mine.casts < 1 && theirs.casts * scale < 0.5) continue;
		// The engine's own bookkeeping (rage gains, waiting) is not an ability: only melee and
		// ranged swings of the "other" actions are.
		const action = actionOf(key);
		if (action.otherId && action.otherId !== 3 && action.otherId !== 4) continue;
		if (!action.otherId && !action.spellId && !action.itemId) continue;
		const info = await infoOf(actionOf(key));
		const pet = key.startsWith('pet:');
		// The engine keeps a spell's hits with each hand apart; they are one ability here.
		const merged = rows.find(r => r.pet === pet && cleanName(r.info.name) === cleanName(info.name));
		if (merged) {
			merged.you.casts += mine.casts;
			merged.you.damage += mine.damage;
			merged.sim.casts += theirs.casts * scale;
			merged.sim.damage += theirs.damage * scale;
			if (pressable?.has(key)) merged.key = key;
			continue;
		}
		rows.push({ key, info, pet, you: { casts: mine.casts, damage: mine.damage }, sim: { casts: theirs.casts * scale, damage: theirs.damage * scale } });
	}
	rows.sort((a, b) => b.sim.damage - a.sim.damage || b.you.damage - a.you.damage);
	const youTotal = rows.reduce((s, r) => s + r.you.damage, 0) || 1;
	const simTotal = rows.reduce((s, r) => s + r.sim.damage, 0) || 1;
	const ratio = you.dps / (reference.dps || 1);
	const verdict = ratio >= 1.02 ? 'You beat the sim!' : ratio >= 0.95 ? 'Very close to the sim.' : ratio >= 0.85 ? 'Not far off.' : 'Room to improve.';

	// The biggest gaps in how often things were used (only abilities you press).
		const gap = r => (!pressable || pressable.has(r.key)) && Math.abs(r.you.casts - r.sim.casts) >= Math.max(2, r.sim.casts * 0.2);
	const tips = rows
		.filter(gap)
		.sort((a, b) => Math.abs(b.you.casts - b.sim.casts) - Math.abs(a.you.casts - a.sim.casts))
		.slice(0, 3)
		.map(r => `${r.you.casts < r.sim.casts ? 'Use more' : 'Use less'} <b>${cleanName(r.info.name)}</b>: you ${fmt(r.you.casts)} times, the sim ${fmt(r.sim.casts)}`);

	box.innerHTML = `
		<h3>${verdict}</h3>
		<div class="summary-dps"><div><small>${youLabel}</small><b>${fmt(you.dps)}</b><small>DPS</small></div><div class="vs" data-better="${ratio >= 1}">${ratio >= 1 ? '+' : '−'}${fmt(Math.abs(ratio - 1) * 100, 1)}%</div><div><small>The sim's rotation</small><b>${fmt(reference.dps)}</b><small>DPS</small></div></div>
		${tips.length ? `<ul class="summary-tips">${tips.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
		<div class="summary-table"><table><thead><tr><th>Ability</th><th>Your casts</th><th>Sim casts</th><th>Your damage</th><th>Sim damage</th></tr></thead><tbody></tbody></table></div>
		<p class="hint">The sim's numbers are the average of 1,000 fights with your gear, talents and buffs${Math.abs(scale - 1) > 0.01 ? `, scaled to your ${fmtTime(you.duration)}` : ''}.</p>
		<div class="row">${again ? `<button id="summary-again">${againLabel}</button>` : ''}<button id="summary-close">Close</button></div>`;
	const body = box.querySelector('tbody');
	for (const r of rows.slice(0, 14)) {
		const tr = document.createElement('tr');
		tr.innerHTML = `<td><span class="icon"></span><span></span></td><td>${fmt(r.you.casts)}</td><td>${fmt(r.sim.casts, r.sim.casts < 10 ? 1 : 0)}</td><td>${Math.round((r.you.damage / youTotal) * 100)}%</td><td>${Math.round((r.sim.damage / simTotal) * 100)}%</td>`;
		tr.querySelector('td span:last-child').textContent = cleanName(r.info.name) + (r.pet ? ' (pet)' : '');
		const icon = tr.querySelector('.icon');
		if (r.info.iconUrl === 'melee') icon.textContent = '⚔';
		else if (r.info.iconUrl) icon.style.backgroundImage = `url(${r.info.iconUrl})`;
		if (gap(r)) tr.dataset.gap = r.you.casts < r.sim.casts ? 'less' : 'more';
		body.append(tr);
	}
	box.querySelector('#summary-again')?.addEventListener('click', again);
	box.querySelector('#summary-close').addEventListener('click', () => box.remove());
}


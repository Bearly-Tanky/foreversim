// The program around the page: the first-run screen that finds (or asks for) the WoW folder,
// and the version line with the update button.

const json = (url, options) =>
	fetch(url, options).then(async r => {
		if (!r.ok) throw new Error((await r.text()).trim() || r.statusText);
		return r.json();
	});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function el(html) {
	const t = document.createElement('template');
	t.innerHTML = html.trim();
	return t.content.firstElementChild;
}
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Resolves once the game files are open, showing the setup screen until then. */
export async function ensureReady() {
	let info = await json('/api/info');
	let screen = null;
	while (info.status !== 'ready') {
		if (info.status === 'loading') {
			screen ??= showScreen();
			screen.body.innerHTML = `<p>Opening the game files${info.wowDir ? ` in <code>${esc(info.wowDir)}</code>` : ''}…</p><p class="hint">The first start takes a minute or two.</p>`;
			await sleep(1000);
		} else {
			screen ??= showScreen();
			await setupForm(screen, info);
		}
		info = await json('/api/info');
	}
	screen?.root.remove();
	return info;
}

function showScreen() {
	const root = el(`<div class="app-screen"><div class="app-card"><h2>Forever Sim</h2><div class="app-body"></div></div></div>`);
	document.body.append(root);
	return { root, body: root.querySelector('.app-body') };
}

/** The setup form; resolves when a folder was accepted. */
async function setupForm(screen, info) {
	const setup = await json('/api/setup');
	const installs = setup.installs ?? [];
	screen.body.innerHTML = `
		<p>${esc(setup.problem || info.problem || 'Choose your World of Warcraft folder.')}</p>
		${installs.length ? `<p class="hint">Found on this computer:</p><div class="app-installs">${installs.map((install, i) => `<label class="app-install"><input type="radio" name="install" value="${i}" ${i === 0 ? 'checked' : ''} /><span><b>${esc(install.dir)}</b><small>${install.games.map(g => `${esc(g.product)} ${esc(g.version)}${g.forever ? ' · Forever' : ''}`).join('<br>')}</small></span></label>`).join('')}</div>` : ''}
		<label>World of Warcraft folder <input id="app-dir" placeholder="${navigator.platform.startsWith('Win') ? 'C:\\Program Files (x86)\\World of Warcraft' : '~/Games/battlenet/drive_c/Program Files (x86)/World of Warcraft'}" /></label>
		<p class="hint">The folder that holds the launcher's game folders (_classic_beta_, _retail_…). Copy it from the Battle.net launcher: Options → Game Settings → Show in Explorer.</p>
		<label>Game <select id="app-product"><option value="">Forever (found automatically)</option></select></label>
		<p class="app-error" id="app-error"></p>
		<button id="app-save">Use this folder</button>`;
	const dir = screen.body.querySelector('#app-dir');
	const product = screen.body.querySelector('#app-product');
	const fill = install => {
		dir.value = install?.dir ?? setup.wowDir ?? '';
		product.innerHTML = '<option value="">Forever (found automatically)</option>' + (install?.games ?? []).map(g => `<option value="${esc(g.product)}">${esc(g.product)} ${esc(g.version)}${g.forever ? ' (Forever)' : ''}</option>`).join('');
	};
	fill(installs[0]);
	for (const radio of screen.body.querySelectorAll('[name=install]')) radio.addEventListener('change', () => fill(installs[Number(radio.value)]));
	return new Promise(resolve => {
		screen.body.querySelector('#app-save').addEventListener('click', async () => {
			const error = screen.body.querySelector('#app-error');
			error.textContent = '';
			try {
				await json('/api/setup', { method: 'POST', body: JSON.stringify({ wowDir: dir.value.trim(), product: product.value }) });
				resolve();
			} catch (e) {
				error.textContent = e.message;
			}
		});
	});
}

/** Lets the user point at another folder later (from the settings link). */
export async function changeFolder() {
	const screen = showScreen();
	const close = el('<button class="app-close" title="Close">×</button>');
	close.addEventListener('click', () => screen.root.remove());
	screen.root.querySelector('.app-card').prepend(close);
	await setupForm(screen, await json('/api/info'));
	screen.root.remove();
	await ensureReady();
	location.reload();
}

/** The version line at the bottom of the sidebar, with the update button when there is one. */
export async function renderVersion(container) {
	container.innerHTML = `<span id="app-version"></span> · <a href="#" id="app-folder">Game folder</a> · <a href="#" id="app-check">Check for updates</a><div id="app-update"></div>`;
	container.querySelector('#app-folder').addEventListener('click', event => {
		event.preventDefault();
		changeFolder();
	});
	const show = async force => {
		const box = container.querySelector('#app-update');
		const u = await json(`/api/update${force ? '?force=1' : ''}`).catch(e => ({ error: e.message }));
		container.querySelector('#app-version').textContent = `Forever Sim ${u.version ?? ''}`;
		box.innerHTML = '';
		if (u.dev) {
			if (force) box.textContent = 'This copy runs from the source code: update it with git.';
			return;
		}
		if (u.error) {
			if (force) box.textContent = `Could not check: ${u.error}`;
			return;
		}
		if (!u.available) {
			if (force) box.textContent = `Up to date (latest: ${u.latest}).`;
			return;
		}
		box.innerHTML = `<button id="app-update-now">Update to ${esc(u.latest)}</button><details><summary>What's new</summary><pre></pre></details>`;
		box.querySelector('pre').textContent = u.notes || u.name || '';
		box.querySelector('#app-update-now').addEventListener('click', () => update(u.latest));
	};
	container.querySelector('#app-check').addEventListener('click', event => {
		event.preventDefault();
		show(true);
	});
	show(false);
}

async function update(target) {
	const screen = showScreen();
	screen.body.innerHTML = `<p>Downloading Forever Sim ${esc(target)}…</p>`;
	try {
		await json('/api/update', { method: 'POST' });
	} catch (e) {
		screen.body.innerHTML = `<p class="app-error">The update failed: ${esc(e.message)}</p><button>Close</button>`;
		screen.body.querySelector('button').addEventListener('click', () => screen.root.remove());
		return;
	}
	screen.body.innerHTML = `<p>Restarting with the new version…</p>`;
	for (let i = 0; i < 120; i++) {
		await sleep(1000);
		const info = await json('/api/info').catch(() => null);
		if (info?.version === target) {
			location.reload();
			return;
		}
	}
	screen.body.innerHTML = '<p>The new version did not come up. Start Forever Sim again.</p>';
}

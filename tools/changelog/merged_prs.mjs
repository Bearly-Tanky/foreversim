// Writes ui/app/changelog/merged.json: every pull request merged into master, newest first,
// for the changelog page's "Every merged pull request" section. The Update Changelog
// workflow runs it after each merge and commits the result, so the list is never behind
// the site it describes. Needs GITHUB_TOKEN for the API's rate limit; nothing else.
//
//   GITHUB_TOKEN=... node tools/changelog/merged_prs.mjs
import fs from 'fs';

const repo = process.env.GITHUB_REPOSITORY ?? 'ElliotWood/Forever';
const outPath = process.argv[2] ?? 'ui/app/changelog/merged.json';

const headers = { Accept: 'application/vnd.github+json', 'User-Agent': repo };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const merged = [];
for (let page = 1; ; page++) {
	const url = `https://api.github.com/repos/${repo}/pulls?state=closed&base=master&per_page=100&page=${page}`;
	const response = await fetch(url, { headers });
	if (!response.ok) throw new Error(`${url}: ${response.status} ${await response.text()}`);
	const pulls = await response.json();
	if (pulls.length == 0) break;

	for (const pull of pulls) {
		if (!pull.merged_at) continue;
		merged.push({ number: pull.number, title: pull.title, mergedAt: pull.merged_at.slice(0, 10), url: pull.html_url });
	}
}

merged.sort((a, b) => b.number - a.number);
fs.writeFileSync(outPath, JSON.stringify(merged, null, '\t') + '\n');
console.log(`${merged.length} merged pull requests written to ${outPath}`);

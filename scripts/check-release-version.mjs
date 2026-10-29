import fs from 'node:fs';

// Input is the paginated /releases response, collected with gh --slurp.
const releases = JSON.parse(fs.readFileSync(0, 'utf8')).flat();
const parse = (tag) => {
	const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(tag ?? '');
	return match ? match.slice(1).map(BigInt) : null;
};
const compare = (a, b) => {
	for (let i = 0; i < 3; i++) {
		if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
	}
	return 0;
};
const candidate = parse(process.argv[2]);
if (!candidate) throw new Error('Expected vX.Y.Z or X.Y.Z');
for (const release of releases) {
	if (release.draft || release.prerelease) continue;
	const published = parse(release.tag_name);
	if (published && compare(candidate, published) <= 0) {
		throw new Error(`Version must exceed published release ${release.tag_name}`);
	}
}

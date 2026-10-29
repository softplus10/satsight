import fs from 'node:fs';

const tag = process.argv[2];
const match = /^(?:v)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(tag ?? '');
if (!match) throw new Error('Expected vX.Y.Z or X.Y.Z without prerelease suffix');
const version = match.slice(1).join('.');
// Fixed-width components preserve Android update ordering, independent of tag spelling.
const [major, minor, patch] = match.slice(1).map(Number);
if (major > 2099 || minor > 999 || patch > 999) {
	throw new Error('Android version requires major <= 2099, minor/patch <= 999');
}
const code = major * 1000000 + minor * 1000 + patch;
if (code === 0) throw new Error('Android versionCode must be positive');
// Keep the version displayed by the web frontend aligned with native packages.
for (const path of ['package.json', 'package-lock.json']) {
	const data = JSON.parse(fs.readFileSync(path, 'utf8'));
	data.version = version;
	if (data.packages?.['']) data.packages[''].version = version;
	fs.writeFileSync(path, JSON.stringify(data, null, '\t') + '\n');
}
const configPath = 'src-tauri/tauri.conf.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
config.version = version;
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
if (process.env.GITHUB_OUTPUT) {
	fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\ncode=${code}\n`);
}

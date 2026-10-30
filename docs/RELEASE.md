# CI and releases

## Workflow stages

1. Pull requests and pushes to `main`: install dependencies, run Svelte/TypeScript checks, lint, and Vitest.
2. Release tags: validate the version and commit ancestry, then run the shared checks.
3. Build the versioned web frontend once and share it with native jobs.
4. Build Windows/Linux amd64 binaries, FreeBSD/OpenBSD amd64 binaries in VMs, and signed Android APK/AAB artifacts.
5. Verify every artifact, generate `SHA256SUMS`, and publish one GitHub Release.

Pull request CI does not build the web frontend or native packages. Native builds run on release tags.

## Release tags

The release validator currently requires the tagged commit to be included in `master`, while ordinary push CI targets `main`. Align the release ancestry rule with the repository's intended release branch before publishing from a different branch.

Push a tag in the form `vX.Y.Z` or `X.Y.Z` to trigger a release. A branch push alone does not create one. Tags must contain three integers without leading zeros, prerelease identifiers, or build metadata. The alternate spelling of an existing version is rejected: `v0.1.1` and `0.1.1` cannot both represent releases.

All native versions and the displayed app version come from the tag. Android `versionCode` is `major * 1000000 + minor * 1000 + patch`. The major component must be at most 2099; minor and patch must be at most 999. Version `0.0.0` is not allowed.

A release must be newer than existing published stable releases. This is checked before building and again before publishing. Drafts and prereleases are excluded from the comparison. GitHub's `make_latest=legacy` policy determines the latest release if concurrent jobs finish out of order.

## Android signing

Configure these repository secrets under Settings → Secrets and variables → Actions:

| Secret                      | Value                           |
| --------------------------- | ------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | Base64-encoded release JKS file |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password               |
| `ANDROID_KEY_ALIAS`         | Signing key alias               |
| `ANDROID_KEY_PASSWORD`      | Signing key password            |

Reuse and back up the same signing key. Missing signing secrets fail the release; the workflow does not substitute a debug key. Pull request CI does not require these secrets. Both APK and AAB files are generated, but the workflow does not upload to Google Play.

## Artifacts

- `satsight-X.Y.Z-windows-amd64.zip`: executable; requires WebView2 Runtime.
- `satsight-X.Y.Z-linux-amd64.tar.gz`: executable built on Ubuntu 24.04.
- `satsight-X.Y.Z-freebsd-amd64.tar.gz`: executable built in a FreeBSD 14.3 VM.
- `satsight-X.Y.Z-openbsd-amd64.tar.gz`: executable built in an OpenBSD 8.0 VM.
- `satsight-X.Y.Z-android.apk`: signed installable APK.
- `satsight-X.Y.Z-android.aab`: signed Android app bundle.
- `SHA256SUMS`: SHA-256 checksums for all release files.

Unix archives do not bundle system libraries. Linux requires GTK3, WebKitGTK 4.1, and appindicator runtimes. BSD builds require compatible GTK3/WebKitGTK 4.1 and linked system libraries. BSD archives also include `linked-libraries.txt`.

BSD builds use `cargo build` with `tauri/custom-protocol`, passing the Linux-built static frontend into the VM. They do not use the npm Tauri CLI or installer bundler. Validate BSD support against actual VM CI results. Compilation alone does not verify the GUI, camera, or external browser behavior.

A failure on any required platform prevents a public release. An interrupted upload leaves a draft that can be retried. Published releases are not overwritten. Publishing uses the default `GITHUB_TOKEN` with `contents: write`; no separate personal access token is required.

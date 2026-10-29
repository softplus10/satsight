#!/bin/sh
set -eu

platform=$(uname -s | tr '[:upper:]' '[:lower:]')
case "$platform" in
	freebsd|openbsd) ;;
	*) echo "Expected FreeBSD or OpenBSD" >&2; exit 1 ;;
esac
export PATH="/usr/local/bin:/usr/local/sbin:$PATH"
export PKG_CONFIG_PATH="/usr/local/lib/pkgconfig:/usr/local/share/pkgconfig:${PKG_CONFIG_PATH:-}"
export CARGO_BUILD_JOBS=2
export CARGO_TARGET_DIR="$PWD/bsd-target"
# The frontend is built on Linux and copied into the VM. BSD has no npm Tauri CLI.
# custom-protocol embeds the production frontend instead of using devUrl.
cargo build --release --locked --manifest-path src-tauri/Cargo.toml --features tauri/custom-protocol
mkdir -p dist bsd-package
cp bsd-target/release/satsight LICENSE docs/RELEASE.md bsd-package/
ldd bsd-target/release/satsight > bsd-package/linked-libraries.txt
tar -czf "dist/satsight-${VERSION:-snapshot}-$platform-amd64.tar.gz" -C bsd-package .
# Avoid copying compiled dependencies back to the runner.
rm -rf bsd-target

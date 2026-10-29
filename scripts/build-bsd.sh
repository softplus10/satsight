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
CARGO_TARGET_DIR=$(mktemp -d /tmp/satsight-target.XXXXXXXX)
export CARGO_TARGET_DIR
trap 'rm -rf "$CARGO_TARGET_DIR"' EXIT
trap 'exit 1' HUP INT TERM
# The frontend is built on Linux and copied into the VM. BSD has no npm Tauri CLI.
# custom-protocol embeds the production frontend instead of using devUrl.
cargo build --release --locked --manifest-path src-tauri/Cargo.toml --features tauri/custom-protocol
mkdir -p dist bsd-package
cp "$CARGO_TARGET_DIR/release/satsight" LICENSE bsd-package/
ldd "$CARGO_TARGET_DIR/release/satsight" > bsd-package/linked-libraries.txt
tar -czf "dist/satsight-${VERSION:-snapshot}-$platform-amd64.tar.gz" -C bsd-package .

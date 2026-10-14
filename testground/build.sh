#!/usr/bin/env bash
# Builds the Forever Sim program for Windows and Linux into release/:
#   ForeverSim-windows.zip, ForeverSim-linux.tar.gz   what you send people
#   ForeverSim-windows-amd64.exe, ForeverSim-linux-amd64, SHA256SUMS   what the update button downloads
#
#   testground/build.sh 1.2.0        (after `make`, from anywhere in the repository)
set -euo pipefail
version="${1:?usage: testground/build.sh <version, e.g. 1.2.0>}"
version="${version#v}"
repo="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo"

test -f dist/forever/index.html || { echo "dist/forever is missing: run make first" >&2; exit 1; }

python3 testground/tools/gen_specs.py
emb=testground/server/embedded
rm -rf "$emb/sim" "$emb/web" "$emb/listfile.csv"
cp -r dist/forever "$emb/sim"
cp -r testground/web "$emb/web"

# The file list, trimmed to what the program looks up: client tables and weapon sounds.
listfile=tools/db2tool/listfile.csv
if [ ! -f "$listfile" ]; then
	echo "Downloading the community file list..."
	curl -fL -o "$listfile" https://github.com/wowdev/wow-listfile/releases/latest/download/community-listfile.csv
fi
grep -aE '^[0-9]+;(dbfilesclient/|sound/item/weapons/)' "$listfile" > "$emb/listfile.csv"

out="$repo/release"
rm -rf "$out"
mkdir -p "$out"
cd testground/server
for target in windows/amd64 linux/amd64; do
	goos="${target%/*}"
	goarch="${target#*/}"
	ext=""
	[ "$goos" = windows ] && ext=".exe"
	echo "Building $goos/$goarch..."
	CGO_ENABLED=0 GOOS="$goos" GOARCH="$goarch" go build -tags=with_db -trimpath \
		-ldflags "-s -w -X main.version=$version" -o "$out/ForeverSim-$goos-$goarch$ext" .
done
cd "$out"

stage="$(mktemp -d)"
mkdir -p "$stage/windows/ForeverSim" "$stage/linux/ForeverSim"
cp ForeverSim-windows-amd64.exe "$stage/windows/ForeverSim/ForeverSim.exe"
cp ForeverSim-linux-amd64 "$stage/linux/ForeverSim/ForeverSim"
chmod +x "$stage/linux/ForeverSim/ForeverSim"
sed "s/{{VERSION}}/$version/g" "$repo/testground/README-release.txt" > "$stage/windows/ForeverSim/README.txt"
cp "$stage/windows/ForeverSim/README.txt" "$stage/linux/ForeverSim/README.txt"
(cd "$stage/windows" && zip -qr "$out/ForeverSim-windows.zip" ForeverSim)
(cd "$stage/linux" && tar -czf "$out/ForeverSim-linux.tar.gz" ForeverSim)
rm -rf "$stage"

sha256sum ForeverSim-windows-amd64.exe ForeverSim-linux-amd64 > SHA256SUMS
rm -rf "$repo/$emb/sim" "$repo/$emb/web" "$repo/$emb/listfile.csv"
echo "Forever Sim $version:"
ls -la "$out"

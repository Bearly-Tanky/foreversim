#!/usr/bin/env bash
# Moves a built dist/forever from /forever/ to $SITE_BASE (e.g. /Forever/next/ on a fork's Pages site).
# Build with SITE_BASE set too: vite's base covers what it generates, this covers the '/forever/' the UI
# hard-codes (icons, css urls, worker and wasm paths). Hosts such as wowhead.com/forever/ are left alone.
# ponytail: text rewrite of the bundle; move the UI onto import.meta.env.BASE_URL if it ever grows a case this misses.
set -euo pipefail
: "${SITE_BASE:?set SITE_BASE, e.g. /Forever/next/}"
dir=${1:-dist/forever}
find "$dir" -type f \( -name '*.js' -o -name '*.html' -o -name '*.css' \) -print0 |
	xargs -0 sed -i -E "s#(^|[^A-Za-z0-9_.])/forever/#\1${SITE_BASE}#g"

#!/usr/bin/env bash
# Runs Forever Sim from the checkout (http://127.0.0.1:8090/): the sim from dist/ (run `make`
# first) and the page from web/, so edits show on reload.
set -euo pipefail
cd "$(dirname "$0")/server"
exec go run -tags=with_db . -dev "$@"

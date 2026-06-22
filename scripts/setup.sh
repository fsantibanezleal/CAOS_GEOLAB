#!/usr/bin/env bash
# GeoLab setup (POSIX). Uses pnpm via corepack — no global installs.
set -euo pipefail
corepack enable
corepack prepare pnpm@10.7.1 --activate
pnpm install
echo "GeoLab ready. Run scripts/dev.sh (or 'pnpm dev')."

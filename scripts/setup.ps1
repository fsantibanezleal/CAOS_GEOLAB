# GeoLab setup (Windows / PowerShell). Uses pnpm via corepack — no global installs.
$ErrorActionPreference = 'Stop'
corepack enable
corepack prepare pnpm@10.7.1 --activate
pnpm install
Write-Host "GeoLab ready. Run scripts/dev.ps1 (or 'pnpm dev')." -ForegroundColor Green

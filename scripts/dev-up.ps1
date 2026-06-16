# Heydo — start the Phase 1 stack locally (backend + admin) and seed demo data.
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1
# Stop:   scripts\dev-down.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Write-Host "Heydo dev stack starting from $root" -ForegroundColor Green

# 1. Backend (NestJS) on :3000 — build if needed, then run from dist.
if (-not (Test-Path "$root\apps\backend\dist\main.js")) {
  Write-Host "Building backend..." -ForegroundColor Cyan
  & "$root\apps\backend\node_modules\.bin\tsc.cmd" -p "$root\apps\backend\tsconfig.build.json"
}
Write-Host "Starting backend on http://localhost:3000 ..." -ForegroundColor Cyan
$env:NODE_ENV = 'development'; $env:PORT = '3000' # child process inherits these
$be = Start-Process node -ArgumentList "$root\apps\backend\dist\main.js" `
  -PassThru -WindowStyle Hidden

# 2. Admin (Next.js) on :3001 — must run from its own directory.
Write-Host "Starting admin on http://localhost:3001 ..." -ForegroundColor Cyan
$admin = Start-Process -FilePath "$root\apps\admin-web\node_modules\.bin\next.cmd" `
  -ArgumentList "start", "-p", "3001" -WorkingDirectory "$root\apps\admin-web" `
  -PassThru -WindowStyle Hidden

# 3. Wait for backend, then seed demo data.
Write-Host "Waiting for backend..." -ForegroundColor Cyan
for ($i = 0; $i -lt 20; $i++) {
  try { Invoke-RestMethod "http://localhost:3000/health" -TimeoutSec 2 | Out-Null; break }
  catch { Start-Sleep -Milliseconds 800 }
}
node "$root\scripts\seed-demo.mjs"

"$($be.Id)`n$($admin.Id)" | Out-File "$root\.dev-pids" -Encoding ascii
Write-Host "`nStack is up:" -ForegroundColor Green
Write-Host "  Admin panel : http://localhost:3001  (sign in: any name + secret 'dev-admin-secret')"
Write-Host "  Backend API : http://localhost:3000/health"
Write-Host "  Stop with   : scripts\dev-down.ps1"

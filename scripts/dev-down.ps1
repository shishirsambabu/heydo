# Heydo — stop the local dev stack started by dev-up.ps1.
$root = Split-Path $PSScriptRoot -Parent
if (Test-Path "$root\.dev-pids") {
  Get-Content "$root\.dev-pids" | ForEach-Object {
    if ($_ -match '^\d+$') {
      try { Stop-Process -Id ([int]$_) -Force; Write-Host "stopped pid $_" } catch {}
    }
  }
  Remove-Item "$root\.dev-pids" -ErrorAction SilentlyContinue
} else {
  Write-Host "No .dev-pids file; stopping any node on :3000/:3001"
  Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}
Write-Host "Heydo dev stack stopped."

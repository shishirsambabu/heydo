param(
  [string]$InstallRoot = "$env:USERPROFILE\development",
  [switch]$UpdateUserPath
)

$ErrorActionPreference = "Stop"

function Require-Command($Name, $InstallHint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required. $InstallHint"
  }
}

Write-Host "Heydo mobile tooling setup (Windows)" -ForegroundColor Cyan
Write-Host "Install root: $InstallRoot"

Require-Command "git" "Install Git for Windows: winget install --id Git.Git -e"

if (-not (Test-Path -LiteralPath $InstallRoot)) {
  New-Item -ItemType Directory -Path $InstallRoot | Out-Null
}

$flutterDir = Join-Path $InstallRoot "flutter"
$flutterBin = Join-Path $flutterDir "bin"
$flutterExe = Join-Path $flutterBin "flutter.bat"

if ((Test-Path -LiteralPath $flutterDir) -and -not (Test-Path -LiteralPath (Join-Path $flutterDir ".git"))) {
  $backupDir = Join-Path $InstallRoot ("flutter-invalid-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
  Write-Host "Existing Flutter folder is not a Git clone. Moving it aside:" -ForegroundColor Yellow
  Write-Host "  $backupDir"
  Move-Item -LiteralPath $flutterDir -Destination $backupDir
}

if (-not (Test-Path -LiteralPath $flutterDir)) {
  Write-Host "Cloning Flutter stable..." -ForegroundColor Yellow
  git clone https://github.com/flutter/flutter.git -b stable $flutterDir
} else {
  Write-Host "Flutter directory exists. Updating stable channel..." -ForegroundColor Yellow
  git -C $flutterDir fetch origin stable
  git -C $flutterDir checkout stable
  git -C $flutterDir pull --ff-only
}

if ($UpdateUserPath) {
  $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
  if (-not ($currentPath -split ";" | Where-Object { $_ -eq $flutterBin })) {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$flutterBin", "User")
    Write-Host "Added Flutter to the user PATH. Open a new PowerShell window after this setup." -ForegroundColor Green
  }
}

Write-Host ""
Write-Host "Checking Flutter..." -ForegroundColor Cyan
& $flutterExe --version

Write-Host ""
Write-Host "Running flutter doctor. Android Studio/SDK items may still need manual acceptance." -ForegroundColor Cyan
& $flutterExe doctor

Write-Host ""
Write-Host "Next Heydo commands:" -ForegroundColor Green
Write-Host "  cd D:\heydo"
Write-Host "  npm run mobile:qa"
Write-Host ""
Write-Host "For a physical Android phone, run from apps/mobile with your PC LAN IP or tunnel URL:"
Write-Host '  flutter run --dart-define=HEYDO_API_BASE=http://YOUR_PC_LAN_IP:3000'

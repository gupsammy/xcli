# xcli installer for Windows — https://github.com/gupsammy/xcli
# Usage: irm https://raw.githubusercontent.com/gupsammy/xcli/main/install.ps1 | iex
#        $env:VERSION="0.9.2"; irm ... | iex

$ErrorActionPreference = "Stop"

$Repo = "gupsammy/xcli"
$BinaryName = "xcli"
$InstallDir = "$env:LOCALAPPDATA\xcli"

# ── Architecture detection ──────────────────────────────────────────
function Get-Arch {
    $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
    switch ($arch) {
        "X64"   { return "x86_64" }
        "Arm64" { return "arm64" }
        default { throw "Unsupported architecture: $arch. Supported: x86_64, arm64" }
    }
}

# ── Version resolution ──────────────────────────────────────────────
function Resolve-Version {
    if ($env:VERSION) {
        $v = $env:VERSION
        if (-not $v.StartsWith("v")) { $v = "v$v" }
        return $v
    }

    Write-Host "Fetching latest release..."
    $apiUrl = "https://api.github.com/repos/$Repo/releases/latest"
    try {
        $release = Invoke-RestMethod -Uri $apiUrl -Headers @{ "User-Agent" = "xcli-installer" }
        return $release.tag_name
    }
    catch {
        throw "Could not determine latest version from GitHub API.`nSet VERSION explicitly:`n  `$env:VERSION=`"x.y.z`"; irm ... | iex"
    }
}

# ── Main ────────────────────────────────────────────────────────────
try {
    $Arch = Get-Arch
    $VersionTag = Resolve-Version
    $Asset = "${BinaryName}-windows-${Arch}.exe"
    $DownloadUrl = "https://github.com/$Repo/releases/download/$VersionTag/$Asset"

    Write-Host "Downloading $BinaryName $VersionTag for windows/$Arch..."

    # Create install directory
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }

    $DestPath = Join-Path $InstallDir "$BinaryName.exe"
    $TempFile = [System.IO.Path]::GetTempFileName()

    try {
        Invoke-WebRequest -Uri $DownloadUrl -OutFile $TempFile -UseBasicParsing
    }
    catch {
        Remove-Item -Force $TempFile -ErrorAction SilentlyContinue

        Write-Host ""
        Write-Host "  Windows builds are not yet available for xcli." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  xcli currently ships macOS (arm64) binaries only."
        Write-Host "  Windows and Linux builds are coming soon."
        Write-Host ""
        Write-Host "  Track progress: https://github.com/$Repo/releases"
        Write-Host "  Build from source: https://github.com/$Repo#build-from-source"
        Write-Host ""
        return
    }

    Move-Item -Force $TempFile $DestPath

    # Add to PATH if not already present
    $UserPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    if ($UserPath -notlike "*$InstallDir*") {
        [Environment]::SetEnvironmentVariable("PATH", "$UserPath;$InstallDir", "User")
        $env:PATH = "$env:PATH;$InstallDir"
        Write-Host "  Added $InstallDir to your PATH."
    }

    Write-Host ""
    Write-Host "  $BinaryName $VersionTag installed to $DestPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Get started:"
    Write-Host "    $BinaryName --help          Show all commands"
    Write-Host "    $BinaryName auth            Set up authentication"
    Write-Host "    $BinaryName timeline        View your timeline"
    Write-Host ""
    Write-Host "  Docs: https://github.com/$Repo"
    Write-Host ""
}
catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

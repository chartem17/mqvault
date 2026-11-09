# Builds dist\MQVaultBridge.exe (single file, no console window). Needs: Python 3.13 venv with
# requirements.txt + nuitka + zstandard, and a C compiler (Nuitka downloads MinGW on first use).
param([string]$Python = "python")
# Native tools write progress to stderr; check exit codes instead of $ErrorActionPreference = "Stop".
Set-Location $PSScriptRoot
& $Python -I mqvault_bridge_check.py
if ($LASTEXITCODE -ne 0) { exit 1 }
& $Python -m nuitka --onefile --windows-console-mode=disable --assume-yes-for-downloads `
  --include-package=numpy --include-package=cryptography `
  --nofollow-import-to=numpy.tests --nofollow-import-to=numpy.f2py --nofollow-import-to=numpy.distutils --nofollow-import-to=numpy.testing `
  --windows-company-name=MQVault --windows-product-name="MQVault Bridge" --windows-file-description="MQVault Bridge" `
  --windows-product-version=0.1.0 --windows-file-version=0.1.0 `
  --output-dir=dist --output-filename=MQVaultBridge.exe launcher.py
exit $LASTEXITCODE

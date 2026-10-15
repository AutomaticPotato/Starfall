# Run from PowerShell on Windows. All installation work runs in your WSL2 Linux checkout.
[CmdletBinding()]
param(
    [string]$Distribution = 'Ubuntu',
    [string]$LinuxPath = '~/starlights/deploy',
    [switch]$Check,
    [switch]$SkipContent,
    [ValidateRange(1024, 65535)][int]$Port = 8093
)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') {
    throw 'Use ./setup.sh on Linux. This launcher is for Windows PowerShell or PowerShell on Windows.'
}
if (-not [Environment]::Is64BitOperatingSystem -or
    $env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') {
    throw 'Starlights requires an x86-64 Intel/AMD computer; Windows on ARM is unsupported.'
}
if ([Environment]::OSVersion.Version.Build -lt 19045) {
    throw 'Use Windows 11 or a compatible Windows 10 22H2 system. Check Docker Desktop current system requirements.'
}
if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    throw 'WSL is missing. Follow docs/installation.md to install WSL2 and Ubuntu, then enable Docker Desktop integration.'
}
if ($LinuxPath -notmatch '^(~/|/)' -or $LinuxPath -match '^/mnt/' -or
    $LinuxPath -match '[\x00-\x1f"`$\\]') {
    throw 'LinuxPath must be a WSL Linux path such as ~/starlights/deploy or /home/alice/My Games/starlights/deploy. Do not use C:\, UNC paths or /mnt/c.'
}
# Check the selected distribution, not just WSL's default version. Strip NULs from older wsl.exe output.
$kernel = (& wsl.exe --distribution $Distribution --exec uname -r 2>$null | Out-String) -replace "`0", ''
if ($LASTEXITCODE -ne 0) {
    throw "Cannot open WSL distribution '$Distribution'. Run wsl --list --verbose and pass its exact name with -Distribution."
}
if ($kernel -notmatch '(?i)microsoft.*wsl2') {
    throw "'$Distribution' is not WSL2. See wsl --list --verbose and the WSL conversion instructions in docs/installation.md."
}
# Pass the path as data, never interpolate it into shell code. Base64 avoids Windows PowerShell 5.1
# native-command quoting differences for paths containing spaces. Python accepts LF or CRLF source files.
$encodedPath = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($LinuxPath))
$bootstrap = 'import base64,os,runpy,sys; p=os.path.expanduser(base64.b64decode(sys.argv.pop(1)).decode()); os.chdir(p); runpy.run_path("installer.py",run_name="__main__")'
# Send Python code over stdin: Windows PowerShell 5.1 strips embedded quotes in native argv.
$setupArgs = @('--distribution', $Distribution, '--exec', 'python3', '-', $encodedPath)
if ($Check) { $setupArgs += '--check' }
if ($SkipContent) { $setupArgs += '--skip-content' }
if ($PSBoundParameters.ContainsKey('Port')) { $setupArgs += @('--port', "$Port") }
$bootstrap | & wsl.exe @setupArgs
$code = $LASTEXITCODE
if ($code -ne 0) {
    Write-Warning 'Setup did not finish. Check the error above, Docker Desktop WSL integration, Python 3 and LinuxPath. Keep .env and data/ and rerun. See docs/installation.md.'
}
exit $code

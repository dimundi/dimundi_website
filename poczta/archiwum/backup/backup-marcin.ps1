param(
    [Parameter(Mandatory=$true)][string]$Python,
    [string]$Destination = 'D:\Backup\Dimundi-poczta'
)
$ErrorActionPreference = 'Stop'
try {
    if (-not (Test-Path -LiteralPath $Python -PathType Leaf)) { throw 'Nie znaleziono interpretera Python.' }
    & $Python -B (Join-Path $PSScriptRoot 'backup-maildir.py') --account marcin --destination $Destination
    if ($LASTEXITCODE -ne 0) { throw 'Kopia nie zostala ukonczona. Sprawdz raport.' }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
} finally {
    Read-Host 'Enter zamyka skrypt'
}

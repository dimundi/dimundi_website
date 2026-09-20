param([string]$Backup = 'D:\Backup\Dimundi-poczta\Marcin-20260920-223745')
$ErrorActionPreference = 'Stop'
try {
    $config = Join-Path $PSScriptRoot '..\..\..\deploy.config'
    if (-not (Test-Path -LiteralPath $config)) { throw 'Utworz deploy.config wedlug deploy.config_tmp.' }
    $keyLine = Get-Content -LiteralPath $config | Where-Object { $_ -match '^SSH_KEY=' } | Select-Object -First 1
    if (-not $keyLine) { throw 'Brak SSH_KEY w deploy.config.' }
    $key = $keyLine.Substring(8).Trim()
    if (-not (Test-Path -LiteralPath $key -PathType Leaf)) { throw 'Brak pliku klucza SSH.' }
    $archive = Join-Path $Backup 'Maildir.tar.gz'
    $expected = '3d1c686f970f4307d06aec3c436f3f8447c9e283534f790cd42b2b55f5c5e36c'
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expected) { throw 'Niezgodna kopia Marcina.' }
    $target = 'docker@145.239.92.71'
    $remote = '/home/docker/dimundi/poczta/migration/marcin-20260920'
    if ((Read-Host 'Wyslac kopie Marcina i skrypty na nowy VPS? [t/n]') -ine 't') { return }
    $preflight = [IO.File]::ReadAllBytes((Join-Path $PSScriptRoot 'preflight-marcin.sh'))
    $encoded = [Convert]::ToBase64String($preflight)
    & ssh -T -o StrictHostKeyChecking=yes -i $key $target "echo $encoded | base64 -d | bash"
    if ($LASTEXITCODE -ne 0) { throw 'Kontrola VPS nie przeszla. Archiwum nie zostalo wyslane.' }
    & scp -o StrictHostKeyChecking=yes -i $key $archive (Join-Path $PSScriptRoot 'migrate-marcin.sh') (Join-Path $PSScriptRoot 'verify-maildir.py') "${target}:$remote/"
    if ($LASTEXITCODE -ne 0) { throw 'Blad wysylania.' }
    & ssh -t -o StrictHostKeyChecking=yes -i $key $target "cd $remote && bash migrate-marcin.sh"
    if ($LASTEXITCODE -ne 0) { throw 'Migracja nie zostala potwierdzona jako zakonczona. Sprawdz logi przed ponowieniem.' }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
} finally {
    Read-Host 'Enter zamyka okno'
}

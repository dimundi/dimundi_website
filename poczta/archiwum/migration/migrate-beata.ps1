param([string]$Backup = 'D:\Backup\Dimundi-poczta\Beata-20260920-222904')
$ErrorActionPreference = 'Stop'
try {
    $config = Join-Path $PSScriptRoot '..\..\..\deploy.config'
    if (-not (Test-Path -LiteralPath $config)) { throw 'Utworz deploy.config wedlug deploy.config_tmp.' }
    $keyLine = Get-Content -LiteralPath $config | Where-Object { $_ -match '^SSH_KEY=' } | Select-Object -First 1
    if (-not $keyLine) { throw 'Brak SSH_KEY w deploy.config.' }
    $key = $keyLine.Substring(8).Trim()
    if (-not (Test-Path -LiteralPath $key -PathType Leaf)) { throw 'Brak pliku klucza SSH.' }
    $archive = Join-Path $Backup 'Maildir.tar.gz'
    $expected = '5c0b8719262eff47e6174e03fb8bf50ff029f792856fb2bcaadd6b56491cfda2'
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expected) { throw 'Niezgodna kopia Beaty.' }
    $target = 'docker@145.239.92.71'
    $remote = '/home/docker/dimundi/poczta/migration/beata-20260920'
    if ((Read-Host 'Wyslac kopie Beaty i skrypty na nowy VPS? [t/n]') -ine 't') { return }
    & ssh -T -o StrictHostKeyChecking=yes -i $key $target "umask 077; mkdir -p $remote"
    if ($LASTEXITCODE -ne 0) { throw 'Nie przygotowano katalogu.' }
    & scp -o StrictHostKeyChecking=yes -i $key $archive (Join-Path $PSScriptRoot 'migrate-beata.sh') (Join-Path $PSScriptRoot 'verify-maildir.py') "${target}:$remote/"
    if ($LASTEXITCODE -ne 0) { throw 'Blad wysylania.' }
    & ssh -t -o StrictHostKeyChecking=yes -i $key $target "cd $remote && bash migrate-beata.sh"
    if ($LASTEXITCODE -ne 0) { throw 'Migracja nie zostala potwierdzona jako zakonczona. Sprawdz logi przed ponowieniem.' }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
} finally {
    Read-Host 'Enter zamyka okno'
}

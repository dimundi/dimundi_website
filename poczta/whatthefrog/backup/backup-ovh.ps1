param([string]$Destination = 'D:\Backup\WhatTheFrog-poczta')
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$sshKey = ((Select-String -LiteralPath (Join-Path $repoRoot 'deploy.config') -Pattern '^SSH_KEY=').Line -replace '^SSH_KEY=', '').Trim()
if (-not (Test-Path -LiteralPath $sshKey -PathType Leaf)) { throw 'Nie znaleziono klucza SSH.' }
$backupRoot = Join-Path $Destination ('OVH-biuro-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backupRoot -ErrorAction Stop | Out-Null
$partial = Join-Path $backupRoot 'IMAP.tar.gz.part'
$logPath = Join-Path $backupRoot 'transfer.log'
$source = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'stream-ovh-imap.py')).Replace("`r`n", "`n")
$start = New-Object System.Diagnostics.ProcessStartInfo
$start.FileName = (Get-Command ssh.exe).Source
$start.Arguments = '-T -i "' + $sshKey + '" -o BatchMode=yes -o StrictHostKeyChecking=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=3 docker@145.239.92.71 python3 -'
$start.UseShellExecute = $false
$start.CreateNoWindow = $true
$start.RedirectStandardInput = $true
$start.RedirectStandardOutput = $true
$start.RedirectStandardError = $true
$process = New-Object System.Diagnostics.Process
$process.StartInfo = $start
$file = $null
try {
    Write-Output "Kopia bez kosza: $backupRoot"
    $file = [IO.File]::Open($partial, [IO.FileMode]::CreateNew)
    if (-not $process.Start()) { throw 'Nie uruchomiono SSH.' }
    $errors = $process.StandardError.ReadToEndAsync()
    $sourceBytes = [Text.Encoding]::UTF8.GetBytes($source + "`n")
    $process.StandardInput.BaseStream.Write($sourceBytes, 0, $sourceBytes.Length)
    $process.StandardInput.Close()
    $copy = $process.StandardOutput.BaseStream.CopyToAsync($file)
    while (-not $copy.Wait(15000)) {
        Write-Output ('Pobrano {0:N1} MiB' -f ($file.Length / 1MB))
    }
    $copy.GetAwaiter().GetResult() | Out-Null
    $file.Dispose()
    $file = $null
    $process.WaitForExit()
    $log = $errors.GetAwaiter().GetResult()
    [IO.File]::WriteAllText($logPath, $log)
    if ($process.ExitCode -ne 0) { throw "Blad SSH/IMAP. Zobacz $logPath" }
    $reportText = & tar.exe -xOf $partial report.json
    if ($LASTEXITCODE -ne 0) { throw 'Nie mozna odczytac raportu archiwum.' }
    $report = ($reportText -join "`n") | ConvertFrom-Json
    if ($report.status -ne 'complete') { throw 'Niekompletny raport IMAP.' }
    $entries = @(& tar.exe -tzf $partial)
    if ($LASTEXITCODE -ne 0) { throw 'Blad integralnosci TAR/gzip.' }
    $messages = @($entries | Where-Object { $_ -match '^messages/f[0-9]+/[0-9]+\.eml$' }).Count
    if ($messages -ne $report.messages) { throw 'Liczba wiadomosci nie zgadza sie z raportem.' }
    $digest = (Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash.ToLowerInvariant()
    $final = Join-Path $backupRoot 'IMAP.tar.gz'
    Move-Item -LiteralPath $partial -Destination $final
    [IO.File]::WriteAllText((Join-Path $backupRoot 'report.json'), ($reportText -join "`n"))
    [IO.File]::WriteAllText((Join-Path $backupRoot 'SHA256SUMS.txt'), "$digest  IMAP.tar.gz`n")
    Write-Output "GOTOWE: $messages wiadomosci; $final"
} finally {
    if ($null -ne $file) { $file.Dispose() }
    if ($process.Id -and -not $process.HasExited) { $process.Kill(); $process.WaitForExit() }
    $process.Dispose()
}

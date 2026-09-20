@echo off
setlocal DisableDelayedExpansion
cd /d "%~dp0"
set "TARGET=docker@145.239.92.71"
set "REMOTE_DIR=/home/docker/dimundi/poczta/deploy"
set "CONFIG_FILE=%~dp0..\..\deploy.config"
set "SSH_KEY="
if not exist "%CONFIG_FILE%" (
    echo Brak deploy.config. Skopiuj deploy.config_tmp jako deploy.config w glownym katalogu projektu i ustaw SSH_KEY.
    exit /b 1
)
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%CONFIG_FILE%") do (
    if /i "%%A"=="SSH_KEY" set "SSH_KEY=%%B"
)
if not defined SSH_KEY (
    echo Uzupelnij SSH_KEY w deploy.config.
    exit /b 1
)
if not exist "%SSH_KEY%" (
    echo Brak klucza: "%SSH_KEY%". Popraw deploy.config.
    exit /b 1
)

echo Cel: %TARGET%:%REMOTE_DIR%
set "ANSWER="
set /p "ANSWER=Wyslac konfiguracje i skrypty poczty? [t/n]: "
if /i not "%ANSWER%"=="t" exit /b 0
ssh -i "%SSH_KEY%" "%TARGET%" "mkdir -p %REMOTE_DIR%"
if errorlevel 1 goto error
scp -i "%SSH_KEY%" compose.yml mailserver.env roundcube.php common.sh build.sh accounts.sh setup-tls.sh nginx-http.conf nginx-https.conf dkim.sh dkim-signing.conf fail2ban-jail.cf ignore-roundcube.sh update-webmail.sh "%TARGET%:%REMOTE_DIR%/"
if errorlevel 1 goto error
echo Pliki wyslane. Kontenery nie zostaly uruchomione.
echo Instrukcja: dimundiWwwDocs/email.md. Najpierw zaktualizuj proxy.
exit /b 0

:error
echo BLAD wysylania. Przerwano operacje.
exit /b 1

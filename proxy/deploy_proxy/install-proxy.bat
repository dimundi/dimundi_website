@echo off
setlocal DisableDelayedExpansion
cd /d "%~dp0"
set "TARGET=docker@145.239.92.71"
set "REMOTE_DIR=/home/docker/dimundi/proxy"
set "CONFIG_FILE=%~dp0..\..\deploy.config"
set "SSH_KEY="

if not exist "%CONFIG_FILE%" (
    echo Brak deploy.config w glownym katalogu projektu.
    echo Skopiuj deploy.config_tmp jako deploy.config i ustaw w nim SSH_KEY.
    exit /b 1
)
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%CONFIG_FILE%") do (
    if /i "%%A"=="SSH_KEY" set "SSH_KEY=%%B"
)
if not defined SSH_KEY (
    echo Brak SSH_KEY w deploy.config. Uzupelnij sciezke do klucza.
    exit /b 1
)

if not exist "%SSH_KEY%" (
    echo Brak klucza: "%SSH_KEY%". Popraw SSH_KEY w deploy.config.
    exit /b 1
)

echo Cel: %TARGET%:%REMOTE_DIR%
set "ANSWER="
set /p "ANSWER=Wyslac nginx.conf na serwer? [t/n]: "
if /i not "%ANSWER%"=="t" exit /b 0

ssh -i "%SSH_KEY%" "%TARGET%" "mkdir -p %REMOTE_DIR%/mail-conf"
if errorlevel 1 goto error
scp -i "%SSH_KEY%" nginx.conf "%TARGET%:%REMOTE_DIR%/nginx.conf.upload"
if errorlevel 1 goto error
scp -i "%SSH_KEY%" nginx-https.conf "%TARGET%:%REMOTE_DIR%/nginx-https.conf.upload"
if errorlevel 1 goto error
rem Preserve the inode so the running container sees the updated bind-mounted file.
ssh -i "%SSH_KEY%" "%TARGET%" "set -e; cd %REMOTE_DIR%; if [ -f nginx.conf ]; then cp -p nginx.conf nginx.conf.bak; fi; mv nginx-https.conf.upload nginx-https.conf; if [ -f https.enabled ]; then cat nginx-https.conf > nginx.conf; else cat nginx.conf.upload > nginx.conf; fi; rm nginx.conf.upload"
if errorlevel 1 goto error
echo Konfiguracja wyslana. Poprzednia wersja, jesli istniala: nginx.conf.bak.

set "ANSWER="
set /p "ANSWER=Wyslac tez Dockerfile, Compose i skrypty budowania oraz HTTPS? [t/n]: "
if /i not "%ANSWER%"=="t" goto reload
scp -i "%SSH_KEY%" Dockerfile compose.yml build-proxy.sh setup-https.sh renew-cert.sh install-renewal.sh "%TARGET%:%REMOTE_DIR%/"
if errorlevel 1 goto error

:reload
set "ANSWER="
set /p "ANSWER=Sprawdzic i przeladowac konfiguracje dzialajacego proxy? [t/n]: "
if /i not "%ANSWER%"=="t" goto done
ssh -i "%SSH_KEY%" "%TARGET%" "set -e; cd %REMOTE_DIR%; if [ ! -f compose.yml ]; then echo 'Brak compose.yml. Wyslij pliki wdrozenia i uruchom bash build-proxy.sh.'; exit 1; fi; docker compose -f compose.yml exec -T proxy nginx -t && docker compose -f compose.yml exec -T proxy nginx -s reload"
if errorlevel 1 goto error

:done
echo Gotowe. Pierwsze uruchomienie lub przebudowa na VPS:
echo cd %REMOTE_DIR% ^&^& bash build-proxy.sh
exit /b 0

:error
echo BLAD. Przerwano operacje. Jesli proxy jeszcze nie dziala, uruchom na VPS bash build-proxy.sh.
echo Nieudany nginx -t blokuje przeladowanie. Poprzednia konfiguracja jest w nginx.conf.bak, jesli istniala.
exit /b 1

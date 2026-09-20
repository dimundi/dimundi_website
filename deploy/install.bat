@echo off
setlocal DisableDelayedExpansion
cd /d "%~dp0"
set "TARGET=docker@145.239.92.71"
set "REMOTE_DIR=/home/docker/dimundi/app"
set "CONFIG_FILE=%~dp0..\deploy.config"
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
set /p "ANSWER=Wyslac pliki strony, backendu i wdrozenia? [t/n]: "
if /i not "%ANSWER%"=="t" exit /b 0
ssh -i "%SSH_KEY%" "%TARGET%" "mkdir -p %REMOTE_DIR%/frontend %REMOTE_DIR%/backend %REMOTE_DIR%/deploy"
if errorlevel 1 goto error
scp -i "%SSH_KEY%" -r ..\frontend "%TARGET%:%REMOTE_DIR%/"
if errorlevel 1 goto error
rem Explicit file list: do not send node_modules or secrets with the sources.
scp -i "%SSH_KEY%" ..\backend\Dockerfile ..\backend\.dockerignore ..\backend\package.json ..\backend\package-lock.json ..\backend\server.js ..\backend\.env_tmpl "%TARGET%:%REMOTE_DIR%/backend/"
if errorlevel 1 goto error
scp -i "%SSH_KEY%" compose.yml Dockerfile-frontend nginx.conf build.sh "%TARGET%:%REMOTE_DIR%/deploy/"
if errorlevel 1 goto error

set "ANSWER="
set /p "ANSWER=Wyslac lokalny backend/.env z danymi poczty (nadpisuje konfiguracje na VPS)? [t/n]: "
if /i not "%ANSWER%"=="t" goto done
if not exist "..\backend\.env" (
    echo Brak backend/.env. Utworz go z backend/.env_tmpl i uzupelnij dane.
    exit /b 1
)
ssh -i "%SSH_KEY%" "%TARGET%" "umask 077; touch %REMOTE_DIR%/backend/.env; chmod 600 %REMOTE_DIR%/backend/.env"
if errorlevel 1 goto error
scp -i "%SSH_KEY%" ..\backend\.env "%TARGET%:%REMOTE_DIR%/backend/.env"
if errorlevel 1 goto error

:done
echo Pliki wyslane. Na VPS uruchom:
echo cd %REMOTE_DIR%/deploy ^&^& bash build.sh
exit /b 0

:error
echo BLAD wysylania. Przerwano; kontenery nie zostaly przebudowane ani uruchomione.
exit /b 1

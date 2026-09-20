@echo off
setlocal
pushd "%~dp0" || exit /b 1

if not exist "backend\.env" (
    copy /y ".env.example" "backend\.env" >nul
    if errorlevel 1 (
        popd
        exit /b 1
    )
    echo Utworzono backend\.env. Uzupelnij dane poczty w tym pliku.
)

docker compose -f docker-compose-test.yml up -d
set "result=%errorlevel%"
if "%result%"=="0" (
    echo Strona jest dostepna pod adresem http://localhost:8080
) else (
    echo Uruchomienie nie powiodlo sie. Sprawdz, czy Docker Desktop jest uruchomiony.
)

popd
exit /b %result%

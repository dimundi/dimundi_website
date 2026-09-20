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

docker compose -f docker-compose-test.yml build
set "result=%errorlevel%"
if "%result%"=="0" (
    echo Obrazy zbudowane. Uruchom start-test.bat, aby wlaczyc kontenery.
) else (
    echo Budowanie nie powiodlo sie. Sprawdz komunikaty Dockera powyzej.
)

popd
exit /b %result%

# Ustalenia projektu

Ten plik zawiera uzgodnienia dotyczące pracy nad projektem. Uzupełniamy go w miarę podejmowania kolejnych decyzji.

## Aplikacja

- Frontend to statyczne pliki HTML, CSS i JavaScript serwowane przez Nginx.
- Wspólne fragmenty HTML znajdują się w `frontend/partials/` i są dołączane przez Nginx SSI.
- Backend Node.js obsługuje dane kontaktowe i formularz kontaktowy.
- `start-test.bat` i `build-test.bat` służą do lokalnego uruchamiania i budowania kontenerów przez `docker-compose-test.yml`, z użyciem plików `Dockerfile-test` w katalogach `proxy`, `frontend` i `backend`.

## Produkcja

- Przed pracami dotyczącymi wdrożenia, infrastruktury lub konfiguracji produkcyjnej przeczytaj [docs/deploy.md](docs/deploy.md) i stosuj zapisane tam ustalenia.
- Nowe uzgodnienia i uwagi dotyczące deploya zapisuj w `docs/deploy.md`.

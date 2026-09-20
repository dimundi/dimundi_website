# Ustalenia projektu

Ten plik zawiera uzgodnienia dotyczące pracy nad projektem. Uzupełniamy go w miarę podejmowania kolejnych decyzji.

## Aplikacja

- Frontend to statyczne pliki HTML, CSS i JavaScript serwowane przez Nginx.
- Wspólne fragmenty HTML znajdują się w `frontend/partials/` i są dołączane przez Nginx SSI.
- Backend Node.js obsługuje dane kontaktowe i formularz kontaktowy.
- `start-test.bat` i `build-test.bat` służą do lokalnego uruchamiania i budowania kontenerów przez `docker-compose-test.yml`, z użyciem plików `Dockerfile-test` w katalogach `proxy`, `frontend` i `backend`.

## Produkcja

- Przed pracami dotyczącymi wdrożenia, infrastruktury lub konfiguracji produkcyjnej przeczytaj [dimundiWwwDocs/deploy.md](dimundiWwwDocs/deploy.md) i stosuj zapisane tam ustalenia.
- Nowe uzgodnienia i uwagi dotyczące deploya zapisuj w `dimundiWwwDocs/deploy.md`.
- Dokumentacja jest vaultem Obsidiana w `dimundiWwwDocs/`; katalogi `.obsidian/` wykluczamy z Gita.
- Dokumentację poczty uzupełniaj na bieżąco podczas wdrażania w [dimundiWwwDocs/email.md](dimundiWwwDocs/email.md). Pisz bardzo skrótowo: moduły, konfiguracja i stan wdrożenia, bez rozbudowanych opisów i sekretów.

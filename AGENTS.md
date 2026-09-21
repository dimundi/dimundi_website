# Ustalenia projektu

Ten plik zawiera uzgodnienia dotyczące pracy nad projektem. Uzupełniamy go w miarę podejmowania kolejnych decyzji.

## Aplikacja

- Frontend to statyczne pliki HTML, CSS i JavaScript serwowane przez Nginx.
- Wspólne fragmenty HTML znajdują się w `frontend/partials/` i są dołączane przez Nginx SSI.
- Backend Node.js obsługuje dane kontaktowe i formularz kontaktowy.
- `start-test.bat` i `build-test.bat` służą do lokalnego uruchamiania i budowania kontenerów przez `docker-compose-test.yml`, z użyciem plików `Dockerfile-test` w katalogach `proxy`, `frontend` i `backend`.

## Produkcja

- Poczta: repo `poczta/dimundi/deploy/` wdrażamy do `/home/docker/dimundi/poczta/deploy`; `poczta/whatthefrog/deploy/` do `/home/docker/dimundi/whatthefrog/deploy`. Osobne projekty Compose, dane i sekrety. Dokumentacja WhatTheFrog: `dimundiWwwDocs/instalacja/whatthefrog/email.md`.

- Przed pracami dotyczącymi wdrożenia, infrastruktury lub konfiguracji produkcyjnej przeczytaj [dimundiWwwDocs/instalacja/wspolne/deploy.md](dimundiWwwDocs/instalacja/wspolne/deploy.md) i stosuj zapisane tam ustalenia.
- Nowe uzgodnienia i uwagi dotyczące deploya zapisuj w `dimundiWwwDocs/instalacja/wspolne/deploy.md`.
- Dokumentacja jest vaultem Obsidiana w `dimundiWwwDocs/`; katalogi `.obsidian/` wykluczamy z Gita.
- Dokumentację poczty uzupełniaj na bieżąco podczas wdrażania w [dimundiWwwDocs/instalacja/dimundi/email.md](dimundiWwwDocs/instalacja/dimundi/email.md). Pisz bardzo skrótowo: moduły, konfiguracja i stan wdrożenia, bez rozbudowanych opisów i sekretów.
- Kolejność instalacji poczty od zera zapisuj w [dimundiWwwDocs/instalacja/wspolne/email-instalacja.md](dimundiWwwDocs/instalacja/wspolne/email-instalacja.md); utrzymuj ją zgodną ze skryptami i odróżniaj wykonane etapy od planowanej migracji.
- Przy drobnych zmianach administracyjnych popraw konfigurację i dokumentację w repo, a użytkownikowi podaj polecenia do ręcznego wykonania. Nie twórz nowych skryptów wdrożeniowych do każdej takiej zmiany.

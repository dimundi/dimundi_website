# Poczta

| Repo | Cel na VPS | Projekt Compose |
| --- | --- | --- |
| `dimundi/deploy/` | `/home/docker/dimundi/poczta/deploy` | `dimundi-mail` |
| `whatthefrog/deploy/` | `/home/docker/dimundi/whatthefrog/deploy` | `whatthefrog-mail` |

Każde środowisko ma własne `data/` i `secrets/` obok `deploy/` na VPS. Nie trafiają do Gita. Instalatory `install.bat` korzystają z `deploy.config` w głównym katalogu repo.

Wspólne proxy i odnowienia certyfikatów: `proxy/deploy_proxy/`. Własne konfiguracje poczty w `mail-conf/poczta.conf` i `mail-conf/whatthefrog.conf` na VPS. Katalog `wspolne/` jest przeznaczony na przyszłe wspólne narzędzia; obecnie oba zestawy wdrożeniowe są samodzielne.

`archiwum/backup/` zawiera narzędzia pobrania starej poczty przez SSH, a `archiwum/migration/` — skrypty i testy migracji Beaty i Marcina przypisane do kopii z 2026-09-20. Nie służą do migracji Exchange ani końcowego dogrywania wiadomości. Kopie wiadomości są poza repo: `D:\Backup\Dimundi-poczta`.

[Instalacja WhatTheFrog](../dimundiWwwDocs/instalacja/whatthefrog/email.md)

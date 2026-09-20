# Poczta

- **`deploy/`** — aktualna konfiguracja kontenerów i skrypty instalacji oraz administracji. Z Windows wysyłamy pliki przez `install.bat`; na VPS uruchamiamy `build.sh`. Kolejną skrzynkę dodaje `add-account.sh`.
- **`archiwum/backup/`** — narzędzia pobrania skrzynek ze starego VPS przez SSH. To skrypty, nie kopie wiadomości ani backup nowego środowiska.
- **`archiwum/migration/`** — skrypty i testy pierwszej migracji Beaty i Marcina, przypisane do konkretnych kopii z 2026-09-20. Nie służą do końcowego dogrania nowych wiadomości.

Archiwum zachowujemy jako zapis wykonanej migracji. Zmiana katalogów dotyczy tylko lokalnego repozytorium; ścieżki na VPS pozostają bez zmian. Kopie wiadomości znajdują się poza repo w `D:\Backup\Dimundi-poczta`.

Dokumentacja: [konfiguracja i stan](../dimundiWwwDocs/email.md), [instalacja od zera](../dimundiWwwDocs/email-instalacja.md), [Thunderbird](../dimundiWwwDocs/thunderbird.md).

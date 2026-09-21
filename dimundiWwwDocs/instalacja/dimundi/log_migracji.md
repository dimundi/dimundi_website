# Log migracji poczty

Migracja Dimundi z 20–21 września 2026 r. Zapis historyczny; bieżąca konfiguracja: [email.md](email.md).

## Stan na 2026-09-21

- Kontenery i HTTPS uruchomione. Użytkownik potwierdził logowanie do Roundcube oraz wysyłkę do Gmail; nagłówki potwierdziły **SPF, DKIM i DMARC = pass**, połączenie TLS.
- A `poczta.dimundi.com` i `webmail.dimundi.com` → `145.239.92.71`. PTR tego IP → `poczta.dimundi.com`.
- SPF obu domen uwzględnia nowy VPS; dotychczasowi nadawcy zachowani na czas migracji. DKIM obu domen zgodny z wygenerowanymi kluczami. DMARC obu domen: `v=DMARC1; p=none`.
- **MX obu domen wskazuje `poczta.dimundi.com`, priorytet 1**; potwierdzono w publicznym DNS oraz odbiór z Gmaila na `.com` i `.pl`. Stary VPS: SSH `51.178.19.126`, Additional IP `137.74.32.110` (kandydat dla WhatTheFrog). Nie wykonano jego wyłączenia ani przeniesienia IP.
- **Migracja zakończona.** Kopie obu skrzynek przeniesione i zweryfikowane. Użytkownik rezygnuje z końcowego dogrywania: po sprawdzeniu starej poczty stwierdził, że po kopiowaniu przyszedł tylko spam. Thunderbird odbiera i wysyła; zewnętrzny test SMTP potwierdził TLS, odbiorców obu domen i odmowę relay (`554 Relay access denied`). Do wykonania: kontrola DNS dla DNSBL, zasobów z ClamAV i ostrzeżenia Rspamd `task_timeout`, pełna kopia nowego środowiska i test odtwarzania. Skuteczność filtrowania spamu ocenimy po dniu pracy.
- Thunderbird, 2026-09-21: brak połączenia na 993 spowodowała blokada publicznego IP klienta w jailu **postfix**, po sześciu nieudanych próbach. Jail `dovecot` był pusty. Usunięto wyłącznie blokadę klienta (`fail2ban-client set postfix unbanip <IP>`), bez stałego wyjątku i restartów. Po odblokowaniu potwierdzono z komputera TCP/993, poprawny certyfikat TLS i banner IMAP oraz banner SMTP/587. Przy podobnym błędzie sprawdzać wszystkie jaile, nie tylko Dovecot. OVH Network Firewall według użytkownika niewłączony.
- Ustalenie: pozostajemy przy lekkim DMS + Roundcube, bez panelu administracyjnego. Konta i aliasy przez SSH; po migracji dodać użytkownikowi zmianę własnego hasła w Roundcube z podaniem obecnego hasła. Funkcja jeszcze niewdrożona.

## Kopie starej poczty

- Cel: `D:\Backup\Dimundi-poczta\` (NTFS). Każda skrzynka przez jej własne konto SSH: `beata` lub `marcin`; hasła wpisywane w oknie, niezapisywane.
- Skrypty: `poczta/archiwum/backup/backup-beata.ps1` i `backup-marcin.ps1`, parametr `-Python <python.exe>`. Zarchiwizowane pliki bez kosza przed kompresją: Marcin 10 026 449 858 B; Beata 1 357 198 215 B.
- Format: `Maildir.tar.gz`, `SHA256SUMS.txt`, `report.json`. Pomijamy `.Trash` i `.Trash.*`; zachowujemy archiwum, wysłane i szkice. Strumieniowanie na komputer bez dodatkowego archiwum na VPS.
- Wskaźnik: pobrane GB, MB/s i czas; później weryfikacja TAR, CRC gzip i SHA-256. `archive_verified` oznacza poprawne archiwum; `incomplete` — brak ukończonej kopii. Test odtworzenia to osobny krok.
- Kopia aktywnej skrzynki nie jest atomowym snapshotem. Błąd/zmiana pliku zgłoszona przez tar oznacza nieukończoną próbę. Brak wznawiania; ponowienie tworzy nowy katalog. Kopie obejmują Maildir, nie konfigurację starego serwera.
- **Beata: zakończona i zweryfikowana** — `Beata-20260920-222904/Maildir.tar.gz`, 3463 wiadomości, 930 620 852 B; niezależnie potwierdzono SHA-256.
- **Marcin: zakończona i zweryfikowana** — `Marcin-20260920-223745/Maildir.tar.gz`, 20 751 wiadomości, 6 780 468 275 B. Raport `archive_verified`; niezależnie potwierdzono SHA-256. Kopia została również przeniesiona na nowy VPS i porównana ze źródłem.
- Zachowujemy lokalne archiwa. Końcowe dogrywanie pominięte na wyraźne życzenie użytkownika: nowe wiadomości na starym serwerze to według jego kontroli wyłącznie spam. Można usunąć z nowego VPS archiwa migracyjne (7,2 GB) i rozpakowane kopie w `/tmp/dimundi-migration-*` kontenera (10,7 GB); podano dokładne ścieżki, wykonania usuwania jeszcze nie potwierdzono. Raporty migracji i działające dane w `poczta/data` zachowujemy.

## Migracja Beaty — kopia przeniesiona i zweryfikowana

- Potwierdzono `COMPLETE` i raport `verified` na VPS: źródło 3463, cel przed migracją 0, po migracji 3463; brak brakujących wiadomości i różnic sprawdzanych metadanych. Foldery: INBOX 2474, Sent 979, Drafts 9, Archives.2021 1. Użytkownik potwierdził widoczność wiadomości w Roundcube.

- Lokalnie: `poczta/archiwum/migration/migrate-beata.ps1`; `t/n` przed wysyłką i synchronizacją, klucz z `deploy.config`. Źródło: konkretna zweryfikowana kopia Beaty z 2026-09-20, 3463 wiadomości.
- VPS: `/home/docker/dimundi/poczta/migration/beata-20260920/`; archiwum sprawdzane SHA-256. Rozpakowanie do roboczego `/tmp/dimundi-migration-beata-20260920` w kontenerze; oryginalna kopia i stary serwer pozostają bez zmian.
- Synchronizacja `doveadm sync -1 -R -u beata@dimundi.com`: pobiera z kopii roboczej, zachowuje wiadomości istniejące w nowej skrzynce. Przed nią zapisujemy kopię i inwentarz celu. Nie używamy nadpisującego `doveadm backup -R` ani zwykłego importu bez deduplikacji.
- `verification.json` porównuje wszystkie wiadomości: folder, SHA-256 treści, datę i flagi; kontroluje zachowanie wcześniejszych wiadomości celu. `COMPLETE` powstaje po sukcesie. Nie traktuj samego przesłania archiwum jako zakończonej migracji.
- Lokalny test na sztucznych danych: zgodność dat/flag/folderów, zachowanie wiadomości celu i brak duplikatów po ponowieniu. Kontrola VPS przed migracją: Dovecot 2.4.1, UID/GID 5000, ścieżka `/var/mail/dimundi.com/beata`, brak wiadomości, około 33 GB wolnego.
- Logi i raporty zachowujemy. Kopie robocze przeznaczone do usunięcia po migracji; końcowe dogrywanie pominięte na życzenie użytkownika (na stary serwer przyszedł tylko spam).

Źródło doboru trybu: [Dovecot — migracja skrzynek](https://doc.dovecot.org/2.3/admin_manual/migrating_mailboxes/).

## Migracja Marcina — kopia przeniesiona i zweryfikowana

- 2026-09-21 potwierdzono `COMPLETE` i raport `verified`: źródło 20 751, cel przed migracją 3, po migracji 20 754. Brak brakujących wiadomości i różnic sprawdzanych metadanych; trzy wcześniejsze wiadomości zachowane. Użytkownik potwierdził widoczność poczty.

- Lokalnie: `poczta/archiwum/migration/migrate-marcin.ps1`; kopia `Marcin-20260920-223745`, 20 751 wiadomości, weryfikacja ustalonego SHA-256. Osobne `t/n` przed wysłaniem i synchronizacją.
- Kontrola przed wysłaniem: konto, stan usług i minimum 31 GB wolnego na VPS (archiwum 6,78 GB + źródło i cel po około 10 GB + zapas). Brak miejsca zatrzymuje procedurę bez automatycznego usuwania danych.
- VPS: `/home/docker/dimundi/poczta/migration/marcin-20260920/`; kopia robocza w kontenerze `/tmp/dimundi-migration-marcin-20260920`. Metoda i weryfikacja jak u Beaty; raport w `verification.json`. Podczas kopiowania MX i stary serwer pozostawały bez zmian; później MX przełączono (stan powyżej).

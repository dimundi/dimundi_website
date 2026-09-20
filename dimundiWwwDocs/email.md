# Poczta — konfiguracja i stan

Instrukcja postawienia środowiska od zera: [email-instalacja.md](email-instalacja.md). Wdrożenie strony i proxy: [deploy.md](deploy.md).

Konfiguracja programu pocztowego: [thunderbird.md](thunderbird.md).

## Konfiguracja

| Element | Ustalenie |
| --- | --- |
| VPS | Debian 13, `145.239.92.71`, konto SSH `docker`, katalog `/home/docker/dimundi` |
| Poczta | `poczta.dimundi.com`; SMTP/IMAP przez Docker Mailserver `16.0.1` |
| Webmail | `https://webmail.dimundi.com`; Roundcube `1.6.19-apache`, SQLite, istniejące proxy Nginx |
| Domeny | `dimundi.com`; `dimundi.pl` jako jawne aliasy, bez catch-all |
| Skrzynki | `marcin@dimundi.com`, `beata@dimundi.com`; login pełnym adresem |
| Aliasy | `marcin@dimundi.pl`, `beata@dimundi.pl`; `postmaster` i `abuse` obu domen → Marcin |
| Porty | IPv4: 25 SMTP, 465 SMTP TLS, 587 SMTP STARTTLS, 993 IMAP TLS; POP3 i poczta po IPv6 wyłączone |
| Ochrona | Rspamd + Redis, ClamAV, Fail2Ban; SMTP użytkowników wymaga uwierzytelnienia |
| DKIM | Selektor `dimundi2026`, osobne klucze dla `.com` i `.pl` |
| Certyfikat | Nazwa `poczta.dimundi.com`, obejmuje także `webmail.dimundi.com` |

`whatthefrog.pl` pozostaje na OVH Exchange — osobny, późniejszy etap. Zasoby VPS można rozbudować; przed migracją sprawdzić RAM i dysk z zapasem. Ostatni pomiar: 3,7 GiB RAM, dysk 40 GB, około 35 GB wolnego przed migracją.

## Pliki i kontenery

Dodawanie kolejnej skrzynki: na VPS jako `docker` uruchom `cd ~/dimundi/poczta/deploy`, następnie `bash add-account.sh`. Skrypt pyta o nazwę/adres `.com`, opcjonalny alias `.pl` i potwierdzenie `t/n`; hasło podaje się w ukrytym monicie DMS. Sprawdza kolizje z istniejącymi kontami i aliasami, bez nadpisywania haseł. Wymaga działającego kontenera. Plik wysyła istniejący `poczta/deploy/install.bat`. `accounts.sh` pozostaje do pierwszej instalacji Marcina, Beaty i aliasów technicznych.

- Repo: `poczta/deploy/`, projekt Compose `dimundi-mail`. Instalatory kopiują przez SSH/SCP; na VPS nie używamy Gita.
- VPS: `/home/docker/dimundi/poczta/deploy/`; obok `data/{mail,state,logs,config,roundcube-db}` i `secrets/roundcube_des_key`. Dane, klucze i hasła poza Gitem.
- Proxy: `/home/docker/dimundi/proxy/`; aktywna konfiguracja poczty `mail-conf/poczta.conf`, certyfikaty w `letsencrypt/`. Nginx czyta konfigurację z bind mount.
- Roundcube nie publikuje portu hosta. Do proxy dołącza przez sieć `dimundi-proxy_default`, alias `dimundi-webmail`; do IMAP/SMTP łączy się po prywatnej sieci przez TLS z weryfikacją certyfikatu.
- Lokalny `deploy.config` zawiera `SSH_KEY`; wzór `deploy.config_tmp`. Nie wysyłamy klucza prywatnego na VPS. Logowanie hasłem do `debian` pozostaje włączone.

## Certyfikaty i ochrona webmaila

- Fail2Ban: w repo przygotowano i lokalnie sprawdzono dla `postfix` i `dovecot` 6 błędów / 10 minut → 15 minut blokady, `bantime.increment=true`, podwajanie (`factor=1`) do maks. 24 godzin. Historia osobna dla każdego jaila; wcześniejsze blokady zapisane w bazie mogą wpłynąć na kolejną karę. Wyjątek Roundcube zachowany, `custom` bez zmian (180 dni).
- Wdrożenie nowych czasów na VPS jeszcze niepotwierdzone. Ostatni odczyt przed zmianą: 6 błędów / 7 dni → 7 dni blokady. Zmiana pliku i reload nie oznaczają automatycznego usunięcia istniejących banów.
- Cron użytkownika `docker`: odnowienia o **03:17 i 15:17** czasu VPS, skrypt `proxy/renew-cert.sh`, log `proxy/renew-cert.log`.
- Certbot odnawia wszystkie certyfikaty. Nginx wykonuje kontrolę konfiguracji i reload; DMS wykrywa nowe certyfikaty i przeładowuje usługi. Nie potrzeba ręcznego restartu kontenera po każdym odnowieniu.
- Fail2Ban pomija wyłącznie aktualny prywatny IP aliasu `dimundi-roundcube` (`fail2ban-jail.cf`, `ignore-roundcube.sh`). Nie wykluczamy całej sieci Docker.
- Nginx ogranicza POST webmaila do 30/min/IP, z buforem 15; nadmiar → HTTP 429. Limit obejmuje również operacje po zalogowaniu. GET bez limitu; użytkownicy za wspólnym publicznym IP dzielą limit.
- Wyjątek Roundcube i limit POST zostały wdrożone; bieżąca konfiguracja zawiera je również dla nowych instalacji.

## Stan na 2026-09-21

- Kontenery i HTTPS uruchomione. Użytkownik potwierdził logowanie do Roundcube oraz wysyłkę do Gmail; nagłówki potwierdziły **SPF, DKIM i DMARC = pass**, połączenie TLS.
- A `poczta.dimundi.com` i `webmail.dimundi.com` → `145.239.92.71`. PTR tego IP → `poczta.dimundi.com`.
- SPF obu domen uwzględnia nowy VPS; dotychczasowi nadawcy zachowani na czas migracji. DKIM obu domen zgodny z wygenerowanymi kluczami. DMARC obu domen: `v=DMARC1; p=none`.
- **MX obu domen nadal wskazuje `mail.dimundi.com` → `137.74.32.110`**, Additional IP starego VPS. Dostęp SSH do starego VPS: `51.178.19.126`. Nie przenosimy Additional IP przed zakończeniem migracji; później kandydat dla WhatTheFrog.
- Kopie obu skrzynek przeniesione i zweryfikowane. Do wykonania: potwierdzenie logowania Thunderbirda po odblokowaniu IP, końcowa synchronizacja najnowszych wiadomości i przełączenie MX, test odbioru z Internetu i blokady otwartego relay, kontrola DNS używanego przez DNSBL oraz zasobów z ClamAV, pełna kopia nowego środowiska i test odtwarzania. Sprawdzić też zgłoszone ostrzeżenie Rspamd o `task_timeout`.
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
- Źródłowych wiadomości nie usuwamy. Przed przełączeniem MX potrzebna migracja, po przełączeniu końcowa synchronizacja.

## Migracja Beaty — kopia przeniesiona i zweryfikowana

- Potwierdzono `COMPLETE` i raport `verified` na VPS: źródło 3463, cel przed migracją 0, po migracji 3463; brak brakujących wiadomości i różnic sprawdzanych metadanych. Foldery: INBOX 2474, Sent 979, Drafts 9, Archives.2021 1. Użytkownik potwierdził widoczność wiadomości w Roundcube.

- Lokalnie: `poczta/archiwum/migration/migrate-beata.ps1`; `t/n` przed wysyłką i synchronizacją, klucz z `deploy.config`. Źródło: konkretna zweryfikowana kopia Beaty z 2026-09-20, 3463 wiadomości.
- VPS: `/home/docker/dimundi/poczta/migration/beata-20260920/`; archiwum sprawdzane SHA-256. Rozpakowanie do roboczego `/tmp/dimundi-migration-beata-20260920` w kontenerze; oryginalna kopia i stary serwer pozostają bez zmian.
- Synchronizacja `doveadm sync -1 -R -u beata@dimundi.com`: pobiera z kopii roboczej, zachowuje wiadomości istniejące w nowej skrzynce. Przed nią zapisujemy kopię i inwentarz celu. Nie używamy nadpisującego `doveadm backup -R` ani zwykłego importu bez deduplikacji.
- `verification.json` porównuje wszystkie wiadomości: folder, SHA-256 treści, datę i flagi; kontroluje zachowanie wcześniejszych wiadomości celu. `COMPLETE` powstaje po sukcesie. Nie traktuj samego przesłania archiwum jako zakończonej migracji.
- Lokalny test na sztucznych danych: zgodność dat/flag/folderów, zachowanie wiadomości celu i brak duplikatów po ponowieniu. Kontrola VPS przed migracją: Dovecot 2.4.1, UID/GID 5000, ścieżka `/var/mail/dimundi.com/beata`, brak wiadomości, około 33 GB wolnego.
- Logi i kopie robocze zostają na VPS; `/tmp` kontenera może zniknąć przy jego odtworzeniu. Końcowa synchronizacja najnowszych wiadomości ze starego serwera pozostaje do wykonania.

Źródło doboru trybu: [Dovecot — migracja skrzynek](https://doc.dovecot.org/2.3/admin_manual/migrating_mailboxes/).

## Migracja Marcina — kopia przeniesiona i zweryfikowana

- 2026-09-21 potwierdzono `COMPLETE` i raport `verified`: źródło 20 751, cel przed migracją 3, po migracji 20 754. Brak brakujących wiadomości i różnic sprawdzanych metadanych; trzy wcześniejsze wiadomości zachowane. Użytkownik potwierdził widoczność poczty.

- Lokalnie: `poczta/archiwum/migration/migrate-marcin.ps1`; kopia `Marcin-20260920-223745`, 20 751 wiadomości, weryfikacja ustalonego SHA-256. Osobne `t/n` przed wysłaniem i synchronizacją.
- Kontrola przed wysłaniem: konto, stan usług i minimum 31 GB wolnego na VPS (archiwum 6,78 GB + źródło i cel po około 10 GB + zapas). Brak miejsca zatrzymuje procedurę bez automatycznego usuwania danych.
- VPS: `/home/docker/dimundi/poczta/migration/marcin-20260920/`; kopia robocza w kontenerze `/tmp/dimundi-migration-marcin-20260920`. Metoda i weryfikacja jak u Beaty; raport w `verification.json`. MX i stary serwer bez zmian.

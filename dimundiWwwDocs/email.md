# Poczta — konfiguracja i stan

Instrukcja postawienia środowiska od zera: [email-instalacja.md](email-instalacja.md). Wdrożenie strony i proxy: [deploy.md](deploy.md).

Konfiguracja programu pocztowego: [thunderbird.md](thunderbird.md).

## Konfiguracja

| Element | Ustalenie |
| --- | --- |
| VPS | Debian 13, `145.239.92.71`, konto SSH `docker`, katalog `/home/docker/dimundi` |
| Poczta | `poczta.dimundi.com`; SMTP/IMAP przez Docker Mailserver `16.0.1` |
| Webmail | `https://webmail.dimundi.com`; Roundcube `1.6.19-apache`, SQLite, istniejące proxy Nginx |
| Domeny | `dimundi.com`; `dimundi.pl` jako aliasy; catch-all obu domen do Marcina; konfiguracja zastosowana przez użytkownika |
| Skrzynki | `marcin@dimundi.com`, `beata@dimundi.com`, `biuro@dimundi.com`; login pełnym adresem |
| Aliasy | `marcin@dimundi.pl`, `beata@dimundi.pl`; `postmaster` i `abuse` obu domen → Marcin |
| Porty | IPv4: 25 SMTP, 465 SMTP TLS, 587 SMTP STARTTLS, 993 IMAP TLS; POP3 i poczta po IPv6 wyłączone |
| Ochrona | Rspamd + Redis, ClamAV, Fail2Ban; SMTP użytkowników wymaga uwierzytelnienia |
| DKIM | Selektor `dimundi2026`, osobne klucze dla `.com` i `.pl` |
| Certyfikat | Nazwa `poczta.dimundi.com`, obejmuje także `webmail.dimundi.com` |

`whatthefrog.pl` pozostaje na OVH Exchange — osobny, późniejszy etap. Zasoby VPS można rozbudować; przed migracją sprawdzić RAM i dysk z zapasem. Ostatni pomiar: 3,7 GiB RAM, dysk 40 GB, około 35 GB wolnego przed migracją.

## Biuro i formularz — uruchomione

- Użytkownik potwierdził utworzenie `biuro@dimundi.com` przez `add-account.sh`. Konto pozostaje do uwierzytelniania SMTP formularza; przekierowanie nie usuwa konta ani hasła.
- Wzór `backend/.env_tmpl` wskazuje SMTP `poczta.dimundi.com:587`, STARTTLS (`SMTP_SECURE=false`), login/nadawcę/odbiorcę i publiczny kontakt `biuro@dimundi.com`. Rzeczywiste hasło tylko w ignorowanym `.env`; wzór nie aktualizuje produkcji.
- Lokalny `backend/.env` ma już powyższe adresy; telefon i hasło pozostawiono bez zmian. Przed wysłaniem użytkownik musi wpisać hasło nowego konta biura w `SMTP_PASS`. Wysłać przez `deploy/install.bat` (pliki `t`, `.env` `t`), następnie odtworzyć backend jak poniżej. Użytkownik potwierdził odbiór wiadomości z formularza oraz działanie przekierowania biura. Formularz ustawia `Reply-To` na adres podany przez odwiedzającego.
- Uzgodniono: `biuro@dimundi.com` i `biuro@dimundi.pl` → `marcin@dimundi.com`, bez kopii w biurze; nieznane adresy w obu domenach → Marcin. Repo `poczta/deploy/postfix-virtual.cf` zawiera docelowe mapowania. `install.bat` wysyła je tylko do `deploy/`, bez automatycznej aktywacji. Porównać z `../data/config/postfix-virtual.cf`, zachować inne istniejące aliasy i zrobić kopię przed edycją. Konkretne adresy umieszczać przed catch-all; Beata i Marcin mają jawne mapowania na siebie. DMS wykrywa zmiany pliku konfiguracji. Po zmianie potwierdzić aktywne mapy i rzeczywiste dostarczanie do Beaty, Marcina, biura i nieznanych adresów obu domen.
- Po utworzeniu skrzynki uzupełnić `/home/docker/dimundi/app/backend/.env` na VPS, zachowując telefon i pozostałe ustawienia. W `~/dimundi/app/deploy` wykonać `docker compose up -d --no-deps --force-recreate backend`, następnie przetestować formularz i odbiór. Sam restart nie wczytuje zmian `env_file`.

## Pliki i kontenery

Dodawanie kolejnej skrzynki: na VPS jako `docker` uruchom `cd ~/dimundi/poczta/deploy`, następnie `bash add-account.sh`. Skrypt pyta o nazwę/adres `.com`, opcjonalny alias `.pl` i potwierdzenie `t/n`; hasło podaje się w ukrytym monicie DMS. Sprawdza kolizje z istniejącymi kontami i aliasami, bez nadpisywania haseł. Przy catch-all dodaje dla nowego konta jawne mapowanie na siebie, aby poczta trafiała do jego skrzynki. Wymaga działającego kontenera. Plik wysyła istniejący `poczta/deploy/install.bat`. `accounts.sh` pozostaje do pierwszej instalacji Marcina, Beaty i aliasów technicznych.

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

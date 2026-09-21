# Poczta — konfiguracja i stan

Instrukcja postawienia środowiska od zera: [email-instalacja.md](email-instalacja.md). Wdrożenie strony i proxy: [deploy.md](deploy.md).

Konfiguracja programów pocztowych: [programy-pocztowe.md](../programy-pocztowe.md).

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

## Stan poczty

Migracja zakończona 2026-09-21. Historię, kopie starej poczty i raporty przenoszenia skrzynek zapisano w [log_migracji.md](log_migracji.md).

- Kontenery i HTTPS działają; potwierdzono odbiór i wysyłkę oraz SPF, DKIM i DMARC = `pass`.
- A `poczta.dimundi.com` i `webmail.dimundi.com` → `145.239.92.71`; PTR tego IP → `poczta.dimundi.com`.
- MX obu domen → `poczta.dimundi.com`, priorytet 1. SPF uwzględnia VPS i dotychczasowych nadawców; DKIM obu domen skonfigurowany, DMARC: `v=DMARC1; p=none`.
- Konta i aliasy obsługujemy przez SSH, bez panelu administracyjnego. Zmiana własnego hasła w Roundcube jeszcze niewdrożona.
- Przy braku połączenia sprawdzać wszystkie jaile Fail2Ban, również `postfix` — jego blokada może odciąć IMAP.

## Do wykonania

- Kontrola DNS dla DNSBL, zasobów z ClamAV i ostrzeżenia Rspamd `task_timeout`; ocena filtrowania spamu.
- Pełna kopia nowego środowiska poza VPS i test odtwarzania.
- Potwierdzenie usunięcia kopii roboczych migracji; zachować lokalne archiwa i raporty. Szczegóły w [log_migracji.md](log_migracji.md).
- Decyzja o starym VPS i uporządkowaniu SPF; wyłączenie starego serwera i przeniesienie IP nie zostały wykonane.

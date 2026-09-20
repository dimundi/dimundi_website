# Poczta

Stan: użytkownik wykonał procedurę uruchomienia na VPS. DNS nadawcy przygotowany; migracja i testy produkcyjne pozostają do wykonania, MX bez zmian.

## Moduły — plan

- Docker Mailserver: SMTP/IMAP, osobny kontener.
- Roundcube: webmail, osobny kontener; główny dostęp przez programy pocztowe.
- Istniejące proxy Nginx: HTTPS dla webmaila.
- Wiadomości: trwały katalog poza kontenerem.
- Pozostajemy przy Docker Mailserver + Roundcube. Obecne zasoby VPS nie są sztywnym ograniczeniem: użytkownik dopuszcza rozbudowę w razie potrzeby. Przed migracją sprawdzić RAM i dysk z zapasem; ewentualną rozbudowę uzgodnić z użytkownikiem.

## Konfiguracja — ustalenia

- Katalog plików wdrożenia w repozytorium: `poczta/deploy/`.
- Nowy serwer SMTP/IMAP: `poczta.dimundi.com`; użytkownik dodał rekord A na `145.239.92.71`. Webmail: `webmail.dimundi.com`. MX pozostaje bez zmian do migracji i testów.
- Domena: `dimundi.com`; `dimundi.pl` jako alias.
- Skrzynki do migracji: `marcin`, `beata`; bez kosza.
- Źródło: VPS `51.178.19.126`, Postfix + Dovecot; SSH `marcin`, port 22, bez sudo.
- Rozmiar: Marcin około 12 GB bez kosza, Beata do 500 MB (deklaracja użytkownika).
- `whatthefrog.pl`: poza obecnym etapem, pozostaje na OVH Exchange.
- Porty, nazwy hostów, katalogi, certyfikaty i kopie zapasowe: dopisać podczas wdrażania.

## Kontrola VPS — 2026-09-20

- Nowy VPS `145.239.92.71`: 3,7 GiB RAM, dostępne 3,2 GiB; brak swap. Dysk 40 GB, wolne około 35 GB.
- Wyjście TCP/25 IPv4: połączenia SMTP do Gmail i OVH poprawne; bez wysyłania wiadomości. Wejście z Internetu i dostarczalność jeszcze niesprawdzone.
- Lokalna usługa nasłuchuje na `127.0.0.1:25` i `[::1]:25`; ustalić usługę przed publikacją portu kontenera. Porty 465/587/993 nie mają listenerów.
- MX obu domen: `mail.dimundi.com`, A `137.74.32.110`. Użytkownik potwierdził w panelu OVH, że jest to Additional IP przypisany do starego VPS; `51.178.19.126` jest adresem użytym do SSH. Nie zmieniać MX/A ani przypisania Additional IP przed migracją poczty.
- `137.74.32.110`: kandydat dla przyszłej poczty WhatTheFrog. Po zakończeniu migracji Dimundi sprawdzić możliwość przeniesienia na docelowy VPS i skonfigurować oddzielnie; obecnie adres obsługuje starą pocztę Dimundi.
- `webmail.dimundi.com` wskazuje na nowy VPS. PTR nowego IPv4 nadal `vps-f9b377ab.vps.ovh.net`; docelowy PTR ustalić przy konfiguracji poczty.
- Wykonano tylko odczyty i test połączeń. Bez instalacji i zmian DNS.

## Przygotowana konfiguracja

- Compose `dimundi-mail`: Docker Mailserver `16.0.1`, Roundcube `1.6.19-apache` z SQLite (dwie skrzynki, okazjonalny webmail).
- DMS: Postfix, Dovecot, Rspamd + Redis, ClamAV, Fail2Ban. Wysyłanie wymaga uwierzytelnienia; POP3 wyłączony.
- Porty wyłącznie na IPv4 `145.239.92.71`: 25 (serwery), 465 (SMTP TLS), 587 (SMTP STARTTLS), 993 (IMAP TLS). Lokalny listener 127.0.0.1:25 pozostaje nietknięty. IPv6 poczty na razie wyłączony.
- VPS: `/home/docker/dimundi/poczta/deploy/`. Dane: sąsiedni `data/` (mail, state, logs, config, roundcube-db); klucz sesji: `secrets/roundcube_des_key`. Dane/sekrety ignorowane przez Git i niewysyłane przez instalator.
- Roundcube: HTTPS przez istniejące proxy, sieć `dimundi-proxy_default`; brak publicznego portu kontenera webmaila. Do DMS łączy się przez TLS po prywatnej sieci z weryfikacją certyfikatu. Login: pełny adres skrzynki.
- Certyfikat `poczta.dimundi.com` obejmuje też `webmail.dimundi.com`; istniejący Certbot i katalog `proxy/letsencrypt`. Zaktualizowany cron proxy odnawia wszystkie certyfikaty. DMS wykrywa zmiany certyfikatów i przeładowuje Postfix/Dovecot; Nginx przeładowuje skrypt cron.
- Aliasowanie `.pl` jest jawne: Marcin i Beata, bez catch-all. `postmaster` i `abuse` obu domen trafiają do Marcina.
- DKIM: selektor `dimundi2026`, oddzielne klucze dla `.com` i `.pl`, tworzone tylko na VPS. Stary selektor `mail` pozostaje bez zmian.

## Uruchomienie — kolejność

Polecenia lokalne wykonuj w PowerShell na Windows z głównego katalogu projektu, nie z katalogu dokumentacji ani na VPS:

```powershell
cd D:\GIT\Dimundi\dimundi_landing_page
.\proxy\deploy_proxy\install-proxy.bat
```

1. Lokalnie: `.\proxy\deploy_proxy\install-proxy.bat`, odpowiedzi `t/t/n`. Na VPS jako `docker`: `cd /home/docker/dimundi/proxy`, potem `bash build-proxy.sh` (`t/t`). Dodaje montowanie `mail-conf` i aktualizuje odnawianie; chwilowo odtwarza proxy.
2. Lokalnie: `poczta/deploy/install.bat` (`t`). Korzysta z głównego `deploy.config`; tylko wysyła jawnie wymienione pliki.
3. Na VPS jako `docker`: `cd /home/docker/dimundi/poczta/deploy`. Dalej wszystkie polecenia z tego katalogu.
4. `bash build.sh`: `t` na przygotowanie/pobranie, `n` na uruchomienie. Gotowe obrazy — nie budujemy własnych Dockerfile.
5. `bash setup-tls.sh`: potwierdzenia `t/n`, e-mail Let's Encrypt, próbna weryfikacja i produkcyjny certyfikat. Włącza webmail w proxy; przed startem Roundcube odpowiedź 502 jest spodziewana.
6. `bash accounts.sh`: tworzy konta z hasłami wpisywanymi w ukrytym monicie, potem aliasy. Przy ponowieniu pomijaj istniejące konta; nie nadpisuj haseł przypadkiem.
7. `bash build.sh`: `t/t`. Czeka na zdrowy serwer i uruchamia Roundcube. Pierwszy start ClamAV może potrwać dłużej; przy timeout sprawdź `docker compose -f compose.yml logs --tail=100` oraz `ps`.
8. `bash dkim.sh`: generuje brakujące klucze i pokazuje publiczne rekordy TXT; nie edytuje DNS.
9. Sprawdź webmail, IMAP/SMTP i `bash /home/docker/dimundi/proxy/renew-cert.sh --dry-run`; `crontab -l` musi zawierać istniejące zadanie odnawiania.

## Przed migracją i zmianą MX

- Nadal stara poczta: nie przełączamy MX ani rekordu `mail` tymi skryptami.
- DNS potwierdzony publicznie: PTR IPv4 → `poczta.dimundi.com`; SPF obu domen zawiera `145.239.92.71`; DKIM `dimundi2026` obu domen zgodny z kluczami pokazanymi przez skrypt; DMARC obu domen `v=DMARC1; p=none` (bez raportowania). Pozostają testy wysyłki/odbioru i blokady relay z Internetu.
- Zweryfikować DNS używany przez antyspam/DNSBL; ewentualny własny resolver ustalić przed produkcją. Sprawdzić zużycie RAM z ClamAV i zapas dysku.
- Przed migracją ustalić kopię poza VPS i sprawdzić odtwarzanie (dane poczty, konfiguracja kont/DKIM, SQLite, klucz Roundcube, certyfikaty). Nie wykonywać niespójnej kopii aktywnej bazy SQLite.
- Wiadomości kopiujemy później, bez kosza, z końcową synchronizacją po przełączeniu. Hasło Beaty nadal do odzyskania.
- Lokalnie sprawdzono start kontenerów, konto/alias, logowanie IMAP TLS i SMTP STARTTLS oraz logowanie przez Roundcube za proxy HTTPS i składnię DKIM obu domen. W lokalnej próbie DMS z ClamAV zużywał około 1,23 GiB RAM, Roundcube 35 MiB; to pomiar bez rzeczywistego obciążenia. Test SMTP/25 z lokalnej sieci przekroczył czas; test relay na VPS nadal wymagany. Nie wysłano żadnej wiadomości.

Źródła konfiguracji: [DMS](https://docker-mailserver.github.io/docker-mailserver/latest/), [Roundcube](https://github.com/roundcube/roundcubemail-docker).

## Poprawka blokady Roundcube przez Fail2Ban

- Przyczyna: Dovecot widzi wspólny IP Roundcube. Po sześciu błędnych logowaniach Fail2Ban zablokował webmail wszystkim; ręczne odblokowanie przywróciło logowanie.
- `fail2ban-jail.cf` + `ignore-roundcube.sh`: wyjątek tylko dla IP aktualnie rozwiązanego z prywatnego aliasu `dimundi-roundcube`. Bez stałego IP i bez wykluczania całej sieci. Fail2Ban nadal chroni bezpośrednie połączenia IMAP/SMTP.
- Nginx: POST do webmaila maks. 30/min na rzeczywisty adres klienta, z buforem 15 żądań; nadmiar otrzymuje HTTP 429. Limit obejmuje wszystkie POST (także operacje po zalogowaniu), bo dane logowania mogą być w treści żądania. GET i pliki strony nie są limitowane. Użytkownicy za jednym publicznym IP dzielą limit; nagłówki klienta nie zmieniają klucza limitu.
- Wdrożenie: lokalnie `.\poczta\deploy\install.bat` (`t`), następnie na VPS jako `docker`:

```sh
cd /home/docker/dimundi/poczta/deploy
bash update-webmail.sh
```

- Potwierdź `t`. Skrypt najpierw sprawdza i przeładowuje proxy z limitem, potem odtwarza kontenery poczty i usuwa wcześniejsze blokady aktualnego IP Roundcube. Krótka przerwa w poczcie; bez zmiany haseł, certyfikatów i MX. Nie uruchamiaj ponownie `accounts.sh` ani `setup-tls.sh` dla tej poprawki.

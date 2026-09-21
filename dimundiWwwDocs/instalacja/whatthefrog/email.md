# WhatTheFrog — migracja poczty

| Element | Ustalenie |
| --- | --- |
| Domena | `whatthefrog.pl` |
| Skrzynka źródłowa | `biuro@whatthefrog.pl` |
| Konta docelowe | `marcin@whatthefrog.pl`, `biuro@whatthefrog.pl` |
| Źródło | OVH Exchange |
| Serwer źródłowy | `ex5.mail.ovh.net` |
| Rozmiar źródła / wolne miejsce na VPS | Około 2,4 GB / 20 GB — podane przez użytkownika |
| Cel | VPS `145.239.92.71`, osobny projekt `whatthefrog-mail`, Docker Mailserver + Roundcube |
| IP poczty | `54.38.134.226`; SMTP/IMAP i ruch wychodzący. Webmail nadal `51.68.128.220`. |
| Repo / VPS | `poczta/whatthefrog/deploy/` → `/home/docker/dimundi/whatthefrog/deploy/` |
| Stan | Użytkownik potwierdził wykonanie TLS i accounts.sh; kontenery uruchomione, DMS healthy. Migracja wiadomości nierozpoczęta. |

## Punkt wznowienia — 2026-09-21

- Użytkownik odłożył dalsze prace do jutra. Kontenery WhatTheFrog działają po zmianie IP i odtworzeniu sieci; test z kontenera potwierdził `54.38.134.226`.
- Na `ens3` pozostają `145.239.92.71`, `51.68.128.220` i `54.38.134.226`. Nowe IP dodano osobnym plikiem Netplana; konfiguracja zaakceptowana.
- Ostatnia wysyłka: Gmail odrzucił wiadomość kodem `550 5.7.25` (PTR / zgodność forward DNS), nie wcześniejszym błędem spamu `550 5.7.1`. Późniejsze sprawdzenie przez 1.1.1.1 i 8.8.8.8 potwierdziło PTR `54.38.134.226` → `poczta.whatthefrog.pl` oraz A `poczta.whatthefrog.pl` → `54.38.134.226`. Możliwa pamięć wcześniejszych rekordów po stronie Gmaila; brak potwierdzenia dostarczalności z nowego IP.
- Zwrotka została dostarczona przez LMTP do Marcina z `orig_to=biuro@whatthefrog.pl`: przekierowanie biura działa dla tej wiadomości.
- Jutro: sprawdzić A/PTR/SPF, wysłać nowy test do Gmaila i odczytać wynik SMTP; po dostarczeniu sprawdzić SPF/DKIM/DMARC i folder odbioru. Nie zmieniać kolejnego IP bez diagnozy.
- Nadal do wykonania: wyjaśnienie zdublowanego `biuro` w Dovecot, test catch-all i odmowy relay, migracja IMAP biuro OVH → marcin bez kosza, weryfikacja i dopiero potem MX oraz dogranie wiadomości.
- MX pozostaje na OVH; wiadomości nie były jeszcze kopiowane. ClamAV WhatTheFrog wyłączony do zwiększenia RAM. Zmiana haseł w Roundcube odłożona.

## Zakres

Zmiana IP została wdrożona; aktualny stan i zadania opisano w punkcie wznowienia powyżej. Poniższy opis pierwszego uruchomienia odnosi się do poprzedniego IP.

Test wysyłki 2026-09-21: Gmail przyjął wiadomość (SMTP 250), umieścił w spamie. Nagłówki potwierdzają IP `51.68.128.220`, TLS 1.3, SPF pass, DKIM pass (selektor `whatthefrog2026`). Następnie dodano DMARC `v=DMARC1; p=none`; kolejny test potwierdził SPF/DKIM/DMARC pass, ale Gmail nadal klasyfikował wiadomości jako spam, a późniejszą wysyłkę biura odrzucił kodem 550 5.7.1. Log zawiera również błąd Dovecot o zdublowanym `biuro@whatthefrog.pl` w userdb — do wyjaśnienia przed migracją. Zmianę haseł przez Roundcube odłożono na życzenie użytkownika.

- Utworzyć oba konta przed kopiowaniem wiadomości.
- Wszystkie wiadomości i foldery źródłowego `biuro@whatthefrog.pl` przenieść do `marcin@whatthefrog.pl`, z pominięciem kosza i jego podfolderów. Bez kontaktów i kalendarza.
- Docelowe `biuro@whatthefrog.pl` przekierowuje całą pocztę do `marcin@whatthefrog.pl`, bez lokalnej kopii w biurze; konto biura pozostaje.
- Catch-all domeny `whatthefrog.pl` → `marcin@whatthefrog.pl`.
- Zachować jawne mapowanie Marcina na jego własną skrzynkę przy catch-all.

Do sprawdzenia przed kopiowaniem: dostęp IMAP do źródła i nazwa folderu kosza na źródle.

## Osobne środowisko — przygotowanie

- Osobny projekt Compose, kontener pocztowy, dane, konfiguracja i sekrety dla WhatTheFrog. Nie tworzyć kont w kontenerze Dimundi.
- Additional IP `51.68.128.220`: użytkownik potwierdził przypisanie do VPS i reverse DNS `poczta.whatthefrog.pl`. DNS A/PTR do niezależnego sprawdzenia.
- Debian: `ens3`, DHCP IPv4, Netplan + systemd-networkd. Dodatkowego IP nie było w pokazanym wyniku `ip addr`.
- Do dodania `/etc/netplan/60-whatthefrog.yaml` (root, 600):

```yaml
network:
  version: 2
  ethernets:
    ens3:
      addresses:
        - 51.68.128.220/32
```

Plik uzupełnia `50-cloud-init.yaml`. Użytkownik potwierdził akceptację `netplan try` i obecność obu IPv4 na `ens3`. Test HTTPS z wymuszonym źródłem `51.68.128.220` otrzymał HTTP 200; treść odpowiedzi z publicznym IP była ucięta.

Compose ustawia SNAT sieci pocztowej przez `com.docker.network.host_ipv4: 51.68.128.220` ([Docker](https://docs.docker.com/engine/network/port-publishing/)). DMS korzysta tylko z tej sieci; Roundcube jest też w sieci proxy. Faktyczne IP wysyłki wymaga sprawdzenia na VPS.

## Uruchomienie

2026-09-21: użytkownik uruchomił oba kontenery. `whatthefrog-mail-mailserver-1` healthy, porty 25/465/587/993 przypisane do `51.68.128.220`; Roundcube działa. RAM po starcie: 3,7 GiB ogółem, 2,6 GiB użyte, 1,1 GiB dostępne; brak swapu. Do sprawdzenia: IP wyjściowe, logowanie, DNS i dostarczanie. MX jeszcze nieprzełączone w ramach tej procedury.

1. DNS A `poczta.whatthefrog.pl` i `webmail.whatthefrog.pl` → `51.68.128.220`; PTR → `poczta.whatthefrog.pl`. MX nadal OVH.
2. Tymczasowo `ENABLE_CLAMAV=0` tylko dla WhatTheFrog; Rspamd aktywny. Pomiar: RAM 3,7 GiB, dostępne 1,7 GiB, DMS Dimundi 1,505 GiB. Użytkownik zapowiada upgrade za 2–3 dni. Po starcie sprawdzić `free -h` i `docker stats --no-stream` przed kopiowaniem i zmianą MX.
3. Lokalnie, z katalogu repo:

```powershell
.\poczta\whatthefrog\deploy\install.bat
```

Potwierdź `t`. Następnie na VPS jako `docker`:

```sh
cd /home/docker/dimundi/whatthefrog/deploy
bash build.sh
```

Odpowiedzi `t/n`: przygotowanie i pobranie obrazów, bez startu.

```sh
bash setup-tls.sh
bash accounts.sh
bash build.sh
```

TLS: próba, certyfikat, HTTPS. Konta: dwa hasła w monicie i przekierowania. Drugie `build.sh`: `t/t`. Proxy dostaje osobny plik `mail-conf/whatthefrog.conf` i znacznik `whatthefrog-https.enabled`; konfiguracja Dimundi pozostaje osobno. Wspólny cron odnawia również nowy certyfikat.

4. Sprawdź stan i publiczny adres wyjściowy DMS:

```sh
docker compose ps
docker compose exec -T mailserver curl -4 --fail --silent --show-error --max-time 20 https://api.ipify.org
```

Wynik musi być `51.68.128.220`. Sprawdź logowanie obu kont w `https://webmail.whatthefrog.pl`.

5. `bash dkim.sh` generuje selektor `whatthefrog2026`. Opublikuj pokazany TXT. Rozszerz istniejący SPF o `ip4:51.68.128.220`, zachowując OVH; nie twórz drugiego SPF. Sprawdź istniejący DMARC przed zmianą. Test wysyłki: IP nadawcy, SPF/DKIM/DMARC, TLS. Test odbioru do kont i catch-all oraz odmowy relay przed przełączeniem MX.
6. Migracja IMAP `ex5.mail.ovh.net`: źródło biuro → cel marcin, bez kosza. Narzędzie i dokładna nazwa folderu kosza jeszcze do ustalenia. Po kopii i weryfikacji przełączenie MX, końcowe dogranie i test odbioru. Nie uruchamiać skryptów archiwalnej migracji Dimundi.

## Po zwiększeniu RAM

W repo ustaw `ENABLE_CLAMAV=1` w `poczta/whatthefrog/deploy/mailserver.env`, wyślij przez `install.bat`. Na VPS jako `docker`:

```sh
cd /home/docker/dimundi/whatthefrog/deploy
docker compose up -d --no-deps --force-recreate mailserver
docker compose exec mailserver supervisorctl status clamav
docker compose ps
free -h
docker stats --no-stream
```

Poczekaj na start ClamAV i zdrowy kontener. Przywrócenie antywirusa jeszcze niewykonane.

[Wspólna instalacja poczty](../wspolne/email-instalacja.md) · [Serwer i proxy](../wspolne/deploy.md)

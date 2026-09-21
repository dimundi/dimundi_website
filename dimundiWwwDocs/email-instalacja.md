# Poczta — instalacja od zera

Krótka kolejność ponownego postawienia naszego środowiska, **nie procedura odtwarzania backupu**. Konfiguracja i bieżący stan: [email.md](email.md). Polecenia `.bat` uruchamiamy lokalnie, `.sh` na VPS jako `docker`. Potwierdzenia: `t/n`; po błędzie nie przechodzimy dalej.

## 1. Przygotuj VPS i lokalną konfigurację

- Debian 13: aktualizacje, wymagany restart; sprawdź `systemctl --failed`.
- Zainstaluj Docker Engine, Compose i `cron`. Sprawdź `sudo docker run --rm hello-world` oraz `docker compose version`.
- Przygotuj użytkownika `docker`, dostęp SSH kluczem i uprawnienia do Dockera. Utwórz `/home/docker/dimundi`. Zachowaj dostęp administracyjny przez `debian`.
- Lokalnie przygotuj `deploy.config` według `deploy.config_tmp` (`SSH_KEY`). Repo i skrypty są na komputerze; pliki przesyłamy SSH/SCP.
- Skrypty zakładają IP `145.239.92.71`, domeny Dimundi i ścieżki `/home/docker/dimundi`. Przy innym VPS dostosuj adresy w instalatorach i bindy portów `poczta/deploy/compose.yml` **przed wysyłką**.

## 2. Przygotuj DNS i proxy

- A `poczta.dimundi.com` i `webmail.dimundi.com` → IP nowego VPS. Nie dodawaj AAAA dla poczty, dopóki nie obsługujemy jej po IPv6.
- W panelu OVH ustaw reverse DNS/PTR nowego IPv4 na `poczta.dimundi.com`; sprawdź zgodność z rekordem A.
- Zapewnij dostęp do TCP 80/443 dla proxy oraz 25/465/587/993 dla poczty, także wysyłanie z VPS na TCP 25.
- Przygotuj proxy według [deploy.md](deploy.md). Konfiguracja repo obsługuje również stronę; jej wdrożenie jest opisane tam osobno.
- **Przy migracji działającej poczty nie zmieniaj jeszcze MX ani starego rekordu `mail`.**

Z katalogu głównego repo w lokalnym PowerShell:

```powershell
.\proxy\deploy_proxy\install-proxy.bat
```

Odpowiedz `t/t/n` (konfiguracja, skrypty, bez reload). Na VPS:

```sh
cd /home/docker/dimundi/proxy
bash build-proxy.sh
```

Odpowiedz `t/t`. Powstaje sieć `dimundi-proxy_default` i montowanie `mail-conf` wymagane przez pocztę.

Na całkiem nowym VPS dokończ także uruchomienie strony i jej HTTPS według `deploy.md` (`setup-https.sh` w katalogu proxy). Instalator crona wymaga znacznika `proxy/https.enabled`, tworzonego przez ten skrypt; sam certyfikat poczty tworzy inny znacznik, w `mail-conf/`. Przy już działającej stronie ten etap jest wykonany.

## 3. Wyślij i przygotuj pocztę

Lokalnie:

```powershell
.\poczta\deploy\install.bat
```

Odpowiedz `t`. Na VPS:

```sh
cd /home/docker/dimundi/poczta/deploy
bash build.sh
```

Odpowiedzi **`t/n`**: przygotuj katalogi i pobierz obrazy, jeszcze nie uruchamiaj usług.

## 4. Wystaw certyfikat i utwórz konta

Nadal na VPS, w `/home/docker/dimundi/poczta/deploy`:

```sh
bash setup-tls.sh
bash accounts.sh
bash build.sh
```

- `setup-tls.sh`: zatwierdź HTTP-01, wpisz e-mail Let's Encrypt, zaakceptuj warunki i próbę; dopiero po sukcesie zatwierdź certyfikat produkcyjny i HTTPS. Certyfikat obejmie pocztę i webmail. Do startu Roundcube odpowiedź 502 jest spodziewana.
- `accounts.sh`: utwórz Marcina i Beatę, podając hasła w ukrytym monicie; zatwierdź aliasy. Hasła nie muszą być takie jak na starym serwerze. Przy powtórzeniu nie twórz ponownie istniejących kont.
- `build.sh`: tym razem **`t/t`**. Poczekaj na zdrowe kontenery; start ClamAV może potrwać kilka minut.

## 5. Ustaw podpisy i DNS nadawcy

```sh
bash dkim.sh
```

Zatwierdź `t`, następnie w DNS:

| Domena | Rekord |
| --- | --- |
| `dimundi.com` | TXT `dimundi2026._domainkey` = publiczny klucz pokazany dla **dimundi.com** |
| `dimundi.pl` | TXT `dimundi2026._domainkey` = publiczny klucz pokazany dla **dimundi.pl** |
| Obie | Jeden rekord SPF, uwzględniający `ip4:145.239.92.71` |
| Obie | TXT `_dmarc` = `v=DMARC1; p=none` na etap uruchomienia |

Nie zamieniaj kluczy domen. Przy migracji rozszerz istniejący SPF, zachowując dotychczasowych nadawców; nie twórz drugiego SPF i nie usuwaj starego selektora DKIM. Dla zupełnie nowej domeny wysyłającej wyłącznie z tego VPS początkowy SPF: `v=spf1 ip4:145.239.92.71 ~all`.

## 6. Włącz automatyczne odnawianie

Jeśli brak `cron`, z konta `debian`: `sudo apt-get install cron`, następnie `sudo systemctl enable --now cron`. Jako `docker`:

```sh
cd /home/docker/dimundi/proxy
bash install-renewal.sh
bash renew-cert.sh --dry-run
crontab -l
```

Potwierdź instalację zadania `t`. Sprawdź wpis na 03:17 i 15:17 oraz poprawną próbę odnowienia. Istniejący wpis z oznaczeniem `dimundi-cert-renew` instalator pozostawia bez zmian, nie dubluje go. Log: `renew-cert.log`.

## 7. Sprawdź działanie przed przełączeniem

Nowa instalacja pobiera progi Fail2Ban z `poczta/deploy/fail2ban-jail.cf`: SMTP/IMAP 6 błędów / 10 min, blokady od 15 min z podwajaniem do 24 h. Dla istniejącego wdrożenia wystarczy przesłać ten plik i przeładować Fail2Ban — bez nowego skryptu wdrożeniowego i bez restartu kontenerów.

Lokalnie, PowerShell w katalogu repo (klucz z `deploy.config`):

```powershell
scp -i ((Select-String -Path .\deploy.config -Pattern '^SSH_KEY=').Line -replace '^SSH_KEY=', '') .\poczta\deploy\fail2ban-jail.cf docker@145.239.92.71:/home/docker/dimundi/poczta/deploy/fail2ban-jail.cf
```

Na VPS jako `docker`, po poprawnym przesłaniu:

```sh
cd ~/dimundi/poczta/deploy
docker compose exec mailserver sh -c 'cp /tmp/docker-mailserver/fail2ban-jail.cf /etc/fail2ban/jail.d/user-jail.local && fail2ban-client -t && fail2ban-client reload'
```

Kontrola: `docker compose exec mailserver fail2ban-client get postfix bantime` → `900`, `get postfix findtime` → `600`, `get postfix bantime.increment` → `True`; analogicznie dla `dovecot`. Nie resetujemy historii ani istniejących blokad.

```sh
cd /home/docker/dimundi/poczta/deploy
docker compose ps
docker compose logs --tail=100 mailserver roundcube
```

- Zaloguj obie skrzynki w `https://webmail.dimundi.com` pełnymi adresami. W programie pocztowym: IMAP `poczta.dimundi.com:993` SSL/TLS; SMTP ten sam host, 465 SSL/TLS lub 587 STARTTLS, z uwierzytelnieniem.
- Wyślij test do Gmail i sprawdź oryginalne nagłówki: SPF/DKIM/DMARC = `pass`.
- Sprawdź odbiór bezpośrednio na nowym SMTP z zewnętrznej sieci oraz odmowę przekazywania poczty do obcych domen bez uwierzytelnienia. MX nadal może wskazywać stary serwer, więc zwykły mail testowy na domenę jeszcze nie sprawdza nowego odbioru.
- Wyjątek Fail2Ban dla Roundcube i limit POST Nginx są już w plikach konfiguracji; nie wymagają osobnego skryptu naprawczego.

## 8. Przenieś wiadomości i przełącz odbiór

### Dodatkowe konto biuro, formularz i catch-all

Po utworzeniu podstawowych kont uruchom `bash add-account.sh` dla `biuro`, z aliasem `.pl`. Docelowe przekierowania zapisano w `poczta/deploy/postfix-virtual.cf`: biuro i nieznane adresy obu domen do Marcina, bez kopii w biurze. Po wysłaniu przez `install.bat` porównaj plik z `../data/config/postfix-virtual.cf`; zachowaj dodatkowe aliasy i kopię starego pliku przed zastosowaniem zmian. Jawne mapowania Beaty i Marcina na siebie są konieczne przed catch-all. Konta tworzone później aktualnym `add-account.sh` dostają taki wyjątek automatycznie. Nie uruchamiaj ponownie tworzenia istniejących kont.

Formularz: ustaw wartości ze wzoru `backend/.env_tmpl` w produkcyjnym `app/backend/.env`, z prawdziwym hasłem biura i dotychczasowym telefonem. W `app/deploy` uruchom `docker compose up -d --no-deps --force-recreate backend`. Sprawdź formularz, przekierowania, dostarczanie do Beaty i brak kopii w biurze. Status wdrożenia zapisujemy w [email.md](email.md).

Kopie obu skrzynek zostały przeniesione i zweryfikowane: Beata 3463 wiadomości; Marcin 20 751 przeniesionych + 3 wcześniejsze = 20 754 w celu. Potwierdzono zgodne treści, foldery, daty i flagi. **Migracja zakończona, MX obu domen przełączone. Końcowe dogrywanie pominięto na życzenie użytkownika: sprawdził, że po kopiowaniu przyszedł tylko spam.** Skrypty `poczta/archiwum/migration/migrate-beata.ps1` oraz `migrate-marcin.ps1` uruchamia się lokalnie w PowerShell, z osobnymi potwierdzeniami `t/n`. Są przypisane do konkretnych kopii z 2026-09-20 i ich SHA-256; przy kolejnej migracji wymagają dostosowania. Szczegóły w [email.md](email.md).

1. Zrób i zweryfikuj kopie starej poczty poza VPS: skrypty `poczta/archiwum/backup/backup-beata.ps1` i `backup-marcin.ps1`, parametr `-Python <python.exe>`; docelowo `D:\Backup\Dimundi-poczta`. Każda skrzynka własnym kontem SSH, bez kosza.
2. Skopiuj wiadomości na nowy serwer, sprawdź foldery, liczby wiadomości i próbki załączników. Nie usuwaj źródła. Lokalne archiwa Maildir to kopie zabezpieczające, nie wykonana migracja do DMS.
   Dla zapisanej kopii Marcina przygotowano `poczta/archiwum/migration/migrate-marcin.ps1`; kontroluje miejsce przed wysłaniem, wymaga `t/n`, używa tej samej metody Dovecot i raportu zgodności co skrypt Beaty. Nie zmienia MX. Skrypty są przypisane do konkretnych kopii z 2026-09-20.
3. Po testach ustaw MX obu domen na `poczta.dimundi.com` (np. priorytet 10). Sprawdź odbiór z zewnątrz do obu skrzynek i aliasów `.pl`.
4. Po propagacji DNS sprawdź wiadomości trafiające jeszcze na stary serwer i dograj potrzebne. W tej migracji użytkownik świadomie zrezygnował z dogrywania, ponieważ znalazł tylko spam. Po kontroli można zakończyć obsługę starego serwera i uporządkować SPF; to osobny etap.
5. Ustal cykliczną, spójną kopię **nowego** środowiska poza VPS: dane poczty, konta/aliasy/DKIM, baza SQLite Roundcube i klucz, certyfikaty. Sprawdź odtwarzanie. Sama kopia starego Maildir nie obejmuje tych elementów.

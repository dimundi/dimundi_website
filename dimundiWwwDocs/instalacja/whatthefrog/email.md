# WhatTheFrog — migracja poczty

## Stan aktualny i punkt wznowienia — 2026-10-20

Końcowe przełączenie starej domeny odłożone na życzenie użytkownika: najpierw dokończenie i wdrożenie nowej strony WTF oraz wyłączenie starej strony i jej mechanizmów wysyłania poczty. Nie zmieniać teraz MX starej domeny ani nie wyłączać OVH Exchange.

| Obszar | Stan |
| --- | --- |
| `whathefrog.pl` | SMTP/IMAP `poczta.whathefrog.pl`, IP `51.38.158.255`; wysyłka i odbiór działają, Thunderbird i webmail potwierdzone |
| Gmail — nowa domena | Wiadomość przyjęta do spamu; SPF/DKIM/DMARC `pass`; odpowiedź odebrana |
| `whatthefrog.pl` — stara usługa | MX nadal OVH; istniejący odbiór i konfiguracja wysyłki OVH niezmienione. Ostatni test do Gmaila odrzucony `550 5.7.1`; brak nowszego potwierdzenia dostarczalności |
| Routing na VPS | Adresy i catch-all obu domen → `marcin@whathefrog.pl`; nowy Marcin uprawniony do wysyłki z obu domen. Ten routing nie przejmuje jeszcze poczty przychodzącej na stary MX OVH |
| Migracja wiadomości | 6449 wiadomości OVH bez kosza przeniesionych i zweryfikowanych; 6451 w celu przy zakończeniu importu. Późniejsze wiadomości OVH wymagają końcowego dogrania |
| Kopia lokalna | `D:\Backup\WhatTheFrog-poczta\OVH-biuro-20261020-092148\IMAP.tar.gz`; zachować |
| Dimundi | Działająca poczta, bez restartu jej kontenerów podczas prac WhatTheFrog |

Użytkownik zgłosił wcześniejsze ataki na starą stronę i wykorzystywanie jej do spamu. Możliwy wpływ na reputację domeny pozostaje hipotezą, bez potwierdzonej diagnozy. Nie podłączać hasła nowego konta SMTP do starej strony.

Kolejność wznowienia:

1. Dokończyć i wdrożyć nową stronę WTF; wyłączyć starą stronę, zadania i mechanizmy wysyłania wiadomości. Zweryfikować używane wcześniej dostępy SMTP.
2. Podłączyć formularze nowej strony do `biuro@whathefrog.pl`, wykonać testy.
3. Uzupełnić SPF `whatthefrog.pl` o nowe IP, przełączyć jej MX i skoordynować A starego hosta SMTP z konfiguracją klientów. Potwierdzić odbiór obu domen, aliasy, catch-all oraz wysyłkę.
4. Po propagacji dograć nowe wiadomości OVH od czasu kopii, z kontrolą duplikatów i pominięciem kosza. Zachować wiadomości znajdujące się wyłącznie w starych lokalnych kontach VPS.
5. Po weryfikacji wyłączyć starą usługę OVH Exchange. Nie wyłączać obsługi adresów ani wysyłki `@whatthefrog.pl` na docelowym serwerze.
6. Po końcowych testach usunąć tymczasową kopię ustawień, staging migracji, nieudaną próbę kopii i tymczasowe pliki haseł; zachować pełną kopię lokalną. Zwolnić jeden stary Additional IP po przeniesieniu wszystkich usług i DNS. Dokładne lokalizacje plików roboczych zapisano niżej.

Poniższe szczegółowe wpisy opisują przebieg prac; powyższy stan i kolejność wznowienia zastępują wcześniejsze plany.

Sprzątanie skryptów: usunięto jednorazowe `migrate-ovh.sh`, `prepare-ovh-maildir.py`, `verify-ovh-result.py` z repo i robocze kopie z VPS/kontenera, także roboczą kopię `verify-maildir.py`. Historyczne wzmianki o tych skryptach poniżej dotyczą wykonanego importu. Zachowano `poczta/whatthefrog/backup/`, skrypty wdrożeniowe, archiwalne narzędzia Dimundi oraz archiwa, snapshoty i raporty. Końcowe dogranie OVH wymaga przygotowania oddzielnej synchronizacji przy wznowieniu; nie uruchamiać ponownie pełnego importu kopii z 2026-10-20.

## Ustalenia i plan — 2026-10-20

### Domeny i konta

| Element | Stan / ustalenie |
| --- | --- |
| Nowa domena | `whathefrog.pl` — użytkownik potwierdził utworzenie; nazwa bez drugiego `t` w dotychczasowym `whatthefrog.pl` |
| Domena główna poczty | `whathefrog.pl`; docelowy adres nadawcy przy wysyłaniu i odpowiadaniu |
| Dotychczasowa domena | `whatthefrog.pl` pozostaje w użyciu; routing do nowej skrzynki aktywny na VPS, ale MX nadal OVH |
| Docelowe przechowywanie poczty | Dotychczasowa poczta bez kosza przeniesiona do `marcin@whathefrog.pl`; końcowe dogranie i wyłączenie OVH dopiero po wdrożeniu nowej strony i testach |
| Istniejące konta VPS | `marcin@whatthefrog.pl`, `biuro@whatthefrog.pl` |
| Docelowe konta | `marcin@whathefrog.pl` — główna skrzynka; `biuro@whathefrog.pl` — osobne konto z hasłem SMTP dla formularzy, odbiór przekierowany do Marcina bez lokalnej kopii |
| Docelowi nadawcy / aliasy | `biuro@whathefrog.pl`, `marcin@whatthefrog.pl`, `biuro@whatthefrog.pl` → `marcin@whathefrog.pl`; zachowana wysyłka i odbiór obu domen |
| Tymczasowe konto Dimundi | `whatthefrog@dimundi.com`, alias `whatthefrog@dimundi.pl`; utworzenie i logowanie potwierdzone |
| Webmaile docelowe | `https://webmail.whathefrog.pl` i `https://webmail.whatthefrog.pl`; jedna instancja Roundcube, ta sama skrzynka, dostęp awaryjny |
| Strona WWW | Po uruchomieniu strony WhatTheFrog obie domeny mają kierować do niej; domena kanoniczna i docelowy URL do ustalenia |

### Stan techniczny — testy 2026-10-19

Aktualizacja przygotowania nowej domeny — 2026-10-20:

- Nowe Additional IP: `51.38.158.255`; docelowa nazwa SMTP/IMAP `poczta.whathefrog.pl`.
- Odczyt DNS przez `1.1.1.1`: A `poczta.whathefrog.pl` → `51.38.158.255`, PTR `51.38.158.255` → `poczta.whathefrog.pl`; zgodność potwierdzona.
- Docelowo jedna skrzynka `marcin@whathefrog.pl`, `biuro@whathefrog.pl` jako alias do niej — potwierdzone przez użytkownika.
- Nowe IP dodane na `ens3` przez `/etc/netplan/62-whathefrog.yaml` (root, 600), `51.38.158.255/32`. `netplan generate` poprawny; `netplan try` zatwierdzony po kontroli drugiego połączenia SSH i testu HTTPS ze źródłem `51.38.158.255` (publiczne IP zgodne). Konfiguracja kontenerów nowej domeny jeszcze niewdrożona. Po zakończeniu migracji zwolnić jeden ze starych Additional IP (`51.68.128.220` lub `54.38.134.226`), po przeniesieniu usług i DNS.

- MX `whatthefrog.pl` nadal wskazuje OVH; migracja wiadomości na VPS nie została wykonana.
- Gmail odrzucił wysyłkę OVH z `46.105.41.88` i VPS z `54.38.134.226`: `550 5.7.1`, `likely unsolicited mail`.
- Wysyłka `whatthefrog@dimundi.com` z `145.239.92.71` została przyjęta do spamu; Gmail potwierdził SPF/DKIM/DMARC `pass`.
- Docelowa wysyłka: `51.38.158.255`, hostname SMTP `poczta.whathefrog.pl`; jedna skrzynka, aliasy obu domen. Na VPS wdrożono wyłącznie nowe IP; konfiguracja poczty przygotowana lokalnie, jeszcze niewdrożona.

### Przygotowana konfiguracja — 2026-10-20

- Użytkownik potwierdził zawartość poczty po imporcie i działanie Thunderbirda. Włączono aktywny routing: jawne adresy `marcin`, `biuro`, `postmaster`, `abuse` i catch-all obu domen → `marcin@whathefrog.pl`. Stare konta zachowane; dodatkowe aliasy zachowywane przy scalaniu. Mapy Postfix potwierdzone; `smtpd_sender_login_maps` zezwala nowemu Marcinowi na wysyłkę jako Marcin/biuro obu domen, a konto SMTP biura zachowuje prawo do własnego adresu. Kopia poprzedniego routingu: `migration/ovh-20261020/routing-before-1792483446.cf`, do późniejszego sprzątania. MX starej domeny niezmieniony; przed wysyłką starej domeny z nowego IP dopisać `ip4:51.38.158.255` do jej istniejącego SPF, zachowując OVH do końca migracji.
- Import kopii OVH do `marcin@whathefrog.pl` zakończony i zweryfikowany: 6449 wiadomości źródłowych + 2 zastane = 6451 w celu. Źródło OVH niezmienione; kosz pominięty, spam zachowany. Przed importem utworzono `target-before.tar.gz` i `target-before.json` w katalogu migracji. Pierwszy raport porównujący surowe bajty zgłosił różnice: Dovecot skonwertował CRLF do LF. Końcowy raport `verification-normalized.json`: status `verified`, brak brakujących treści, różnic dat/flag, zmian snapshotu źródła i utraty zastanych wiadomości; porównanie SHA-256 po wyłącznie normalizacji CRLF/LF. Utworzono znacznik `COMPLETE`. Lokalna kopia zachowuje oryginalne bajty EML. Do wykonania: kontrola użytkownika w webmailu/programie, przeniesienie testowych wiadomości ze starej lokalnej skrzynki, routing i MX starej domeny, końcowe dogranie nowych wiadomości OVH, wyłączenie OVH oraz sprzątanie plików roboczych.
- Archiwum przesłane do `/home/docker/dimundi/whatthefrog/migration/ovh-20261020/IMAP.tar.gz` (katalog 700, archiwum 600); SHA-256 zgodne z kopią lokalną. W kontenerze wykonano wyłącznie tryb `prepare`: `/tmp/whathefrog-ovh-20261020/source/Maildir`, 6449 wiadomości, wszystkie treści sprawdzone względem SHA-256 manifestów; foldery, daty, flagi i słowa kluczowe odtworzone. Snapshot źródła potwierdził 6449 wiadomości. Skrzynka produkcyjna i OVH bez zmian. Import wymaga osobnej zgody; staging hosta/kontenera do późniejszego usunięcia po weryfikacji migracji.
- Migracja OVH przygotowana lokalnie w `poczta/whatthefrog/migration/`: konwersja archiwum EML do osobnego Maildir z kontrolą SHA-256 każdej wiadomości, długości, folderów, dat i flag; test syntetyczny poprawny. `migrate-ovh.sh prepare` przygotowuje wyłącznie staging; osobny tryb `import` wymaga potwierdzenia. Docelowa metoda: jednokierunkowy `doveadm sync -1 -R`, z kopią zastanej skrzynki i porównaniem treści/metadanych po imporcie. Zachowuje wiadomości istniejące wyłącznie w celu. Jeszcze nie wysłano archiwum na VPS ani nie wykonano importu. Docelowy staging: host `/home/docker/dimundi/whatthefrog/migration/ovh-20261020`, kontener `/tmp/whathefrog-ovh-20261020`; do usunięcia po migracji i weryfikacji, z zachowaniem kopii lokalnej.
- Kopia OVH poza VPS zakończona: `D:\Backup\WhatTheFrog-poczta\OVH-biuro-20261020-092148\IMAP.tar.gz`, 6449 wiadomości, 2 022 135 555 B treści, archiwum 1 354 667 299 B. Bez `Trash` i `Elementy usunięte` oraz ich podfolderów; spam uwzględniony. To wyłączenie obowiązuje również migrację. Odczyt źródła IMAP read-only / BODY.PEEK; bez usuwania i zmiany flag. Archiwum TAR/gzip odczytane, liczba EML zgodna z raportem; SHA-256 `f55d34199e22451b902e5e2441e15ddee5d810d1b89392ef1c978d43cd96a9c3`. Obok `report.json`, `SHA256SUMS.txt`, `transfer.log`; wewnątrz oryginalne EML i manifesty UID/UIDVALIDITY, dat, flag i SHA-256 każdej wiadomości. OVH Exchange zwraca rozmiary RFC822.SIZE różne od faktycznej treści; zweryfikowano długość literal transferu, zachowano oba rozmiary. Pierwsza nieudana próba pozostawiła niekompletny katalog `OVH-biuro-20261020-092030` do późniejszego usunięcia. Skrypty: `poczta/whatthefrog/backup/`; migracja do DMS jeszcze niewykonana.
- Odbiór nowej domeny: użytkownik potwierdził dostarczenie odpowiedzi z Gmaila do nowej skrzynki.
- Inwentaryzacja źródła OVH `biuro@whatthefrog.pl`: logowanie IMAP/TLS poprawne, foldery otwierane tylko do odczytu, pobrano wyłącznie metadane. Łącznie 15 468 wiadomości, 2 711 232 520 B (2,525 GiB). INBOX 2043; Sent 699; Allegro 1695; Kurzołaki 194; WawaGra 36; Aleplanszowki 19; Archives 1; Archives/2024 1; Drafts 4; Elementy wysłane 2; Elementy usunięte 97; Trash 8922; Wiadomości-śmieci 1755. Pozostałe foldery puste. Niczego nie kopiowano ani nie usuwano. Aktualne ustalenie obejmuje całą pocztę, także kosz i spam. Wolne miejsce VPS około 19 GB; lokalny Maildir WhatTheFrog 616 KiB. Pełna kopia poza VPS i migracja nadal do wykonania.
- MX nowej domeny `whathefrog.pl` przełączony przez użytkownika: jeden rekord `10 poczta.whathefrog.pl`, potwierdzony przez `1.1.1.1` i `8.8.8.8`; A hosta → `51.38.158.255`. Test faktycznego odbioru odpowiedzi z Gmaila nadal do wykonania. MX starej domeny pozostaje osobnym etapem migracji.
- Test Gmail 2026-10-20 08:56 CEST: `marcin@whathefrog.pl` z `51.38.158.255`, hostname `poczta.whathefrog.pl`, TLS 1.3; Gmail przyjął wiadomość do spamu. Nagłówki Google: SPF `pass`, DKIM `pass` (selektor `whathefrog2026`), DMARC `pass`. Temat `proba maila`, treść `helo world`. Dokładna przyczyna klasyfikacji spam nie wynika z nagłówków; reputacja nowej domeny/IP niepotwierdzona. Test nie potwierdza jeszcze odbioru przez MX ani dostarczalności do folderu Odebrane.
- Przełączono kontenery i odtworzono prywatną sieć WhatTheFrog bez usuwania danych: SMTP/IMAP bind `51.38.158.255`, hostname/TLS `poczta.whathefrog.pl`. Mailserver healthy, Roundcube uruchomiony. Publiczne IP z kontenera: `51.38.158.255`. TLS IMAP 993 i SMTP STARTTLS 587: weryfikacja certyfikatu/nazwy poprawna. Oba webmaile oraz kontrolnie webmail Dimundi: HTTPS 200. Kontenery Dimundi/proxy zachowały poprzedni uptime. MX obu domen, routing starej domeny i migracja wiadomości jeszcze nieprzełączone. Stary host SMTP `poczta.whatthefrog.pl` nadal wymaga skoordynowanej zmiany A na nowe IP, aby dotychczasowi klienci mogli używać starej nazwy.
- Włączono konfigurację DKIM obu domen w aktywnym i trwałym pliku Rspamd. Oba klucze obecne; `rspamadm configtest` poprawny, HUP wykonany, `configdump dkim_signing` potwierdził selektory `whathefrog2026` i `whatthefrog2026`. SPF nowej domeny `v=spf1 include:mx.ovh.com ip4:51.38.158.255 -all`, DMARC `v=DMARC1; p=none` i publiczny DKIM widoczne w DNS. Podpis rzeczywistej wysyłki do sprawdzenia po przełączeniu IP kontenerów.
- Zmiana ustalenia: biuro nowej domeny jest osobnym kontem SMTP dla formularzy, a nie wyłącznie aliasem. Konto `biuro@whathefrog.pl` utworzone; użytkownik w Dovecot i aktywna mapa Postfix `biuro@whathefrog.pl` → `marcin@whathefrog.pl` potwierdzone. Dodano jawne mapowanie nowego Marcina na siebie; stare aliasy zachowane. Losowe hasło początkowe: `/home/docker/dimundi/whatthefrog/secrets/biuro-whathefrog-initial-password` (docker, 600); usunąć po przekazaniu / zmianie hasła i potwierdzeniu dostępu. `accounts.sh` w repo uzupełniony o konto biura; ta poprawka skryptu jeszcze niewysłana na VPS.
- Utworzono `marcin@whathefrog.pl` w istniejącym DMS WhatTheFrog; obecność użytkownika w Dovecot i lista kont potwierdzone po automatycznym przeładowaniu. Losowe hasło początkowe zapisane wyłącznie na VPS w `whatthefrog/secrets/marcin-whathefrog-initial-password` (właściciel docker, 600); usunąć ten plik po przekazaniu hasła / zmianie hasła i potwierdzeniu dostępu. Stare konta i aktywne aliasy niezmienione.
- DKIM nowej domeny wygenerowany na VPS: RSA 2048, selektor `whathefrog2026`, rekord `whathefrog2026._domainkey.whathefrog.pl`. Klucz prywatny pozostaje w `data/config/rspamd/dkim/`; publiczny TXT odczytany. Publikacja i weryfikacja DNS jeszcze do wykonania. Generator zachował istniejący `dkim_signing.conf`; konfiguracja podpisywania obu domen wymaga osobnego zastosowania.
- HTTPS nowego i starego webmaila włączony: `nginx -t` i reload poprawne, testy HTTPS obu adresów zwróciły 200; kontrolny test `webmail.dimundi.com` również 200. Oba adresy WhatTheFrog prowadzą do dotychczasowego Roundcube; konto nowej domeny i przełączenie kontenerów jeszcze niewykonane. Tymczasowy plik `whathefrog-acme.conf` usunięty po połączeniu obsługi HTTP-01 we wspólnej konfiguracji.
- Certyfikat produkcyjny `poczta.whathefrog.pl` wystawiony, ważny do 2027-01-18; SAN: `poczta.whathefrog.pl`, `webmail.whathefrog.pl`, `poczta.whatthefrog.pl`, `webmail.whatthefrog.pl`. Pliki na VPS: `/home/docker/dimundi/proxy/letsencrypt/live/poczta.whathefrog.pl/`. Nowy HTTPS i kontenery poczty jeszcze nieprzełączone. Kontrola odnowienia nowego certyfikatu pozostaje do wykonania.
- TLS: dodano `proxy/mail-conf/whathefrog-acme.conf` dla HTTP-01 nowej domeny; `nginx -t` i reload poprawne. A `webmail.whathefrog.pl` → `51.38.158.255` potwierdzony. Let’s Encrypt `certonly --dry-run` dla `poczta.whathefrog.pl`, `webmail.whathefrog.pl`, `poczta.whatthefrog.pl`, `webmail.whatthefrog.pl` zakończony sukcesem. Certyfikat produkcyjny nowej domeny jeszcze niewystawiony; dotychczasowe usługi pocztowe nieprzełączone.
- Pliki konfiguracji i skrypty przesłane do `/home/docker/dimundi/whatthefrog/deploy/`; walidacja Compose i składni Bash na VPS poprawna. Aktywne kontenery nieodtworzone: nadal stare IP/nazwa, oba DMS healthy. Pliki w `deploy/` opisują już konfigurację docelową; przed wykonaniem `docker compose up` wymagane certyfikat, konto i uzgodnione przełączenie sieci. Aktywne aliasy pozostają bez zmian.
- Przed wdrożeniem wykonano tymczasową kopię ustawień: `/home/docker/dimundi/whatthefrog/config-backup-JlLMZeCp/settings.tar.gz` (root; katalog 700, archiwum 600). Zakres: `whatthefrog/deploy`, `whatthefrog/data/config`, `whatthefrog/secrets`, `proxy/mail-conf`; odczyt listy archiwum poprawny. Nie jest to kopia wiadomości. Na życzenie użytkownika usunąć ten konkretny katalog po udanym wdrożeniu i weryfikacji nowej poczty; zadanie pozostaje otwarte.
- Repo `poczta/whatthefrog/deploy/`: zachowany projekt `whatthefrog-mail`, katalogi danych i sekrety. SMTP/IMAP oraz SNAT sieci Compose przechodzą na `51.38.158.255`; nazwa serwera i TLS: `poczta.whathefrog.pl`.
- `accounts.sh` tworzy konta Marcina i biura nowej domeny; nie usuwa starych kont i nie podmienia aktywnych aliasów. `postfix-virtual.cf` jest wzorem routingu docelowego obu domen, do osobnego zastosowania po kopii i porównaniu aktywnego pliku.
- `SPOOF_PROTECTION=1` pozostaje włączone. Jawne aliasy uprawniają nową skrzynkę do wysyłania ze wskazanych adresów obu domen. Tożsamości Roundcube i dodatkowe adresy nadawcy w programach pocztowych skonfigurować i przetestować osobno; URL webmaila nie wybiera nadawcy. Nowa domena jest domyślna; starej domeny nie wyłączamy.
- DKIM: `whathefrog2026` dla `whathefrog.pl`, zachowany `whatthefrog2026` dla `whatthefrog.pl`; `dkim.sh` obsługuje oba klucze bez regenerowania istniejących.
- TLS: nowy certyfikat `poczta.whathefrog.pl` obejmuje cztery nazwy SMTP/webmail obu domen. `setup-tls.sh` dodaje tymczasowy plik `mail-conf/whathefrog-acme.conf` dla HTTP-01 nowej domeny, zachowując istniejący HTTPS do czasu wystawienia certyfikatu. Po sukcesie zastępuje konfigurację webmaila wspólną i usuwa plik tymczasowy. Przerwana operacja może pozostawić plik HTTP-01; ponowienie skryptu go wykorzystuje.
- Przed TLS dodać A `webmail.whathefrog.pl` → `51.38.158.255`; wszystkie cztery nazwy muszą prowadzić do wspólnego proxy i obsługiwać HTTP-01. Przed zmianą A starego hosta SMTP skoordynować przełączenie portów oraz klientów pocztowych.
- Zmiana `com.docker.network.host_ipv4` wymaga odtworzenia prywatnej sieci projektu: sama rekreacja mailservera nie zmienia SNAT istniejącej sieci. Przy wdrożeniu zaplanować krótką przerwę tylko WhatTheFrog i odtworzenie jego sieci; nie usuwać wolumenów ani danych, nie ruszać sieci proxy i Dimundi. Po starcie sprawdzić rzeczywiste IP wyjściowe z kontenera.
- Weryfikacja lokalna: składnia czterech zmienionych skryptów Bash, `docker compose config --quiet` i `git diff --check` poprawne. Nginx, certyfikaty, aliasy nadawców i rzeczywista wysyłka wymagają kontroli na VPS podczas osobno zatwierdzanego wdrożenia.

### Kolejność prac

1. Konta uzgodnione: główna skrzynka `marcin@whathefrog.pl` oraz konto SMTP `biuro@whathefrog.pl` z przekierowaniem do Marcina; nadawcy obu domen i catch-all obu domen do głównej skrzynki. Przy wdrożeniu porównać istniejące aliasy i zachować dodatkowe wpisy.
2. IP i nazwa uzgodnione: `51.38.158.255`, `poczta.whathefrog.pl`. Konfiguracja przygotowana w repo; wdrożyć po osobnej zgodzie, zachowując działającą pocztę Dimundi i odbiór OVH.
3. Przygotować DNS nowej domeny: A, zgodny PTR dla wybranego IP, jeden SPF, osobny klucz DKIM i DMARC. Skonfigurować TLS oraz oba adresy webmaila i ich odnawianie certyfikatów.
4. Utworzyć konta / aliasy, skonfigurować wysyłkę i odpowiedzi z `@whathefrog.pl`. Sprawdzić IMAP, SMTP, oba webmaile, odmowę relay i dostarczalność do Gmaila wraz z SPF/DKIM/DMARC.
5. Uruchomić odbiór nowej domeny przez MX po testach. Wykonać i zweryfikować kopię starej poczty poza usługą źródłową. Przenieść dotychczasową pocztę i foldery do kont `@whathefrog.pl` według uzgodnionego mapowania, także wiadomości znajdujące się wyłącznie na VPS WhatTheFrog. Na ostateczne życzenie użytkownika kopia i migracja pomijają `Trash`, `Elementy usunięte` i ich podfoldery; spam pozostaje. Sprawdzić liczby wiadomości, foldery i próbki załączników; zachować źródło do zakończenia weryfikacji.
6. Uruchomić przekazywanie poczty `whatthefrog.pl` do `whathefrog.pl`, z zachowaniem adresata i bez pętli. Miejsce przekierowania (OVH lub lokalne aliasy po zmianie MX) dobrać do wybranej konfiguracji. Sprawdzić odbiór na stare i nowe adresy z zewnętrznych usług.
7. Przenieść MX `whatthefrog.pl` z OVH do docelowej infrastruktury i obsługiwać stare adresy lokalnymi aliasami / przekierowaniami do `@whathefrog.pl`, niezależnie od OVH. Po propagacji DNS dograć ostatnie wiadomości z OVH, zweryfikować kompletność migracji i odbiór obu domen. Następnie wyłączyć starą usługę pocztową OVH Exchange. Zachować kopię poza starym serwerem. Dalsze użycie tymczasowego konta Dimundi do ustalenia.
8. Po uruchomieniu strony przygotować HTTPS i przekierowania WWW obu domen na uzgodniony adres strony; konfigurację WWW prowadzić niezależnie od MX i hostów pocztowych.

Poniżej zachowano wcześniejszą konfigurację i historię migracji jednej domeny. Docelowy plan obu domen opisano powyżej.

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

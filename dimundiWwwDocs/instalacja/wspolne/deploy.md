# Wdrożenie

Tutaj zapisujemy ustalenia i uwagi dotyczące wdrożenia projektu. Uzupełniamy ten dokument w miarę podejmowania kolejnych decyzji.

## Ustalenia

- WhatTheFrog: osobny projekt Compose i dane poczty na tym samym VPS, Additional IP `51.68.128.220`; przypisanie IP, PTR i zastosowanie Netplana na `ens3` potwierdzone przez użytkownika. Repo `poczta/whatthefrog/deploy/`, cel `/home/docker/dimundi/whatthefrog/deploy`. 2026-09-21: wykonano TLS i tworzenie kont, oba kontenery działają, DMS healthy. Tymczasowo bez ClamAV do upgrade RAM; IP wyjściowe i działanie poczty do sprawdzenia, migracja nierozpoczęta. Szczegóły: [WhatTheFrog](../whatthefrog/email.md).
- Dimundi: pliki przeniesiono w repo do `poczta/dimundi/deploy/`; instalator nadal wysyła do `/home/docker/dimundi/poczta/deploy` na VPS. Wspólne proxy i odnowienia certyfikatów pozostają w dotychczasowym miejscu.

- Planowanym środowiskiem wdrożenia jest serwer OVH z Dockerem.
- Na serwerze produkcyjnym pliki strony mają znajdować się w katalogu hosta podłączonym do kontenera Nginx przez bind mount.
- Zachować ten sposób udostępniania frontendu również w konfiguracji produkcyjnej. Nie zastępować go kopiowaniem strony do obrazu jako jedynym sposobem wdrożenia.
- Zmiany HTML, CSS, JavaScript oraz wspólnych fragmentów strony mają być możliwe bez przebudowy obrazu kontenera.
- Katalog strony montować w kontenerze tylko do odczytu. Pliki aktualizować po stronie hosta.
- Konfiguracja Nginx musi zachować obsługę SSI i przekazywanie żądań `/api/` do backendu.
- Dane dostępowe i konfigurację środowiska przekazywać przy uruchamianiu; nie umieszczać sekretów w obrazach ani repozytorium.
- W przyszłości na tym samym serwerze ma działać również poczta w osobnych kontenerach. Uwzględniać to przy planowaniu portów, sieci i reverse proxy.
- Reverse proxy: Nginx w osobnym kontenerze. Użytkownik wybrał Nginx, ponieważ już go używa; nie zastępować go Caddy.
- Konfigurację proxy Nginx przechowywać w pliku dołączonym do tego repozytorium i montować do kontenera przez bind mount, tylko do odczytu. Nie zapisywać jej wyłącznie wewnątrz obrazu.
- Aktualizacja konfiguracji proxy nie powinna wymagać przebudowy obrazu. Po zmianie sprawdzić konfigurację przez `nginx -t` i przeładować Nginx; jeśli zmienił się plik źródłowy bind mount przez podmianę pliku, może być konieczne odtworzenie kontenera.
- Certyfikaty i klucze prywatne przechowywać poza repozytorium oraz udostępniać kontenerowi osobnym montowaniem.

## Środowisko testowe

- `build-test.bat` buduje obrazy, a `start-test.bat` uruchamia kontenery w tle.
- Oba skrypty korzystają z `docker-compose-test.yml`, który wskazuje `proxy/Dockerfile-test`, `frontend/Dockerfile-test` i `backend/Dockerfile-test`.
- Strona działa pod `http://localhost:8080`: proxy Nginx przekazuje żądania do frontendu, a frontend przekazuje `/api/` do backendu. Tylko proxy publikuje port hosta, dostępny lokalnie na `127.0.0.1:8080`; frontend i backend komunikują się w sieci Compose.
- Konfiguracja proxy to `proxy/nginx-test.conf`, podłączona jako plik tylko do odczytu. Testy działają przez HTTP, bez certyfikatów.
- Pliki frontendu oraz jego konfiguracja Nginx są podłączone z lokalnego katalogu tylko do odczytu, a backend korzysta z `backend/.env`.
- Dotychczasowe pliki `Dockerfile` i `docker-compose.yml` pozostają jako oryginały; ich kopie testowe nie zmieniają dotychczasowego sposobu działania aplikacji.
- Konfiguracja testowa zachowuje domyślną nazwę projektu Compose, aby obsługiwać dotychczasowe lokalne kontenery. Nie uruchamiać obu konfiguracji jako oddzielnych środowisk na tym samym porcie.

## Wdrożenie proxy

- Pliki produkcyjnego proxy znajdują się w `proxy/deploy_proxy/`; testowe pozostają osobno.
- Obraz proxy budujemy na VPS. To zastępuje wcześniejszy plan lokalnego budowania i przesyłania obrazu `.tar`.
- Na VPS nie używamy Gita. Pliki kopiujemy przez SSH/SCP.
- VPS: Debian 13, amd64, Docker i Docker Compose zainstalowane. SSH: `docker@145.239.92.71`, port 22, uwierzytelnianie kluczem.
- Katalog proxy na serwerze: `/home/docker/dimundi/proxy`.
- `install-proxy.bat` odczytuje `SSH_KEY` z lokalnego pliku `deploy.config` w głównym katalogu projektu. Plik jest ignorowany przez Git. Wzór `deploy.config_tmp` należy skopiować jako `deploy.config` i wpisać pełną ścieżkę do prywatnego klucza OpenSSH, bez cudzysłowów i zmiennych środowiskowych. Brak pliku, wpisu lub klucza zatrzymuje skrypt z komunikatem. Konfiguracja lokalna i klucz nie są wysyłane na serwer. SSH może poprosić o hasło klucza przy każdym połączeniu.
- Logowanie hasłem do konta `debian` ma pozostać dostępne.

### Instalacja z Windows

Uruchom `proxy/deploy_proxy/install-proxy.bat`. Potwierdzenia mają postać `t/n` (wielkość liter nie ma znaczenia); tylko `t` zatwierdza operację. Skrypt pyta osobno:

1. Czy wysłać `nginx.conf`? Tylko `t` rozpoczyna wysyłanie; inna odpowiedź kończy skrypt.
2. Czy wysłać również `Dockerfile`, `compose.yml` i `build-proxy.sh`? `n` pomija ten etap i przechodzi do kolejnego pytania.
3. Czy sprawdzić i przeładować konfigurację działającego proxy? Tylko `t` uruchamia `nginx -t`, a po jego sukcesie `nginx -s reload`.

Skrypt zachowuje poprzednią konfigurację jako `nginx.conf.bak` i zapisuje nową w istniejącym pliku, zachowując inode bind mount. Błąd walidacji blokuje reload, ale błędny plik pozostaje na dysku: popraw go przed restartem kontenera albo przywróć przez `cat nginx.conf.bak > nginx.conf`, sprawdź i przeładuj ponownie. Kopia `.bak` jest zastępowana przy kolejnym wysłaniu.

Przeładowanie wymaga działającego kontenera. Przy pierwszej instalacji odpowiedz `n` na trzecie pytanie i uruchom na VPS:

```sh
cd /home/docker/dimundi/proxy
bash build-proxy.sh
```

Skrypt serwerowy pyta o budowanie, buduje obraz, sprawdza konfigurację w tymczasowym kontenerze i osobno pyta o uruchomienie/odtworzenie kontenera. `n` kończy dany proces bez uruchamiania. Zmiany `Dockerfile` lub Compose wymagają ręcznego uruchomienia tego skryptu; sam reload stosuje wyłącznie konfigurację Nginx.

### Początkowy zakres

- Oddzielny projekt Compose `dimundi-proxy`, port 80, konfiguracja Nginx jako bind mount tylko do odczytu.
- Proxy HTTP pod `http://vps-f9b377ab.vps.ovh.net` zostało uruchomione przez użytkownika z odpowiedzią „Proxy działa”. Nowa lokalna konfiguracja przekazuje ruch do `dimundi-frontend`; wyślij ją dopiero po uruchomieniu aplikacji.
- Domena główna: `dimundi.com`. `www.dimundi.com`, `dimundi.pl` i `www.dimundi.pl` przekierowują na `https://dimundi.com` z zachowaniem ścieżki i parametrów. Użytkownik zgłosił zmianę DNS na VPS; propagację trzeba zweryfikować przed certyfikatem.
- Frontend jest przesyłany jako pliki do katalogu hosta, montowane tylko do odczytu.

## Wdrożenie aplikacji

Pliki znajdują się w głównym katalogu `deploy/`: `install.bat`, `build.sh`, `compose.yml`, `Dockerfile-frontend` i `nginx.conf`. Backend jest budowany z istniejącego `backend/Dockerfile`.

### Podział konfiguracji backendu

- `deploy/backend.env`: wersjonowany i wysyłany przy wdrożeniu; `PORT`, `CORS_ORIGIN`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `TURNSTILE_HOSTNAMES`. Bez haseł, kluczy i danych kontaktowych.
- `/home/docker/dimundi/app/backend/.env`: prywatny, tylko na VPS; `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `MAIL_TO`, `CONTACT_EMAIL`, `CONTACT_PHONE`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`. Nie jest dotykany przez instalator.
- Compose ładuje najpierw plik ogólny, potem prywatny. Istniejący `.env` pozostaje działający bez przenoszenia sekretów. Jeżeli zawiera też zmienne ogólne, nadal je nadpisuje — usuń daną zmienną z prywatnego pliku dopiero, gdy chcesz zarządzać nią przez `deploy/backend.env`.
- Pierwsza instalacja: po wysłaniu plików utwórz prywatny plik bezpośrednio na VPS (`umask 077`, następnie `nano /home/docker/dimundi/app/backend/.env`) i uzupełnij wskazane wyżej wartości. Ustaw `chmod 600 /home/docker/dimundi/app/backend/.env`. Nie zastępuj istniejącego pliku szablonem.
- Brak któregokolwiek pliku zatrzymuje `build.sh`. Zmiany przygotowane w repo; zastosowanie wymaga wysłania nowego Compose i uruchomienia skryptu na VPS. Lokalny Compose testowy nadal korzysta z lokalnego `backend/.env`.

### Procedura krok po kroku — działające proxy, pierwsze wdrożenie strony

Punktem wyjścia jest działające proxy z napisem „Proxy działa”. Poniższe polecenia lokalne wykonuj w PowerShell w głównym katalogu projektu; polecenia serwerowe w sesji SSH użytkownika `docker`.

**1. Lokalnie: sprawdź konfigurację.**

Plik `deploy.config` musi zawierać `SSH_KEY` ze ścieżką do klucza. Jeśli go brakuje, skopiuj `deploy.config_tmp` jako `deploy.config` i uzupełnij ścieżkę. Sprawdź ustawienia ogólne w `deploy/backend.env`. Prywatny `backend/.env` tworzysz i edytujesz wyłącznie na VPS; instalator go nie przesyła. Lokalny `.env` służy tylko do testów.

**2. Lokalnie: wyślij aplikację.**

```powershell
.\deploy\install.bat
```

| Pytanie skryptu | Odpowiedź |
| --- | --- |
| Wysłać pliki strony, backendu i wdrożenia? | `t` |
Prywatny `backend/.env` nie jest wysyłany; nie ma pytania o jego nadpisanie.

Po błędzie wysyłania zatrzymaj procedurę i usuń przyczynę. Samo wysłanie plików nie uruchamia kontenerów.

**3. Na VPS: zbuduj i uruchom aplikację.**

```sh
cd /home/docker/dimundi/app/deploy
bash build.sh
```

Odpowiedz `t` na pytanie o budowanie, a po pomyślnym sprawdzeniu konfiguracji — `t` na pytanie o uruchomienie kontenerów. Poczekaj na zakończenie skryptu bez błędów. Jeżeli zgłosi brak `backend/.env`, przygotuj ten plik przed ponowieniem. Nie przełączaj proxy, jeśli aplikacja nie wystartowała.

**4. Lokalnie: przełącz działające proxy na stronę.**

```powershell
.\proxy\deploy_proxy\install-proxy.bat
```

| Pytanie skryptu | Odpowiedź |
| --- | --- |
| Wysłać `nginx.conf`? | `t` |
| Wysłać też Dockerfile, Compose i skrypt budowania proxy? | `n` |
| Sprawdzić i przeładować konfigurację działającego proxy? | `t` |

Na tym etapie nie uruchamiaj ponownie `build-proxy.sh`: zmieniamy tylko konfigurację Nginx.

**5. Sprawdź stronę w przeglądarce.**

Otwórz `http://vps-f9b377ab.vps.ovh.net`. Zamiast „Proxy działa” powinna być widoczna strona. Sprawdź podstrony, stopkę oraz dane kontaktowe. Weryfikacja wysyłania formularza wymaga świadomego wysłania wiadomości testowej i sprawdzenia jej odbioru. Ta procedura nie zmienia DNS `dimundi.com` ani nie uruchamia HTTPS.

Jeśli pojawi się błąd, sprawdź na VPS stan i ostatnie logi:

```sh
cd /home/docker/dimundi/app/deploy
docker compose -f compose.yml ps
docker compose -f compose.yml logs --tail=100 frontend backend
cd /home/docker/dimundi/proxy
docker compose -f compose.yml logs --tail=100 proxy
```

### Kolejne aktualizacje

- Snake: `/snake` otwierane z About w nowej karcie, `frontend/snake.html` i cała gra z animacją startową w `frontend/snake.js`. Strona ma `noindex`, bez wpisu w sitemap. Nowa trasa w `frontend/nginx.conf` i `deploy/nginx.conf`; po wysłaniu przez `deploy/install.bat` sprawdź `nginx -t` i wykonaj `nginx -s reload` w kontenerze frontendu (polecenia poniżej). Bez przebudowy obrazów. Zmiana przygotowana i sprawdzana lokalnie, bez wdrożenia na VPS.

- Końcowy test w `build.sh` używa `http://127.0.0.1/`: BusyBox `wget` wybiera dla `localhost` IPv6 `::1`, podczas gdy frontend nasłuchuje na IPv4. Błąd odtworzony lokalnie; IPv4 zwraca 200. Zgłoszenie użytkownika: kontenery na VPS uruchomione, skrypt zakończył się na tym teście. Po takim błędzie sprawdź na VPS `docker compose -f compose.yml exec -T frontend wget -S -O /dev/null http://127.0.0.1/`; nie trzeba ponownie budować obrazów tylko z powodu zmiany adresu testu.

- Formularz antyspamowy: Turnstile sprawdzany na backendzie (token, hostname, action `contact`), honeypot i limity 5 prób/IP/15 min oraz 30 wysyłek/h łącznie. Limity są w pamięci jednego procesu i zerują się po restarcie; przy skalowaniu backendu wymagają wspólnego magazynu. Backend pozostaje bez publicznego portu. Oba frontendowe Nginx przekazują `X-Forwarded-For` nadpisany na wejściu przez proxy; Express ufa jednemu pośrednikowi. Nie wystawiać frontendu produkcyjnego bezpośrednio do Internetu.
- Przed uruchomieniem nowego backendu ustaw na VPS w `/home/docker/dimundi/app/backend/.env`: `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`. `TURNSTILE_HOSTNAMES=dimundi.com` jest w aktualizowanym `deploy/backend.env`. Wymagane też `MAIL_FROM` i `MAIL_TO`. Bez konfiguracji lub przy awarii weryfikacji wysyłanie jest zablokowane; odsłanianie e-maila/telefonu również wymaga Turnstile. Frontend pobiera tylko publiczny site key przez `/api/contact-config`. GET `/api/contact-data` zwraca 405; POST wymaga tokenu z action `contact_email` lub `contact_phone` i zwraca tylko wybraną daną (bez cache), limit 10 prób/IP/15 min.
- Wdrożenie antyspamu: `deploy/install.bat` wysyła też `backend/app.js`; przesyła ustawienia ogólne `deploy/backend.env`, nigdy prywatny `backend/.env`. Następnie `bash build.sh` w katalogu aplikacji na VPS (budowanie i uruchomienie). Nie wdrożono zdalnie w ramach przygotowania kodu. Instrukcja i lista sprawdzeń: [Formularz — Turnstile](../../formularz-antyspam.md).

- Adresy podstron bez rozszerzeń: `/about`, `/solutions`, `/contact`; pliki pozostają `.html` (adres `/solutions` obsługuje `services.html`). `/services`, `/services/` i `/services.html` przekierowują 301 bezpośrednio na `/solutions`. Stare adresy `.html`, warianty z końcowym `/` i `/index.html` przekierowują 301 z zachowaniem parametrów. Linki, canonical i sitemap używają nowych adresów. Przekierowania względne zachowują HTTPS i port lokalnego proxy. Po wysłaniu plików sprawdź i przeładuj Nginx frontendu jak dla konfiguracji 404 poniżej.

- Własna strona 404: `frontend/404.html`, SSI i `error_page 404 /404.html` w obu konfiguracjach frontendu. Zachowuje HTTP 404; nie dodajemy jej do sitemap. Przygotowana lokalnie, wymaga wysłania plików i przeładowania Nginx.
- Po wysłaniu konfiguracji 404 wykonaj na VPS z `/home/docker/dimundi/app/deploy`: `docker compose -f compose.yml exec -T frontend nginx -t` i dopiero po sukcesie `docker compose -f compose.yml exec -T frontend nginx -s reload`. Sprawdź `curl -i https://dimundi.com/test/brak-strony`: HTTP 404 i własny HTML.
- Instalator nie usuwa starych plików: po usunięciu Projects z repo usuń także `/home/docker/dimundi/app/frontend/projects.html` i `/home/docker/dimundi/app/frontend/wgs.jpg` na VPS (`rm -f --` z tymi dwoma pełnymi ścieżkami).

- Tylko treść strony: uruchom lokalnie `deploy/install.bat`; zaakceptuj wysłanie plików; prywatny `.env` pozostaje bez zmian. Zmiany frontendu są widoczne bez budowania i restartu.
- Backend, Compose, obraz lub konfiguracja Nginx frontendu: po wysłaniu plików uruchom na VPS `bash build.sh` z katalogu aplikacji jak powyżej.
- Ustawienia ogólne: edytuj `deploy/backend.env` w repo i wyślij instalatorem. Prywatne: edytuj `backend/.env` bezpośrednio na VPS. Po zmianie któregokolwiek pliku uruchom `bash build.sh`, aby odtworzony kontener wczytał nowe środowisko.
- Tylko konfiguracja proxy: uruchom `install-proxy.bat` i odpowiedz kolejno `t`, `n`, `t`.

### Szczegóły działania skryptów

1. Uruchom lokalnie `deploy/install.bat`. Korzysta ze wspólnego `deploy.config`. Po potwierdzeniu `t` wysyła frontend, jawnie wybrane źródła backendu oraz pliki wdrożenia do `/home/docker/dimundi/app`.
2. Instalator zawsze wysyła `deploy/backend.env` z ustawieniami ogólnymi. Nigdy nie wysyła ani nie tworzy prywatnego `backend/.env` na VPS. Compose wczytuje pliki w tej kolejności: ogólny, prywatny; prywatne wartości wygrywają. Przy pierwszym wdrożeniu utwórz prywatny plik na VPS z uprawnieniami 600. Pliki `.env` są wykluczone z kontekstu budowania obrazu.
3. Na VPS wykonaj:

```sh
cd /home/docker/dimundi/app/deploy
bash build.sh
```

Skrypt pyta osobno o budowanie i uruchomienie (`t/n`), sprawdza konfigurację Nginx, czeka na uruchomienie usług i sprawdza odpowiedź frontendu. Backend ma healthcheck `/health`. Poprawność danych SMTP oraz wysyłkę formularza trzeba sprawdzić osobno.

4. Dopiero po uruchomieniu aplikacji uruchom lokalnie `proxy/deploy_proxy/install-proxy.bat`: wyślij nowy `nginx.conf`, pomiń pliki wdrożenia (`n`), zatwierdź sprawdzenie i reload (`t`). Proxy nie wymaga przebudowy. Wysłanie tej konfiguracji przed uruchomieniem aplikacji spowoduje odpowiedzi 502.

Projekt `dimundi-app` nie publikuje portów hosta. Frontend dołącza do istniejącej sieci `dimundi-proxy_default` z aliasem `dimundi-frontend`. Backend jest dostępny tylko w sieci aplikacji, z dostępem wychodzącym do SMTP. SSI i `/api/` obsługuje frontend. Produkcyjny CORS jest ustawiony na `https://dimundi.com`; po wysłaniu zaktualizowanego Compose trzeba odtworzyć backend.

Kopiowanie plików jest wykonywane w miejscu; frontend może od razu pokazać zmiany. Skrypt nie usuwa starych plików i nie zapewnia atomowego wdrożenia. Zmiany backendu i jego środowiska wymagają ponownego uruchomienia `build.sh`. Nie umieszczaj sekretów w katalogu `frontend/`, którego zawartość jest wysyłana jako publiczna strona.

## HTTPS — pierwsze uruchomienie

Certbot działa w osobnym, uruchamianym na czas operacji kontenerze (profil Compose `tools`). Weryfikacja HTTP-01 korzysta z katalogu `acme/` wspólnego z Nginx. Certyfikaty i konto ACME są zapisywane wyłącznie na VPS w `/home/docker/dimundi/proxy/letsencrypt/`; Nginx ma dostęp tylko do odczytu. Nie kopiuj tego katalogu do repozytorium. W kopii zapasowej serwera uwzględnij cały katalog `letsencrypt`, z ograniczonym dostępem do kluczy.

Dokumentacja: [Certbot — instalacja w Dockerze](https://eff-certbot.readthedocs.io/en/stable/install.html), [polecenia certonly i renew](https://eff-certbot.readthedocs.io/en/stable/man/certbot.html).

### 1. DNS i dostępność

Wszystkie cztery nazwy (`dimundi.com`, `www.dimundi.com`, `dimundi.pl`, `www.dimundi.pl`) muszą wskazywać na VPS: IPv4 `145.239.92.71`, a jeśli mają AAAA — IPv6 `2001:41d0:601:1100::9fec`. Nazwy `www` mogą być rekordami CNAME do odpowiednich domen głównych. Nie zmieniaj rekordów MX ani pozostałych ustawień poczty. Porty TCP 80 i 443 muszą być dostępne z Internetu; port 80 pozostaje potrzebny do odnowień. Sprawdź też istniejące rekordy CAA, jeśli wystawienie certyfikatu jest blokowane.

Nie zakładamy, że DNS już się rozpropagował. Skrypt wykona próbę Certbota `--dry-run` przed wystawieniem właściwego certyfikatu. Niepowodzenie zatrzyma procedurę; popraw DNS/dostępność i ponów ją później.

### 2. Wyślij pliki proxy z Windows

Z katalogu projektu:

```powershell
.\proxy\deploy_proxy\install-proxy.bat
```

Odpowiedz kolejno **`t`, `t`, `n`**: wyślij konfigurację, wyślij Compose i skrypty, pomiń sam reload. Dodajemy nowe montowania i port 443, dlatego istniejący kontener musi zostać odtworzony przez następny skrypt.

Instalator wysyła zarówno szablon HTTP, jak i `nginx-https.conf`. Jeśli na VPS istnieje znacznik `https.enabled`, zachowuje tryb HTTPS przy kolejnych aktualizacjach. Nie usuwaj tego znacznika podczas zwykłego wdrożenia.

### 3. Na VPS uruchom konfigurację HTTPS

Jako użytkownik `docker`:

```sh
cd /home/docker/dimundi/proxy
bash setup-https.sh
```

Skrypt kolejno:

1. Pyta `t/n` o odtworzenie proxy z montowaniami ACME i portem 443. To może spowodować krótką przerwę w obsłudze strony. Używa już zbudowanego obrazu proxy.
2. Pyta o adres e-mail konta Let's Encrypt oraz o zgodę na warunki usługi i próbną weryfikację domen. Adres nie jest zapisany w repozytorium.
3. Po poprawnej próbie pyta `t/n` o wystawienie produkcyjnego certyfikatu obejmującego wszystkie cztery nazwy.
4. Pyta `t/n` o włączenie HTTPS i przekierowań. Zachowuje dotychczasową konfigurację jako `nginx.conf.before-https`, sprawdza `nginx -t`, przeładowuje Nginx i zapisuje znacznik `https.enabled`. Przy błędzie sprawdzenia przywraca poprzedni plik.
5. Uruchamia instalację zadania odnawiania z osobnym pytaniem `t/n`. Odmowa oznacza, że automatyczne odnawianie NIE jest skonfigurowane.

Jeśli brakuje `crontab`, z konta `debian` wykonaj:

```sh
sudo apt-get install cron
sudo systemctl enable --now cron
```

Następnie wróć do konta `docker` i wykonaj:

```sh
cd /home/docker/dimundi/proxy
bash install-renewal.sh
```

Nie trzeba ponownie wystawiać certyfikatu, aby dodać samo odnawianie.

### 4. Zaktualizuj konfigurację aplikacji

`deploy/backend.env` ustawia `CORS_ORIGIN=https://dimundi.com`. Wyślij pliki przez `deploy/install.bat`, następnie jako `docker`:

```sh
cd /home/docker/dimundi/app/deploy
bash build.sh
```

Potwierdź budowanie i uruchomienie. Sprawdź stronę oraz formularz pod docelową domeną.

### 5. Sprawdź HTTPS i odnawianie

Otwórz `https://dimundi.com`. Pozostałe trzy nazwy przez HTTP i HTTPS mają przekierować na tę domenę. Sprawdź również adres z podstroną i parametrem, np. `https://dimundi.pl/contact.html?test=1`. Nazwa techniczna VPS nie jest objęta certyfikatem; używaj jej tylko przez HTTP, które po aktywacji przekieruje na domenę główną.

Na VPS jako `docker`:

```sh
cd /home/docker/dimundi/proxy
bash renew-cert.sh --dry-run
crontab -l
systemctl is-active cron
```

Próba odnowienia korzysta ze środowiska testowego Let's Encrypt i nie zastępuje produkcyjnego certyfikatu. Sprawdź jej zakończenie bez błędów. Zadanie działa o 03:17 i 15:17 czasu VPS, odnawia certyfikat, gdy jest to potrzebne, a następnie sprawdza i przeładowuje Nginx. `flock` chroni przed równoległymi operacjami. Pozostałe wpisy crontab są zachowane; ponowne uruchomienie instalatora nie dubluje zadania.

Log zadania: `/home/docker/dimundi/proxy/renew-cert.log`. Monitoruj błędy oraz datę ważności certyfikatu; log wymaga okresowego porządkowania. Skrypt nie wymaga montowania gniazda Dockera wewnątrz kontenera Certbota.

## Do ustalenia

- Wykonanie przygotowanej procedury HTTPS i potwierdzenie automatycznego odnawiania.
- Potwierdzenie działania domen i formularza po przełączeniu na HTTPS.
- Rozwiązanie pocztowe.

## Stan wdrożenia

Użytkownik uruchomił proxy i aplikację oraz zgłosił zmianę DNS. Konfiguracja HTTPS i skrypty certyfikatów są przygotowane lokalnie. Certyfikatu jeszcze nie wystawiono w ramach tej pracy; nie wykonano zdalnych zmian HTTPS.

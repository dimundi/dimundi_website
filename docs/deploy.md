# Wdrożenie

Tutaj zapisujemy ustalenia i uwagi dotyczące wdrożenia projektu. Uzupełniamy ten dokument w miarę podejmowania kolejnych decyzji.

## Ustalenia

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

- Pliki produkcyjnego proxy znajdują się w `proxy/deploy/`; testowe pozostają osobno.
- Obraz proxy budujemy na VPS. To zastępuje wcześniejszy plan lokalnego budowania i przesyłania obrazu `.tar`.
- Na VPS nie używamy Gita. Pliki kopiujemy przez SSH/SCP.
- VPS: Debian 13, amd64, Docker i Docker Compose zainstalowane. SSH: `docker@145.239.92.71`, port 22, uwierzytelnianie kluczem.
- Katalog proxy na serwerze: `/home/docker/dimundi/proxy`.
- `install-proxy.bat` odczytuje `SSH_KEY` z lokalnego pliku `deploy.config` w głównym katalogu projektu. Plik jest ignorowany przez Git. Wzór `deploy.config_tmp` należy skopiować jako `deploy.config` i wpisać pełną ścieżkę do prywatnego klucza OpenSSH, bez cudzysłowów i zmiennych środowiskowych. Brak pliku, wpisu lub klucza zatrzymuje skrypt z komunikatem. Konfiguracja lokalna i klucz nie są wysyłane na serwer. SSH może poprosić o hasło klucza przy każdym połączeniu.
- Logowanie hasłem do konta `debian` ma pozostać dostępne.

### Instalacja z Windows

Uruchom `proxy/deploy/install-proxy.bat`. Potwierdzenia mają postać `t/n` (wielkość liter nie ma znaczenia); tylko `t` zatwierdza operację. Skrypt pyta osobno:

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
- Docelowo `dimundi.com`, przekierowanie `www` na domenę bez `www`. DNS starej strony na razie pozostaje bez zmian.
- Frontend jest przesyłany jako pliki do katalogu hosta, montowane tylko do odczytu.

## Wdrożenie aplikacji

Pliki znajdują się w głównym katalogu `deploy/`: `install.bat`, `build.sh`, `compose.yml`, `Dockerfile-frontend` i `nginx.conf`. Backend jest budowany z istniejącego `backend/Dockerfile`.

### Procedura krok po kroku — działające proxy, pierwsze wdrożenie strony

Punktem wyjścia jest działające proxy z napisem „Proxy działa”. Poniższe polecenia lokalne wykonuj w PowerShell w głównym katalogu projektu; polecenia serwerowe w sesji SSH użytkownika `docker`.

**1. Lokalnie: sprawdź konfigurację.**

Plik `deploy.config` musi zawierać `SSH_KEY` ze ścieżką do klucza. Jeśli go brakuje, skopiuj `deploy.config_tmp` jako `deploy.config` i uzupełnij ścieżkę. Przygotuj również `backend/.env` z właściwymi danymi kontaktowymi i SMTP, korzystając z `backend/.env_tmpl`. Nie nadpisuj już uzupełnionych plików wzorami.

**2. Lokalnie: wyślij aplikację.**

```powershell
.\deploy\install.bat
```

| Pytanie skryptu | Odpowiedź |
| --- | --- |
| Wysłać pliki strony, backendu i wdrożenia? | `t` |
| Wysłać lokalny `backend/.env`? | `t`, jeśli lokalny plik jest gotowy i ma zostać użyty na VPS; `n`, jeśli poprawny plik jest już na serwerze |

Po błędzie wysyłania zatrzymaj procedurę i usuń przyczynę. Samo wysłanie plików nie uruchamia kontenerów.

**3. Na VPS: zbuduj i uruchom aplikację.**

```sh
cd /home/docker/dimundi/app/deploy
bash build.sh
```

Odpowiedz `t` na pytanie o budowanie, a po pomyślnym sprawdzeniu konfiguracji — `t` na pytanie o uruchomienie kontenerów. Poczekaj na zakończenie skryptu bez błędów. Jeżeli zgłosi brak `backend/.env`, przygotuj ten plik przed ponowieniem. Nie przełączaj proxy, jeśli aplikacja nie wystartowała.

**4. Lokalnie: przełącz działające proxy na stronę.**

```powershell
.\proxy\deploy\install-proxy.bat
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

- Tylko treść strony: uruchom lokalnie `deploy/install.bat`; zaakceptuj wysłanie plików i pomiń `.env`, jeśli nie zmieniasz danych. Zmiany frontendu są widoczne bez budowania i restartu.
- Backend, Compose, obraz lub konfiguracja Nginx frontendu: po wysłaniu plików uruchom na VPS `bash build.sh` z katalogu aplikacji jak powyżej.
- Dane w `backend/.env`: zaakceptuj ich wysłanie i uruchom `bash build.sh`, aby kontener wczytał nowe środowisko.
- Tylko konfiguracja proxy: uruchom `install-proxy.bat` i odpowiedz kolejno `t`, `n`, `t`.

### Szczegóły działania skryptów

1. Uruchom lokalnie `deploy/install.bat`. Korzysta ze wspólnego `deploy.config`. Po potwierdzeniu `t` wysyła frontend, jawnie wybrane źródła backendu oraz pliki wdrożenia do `/home/docker/dimundi/app`.
2. Osobne pytanie `t/n` pozwala przesłać `backend/.env`. To nadpisuje konfigurację backendu na VPS; plik ma uprawnienia 600. Przy `n` istniejący plik pozostaje bez zmian. Przy pierwszym wdrożeniu trzeba go wysłać albo utworzyć ręcznie z wzoru i uzupełnić. Pliki `.env` są wykluczone z kontekstu budowania obrazu.
3. Na VPS wykonaj:

```sh
cd /home/docker/dimundi/app/deploy
bash build.sh
```

Skrypt pyta osobno o budowanie i uruchomienie (`t/n`), sprawdza konfigurację Nginx, czeka na uruchomienie usług i sprawdza odpowiedź frontendu. Backend ma healthcheck `/health`. Poprawność danych SMTP oraz wysyłkę formularza trzeba sprawdzić osobno.

4. Dopiero po uruchomieniu aplikacji uruchom lokalnie `proxy/deploy/install-proxy.bat`: wyślij nowy `nginx.conf`, pomiń pliki wdrożenia (`n`), zatwierdź sprawdzenie i reload (`t`). Proxy nie wymaga przebudowy. Wysłanie tej konfiguracji przed uruchomieniem aplikacji spowoduje odpowiedzi 502.

Projekt `dimundi-app` nie publikuje portów hosta. Frontend dołącza do istniejącej sieci `dimundi-proxy_default` z aliasem `dimundi-frontend`. Backend jest dostępny tylko w sieci aplikacji, z dostępem wychodzącym do SMTP. SSI i `/api/` obsługuje frontend. Produkcyjny CORS jest ustawiony na adres HTTP VPS.

Kopiowanie plików jest wykonywane w miejscu; frontend może od razu pokazać zmiany. Skrypt nie usuwa starych plików i nie zapewnia atomowego wdrożenia. Zmiany backendu i jego środowiska wymagają ponownego uruchomienia `build.sh`. Nie umieszczaj sekretów w katalogu `frontend/`, którego zawartość jest wysyłana jako publiczna strona.

## Do ustalenia

- Sposób uzyskiwania i odnawiania certyfikatów HTTPS.
- Przełączenie aplikacji na domenę docelową (w tym CORS_ORIGIN).
- Rozwiązanie pocztowe.

## Stan wdrożenia

Użytkownik potwierdził działanie początkowego proxy HTTP. Konfiguracja aplikacji i nowa konfiguracja proxy zostały przygotowane lokalnie; nie wysłano ich ani nie uruchomiono w ramach tej zmiany.

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

## Budowanie i wysyłanie

- Zachować osobne skrypty dla obecnego środowiska testowego i produkcji.
- Obrazy produkcyjne budować lokalnie przy użyciu Dockera, a nie na VPS.
- Gotowe obrazy zapisywać do archiwum `.tar` i przesyłać przez SSH. Na serwerze wczytywać je przez `docker load`; nie korzystać z rejestru obrazów.
- Pliki strony przesyłać osobno do katalogu hosta podłączonego do Nginx.
- Skrypt wdrożeniowy ma przygotować paczkę, wysłać ją przez SSH i uruchomić na serwerze.
- Przed każdym z tych trzech etapów wymagać jawnego potwierdzenia `TAK/NIE`, z informacją o planowanej operacji i jej celu. Domyślnie nie wykonywać operacji bez potwierdzenia. Odpowiedź `NIE` zatrzymuje wdrożenie przed danym etapem.

## Do ustalenia

- Domena i konfiguracja DNS.
- Ścieżki katalogów na serwerze.
- Adres serwera, użytkownik i port SSH oraz sposób uwierzytelniania.
- System i architektura procesora VPS oraz dostępność Dockera i Docker Compose.
- Sposób uzyskiwania i odnawiania certyfikatów HTTPS dla proxy Nginx.
- Rozwiązanie pocztowe.

## Stan wdrożenia

Powyższe punkty określają docelowy sposób wdrożenia. Konfiguracja produkcyjna nie została jeszcze przygotowana ani uruchomiona w ramach tych ustaleń.

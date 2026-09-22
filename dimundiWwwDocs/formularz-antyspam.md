# Formularz — Turnstile

## Stan

- Użytkownik potwierdził działanie formularza, odbioru wiadomości i odsłaniania danych na produkcji.
- Aktualizacja wyglądu przygotowana lokalnie: widget widoczny tylko przy wymaganej interakcji (`interaction-only`), poziomy `flexible`; `compact` tylko gdy dostępne miejsce ma mniej niż 300 px. Wysyłka plików frontendu wystarczy, bez zmiany kluczy i przebudowy backendu.
- Backend wymaga pozytywnej odpowiedzi Siteverify, hostname z listy i action `contact`. Brak kluczy, błąd sieci lub odmowa blokują mail.
- 5 prób/IP/15 min (IPv6 grupowane /56), 30 zweryfikowanych prób wysyłki/h łącznie. Liczniki w pamięci, zerowane po restarcie; jedna instancja backendu.
- Honeypot, limity długości pól i JSON, stały nadawca i odbiorca; e-mail odwiedzającego tylko jako Reply-To.
- Testy `cd backend` / `npm test` używają atrap Cloudflare i SMTP; nie wysyłają poczty.
- Formularz zachowuje dotychczasowe komunikaty. Przyciski Show email / Show phone odsłaniają dane po osobnym Turnstile (action `contact_email` / `contact_phone`). GET `/api/contact-data` nie ujawnia danych; POST zwraca tylko żądane pole, z `Cache-Control: no-store`. Limit odsłaniania: 10 prób/IP/15 min, niezależny od limitu formularza. Skrypt `frontend/turnstile.js` ładuje bibliotekę raz dla obu funkcji.

## Konfiguracja od zera

1. Konto Cloudflare → Turnstile → Add widget. Nazwa np. `Dimundi contact`; hostname `dimundi.com`; tryb Managed. Nie trzeba zmieniać DNS. Pre-clearance pozostawić wyłączone.
2. Zachować Site key i Secret key. Sekret wpisywać wyłącznie do backendowego `.env`, nie do HTML, repo ani czatu.
3. Na VPS edytować `/home/docker/dimundi/app/backend/.env`, dopisując bez nadpisywania ustawień SMTP:

   ```dotenv
   TURNSTILE_SITE_KEY=<publiczny klucz widgetu>
   TURNSTILE_SECRET_KEY=<tajny klucz widgetu>
   ```

4. Upewnić się, że `MAIL_FROM` i `MAIL_TO` są ustawione. Nie używać kluczy testowych w produkcji.
5. Lokalnie uruchomić `deploy/install.bat`. Aktualizuje `deploy/backend.env` (m.in. `TURNSTILE_HOSTNAMES=dimundi.com`), ale nigdy prywatny `backend/.env` z kluczami. Prywatny plik ma pierwszeństwo przy powtórzonych zmiennych.
6. Na VPS: `cd /home/docker/dimundi/app/deploy`, następnie `bash build.sh`; potwierdzić budowanie i uruchomienie. Nowy backend potrzebuje `app.js` i zaktualizowanego lockfile. Sam restart starego obrazu nie wystarczy.
7. Otworzyć `https://dimundi.com/contact`. Poczekać na weryfikację, świadomie wysłać jedną wiadomość testową i potwierdzić jej odbiór. Kliknąć osobno Show email i Show phone: po weryfikacji ma pojawić się tylko wybrana dana. Sprawdzić jasny/ciemny motyw i telefon.
8. Sprawdzić, że POST bez tokenu jest odrzucony, a podmiana `X-Forwarded-For` przez klienta nie omija limitu. Nie testować limitu produkcyjnego serią prawdziwych wiadomości.

Do testów lokalnych używać osobnego widgetu dopuszczającego `localhost` i `TURNSTILE_HOSTNAMES=localhost`; `127.0.0.1` wymaga osobnego dopuszczenia. Lokalne Nginx po zmianie przekazywania IP trzeba przeładować. Bez kluczy formularz pozostaje nieaktywny.

Przy niedostępnej weryfikacji formularz i odsłanianie danych są zablokowane. Udostępnione wcześniej dane mogą być nadal znane botom. Zabezpieczenia formularza nie filtrują wiadomości wysyłanych bezpośrednio na skrzynkę.

Źródła: [Turnstile — widget](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/), [walidacja backendowa](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

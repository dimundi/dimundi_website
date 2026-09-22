# Analityka GA4

- Usługa: Dimundi WWW, identyfikator `G-BLCYHLE5Z3` (publiczny).
- Kod: `frontend/analytics.js`, dołączany przez wspólny `partials/head.html`.
- Pomiar tylko na `dimundi.com`, dla `/`, `/about`, `/solutions`, `/contact`, `/snake`. Lokalny podgląd nie wysyła danych.
- Basic consent mode: tag Google ładowany dopiero po zgodzie; reklamy i Google Signals wyłączone. Wybór przechowywany 180 dni w localStorage, zmieniany przez „Analytics settings” w stopce. Odmowa zatrzymuje zdarzenia i usuwa cookies GA tej usługi. Zmiana synchronizowana między kartami.
- Brak danych formularza, adresów e-mail, telefonów i tokenów w zdarzeniach; URL bez query/hash, referrer ograniczony do origin.
- Pomiar zaawansowany w panelu GA4 pozostaje wyłączony.

| Zdarzenie | Moment |
| --- | --- |
| `page_view` | Raz na stronę, po zgodzie |
| `generate_lead` | Backend potwierdził wysłanie formularza |
| `contact_reveal` | Odsłonięto email/telefon; `contact_method` |
| `snake_start` | Start nowej gry, bez wznowień pauzy |
| `snake_level_complete` | Ukończono level; `level`, `score` |
| `snake_complete` | Ukończono wszystkie 9 leveli |

Przygotowane lokalnie. Wdrożenie: wysłanie frontendu przez istniejący instalator, bez przebudowy/reloadu. Po wdrożeniu zaakceptuj analitykę i sprawdź GA4 → Czas rzeczywisty. Oznacz `generate_lead` jako kluczowe zdarzenie; opcjonalnie dodaj niestandardowe wymiary zdarzeń `level`, `contact_method` i metrykę `score`. Zbieranie danych zależy od zgody i blokowania skryptów w przeglądarce.

Dokumentacja: [Google — consent mode](https://developers.google.com/tag-platform/security/guides/consent), [konfiguracja GA4](https://developers.google.com/analytics/devguides/collection/ga4/reference/config).

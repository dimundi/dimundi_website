# Podgląd linków

- Strony `/`, `/about`, `/solutions`, `/contact`: Open Graph i karta X `summary_large_image`.
- Tytuł i opis podglądu odpowiadają zatwierdzonym `<title>` i `description`; przy zmianach aktualizować również `og:*` i `twitter:*` w danej stronie.
- Wspólna konfiguracja: `frontend/partials/social.html`, dołączana przez SSI. Strona 404 bez podglądu.
- Grafika: `frontend/social-preview.png`, 1200 × 630, logo tekstowe i paleta strony. Źródło do renderowania: `design/social-preview.html` (fonty Google jak na stronie; przed eksportem muszą być załadowane). Eksport w przeglądarce: viewport 1200 × 630, skala 1, bez pasków przewijania.
- Zmiany przygotowane lokalnie. Wystarczy wysłać pliki przez `deploy/install.bat`; bez przebudowy backendu. Sprawdzić publiczną dostępność `/social-preview.png` i podgląd udostępnionego linku po wdrożeniu.
- Dokumentacja standardu: [Open Graph](https://ogp.me/).

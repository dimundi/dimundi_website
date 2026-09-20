# Thunderbird — poczta Dimundi

Ustawienia nowego serwera. Konfiguracja i stan migracji: [email.md](email.md).

## Dodanie konta

Dodaj istniejące konto pocztowe, wpisz nazwę nadawcy, pełny adres e-mail i hasło skrzynki na **nowym serwerze** (to samo co do Roundcube). Wybierz konfigurację ręczną, jeśli automatyczne wykrywanie nie znajdzie ustawień.

| Ustawienie                | Poczta przychodząca  | Poczta wychodząca            |
| ------------------------- | -------------------- | ---------------------------- |
| Protokół                  | IMAP                 | SMTP                         |
| Serwer                    | `poczta.dimundi.com` | `poczta.dimundi.com`         |
| Port                      | **993**              | **587**                      |
| Bezpieczeństwo połączenia | **SSL/TLS**          | **STARTTLS**                 |
| Metoda uwierzytelniania   | **Zwykłe hasło**     | **Zwykłe hasło**             |
| Nazwa użytkownika         | Pełny adres skrzynki | Ten sam pełny adres skrzynki |

Loginy:

- Marcin: `marcin@dimundi.com`.
- Beata: `beata@dimundi.com`.

SMTP wymaga uwierzytelnienia. Alternatywnie można użyć portu **465 z SSL/TLS** zamiast 587 z STARTTLS. Nie łącz portu 993 z STARTTLS ani 587 z SSL/TLS. POP3 jest wyłączony.

Wybierz „Sprawdź ponownie”, następnie zakończ dodawanie konta. Przy kilku kontach przypisz każdemu właściwy serwer SMTP z jego własnym loginem. Hasło skrzynki jest inne niż hasło SSH lub klucza SSH; nie zapisuj haseł w dokumentacji.

## Sprawdzenie

1. Pobierz wiadomości i porównaj foldery z [Roundcube](https://webmail.dimundi.com).
2. Wyślij wiadomość testową na zewnętrzny adres i sprawdź odbiór.
3. Jeśli brakuje folderów, sprawdź ich subskrypcję w Thunderbirdzie. Foldery wysłanych, szkiców, archiwum i kosza przypisz do istniejących folderów tej skrzynki na serwerze.

IMAP synchronizuje zmiany z serwerem: usunięcie lub przeniesienie wiadomości w programie wpływa również na webmail.

## Aliasy `.pl`

`marcin@dimundi.pl` i `beata@dimundi.pl` trafiają do odpowiednich skrzynek `.com`. Nie dodawaj ich jako osobnych kont IMAP. Do logowania używaj adresu `.com`. Wysyłanie z aliasu można skonfigurować jako dodatkową tożsamość z właściwym SMTP; alias musi już istnieć na serwerze.

## Gdy połączenie nie działa

- Sprawdź nazwę serwera, port, rodzaj TLS oraz pełny login. Nie używaj `mail.dimundi.com` do nowego konta — podczas migracji to stary serwer.
- Przy odrzuceniu hasła sprawdź je w nowym Roundcube i popraw zapamiętane hasło IMAP/SMTP w Thunderbirdzie. Nie ponawiaj wielokrotnie błędnych prób.
- Timeout może oznaczać blokadę IP przez Fail2Ban; administrator sprawdza zarówno jail `postfix`, jak i `dovecot`. Blokada SMTP może również odciąć IMAP. Zasady blokowania opisano w [email.md](email.md).
- Przy ostrzeżeniu certyfikatu nie dodawaj wyjątku: sprawdź adres i zgłoś problem. Poprawne połączenie z `poczta.dimundi.com` ma przechodzić weryfikację certyfikatu.

## Uwaga na czas migracji — stan 2026-09-21

Kopie wiadomości obu skrzynek są już na nowym serwerze, ale **MX nadal wskazuje stary serwer**. Do przełączenia nowe przychodzące wiadomości odbiera stare konto; wysyłanie z nowego jest dostępne. Zachowaj stare konto do zakończenia migracji. Wstrzymaj porządkowanie, usuwanie i przenoszenie wiadomości na nowym koncie do końcowej synchronizacji. Aktualny stan: [email.md](email.md).

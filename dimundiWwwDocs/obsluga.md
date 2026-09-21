# Obsługa poczty — zarządzanie

| Co                          | Dane                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| Serwer                      | `poczta.dimundi.com` · `145.239.92.71` · Debian 13                                                     |
| Logowanie administratora    | SSH, port `22`, użytkownik `docker`, klucz prywatny wskazany w lokalnym `deploy.config` jako `SSH_KEY` |
| Katalog poleceń na serwerze | `/home/docker/dimundi/poczta/deploy`                                                                   |
| Usługi                      | Docker Mailserver + Roundcube; zarządzanie przez SSH                                                   |
| Webmail                     | https://webmail.dimundi.com — login pełnym adresem `.com`, hasło skrzynki                              |
| Odbiór / wysyłka            | IMAP `993` SSL/TLS · SMTP `587` STARTTLS lub `465` SSL/TLS                                             |
| Dane i konfiguracja         | `/home/docker/dimundi/poczta/data/`                                                                    |

## Przesłanie skryptów na serwer

Na komputerze, w PowerShell w głównym katalogu projektu:

```powershell
.\poczta\dimundi\deploy\install.bat
```

Potwierdź `t`. Skrypt korzysta z `SSH_KEY` w lokalnym `deploy.config` i wysyła skrypty **oraz konfigurację poczty** do `/home/docker/dimundi/poczta/deploy`, nadpisując odpowiadające im pliki. Nie uruchamia ani nie restartuje kontenerów. Przesłany skrypt uruchom później przez SSH, np. `bash add-account.sh`.

## Wejście na serwer

Na komputerze, w PowerShell (podstaw ścieżkę swojego klucza):

```powershell
ssh -i "C:\ścieżka\do\klucza" docker@145.239.92.71
```

Po zalogowaniu:

```sh
cd /home/docker/dimundi/poczta/deploy
```

Wszystkie poniższe polecenia wykonuj tutaj, na serwerze.

## Konta i hasła

| Czynność | Polecenie |
| --- | --- |
| Lista kont | `docker compose exec mailserver setup email list` |
| Nowa skrzynka | `bash add-account.sh` — pyta o nazwę, alias `.pl` i hasło |
| Zmiana hasła | `docker compose exec mailserver setup email update marcin@dimundi.com` — podstaw właściwy adres; hasło wpisz w monicie |
| Lista aliasów | `docker compose exec mailserver setup alias list` |
| Nowy alias | `docker compose exec mailserver setup alias add kontakt@dimundi.com marcin@dimundi.com` — podstaw adres aliasu i odbiorcy |

Po zmianie hasła popraw je w programach pocztowych. Zmiana hasła `biuro` wymaga również aktualizacji `SMTP_PASS` w `/home/docker/dimundi/app/backend/.env` i wykonania:

```sh
docker compose -f /home/docker/dimundi/app/deploy/compose.yml up -d --no-deps --force-recreate backend
```

## Zasady przekierowań

- Konta tworzymy w `.com`; `.pl` służy jako alias do tej samej skrzynki.
- `biuro` w obu domenach → Marcin, bez kopii w biurze. Konto biura służy też do wysyłania formularza strony.
- Nieznane adresy obu domen → Marcin (catch-all).
- Nowe konta dodawaj przez `add-account.sh`: ustawia wyjątek od catch-all, aby wiadomości trafiały do nowej skrzynki.
- Po dodaniu konta lub aliasu sprawdź odbiór wiadomości wysłanej z zewnątrz.

## Gdy poczta nie działa

Stan usług i ostatnie logi:

```sh
docker compose ps
docker compose logs --tail=50 mailserver roundcube
```

Po błędnych logowaniach sprawdź blokady w obu usługach:

```sh
docker compose exec mailserver fail2ban-client status postfix
docker compose exec mailserver fail2ban-client status dovecot
```

Odblokuj wyłącznie IP użytkownika, w jailu, który je zablokował (podstaw nazwę i IP):

```sh
docker compose exec mailserver fail2ban-client set postfix unbanip ADRES_IP
```

Certyfikaty odnawiają się automatycznie. Pełna kopia nowego środowiska i test odtwarzania pozostają do wykonania według ostatniego zapisanego stanu.

[Ustawienia programów pocztowych](programy-pocztowe.md) · [Konfiguracja techniczna](instalacja/dimundi/email.md) · [Instalacja](instalacja/wspolne/email-instalacja.md) · [Log migracji](instalacja/dimundi/log_migracji.md)

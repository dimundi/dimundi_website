# Metryka techniczna

Stan danych: 2026-10-20. DNS i wyniki SMTP: odczyty z 2026-10-19.

## VPS

| Parametr | Wartość |
| --- | --- |
| Dostawca | OVH |
| System | Debian 13, amd64 |
| Host | `vps-f9b377ab.vps.ovh.net` |
| SSH | `docker@145.239.92.71:22`, klucz SSH |
| Interfejs | `ens3` |
| IPv4 | `145.239.92.71`, `51.68.128.220`, `54.38.134.226`, `51.38.158.255` |
| Kontenery | Docker Engine, Docker Compose |
| Reverse proxy | Nginx |
| Katalog główny | `/home/docker/dimundi` |

## Adresy IP

| IPv4 | Usługa | Nazwa / PTR |
| --- | --- | --- |
| `145.239.92.71` | Strona Dimundi, SMTP/IMAP i webmail Dimundi | PTR: `poczta.dimundi.com` |
| `51.68.128.220` | Webmail WhatTheFrog; poprzedni adres SMTP/IMAP WhatTheFrog | Webmail: `webmail.whatthefrog.pl` |
| `54.38.134.226` | Poprzedni SMTP/IMAP WhatTheFrog; kontener przeniesiony na nowe IP | A/PTR starej nazwy: `poczta.whatthefrog.pl` |
| `51.38.158.255` | Aktywne SMTP/IMAP i wysyłka Whathefrog | A/PTR: `poczta.whathefrog.pl` |
| `46.105.41.88` | Wysyłka starego OVH Exchange, IP odnotowane przez Gmail | Infrastruktura OVH, poza naszym VPS |

## Usługi pocztowe na VPS

| Parametr | Dimundi | WhatTheFrog |
| --- | --- | --- |
| Domeny | `dimundi.com`, aliasy `dimundi.pl` | `whathefrog.pl`, `whatthefrog.pl` |
| SMTP / IMAP | `poczta.dimundi.com` | `poczta.whathefrog.pl` |
| IPv4 SMTP / IMAP | `145.239.92.71` | `51.38.158.255` |
| Webmail | `https://webmail.dimundi.com` | `https://webmail.whathefrog.pl`, `https://webmail.whatthefrog.pl`; jeden Roundcube |
| Projekt Compose | `dimundi-mail` | `whatthefrog-mail` |
| Katalog wdrożenia | `/home/docker/dimundi/poczta/deploy` | `/home/docker/dimundi/whatthefrog/deploy` |
| Pliki w repo | `poczta/dimundi/deploy/` | `poczta/whatthefrog/deploy/` |
| Serwer pocztowy | Docker Mailserver `16.0.1` | Docker Mailserver `16.0.1` |
| Webmail / baza | Roundcube `1.6.19-apache` / SQLite | Roundcube `1.6.19-apache` / SQLite |
| Selektor DKIM | `dimundi2026` | `whathefrog2026` dla `whathefrog.pl`, `whatthefrog2026` dla `whatthefrog.pl` |
| DMARC | `v=DMARC1; p=none` | `v=DMARC1; p=none` |

| Protokół | Port | Szyfrowanie |
| --- | --- | --- |
| SMTP między serwerami | 25 | STARTTLS |
| SMTP użytkowników | 465 | TLS |
| SMTP użytkowników | 587 | STARTTLS |
| IMAP | 993 | TLS |

Login IMAP/SMTP: pełny adres e-mail. SMTP użytkowników: uwierzytelnianie wymagane. POP3 i obsługa poczty po IPv6: wyłączone.

## Konta i routing

| Środowisko | Skrzynki |
| --- | --- |
| Dimundi VPS | `marcin@dimundi.com`, `beata@dimundi.com`, `biuro@dimundi.com`, `whatthefrog@dimundi.com` |
| WhatTheFrog VPS | `marcin@whathefrog.pl`, `biuro@whathefrog.pl` (SMTP formularzy), `marcin@whatthefrog.pl`, `biuro@whatthefrog.pl` |
| OVH Exchange | `biuro@whatthefrog.pl`; serwer źródłowy `ex5.mail.ovh.net` |

| Adres / wzorzec | Cel |
| --- | --- |
| `biuro@dimundi.com`, `biuro@dimundi.pl` | `marcin@dimundi.com` |
| `marcin@dimundi.pl` | `marcin@dimundi.com` |
| `beata@dimundi.pl` | `beata@dimundi.com` |
| `whatthefrog@dimundi.pl` | `whatthefrog@dimundi.com` |
| `postmaster`, `abuse` w `dimundi.com` i `dimundi.pl` | `marcin@dimundi.com` |
| Catch-all `dimundi.com`, `dimundi.pl` | `marcin@dimundi.com`; jawne wyjątki dla osobnych skrzynek |
| `marcin@whatthefrog.pl`, `biuro@whatthefrog.pl` na VPS | `marcin@whathefrog.pl` |
| Catch-all `whatthefrog.pl`, `whathefrog.pl` na VPS | `marcin@whathefrog.pl` |
| `biuro@whathefrog.pl` na VPS | `marcin@whathefrog.pl`, bez lokalnej kopii w biurze |

## DNS odbioru poczty

| Domena | MX | Priorytet |
| --- | --- | --- |
| `dimundi.com`, `dimundi.pl` | `poczta.dimundi.com` | 1 |
| `whathefrog.pl` | `poczta.whathefrog.pl` | 10 |
| `whatthefrog.pl` | `mx0.mail.ovh.net` | 1 |
| `whatthefrog.pl` | `mx1.mail.ovh.net` | 10 |
| `whatthefrog.pl` | `mx2.mail.ovh.net` | 20 |
| `whatthefrog.pl` | `mx3.mail.ovh.net` | 30 |
| `whatthefrog.pl` | `mx4.mail.ovh.net` | 40 |

SPF `whatthefrog.pl`:

```text
v=spf1 include:mx.ovh.com ip4:87.98.236.253 ip4:54.38.134.226 ip4:46.105.0.0/16 ip4:178.33.0.0/16 ip4:54.36.0.0/16 ip4:146.59.0.0/16 mx a ptr ~all
```

DKIM OVH: `ovhex1079186-selector1._domainkey.whatthefrog.pl` → CNAME `ovhex1079186-selector1._domainkey.244956.bt.dkim.mail.ovh.net`.

SPF `whathefrog.pl`: `v=spf1 include:mx.ovh.com ip4:51.38.158.255 -all`. DMARC: `v=DMARC1; p=none`.

MX określa serwery odbioru. IP widziane przez Gmail przy wysyłce jest adresem wyjściowym serwera SMTP; nie wynika z MX domeny nadawcy.

## Wyniki SMTP do Gmail — 2026-10-19

| Nadawca | IP wyjściowe | Wynik |
| --- | --- | --- |
| `biuro@whatthefrog.pl`, OVH | `46.105.41.88` | `550 5.7.1`, `likely unsolicited mail` |
| `marcin@whatthefrog.pl`, VPS | `54.38.134.226` | `550 5.7.1`, `likely unsolicited mail` |
| `whatthefrog@dimundi.com`, VPS | `145.239.92.71` | Przyjęta, folder spam; SPF/DKIM/DMARC `pass`; TLS 1.3 |

Test 2026-10-20: `marcin@whathefrog.pl` z `51.38.158.255`, TLS 1.3; Gmail przyjął do spamu, SPF/DKIM/DMARC `pass`. Odpowiedź z Gmaila odebrana na nowej skrzynce.

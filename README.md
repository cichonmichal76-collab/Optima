# Optima SQL GUI MVP

Lokalny panel web w Pythonie do bezpiecznego podgladu danych z odtworzonej kopii bazy Comarch ERP Optima. Projekt jest przygotowany jako MVP tylko do odczytu: bez Internetu, bez COM, bez zapisu do Optimy i bez recznego uploadu plikow w przegladarce.

## Co juz jest w repo

- podlaczenie lokalnego backupu `.BAK`/`.BAC` do bazy roboczej read-only,
- skanowanie dyskow w poszukiwaniu backupow Optimy,
- kafel `Dostepne dane` z pewnymi modulami wykrytymi w bazie,
- pobieranie podgladu danych bezposrednio z SQL,
- jawne zapytania SQL dla odtworzonej bazy Optima: VAT, dekrety, plan kont, rozrachunki, bank/kasa, JPK/deklaracje, kontrahenci, dokumenty, srodki trwale oraz kadry/place,
- testy `pytest` dla najwazniejszych scenariuszy SQL MVP.

## Wymagania

- Python 3.11+
- system Windows, macOS lub Linux
- lokalny SQL Server Express z odtworzona kopia albo backup `.BAK`/`.BAC`

## Instalacja

```powershell
pip install -r requirements.txt
```

## Uruchomienie web GUI na localhost

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Adres: `http://127.0.0.1:8000/`

Wariant web z lokalnym backendem Python i polaczeniem do SQL:

```powershell
python serve.py
```

Web GUI jest lekkim lokalnym panelem do podgladu danych z odtworzonej kopii bazy Comarch ERP Optima. Reczny import plikow w panelu web jest wylaczony: praca startuje od wskazania lokalnego backupu `.BAK`/`.BAC` albo od wybrania gotowej bazy roboczej SQL.

Po uruchomieniu przez `python serve.py` panel web prowadzi prace od bazy SQL: wskazujesz lokalny plik `.BAK`/`.BAC`, program sprawdza backup, odtwarza go do bazy roboczej read-only, a nastepnie pokazuje kafel `Dostepne dane` w sidebarze. Obslugiwane pewne moduly do pobrania: rejestry VAT, dekrety, plan kont, rozrachunki, bank/kasa, JPK/deklaracje, kontrahenci, dokumenty, srodki trwale oraz kadry/place.

## Eksport z odtworzonej bazy SQL Optima

Eksport SQL jest read-only i korzysta z `sqlcmd`. Przyklad dla odtworzonej bazy firmowej na lokalnej instancji:

```powershell
python tools/export_optima_sql.py --kind VAT_PURCHASE --period 202603 --output exports/vat_zakup_202603.tsv
python tools/export_optima_sql.py --kind VAT_SALE --period 202603 --output exports/vat_sprzedaz_202603.tsv
python tools/export_optima_sql.py --kind LEDGER --period 202603 --output exports/dekrety_202603.tsv
python tools/export_optima_sql.py --kind ACCOUNT_PLAN --output exports/plan_kont.tsv
```

Pliki TSV z narzedzia CLI sa przeznaczone do kontroli technicznej poza web GUI. Panel web pobiera dane bezposrednio z SQL i pokazuje polskie naglowki w podgladzie.

## Uruchomienie testow

```powershell
pytest
```

## Przykladowy przeplyw pracy

1. Uzytkownik wskazuje lokalny backup `.BAK`/`.BAC` albo gotowa baze robocza SQL.
2. Program sprawdza backup, odtwarza kopie read-only i pokazuje kafel `Dostepne dane`.
3. Uzytkownik wybiera pewny modul danych, np. VAT, dekrety, kontrahentow albo rozrachunki.
4. Program pobiera dane z SQL i pokazuje podglad pierwszych wierszy.
5. Uzytkownik moze zmienic modul danych albo okres i odswiezyc podglad.

## Bezpieczenstwo MVP

- brak polaczen HTTP,
- brak zapisu SQL do Optimy,
- brak COM do Optimy,
- brak automatycznego importu do Optimy,
- brak automatycznej korekty danych,
- wszystkie dane pozostaja lokalnie.

## Struktura

```text
app.py
data/
exports/
src/
tests/
```

## Uwagi

- GUI jest lekkim MVP i daje miejsce na dalsze dopracowanie ergonomii.
- Konektory `TXT/COMMA` i `MT940` sa przygotowane architektonicznie, ale oznaczone jako eksperymentalne.

# Optima Audit GUI MVP

Desktopowa aplikacja offline w Pythonie do audytu danych eksportowanych z Comarch ERP Optima oraz do przygotowywania projektow schematow ksiegowych. Projekt jest przygotowany jako bezpieczny MVP: bez Internetu, bez COM i bez zapisu do Optimy. Opcjonalny eksport SQL dziala tylko read-only na odtworzonej kopii bazy.

## Co juz jest w repo

- kanoniczne modele danych dla VAT, ksiegowan, planu kont, rozrachunkow i wynikow audytu,
- normalizacja dat, kwot i naglowkow,
- detekcja formatu oraz konektory dla `XLSX`, `XLS`, `CSV`, `JPK XML` i technicznego podgladu XML schematow,
- kreator mapowania kolumn z auto-detekcja typowych pol Optimy,
- reguly audytu VAT, ksiegowan, planu kont, rozrachunkow, banku i schematow,
- eksport raportow do `XLSX`, `HTML` i `JSON`,
- jawne mapowania SQL dla odtworzonej bazy Optima: rejestry VAT, dekrety ksiegowe i plan kont,
- lokalny store ustawien i profili mapowania w JSON i SQLite,
- lekkie GUI PySide6 z ekranem glownym, importem, mapowaniem, dashboardem, raportem i kreatorem schematow,
- testy `pytest` dla najwazniejszych scenariuszy MVP.

## Wymagania

- Python 3.11+
- system Windows, macOS lub Linux
- praca lokalna na plikach eksportowanych przez uzytkownika

## Instalacja

```powershell
pip install -r requirements.txt
```

## Uruchomienie GUI

```powershell
python app.py
```

## Uruchomienie web GUI na localhost

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Adres: `http://127.0.0.1:8000/`

Lepszy wariant, z obsluga podgladu legacy XLS przez lokalny backend Python:

```powershell
python serve.py
```

Web GUI jest lekkim lokalnym panelem do podgladu, mapowania i szybkiego audytu XLSX/XLS/CSV/JSON/XML w przegladarce. Pelna aplikacja desktopowa pozostaje w `app.py`.

Po uruchomieniu przez `python serve.py` panel web prowadzi prace od bazy SQL: wskazujesz lokalny plik `.BAK`/`.BAC`, program sprawdza backup, odtwarza go do bazy roboczej read-only, a nastepnie pokazuje kafel `Dostepne dane` w sidebarze. Obslugiwane pewne moduly do pobrania: rejestry VAT, dekrety, plan kont, rozrachunki, bank/kasa, JPK/deklaracje, kontrahenci, dokumenty, srodki trwale oraz kadry/place.

## Eksport z odtworzonej bazy SQL Optima

Eksport SQL jest read-only i korzysta z `sqlcmd`. Przyklad dla odtworzonej bazy firmowej na lokalnej instancji:

```powershell
python tools/export_optima_sql.py --kind VAT_PURCHASE --period 202603 --output exports/vat_zakup_202603.tsv
python tools/export_optima_sql.py --kind VAT_SALE --period 202603 --output exports/vat_sprzedaz_202603.tsv
python tools/export_optima_sql.py --kind LEDGER --period 202603 --output exports/dekrety_202603.tsv
python tools/export_optima_sql.py --kind ACCOUNT_PLAN --output exports/plan_kont.tsv
```

Pliki TSV mozna wczytac w web GUI tak samo jak CSV. Naglowki sa po polsku i mapuja sie na pola aplikacji.

## Uruchomienie testow

```powershell
pytest
```

## Przykladowy przeplyw pracy

1. Uzytkownik wybiera typ danych w kreatorze importu.
2. Program rozpoznaje format i pokazuje podglad pierwszych wierszy lub struktury XML.
3. Uzytkownik akceptuje lub poprawia mapowanie kolumn.
4. Silnik audytu generuje liste bledow i ostrzezen.
5. Wyniki sa eksportowane do `JSON`, `HTML` lub `XLSX`.
6. Wszystkie raporty zawieraja informacje, ze wynik wymaga weryfikacji przez osobe odpowiedzialna za ksiegowosc.

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
- Generator schematow tworzy projekt i raport walidacyjny, a nie gotowy XML importowy do Optimy.

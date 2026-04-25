# Optima Audit GUI MVP

Desktopowa aplikacja offline w Pythonie do audytu danych eksportowanych z Comarch ERP Optima oraz do przygotowywania projektow schematow ksiegowych. Projekt jest przygotowany jako bezpieczny MVP: bez Internetu, bez SQL, bez COM i bez zapisu do Optimy.

## Co juz jest w repo

- kanoniczne modele danych dla VAT, ksiegowan, planu kont, rozrachunkow i wynikow audytu,
- normalizacja dat, kwot i naglowkow,
- detekcja formatu oraz konektory dla `XLSX`, `XLS`, `CSV`, `JPK XML` i technicznego podgladu XML schematow,
- kreator mapowania kolumn z auto-detekcja typowych pol Optimy,
- reguly audytu VAT, ksiegowan, planu kont, rozrachunkow, banku i schematow,
- eksport raportow do `XLSX`, `HTML` i `JSON`,
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
- brak SQL do Optimy,
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


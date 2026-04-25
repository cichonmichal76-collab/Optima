from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from src.connectors.optima_sql_mapping import build_optima_sql_query
from src.core.enums import DataKind


@dataclass(frozen=True)
class DataModule:
    code: str
    label: str
    description: str
    count_sql: str
    query_sql: str | None = None
    period_field: str | None = None
    sensitive: bool = False


DATA_MODULES: tuple[DataModule, ...] = (
    DataModule(
        code="VAT_PURCHASE",
        label="Rejestr VAT zakup",
        description="Faktury zakupu z rejestru VAT, kwoty netto/VAT/brutto, kontrahenci i okres VAT.",
        count_sql="SELECT COUNT(*) AS record_count FROM CDN.VatNag WHERE VaN_Rejestr = N'ZAKUP'",
        query_sql=None,
        period_field="VaN_DeklRokMies",
    ),
    DataModule(
        code="VAT_SALE",
        label="Rejestr VAT sprzedaż",
        description="Faktury sprzedaży z rejestru VAT, kwoty netto/VAT/brutto, kontrahenci i okres VAT.",
        count_sql="SELECT COUNT(*) AS record_count FROM CDN.VatNag WHERE VaN_Rejestr = N'SPRZEDAŻ'",
        query_sql=None,
        period_field="VaN_DeklRokMies",
    ),
    DataModule(
        code="LEDGER",
        label="Dekrety księgowe",
        description="Zapisy księgowe Wn/Ma, dzienniki, status bufora i konta z planu kont.",
        count_sql="SELECT COUNT(*) AS record_count FROM CDN.DekretyElem AS e JOIN CDN.DekretyNag AS n ON n.DeN_DeNId = e.DeE_DeNId",
        query_sql=None,
        period_field="n.DeN_DataDok",
    ),
    DataModule(
        code="ACCOUNT_PLAN",
        label="Plan kont",
        description="Konta księgowe, aktywność, typ konta i znaczniki JPK.",
        count_sql="SELECT COUNT(*) AS record_count FROM CDN.Konta",
        query_sql=None,
    ),
    DataModule(
        code="SETTLEMENTS",
        label="Rozrachunki",
        description="Rozrachunki księgowe, terminy płatności, kwoty, rozliczenia i salda.",
        count_sql="SELECT COUNT(*) AS record_count FROM CDN.KsiRozrachunki",
        query_sql="""
SELECT
    KRo_Dokument AS [Numer dokumentu],
    CONVERT(varchar(10), KRo_DataDokumentu, 23) AS [Data dokumentu],
    CONVERT(varchar(10), KRo_TerminPlatnosci, 23) AS [Termin płatności],
    CONVERT(varchar(10), KRo_DataRozliczenia, 23) AS [Data rozliczenia],
    CAST(KRo_KwotaDok AS decimal(18, 2)) AS [Kwota dokumentu],
    CAST(KRo_Kwota AS decimal(18, 2)) AS [Kwota],
    CAST(KRo_SumRozliczen AS decimal(18, 2)) AS [Suma rozliczeń],
    CAST(KRo_Kwota - KRo_SumRozliczen AS decimal(18, 2)) AS [Pozostało],
    KRo_Konto AS [Konto],
    KRo_KontoPrzeciw AS [Konto przeciwstawne],
    KRo_Dziennik AS [Dziennik],
    CASE WHEN KRo_Bufor = 0 THEN N'Zatwierdzone' ELSE N'Bufor' END AS [Status],
    KRo_KRoId AS [Optima KRoID]
FROM CDN.KsiRozrachunki
{where}
ORDER BY KRo_DataDokumentu DESC, KRo_KRoId DESC;
""".strip(),
        period_field="KRo_DataDokumentu",
    ),
    DataModule(
        code="BANK",
        label="Bank / kasa",
        description="Zapisy bankowe i kasowe, kwoty, rozliczenia, kontrahenci i opisy operacji.",
        count_sql="SELECT COUNT(*) AS record_count FROM CDN.BnkZapisy",
        query_sql="""
SELECT
    BZp_NumerPelny AS [Numer zapisu],
    BZp_NumerObcy AS [Numer obcy],
    CONVERT(varchar(10), BZp_DataDok, 23) AS [Data dokumentu],
    NULLIF(LTRIM(RTRIM(CONCAT(BZp_Nazwa1, ' ', BZp_Nazwa2, ' ', BZp_Nazwa3))), '') AS [Kontrahent],
    CAST(BZp_Kwota AS decimal(18, 2)) AS [Kwota],
    CAST(BZp_KwotaRoz AS decimal(18, 2)) AS [Kwota rozliczona],
    BZp_Waluta AS [Waluta],
    BZp_Kierunek AS [Kierunek],
    BZp_Rozliczono AS [Rozliczono],
    BZp_KontoPrzeciwstawne AS [Konto przeciwstawne],
    BZp_Opis AS [Opis],
    BZp_BZpID AS [Optima BZpID]
FROM CDN.BnkZapisy
{where}
ORDER BY BZp_DataDok DESC, BZp_BZpID DESC;
""".strip(),
        period_field="BZp_DataDok",
    ),
    DataModule(
        code="JPK_DECLARATIONS",
        label="JPK i deklaracje",
        description="Nagłówki JPK, okresy, typy plików, liczby wierszy i sumy kontrolne.",
        count_sql="SELECT COUNT(*) AS record_count FROM CDN.JpkNag",
        query_sql="""
SELECT
    Id AS [JPK ID],
    Typ AS [Typ JPK],
    CelZlozenia AS [Cel złożenia],
    CONVERT(varchar(10), DataOd, 23) AS [Data od],
    CONVERT(varchar(10), DataDo, 23) AS [Data do],
    CONVERT(varchar(19), DataWytworzenia, 120) AS [Data wytworzenia],
    PodNIP AS [NIP podmiotu],
    PodPelnaNazwa AS [Podmiot],
    LiczbaWierszy AS [Liczba wierszy],
    CAST(Suma AS decimal(18, 2)) AS [Suma],
    Wersja AS [Wersja],
    CASE WHEN Bufor = 0 THEN N'Zatwierdzone' ELSE N'Bufor' END AS [Status]
FROM CDN.JpkNag
{where}
ORDER BY DataWytworzenia DESC, Id DESC;
""".strip(),
        period_field="DataOd",
    ),
    DataModule(
        code="CONTRACTORS",
        label="Kontrahenci",
        description="Kartoteka kontrahentów: kod, nazwa, NIP, adres, rachunek i status aktywności.",
        count_sql="SELECT COUNT(*) AS record_count FROM CDN.Kontrahenci",
        query_sql="""
SELECT
    Knt_Kod AS [Kod kontrahenta],
    NULLIF(LTRIM(RTRIM(CONCAT(Knt_Nazwa1, ' ', Knt_Nazwa2, ' ', Knt_Nazwa3))), '') AS [Kontrahent],
    Knt_NipE AS [NIP],
    Knt_Regon AS [REGON],
    Knt_Miasto AS [Miasto],
    Knt_Ulica AS [Ulica],
    Knt_RachunekNr AS [Rachunek],
    Knt_KontoOdb AS [Konto odbiorcy],
    Knt_KontoDost AS [Konto dostawcy],
    CASE WHEN Knt_Nieaktywny = 0 THEN N'Aktywny' ELSE N'Nieaktywny' END AS [Status],
    Knt_KntId AS [Optima KntID]
FROM CDN.Kontrahenci
ORDER BY Knt_Kod, Knt_KntId;
""".strip(),
    ),
    DataModule(
        code="DOCUMENTS",
        label="Dokumenty i załączniki",
        description="Obieg dokumentów: nagłówki, tytuły, daty, statusy oraz liczba podpiętych plików.",
        count_sql="SELECT COUNT(*) AS record_count FROM CDN.DokNag AS d",
        query_sql="""
SELECT
    d.DoN_NumerPelny AS [Numer dokumentu],
    d.DoN_NumerObcy AS [Numer obcy],
    d.DoN_Tytul AS [Tytuł],
    d.DoN_Dotyczy AS [Dotyczy],
    CONVERT(varchar(10), d.DoN_DataDok, 23) AS [Data dokumentu],
    d.DoN_Status AS [Status],
    d.DoN_Typ AS [Typ],
    COUNT(p.DnP_DnPID) AS [Liczba plików],
    d.DoN_DoNID AS [Optima DoNID]
FROM CDN.DokNag AS d
LEFT JOIN CDN.DokNagPliki AS p ON p.DnP_DoNID = d.DoN_DoNID
{where}
GROUP BY d.DoN_NumerPelny, d.DoN_NumerObcy, d.DoN_Tytul, d.DoN_Dotyczy,
    d.DoN_DataDok, d.DoN_Status, d.DoN_Typ, d.DoN_DoNID
ORDER BY d.DoN_DataDok DESC, d.DoN_DoNID DESC;
""".strip(),
        period_field="d.DoN_DataDok",
    ),
    DataModule(
        code="FIXED_ASSETS",
        label="Środki trwałe",
        description="Kartoteka środków trwałych, wartości, konta amortyzacji i statusy.",
        count_sql="SELECT COUNT(*) AS record_count FROM CDN.Trwale",
        query_sql="""
SELECT
    SrT_Dokument AS [Dokument],
    SrT_Nazwa AS [Nazwa],
    SrT_Grupa AS [Grupa],
    SrT_KRST AS [KŚT],
    SrT_NrInwent AS [Nr inwentarzowy],
    CONVERT(varchar(10), SrT_DataZak, 23) AS [Data zakupu],
    CONVERT(varchar(10), SrT_DataPrz, 23) AS [Data przyjęcia],
    CAST(SrT_WartoscBilan AS decimal(18, 2)) AS [Wartość bilansowa],
    CAST(SrT_WartoscKoszt AS decimal(18, 2)) AS [Wartość kosztowa],
    SrT_KontoGl AS [Konto główne],
    SrT_KontoUm AS [Konto umorzenia],
    SrT_KontoAmKoszt AS [Konto amortyzacji koszt],
    SrT_Stan AS [Stan],
    SrT_SrTID AS [Optima SrTID]
FROM CDN.Trwale
{where}
ORDER BY SrT_DataZak DESC, SrT_SrTID DESC;
""".strip(),
        period_field="SrT_DataZak",
    ),
    DataModule(
        code="HR_PAYROLL",
        label="Kadry i płace",
        description="Etaty i wypłaty. Dane wrażliwe: w podglądzie PESEL jest maskowany.",
        count_sql="SELECT COUNT(*) AS record_count FROM CDN.PracEtaty",
        query_sql="""
SELECT
    e.PRE_Kod AS [Kod pracownika],
    e.PRE_Nazwisko AS [Nazwisko],
    e.PRE_Imie1 AS [Imię],
    CASE WHEN LEN(e.PRE_Pesel) >= 4 THEN CONCAT(LEFT(e.PRE_Pesel, 2), '*******', RIGHT(e.PRE_Pesel, 2)) ELSE NULL END AS [PESEL maskowany],
    CONVERT(varchar(10), e.PRE_ZatrudnionyOd, 23) AS [Zatrudniony od],
    CONVERT(varchar(10), e.PRE_ZatrudnionyDo, 23) AS [Zatrudniony do],
    COUNT(w.WPL_WplId) AS [Liczba wypłat],
    CAST(SUM(COALESCE(w.WPL_Brutto, 0)) AS decimal(18, 2)) AS [Brutto wypłat],
    e.PRE_PreId AS [Optima PreID]
FROM CDN.PracEtaty AS e
LEFT JOIN CDN.Wyplaty AS w ON w.WPL_PraId = e.PRE_PraId
{where}
GROUP BY e.PRE_Kod, e.PRE_Nazwisko, e.PRE_Imie1, e.PRE_Pesel,
    e.PRE_ZatrudnionyOd, e.PRE_ZatrudnionyDo, e.PRE_PreId
ORDER BY e.PRE_Nazwisko, e.PRE_Imie1, e.PRE_PreId;
""".strip(),
        sensitive=True,
    ),
)


MODULE_BY_CODE = {module.code: module for module in DATA_MODULES}


def build_available_data_sql(
    period_yyyymm: int | str | None = None,
    *,
    year: int | str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> str:
    parts = []
    for module in DATA_MODULES:
        count_sql = _append_condition(
            module.count_sql,
            _module_count_condition(module, period_yyyymm, year=year, date_from=date_from, date_to=date_to),
        )
        parts.append(
            f"""
SELECT
    N'{module.code}' AS [code],
    N'{module.label}' AS [label],
    N'{module.description}' AS [description],
    ({count_sql}) AS [record_count],
    {1 if module.query_sql is not None or module.code in {'VAT_PURCHASE', 'VAT_SALE', 'LEDGER', 'ACCOUNT_PLAN'} else 0} AS [loadable],
    {1 if module.sensitive else 0} AS [sensitive]
""".strip()
        )
    return "SET NOCOUNT ON;\n" + "\nUNION ALL\n".join(parts) + "\nORDER BY [record_count] DESC, [label];"


def build_module_query(
    module_code: str,
    period_yyyymm: int | str | None = None,
    *,
    year: int | str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> tuple[str, tuple[str, ...]]:
    if module_code in {"VAT_PURCHASE", "VAT_SALE", "LEDGER", "ACCOUNT_PLAN"}:
        data_kind = DataKind(module_code)
        query = build_optima_sql_query(data_kind, period_yyyymm, year=year, date_from=date_from, date_to=date_to)
        return query.sql, query.notes

    module = MODULE_BY_CODE.get(module_code)
    if not module or not module.query_sql:
        raise ValueError(f"Brak jawnego zapytania SQL dla modułu: {module_code}")

    where = _period_where(module.period_field, period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    notes = (f"{module.label}: dane pobierane z jawnych tabel CDN Optimy.",)
    if module.sensitive:
        notes += ("Ten moduł zawiera dane wrażliwe; podgląd ogranicza część identyfikatorów.",)
    return "SET NOCOUNT ON;\n" + module.query_sql.format(where=where), notes


def _period_where(
    period_field: str | None,
    period_yyyymm: int | str | None,
    *,
    year: int | str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> str:
    condition = _date_condition(period_field, period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    return f"WHERE {condition}" if condition else ""


def _module_count_condition(
    module: DataModule,
    period_yyyymm: int | str | None,
    *,
    year: int | str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> str:
    if module.code in {"VAT_PURCHASE", "VAT_SALE"}:
        return _vat_count_condition(period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    return _date_condition(module.period_field, period_yyyymm, year=year, date_from=date_from, date_to=date_to)


def _append_condition(sql: str, condition: str) -> str:
    if not condition:
        return sql
    glue = " AND " if " WHERE " in f" {sql.upper()} " else " WHERE "
    return f"{sql}{glue}{condition}"


def _date_condition(
    period_field: str | None,
    period_yyyymm: int | str | None,
    *,
    year: int | str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> str:
    if not period_field:
        return ""
    start, end = _date_bounds(period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    conditions = []
    if start:
        conditions.append(f"{period_field} >= '{start.isoformat()}'")
    if end:
        conditions.append(f"{period_field} < '{end.isoformat()}'")
    return " AND ".join(conditions)


def _vat_count_condition(
    period_yyyymm: int | str | None,
    *,
    year: int | str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> str:
    if date_from or date_to:
        return _date_condition("VaN_DataWys", None, date_from=date_from, date_to=date_to)

    period = _normalize_period(period_yyyymm)
    if period is not None:
        return f"VaN_DeklRokMies = {period}"

    normalized_year = _normalize_year(year)
    if normalized_year is not None:
        return f"VaN_DeklRokMies >= {normalized_year}01 AND VaN_DeklRokMies <= {normalized_year}12"

    return ""


def _date_bounds(
    period_yyyymm: int | str | None,
    *,
    year: int | str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> tuple[date | None, date | None]:
    start = _normalize_date(date_from, "Data od")
    end = _normalize_date(date_to, "Data do")
    if start or end:
        if start and end and start > end:
            raise ValueError("Data od nie może być późniejsza niż data do.")
        return start, end + timedelta(days=1) if end else None

    if not period_yyyymm:
        normalized_year = _normalize_year(year)
        if normalized_year is None:
            return None, None
        return date(normalized_year, 1, 1), date(normalized_year + 1, 1, 1)

    text = _period_text(period_yyyymm)
    year_value = int(text[:4])
    month = int(text[4:])
    next_year = year_value + 1 if month == 12 else year_value
    next_month = 1 if month == 12 else month + 1
    return date(year_value, month, 1), date(next_year, next_month, 1)


def _normalize_period(period_yyyymm: int | str | None) -> int | None:
    if period_yyyymm in (None, ""):
        return None
    return int(_period_text(period_yyyymm))


def _period_text(period_yyyymm: int | str) -> str:
    text = str(period_yyyymm).strip()
    if len(text) != 6 or not text.isdigit():
        raise ValueError("Okres musi mieć format RRRRMM, np. 202603.")
    month = int(text[4:])
    if not 1 <= month <= 12:
        raise ValueError("Miesiąc w okresie RRRRMM musi być z zakresu 01-12.")
    return text


def _normalize_year(year: int | str | None) -> int | None:
    if year in (None, ""):
        return None
    text = str(year).strip()
    if len(text) != 4 or not text.isdigit():
        raise ValueError("Rok musi mieć format RRRR, np. 2026.")
    return int(text)


def _normalize_date(value: str | None, label: str) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value).strip())
    except ValueError as exc:
        raise ValueError(f"{label} musi mieć format RRRR-MM-DD.") from exc

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from src.core.enums import DataKind


@dataclass(frozen=True)
class OptimaSqlQuery:
    data_kind: DataKind
    sql: str
    notes: tuple[str, ...]


def build_optima_sql_query(data_kind: DataKind, period_yyyymm: int | str | None = None) -> OptimaSqlQuery:
    if data_kind == DataKind.VAT_PURCHASE:
        return _build_vat_query(data_kind, period_yyyymm, "ZAKUP")
    if data_kind == DataKind.VAT_SALE:
        return _build_vat_query(data_kind, period_yyyymm, "SPRZEDAŻ")
    if data_kind == DataKind.LEDGER:
        return _build_ledger_query(period_yyyymm)
    if data_kind == DataKind.ACCOUNT_PLAN:
        return _build_account_plan_query()
    raise ValueError(f"Brak jawnego mapowania SQL dla typu danych: {data_kind.value}")


def _build_vat_query(data_kind: DataKind, period_yyyymm: int | str | None, register_name: str) -> OptimaSqlQuery:
    period = _normalize_period(period_yyyymm)
    period_filter = f"AND n.VaN_DeklRokMies = {period}" if period is not None else ""
    sql = f"""
SET NOCOUNT ON;
WITH VatPozycje AS (
    SELECT
        VaT_VaNID,
        SUM(VaT_NettoDoVAT) AS NettoDoVAT,
        SUM(VaT_VATDoVAT) AS VATDoVAT
    FROM CDN.VatTab
    GROUP BY VaT_VaNID
)
SELECT
    n.VaN_Dokument AS [Numer dokumentu],
    CONVERT(varchar(10), n.VaN_DataWys, 23) AS [Data wystawienia],
    CONVERT(varchar(10), n.VaN_DataZap, 23) AS [Data wpływu],
    n.VaN_KntNipE AS [NIP kontrahenta],
    NULLIF(LTRIM(RTRIM(CONCAT(n.VaN_KntNazwa1, ' ', n.VaN_KntNazwa2, ' ', n.VaN_KntNazwa3))), '') AS [Kontrahent],
    CAST(COALESCE(p.NettoDoVAT, n.VaN_RazemNetto) AS decimal(18, 2)) AS [Kwota netto],
    CAST(COALESCE(p.VATDoVAT, n.VaN_RazemVAT) AS decimal(18, 2)) AS [Kwota VAT],
    CAST(COALESCE(p.NettoDoVAT + p.VATDoVAT, n.VaN_RazemBrutto) AS decimal(18, 2)) AS [Kwota brutto],
    n.VaN_Rejestr AS [Rejestr],
    n.VaN_DeklRokMies AS [Okres VAT],
    n.VaN_IdentKsieg AS [Identyfikator księgowy],
    n.VaN_VaNID AS [Optima VaNID]
FROM CDN.VatNag AS n
LEFT JOIN VatPozycje AS p ON p.VaT_VaNID = n.VaN_VaNID
WHERE n.VaN_Rejestr = N'{register_name}'
{period_filter}
ORDER BY n.VaN_DataWys, n.VaN_Dokument, n.VaN_VaNID;
""".strip()
    return OptimaSqlQuery(
        data_kind=data_kind,
        sql=sql,
        notes=(
            "VAT: dokumenty z CDN.VatNag, kwoty z sum CDN.VatTab.VaT_NettoDoVAT i VaT_VATDoVAT.",
            "Stawka VAT nie jest mapowana, bo aplikacja audytuje kwoty dokumentu, nie stawki pozycji.",
        ),
    )


def _build_ledger_query(period_yyyymm: int | str | None) -> OptimaSqlQuery:
    period = _normalize_period(period_yyyymm)
    date_filter = ""
    if period is not None:
        start, end = _month_bounds(period)
        date_filter = f"WHERE n.DeN_DataDok >= '{start.isoformat()}' AND n.DeN_DataDok < '{end.isoformat()}'"

    sql = f"""
SET NOCOUNT ON;
SELECT
    COALESCE(NULLIF(e.DeE_Dokument, ''), n.DeN_Dokument) AS [Numer dokumentu],
    CONVERT(varchar(10), n.DeN_DataDok, 23) AS [Data księgowania],
    CONVERT(varchar(10), n.DeN_DataOpe, 23) AS [Data operacji],
    COALESCE(NULLIF(e.DeE_Kategoria, ''), n.DeN_Kategoria) AS [Opis],
    e.DeE_KontoWn AS [Konto Wn],
    e.DeE_KontoMa AS [Konto Ma],
    CAST(CASE WHEN e.DeE_AccWnId IS NOT NULL THEN e.DeE_Kwota ELSE 0 END AS decimal(18, 2)) AS [Kwota Wn],
    CAST(CASE WHEN e.DeE_AccMaId IS NOT NULL THEN e.DeE_Kwota ELSE 0 END AS decimal(18, 2)) AS [Kwota Ma],
    n.DeN_Dziennik AS [Dziennik],
    NULLIF(LTRIM(RTRIM(CONCAT(p.Pod_Nazwa1, ' ', p.Pod_Nazwa2))), '') AS [Kontrahent],
    p.Pod_NIP AS [NIP kontrahenta],
    CASE WHEN n.DeN_Bufor = 0 THEN N'Zatwierdzone' ELSE N'Bufor' END AS [Status],
    n.DeN_DeNId AS [Optima DeNID],
    e.DeE_DeEId AS [Optima DeEID]
FROM CDN.DekretyNag AS n
JOIN CDN.DekretyElem AS e ON e.DeE_DeNId = n.DeN_DeNId
LEFT JOIN CDN.PodmiotyView AS p
    ON p.Pod_PodmiotTyp = n.DeN_PodmiotTyp
   AND p.Pod_PodId = n.DeN_PodmiotId
{date_filter}
ORDER BY n.DeN_DataDok, n.DeN_DeNId, e.DeE_Lp;
""".strip()
    return OptimaSqlQuery(
        data_kind=DataKind.LEDGER,
        sql=sql,
        notes=(
            "Księgowość: pozycje z CDN.DekretyElem, nagłówki z CDN.DekretyNag.",
            "Strony Wn/Ma są jawne: DeE_AccWnId/DeE_KontoWn i DeE_AccMaId/DeE_KontoMa.",
        ),
    )


def _build_account_plan_query() -> OptimaSqlQuery:
    sql = """
SET NOCOUNT ON;
SELECT
    Acc_Numer AS [Numer konta],
    Acc_Nazwa AS [Nazwa],
    Acc_TypKonta AS [Typ konta],
    CASE WHEN Acc_NieAktywne = 0 THEN N'TAK' ELSE N'NIE' END AS [Czy aktywne],
    Acc_JpkTyp1 AS [Znacznik JPK S_12_1],
    Acc_JpkTyp2 AS [Znacznik JPK S_12_2],
    Acc_JpkTyp3 AS [Znacznik JPK S_12_3],
    Acc_AccId AS [Optima AccID]
FROM CDN.Konta
ORDER BY Acc_NumerIdx, Acc_Numer;
""".strip()
    return OptimaSqlQuery(
        data_kind=DataKind.ACCOUNT_PLAN,
        sql=sql,
        notes=("Plan kont: jawne pola z CDN.Konta.",),
    )


def _normalize_period(period_yyyymm: int | str | None) -> int | None:
    if period_yyyymm in (None, ""):
        return None
    text = str(period_yyyymm).strip()
    if len(text) != 6 or not text.isdigit():
        raise ValueError("Okres musi mieć format RRRRMM, np. 202603.")
    month = int(text[4:6])
    if not 1 <= month <= 12:
        raise ValueError("Miesiąc w okresie RRRRMM musi być z zakresu 01-12.")
    return int(text)


def _month_bounds(period_yyyymm: int) -> tuple[date, date]:
    year = period_yyyymm // 100
    month = period_yyyymm % 100
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1)
    else:
        end = date(year, month + 1, 1)
    return start, end

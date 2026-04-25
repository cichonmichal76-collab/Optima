from __future__ import annotations

from dataclasses import dataclass

from src.connectors.optima_data_catalog import _period_where


@dataclass(frozen=True)
class OptimaReportQuery:
    report_key: str
    sql: str
    notes: tuple[str, ...]


def build_report_query(
    report_key: str,
    period_yyyymm: int | str | None = None,
    *,
    year: int | str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> OptimaReportQuery:
    if report_key == "manual-entries":
        return _build_manual_entries_report(period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    raise ValueError(f"Brak jawnego zapytania SQL dla raportu: {report_key}")


def _build_manual_entries_report(
    period_yyyymm: int | str | None,
    *,
    year: int | str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> OptimaReportQuery:
    where = _period_where("n.DeN_DataDok", period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    time_condition = where.replace("WHERE ", "AND ", 1) if where else ""
    sql = f"""
SET NOCOUNT ON;
SELECT
    CONVERT(varchar(10), n.DeN_DataDok, 23) AS [Data],
    COALESCE(NULLIF(n.DeN_Dziennik, ''), CAST(n.DeN_Typ AS varchar(20))) AS [Typ],
    COALESCE(NULLIF(n.DeN_Dokument, ''), n.DeN_NumerPelny, CAST(n.DeN_DeNId AS varchar(20))) AS [Numer],
    NULLIF(LTRIM(RTRIM(CONCAT(p.Pod_Nazwa1, ' ', p.Pod_Nazwa2))), '') AS [Kontrahent],
    CAST(
        CASE
            WHEN ABS(COALESCE(n.DeN_KwotaWn, 0)) >= ABS(COALESCE(n.DeN_KwotaMa, 0))
                THEN COALESCE(n.DeN_KwotaWn, 0)
            ELSE COALESCE(n.DeN_KwotaMa, 0)
        END AS decimal(18, 2)
    ) AS [Brutto],
    wn.KontaWn AS [Konto Wn],
    ma.KontaMa AS [Konto Ma],
    NULLIF(LTRIM(RTRIM(CONCAT(n.DeN_OpeZalKod, ' ', n.DeN_OpeZalNazwisko))), '') AS [Osoba księgująca],
    COALESCE(NULLIF(n.DeN_Kategoria, ''), NULLIF(n.DeN_RodzajDowoduKsiegowego, ''), N'Jest dekret, brak schematu/wzorca') AS [Uwagi],
    N'Księgowanie ręczne: dekret istnieje, ale brak schematu' AS [Wniosek],
    n.DeN_DeNId AS [Optima DeNID]
FROM CDN.DekretyNag AS n
LEFT JOIN CDN.PodmiotyView AS p
    ON p.Pod_PodmiotTyp = n.DeN_PodmiotTyp
   AND p.Pod_PodId = n.DeN_PodmiotId
OUTER APPLY (
    SELECT STRING_AGG(CONVERT(nvarchar(max), x.KontoWn), N', ') AS KontaWn
    FROM (
        SELECT DISTINCT NULLIF(e.DeE_KontoWn, '') AS KontoWn
        FROM CDN.DekretyElem AS e
        WHERE e.DeE_DeNId = n.DeN_DeNId
          AND NULLIF(e.DeE_KontoWn, '') IS NOT NULL
    ) AS x
) AS wn
OUTER APPLY (
    SELECT STRING_AGG(CONVERT(nvarchar(max), x.KontoMa), N', ') AS KontaMa
    FROM (
        SELECT DISTINCT NULLIF(e.DeE_KontoMa, '') AS KontoMa
        FROM CDN.DekretyElem AS e
        WHERE e.DeE_DeNId = n.DeN_DeNId
          AND NULLIF(e.DeE_KontoMa, '') IS NOT NULL
    ) AS x
) AS ma
WHERE
    (n.DeN_WzorzecId IS NULL OR n.DeN_WzorzecId = 0 OR n.DeN_WzorzecTyp IS NULL OR n.DeN_WzorzecTyp = 0)
    AND EXISTS (
        SELECT 1
        FROM CDN.DekretyElem AS e
        WHERE e.DeE_DeNId = n.DeN_DeNId
          AND (NULLIF(e.DeE_KontoWn, '') IS NOT NULL OR NULLIF(e.DeE_KontoMa, '') IS NOT NULL)
    )
    {time_condition}
ORDER BY n.DeN_DataDok DESC, n.DeN_DeNId DESC;
""".strip()
    return OptimaReportQuery(
        report_key="manual-entries",
        sql=sql,
        notes=(
            "Raport 4.4: dokumenty z dekretem, ale bez schematu.",
            "Warunek: istnieje pozycja dekretu z kontem Wn/Ma oraz brak DeN_WzorzecId lub DeN_WzorzecTyp.",
        ),
    )

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
    if report_key == "documents-without-scheme":
        return _build_documents_without_scheme_report(period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    if report_key == "manual-entries":
        return _build_manual_entries_report(period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    if report_key == "construction-site-costs":
        return _build_construction_site_costs_report(period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    raise ValueError(f"Brak jawnego zapytania SQL dla raportu: {report_key}")


def _build_documents_without_scheme_report(
    period_yyyymm: int | str | None,
    *,
    year: int | str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> OptimaReportQuery:
    where = _period_where("d.DoN_DataDok", period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    sql = f"""
SET NOCOUNT ON;
SELECT
    d.DoN_NumerPelny AS [Numer dokumentu],
    d.DoN_NumerObcy AS [Numer obcy],
    d.DoN_Tytul AS [Tytuł],
    d.DoN_Dotyczy AS [Dotyczy],
    CONVERT(varchar(10), d.DoN_DataDok, 23) AS [Data dokumentu],
    d.DoN_Status AS [Status],
    d.DoN_Typ AS [Typ],
    COALESCE(files.FileCount, 0) AS [Liczba plików],
    d.DoN_DoNID AS [Optima DoNID],
    CASE WHEN contractor.PodmiotID IS NULL THEN '1' ELSE '0' END AS [__flag_brak_kontrahenta],
    CASE WHEN NULLIF(LTRIM(RTRIM(COALESCE(tra.Kategoria, vat.Kategoria, ksef.Kategoria, ''))), '') IS NULL THEN '1' ELSE '0' END AS [__flag_brak_kategorii],
    CASE
        WHEN vat.VaNID IS NULL AND tra.TrNID IS NULL AND ksef.DKFID IS NULL THEN '1'
        WHEN COALESCE(vat.VatRateAvailable, 0) = 0 THEN '1'
        ELSE '0'
    END AS [__flag_brak_stawki_vat],
    CASE WHEN COALESCE(vat.HasControllingSegment, 0) = 0 THEN '1' ELSE '0' END AS [__flag_brak_mpk],
    CASE WHEN COALESCE(vat.HasControllingSegment, 0) = 0 THEN '1' ELSE '0' END AS [__flag_brak_projektu],
    CASE WHEN d.DoN_Typ <> 1 THEN '1' ELSE '0' END AS [__flag_nietypowy_typ_dokumentu],
    CASE WHEN COALESCE(tra.Korekta, vat.Korekta, 0) <> 0 THEN '1' ELSE '0' END AS [__flag_korekta],
    CASE
        WHEN NULLIF(LTRIM(RTRIM(COALESCE(tra.Waluta, vat.Waluta, ksef.Waluta, ''))), '') IS NOT NULL
             AND COALESCE(tra.Waluta, vat.Waluta, ksef.Waluta, '') <> 'PLN'
        THEN '1'
        ELSE '0'
    END AS [__flag_dokument_walutowy],
    CASE WHEN fixed_asset.IsFixedAsset = 1 THEN '1' ELSE '0' END AS [__flag_srodek_trwaly],
    CASE
        WHEN contractor.PodmiotID IS NULL
          OR NULLIF(LTRIM(RTRIM(COALESCE(tra.Kategoria, vat.Kategoria, ksef.Kategoria, ''))), '') IS NULL
          OR (
            (vat.VaNID IS NULL AND tra.TrNID IS NULL AND ksef.DKFID IS NULL)
            OR COALESCE(vat.VatRateAvailable, 0) = 0
          )
          OR COALESCE(vat.HasControllingSegment, 0) = 0
        THEN '1'
        ELSE '0'
    END AS [__flag_brak_wynika_z_danych],
    CASE
        WHEN contractor.PodmiotID IS NOT NULL
         AND NULLIF(LTRIM(RTRIM(COALESCE(tra.Kategoria, vat.Kategoria, ksef.Kategoria, ''))), '') IS NOT NULL
         AND NOT (
            (vat.VaNID IS NULL AND tra.TrNID IS NULL AND ksef.DKFID IS NULL)
            OR COALESCE(vat.VatRateAvailable, 0) = 0
         )
         AND COALESCE(vat.HasControllingSegment, 0) = 1
        THEN '1'
        ELSE '0'
    END AS [__flag_brak_wynika_z_konfiguracji_schematu]
FROM CDN.DokNag AS d
OUTER APPLY (
    SELECT COUNT(*) AS FileCount
    FROM CDN.DokNagPliki AS p
    WHERE p.DnP_DoNID = d.DoN_DoNID
) AS files
OUTER APPLY (
    SELECT TOP (1)
        dp.DoP_PodmiotID AS PodmiotID
    FROM CDN.DokPodmioty AS dp
    WHERE dp.DoP_DoNID = d.DoN_DoNID
    ORDER BY dp.DoP_DoPId DESC
) AS contractor
OUTER APPLY (
    SELECT TOP (1)
        tr.TrN_TrNID AS TrNID,
        tr.TrN_Kategoria AS Kategoria,
        tr.TrN_Waluta AS Waluta,
        tr.TrN_Korekta AS Korekta
    FROM CDN.TraNag AS tr
    WHERE tr.TrN_DnpID = d.DoN_DoNID
    ORDER BY tr.TrN_TrNID DESC
) AS tra
OUTER APPLY (
    SELECT TOP (1)
        va.VaN_VaNID AS VaNID,
        va.VaN_Kategoria AS Kategoria,
        va.VaN_Waluta AS Waluta,
        va.VaN_Korekta AS Korekta,
        CASE WHEN EXISTS (
            SELECT 1
            FROM CDN.VatTab AS vt
            WHERE vt.VaT_VaNID = va.VaN_VaNID
              AND vt.VaT_Stawka IS NOT NULL
        ) THEN 1 ELSE 0 END AS VatRateAvailable,
        CASE WHEN EXISTS (
            SELECT 1
            FROM CDN.VatTab AS vt
            WHERE vt.VaT_VaNID = va.VaN_VaNID
              AND (
                NULLIF(LTRIM(RTRIM(vt.VaT_Segment1)), '') IS NOT NULL
                OR NULLIF(LTRIM(RTRIM(vt.VaT_Segment2)), '') IS NOT NULL
                OR NULLIF(LTRIM(RTRIM(vt.VaT_Segment3)), '') IS NOT NULL
                OR NULLIF(LTRIM(RTRIM(vt.VaT_Segment4)), '') IS NOT NULL
              )
        ) THEN 1 ELSE 0 END AS HasControllingSegment
    FROM CDN.VatNag AS va
    WHERE va.VaN_DnpID = d.DoN_DoNID
    ORDER BY va.VaN_VaNID DESC
) AS vat
OUTER APPLY (
    SELECT TOP (1)
        dk.DKF_DKFID AS DKFID,
        dk.DKF_Kategoria AS Kategoria,
        dk.DKF_Waluta AS Waluta
    FROM CDN.DokumentyKSeF AS dk
    WHERE
        (tra.TrNID IS NOT NULL AND dk.DKF_TrNId = tra.TrNID)
        OR (vat.VaNID IS NOT NULL AND dk.DKF_VaNId = vat.VaNID)
    ORDER BY dk.DKF_DKFID DESC
) AS ksef
OUTER APPLY (
    SELECT TOP (1) 1 AS IsFixedAsset
    FROM CDN.Trwale AS st
    WHERE NULLIF(LTRIM(RTRIM(st.SrT_Dokument)), '') IN (
        NULLIF(LTRIM(RTRIM(d.DoN_NumerPelny)), ''),
        NULLIF(LTRIM(RTRIM(d.DoN_NumerObcy)), '')
    )
) AS fixed_asset
{where}
ORDER BY d.DoN_DataDok DESC, d.DoN_DoNID DESC;
""".strip()
    return OptimaReportQuery(
        report_key="documents-without-scheme",
        sql=sql,
        notes=(
            "Raport dokumentów z obiegu bez kompletnego zestawu danych potrzebnych do automatycznego przypisania schematu.",
            "Flagi filtrów są budowane jawnie z CDN.DokNag, CDN.DokPodmioty, CDN.TraNag, CDN.VatNag, CDN.VatTab, CDN.DokumentyKSeF i CDN.Trwale.",
            "Brak MPK i brak projektu korzystają z dostępności segmentów controllingowych w CDN.VatTab.",
        ),
    )


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


def _build_construction_site_costs_report(
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
    CASE
        WHEN wn.Acc_Numer LIKE '500-150%' THEN wn.Acc_Nazwa
        ELSE ma.Acc_Nazwa
    END AS [Budowa],
    CASE
        WHEN wn.Acc_Numer LIKE '500-150%' THEN wn.Acc_Numer
        ELSE ma.Acc_Numer
    END AS [Konto budowy],
    CONVERT(varchar(10), n.DeN_DataDok, 23) AS [Data],
    COALESCE(NULLIF(e.DeE_Dokument, ''), NULLIF(n.DeN_Dokument, ''), n.DeN_NumerPelny, CAST(n.DeN_DeNId AS varchar(20))) AS [Dokument],
    COALESCE(NULLIF(n.DeN_Dziennik, ''), CAST(n.DeN_Typ AS varchar(20))) AS [Typ dokumentu],
    NULLIF(LTRIM(RTRIM(CONCAT(p.Pod_Nazwa1, ' ', p.Pod_Nazwa2))), '') AS [Kontrahent],
    CAST(COALESCE(e.DeE_Kwota, 0) AS decimal(18, 2)) AS [Kwota],
    COALESCE(NULLIF(e.DeE_Kategoria, ''), NULLIF(n.DeN_Kategoria, ''), N'Brak opisu') AS [Opis kosztu],
    wn.Acc_Numer AS [Konto Wn],
    ma.Acc_Numer AS [Konto Ma],
    CASE WHEN n.DeN_Bufor = 0 THEN N'Zatwierdzone' ELSE N'Bufor' END AS [Status księgowy],
    n.DeN_DeNId AS [Optima DeNID]
FROM CDN.DekretyElem AS e
JOIN CDN.DekretyNag AS n ON n.DeN_DeNId = e.DeE_DeNId
LEFT JOIN CDN.Konta AS wn ON wn.Acc_AccID = e.DeE_AccWnId
LEFT JOIN CDN.Konta AS ma ON ma.Acc_AccID = e.DeE_AccMaId
LEFT JOIN CDN.PodmiotyView AS p
    ON p.Pod_PodmiotTyp = n.DeN_PodmiotTyp
   AND p.Pod_PodId = n.DeN_PodmiotId
WHERE
    (wn.Acc_Numer LIKE '500-150%' OR ma.Acc_Numer LIKE '500-150%')
    AND COALESCE(
        CASE WHEN wn.Acc_Numer LIKE '500-150%' THEN wn.Acc_Nazwa ELSE ma.Acc_Nazwa END,
        ''
    ) <> ''
    {time_condition}
ORDER BY n.DeN_DataDok DESC, [Budowa], n.DeN_DeNId DESC, e.DeE_DeEId DESC;
""".strip()
    return OptimaReportQuery(
        report_key="construction-site-costs",
        sql=sql,
        notes=(
            "Raport budow dla kosztow z kont 500-150.",
            "Budowa jest wyznaczana z nazwy konta analitycznego po stronie Wn lub Ma, jesli numer konta zaczyna sie od 500-150.",
            "Raport pokazuje dokumenty i koszty przypisane do wybranych budow oraz pozwala je dalej filtrowac w aplikacji.",
        ),
    )

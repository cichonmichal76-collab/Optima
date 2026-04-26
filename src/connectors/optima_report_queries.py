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
    if report_key == "package-status":
        return _build_package_status_report(period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    if report_key == "closing-blockers":
        return _build_closing_blockers_report(period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    if report_key == "documents-action":
        return _build_documents_action_report(period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    if report_key == "scheme-without-entry":
        return _build_scheme_without_entry_report(period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    if report_key == "documents-without-scheme":
        return _build_documents_without_scheme_report(period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    if report_key == "manual-entries":
        return _build_manual_entries_flagged_report(period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    if report_key == "buildings":
        return _build_buildings_report(period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    if report_key == "construction-site-costs":
        return _build_construction_site_costs_report(period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    raise ValueError(f"Brak jawnego zapytania SQL dla raportu: {report_key}")


def _build_package_status_report(
    period_yyyymm: int | str | None,
    *,
    year: int | str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> OptimaReportQuery:
    document_where = _period_where("d.DoN_DataDok", period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    vat_where = _period_where("v.VaN_DataWys", period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    sql = f"""
SET NOCOUNT ON;
WITH VatPozycje AS (
    SELECT
        VaT_VaNID,
        SUM(VaT_NettoDoVAT) AS NettoDoVAT,
        SUM(VaT_VATDoVAT) AS VATDoVAT
    FROM CDN.VatTab
    GROUP BY VaT_VaNID
),
DocumentBase AS (
    SELECT
        d.DoN_DoNID,
        d.DoN_DataDok,
        d.DoN_NumerPelny
    FROM CDN.DokNag AS d
    {document_where}
),
VatBase AS (
    SELECT
        v.VaN_VaNID,
        v.VaN_DataWys,
        v.VaN_IdentKsieg,
        CAST(COALESCE(p.NettoDoVAT, v.VaN_RazemNetto, 0) AS decimal(18, 2)) AS KwotaNetto,
        CAST(COALESCE(p.VATDoVAT, v.VaN_RazemVAT, 0) AS decimal(18, 2)) AS KwotaVAT,
        CAST(COALESCE(p.NettoDoVAT + p.VATDoVAT, v.VaN_RazemBrutto, 0) AS decimal(18, 2)) AS KwotaBrutto
    FROM CDN.VatNag AS v
    LEFT JOIN VatPozycje AS p ON p.VaT_VaNID = v.VaN_VaNID
    {vat_where}
),
DocumentIssues AS (
    SELECT
        d.DoN_DoNID,
        CASE WHEN contractor.PodmiotID IS NULL THEN 1 ELSE 0 END AS BrakKontrahenta,
        CASE WHEN NULLIF(LTRIM(RTRIM(COALESCE(tra.Kategoria, vat.Kategoria, ksef.Kategoria, ''))), '') IS NULL THEN 1 ELSE 0 END AS BrakKategorii,
        CASE
            WHEN vat.VaNID IS NULL AND tra.TrNID IS NULL AND ksef.DKFID IS NULL THEN 1
            WHEN COALESCE(vat.VatRateAvailable, 0) = 0 THEN 1
            ELSE 0
        END AS BrakStawkiVat,
        CASE WHEN COALESCE(vat.HasControllingSegment, 0) = 0 THEN 1 ELSE 0 END AS BrakMpk
    FROM DocumentBase AS d
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
            tr.TrN_Kategoria AS Kategoria
        FROM CDN.TraNag AS tr
        WHERE tr.TrN_DnpID = d.DoN_DoNID
        ORDER BY tr.TrN_TrNID DESC
    ) AS tra
    OUTER APPLY (
        SELECT TOP (1)
            va.VaN_VaNID AS VaNID,
            va.VaN_Kategoria AS Kategoria,
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
            dk.DKF_Kategoria AS Kategoria
        FROM CDN.DokumentyKSeF AS dk
        WHERE
            (tra.TrNID IS NOT NULL AND dk.DKF_TrNId = tra.TrNID)
            OR (vat.VaNID IS NOT NULL AND dk.DKF_VaNId = vat.VaNID)
        ORDER BY dk.DKF_DKFID DESC
    ) AS ksef
),
PackageMetrics AS (
    SELECT
        DB_NAME() AS NazwaPaczki,
        N'Optima' AS Zrodlo,
        CONVERT(varchar(10), MIN(d.DoN_DataDok), 23) AS OkresOd,
        CONVERT(varchar(10), MAX(d.DoN_DataDok), 23) AS OkresDo,
        (
            SELECT CONVERT(varchar(19), create_date, 120)
            FROM sys.databases
            WHERE name = DB_NAME()
        ) AS DataImportu,
        COUNT(*) AS LiczbaDokumentow,
        CAST(COALESCE((SELECT SUM(v.KwotaNetto) FROM VatBase AS v), 0) AS decimal(18, 2)) AS SumaNetto,
        CAST(COALESCE((SELECT SUM(v.KwotaVAT) FROM VatBase AS v), 0) AS decimal(18, 2)) AS SumaVAT,
        CAST(COALESCE((SELECT SUM(v.KwotaBrutto) FROM VatBase AS v), 0) AS decimal(18, 2)) AS SumaBrutto,
        COALESCE((
            SELECT COUNT(*)
            FROM DocumentIssues AS issues
            WHERE issues.BrakKontrahenta = 1
               OR issues.BrakKategorii = 1
               OR issues.BrakStawkiVat = 1
               OR issues.BrakMpk = 1
        ), 0) AS BezSchematu,
        COALESCE((
            SELECT COUNT(*)
            FROM VatBase AS v
            WHERE NULLIF(LTRIM(RTRIM(COALESCE(v.VaN_IdentKsieg, ''))), '') IS NULL
               OR NOT EXISTS (
                    SELECT 1
                    FROM CDN.DekretyNag AS n
                    WHERE NULLIF(LTRIM(RTRIM(COALESCE(n.DeN_IdentKsieg, ''))), '') = NULLIF(LTRIM(RTRIM(COALESCE(v.VaN_IdentKsieg, ''))), '')
               )
        ), 0) AS BezDekretu
    FROM DocumentBase AS d
)
SELECT
    metrics.NazwaPaczki AS [Nazwa paczki],
    metrics.Zrodlo AS [Źródło],
    CONCAT(COALESCE(metrics.OkresOd, N'brak'), N' do ', COALESCE(metrics.OkresDo, N'brak')) AS [Okres od-do],
    metrics.DataImportu AS [Data importu],
    metrics.LiczbaDokumentow AS [Liczba dokumentów],
    metrics.SumaNetto AS [Suma netto],
    metrics.SumaVAT AS [Suma VAT],
    metrics.SumaBrutto AS [Suma brutto],
    CASE
        WHEN metrics.LiczbaDokumentow - (metrics.BezSchematu + metrics.BezDekretu) > 0
            THEN metrics.LiczbaDokumentow - (metrics.BezSchematu + metrics.BezDekretu)
        ELSE 0
    END AS [Liczba dokumentów poprawnych],
    CASE
        WHEN metrics.BezSchematu + metrics.BezDekretu > metrics.LiczbaDokumentow
            THEN metrics.LiczbaDokumentow
        ELSE metrics.BezSchematu + metrics.BezDekretu
    END AS [Liczba dokumentów z błędami],
    metrics.BezSchematu AS [Liczba dokumentów bez schematu],
    metrics.BezDekretu AS [Liczba dokumentów bez dekretu],
    CASE
        WHEN metrics.BezSchematu + metrics.BezDekretu > metrics.LiczbaDokumentow
            THEN metrics.LiczbaDokumentow
        ELSE metrics.BezSchematu + metrics.BezDekretu
    END AS [Liczba dokumentów do ręcznej weryfikacji],
    CASE
        WHEN metrics.LiczbaDokumentow = 0 THEN N'Niekompletna'
        WHEN metrics.BezSchematu > 0 OR metrics.BezDekretu > 0 THEN N'Błędy'
        ELSE N'OK'
    END AS [Status paczki],
    CASE WHEN metrics.LiczbaDokumentow > 0 OR metrics.SumaBrutto > 0 THEN '1' ELSE '0' END AS [__flag_liczba_dokumentow],
    CASE WHEN metrics.SumaNetto <> 0 OR metrics.SumaVAT <> 0 OR metrics.SumaBrutto <> 0 THEN '1' ELSE '0' END AS [__flag_suma_netto_vat_i_brutto],
    CASE WHEN metrics.BezSchematu > 0 THEN '1' ELSE '0' END AS [__flag_dokumenty_bez_schematu],
    CASE WHEN metrics.BezDekretu > 0 THEN '1' ELSE '0' END AS [__flag_dokumenty_bez_dekretu],
    CASE WHEN metrics.BezSchematu > 0 OR metrics.BezDekretu > 0 THEN '1' ELSE '0' END AS [__flag_dokumenty_do_recznej_weryfikacji],
    CASE WHEN metrics.LiczbaDokumentow > 0 THEN '1' ELSE '0' END AS [__flag_status_gotowosci_paczki],
    CASE WHEN metrics.LiczbaDokumentow = 0 THEN '1' ELSE '0' END AS [__flag_brak_danych_zrodlowych],
    CASE WHEN metrics.BezSchematu >= 10 OR (metrics.LiczbaDokumentow > 0 AND metrics.BezSchematu * 1.0 / metrics.LiczbaDokumentow >= 0.05) THEN '1' ELSE '0' END AS [__flag_duzo_dokumentow_bez_schematu],
    CASE WHEN metrics.LiczbaDokumentow = 0 OR (metrics.BezSchematu + metrics.BezDekretu) > 0 THEN '1' ELSE '0' END AS [__flag_kontrola_techniczna_nieprzeszla]
FROM PackageMetrics AS metrics;
""".strip()
    return OptimaReportQuery(
        report_key="package-status",
        sql=sql,
        notes=(
            "Status paczki jest liczony jawnie z dokumentow obiegu i rejestrow VAT ograniczonych do aktywnego okresu.",
            "Brak schematu wynika z brakow kontrahenta, kategorii, stawki VAT lub controllingowych segmentow VAT.",
            "Brak dekretu jest sprawdzany po VaN_IdentKsieg kontra CDN.DekretyNag.DeN_IdentKsieg.",
        ),
    )


def _build_closing_blockers_report(
    period_yyyymm: int | str | None,
    *,
    year: int | str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> OptimaReportQuery:
    document_where = _period_where("d.DoN_DataDok", period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    vat_where = _period_where("v.VaN_DataWys", period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    bank_where = _period_where("b.BZp_DataDok", period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    sql = f"""
SET NOCOUNT ON;
WITH VatPozycje AS (
    SELECT
        VaT_VaNID,
        SUM(VaT_NettoDoVAT) AS NettoDoVAT,
        SUM(VaT_VATDoVAT) AS VATDoVAT
    FROM CDN.VatTab
    GROUP BY VaT_VaNID
),
DocumentBase AS (
    SELECT
        d.DoN_DoNID,
        d.DoN_DataDok,
        d.DoN_NumerPelny,
        d.DoN_Status,
        d.DoN_Typ
    FROM CDN.DokNag AS d
    {document_where}
),
DocumentIssues AS (
    SELECT
        d.DoN_DoNID,
        d.DoN_DataDok,
        d.DoN_NumerPelny,
        d.DoN_Status,
        contractor.Kontrahent,
        CASE WHEN contractor.PodmiotID IS NULL THEN 1 ELSE 0 END AS BrakKontrahenta,
        CASE WHEN NULLIF(LTRIM(RTRIM(COALESCE(tra.Kategoria, vat.Kategoria, ''))), '') IS NULL THEN 1 ELSE 0 END AS BrakKategorii,
        CASE
            WHEN vat.VaNID IS NULL AND tra.TrNID IS NULL THEN 1
            WHEN COALESCE(vat.VatRateAvailable, 0) = 0 THEN 1
            ELSE 0
        END AS BrakStawkiVat,
        CASE WHEN COALESCE(vat.HasControllingSegment, 0) = 0 THEN 1 ELSE 0 END AS BrakMpk,
        NULLIF(LTRIM(RTRIM(COALESCE(vat.IdentKsieg, ''))), '') AS IdentKsieg,
        CASE
            WHEN NULLIF(LTRIM(RTRIM(COALESCE(vat.IdentKsieg, ''))), '') IS NULL THEN 1
            WHEN EXISTS (
                SELECT 1
                FROM CDN.DekretyNag AS n
                WHERE NULLIF(LTRIM(RTRIM(COALESCE(n.DeN_IdentKsieg, ''))), '') = NULLIF(LTRIM(RTRIM(COALESCE(vat.IdentKsieg, ''))), '')
            ) THEN 0
            ELSE 1
        END AS BrakDekretu
    FROM DocumentBase AS d
    OUTER APPLY (
        SELECT TOP (1)
            dp.DoP_PodmiotID AS PodmiotID,
            NULLIF(LTRIM(RTRIM(CONCAT(pv.Pod_Nazwa1, ' ', pv.Pod_Nazwa2))), '') AS Kontrahent
        FROM CDN.DokPodmioty AS dp
        LEFT JOIN CDN.PodmiotyView AS pv
            ON pv.Pod_PodmiotTyp = dp.DoP_PodmiotTyp
           AND pv.Pod_PodId = dp.DoP_PodmiotID
        WHERE dp.DoP_DoNID = d.DoN_DoNID
        ORDER BY dp.DoP_DoPId DESC
    ) AS contractor
    OUTER APPLY (
        SELECT TOP (1)
            tr.TrN_TrNID AS TrNID,
            tr.TrN_Kategoria AS Kategoria
        FROM CDN.TraNag AS tr
        WHERE tr.TrN_DnpID = d.DoN_DoNID
        ORDER BY tr.TrN_TrNID DESC
    ) AS tra
    OUTER APPLY (
        SELECT TOP (1)
            va.VaN_VaNID AS VaNID,
            va.VaN_Kategoria AS Kategoria,
            va.VaN_IdentKsieg AS IdentKsieg,
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
),
DuplicateDocuments AS (
    SELECT
        d.DoN_NumerPelny,
        CONVERT(varchar(10), MIN(d.DoN_DataDok), 23) AS DataDokumentu,
        COUNT(*) AS LiczbaDuplikatow
    FROM DocumentBase AS d
    WHERE NULLIF(LTRIM(RTRIM(d.DoN_NumerPelny)), '') IS NOT NULL
    GROUP BY d.DoN_NumerPelny, CONVERT(date, d.DoN_DataDok)
    HAVING COUNT(*) > 1
),
SalesWithoutKsef AS (
    SELECT
        v.VaN_VaNID,
        v.VaN_Dokument,
        CONVERT(varchar(10), v.VaN_DataWys, 23) AS DataDokumentu,
        NULLIF(LTRIM(RTRIM(CONCAT(v.VaN_KntNazwa1, ' ', v.VaN_KntNazwa2, ' ', v.VaN_KntNazwa3))), '') AS Kontrahent,
        CAST(COALESCE(p.NettoDoVAT + p.VATDoVAT, v.VaN_RazemBrutto, 0) AS decimal(18, 2)) AS Kwota,
        COALESCE(NULLIF(LTRIM(RTRIM(v.VaN_NrKSeF)), ''), NULLIF(LTRIM(RTRIM(tr.TrN_NrKSeF)), ''), NULLIF(LTRIM(RTRIM(ksef.DKF_NumerKSeF)), '')) AS NumerKSeF
    FROM CDN.VatNag AS v
    LEFT JOIN VatPozycje AS p ON p.VaT_VaNID = v.VaN_VaNID
    OUTER APPLY (
        SELECT TOP (1)
            tr.TrN_TrNID,
            tr.TrN_NrKSeF
        FROM CDN.TraNag AS tr
        WHERE tr.TrN_DnpID = v.VaN_DnpID
        ORDER BY tr.TrN_TrNID DESC
    ) AS tr
    OUTER APPLY (
        SELECT TOP (1)
            dk.DKF_NumerKSeF
        FROM CDN.DokumentyKSeF AS dk
        WHERE dk.DKF_VaNId = v.VaN_VaNID
           OR (tr.TrN_TrNID IS NOT NULL AND dk.DKF_TrNId = tr.TrN_TrNID)
        ORDER BY dk.DKF_DKFID DESC
    ) AS ksef
    WHERE v.VaN_Rejestr = N'SPRZEDAŻ'
      AND NULLIF(LTRIM(RTRIM(COALESCE(v.VaN_NrKSeF, tr.TrN_NrKSeF, ksef.DKF_NumerKSeF, ''))), '') IS NULL
      {vat_where.replace("WHERE ", "AND ", 1)}
),
BankWhitelistRisk AS (
    SELECT
        b.BZp_BZpID,
        b.BZp_NumerPelny,
        CONVERT(varchar(10), b.BZp_DataDok, 23) AS DataDokumentu,
        NULLIF(LTRIM(RTRIM(CONCAT(b.BZp_Nazwa1, ' ', b.BZp_Nazwa2, ' ', b.BZp_Nazwa3))), '') AS Kontrahent,
        CAST(ABS(COALESCE(b.BZp_Kwota, 0)) AS decimal(18, 2)) AS Kwota,
        b.BZp_RachunekNr,
        k.Knt_KntId
    FROM CDN.BnkZapisy AS b
    LEFT JOIN CDN.Kontrahenci AS k ON k.Knt_KntId = b.BZp_PodmiotID
    WHERE ABS(COALESCE(b.BZp_Kwota, 0)) >= 15000
      AND NULLIF(LTRIM(RTRIM(COALESCE(b.BZp_RachunekNr, ''))), '') IS NOT NULL
      AND (
            k.Knt_KntId IS NULL
            OR (
                NULLIF(LTRIM(RTRIM(COALESCE(k.Knt_RachunekNr, ''))), '') <> NULLIF(LTRIM(RTRIM(COALESCE(b.BZp_RachunekNr, ''))), '')
                AND NULLIF(LTRIM(RTRIM(COALESCE(k.Knt_RachunekNr0, ''))), '') <> NULLIF(LTRIM(RTRIM(COALESCE(b.BZp_RachunekNr, ''))), '')
                AND NOT EXISTS (
                    SELECT 1
                    FROM CDN.KntWeryfRachHist AS hist
                    WHERE hist.KWRH_KntID = k.Knt_KntId
                      AND NULLIF(LTRIM(RTRIM(COALESCE(hist.KWRH_RachunekNr, ''))), '') = NULLIF(LTRIM(RTRIM(COALESCE(b.BZp_RachunekNr, ''))), '')
                )
            )
      )
      {bank_where.replace("WHERE ", "AND ", 1)}
),
NoDataBlocker AS (
    SELECT
        CASE
            WHEN NOT EXISTS (SELECT 1 FROM DocumentBase)
             AND NOT EXISTS (SELECT 1 FROM SalesWithoutKsef)
             AND NOT EXISTS (SELECT 1 FROM BankWhitelistRisk)
            THEN 1
            ELSE 0
        END AS IsActive
)
SELECT
    N'Techniczna' AS [Typ blokady],
    N'Brak danych w wybranym okresie' AS [Dokument],
    NULL AS [Kontrahent],
    CAST(0 AS decimal(18, 2)) AS [Kwota],
    N'Brak danych źródłowych dla wybranego okresu.' AS [Powód],
    N'Administrator / księgowość' AS [Odpowiedzialny],
    N'Do sprawdzenia' AS [Status],
    '1' AS [__flag_blokady_techniczne_brak_danych_blad_importu_duplikaty],
    '0' AS [__flag_blokady_ksiegowe_i_schematowe_brak_dekretu_brak_schematu_schemat_bledny],
    '0' AS [__flag_blokady_podatkowe_ksef_platnicze_merytoryczne_i_zarzadcze],
    '0' AS [__flag_dokument_bez_schematu_i_bez_dekretu],
    '0' AS [__flag_faktura_sprzedazy_bez_ksef],
    '0' AS [__flag_platnosc_na_rachunek_spoza_bialej_listy]
FROM NoDataBlocker
WHERE IsActive = 1

UNION ALL

SELECT
    N'Techniczna' AS [Typ blokady],
    dup.DoN_NumerPelny AS [Dokument],
    NULL AS [Kontrahent],
    CAST(dup.LiczbaDuplikatow AS decimal(18, 2)) AS [Kwota],
    N'Duplikat numeru dokumentu w wybranym okresie.' AS [Powód],
    N'Administrator / księgowość' AS [Odpowiedzialny],
    N'Do sprawdzenia' AS [Status],
    '1' AS [__flag_blokady_techniczne_brak_danych_blad_importu_duplikaty],
    '0' AS [__flag_blokady_ksiegowe_i_schematowe_brak_dekretu_brak_schematu_schemat_bledny],
    '0' AS [__flag_blokady_podatkowe_ksef_platnicze_merytoryczne_i_zarzadcze],
    '0' AS [__flag_dokument_bez_schematu_i_bez_dekretu],
    '0' AS [__flag_faktura_sprzedazy_bez_ksef],
    '0' AS [__flag_platnosc_na_rachunek_spoza_bialej_listy]
FROM DuplicateDocuments AS dup

UNION ALL

SELECT
    N'Księgowa / schematowa' AS [Typ blokady],
    issues.DoN_NumerPelny AS [Dokument],
    issues.Kontrahent AS [Kontrahent],
    CAST(0 AS decimal(18, 2)) AS [Kwota],
    N'Dokument bez schematu i bez dekretu.' AS [Powód],
    N'Księgowość' AS [Odpowiedzialny],
    N'Do obsługi' AS [Status],
    '0' AS [__flag_blokady_techniczne_brak_danych_blad_importu_duplikaty],
    '1' AS [__flag_blokady_ksiegowe_i_schematowe_brak_dekretu_brak_schematu_schemat_bledny],
    '0' AS [__flag_blokady_podatkowe_ksef_platnicze_merytoryczne_i_zarzadcze],
    '1' AS [__flag_dokument_bez_schematu_i_bez_dekretu],
    '0' AS [__flag_faktura_sprzedazy_bez_ksef],
    '0' AS [__flag_platnosc_na_rachunek_spoza_bialej_listy]
FROM DocumentIssues AS issues
WHERE issues.BrakDekretu = 1
  AND (
        issues.BrakKontrahenta = 1
        OR issues.BrakKategorii = 1
        OR issues.BrakStawkiVat = 1
        OR issues.BrakMpk = 1
  )

UNION ALL

SELECT
    N'Podatkowa / KSeF' AS [Typ blokady],
    sales.VaN_Dokument AS [Dokument],
    sales.Kontrahent AS [Kontrahent],
    sales.Kwota AS [Kwota],
    N'Faktura sprzedaży bez KSeF.' AS [Powód],
    N'Sprzedaż / księgowość' AS [Odpowiedzialny],
    N'Do poprawy' AS [Status],
    '0' AS [__flag_blokady_techniczne_brak_danych_blad_importu_duplikaty],
    '0' AS [__flag_blokady_ksiegowe_i_schematowe_brak_dekretu_brak_schematu_schemat_bledny],
    '1' AS [__flag_blokady_podatkowe_ksef_platnicze_merytoryczne_i_zarzadcze],
    '0' AS [__flag_dokument_bez_schematu_i_bez_dekretu],
    '1' AS [__flag_faktura_sprzedazy_bez_ksef],
    '0' AS [__flag_platnosc_na_rachunek_spoza_bialej_listy]
FROM SalesWithoutKsef AS sales

UNION ALL

SELECT
    N'Płatnicza / podatkowa' AS [Typ blokady],
    bank.BZp_NumerPelny AS [Dokument],
    bank.Kontrahent AS [Kontrahent],
    bank.Kwota AS [Kwota],
    N'Płatność na rachunek spoza białej listy.' AS [Powód],
    N'Księgowość / płatności' AS [Odpowiedzialny],
    N'Do weryfikacji' AS [Status],
    '0' AS [__flag_blokady_techniczne_brak_danych_blad_importu_duplikaty],
    '0' AS [__flag_blokady_ksiegowe_i_schematowe_brak_dekretu_brak_schematu_schemat_bledny],
    '1' AS [__flag_blokady_podatkowe_ksef_platnicze_merytoryczne_i_zarzadcze],
    '0' AS [__flag_dokument_bez_schematu_i_bez_dekretu],
    '0' AS [__flag_faktura_sprzedazy_bez_ksef],
    '1' AS [__flag_platnosc_na_rachunek_spoza_bialej_listy]
FROM BankWhitelistRisk AS bank
ORDER BY [Typ blokady], [Dokument];
""".strip()
    return OptimaReportQuery(
        report_key="closing-blockers",
        sql=sql,
        notes=(
            "Raport blokad zamkniecia miesiaca jest budowany jawnie z dokumentow obiegu, sprzedaży VAT i zapisow bankowych.",
            "Schemat i dekret sa kontrolowane na relacji dokument -> VAT -> IdentKsieg -> DekretyNag.",
            "Rachunek spoza bialej listy jest oznaczany konserwatywnie, gdy zapis bankowy nie pasuje do rachunkow kontrahenta ani do historii KntWeryfRachHist.",
        ),
    )


def _build_documents_action_report(
    period_yyyymm: int | str | None,
    *,
    year: int | str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> OptimaReportQuery:
    document_where = _period_where("d.DoN_DataDok", period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    vat_where = _period_where("v.VaN_DataWys", period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    bank_where = _period_where("b.BZp_DataDok", period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    sql = f"""
SET NOCOUNT ON;
WITH VatPozycje AS (
    SELECT
        VaT_VaNID,
        SUM(VaT_NettoDoVAT) AS NettoDoVAT,
        SUM(VaT_VATDoVAT) AS VATDoVAT
    FROM CDN.VatTab
    GROUP BY VaT_VaNID
),
DocumentBase AS (
    SELECT
        d.DoN_DoNID,
        d.DoN_DataDok,
        d.DoN_NumerPelny,
        d.DoN_Status,
        d.DoN_Typ,
        d.DoN_Tytul,
        d.DoN_Dotyczy
    FROM CDN.DokNag AS d
    {document_where}
),
DocumentIssues AS (
    SELECT
        d.DoN_DoNID,
        d.DoN_DataDok,
        d.DoN_NumerPelny,
        d.DoN_Status,
        d.DoN_Typ,
        d.DoN_Tytul,
        d.DoN_Dotyczy,
        contractor.Kontrahent,
        CASE WHEN contractor.PodmiotID IS NULL THEN 1 ELSE 0 END AS BrakKontrahenta,
        CASE WHEN NULLIF(LTRIM(RTRIM(COALESCE(tra.Kategoria, vat.Kategoria, ''))), '') IS NULL THEN 1 ELSE 0 END AS BrakKategorii,
        CASE WHEN COALESCE(vat.HasControllingSegment, 0) = 0 THEN 1 ELSE 0 END AS BrakMpk,
        CASE
            WHEN NULLIF(LTRIM(RTRIM(COALESCE(d.DoN_Tytul, ''))), '') IS NULL
             AND NULLIF(LTRIM(RTRIM(COALESCE(d.DoN_Dotyczy, ''))), '') IS NULL
            THEN 1
            ELSE 0
        END AS BrakOpisuMerytorycznego,
        NULLIF(LTRIM(RTRIM(COALESCE(vat.IdentKsieg, ''))), '') AS IdentKsieg,
        CAST(COALESCE(vat.KwotaBrutto, 0) AS decimal(18, 2)) AS KwotaBrutto,
        CASE
            WHEN NULLIF(LTRIM(RTRIM(COALESCE(vat.IdentKsieg, ''))), '') IS NULL THEN 1
            WHEN EXISTS (
                SELECT 1
                FROM CDN.DekretyNag AS n
                WHERE NULLIF(LTRIM(RTRIM(COALESCE(n.DeN_IdentKsieg, ''))), '') = NULLIF(LTRIM(RTRIM(COALESCE(vat.IdentKsieg, ''))), '')
            ) THEN 0
            ELSE 1
        END AS BrakDekretu
    FROM DocumentBase AS d
    OUTER APPLY (
        SELECT TOP (1)
            dp.DoP_PodmiotID AS PodmiotID,
            NULLIF(LTRIM(RTRIM(CONCAT(pv.Pod_Nazwa1, ' ', pv.Pod_Nazwa2))), '') AS Kontrahent
        FROM CDN.DokPodmioty AS dp
        LEFT JOIN CDN.PodmiotyView AS pv
            ON pv.Pod_PodmiotTyp = dp.DoP_PodmiotTyp
           AND pv.Pod_PodId = dp.DoP_PodmiotID
        WHERE dp.DoP_DoNID = d.DoN_DoNID
        ORDER BY dp.DoP_DoPId DESC
    ) AS contractor
    OUTER APPLY (
        SELECT TOP (1)
            tr.TrN_TrNID AS TrNID,
            tr.TrN_Kategoria AS Kategoria
        FROM CDN.TraNag AS tr
        WHERE tr.TrN_DnpID = d.DoN_DoNID
        ORDER BY tr.TrN_TrNID DESC
    ) AS tra
    OUTER APPLY (
        SELECT TOP (1)
            va.VaN_VaNID AS VaNID,
            va.VaN_Kategoria AS Kategoria,
            va.VaN_IdentKsieg AS IdentKsieg,
            CAST(COALESCE(p.NettoDoVAT + p.VATDoVAT, va.VaN_RazemBrutto, 0) AS decimal(18, 2)) AS KwotaBrutto,
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
        LEFT JOIN VatPozycje AS p ON p.VaT_VaNID = va.VaN_VaNID
        WHERE va.VaN_DnpID = d.DoN_DoNID
        ORDER BY va.VaN_VaNID DESC
    ) AS vat
),
SalesWithoutKsef AS (
    SELECT
        v.VaN_VaNID,
        v.VaN_Dokument,
        NULLIF(LTRIM(RTRIM(CONCAT(v.VaN_KntNazwa1, ' ', v.VaN_KntNazwa2, ' ', v.VaN_KntNazwa3))), '') AS Kontrahent,
        CAST(COALESCE(p.NettoDoVAT + p.VATDoVAT, v.VaN_RazemBrutto, 0) AS decimal(18, 2)) AS Kwota
    FROM CDN.VatNag AS v
    LEFT JOIN VatPozycje AS p ON p.VaT_VaNID = v.VaN_VaNID
    OUTER APPLY (
        SELECT TOP (1)
            tr.TrN_TrNID,
            tr.TrN_NrKSeF
        FROM CDN.TraNag AS tr
        WHERE tr.TrN_DnpID = v.VaN_DnpID
        ORDER BY tr.TrN_TrNID DESC
    ) AS tr
    OUTER APPLY (
        SELECT TOP (1)
            dk.DKF_NumerKSeF
        FROM CDN.DokumentyKSeF AS dk
        WHERE dk.DKF_VaNId = v.VaN_VaNID
           OR (tr.TrN_TrNID IS NOT NULL AND dk.DKF_TrNId = tr.TrN_TrNID)
        ORDER BY dk.DKF_DKFID DESC
    ) AS ksef
    WHERE v.VaN_Rejestr = N'SPRZEDAŻ'
      AND NULLIF(LTRIM(RTRIM(COALESCE(v.VaN_NrKSeF, tr.TrN_NrKSeF, ksef.DKF_NumerKSeF, ''))), '') IS NULL
      {vat_where.replace("WHERE ", "AND ", 1)}
),
UnmatchedBank AS (
    SELECT
        b.BZp_BZpID,
        COALESCE(NULLIF(LTRIM(RTRIM(COALESCE(b.BZp_NumerPelny, ''))), ''), NULLIF(LTRIM(RTRIM(COALESCE(b.BZp_NumerObcy, ''))), ''), CAST(b.BZp_BZpID AS varchar(20))) AS Dokument,
        NULLIF(LTRIM(RTRIM(CONCAT(b.BZp_Nazwa1, ' ', b.BZp_Nazwa2, ' ', b.BZp_Nazwa3))), '') AS Kontrahent,
        CAST(ABS(COALESCE(b.BZp_Kwota, 0)) AS decimal(18, 2)) AS Kwota,
        CASE WHEN b.BZp_Rozliczono = 0 THEN 1 ELSE 0 END AS Nierozliczona,
        CASE WHEN NULLIF(LTRIM(RTRIM(COALESCE(b.BZp_KontoPrzeciwstawne, ''))), '') IS NULL THEN 1 ELSE 0 END AS BrakKontaPrzeciwstawnego,
        CASE WHEN NULLIF(LTRIM(RTRIM(CONCAT(b.BZp_Nazwa1, ' ', b.BZp_Nazwa2, ' ', b.BZp_Nazwa3))), '') IS NULL THEN 1 ELSE 0 END AS BrakKontrahenta
    FROM CDN.BnkZapisy AS b
    WHERE ABS(COALESCE(b.BZp_Kwota, 0)) > 0
      AND b.BZp_Rozliczono = 0
      {bank_where.replace("WHERE ", "AND ", 1)}
),
ActionRows AS (
    SELECT
        N'Krytyczny' AS [Priorytet],
        issues.DoN_NumerPelny AS [Dokument],
        N'Obieg dokumentów' AS [Typ],
        issues.Kontrahent AS [Kontrahent],
        issues.KwotaBrutto AS [Kwota],
        N'Brak schematu i dekretu.' AS [Problem],
        N'Księgowość' AS [Odpowiedzialny],
        N'Do obsługi' AS [Status],
        '1' AS [__flag_priorytet_krytyczny],
        '0' AS [__flag_priorytet_wysoki],
        '0' AS [__flag_priorytet_sredni],
        '1' AS [__flag_brak_schematu_i_dekretu],
        '0' AS [__flag_brak_ksef],
        '0' AS [__flag_platnosc_nierozpoznana],
        CASE WHEN issues.BrakMpk = 1 THEN '1' ELSE '0' END AS [__flag_brak_mpk],
        CASE WHEN issues.BrakOpisuMerytorycznego = 1 THEN '1' ELSE '0' END AS [__flag_brak_opisu_merytorycznego],
        '1' AS [__flag_do_obslugi_ksiegowej],
        '0' AS [__flag_do_rozliczenia_platnosci],
        '0' AS [__flag_do_uzupelnienia_danych]
    FROM DocumentIssues AS issues
    WHERE issues.BrakDekretu = 1
      AND (
            issues.BrakKontrahenta = 1
            OR issues.BrakKategorii = 1
            OR issues.BrakMpk = 1
      )

    UNION ALL

    SELECT
        N'Krytyczny' AS [Priorytet],
        sales.VaN_Dokument AS [Dokument],
        N'Faktura sprzedaży' AS [Typ],
        sales.Kontrahent AS [Kontrahent],
        sales.Kwota AS [Kwota],
        N'Brak KSeF.' AS [Problem],
        N'Sprzedaż / księgowość' AS [Odpowiedzialny],
        N'Do poprawy' AS [Status],
        '1' AS [__flag_priorytet_krytyczny],
        '0' AS [__flag_priorytet_wysoki],
        '0' AS [__flag_priorytet_sredni],
        '0' AS [__flag_brak_schematu_i_dekretu],
        '1' AS [__flag_brak_ksef],
        '0' AS [__flag_platnosc_nierozpoznana],
        '0' AS [__flag_brak_mpk],
        '0' AS [__flag_brak_opisu_merytorycznego],
        '0' AS [__flag_do_obslugi_ksiegowej],
        '0' AS [__flag_do_rozliczenia_platnosci],
        '0' AS [__flag_do_uzupelnienia_danych]
    FROM SalesWithoutKsef AS sales

    UNION ALL

    SELECT
        N'Wysoki' AS [Priorytet],
        bank.Dokument AS [Dokument],
        N'Bank' AS [Typ],
        bank.Kontrahent AS [Kontrahent],
        bank.Kwota AS [Kwota],
        N'Płatność nierozpoznana.' AS [Problem],
        N'Księgowość / płatności' AS [Odpowiedzialny],
        N'Do rozliczenia' AS [Status],
        '0' AS [__flag_priorytet_krytyczny],
        '1' AS [__flag_priorytet_wysoki],
        '0' AS [__flag_priorytet_sredni],
        '0' AS [__flag_brak_schematu_i_dekretu],
        '0' AS [__flag_brak_ksef],
        '1' AS [__flag_platnosc_nierozpoznana],
        '0' AS [__flag_brak_mpk],
        '0' AS [__flag_brak_opisu_merytorycznego],
        '0' AS [__flag_do_obslugi_ksiegowej],
        '1' AS [__flag_do_rozliczenia_platnosci],
        '0' AS [__flag_do_uzupelnienia_danych]
    FROM UnmatchedBank AS bank
    WHERE bank.Nierozliczona = 1
      AND (bank.BrakKontaPrzeciwstawnego = 1 OR bank.BrakKontrahenta = 1)

    UNION ALL

    SELECT
        N'Średni' AS [Priorytet],
        issues.DoN_NumerPelny AS [Dokument],
        N'Obieg dokumentów' AS [Typ],
        issues.Kontrahent AS [Kontrahent],
        issues.KwotaBrutto AS [Kwota],
        N'Brak MPK.' AS [Problem],
        N'Dział merytoryczny' AS [Odpowiedzialny],
        N'Do uzupełnienia' AS [Status],
        '0' AS [__flag_priorytet_krytyczny],
        '0' AS [__flag_priorytet_wysoki],
        '1' AS [__flag_priorytet_sredni],
        '0' AS [__flag_brak_schematu_i_dekretu],
        '0' AS [__flag_brak_ksef],
        '0' AS [__flag_platnosc_nierozpoznana],
        '1' AS [__flag_brak_mpk],
        '0' AS [__flag_brak_opisu_merytorycznego],
        '0' AS [__flag_do_obslugi_ksiegowej],
        '0' AS [__flag_do_rozliczenia_platnosci],
        '1' AS [__flag_do_uzupelnienia_danych]
    FROM DocumentIssues AS issues
    WHERE issues.BrakMpk = 1

    UNION ALL

    SELECT
        N'Średni' AS [Priorytet],
        issues.DoN_NumerPelny AS [Dokument],
        N'Obieg dokumentów' AS [Typ],
        issues.Kontrahent AS [Kontrahent],
        issues.KwotaBrutto AS [Kwota],
        N'Brak opisu merytorycznego.' AS [Problem],
        N'Dział merytoryczny' AS [Odpowiedzialny],
        N'Do uzupełnienia' AS [Status],
        '0' AS [__flag_priorytet_krytyczny],
        '0' AS [__flag_priorytet_wysoki],
        '1' AS [__flag_priorytet_sredni],
        '0' AS [__flag_brak_schematu_i_dekretu],
        '0' AS [__flag_brak_ksef],
        '0' AS [__flag_platnosc_nierozpoznana],
        '0' AS [__flag_brak_mpk],
        '1' AS [__flag_brak_opisu_merytorycznego],
        '0' AS [__flag_do_obslugi_ksiegowej],
        '0' AS [__flag_do_rozliczenia_platnosci],
        '1' AS [__flag_do_uzupelnienia_danych]
    FROM DocumentIssues AS issues
    WHERE issues.BrakOpisuMerytorycznego = 1
)
SELECT *
FROM ActionRows
ORDER BY
    CASE [Priorytet]
        WHEN N'Krytyczny' THEN 1
        WHEN N'Wysoki' THEN 2
        ELSE 3
    END,
    [Dokument];
""".strip()
    return OptimaReportQuery(
        report_key="documents-action",
        sql=sql,
        notes=(
            "Raport dziennej kolejki pracy ksiegowej jest budowany jawnie z dokumentow obiegu, VAT sprzedazy i zapisow bankowych.",
            "Priorytet krytyczny obejmuje brak schematu z brakiem dekretu oraz faktury sprzedazy bez numeru KSeF.",
            "Wysoki priorytet pokazuje nierozliczone platnosci bankowe bez jednoznacznego rozpoznania, a sredni braki MPK i opisu merytorycznego.",
        ),
    )


def _build_scheme_without_entry_report(
    period_yyyymm: int | str | None,
    *,
    year: int | str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> OptimaReportQuery:
    vat_where = _period_where("v.VaN_DataWys", period_yyyymm, year=year, date_from=date_from, date_to=date_to)
    sql = f"""
SET NOCOUNT ON;
WITH VatPozycje AS (
    SELECT
        VaT_VaNID,
        SUM(VaT_NettoDoVAT) AS NettoDoVAT,
        SUM(VaT_VATDoVAT) AS VATDoVAT,
        CASE WHEN SUM(CASE WHEN VaT_Stawka IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN 1 ELSE 0 END AS VatRateAvailable
    FROM CDN.VatTab
    GROUP BY VaT_VaNID
),
PendingSchemeEntries AS (
    SELECT
        CONVERT(varchar(10), v.VaN_DataWys, 23) AS [Data],
        COALESCE(NULLIF(ddf.DDf_Symbol, ''), NULLIF(v.VaN_Rejestr, ''), N'VAT') AS [Typ],
        v.VaN_Dokument AS [Numer],
        NULLIF(LTRIM(RTRIM(CONCAT(v.VaN_KntNazwa1, ' ', v.VaN_KntNazwa2, ' ', v.VaN_KntNazwa3))), '') AS [Kontrahent],
        COALESCE(
            NULLIF(LTRIM(RTRIM(CONCAT(ddf.DDf_Symbol, N' - ', ddf.DDf_Nazwa))), ''),
            NULLIF(LTRIM(RTRIM(v.VaN_IdentKsiegNumeracja)), ''),
            NULLIF(LTRIM(RTRIM(v.VaN_IdentKsieg)), ''),
            N'Wskazanie schematu'
        ) AS [Schemat],
        CAST(COALESCE(p.NettoDoVAT + p.VATDoVAT, v.VaN_RazemBrutto, 0) AS decimal(18, 2)) AS [Brutto],
        CASE
            WHEN COALESCE(tra.TrN_Bufor, 0) <> 0 THEN N'Bufor'
            WHEN COALESCE(ddf.DDf_Nieaktywna, 0) <> 0 THEN N'Schemat nieaktywny'
            WHEN COALESCE(ddf.DDf_ImportSchematID, 0) = 0 THEN N'Schemat nieuruchomiony'
            WHEN NULLIF(LTRIM(RTRIM(COALESCE(v.VaN_KntKonto, ''))), '') IS NULL THEN N'Brak konta rozrachunkowego'
            WHEN COALESCE(p.VATDoVAT, 0) <> 0 AND COALESCE(p.VatRateAvailable, 0) = 0 THEN N'Brak konta VAT'
            WHEN NULLIF(LTRIM(RTRIM(COALESCE(v.VaN_Kategoria, ''))), '') IS NULL THEN N'Brak kategorii'
            ELSE N'Do weryfikacji'
        END AS [Status],
        CASE
            WHEN COALESCE(ddf.DDf_Nieaktywna, 0) <> 0 THEN N'Schemat nieaktywny.'
            WHEN COALESCE(ddf.DDf_ImportSchematID, 0) = 0 THEN N'Schemat nieaktywny lub nieuruchomiony.'
            WHEN NULLIF(LTRIM(RTRIM(COALESCE(v.VaN_KntKonto, ''))), '') IS NULL THEN N'Brak konta rozrachunkowego.'
            WHEN COALESCE(p.VATDoVAT, 0) <> 0 AND COALESCE(p.VatRateAvailable, 0) = 0 THEN N'Brak konta VAT.'
            WHEN NULLIF(LTRIM(RTRIM(COALESCE(v.VaN_Kategoria, ''))), '') IS NULL THEN N'Brak konta księgowego, konta VAT, konta rozrachunkowego lub kategorii.'
            WHEN COALESCE(tra.TrN_Bufor, 0) <> 0 OR NULLIF(LTRIM(RTRIM(COALESCE(tra.TrN_StatusString, ''))), '') <> N'zatwierdzony'
                THEN N'Dokument w buforze, niezatwierdzony lub poza warunkami schematu.'
            ELSE N'Dokument w buforze, niezatwierdzony lub poza warunkami schematu.'
        END AS [Możliwa przyczyna],
        CASE WHEN COALESCE(ddf.DDf_Nieaktywna, 0) <> 0 OR COALESCE(ddf.DDf_ImportSchematID, 0) = 0 THEN '1' ELSE '0' END AS [__flag_schemat_nieaktywny_lub_nieuruchomiony],
        CASE
            WHEN NULLIF(LTRIM(RTRIM(COALESCE(v.VaN_KntKonto, ''))), '') IS NULL
              OR (COALESCE(p.VATDoVAT, 0) <> 0 AND COALESCE(p.VatRateAvailable, 0) = 0)
              OR NULLIF(LTRIM(RTRIM(COALESCE(v.VaN_Kategoria, ''))), '') IS NULL
            THEN '1'
            ELSE '0'
        END AS [__flag_brak_konta_ksiegowego_konta_vat_konta_rozrachunkowego_lub_kategorii],
        CASE
            WHEN COALESCE(tra.TrN_Bufor, 0) <> 0
              OR NULLIF(LTRIM(RTRIM(COALESCE(tra.TrN_StatusString, ''))), '') <> N'zatwierdzony'
              OR (
                COALESCE(ddf.DDf_Nieaktywna, 0) = 0
                AND COALESCE(ddf.DDf_ImportSchematID, 0) <> 0
                AND NULLIF(LTRIM(RTRIM(COALESCE(v.VaN_KntKonto, ''))), '') IS NOT NULL
                AND NOT (COALESCE(p.VATDoVAT, 0) <> 0 AND COALESCE(p.VatRateAvailable, 0) = 0)
                AND NULLIF(LTRIM(RTRIM(COALESCE(v.VaN_Kategoria, ''))), '') IS NOT NULL
              )
            THEN '1'
            ELSE '0'
        END AS [__flag_dokument_w_buforze_niezatwierdzony_lub_poza_warunkami_schematu],
        CASE WHEN COALESCE(ddf.DDf_Nieaktywna, 0) <> 0 THEN '1' ELSE '0' END AS [__flag_schemat_nieaktywny],
        CASE WHEN COALESCE(p.VATDoVAT, 0) <> 0 AND COALESCE(p.VatRateAvailable, 0) = 0 THEN '1' ELSE '0' END AS [__flag_brak_konta_vat],
        CASE WHEN NULLIF(LTRIM(RTRIM(COALESCE(v.VaN_KntKonto, ''))), '') IS NULL THEN '1' ELSE '0' END AS [__flag_brak_konta_rozrachunkowego]
    FROM CDN.VatNag AS v
    LEFT JOIN VatPozycje AS p ON p.VaT_VaNID = v.VaN_VaNID
    LEFT JOIN CDN.DokDefinicje AS ddf ON ddf.DDf_DDfID = v.VaN_IdentKsiegDDfID
    OUTER APPLY (
        SELECT TOP (1)
            tr.TrN_TrNID,
            tr.TrN_Bufor,
            LOWER(NULLIF(LTRIM(RTRIM(COALESCE(tr.TrN_StatusString, ''))), '')) AS TrN_StatusString
        FROM CDN.TraNag AS tr
        WHERE tr.TrN_DnpID = v.VaN_DnpID
        ORDER BY tr.TrN_TrNID DESC
    ) AS tra
    WHERE NULLIF(LTRIM(RTRIM(COALESCE(v.VaN_IdentKsieg, ''))), '') IS NOT NULL
      AND NOT EXISTS (
          SELECT 1
          FROM CDN.DekretyNag AS n
          WHERE NULLIF(LTRIM(RTRIM(COALESCE(n.DeN_IdentKsieg, ''))), '') = NULLIF(LTRIM(RTRIM(COALESCE(v.VaN_IdentKsieg, ''))), '')
      )
      {vat_where.replace("WHERE ", "AND ", 1)}
)
SELECT *
FROM PendingSchemeEntries
ORDER BY [Data] DESC, [Numer];
""".strip()
    return OptimaReportQuery(
        report_key="scheme-without-entry",
        sql=sql,
        notes=(
            "Raport jest budowany jawnie z CDN.VatNag, CDN.VatTab i CDN.DokDefinicje dla dokumentow z identyfikatorem ksiegowym, ale bez odpowiadajacego dekretu.",
            "Wskazanie schematu opiera sie na VaN_IdentKsieg, VaN_IdentKsiegDDfID oraz definicji dokumentu DDf_ImportSchematID / DDf_Nieaktywna.",
            "Brak konta VAT jest wykrywany konserwatywnie dla pozycji z kwota VAT, ale bez kompletnej konfiguracji pozycji VAT, a brak konta rozrachunkowego po VaN_KntKonto.",
        ),
    )


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


def _build_manual_entries_flagged_report(
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
WITH ManualEntries AS (
    SELECT
        CONVERT(varchar(10), n.DeN_DataDok, 23) AS DataDok,
        COALESCE(NULLIF(n.DeN_Dziennik, ''), CAST(n.DeN_Typ AS varchar(20))) AS TypDok,
        COALESCE(NULLIF(n.DeN_Dokument, ''), n.DeN_NumerPelny, CAST(n.DeN_DeNId AS varchar(20))) AS NumerDok,
        NULLIF(LTRIM(RTRIM(CONCAT(p.Pod_Nazwa1, ' ', p.Pod_Nazwa2))), '') AS Kontrahent,
        CAST(
            CASE
                WHEN ABS(COALESCE(n.DeN_KwotaWn, 0)) >= ABS(COALESCE(n.DeN_KwotaMa, 0))
                    THEN COALESCE(n.DeN_KwotaWn, 0)
                ELSE COALESCE(n.DeN_KwotaMa, 0)
            END AS decimal(18, 2)
        ) AS Brutto,
        wn.KontaWn,
        ma.KontaMa,
        NULLIF(LTRIM(RTRIM(CONCAT(n.DeN_OpeZalKod, ' ', n.DeN_OpeZalNazwisko))), '') AS OsobaKs,
        COALESCE(NULLIF(n.DeN_Kategoria, ''), NULLIF(n.DeN_RodzajDowoduKsiegowego, ''), N'Jest dekret, brak schematu/wzorca') AS Uwagi,
        n.DeN_DeNId AS OptimaDeNID,
        COUNT(*) OVER() AS AllManualCount,
        COUNT(*) OVER(PARTITION BY COALESCE(NULLIF(n.DeN_Dziennik, ''), CAST(n.DeN_Typ AS varchar(20)))) AS TypManualCount
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
)
SELECT
    DataDok AS [Data],
    TypDok AS [Typ],
    NumerDok AS [Numer],
    Kontrahent AS [Kontrahent],
    Brutto AS [Brutto],
    KontaWn AS [Konto Wn],
    KontaMa AS [Konto Ma],
    OsobaKs AS [Osoba księgująca],
    Uwagi AS [Uwagi],
    CASE
        WHEN TypManualCount >= 3 THEN N'Powtarzalny typ ręcznie księgowany.'
        WHEN Brutto >= 10000 THEN N'Ręczne księgowanie na istotną kwotę.'
        ELSE N'Księgowanie ręczne: dekret istnieje, ale brak schematu'
    END AS [Wniosek],
    OptimaDeNID AS [Optima DeNID],
    CASE WHEN Brutto >= 10000 THEN '1' ELSE '0' END AS [__flag_dekrety_reczne_na_istotne_kwoty],
    CASE WHEN TypManualCount >= 3 THEN '1' ELSE '0' END AS [__flag_powtarzalne_dokumenty_ksiegowane_recznie],
    CASE WHEN NULLIF(LTRIM(RTRIM(COALESCE(OsobaKs, ''))), '') IS NOT NULL OR NULLIF(LTRIM(RTRIM(COALESCE(Uwagi, ''))), '') IS NOT NULL THEN '1' ELSE '0' END AS [__flag_osoba_ksiegujaca_i_uwagi_do_dekretu],
    CASE WHEN AllManualCount >= 10 OR TypManualCount >= 5 THEN '1' ELSE '0' END AS [__flag_duzo_recznych_dekretow],
    CASE WHEN Brutto >= 10000 THEN '1' ELSE '0' END AS [__flag_reczne_ksiegowanie_na_istotna_kwote],
    CASE WHEN TypManualCount >= 3 THEN '1' ELSE '0' END AS [__flag_powtarzalny_typ_dokumentu_bez_schematu]
FROM ManualEntries
ORDER BY DataDok DESC, OptimaDeNID DESC;
""".strip()
    return OptimaReportQuery(
        report_key="manual-entries",
        sql=sql,
        notes=(
            "Raport 4.4: dokumenty z dekretem, ale bez schematu.",
            "Warunek: istnieje pozycja dekretu z kontem Wn/Ma oraz brak DeN_WzorzecId lub DeN_WzorzecTyp.",
            "Flagi raportu sa liczone jawnie dla istotnej kwoty, powtarzalnosci typu dokumentu oraz skali recznych dekretow w badanym okresie.",
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


def _build_buildings_report(
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
WITH KnownSites AS (
    SELECT DISTINCT
        NULLIF(LTRIM(RTRIM(Acc_Numer)), '') AS KontoBudowy,
        NULLIF(LTRIM(RTRIM(Acc_Nazwa)), '') AS Budowa,
        UPPER(
            REPLACE(
                REPLACE(
                    REPLACE(
                        REPLACE(
                            REPLACE(NULLIF(LTRIM(RTRIM(Acc_Nazwa)), ''), ',', ' '),
                            '.', ' '
                        ),
                        '/', ' '
                    ),
                    '-', ' '
                ),
                '  ',
                ' '
            )
        ) AS BudowaKey
    FROM CDN.Konta
    WHERE Acc_Numer LIKE '500-150%'
      AND NULLIF(LTRIM(RTRIM(Acc_Nazwa)), '') IS NOT NULL
),
CostBase AS (
    SELECT
        YEAR(n.DeN_DataDok) AS Rok,
        MONTH(n.DeN_DataDok) AS MiesiacNr,
        site.Budowa,
        CAST(COALESCE(e.DeE_Kwota, 0) AS decimal(18, 2)) AS Kwota,
        CASE
            WHEN COALESCE(NULLIF(n.DeN_Dokument, ''), n.DeN_NumerPelny, '') LIKE 'E/%'
              OR COALESCE(NULLIF(e.DeE_Kategoria, ''), NULLIF(n.DeN_Kategoria, ''), '') LIKE 'E/%'
                THEN 'WYNAGRODZENIA'
            WHEN UPPER(COALESCE(NULLIF(e.DeE_Kategoria, ''), NULLIF(n.DeN_Kategoria, ''), '')) LIKE '%PODWYKONAW%'
                THEN 'PODWYKONAWCY'
            WHEN (wn.Acc_Numer LIKE '720-150%' AND ma.Acc_Numer LIKE '500-150%')
              OR (wn.Acc_Numer LIKE '500-150%' AND ma.Acc_Numer LIKE '720-150%')
              OR UPPER(COALESCE(NULLIF(e.DeE_Kategoria, ''), NULLIF(n.DeN_Kategoria, ''), '')) LIKE '%PRZEKSIĘGOWANIE KOSZTÓW%'
                THEN 'SP_ZOO'
            WHEN UPPER(COALESCE(NULLIF(e.DeE_Kategoria, ''), NULLIF(n.DeN_Kategoria, ''), '')) LIKE '%MATERIAŁ%'
              OR UPPER(COALESCE(NULLIF(e.DeE_Kategoria, ''), NULLIF(n.DeN_Kategoria, ''), '')) LIKE '%MATERIAL%'
              OR UPPER(COALESCE(NULLIF(e.DeE_Kategoria, ''), NULLIF(n.DeN_Kategoria, ''), '')) LIKE '%BUDOWLAN%'
                THEN 'MATERIAL'
            ELSE 'MATERIAL'
        END AS Typ
    FROM CDN.DekretyElem AS e
    JOIN CDN.DekretyNag AS n ON n.DeN_DeNId = e.DeE_DeNId
    LEFT JOIN CDN.Konta AS wn ON wn.Acc_AccID = e.DeE_AccWnId
    LEFT JOIN CDN.Konta AS ma ON ma.Acc_AccID = e.DeE_AccMaId
    CROSS APPLY (
        SELECT CASE
            WHEN wn.Acc_Numer LIKE '500-150%' THEN NULLIF(LTRIM(RTRIM(wn.Acc_Nazwa)), '')
            ELSE NULLIF(LTRIM(RTRIM(ma.Acc_Nazwa)), '')
        END AS Budowa
    ) AS site
    WHERE (wn.Acc_Numer LIKE '500-150%' OR ma.Acc_Numer LIKE '500-150%')
      AND NULLIF(LTRIM(RTRIM(COALESCE(site.Budowa, ''))), '') IS NOT NULL
      AND COALESCE(e.DeE_Kwota, 0) > 0
      {time_condition}
),
RevenueBase AS (
    SELECT
        YEAR(n.DeN_DataDok) AS Rok,
        MONTH(n.DeN_DataDok) AS MiesiacNr,
        COALESCE(mapped.Budowa, NULLIF(LTRIM(RTRIM(ma.Acc_Nazwa)), ''), N'Nieprzypisana budowa') AS Budowa,
        CAST(COALESCE(e.DeE_Kwota, 0) AS decimal(18, 2)) AS Kwota
    FROM CDN.DekretyElem AS e
    JOIN CDN.DekretyNag AS n ON n.DeN_DeNId = e.DeE_DeNId
    LEFT JOIN CDN.Konta AS wn ON wn.Acc_AccID = e.DeE_AccWnId
    LEFT JOIN CDN.Konta AS ma ON ma.Acc_AccID = e.DeE_AccMaId
    OUTER APPLY (
        SELECT TOP (1)
            ks.Budowa
        FROM KnownSites AS ks
        WHERE
            UPPER(
                REPLACE(
                    REPLACE(
                        REPLACE(
                            REPLACE(
                                REPLACE(COALESCE(NULLIF(e.DeE_Kategoria, ''), NULLIF(n.DeN_Kategoria, ''), COALESCE(NULLIF(n.DeN_Dokument, ''), n.DeN_NumerPelny, '')), ',', ' '),
                                '.',
                                ' '
                            ),
                            '/',
                            ' '
                        ),
                        '-',
                        ' '
                    ),
                    '  ',
                    ' '
                )
            ) LIKE '%' + ks.BudowaKey + '%'
            OR ks.BudowaKey LIKE '%' + UPPER(
                REPLACE(
                    REPLACE(
                        REPLACE(
                            REPLACE(
                                REPLACE(COALESCE(NULLIF(ma.Acc_Nazwa, ''), NULLIF(wn.Acc_Nazwa, ''), ''), ',', ' '),
                                '.',
                                ' '
                            ),
                            '/',
                            ' '
                        ),
                        '-',
                        ' '
                    ),
                    '  ',
                    ' '
                )
            ) + '%'
        ORDER BY
            CASE
                WHEN UPPER(
                    REPLACE(
                        REPLACE(
                            REPLACE(
                                REPLACE(
                                    REPLACE(COALESCE(NULLIF(e.DeE_Kategoria, ''), NULLIF(n.DeN_Kategoria, ''), COALESCE(NULLIF(n.DeN_Dokument, ''), n.DeN_NumerPelny, '')), ',', ' '),
                                    '.',
                                    ' '
                                ),
                                '/',
                                ' '
                            ),
                            '-',
                            ' '
                        ),
                        '  ',
                        ' '
                    )
                ) LIKE '%' + ks.BudowaKey + '%' THEN 0 ELSE 1
            END,
            LEN(ks.BudowaKey) DESC
    ) AS mapped
    WHERE ma.Acc_Numer LIKE '730-150%'
      AND COALESCE(e.DeE_Kwota, 0) > 0
      {time_condition}
),
Summary AS (
    SELECT
        Budowa,
        Rok,
        MiesiacNr,
        CAST(SUM(CASE WHEN Typ = 'PRZYCHODY' THEN Kwota ELSE 0 END) AS decimal(18, 2)) AS Przychody,
        CAST(SUM(CASE WHEN Typ = 'PODWYKONAWCY' THEN Kwota ELSE 0 END) AS decimal(18, 2)) AS Podwykonawcy,
        CAST(SUM(CASE WHEN Typ = 'SP_ZOO' THEN Kwota ELSE 0 END) AS decimal(18, 2)) AS SpZoo,
        CAST(SUM(CASE WHEN Typ = 'MATERIAL' THEN Kwota ELSE 0 END) AS decimal(18, 2)) AS Material,
        CAST(SUM(CASE WHEN Typ = 'WYNAGRODZENIA' THEN Kwota ELSE 0 END) AS decimal(18, 2)) AS Wynagrodzenia
    FROM (
        SELECT Rok, MiesiacNr, Budowa, 'PRZYCHODY' AS Typ, Kwota FROM RevenueBase
        UNION ALL
        SELECT Rok, MiesiacNr, Budowa, Typ, Kwota FROM CostBase
    ) AS all_rows
    GROUP BY Budowa, Rok, MiesiacNr
)
SELECT
    Budowa AS [Budowa],
    CAST(Rok AS varchar(4)) AS [Rok],
    CASE MiesiacNr
        WHEN 1 THEN N'Styczeń'
        WHEN 2 THEN N'Luty'
        WHEN 3 THEN N'Marzec'
        WHEN 4 THEN N'Kwiecień'
        WHEN 5 THEN N'Maj'
        WHEN 6 THEN N'Czerwiec'
        WHEN 7 THEN N'Lipiec'
        WHEN 8 THEN N'Sierpień'
        WHEN 9 THEN N'Wrzesień'
        WHEN 10 THEN N'Październik'
        WHEN 11 THEN N'Listopad'
        WHEN 12 THEN N'Grudzień'
    END AS [Miesiac],
    LTRIM(STR(Przychody, 18, 2)) AS [Przychody],
    LTRIM(STR(Podwykonawcy, 18, 2)) AS [Podwykonawcy],
    LTRIM(STR(SpZoo, 18, 2)) AS [SP. z o.o.],
    LTRIM(STR(Material, 18, 2)) AS [Materiał],
    LTRIM(STR(Wynagrodzenia, 18, 2)) AS [Wynagrodzenia],
    LTRIM(STR(Podwykonawcy + SpZoo + Material + Wynagrodzenia, 18, 2)) AS [Koszty razem],
    LTRIM(STR(Przychody - (Podwykonawcy + SpZoo + Material + Wynagrodzenia), 18, 2)) AS [Zysk/Strata],
    CASE WHEN Przychody > 0 OR Podwykonawcy > 0 OR SpZoo > 0 THEN '1' ELSE '0' END AS [__flag_przychody_podwykonawcy_i_koszty_wlasne_sp_z_o_o],
    CASE WHEN Material > 0 OR Wynagrodzenia > 0 OR (Podwykonawcy + SpZoo + Material + Wynagrodzenia) > 0 THEN '1' ELSE '0' END AS [__flag_materialy_wynagrodzenia_i_koszty_razem],
    CASE WHEN Przychody <> 0 OR (Podwykonawcy + SpZoo + Material + Wynagrodzenia) <> 0 THEN '1' ELSE '0' END AS [__flag_marza_budowy_i_zysk_strata_miesiecznie],
    CASE WHEN Przychody = 0 AND (Podwykonawcy + SpZoo + Material + Wynagrodzenia) > 0 THEN '1' ELSE '0' END AS [__flag_budowa_bez_przychodu],
    CASE WHEN (Podwykonawcy + SpZoo + Material + Wynagrodzenia) > Przychody AND Przychody > 0 THEN '1' ELSE '0' END AS [__flag_koszty_przewyzszaja_przychody],
    CASE WHEN (Podwykonawcy + SpZoo + Material + Wynagrodzenia) > 0 AND Podwykonawcy / NULLIF(Podwykonawcy + SpZoo + Material + Wynagrodzenia, 0) >= 0.6 THEN '1' ELSE '0' END AS [__flag_wysoki_udzial_podwykonawcow]
FROM Summary
WHERE Przychody <> 0
   OR Podwykonawcy <> 0
   OR SpZoo <> 0
   OR Material <> 0
   OR Wynagrodzenia <> 0
ORDER BY Rok DESC, MiesiacNr DESC, Budowa;
""".strip()
    return OptimaReportQuery(
        report_key="buildings",
        sql=sql,
        notes=(
            "Raport Budowy pokazuje miesięczne podsumowanie przychodów i kosztów dla budów powiązanych z kontami 500-150.",
            "Przychody są pobierane z dekretów przychodowych 730-150 i mapowane do budów po nazwie konta lub treści kategorii dokumentu.",
            "Koszty są dzielone na podwykonawców, sp. z o.o., materiał i wynagrodzenia według kategorii dokumentu oraz przeksięgowań 720-150/500-150.",
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

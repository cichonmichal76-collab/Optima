from __future__ import annotations

from collections import Counter
from datetime import date
from decimal import Decimal
from typing import Iterable, Sequence

from src.core.models import AuditIssue, LedgerRecord, VatRecord


class VatAudit:
    allowed_rates = {"0", "0%", "5", "5%", "8", "8%", "23", "23%", "zw", "np", "oo"}
    tolerance = Decimal("0.02")

    def run(
        self,
        records: Sequence[VatRecord],
        period: tuple[date | None, date | None] | None = None,
        ledger_records: Sequence[LedgerRecord] | None = None,
        vat_accounts: set[str] | None = None,
    ) -> list[AuditIssue]:
        issues: list[AuditIssue] = []
        duplicates = Counter((record.document_number.strip(), (record.contractor_nip or "").strip()) for record in records)
        ledger_by_document = self._group_ledger_by_document(ledger_records or [])
        vat_accounts = vat_accounts or set()

        for record in records:
            if abs((record.net + record.vat) - record.gross) > self.tolerance:
                issues.append(
                    self._issue(
                        "CRITICAL",
                        record,
                        "VAT_SUM_MISMATCH",
                        "Netto + VAT nie zgadza sie z brutto.",
                        "Zweryfikuj kwoty na dokumencie i sposob eksportu danych.",
                    )
                )
            if not record.document_number.strip():
                issues.append(
                    self._issue(
                        "CRITICAL",
                        record,
                        "VAT_MISSING_DOCUMENT",
                        "Brak numeru dokumentu VAT.",
                        "Uzupelnij numer dokumentu lub popraw mapowanie kolumn.",
                    )
                )
            if not record.contractor_name or not record.contractor_nip:
                issues.append(
                    self._issue(
                        "WARNING",
                        record,
                        "VAT_MISSING_CONTRACTOR",
                        "Brak kontrahenta lub NIP dla dokumentu firmowego.",
                        "Zweryfikuj dane kontrahenta i mapowanie kolumn.",
                        confidence=0.85,
                    )
                )
            if not record.vat_rate:
                issues.append(
                    self._issue(
                        "WARNING",
                        record,
                        "VAT_RATE_MISSING",
                        "Brak stawki VAT.",
                        "Uzupelnij stawke VAT lub zmapuj odpowiednia kolumne.",
                    )
                )
            elif record.vat_rate.lower().replace(" ", "") not in self.allowed_rates:
                issues.append(
                    self._issue(
                        "WARNING",
                        record,
                        "VAT_RATE_UNUSUAL",
                        f"Nietypowa stawka VAT: {record.vat_rate}.",
                        "Zweryfikuj dokument lub dopuszczalne stawki w konfiguracji.",
                        confidence=0.8,
                    )
                )
            if duplicates[(record.document_number.strip(), (record.contractor_nip or "").strip())] > 1:
                issues.append(
                    self._issue(
                        "WARNING",
                        record,
                        "VAT_DUPLICATE",
                        "Wykryto duplikat numeru faktury i NIP.",
                        "Sprawdz, czy dokument nie zostal zaimportowany wielokrotnie.",
                    )
                )

            if period and record.issue_date:
                period_start, period_end = period
                if period_start and record.issue_date < period_start or period_end and record.issue_date > period_end:
                    issues.append(
                        self._issue(
                            "WARNING",
                            record,
                            "VAT_DATE_OUT_OF_RANGE",
                            "Data dokumentu jest poza zakresem audytu.",
                            "Zweryfikuj filtr eksportu i okres audytu.",
                            confidence=0.85,
                        )
                    )

            if record.vat < 0 and not self._is_correction(record):
                issues.append(
                    self._issue(
                        "WARNING",
                        record,
                        "VAT_NEGATIVE_WITHOUT_CORRECTION",
                        "Kwota VAT jest ujemna, ale dokument nie wyglada na korekte.",
                        "Sprawdz oznaczenie korekty albo poprawnosc danych liczbowych.",
                    )
                )

            if record.vat != 0 and ledger_by_document and vat_accounts:
                matching_entries = ledger_by_document.get(record.document_number.strip(), [])
                account_pool = {
                    account
                    for entry in matching_entries
                    for account in (entry.account_wn, entry.account_ma, entry.account, entry.account_opposite)
                    if account
                }
                if matching_entries and not (account_pool & vat_accounts):
                    issues.append(
                        self._issue(
                            "WARNING",
                            record,
                            "VAT_ACCOUNT_MISSING",
                            "Dokument VAT nie ma powiazanego konta VAT w ksiegowaniach.",
                            "Zweryfikuj konfiguracje kont VAT oraz dekretacje dokumentu.",
                            confidence=0.8,
                        )
                    )

        return issues

    @staticmethod
    def _group_ledger_by_document(records: Iterable[LedgerRecord]) -> dict[str, list[LedgerRecord]]:
        grouped: dict[str, list[LedgerRecord]] = {}
        for record in records:
            grouped.setdefault(record.document_number.strip(), []).append(record)
        return grouped

    @staticmethod
    def _is_correction(record: VatRecord) -> bool:
        text = " ".join(filter(None, [record.document_number, record.raw.get("Rodzaj"), record.raw.get("Typ")]))
        lowered = text.lower()
        return "kor" in lowered or "korekta" in lowered

    @staticmethod
    def _issue(
        level: str,
        record: VatRecord,
        code: str,
        issue: str,
        recommendation: str,
        confidence: float = 0.95,
    ) -> AuditIssue:
        return AuditIssue(
            level=level,
            area="VAT",
            document_number=record.document_number,
            contractor=record.contractor_name,
            date=record.issue_date,
            issue_code=code,
            issue=issue,
            recommendation=recommendation,
            confidence=confidence,
        )

from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Sequence

from src.core.models import AuditIssue, LedgerRecord


class LedgerAudit:
    tolerance = Decimal("0.02")

    def run(
        self,
        records: Sequence[LedgerRecord],
        plan_accounts: set[str] | None = None,
        period: tuple[date | None, date | None] | None = None,
        vat_accounts: set[str] | None = None,
    ) -> list[AuditIssue]:
        issues: list[AuditIssue] = []
        grouped: dict[str, list[LedgerRecord]] = defaultdict(list)
        plan_accounts = plan_accounts or set()
        vat_accounts = vat_accounts or set()

        for record in records:
            grouped[record.document_number].append(record)
            if not record.account_wn:
                issues.append(self._issue("CRITICAL", record, "LEDGER_MISSING_WN", "Brak konta Wn.", "Uzupelnij konto Wn."))
            if not record.account_ma:
                issues.append(self._issue("CRITICAL", record, "LEDGER_MISSING_MA", "Brak konta Ma.", "Uzupelnij konto Ma."))
            if record.amount_wn == 0 and record.amount_ma == 0:
                issues.append(
                    self._issue(
                        "CRITICAL",
                        record,
                        "LEDGER_EMPTY_AMOUNT",
                        "Pozycja ma puste kwoty Wn i Ma.",
                        "Zweryfikuj eksport i mapowanie kwot.",
                    )
                )
            if not record.description:
                issues.append(
                    self._issue(
                        "WARNING",
                        record,
                        "LEDGER_MISSING_DESCRIPTION",
                        "Brak opisu ksiegowania.",
                        "Uzupelnij opis lub popraw mapowanie kolumn.",
                    )
                )
            if period and record.accounting_date:
                period_start, period_end = period
                if period_start and record.accounting_date < period_start or period_end and record.accounting_date > period_end:
                    issues.append(
                        self._issue(
                            "WARNING",
                            record,
                            "LEDGER_DATE_OUT_OF_RANGE",
                            "Data ksiegowania jest poza zakresem audytu.",
                            "Zweryfikuj okres eksportu i parametry audytu.",
                            confidence=0.85,
                        )
                    )
            for account in (record.account_wn, record.account_ma):
                if account and plan_accounts and account not in plan_accounts:
                    issues.append(
                        self._issue(
                            "CRITICAL",
                            record,
                            "LEDGER_ACCOUNT_OUTSIDE_PLAN",
                            f"Konto {account} nie istnieje w planie kont.",
                            "Zweryfikuj plan kont i dekretacje dokumentu.",
                        )
                    )
            if vat_accounts and record.description and "vat" in record.description.lower():
                account_pool = {value for value in (record.account_wn, record.account_ma) if value}
                if account_pool and not (account_pool & vat_accounts):
                    issues.append(
                        self._issue(
                            "WARNING",
                            record,
                            "LEDGER_VAT_ACCOUNT_UNEXPECTED",
                            "Ksiegowanie VAT wykorzystuje inne konto niz zdefiniowane w konfiguracji.",
                            "Sprawdz konta VAT i szablon dekretacji.",
                            confidence=0.8,
                        )
                    )

        for document_number, entries in grouped.items():
            total_wn = sum(item.amount_wn for item in entries)
            total_ma = sum(item.amount_ma for item in entries)
            if abs(total_wn - total_ma) > self.tolerance:
                sample = entries[0]
                issues.append(
                    AuditIssue(
                        level="CRITICAL",
                        area="LEDGER",
                        document_number=document_number,
                        contractor=sample.contractor_name,
                        date=sample.accounting_date,
                        issue_code="LEDGER_UNBALANCED",
                        issue="Dokument jest niezbilansowany.",
                        recommendation="Zweryfikuj komplet dekretow oraz kwoty Wn/Ma.",
                        confidence=0.98,
                    )
                )

        return issues

    @staticmethod
    def _issue(
        level: str,
        record: LedgerRecord,
        code: str,
        issue: str,
        recommendation: str,
        confidence: float = 0.95,
    ) -> AuditIssue:
        return AuditIssue(
            level=level,
            area="LEDGER",
            document_number=record.document_number,
            contractor=record.contractor_name,
            date=record.accounting_date,
            issue_code=code,
            issue=issue,
            recommendation=recommendation,
            confidence=confidence,
        )


from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Sequence

from src.core.models import AuditIssue, SettlementRecord


class SettlementsAudit:
    def run(self, records: Sequence[SettlementRecord], reference_date: date | None = None) -> list[AuditIssue]:
        issues: list[AuditIssue] = []
        reference_date = reference_date or date.today()
        grouped: dict[str, list[SettlementRecord]] = defaultdict(list)

        for record in records:
            grouped[record.document_number].append(record)
            if not record.document_number and record.paid_amount > 0:
                issues.append(
                    AuditIssue(
                        level="WARNING",
                        area="SETTLEMENTS",
                        contractor=record.contractor_name,
                        date=record.payment_date,
                        issue_code="SETTLEMENT_PAYMENT_WITHOUT_DOCUMENT",
                        issue="Platnosc nie ma powiazanego dokumentu.",
                        recommendation="Powiaz platnosc z dokumentem zrodlowym lub popraw eksport.",
                        confidence=0.9,
                    )
                )
            if record.due_date and record.due_date < reference_date and record.remaining_amount > Decimal("0"):
                issues.append(
                    AuditIssue(
                        level="WARNING",
                        area="SETTLEMENTS",
                        document_number=record.document_number,
                        contractor=record.contractor_name,
                        date=record.due_date,
                        issue_code="SETTLEMENT_OVERDUE",
                        issue="Rozrachunek jest przeterminowany.",
                        recommendation="Zweryfikuj windykacje lub harmonogram platnosci.",
                        confidence=0.95,
                    )
                )
            if Decimal("0") < record.paid_amount < record.amount:
                issues.append(
                    AuditIssue(
                        level="INFO",
                        area="SETTLEMENTS",
                        document_number=record.document_number,
                        contractor=record.contractor_name,
                        date=record.payment_date,
                        issue_code="SETTLEMENT_PARTIAL_PAYMENT",
                        issue="Wykryto platnosc czesciowa.",
                        recommendation="Zweryfikuj, czy czesciowe rozliczenie jest oczekiwane.",
                        confidence=0.9,
                    )
                )

        for document_number, entries in grouped.items():
            contractors = {entry.contractor_name for entry in entries if entry.contractor_name}
            accounts = {entry.account for entry in entries if entry.account}
            if len(contractors) > 1:
                issues.append(
                    AuditIssue(
                        level="WARNING",
                        area="SETTLEMENTS",
                        document_number=document_number,
                        issue_code="SETTLEMENT_CONTRACTOR_MISMATCH",
                        issue="Ten sam rozrachunek wystepuje na roznych kontrahentach.",
                        recommendation="Zweryfikuj polaczenie rozrachunku z kontrahentem.",
                        confidence=0.85,
                    )
                )
            if len(accounts) > 1:
                issues.append(
                    AuditIssue(
                        level="WARNING",
                        area="SETTLEMENTS",
                        document_number=document_number,
                        issue_code="SETTLEMENT_ACCOUNT_MISMATCH",
                        issue="Rozrachunek wystepuje na roznych kontach.",
                        recommendation="Zweryfikuj konfiguracje kont rozrachunkowych.",
                        confidence=0.85,
                    )
                )

        return issues


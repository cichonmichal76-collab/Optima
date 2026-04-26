from __future__ import annotations

from typing import Sequence

from src.core.models import AuditIssue, SettlementRecord


class BankAudit:
    def run(
        self,
        records: Sequence[SettlementRecord],
        financial_cost_accounts: set[str] | None = None,
        public_accounts: set[str] | None = None,
    ) -> list[AuditIssue]:
        issues: list[AuditIssue] = []
        financial_cost_accounts = financial_cost_accounts or set()
        public_accounts = public_accounts or set()

        for record in records:
            description = " ".join(str(value) for value in record.raw.values() if value).lower()
            if "przelew" in description and not record.document_number:
                issues.append(
                    AuditIssue(
                        level="WARNING",
                        area="BANK",
                        contractor=record.contractor_name,
                        date=record.payment_date,
                        issue_code="BANK_TRANSFER_UNASSIGNED",
                        issue="Przelew nie ma przypisanego dokumentu lub rozliczenia.",
                        recommendation="Powiąż przelew z należnością lub zobowiązaniem.",
                        confidence=0.85,
                    )
                )
            if ("oplata bankowa" in description or "opłata bankowa" in description) and financial_cost_accounts:
                if record.account not in financial_cost_accounts:
                    issues.append(
                        AuditIssue(
                            level="WARNING",
                            area="BANK",
                            document_number=record.document_number,
                            issue_code="BANK_FEE_ACCOUNT_UNEXPECTED",
                            issue="Opłata bankowa nie jest przypisana do konta kosztów finansowych.",
                            recommendation="Zweryfikuj konto dla opłat bankowych.",
                            confidence=0.85,
                        )
                    )
            if ("zus" in description or "urzad skarbowy" in description or "us " in description) and public_accounts:
                if record.account not in public_accounts:
                    issues.append(
                        AuditIssue(
                            level="WARNING",
                            area="BANK",
                            document_number=record.document_number,
                            issue_code="BANK_PUBLIC_PAYMENT_ACCOUNT",
                            issue="Płatność do US/ZUS trafiła na nietypowe konto.",
                            recommendation="Zweryfikuj konto bankowe i konfigurację odbiorcy publicznego.",
                            confidence=0.8,
                        )
                    )
            if record.contractor_name and record.remaining_amount > 0:
                issues.append(
                    AuditIssue(
                        level="INFO",
                        area="BANK",
                        document_number=record.document_number,
                        contractor=record.contractor_name,
                        date=record.payment_date,
                        issue_code="BANK_PAYMENT_NOT_SETTLED",
                        issue="Płatność od kontrahenta lub do dostawcy nie jest w pełni rozliczona.",
                        recommendation="Zweryfikuj status rozliczenia należności lub zobowiązania.",
                        confidence=0.8,
                    )
                )

        return issues

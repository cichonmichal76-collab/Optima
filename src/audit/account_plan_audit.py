from __future__ import annotations

from collections import Counter
from typing import Iterable, Sequence

from src.core.models import AccountRecord, AuditIssue, LedgerRecord


class AccountPlanAudit:
    def run(
        self,
        records: Sequence[AccountRecord],
        ledger_records: Sequence[LedgerRecord] | None = None,
        enforce_jpk: bool = False,
        allowed_tags: set[str] | None = None,
    ) -> list[AuditIssue]:
        issues: list[AuditIssue] = []
        numbers = [record.account_number for record in records if record.account_number]
        duplicates = Counter(numbers)
        ledger_records = ledger_records or []
        allowed_tags = allowed_tags or set()

        for record in records:
            if duplicates[record.account_number] > 1:
                issues.append(
                    AuditIssue(
                        level="WARNING",
                        area="ACCOUNT_PLAN",
                        document_number=record.account_number,
                        issue_code="ACCOUNT_DUPLICATE",
                        issue=f"Duplikat numeru konta: {record.account_number}.",
                        recommendation="Ujednolic numeracje lub usun duplikat z eksportu.",
                        confidence=0.95,
                    )
                )
            if enforce_jpk and record.account_number.startswith(("4", "7")) and not record.jpk_s_12_1:
                issues.append(
                    AuditIssue(
                        level="WARNING",
                        area="ACCOUNT_PLAN",
                        document_number=record.account_number,
                        issue_code="JPK_TAG_MISSING",
                        issue="Brak znacznika JPK_KR_PD S_12_1 dla konta wymagajacego oznaczenia.",
                        recommendation="Uzupelnij znacznik JPK lub wylacz kontrole dla tego audytu.",
                        confidence=0.85,
                    )
                )
            if record.jpk_s_12_1 and allowed_tags:
                if record.jpk_s_12_1 not in allowed_tags and record.jpk_s_12_1.upper() in allowed_tags:
                    issues.append(
                        AuditIssue(
                            level="WARNING",
                            area="ACCOUNT_PLAN",
                            document_number=record.account_number,
                            issue_code="JPK_TAG_CASE",
                            issue="Znacznik JPK ma nieprawidlowa wielkosc liter.",
                            recommendation="Popraw wielkosc liter zgodnie ze slownikiem dopuszczalnych wartosci.",
                            confidence=0.85,
                        )
                    )
            if record.is_active is False:
                used = any(
                    record.account_number in {ledger.account_wn, ledger.account_ma}
                    for ledger in ledger_records
                )
                if used:
                    issues.append(
                        AuditIssue(
                            level="WARNING",
                            area="ACCOUNT_PLAN",
                            document_number=record.account_number,
                            issue_code="ACCOUNT_INACTIVE_USED",
                            issue="Nieaktywne konto zostalo uzyte w ksiegowaniach.",
                            recommendation="Zweryfikuj status konta i historie dekretacji.",
                            confidence=0.9,
                        )
                    )

        known_accounts = {record.account_number for record in records}
        for account in self._ledger_accounts(ledger_records):
            if account not in known_accounts:
                issues.append(
                    AuditIssue(
                        level="CRITICAL",
                        area="ACCOUNT_PLAN",
                        document_number=account,
                        issue_code="ACCOUNT_USED_NOT_FOUND",
                        issue=f"Konto {account} zostalo uzyte w ksiegowaniach, ale nie istnieje w planie kont.",
                        recommendation="Uzupelnij plan kont albo popraw dekretacje.",
                        confidence=0.98,
                    )
                )

        return issues

    @staticmethod
    def _ledger_accounts(records: Iterable[LedgerRecord]) -> set[str]:
        accounts: set[str] = set()
        for record in records:
            if record.account_wn:
                accounts.add(record.account_wn)
            if record.account_ma:
                accounts.add(record.account_ma)
        return accounts


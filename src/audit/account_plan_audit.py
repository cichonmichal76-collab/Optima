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
                        recommendation="Ujednoli? numeracj? lub usun?? duplikat z eksportu.",
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
                        issue="Brak znacznika JPK_KR_PD S_12_1 dla konta wymagajÄcego oznaczenia.",
                        recommendation="Uzupe?nij znacznik JPK lub wy??cz kontrol? dla tego audytu.",
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
                            issue="Znacznik JPK ma nieprawid?ow? wielko?? liter.",
                            recommendation="Popraw wielko?? liter zgodnie ze s?ownikiem dopuszczalnych warto?ci.",
                            confidence=0.85,
                        )
                    )
            if record.is_active is False:
                used = any(
                    record.account_number in self._record_accounts(ledger)
                    for ledger in ledger_records
                )
                if used:
                    issues.append(
                        AuditIssue(
                            level="WARNING",
                            area="ACCOUNT_PLAN",
                            document_number=record.account_number,
                            issue_code="ACCOUNT_INACTIVE_USED",
                            issue="Nieaktywne konto zostaÅo uÅ¼yte w ksiÄgowaniach.",
                            recommendation="Zweryfikuj status konta i histori? dekretacji.",
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
                        issue=f"Konto {account} zostaÅo uÅ¼yte w ksiÄgowaniach, ale nie istnieje w planie kont.",
                        recommendation="Uzupe?nij plan kont albo popraw dekretacj?.",
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
            if record.account:
                accounts.add(record.account)
            if record.account_opposite:
                accounts.add(record.account_opposite)
        return accounts

    @staticmethod
    def _record_accounts(record: LedgerRecord) -> set[str]:
        return {
            account
            for account in (record.account_wn, record.account_ma, record.account, record.account_opposite)
            if account
        }

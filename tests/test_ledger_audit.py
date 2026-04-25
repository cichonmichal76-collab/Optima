from __future__ import annotations

from datetime import date
from decimal import Decimal

from src.audit.ledger_audit import LedgerAudit
from src.core.models import LedgerRecord


def test_ledger_audit_detects_missing_account_and_unbalanced_document():
    audit = LedgerAudit()
    records = [
        LedgerRecord(
            document_number="PK/1",
            accounting_date=date(2026, 4, 25),
            description=None,
            account_wn=None,
            account_ma="201",
            amount_wn=Decimal("100"),
            amount_ma=Decimal("0"),
        ),
        LedgerRecord(
            document_number="PK/1",
            accounting_date=date(2026, 4, 25),
            description="VAT",
            account_wn="401",
            account_ma="221",
            amount_wn=Decimal("0"),
            amount_ma=Decimal("50"),
        ),
    ]

    issues = audit.run(records, plan_accounts={"201", "221"})
    codes = {issue.issue_code for issue in issues}

    assert "LEDGER_MISSING_WN" in codes
    assert "LEDGER_UNBALANCED" in codes
    assert "LEDGER_MISSING_DESCRIPTION" in codes
    assert "LEDGER_ACCOUNT_OUTSIDE_PLAN" in codes


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


def test_ledger_audit_accepts_optima_account_and_opposite_columns():
    audit = LedgerAudit()
    records = [
        LedgerRecord(
            document_number="PK/2",
            account="401",
            account_opposite="201",
            amount_wn=Decimal("100"),
            amount_ma=Decimal("0"),
            description="Koszt",
        ),
        LedgerRecord(
            document_number="PK/2",
            account="201",
            account_opposite="401",
            amount_wn=Decimal("0"),
            amount_ma=Decimal("100"),
            description="Rozrachunek",
        ),
    ]

    issues = audit.run(records, plan_accounts={"201", "401"})
    codes = {issue.issue_code for issue in issues}

    assert "LEDGER_MISSING_WN" not in codes
    assert "LEDGER_MISSING_MA" not in codes
    assert "LEDGER_UNBALANCED" not in codes
    assert "LEDGER_ACCOUNT_OUTSIDE_PLAN" not in codes

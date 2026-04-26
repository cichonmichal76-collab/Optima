from __future__ import annotations

from collections import Counter
from decimal import Decimal
from typing import Sequence

from src.audit.account_plan_audit import AccountPlanAudit
from src.audit.bank_audit import BankAudit
from src.audit.jpk_audit import JpkAudit
from src.audit.ledger_audit import LedgerAudit
from src.audit.schema_audit import SchemaAudit
from src.audit.settlements_audit import SettlementsAudit
from src.audit.vat_audit import VatAudit
from src.core.models import (
    AccountRecord,
    AuditIssue,
    AuditRunResult,
    LedgerRecord,
    SchemaDraft,
    SettlementRecord,
    VatRecord,
)


class AuditEngine:
    def __init__(self) -> None:
        self.vat_audit = VatAudit()
        self.ledger_audit = LedgerAudit()
        self.account_plan_audit = AccountPlanAudit()
        self.settlements_audit = SettlementsAudit()
        self.bank_audit = BankAudit()
        self.schema_audit = SchemaAudit()
        self.jpk_audit = JpkAudit()

    def run(
        self,
        vat_records: Sequence[VatRecord] | None = None,
        ledger_records: Sequence[LedgerRecord] | None = None,
        account_records: Sequence[AccountRecord] | None = None,
        settlement_records: Sequence[SettlementRecord] | None = None,
        bank_records: Sequence[SettlementRecord] | None = None,
        schema_drafts: Sequence[SchemaDraft] | None = None,
        jpk_records: Sequence[VatRecord] | None = None,
        options: dict | None = None,
    ) -> AuditRunResult:
        options = options or {}
        vat_records = vat_records or []
        ledger_records = ledger_records or []
        account_records = account_records or []
        settlement_records = settlement_records or []
        bank_records = bank_records or []
        schema_drafts = schema_drafts or []
        jpk_records = jpk_records or []

        plan_accounts = {record.account_number for record in account_records if record.account_number}
        vat_accounts = set(options.get("vat_accounts", []))
        allowed_tags = set(options.get("allowed_tags", []))

        issues: list[AuditIssue] = []
        if vat_records:
            issues.extend(
                self.vat_audit.run(
                    vat_records,
                    period=options.get("period"),
                    ledger_records=ledger_records,
                    vat_accounts=vat_accounts,
                )
            )
        if ledger_records:
            issues.extend(
                self.ledger_audit.run(
                    ledger_records,
                    plan_accounts=plan_accounts,
                    period=options.get("period"),
                    vat_accounts=vat_accounts,
                )
            )
        if account_records:
            issues.extend(
                self.account_plan_audit.run(
                    account_records,
                    ledger_records=ledger_records,
                    enforce_jpk=bool(options.get("enforce_jpk")),
                    allowed_tags=allowed_tags,
                )
            )
        if settlement_records:
            issues.extend(self.settlements_audit.run(settlement_records))
        if bank_records:
            issues.extend(
                self.bank_audit.run(
                    bank_records,
                    financial_cost_accounts=set(options.get("financial_cost_accounts", [])),
                    public_accounts=set(options.get("public_accounts", [])),
                )
            )
        if schema_drafts:
            issues.extend(self.schema_audit.run(schema_drafts))
        if jpk_records:
            issues.extend(self.jpk_audit.run(jpk_records))

        summary = self._build_summary(issues, vat_records)
        return AuditRunResult(issues=self._sort_issues(issues), summary=summary)

    @staticmethod
    def _build_summary(issues: Sequence[AuditIssue], vat_records: Sequence[VatRecord]) -> dict[str, object]:
        counts = Counter(issue.level for issue in issues)
        contractors = {record.contractor_name for record in vat_records if record.contractor_name}
        documents = {record.document_number for record in vat_records if record.document_number}
        return {
            "critical_count": counts.get("CRITICAL", 0),
            "warning_count": counts.get("WARNING", 0),
            "info_count": counts.get("INFO", 0),
            "document_count": len(documents),
            "contractor_count": len(contractors),
            "net_total": str(sum((record.net for record in vat_records), Decimal("0"))),
            "vat_total": str(sum((record.vat for record in vat_records), Decimal("0"))),
            "gross_total": str(sum((record.gross for record in vat_records), Decimal("0"))),
            "disclaimer": "Wyniki wymagaj? weryfikacji przez osob? odpowiedzialn? za ksi?gowo??.",
        }

    @staticmethod
    def _sort_issues(issues: Sequence[AuditIssue]) -> list[AuditIssue]:
        order = {"CRITICAL": 0, "WARNING": 1, "INFO": 2}
        return sorted(
            issues,
            key=lambda issue: (
                order.get(str(issue.level), 99),
                issue.area,
                issue.document_number or "",
                issue.issue_code,
            ),
        )


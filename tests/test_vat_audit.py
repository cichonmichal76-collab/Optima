from __future__ import annotations

from decimal import Decimal

from src.audit.vat_audit import VatAudit
from src.core.models import VatRecord


def build_vat_record(**overrides):
    payload = {
        "source_type": "VAT_SALE",
        "document_number": "FS/1",
        "contractor_name": "Acme",
        "contractor_nip": "1234567890",
        "net": Decimal("100"),
        "vat": Decimal("23"),
        "gross": Decimal("123"),
        "vat_rate": "23%",
    }
    payload.update(overrides)
    return VatRecord(**payload)


def test_vat_audit_accepts_correct_document():
    audit = VatAudit()

    issues = audit.run([build_vat_record()])

    assert issues == []


def test_vat_audit_accepts_missing_vat_rate():
    audit = VatAudit()

    issues = audit.run([build_vat_record(vat_rate=None)])

    assert issues == []


def test_vat_audit_detects_mismatch_duplicate_and_missing_nip():
    audit = VatAudit()
    records = [
        build_vat_record(gross=Decimal("120"), contractor_nip=None),
        build_vat_record(gross=Decimal("120"), contractor_nip=None),
    ]

    issues = audit.run(records)
    codes = {issue.issue_code for issue in issues}

    assert "VAT_SUM_MISMATCH" in codes
    assert "VAT_DUPLICATE" in codes
    assert "VAT_MISSING_CONTRACTOR" in codes

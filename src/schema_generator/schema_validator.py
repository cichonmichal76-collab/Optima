from __future__ import annotations

from src.core.models import AuditIssue, SchemaDraft


class SchemaValidator:
    def validate(self, draft: SchemaDraft) -> list[AuditIssue]:
        issues: list[AuditIssue] = []
        if not draft.lines:
            issues.append(
                self._issue(
                    "CRITICAL",
                    draft,
                    "SCHEMA_EMPTY",
                    "Schemat nie zawiera zadnych pozycji.",
                    "Dodaj pozycje Wn/Ma do projektu schematu.",
                )
            )
            return issues

        sides = {line.side.upper() for line in draft.lines}
        if "WN" not in sides or "MA" not in sides:
            issues.append(
                self._issue(
                    "CRITICAL",
                    draft,
                    "SCHEMA_SIDE_MISSING",
                    "Schemat nie zawiera obu stron Wn/Ma.",
                    "Uzupelnij brakujaca strone dekretu.",
                )
            )

        if not draft.condition or draft.condition.strip().lower() in {"true", "1", "always"}:
            issues.append(
                self._issue(
                    "WARNING",
                    draft,
                    "SCHEMA_CONDITION_TOO_BROAD",
                    "Warunek schematu jest zbyt ogolny.",
                    "Doprecyzuj warunek, aby schemat nie lapal zbyt wielu dokumentow.",
                    confidence=0.85,
                )
            )

        for line in draft.lines:
            if not line.account:
                issues.append(
                    self._issue(
                        "CRITICAL",
                        draft,
                        "SCHEMA_ACCOUNT_MISSING",
                        "Jedna z pozycji nie ma przypisanego konta.",
                        "Uzupelnij konto po stronie Wn lub Ma.",
                    )
                )
            if not line.amount_expression:
                issues.append(
                    self._issue(
                        "CRITICAL",
                        draft,
                        "SCHEMA_AMOUNT_MISSING",
                        "Jedna z pozycji nie ma definicji kwoty.",
                        "Uzupelnij sposob wyliczenia kwoty.",
                    )
                )

        if "50" in draft.template_id and not any("vat" in (line.amount_expression or "").lower() for line in draft.lines):
            issues.append(
                self._issue(
                    "WARNING",
                    draft,
                    "SCHEMA_VAT_SPLIT",
                    "Schemat 50% VAT nie zawiera wyraznego rozbicia kwoty VAT.",
                    "Zweryfikuj czesc odliczona i nieodliczona VAT.",
                    confidence=0.85,
                )
            )

        return issues

    @staticmethod
    def _issue(
        level: str,
        draft: SchemaDraft,
        code: str,
        issue: str,
        recommendation: str,
        confidence: float = 0.95,
    ) -> AuditIssue:
        return AuditIssue(
            level=level,
            area="SCHEMA",
            document_number=draft.name,
            issue_code=code,
            issue=issue,
            recommendation=recommendation,
            confidence=confidence,
        )


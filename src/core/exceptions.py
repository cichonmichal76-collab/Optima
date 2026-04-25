from __future__ import annotations


class OptimaAuditError(Exception):
    """Base exception for the application."""


class UnsupportedFormatError(OptimaAuditError):
    """Raised when a connector cannot read a file."""


class MappingError(OptimaAuditError):
    """Raised when a mapping is incomplete or invalid."""


class ValidationError(OptimaAuditError):
    """Raised when imported data fails validation."""


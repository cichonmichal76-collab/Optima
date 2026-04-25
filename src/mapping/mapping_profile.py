from __future__ import annotations

from src.core.models import MappingProfile
from src.core.normalizers import normalize_header


def headers_signature(headers: list[str]) -> list[str]:
    return sorted(normalize_header(header) for header in headers)


def profile_matches(profile: MappingProfile, headers: list[str]) -> bool:
    return profile.source_signature == headers_signature(headers)


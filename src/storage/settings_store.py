from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from src.core.enums import DataKind
from src.core.models import MappingProfile
from src.mapping.mapping_profile import headers_signature, profile_matches


class SettingsStore:
    def __init__(self, file_path: Path) -> None:
        self.file_path = file_path
        self.file_path.parent.mkdir(parents=True, exist_ok=True)

    def _load_payload(self) -> dict[str, Any]:
        if not self.file_path.exists():
            return {"settings": {}, "profiles": []}
        return json.loads(self.file_path.read_text(encoding="utf-8"))

    def _save_payload(self, payload: dict[str, Any]) -> None:
        self.file_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    def load_settings(self) -> dict[str, Any]:
        return self._load_payload().get("settings", {})

    def save_settings(self, settings: dict[str, Any]) -> None:
        payload = self._load_payload()
        payload["settings"] = settings
        self._save_payload(payload)

    def load_profiles(self) -> list[MappingProfile]:
        payload = self._load_payload()
        return [MappingProfile.model_validate(item) for item in payload.get("profiles", [])]

    def save_profile(self, profile: MappingProfile) -> None:
        payload = self._load_payload()
        profiles = [MappingProfile.model_validate(item) for item in payload.get("profiles", [])]
        replaced = False
        for index, existing in enumerate(profiles):
            if existing.name == profile.name and existing.data_kind == profile.data_kind:
                profiles[index] = profile
                replaced = True
                break
        if not replaced:
            profiles.append(profile)
        payload["profiles"] = [item.model_dump(mode="json") for item in profiles]
        self._save_payload(payload)

    def find_profile(self, data_kind: DataKind, headers: list[str]) -> MappingProfile | None:
        for profile in self.load_profiles():
            if profile.data_kind == data_kind and profile_matches(profile, headers):
                return profile
        return None

    def build_profile(self, name: str, data_kind: DataKind, column_map: dict[str, str], headers: list[str]) -> MappingProfile:
        return MappingProfile(
            name=name,
            data_kind=data_kind,
            column_map=column_map,
            source_signature=headers_signature(headers),
        )


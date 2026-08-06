#!/usr/bin/env python3
"""Fail-loud audit for final dictionary-import entry payloads.

The API intentionally permits repeated spellings because dictionaries model
homographs and, occasionally, recording-per-entry collections. This command is
the stricter import-time gate: every natural-key collision must be either
numbered or explicitly waived, and every relationship lookup with more than one
candidate must carry an explicit target decision.
"""
from __future__ import annotations

import argparse
import json
import sys
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


def normalized_text(value: str) -> str:
    return unicodedata.normalize("NFC", value).strip().casefold()


def load_objects(path: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        rows: list[dict[str, Any]] = []
        for line_number, line in enumerate(text.splitlines(), start=1):
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f"{path}:{line_number}: invalid JSON: {error.msg}") from error
            rows.extend(unwrap_objects(row, source=f"{path}:{line_number}"))
        return rows
    return unwrap_objects(value, source=str(path))


def unwrap_objects(value: Any, *, source: str) -> list[dict[str, Any]]:
    if isinstance(value, list) and all(isinstance(row, dict) for row in value):
        return value
    if isinstance(value, dict) and isinstance(value.get("entries"), list):
        rows = value["entries"]
        if all(isinstance(row, dict) for row in rows):
            return rows
    if isinstance(value, dict):
        return [value]
    raise ValueError(f"{source}: expected an object, an object array, or an object with `entries`")


def lexeme_values(entry: dict[str, Any]) -> list[tuple[str, str]]:
    lexeme = entry.get("lexeme")
    if isinstance(lexeme, str):
        return [("default", lexeme)] if lexeme.strip() else []
    if isinstance(lexeme, dict):
        return [
            (orthography, value)
            for orthography, value in lexeme.items()
            if isinstance(orthography, str) and isinstance(value, str) and value.strip()
        ]
    return []


@dataclass
class AuditResult:
    entry_count: int
    lexeme_key_count: int = 0
    numbered_collision_count: int = 0
    waived_collision_count: int = 0
    relationship_lookup_count: int = 0
    errors: list[str] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return not self.errors


def waiver_key(waiver: dict[str, Any]) -> tuple[str, str] | None:
    orthography = waiver.get("orthography", "default")
    lexeme = waiver.get("lexeme")
    if not isinstance(orthography, str) or not isinstance(lexeme, str) or not lexeme.strip():
        return None
    return orthography, normalized_text(lexeme)


def read_waivers(path: Path | None, errors: list[str]) -> dict[tuple[str, str], dict[str, Any]]:
    if path is None:
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        errors.append(f"could not read collision waivers from {path}: {error}")
        return {}
    rows = payload.get("collision_waivers") if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        errors.append(f"{path}: expected `collision_waivers` array")
        return {}
    waivers: dict[tuple[str, str], dict[str, Any]] = {}
    for index, waiver in enumerate(rows):
        if not isinstance(waiver, dict):
            errors.append(f"{path}: collision_waivers[{index}] must be an object")
            continue
        key = waiver_key(waiver)
        if key is None:
            errors.append(f"{path}: collision_waivers[{index}] needs `lexeme` and optional `orthography`")
            continue
        if key in waivers:
            errors.append(f"{path}: duplicate waiver for {key[0]}={waiver.get('lexeme')!r}")
            continue
        waivers[key] = waiver
    return waivers


def build_candidate_index(
    entries: list[dict[str, Any]],
    errors: list[str],
    *,
    validate_ids: bool,
) -> tuple[dict[tuple[str, str], list[dict[str, Any]]], dict[str, dict[str, Any]]]:
    candidates: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    by_id: dict[str, dict[str, Any]] = {}
    for index, entry in enumerate(entries):
        entry_id = entry.get("id")
        if not isinstance(entry_id, str) or not entry_id.strip():
            if validate_ids:
                errors.append(f"entry[{index}] has no stable string `id`")
            continue
        if entry_id in by_id:
            if validate_ids or by_id[entry_id] != entry:
                errors.append(f"entry id {entry_id!r} occurs more than once")
            continue
        by_id[entry_id] = entry
        values = lexeme_values(entry)
        if not values and validate_ids:
            errors.append(f"entry {entry_id!r} has no non-empty lexeme")
        for orthography, value in values:
            candidates[(orthography, normalized_text(value))].append(entry)
    return candidates, by_id


def audit_entries(
    entries: list[dict[str, Any]],
    *,
    waivers_path: Path | None = None,
    relationship_lookups: list[dict[str, Any]] | None = None,
    relationship_candidates: list[dict[str, Any]] | None = None,
    identity_orthographies: tuple[str, ...] = ("default",),
) -> AuditResult:
    result = AuditResult(entry_count=len(entries))
    candidate_index, by_id = build_candidate_index(entries, result.errors, validate_ids=True)
    collision_index = {
        key: candidates
        for key, candidates in candidate_index.items()
        if key[0] in identity_orthographies
    }
    result.lexeme_key_count = len(collision_index)

    waivers = read_waivers(waivers_path, result.errors)
    used_waivers: set[tuple[str, str]] = set()
    for key, candidates in sorted(collision_index.items()):
        if len(candidates) < 2:
            continue
        orthography, normalized_lexeme = key
        entry_ids = [entry["id"] for entry in candidates]
        homographs = [entry.get("homograph") for entry in candidates]
        clean_homographs = [value.strip() for value in homographs if isinstance(value, str) and value.strip()]
        if len(clean_homographs) == len(candidates) and len(set(clean_homographs)) == len(candidates):
            result.numbered_collision_count += 1
            continue

        waiver = waivers.get(key)
        if waiver:
            waived_ids = waiver.get("entry_ids")
            reason = waiver.get("reason")
            if not isinstance(waived_ids, list) or set(waived_ids) != set(entry_ids):
                result.errors.append(
                    f"waiver for {orthography}={normalized_lexeme!r} must list exactly these entry_ids: "
                    f"{', '.join(entry_ids)}"
                )
            elif not isinstance(reason, str) or not reason.strip():
                result.errors.append(f"waiver for {orthography}={normalized_lexeme!r} needs a non-empty reason")
            else:
                used_waivers.add(key)
                result.waived_collision_count += 1
            continue

        shown = next(value for candidate in candidates for candidate_orthography, value in lexeme_values(candidate) if candidate_orthography == orthography)
        result.errors.append(
            f"unnumbered natural-key collision {orthography}={shown!r}: {', '.join(entry_ids)}; "
            "merge it, assign distinct homograph values, or add an exact collision waiver"
        )

    for key, waiver in waivers.items():
        if key not in used_waivers:
            result.errors.append(
                f"unused collision waiver for {key[0]}={waiver.get('lexeme')!r}; remove or update the stale decision"
            )

    lookup_index = candidate_index
    lookup_by_id = dict(by_id)
    if relationship_candidates:
        extra_index, extra_by_id = build_candidate_index(relationship_candidates, result.errors, validate_ids=False)
        for entry_id, entry in extra_by_id.items():
            existing = lookup_by_id.get(entry_id)
            if existing and existing != entry:
                result.errors.append(f"relationship candidate id {entry_id!r} conflicts with the final entry payload")
                continue
            if existing:
                continue
            lookup_by_id[entry_id] = entry
            for orthography, value in lexeme_values(entry):
                lookup_index[(orthography, normalized_text(value))].append(entry)

    for index, lookup in enumerate(relationship_lookups or []):
        result.relationship_lookup_count += 1
        if not isinstance(lookup, dict):
            result.errors.append(f"relationship lookup[{index}] must be an object")
            continue
        source_ref = lookup.get("source_ref")
        orthography = lookup.get("orthography", "default")
        lexeme = lookup.get("lexeme")
        selected_entry_id = lookup.get("selected_entry_id")
        label = source_ref if isinstance(source_ref, str) and source_ref.strip() else f"lookup[{index}]"
        if not isinstance(orthography, str) or not isinstance(lexeme, str) or not lexeme.strip():
            result.errors.append(f"{label}: relationship lookup needs `lexeme` and optional `orthography`")
            continue
        candidates = lookup_index.get((orthography, normalized_text(lexeme)), [])
        candidate_ids = [entry["id"] for entry in candidates]
        if not candidates:
            result.errors.append(f"{label}: no relationship target matches {orthography}={lexeme!r}")
            continue
        if selected_entry_id not in candidate_ids:
            result.errors.append(
                f"{label}: selected_entry_id {selected_entry_id!r} is not one of {', '.join(candidate_ids)}"
            )
            continue
        if len(candidates) == 1:
            continue
        resolution = lookup.get("resolution")
        target_id = resolution.get("target_entry_id") if isinstance(resolution, dict) else None
        reason = resolution.get("reason") if isinstance(resolution, dict) else None
        if target_id != selected_entry_id or not isinstance(reason, str) or not reason.strip():
            result.errors.append(
                f"{label}: {orthography}={lexeme!r} has {len(candidates)} candidates; add `resolution` "
                "with the selected `target_entry_id` and a non-empty reason"
            )

    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("entries", type=Path, help="final entry payload (JSON, JSON array, or JSONL)")
    parser.add_argument("--decisions", type=Path, help="JSON file containing collision_waivers")
    parser.add_argument("--relationship-lookups", type=Path, help="JSON/JSONL natural-key relationship lookup ledger")
    parser.add_argument("--relationship-candidates", type=Path, help="optional existing-entry candidates used only for relationship lookup resolution")
    parser.add_argument(
        "--orthography",
        action="append",
        dest="identity_orthographies",
        help="identity-bearing lexeme orthography to collision-audit (repeatable; default: default)",
    )
    args = parser.parse_args()

    try:
        entries = load_objects(args.entries)
        lookups = load_objects(args.relationship_lookups) if args.relationship_lookups else []
        candidates = load_objects(args.relationship_candidates) if args.relationship_candidates else []
    except (OSError, ValueError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1

    result = audit_entries(
        entries,
        waivers_path=args.decisions,
        relationship_lookups=lookups,
        relationship_candidates=candidates,
        identity_orthographies=tuple(args.identity_orthographies or ["default"]),
    )
    if not result.passed:
        print(f"FAIL: final import payload has {len(result.errors)} audit error(s)", file=sys.stderr)
        for error in result.errors:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print(
        f"PASS: {result.entry_count} entries, {result.lexeme_key_count} natural keys, "
        f"{result.numbered_collision_count} numbered collision groups, "
        f"{result.waived_collision_count} waived collision groups, "
        f"{result.relationship_lookup_count} relationship lookups"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

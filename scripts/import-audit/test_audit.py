import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("audit.py")
SPEC = importlib.util.spec_from_file_location("import_payload_audit", MODULE_PATH)
audit = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = audit
SPEC.loader.exec_module(audit)


class PayloadAuditorTest(unittest.TestCase):
    def test_unnumbered_nfc_collision_fails(self):
        result = audit.audit_entries([
            {"id": "one", "lexeme": "é"},
            {"id": "two", "lexeme": {"default": "E\u0301"}},
        ])

        self.assertFalse(result.passed)
        self.assertIn("unnumbered natural-key collision", result.errors[0])

    def test_distinct_homographs_pass(self):
        result = audit.audit_entries([
            {"id": "one", "lexeme": "word", "homograph": "1"},
            {"id": "two", "lexeme": "WORD", "homograph": "2"},
        ])

        self.assertTrue(result.passed)
        self.assertEqual(result.numbered_collision_count, 1)

    def test_repeated_homograph_number_fails(self):
        result = audit.audit_entries([
            {"id": "one", "lexeme": "word", "homograph": "1"},
            {"id": "two", "lexeme": "word", "homograph": "1"},
        ])

        self.assertFalse(result.passed)

    def test_exact_waiver_passes_and_stale_waiver_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            decisions_path = Path(directory) / "decisions.json"
            decisions_path.write_text(json.dumps({
                "collision_waivers": [{
                    "lexeme": "word",
                    "entry_ids": ["one", "two"],
                    "reason": "One curated recording per entry.",
                }],
            }), encoding="utf-8")
            entries = [{"id": "one", "lexeme": "word"}, {"id": "two", "lexeme": "word"}]

            self.assertTrue(audit.audit_entries(entries, waivers_path=decisions_path).passed)
            self.assertFalse(audit.audit_entries(entries[:1], waivers_path=decisions_path).passed)

    def test_ambiguous_relationship_lookup_requires_resolution(self):
        entries = [
            {"id": "one", "lexeme": "word", "homograph": "1"},
            {"id": "two", "lexeme": "word", "homograph": "2"},
        ]
        lookup = {"source_ref": "page-7-form-2", "lexeme": "word", "selected_entry_id": "two"}

        self.assertFalse(audit.audit_entries(entries, relationship_lookups=[lookup]).passed)
        lookup["resolution"] = {"target_entry_id": "two", "reason": "The gloss matches homograph 2."}
        self.assertTrue(audit.audit_entries(entries, relationship_lookups=[lookup]).passed)

    def test_unique_relationship_lookup_rejects_wrong_target(self):
        result = audit.audit_entries(
            [{"id": "one", "lexeme": "word"}],
            relationship_lookups=[{"source_ref": "row-1", "lexeme": "word", "selected_entry_id": "missing"}],
        )

        self.assertFalse(result.passed)
        self.assertIn("is not one of", result.errors[0])

    def test_duplicate_entry_ids_fail(self):
        result = audit.audit_entries([
            {"id": "same", "lexeme": "one"},
            {"id": "same", "lexeme": "two"},
        ])

        self.assertFalse(result.passed)
        self.assertIn("occurs more than once", result.errors[0])

    def test_pronunciation_homophones_are_not_default_spelling_collisions(self):
        entries = [
            {"id": "one", "lexeme": {"default": "one", "pronunciation": "same"}},
            {"id": "two", "lexeme": {"default": "two", "pronunciation": "same"}},
        ]

        self.assertTrue(audit.audit_entries(entries).passed)
        self.assertFalse(audit.audit_entries(entries, identity_orthographies=("default", "pronunciation")).passed)


if __name__ == "__main__":
    unittest.main()

"""Corpus builder tests — offline, no GPU."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from slid_llm.corpus import build_records, find_repo_root, write_corpus


class CorpusTests(unittest.TestCase):
    def test_repo_root_found(self):
        root = find_repo_root(Path(__file__))
        self.assertTrue((root / "docs" / "site" / "llms.txt").is_file())

    def test_build_includes_refuse_paths(self):
        root = find_repo_root(Path(__file__))
        rows = build_records(root)
        self.assertGreater(len(rows), 5)
        blob = json.dumps(rows)
        self.assertIn("refuse", blob.lower())
        self.assertIn("PERsiST", blob)
        self.assertIn("PSI", blob)

    def test_write_corpus_jsonl(self):
        root = find_repo_root(Path(__file__))
        with tempfile.TemporaryDirectory() as td:
            out = Path(td) / "c.jsonl"
            write_corpus(out, root)
            lines = out.read_text(encoding="utf-8").strip().splitlines()
            self.assertGreater(len(lines), 5)
            row = json.loads(lines[0])
            self.assertIn("messages", row)
            self.assertEqual(row["messages"][0]["role"], "system")


if __name__ == "__main__":
    unittest.main()

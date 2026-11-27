"""Host door tests — refuse paths + mocked Ollama response."""

from __future__ import annotations

import json
import unittest
from unittest import mock

from slid_llm.host import HostError, chat


class HostTests(unittest.TestCase):
    def test_refuse_empty_prompt(self):
        with self.assertRaises(HostError) as ctx:
            chat("   ")
        self.assertIn("refuse", str(ctx.exception).lower())

    def test_refuse_unsafe_lab_request(self):
        with self.assertRaises(HostError) as ctx:
            chat("invent persist price")
        self.assertIn("refuse", str(ctx.exception).lower())

    def test_chat_openai_compatible_success(self):
        payload = {
            "choices": [{"message": {"content": "PSI first, then Rider."}}]
        }

        class Resp:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def read(self):
                return json.dumps(payload).encode("utf-8")

        with mock.patch("slid_llm.host.urllib.request.urlopen", return_value=Resp()):
            out = chat("lead product?")
        self.assertIn("PSI", out)

    def test_invalid_response_rejected(self):
        payload = {"choices": [{"message": {"content": ""}}]}

        class Resp:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def read(self):
                return json.dumps(payload).encode("utf-8")

        # First call (openai path) returns empty; fallback ollama also empty → error.
        with mock.patch("slid_llm.host.urllib.request.urlopen", return_value=Resp()):
            with self.assertRaises(HostError) as ctx:
                chat("hello")
        self.assertRegex(str(ctx.exception).lower(), r"invalid|empty|refuse")


if __name__ == "__main__":
    unittest.main()

"""
test_llm_client.py — Unit tests for LLM client helpers (e.g., _extract_json).
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))

from llm_client import _extract_json


class TestExtractJson(unittest.TestCase):
    """Unit tests for _extract_json helper function."""

    def test_plain_json_object(self):
        """Test parsing valid plain JSON string without markdown fences."""
        raw = '{"name": "Family Guy", "episodes": 400, "active": true}'
        expected = {"name": "Family Guy", "episodes": 400, "active": True}
        self.assertEqual(_extract_json(raw), expected)

    def test_json_in_markdown_code_fence(self):
        """Test parsing JSON inside ```json ... ``` markdown code block."""
        raw = """```json
{
    "title": "Death Has a Shadow",
    "season": 1
}
```"""
        expected = {"title": "Death Has a Shadow", "season": 1}
        self.assertEqual(_extract_json(raw), expected)

    def test_json_in_plain_markdown_fence(self):
        """Test parsing JSON inside ``` ... ``` markdown block without 'json' tag."""
        raw = """```
{
    "status": "success",
    "data": [1, 2, 3]
}
```"""
        expected = {"status": "success", "data": [1, 2, 3]}
        self.assertEqual(_extract_json(raw), expected)

    def test_json_in_uppercase_markdown_fence(self):
        """Test parsing JSON inside ```JSON ... ``` markdown code block (case-insensitive)."""
        raw = """```JSON
{
    "result": "ok"
}
```"""
        expected = {"result": "ok"}
        self.assertEqual(_extract_json(raw), expected)

    def test_json_with_surrounding_text_and_fence(self):
        """Test extracting JSON block when LLM adds explanatory text before/after fence."""
        raw = """Here is the JSON you requested:

```json
{
    "id": "s01e01",
    "summary": "Peter loses his job."
}
```

Hope this helps!"""
        expected = {"id": "s01e01", "summary": "Peter loses his job."}
        self.assertEqual(_extract_json(raw), expected)

    def test_json_with_whitespace_and_newlines(self):
        """Test parsing JSON with whitespace/newlines around fences."""
        raw = "   \n\n```json\n  {\"key\": \"value\"}  \n```\n\n   "
        expected = {"key": "value"}
        self.assertEqual(_extract_json(raw), expected)

    def test_invalid_json_raises_value_error(self):
        """Test that malformed JSON raises ValueError with custom snippet message."""
        raw = "```json\n{invalid_json: true}\n```"
        with self.assertRaises(ValueError) as ctx:
            _extract_json(raw)
        err_msg = str(ctx.exception)
        self.assertIn("Failed to parse JSON from LLM output", err_msg)
        self.assertIn("Snippet:", err_msg)
        self.assertIn("invalid_json", err_msg)

    def test_non_json_text_raises_value_error(self):
        """Test that plain non-JSON text raises ValueError."""
        raw = "I cannot generate JSON for this request."
        with self.assertRaises(ValueError) as ctx:
            _extract_json(raw)
        self.assertIn("Failed to parse JSON from LLM output", str(ctx.exception))

    def test_empty_json_object(self):
        """Test parsing empty JSON object."""
        self.assertEqual(_extract_json("{}"), {})
        self.assertEqual(_extract_json("```json\n{}\n```"), {})


if __name__ == "__main__":
    unittest.main()

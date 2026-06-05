"""
gemini_client.py
----------------
Calls Gemini 2.5 Flash with the image and system prompt.
Returns parsed JSON or raises a clear error.
"""

import os
import json
import base64
import re
import httpx
from prompt import SYSTEM_PROMPT


GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.5-flash:generateContent"
)


def _encode_image(image_bytes: bytes, mime_type: str) -> str:
    return base64.b64encode(image_bytes).decode("utf-8")


def _extract_json(text: str) -> dict:
    """
    Extract JSON from Gemini response.
    Handles cases where the model wraps output in markdown code fences.
    """
    # Strip markdown fences if present
    text = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if match:
        text = match.group(1)
    return json.loads(text)


async def analyze_structural_drawing(
    image_bytes: bytes,
    mime_type: str = "image/png",
) -> dict:
    """
    Send image to Gemini 2.5 Flash and return parsed structural analysis.

    Returns dict with keys: section_type, unit, dimensions_read,
                            corners, line_segments, warnings
    Raises ValueError if Gemini returns unparseable output.
    Raises httpx.HTTPError on API failures.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError("GEMINI_API_KEY not set")

    payload = {
        "system_instruction": {
            "parts": [{"text": SYSTEM_PROMPT}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": _encode_image(image_bytes, mime_type),
                        }
                    },
                    {
                        "text": (
                            "Analyze this structural section drawing. "
                            "Follow all instructions in the system prompt exactly. "
                            "Return only valid JSON."
                        )
                    },
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0,        # deterministic output for geometry
            "responseMimeType": "application/json",
        },
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            GEMINI_API_URL,
            headers={"x-goog-api-key": api_key},
            json=payload,
        )
        response.raise_for_status()

    data = response.json()

    # Extract text from Gemini response structure
    try:
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as e:
        raise ValueError(f"Unexpected Gemini response structure: {data}") from e

    try:
        result = _extract_json(raw_text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Gemini returned invalid JSON: {raw_text[:500]}") from e

    # Basic sanity check
    required_keys = {"section_type", "corners", "line_segments"}
    missing = required_keys - set(result.keys())
    if missing:
        raise ValueError(f"Gemini response missing keys: {missing}")

    return result
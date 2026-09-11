"""
llm_client.py — Provider-agnostic wrapper. Same skill prompt + schema,
different backend model. Switch providers via LLM_PROVIDER in .env.
"""
import json
import os
import re
from typing import Optional
import config


def _extract_json(text: str) -> dict:
    """LLMs sometimes wrap JSON in markdown fences; strip those."""
    text = text.strip()
    match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
    if match:
        text = match.group(1)
    return json.loads(text)


def _load_skill_prompt(skill_path: Optional[str] = None) -> str:
    path = skill_path or config.SKILL_FILE_PATH
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _build_prompt(
    episode_id: str,
    episode_title: str,
    transcript: str,
    skill_path: Optional[str] = None
) -> str:
    skill = _load_skill_prompt(skill_path)
    return f"""{skill}

## Actual input

episode_id: {episode_id}
episode_title: {episode_title}

transcript:
---
{transcript}
---

Return ONLY the JSON object described above, nothing else."""


def generate_text(prompt: str, max_tokens: int = 4096) -> str:
    """Generates raw text from the configured LLM provider without JSON extraction."""
    provider = config.LLM_PROVIDER

    if provider == "gemini":
        from google import genai
        client = genai.Client(api_key=config.GEMINI_API_KEY) if config.GEMINI_API_KEY else genai.Client()
        response = client.models.generate_content(
            model=config.GEMINI_MODEL,
            contents=prompt,
        )
        return response.text or ""
    elif provider == "openai":
        from openai import OpenAI
        client = OpenAI(api_key=config.OPENAI_API_KEY)
        response = client.chat.completions.create(
            model=config.OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=0.3,
        )
        return response.choices[0].message.content or ""
    elif provider == "anthropic":
        import anthropic
        client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
        response = client.messages.create(
            model=config.ANTHROPIC_MODEL,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text or ""
    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {provider}")


def generate_review_json(episode_id: str, episode_title: str, transcript: str, skill_path: Optional[str] = None) -> dict:
    prompt = _build_prompt(episode_id, episode_title, transcript, skill_path)
    raw_text = generate_text(prompt, max_tokens=4096)
    return _extract_json(raw_text)

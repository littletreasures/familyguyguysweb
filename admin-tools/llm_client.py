"""
llm_client.py — Provider-agnostic wrapper. Same skill prompt + schema,
different backend model. Switch providers via LLM_PROVIDER in .env.
"""
import json
import re
import config


def _extract_json(text: str) -> dict:
    """LLMs sometimes wrap JSON in markdown fences; strip those."""
    text = text.strip()
    match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
    if match:
        text = match.group(1)
    return json.loads(text)


def _load_skill_prompt() -> str:
    with open(config.SKILL_FILE_PATH, "r") as f:
        return f.read()


def _build_prompt(episode_id: str, episode_title: str, transcript: str) -> str:
    skill = _load_skill_prompt()
    return f"""{skill}

## Actual input

episode_id: {episode_id}
episode_title: {episode_title}

transcript:
---
{transcript}
---

Return ONLY the JSON object described above, nothing else."""


def generate_review_json(episode_id: str, episode_title: str, transcript: str) -> dict:
    prompt = _build_prompt(episode_id, episode_title, transcript)
    provider = config.LLM_PROVIDER

    if provider == "gemini":
        return _call_gemini(prompt)
    elif provider == "openai":
        return _call_openai(prompt)
    elif provider == "anthropic":
        return _call_anthropic(prompt)
    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {provider}")


def _call_gemini(prompt: str) -> dict:
    import google.generativeai as genai
    genai.configure(api_key=config.GEMINI_API_KEY)
    model = genai.GenerativeModel(config.GEMINI_MODEL)
    response = model.generate_content(prompt)
    return _extract_json(response.text)


def _call_openai(prompt: str) -> dict:
    from openai import OpenAI
    client = OpenAI(api_key=config.OPENAI_API_KEY)
    response = client.chat.completions.create(
        model=config.OPENAI_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    return _extract_json(response.choices[0].message.content)


def _call_anthropic(prompt: str) -> dict:
    import anthropic
    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
    response = client.messages.create(
        model=config.ANTHROPIC_MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    return _extract_json(response.content[0].text)

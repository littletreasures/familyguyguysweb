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
    match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL | re.IGNORECASE)
    if match:
        text = match.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        snippet = text[:200] + ("..." if len(text) > 200 else "")
        raise ValueError(f"Failed to parse JSON from LLM output: {e}\nSnippet: {snippet}") from e


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


def _get_omlx_api_key() -> str:
    """Returns configured OMLX_API_KEY, or attempts to read ~/.omlx/settings.json, or defaults to empty."""
    if getattr(config, "OMLX_API_KEY", ""):
        return config.OMLX_API_KEY
    try:
        from pathlib import Path
        settings_file = Path.home() / ".omlx" / "settings.json"
        if settings_file.exists():
            import json
            with open(settings_file, "r", encoding="utf-8") as f:
                s = json.load(f)
                return s.get("auth", {}).get("api_key", "")
    except Exception:
        pass
    return ""


def get_available_models(provider: str) -> list[str]:
    """
    Returns available models for the given provider.
    For oMLX / OpenAI-compatible local servers, queries {OMLX_BASE_URL}/models with a short timeout.
    If unreachable, returns typical models clearly labeled as '(server offline — typical local models)'.
    """
    p = provider.lower().strip()
    if p in ("omlx", "local", "lmstudio"):
        try:
            import requests
            headers = {}
            api_key = _get_omlx_api_key()
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            # Disable proxy for localhost probes
            resp = requests.get(f"{config.OMLX_BASE_URL}/models", headers=headers, timeout=1.0, proxies={"http": None, "https": None})
            if resp.status_code == 200:
                data = resp.json()
                models = [m.get("id") for m in data.get("data", []) if m.get("id")]
                if models:
                    return sorted(models)
        except Exception:
            pass
        return [
            "mlx-community/Qwen2.5-7B-Instruct-4bit (server offline — typical local models)",
            "mlx-community/Llama-3.2-3B-Instruct-4bit (server offline — typical local models)",
            "mlx-community/Qwen2.5-Coder-32B-Instruct-4bit (server offline — typical local models)",
        ]
    elif p == "gemini":
        return [
            "gemini-3.7-flash",
            "gemini-2.5-pro",
            "gemini-2.5-flash",
            "gemini-1.5-pro",
            "gemini-1.5-flash",
        ]
    elif p == "openai":
        return [
            "gpt-4o",
            "gpt-4o-mini",
            "o3-mini",
            "o1",
            "gpt-4-turbo",
        ]
    elif p == "anthropic":
        return [
            "claude-3-5-sonnet-20241022",
            "claude-3-7-sonnet-20250219",
            "claude-3-5-haiku-20241022",
            "claude-3-opus-20240229",
        ]
    return []


def generate_text(
    prompt: str,
    max_tokens: int = 4096,
    provider: Optional[str] = None,
    model: Optional[str] = None
) -> str:
    """Generates raw text from the specified (or default configured) LLM provider."""
    prov = (provider or config.LLM_PROVIDER).lower().strip()

    if prov == "gemini":
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=config.GEMINI_API_KEY) if config.GEMINI_API_KEY else genai.Client()
        target_model = model or config.GEMINI_MODEL
        response = client.models.generate_content(
            model=target_model,
            contents=prompt,
            config=types.GenerateContentConfig(max_output_tokens=max_tokens),
        )
        return response.text or ""

    elif prov in ("omlx", "local", "lmstudio"):
        # Generic OpenAI-compatible local server (oMLX default at localhost:8000/v1, LM Studio at localhost:1234/v1)
        from openai import OpenAI
        base_url = config.OMLX_BASE_URL
        api_key = _get_omlx_api_key() or "not-needed"
        target_model = model or config.OMLX_MODEL
        target_model = re.sub(r"\s*\(server offline — typical local models\)", "", target_model).strip()
        client = OpenAI(base_url=base_url, api_key=api_key)
        try:
            response = client.chat.completions.create(
                model=target_model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
                temperature=0.3,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            err_str = str(e).lower()
            if any(k in err_str for k in ["connection", "refused", "failed to connect", "unreachable", "not allowed"]):
                raise ConnectionError(
                    f"oMLX server is unreachable at {base_url}. Start oMLX to generate with local models."
                ) from e
            raise

    elif prov == "openai":
        from openai import OpenAI
        client = OpenAI(api_key=config.OPENAI_API_KEY)
        target_model = model or config.OPENAI_MODEL
        response = client.chat.completions.create(
            model=target_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=0.3,
        )
        return response.choices[0].message.content or ""

    elif prov == "anthropic":
        import anthropic
        client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
        target_model = model or config.ANTHROPIC_MODEL
        response = client.messages.create(
            model=target_model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text or ""

    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {prov}")


def generate_review_json(
    episode_id: str,
    episode_title: str,
    transcript: str,
    skill_path: Optional[str] = None,
    max_tokens: int = 4096,
    provider: Optional[str] = None,
    model: Optional[str] = None,
) -> dict:
    prompt = _build_prompt(episode_id, episode_title, transcript, skill_path)
    raw_text = generate_text(prompt, max_tokens=max_tokens, provider=provider, model=model)
    return _extract_json(raw_text)

"""
transcript_schema.py — Strict data validation for podcast episode transcripts in admin-tools.
"""
import re
from typing import List, Optional, Dict, Any

try:
    from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict
    PYDANTIC_AVAILABLE = True
except ImportError:
    PYDANTIC_AVAILABLE = False

ALLOWED_HOST_NAMES = {"Jason", "Collin", "Tyler"}
ALLOWED_STATUSES = {"draft", "published", "archived"}


if PYDANTIC_AVAILABLE:
    class TranscriptEntryModel(BaseModel):
        start_seconds: float = Field(..., ge=0.0)
        end_seconds: Optional[float] = Field(None, ge=0.0)
        speaker: str = Field(..., min_length=1)
        text: str = Field(..., min_length=1)

        @field_validator("speaker")
        @classmethod
        def validate_speaker(cls, v: str) -> str:
            v_clean = v.strip()
            if re.match(r"^speaker\s*\d+$", v_clean, re.IGNORECASE):
                raise ValueError(f"Generic speaker label '{v_clean}' is not permitted.")
            return v_clean

        @field_validator("text")
        @classmethod
        def validate_text(cls, v: str) -> str:
            v_clean = v.strip()
            if not v_clean:
                raise ValueError("Transcript entry text cannot be empty.")
            return v_clean

        @model_validator(mode="after")
        def validate_entry_duration(self):
            if self.end_seconds is not None and self.end_seconds < self.start_seconds:
                raise ValueError(f"Entry end_seconds ({self.end_seconds}) cannot be before start_seconds ({self.start_seconds})")
            return self

    class TranscriptSectionModel(BaseModel):
        id: str = Field(..., min_length=1)
        heading: str = Field(..., min_length=1)
        start_seconds: float = Field(..., ge=0.0)
        end_seconds: float = Field(..., ge=0.0)
        entries: List[TranscriptEntryModel] = Field(..., min_length=1)

        @model_validator(mode="after")
        def validate_section_bounds(self):
            if self.end_seconds < self.start_seconds:
                raise ValueError(f"Section end_seconds ({self.end_seconds}) cannot be before start_seconds ({self.start_seconds})")
            for idx, entry in enumerate(self.entries):
                if entry.start_seconds < self.start_seconds:
                    raise ValueError(f"Entry {idx} start_seconds ({entry.start_seconds}) is before section start ({self.start_seconds})")
                if entry.start_seconds > self.end_seconds:
                    raise ValueError(f"Entry {idx} start_seconds ({entry.start_seconds}) exceeds section end ({self.end_seconds})")
                if entry.end_seconds is not None and entry.end_seconds > self.end_seconds:
                    raise ValueError(f"Entry {idx} end_seconds ({entry.end_seconds}) exceeds section end ({self.end_seconds})")
            return self

    class EpisodeTranscriptModel(BaseModel):
        episode_id: str = Field(..., min_length=1)
        status: str = Field(default="draft")
        source: str = Field(default="riverside")
        language: str = Field(default="en")
        transcript_version: int = Field(default=1, ge=1)
        intro: Optional[str] = None
        seo_description: Optional[str] = None
        sections: List[TranscriptSectionModel] = Field(..., min_length=1)
        plain_text: str = Field(default="")
        word_count: int = Field(default=0, ge=0)
        published_at: Optional[str] = None
        _comment: Optional[str] = None
        is_synthetic: Optional[bool] = None

        @field_validator("episode_id")
        @classmethod
        def validate_episode_id(cls, v: str) -> str:
            v_clean = v.strip()
            if not re.match(r"^s\d+e\d+$", v_clean, re.IGNORECASE):
                raise ValueError(f"Invalid episode_id '{v_clean}'. Expected format 's1e4'.")
            return v_clean.lower()

        @field_validator("status")
        @classmethod
        def validate_status(cls, v: str) -> str:
            v_clean = v.strip().lower()
            if v_clean not in ALLOWED_STATUSES:
                raise ValueError(f"Invalid status '{v_clean}'. Allowed: {ALLOWED_STATUSES}")
            return v_clean

        @model_validator(mode="after")
        def validate_published_and_sections(self):
            if self.status == "published" and not self.published_at:
                raise ValueError("Published transcripts must include a 'published_at' timestamp.")
            # Check section non-overlap
            prev_end = -1.0
            for idx, sec in enumerate(self.sections):
                if idx > 0 and sec.start_seconds < prev_end:
                    raise ValueError(f"Section {idx} ('{sec.id}') starts at {sec.start_seconds}s before preceding section ends at {prev_end}s.")
                prev_end = sec.end_seconds
            return self


def validate_transcript_dict(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validates a raw transcript dictionary using Pydantic if available,
    or strict dictionary inspection fallback.
    """
    if PYDANTIC_AVAILABLE:
        model = EpisodeTranscriptModel(**data)
        return model.model_dump()

    # Fallback validation
    ep_id = str(data.get("episode_id", "")).strip().lower()
    if not re.match(r"^s\d+e\d+$", ep_id):
        raise ValueError(f"Invalid or missing 'episode_id': got '{ep_id}'")

    status = str(data.get("status", "draft")).strip().lower()
    if status not in ALLOWED_STATUSES:
        raise ValueError(f"Invalid status '{status}'")

    published_at = data.get("published_at")
    if status == "published" and (not published_at or not str(published_at).strip()):
        raise ValueError("Published transcripts must include a 'published_at' timestamp.")

    sections = data.get("sections", [])
    if not isinstance(sections, list) or len(sections) == 0:
        raise ValueError("Transcript must contain at least one section in 'sections'")

    validated_sections = []
    prev_section_end = -1.0

    for s_idx, sec in enumerate(sections):
        if not isinstance(sec, dict):
            raise ValueError(f"Section at index {s_idx} must be a dictionary")
        s_id = str(sec.get("id", "")).strip()
        s_heading = str(sec.get("heading", "")).strip()
        if not s_id or not s_heading:
            raise ValueError(f"Section at index {s_idx} missing 'id' or 'heading'")

        start_sec = float(sec.get("start_seconds", 0.0))
        end_sec = float(sec.get("end_seconds", 0.0))
        if start_sec < 0 or end_sec < start_sec:
            raise ValueError(f"Invalid time bounds for section '{s_id}': {start_sec} -> {end_sec}")

        if s_idx > 0 and start_sec < prev_section_end:
            raise ValueError(f"Section '{s_id}' starts at {start_sec}s before preceding section ends at {prev_section_end}s.")
        prev_section_end = end_sec

        entries = sec.get("entries", [])
        if not isinstance(entries, list) or len(entries) == 0:
            raise ValueError(f"Section '{s_id}' must have at least one entry")

        validated_entries = []
        for e_idx, ent in enumerate(entries):
            if not isinstance(ent, dict):
                raise ValueError(f"Entry {e_idx} in section '{s_id}' must be a dictionary")
            e_speaker = str(ent.get("speaker", "")).strip()
            if not e_speaker or re.match(r"^speaker\s*\d+$", e_speaker, re.IGNORECASE):
                raise ValueError(f"Invalid speaker '{e_speaker}' at entry {e_idx} in section '{s_id}'")
            e_text = str(ent.get("text", "")).strip()
            if not e_text:
                raise ValueError(f"Empty text at entry {e_idx} in section '{s_id}'")
            e_start = float(ent.get("start_seconds", 0.0))
            if e_start < 0:
                raise ValueError(f"Invalid start_seconds for entry {e_idx}")

            if e_start < start_sec:
                raise ValueError(f"Entry {e_idx} start_seconds ({e_start}) is before section start ({start_sec})")
            if e_start > end_sec:
                raise ValueError(f"Entry {e_idx} start_seconds ({e_start}) exceeds section end ({end_sec})")

            e_end = float(ent.get("end_seconds")) if ent.get("end_seconds") is not None else None
            if e_end is not None:
                if e_end < e_start:
                    raise ValueError(f"Entry {e_idx} end_seconds ({e_end}) is before start_seconds ({e_start})")
                if e_end > end_sec:
                    raise ValueError(f"Entry {e_idx} end_seconds ({e_end}) exceeds section end ({end_sec})")

            validated_entries.append({
                "start_seconds": e_start,
                "end_seconds": e_end,
                "speaker": e_speaker,
                "text": e_text
            })

        validated_sections.append({
            "id": s_id,
            "heading": s_heading,
            "start_seconds": start_sec,
            "end_seconds": end_sec,
            "entries": validated_entries
        })

    return {
        "episode_id": ep_id,
        "status": status,
        "source": str(data.get("source", "riverside")).strip(),
        "language": str(data.get("language", "en")).strip(),
        "transcript_version": int(data.get("transcript_version", 1)),
        "intro": data.get("intro"),
        "seo_description": data.get("seo_description"),
        "sections": validated_sections,
        "plain_text": str(data.get("plain_text", "")).strip(),
        "word_count": int(data.get("word_count", 0)),
        "published_at": published_at,
        "_comment": data.get("_comment"),
        "is_synthetic": data.get("is_synthetic")
    }

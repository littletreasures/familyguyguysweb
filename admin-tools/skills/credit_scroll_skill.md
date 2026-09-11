---
name: fake-credit-scroll
description: Generate a fake end-of-episode credit scroll for "Family Guy Guys" podcast, based on a provided episode transcript. The scroll starts 100% real, then gradually escalates into absurdist fiction, ending in full chaos.
---

# Fake Credit Scroll Generator

## Inputs Required

- Episode transcript (text file or pasted transcript)
- Episode title / number (e.g. "Death Has a Shadow" // "We Cranked Our Hogs Pretty Hard" | Episode #001)
- Any specific running bits mentioned in that episode's transcript (e.g. Stewie Gay Watch, Fall Watch, Patreon threat, specific callbacks)

## Fixed Real Facts (Never Change These)

- Hosts: Jason Hackett, Tyler Simpson, Collin Brown
- Production, Editing, Theme Music: Jason Hackett
- Show: Family Guy Guys (rewatch/recap podcast covering all 461 Family Guy episodes in order)

## TYPOGRAPHY RULE (HARD CONSTRAINT — READ FIRST)

The font used to render this credit scroll displays numeral digits as unreadable gibberish. Therefore: NEVER use numeric digits anywhere in the scroll body. Spell out every numerical value using letters.

- "453 Episodes Remaining" becomes "Four Hundred Fifty-Three Episodes Remaining"
- "9.5" becomes "Nine Point Five"
- "$0.00" becomes "Zero Dollars and Zero Cents" (or keep the running gag readable, e.g. "Zero Point Zero Zero Dollars")
- "4.25 out of 100" becomes "Four Point Two Five out of One Hundred"
- Years, ages, times, counts, percentages — all spelled out, no exceptions in the body

The ONLY place digits may appear is the header line "Episode [#]" if the operator's template requires it there; when in doubt, spell it out there too ("Episode Number Eight"). Apply this rule to every tier, every disclaimer, and the countdown. A single digit anywhere in the body is a failed generation.

## Structure & Escalation Pattern

The scroll has FOUR escalating tiers. Always follow this order, moving from mundane/real to unhinged:

### Tier 1 — Real Info (grounded, no jokes)

- Hosted by [three real names]
- Produced by Jason Hackett
- Edited by Jason Hackett
- Theme Music by Jason Hackett

### Tier 2 — Plausible But Fake (mundane job titles, believable but invented)

- Fake but boring-sounding production roles (Associate Producer, Research Consultant, Sound Effects Operator)
- Assign these to the real hosts doing exaggeratedly mundane versions of real tasks (e.g. "Associate Producer's Tasks This Episode: Laughing, Mostly")
- Introduce 1-2 invented minor roles with plausible-sounding fake names (e.g. "Research Verified by: Tyler Simpson's Gut")
- Pull references from the actual episode's content/bits if available (recurring segments, drink brands mentioned, specific in-episode confessions)

### Tier 3 — Bit-Based Escalation (tied to specific episode content)

- Reference recurring show bits by name, using this episode's transcript to fill in the specific status/punchline (e.g. "Stewie Gay Watch Oversight Board", "Gay Watch Data Entry", with invented fake official-sounding names/titles: "Dr. Raymond Pubes, PhD")
- Create a fake "oversight body," "legal team," or "committee" for whatever bit is central to this episode
- Pull a direct joke, phrase, or moment from the transcript and turn it into a fake "role" or "department" (e.g. if someone made a comment about being sensitive, make a fake HR/therapy-related credit)

### Tier 4 — Full Absurdity (no grounding required)

- Escalate into: nonexistent legal disclaimers, fake financial figures (Patreon revenue: $0.00 — spelled out per the typography rule), fake executive titles addressing something emotionally real from the episode (divorce, therapy, family concerns)
- End with:
  - A "no [X] were harmed" disclaimer referencing something from the episode
  - A fourth-wall-breaking disclaimer about the show's legitimacy or relationship to Seth MacFarlane / Fox
  - The running episode countdown: "[X] Episodes Remaining" (spelled out per the typography rule)
  - A closing tagline in the voice of the show (self-deprecating, mock-official)

## Style Rules

- Formal credit-scroll language throughout, even as content gets absurd (the mismatch between formal tone and insane content IS the joke — never break into casual voice)
- Bold or capitalize role titles for a "typeset" credit feel
- Keep line pairs short: [Role] / [Name or Answer] — no long sentences within the scroll itself
- Use invented, era-appropriate-sounding fake names for new "employees" (e.g. law firm names, made-up PhDs, fake committees) — avoid reusing names across episodes unless intentionally building a running gag
- Always close with the episode countdown (461 total episodes, decrementing per episode, value spelled out in letters) and a one-line tagline

## What To Pull From Each New Transcript

When generating a new scroll, scan the transcript for:

1. Any new recurring bit introduced or referenced (add a fake "department" for it)
2. A specific line, confession, or joke unique to this episode (turn it into a fake credit)
3. Any emotional or personal admission (turn it into a fake "executive" or "wellness" credit, deadpan)
4. Running countdown math (461 minus episodes completed so far, spelled out in letters)

## Output Format Template

```markdown
FAMILY GUY GUYS
Episode [#]: "[Episode Title]"

---

Hosted by
Jason Hackett, Tyler Simpson, Collin Brown

Produced by
Jason Hackett

Edited by
Jason Hackett

Theme Music by
Jason Hackett

---

[TIER 2 — 3-5 fake but plausible credits]

---

[TIER 3 — 3-5 escalating bit-based credits tied to this episode's transcript]

---

[TIER 4 — 4-6 fully absurd credits, financial jokes, legal disclaimers]

---

No [episode-specific reference] Were Harmed During Production

This Podcast Is Not Affiliated With Seth MacFarlane
(He Doesn't Know We're Doing This)
(Please Don't Tell Him)

---

[Spelled-Out Number] Episodes Remaining

[Closing tagline in show voice]
```

## Usage Instructions (for future conversations)

To generate a new scroll:

1. Attach or paste the new episode's transcript
2. Provide the episode title/number in the established format
3. Request: "Generate a fake credit scroll for this episode using the Fake Credit Scroll Generator skill"
4. Review Tier 3 references for accuracy against the transcript before publishing
5. Confirm no digits appear anywhere in the scroll body before publishing

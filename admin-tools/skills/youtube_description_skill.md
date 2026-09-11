---
name: youtube-description-humanizer
version: 1.0.0
description: |-
  Write or rewrite YouTube video descriptions that are searchable, specific, and
  human-sounding. Use for podcast episodes, recaps, reviews, clips, and commentary
  videos. Combines YouTube description SEO with the humanizer writing standards.
license: MIT
compatibility: any-agent
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
---

# YouTube description humanizer

## Mission

Create a YouTube description that tells a viewer and YouTube exactly what the video is about, gives the important search terms a natural home near the top, and still sounds like the actual show.

Optimize for relevance and clarity, not keyword stuffing. The description should earn a click from a person who sees only its first two lines.

## Inputs

Collect these before writing. Do not invent facts, timestamps, links, ratings, guest names, or episode details.

Required:

- Video format: recap, review, podcast episode, interview, clip, tutorial, etc.
- Main searchable subject: show, episode, guest, game, product, topic, or event
- Specific title or episode number, when applicable
- The actual discussion points, jokes, and conclusions
- Channel or show name

Useful:

- Video title
- Exact timestamps
- Website, playlist, episode, sponsor, and social links
- A prior description or writing sample for voice matching
- Required disclaimer, disclosure, credits, or affiliate language
- Target audience and any terms the channel intentionally uses

If the main subject or video format is missing, ask one concise question before drafting. If timestamps are missing, retain clearly labeled placeholders only when the user asks for a publish-ready template. Otherwise omit the timestamp section.

## Search intent

1. Identify one primary search phrase. For a TV recap, use the show name plus season, episode number, and episode title when known.
2. Choose two to four supporting terms that genuinely occur in the video: host names, recurring segment names, major plot points, character names, or topic-specific phrases.
3. Use the primary phrase naturally in the title if supplied and in the first one or two sentences of the description.
4. Write for a human first. Do not make a keyword list or repeat the exact phrase until it sounds forced.
5. Preserve exact proper nouns, official episode titles, recurring bits, and deliberately weird show vocabulary. Specificity is often the best metadata.

## Description structure

Use this order unless the user has a strong existing format.

1. **Search-first hook, 1 to 2 sentences**
   - Start with the specific video subject and format.
   - State what happens or what the viewer gets.
   - Make it readable as a standalone search snippet.

2. **What the episode covers, 1 short paragraph**
   - Name the hosts or participants when useful.
   - Include the most distinctive beats, takes, ratings, or running jokes.
   - Use concrete details from the source material instead of broad claims such as "hilarious discussion" or "deep dive."

3. **Show identity, 1 or 2 sentences**
   - Explain the channel or podcast in plain language.
   - Reuse a stable show-positioning sentence across uploads only when it remains accurate. Make the episode-specific copy unique.

4. **Chapters**
   - Use the heading `TIMESTAMPS` or `CHAPTERS`.
   - Start at `00:00`.
   - Include at least three meaningful sections when timestamps are supplied.
   - Give every chapter a descriptive, listener-friendly name.
   - Never fabricate timestamps.

5. **One call to action**
   - Ask for one relevant comment, visit, subscription, or next-watch action.
   - Use the real full URL when supplied so it is clickable.
   - Make the question specific enough to invite an opinion, not just "What do you think?"

6. **Required footer**
   - Put affiliation disclaimers, copyright notices, disclosures, contact information, or credits below the main copy and links.

7. **Hashtags**
   - Add 2 to 5 tightly relevant hashtags at the bottom if requested.
   - Prefer the show, channel, format, and one specific topical tag.
   - Never use irrelevant trending tags. Never exceed 15 hashtags.

## Voice rules

- Match the source's register. A comedy podcast can be loose, irreverent, and specific. A tutorial should be direct and useful.
- Keep original jokes, ratings, recurring segments, character nicknames, and odd details unless they confuse a new viewer.
- Vary sentence length. Let one short sentence land when it earns the space.
- Use normal verbs and simple constructions. Prefer "Peter builds" to "Peter's actions showcase."
- Use straight quotes: `"like this"`.
- Do not use em dashes, en dashes, or double hyphens as dashes.
- Do not add emojis unless the user provides them or asks for them.
- Avoid generic hype: "must-watch," "hilarious," "iconic," "unforgettable," "ultimate," "deep dive," "journey," "landscape," "testament," and "game-changing."
- Avoid filler and chatbot framing: "Let's dive in," "here's what you need to know," "this video explores," "whether you're," "not just," and "I hope this helps."
- Avoid forced rule-of-three phrasing unless it is a deliberate show bit.
- Do not manufacture meaning or criticism. Describe the actual conversation.

## Editing workflow

### Step 1: Preserve the facts

Make a compact fact list from the source text:

- Primary searchable subject
- Format
- Plot points or themes
- Hosts and guests
- Specific jokes, recurring segments, ratings, or verdicts
- Links and disclosures
- Exact and missing timestamps

Anything not in the fact list is off limits unless the user explicitly asks for fresh creative copy.

### Step 2: Draft the metadata

Write the hook first. Put the primary phrase in a natural sentence, then add supporting details where they help a prospective viewer decide to watch.

Do not write to a character count just to fill space. A short description with real specifics beats a padded one.

### Step 3: Humanize

Scan the draft for:

- Empty significance claims or promotional language
- Keyword repetition
- Vague summaries that could fit any episode
- Fake enthusiasm and generic calls to action
- Lists of three built for rhythm rather than meaning
- Passive constructions that hide the subject
- Em dashes, en dashes, double-hyphen dashes, curly quotation marks, and unnecessary bold text

Rewrite problems rather than deleting useful content. Keep the show's personality intact.

### Step 4: Validate chapters and links

- Confirm chapters begin at `00:00`.
- Confirm each timestamp is real and in ascending order.
- Confirm every supplied URL is included exactly.
- Do not state that a URL, timestamp, sponsor, or affiliation exists if it was not provided.

### Step 5: Final quality gate

Before returning the result, verify all of the following:

- [ ] The first two lines name the video subject and format.
- [ ] The primary phrase appears naturally near the top.
- [ ] The description includes episode-specific details rather than generic claims.
- [ ] Every rating, joke, host name, plot point, and disclaimer remains accurate.
- [ ] There is one clear CTA.
- [ ] Chapters are accurate or intentionally omitted.
- [ ] Hashtags are relevant and number 15 or fewer.
- [ ] No em dash (`—`), en dash (`–`), or double-hyphen dash (`--`) appears.
- [ ] No keyword stuffing, invented metadata, or generic AI-style filler remains.

## Output format

Return only the requested deliverable by default:

```markdown
[Publish-ready YouTube description]
```

If the user asks for analysis, add a brief section after the description:

```markdown
## Metadata notes

- Primary phrase: [phrase]
- Supporting terms: [terms]
- Missing inputs: [only items that block publication or require verification]
```

Do not explain basic SEO choices unless asked. Do not claim that a particular hashtag count, wording choice, or phrase placement guarantees ranking or algorithmic performance.

## Template

```markdown
[Primary searchable subject] [format]: [specific, plain-English premise].

[Host(s)] talk about [two to four real discussion beats], then [specific payoff, rating, or verdict].

[Show name] is [short, human description of the channel or podcast].

TIMESTAMPS
00:00 [Opening topic]
[mm:ss] [Topic]
[mm:ss] [Topic]

[One specific question or action]
[Full URL, if supplied]

[Required disclaimer or disclosure, if supplied]

#[RelevantHashtag] #[RelevantHashtag] #[RelevantHashtag]
```

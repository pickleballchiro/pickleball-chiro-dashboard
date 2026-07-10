---
name: lane-carousel
description: Generate complete Instagram Carousel slide copy for @dr.lane_o (Pickleball Chiro — 4.9 DUPR performance coach). Produces 5-slide carousel in one of two modes: Mode 1 (Engagement — Mistake Mirror, Belief Violation, Rating Roadblock, loop-opening arc) or Mode 2 (Teaching/Value — Technique Breakdown, Drill Breakdown, real instruction that earns saves). CONTENT PRIORITY: 70% skill/technique/coaching, 20% performance/movement, 10% max pain/longevity. Defaults to technique/coaching topics with SAVE/SHARE/FOLLOW CTA. NEVER use READY. Optionally generates actual carousel images by writing or updating generate_carousel.py. Use this skill whenever Lane asks to "make a carousel", "create carousel slides", "build a carousel about X", "write carousel copy", or batch carousels. Always trigger before generating any carousel content.
---

# Lane Carousel Skill

## Purpose

Generate Instagram Carousel copy for @dr.lane_o in one of two modes:

**MODE 1 — ENGAGEMENT (loop-opening):** Uses the four-beat emotional arc (Recognition → Validation → The Gap → Decision). Dave feels understood and curious. Never completes the explanation. CTA: SAVE, SHARE, or FOLLOW.

**MODE 2 — TEACHING/VALUE (coaching demonstration):** Gives real technique, drill steps, or performance insight. Dave walks away with something genuinely useful — and trusts Lane enough to book. CTA: SAVE (they'll want to reference this), SHARE (useful enough to send), or FOLLOW. Mode 2 carousels earn saves because they're actually useful, not just curiosity-driven.

Both modes:
3. Default to **skill/technique/coaching topics** (70% of all carousels)
4. Use SAVE, SHARE, or FOLLOW as CTAs — NEVER use READY
5. Can optionally produce actual slide images via `generate_carousel.py`

---

## STEP 1: Clarify the Brief

Before writing, confirm (or infer if context is clear):
- **Topic** — default to skill/technique/coaching unless Lane specifies otherwise
- **Content Mode** — Mode 1 (engagement, loop-opening) or Mode 2 (teaching, genuine value). If unclear: default to Mode 1 for plateau/identity topics, Mode 2 for specific technique/drill topics.
- **Carousel Type** — see type library below
- **CTA keyword** — default: SAVE, SHARE, or FOLLOW for all coaching topics; FREE or KNEE for pain rotation only (backend). NEVER use READY.

**Content priority:**
- Technique/coaching topics (Mode 1 or 2) → SAVE, SHARE, or FOLLOW CTA
- Pain rotation (max 1x/week, backend) → FREE or KNEE CTA
- NEVER default to READY — Lane does not use it

---

## STEP 2: Choose the Carousel Type

Pick one type per carousel. This determines the emotional arc of the slides.

### For Skill/Technique Topics (70% — DEFAULT)

| Type | Hook Direction | Best For |
|---|---|---|
| **MISTAKE MIRROR** | Names the exact shot failure Dave keeps making | Reset, third shot drop, dinking errors, kitchen movement |
| **BELIEF VIOLATION** | Busts a coaching myth Dave believes | "Just drill more", "it's a grip issue", "more practice time" |
| **RATING ROADBLOCK** | Validates why the plateau isn't Dave's fault | Stuck at 3.5/4.0, group clinics not working, YouTube not sticking |
| **IDENTITY HOOK** | Speaks to his player identity being threatened | Partner leveled up, getting beaten by players he used to beat |
| **MECHANISM TEASE** | Hints at a fixable cause — never names the fix | Any technique issue with a non-obvious root cause |

### For Mode 2 — Teaching/Value (Technique/Coaching Topics)

| Type | Hook Direction | Best For |
|---|---|---|
| **TECHNIQUE BREAKDOWN** | Names a specific shot issue → teaches the actual mechanic step-by-step | Reset, third shot, dinking, footwork — when the topic is specific enough to teach |
| **DRILL BREAKDOWN** | Presents an actual drill sequence Dave can take to the court | Any technique topic where a repeatable drill exists |
| **PERFORMANCE INSIGHT** | Explains the body mechanics behind a common player issue | Footwork, split step, court coverage, movement efficiency |
| **COACHING OBSERVATION** | "Here's what I see in every lesson this week on [specific shot]" | Social proof + teaching hybrid — positions Lane as the coach who notices what others miss |

Mode 2 slide arc: Hook (state the topic) → The Pattern (name the problem precisely) → The Actual Fix (real mechanic or drill) → The Gap (knowing it vs. executing under pressure) → CTA (SAVE / SHARE / FOLLOW)

### For Pain/Longevity Topics (10% max — backend only)

| Type | Hook Direction | Best For |
|---|---|---|
| **PAIN MIRROR** | Reflects Dave's exact pain experience back at him | Knee, elbow, shoulder — if Lane requests or it's pain rotation week |
| **FAILED INTERVENTION** | Validates why rest/PT/ice didn't work | Any recurring pain pattern |

---

## STEP 3: Write the 5 Slides

### Slide Structure (5 slides, each with a job):

```
SLIDE 1 — HOOK COVER
Job: Stop the scroll. Make Dave say "that's exactly me" before swiping.
Elements:
  - Pill label (2-4 words, orange text on dark pill): e.g. "SWIPE »" or "SOUND FAMILIAR?"
  - Headline (1-3 lines, Playfair Display): The hook. Max 8 words per line.
    - For MISTAKE MIRROR: Name the exact failure ("Your reset keeps popping up.")
    - For BELIEF VIOLATION: State the counterintuitive claim ("It's not your technique.")
    - For RATING ROADBLOCK: Name the plateau frustration ("Stuck at 3.5 for a year.")
  - Faded subtext (optional, 1 line): What the headline implies without answering

SLIDE 2 — RECOGNITION (The Mirror)
Job: Make Dave feel seen. Name his specific experience with precision.
Pill label: "SOUND FAMILIAR?" or "THIS IS YOU."
Headline: The pattern he keeps living
Body: Bullet list of 3-4 specific experiences Dave has had
  - Each bullet names a specific failure or frustration — NOT generic
  - For technique: specific situations where the shot breaks down
  - For plateau: specific moments where the gap showed up

SLIDE 3 — VALIDATION (Why Past Attempts Failed)
Job: Remove the self-blame. Name why what he tried didn't work — not his fault.
Pill label: "HERE'S WHAT NOBODY TOLD YOU." or "THE REAL REASON."
Headline: The reason his attempts failed
Body: 2-3 sentences — why drilling/YouTube/clinics don't fix this specific thing.
  - Validate specifically: what he tried + why it helps in isolation + why it doesn't transfer
  - NEVER name the actual fix here — name only why the common attempts fall short

SLIDE 4 — THE GAP (The Mechanism Tease)
Job: Open the curiosity gap. Name that a specific fixable cause exists — NEVER what it is.
Pill label: "HERE'S WHAT NOBODY CHECKED." or "THE ACTUAL PROBLEM."
Headline: Name the category of the real cause (never the cause itself)
Body: 2-3 sentences pointing at the real root — described enough to be specific, not enough to explain it.
  - "The reason it breaks down under pressure has nothing to do with your swing."
  - "What actually drives this is something you'd only catch by watching the body, not the paddle."
  - NEVER write a mechanism that Dave can act on without working with Lane

SLIDE 5 — DECISION (CTA)
Job: Make SAVING, SHARING, or FOLLOWING feel like the obvious smart player move.
Pill label: "THIS CAN BE YOU." or "NEXT STEP."
Headline: What's possible on the other side (the transformation)
Body:
  - "SAVE this and drill it before your next session." (Mode 2 — reference value)
  - OR "SHARE this with someone who keeps losing points in the transition zone." (Mode 1 — spread)
  - OR "FOLLOW for more content on breaking through your plateau." (audience growth)
  - OR "Comment FREE and I'll send you the guide." (pain rotation backend)
  - OR "Comment KNEE and I'll send you the course." (pain rotation backend)
  - Keyword in ALL CAPS, mid-body — not at the very end
  - NEVER use READY as the CTA keyword
Footer: "PICKLEBALL CHIRO · @DR.LANE_O"
```

---

## STEP 4: Non-Negotiables

**What NEVER goes in Mode 1 slides:**
- The actual fix, drill, exercise, or mechanism
- Named anatomy (medial compartment, patellofemoral, etc.)
- Sets/reps or protocol instructions
- "Here's what to do" language

**Mode 2 carousels CAN include:**
- The actual technique or mechanic being taught
- Specific drill steps Dave can take to the court
- Body positioning cues and movement instructions
- What Mode 2 still withholds: executing this under match pressure — that's the session.

**What ALWAYS goes in every carousel:**
- Slide 1 hook must make Dave say "that's exactly me" — not "that's interesting"
- The CTA keyword is in ALL CAPS
- Slide 5 ends with a save/share nudge in faded text
- Each slide has one job and one idea

**Voice across all slides:**
- Direct, peer-to-peer — Lane the 5.0 player speaking to Dave the 3.5 player
- Not clinical. Not a lecture. Not an ad.
- The gap is always real and specific — never vague or generic

---

## STEP 5: Caption for the Carousel Post

### CAPTION DEPTH RULE:
Carousel captions → SHORTER. The slides already did the heavy lifting. The caption is a broad overview summary — enough to hook someone who hasn't swiped yet, but not a repeat of what's inside. Keep it tight.

```
[Line 1: Mirror the Slide 1 hook — max 125 chars. Must work standalone before "More."]

[2–3 short lines: Broad summary of what the carousel covers. One beat per line. No detail.]

[CTA line: SAVE, SHARE, or FOLLOW in ALL CAPS — pick whichever fits the post goal.]

[Single engagement question about Dave's experience]
```

**CONFIRMED CTA TEMPLATES (use these — flex the bracketed parts to fit the content):**

Save/Share line:
- "SAVE and SHARE this with your partner."
- "SAVE and SHARE this with someone who needs to hear it."
- "SAVE and SHARE this with someone who [specific problem — e.g. keeps popping their resets]."

Follow line:
- "FOLLOW for more content and tips to break past 4.0."
- "FOLLOW for content and tips to get you from 3.5 to 4.0."
- "FOLLOW @dr.lane_o for more content and tips for serious players who are done plateauing."

Both CTAs often appear together at the end, save/share first then follow. Only the action keyword (SAVE, SHARE, FOLLOW) is in ALL CAPS — the rest of the line is normal case.

**CONFIRMED CAPTION FORMAT (non-negotiable):**
- No more than two sentences per line
- Every line separated by a blank line for readability
- No bullet points, no asterisks, no bold markdown formatting
- Only the CTA action keywords (SAVE, SHARE, FOLLOW) in ALL CAPS — not the whole line
- Output captions inside a code block so Lane can copy/paste directly
- No extra commentary inside the code block — caption only

---

## STEP 6: Optional — Generate the Actual Carousel Images

If Lane asks to generate the images (not just the copy), use `generate_carousel.py` in the project root.

The script generates 6 slides (1080×1350px) using the brand design system:
- Background: `#2B2B2B`
- Orange accent: `#F05A28`
- Cream text: `#F5EFE6`
- Fonts: Playfair Display Black (headlines) + Lora Medium (body)
- Output: `carousel_output/slide_01.png` through `slide_06.png`

**To generate images with new content:**
1. Read the current `generate_carousel.py`
2. Rewrite the `make_slide1()` through `make_slide6()` functions with the new copy
3. Run: `python3 generate_carousel.py`
4. Images save to `carousel_output/`

**Important:** Keep the design system constants (colors, fonts, padding) unchanged. Only rewrite the slide content functions.

---

## Quick Reference: Carousel Types by Topic

| Topic | Mode | Carousel Type | CTA |
|---|---|---|---|
| Reset volley popping up | 1 or 2 | MISTAKE MIRROR (1) or TECHNIQUE BREAKDOWN (2) | SAVE / SHARE / FOLLOW |
| Third shot inconsistency | 1 or 2 | MISTAKE MIRROR or MECHANISM TEASE (1) or TECHNIQUE BREAKDOWN (2) | SAVE / SHARE / FOLLOW |
| Stuck at 3.5/4.0 | 1 | RATING ROADBLOCK | FOLLOW / SHARE |
| Group clinics not working | 1 | BELIEF VIOLATION | FOLLOW / SHARE |
| Dinking errors under pressure | 1 or 2 | MISTAKE MIRROR (1) or TECHNIQUE BREAKDOWN (2) | SAVE / SHARE / FOLLOW |
| Kitchen movement/footwork | 1 or 2 | MECHANISM TEASE (1) or PERFORMANCE INSIGHT (2) | SAVE / SHARE / FOLLOW |
| Split step / court coverage | 2 | PERFORMANCE INSIGHT or DRILL BREAKDOWN | SAVE / SHARE |
| Coaching observation from a lesson | 2 | COACHING OBSERVATION | SAVE / FOLLOW |
| Knee pain (pain rotation only, backend) | 1 | PAIN MIRROR or FAILED INTERVENTION | FREE or KNEE |
| Elbow/shoulder (pain rotation only, backend) | 1 | FAILED INTERVENTION | FREE or KNEE |

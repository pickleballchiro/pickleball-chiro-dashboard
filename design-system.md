# Design System — @dr.lane_o Carousel Visual Specs

## Aesthetic Direction

**Coffee shop vibes.** Warm, editorial, unhurried. Feels like something you'd see pinned on the wall of a well-designed café — credible, premium, not clinical. The opposite of loud sports medicine. The fonts are warm and literary (Playfair Display serif for headlines), the palette is cream and espresso, the orange accent is the one thing that says "athletic." The overall feel: a serious player who also has taste.

This is intentionally different from the big bold flat-color Instagram sports content most players are used to seeing. That's the point.

---

## Canvas Specs

| Property | Value |
|---|---|
| **Dimensions** | 1080 × 1350px portrait (4:5 ratio) |
| **Display at** | 500 × 625px (for chat rendering) |
| **Slides per carousel** | 5 (brand spec — never exceed) |
| **Aspect ratio** | Consistent across all 5 slides (never mix) |
| **File format for posting** | PNG preferred (text stays crisp) |

---

## Brand Colors — Coffee Shop Palette

| Color | Hex | Role |
|---|---|---|
| **Dark Background** | #2B2B2B | All slides — consistent dark background |
| **Espresso** | #2C1F14 | Dark background variant — warm brown-black, NOT flat black |
| **Court Orange** | #F05A28 | Accent — italic headline words, CTA keyword, rule bars, orange tag pills |
| **Warm Cream** | #F5EFE6 | Primary text on dark backgrounds |
| **Muted Sand** | #C4B5A5 | Tertiary text, slide numbers, subtle labels on dark slides |

**Application rules:**
- Orange is accent only. Use on 1–2 italic headline words + CTA keyword + the rule bar + orange tag pills
- All slides use dark background (#2B2B2B) — no light slides
- Warm Cream (#F5EFE6) for body text — never pure white (too stark)
- The orange rule bar sits above the headline on dark slides — it's the visual anchor

---

## Typography

| Font | Weight | Role | When |
|---|---|---|---|
| **Playfair Display** | 700 / 900 | Primary headline | All main slide statements — the coffee shop feel lives here |
| **DM Sans** | 400 / 500 | Everything else | Tags, body text, slide numbers, "Swipe →", CTA description |

**Font sizing guidelines — Pillow canvas sizes (1080×1350px):**
- Cover headline: 118–128px Playfair Display 900
- Body slide headlines: 88–100px Playfair Display 700
- Body/supporting text: 52–58px DM Sans 400
- Tag/label pills: 22px DM Sans 500, uppercase
- Slide numbers: 26px DM Sans 400
- "Swipe →": 26px DM Sans 400
- CTA keyword (FREE / KNEE): 220–240px Playfair Display 900
- CTA micro-label ("COMMENT BELOW"): 24px DM Sans 500
- CTA instruction lines: 38–42px DM Sans 400
- CTA "Save this / Send it" line: 44–48px DM Sans 400 — never below 44px (hard floor)

**Key typographic moves:**
- Orange words in headlines always in `font-style: italic` — the italic + orange combo is the signature
- Headline line breaks are intentional — break for rhythm, not just space
- DM Sans at weight 400 for body text gives editorial feel without being too heavy

---

## Layout System

> **⚠️ ALL sizes in this section are Pillow canvas sizes (1080×1350px). The widget preview renders at ~half scale. Never use widget-visible sizes in Python code.**

### Slide 1 — Cover (Dark background)

```
Background: #2B2B2B
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Top bar: @dr.lane_o tag (pill, left) + "Swipe →" (right, sand color, 26px DM Sans 400)
[48px top padding]

[Orange rule bar — 88px wide, 6px tall — sits above headline]
[Main Hook — Playfair Display 900, 118–128px]
[Warm Cream for most words]
[Final key word/phrase: italic + Court Orange]

[Generous whitespace]

[Supporting line — DM Sans 400, 52–58px, Muted Sand]
[1 short sentence — names the tension, never resolves it]

Bottom bar: "Pickleball Chiro" label (left, sand) + "1 / 5" (right, sand, 26px DM Sans 400)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Slides 2 & 4 — Dark Body Slides

```
Background: #2B2B2B
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[48px top padding]

[Reader-facing tag pill — DM Sans 500, 22px, uppercase]
  → Use a QUESTION or EMPATHY PHRASE — never an internal label
  → See tag guidance below for how to choose
  → Pill styling: background: rgba(240,90,40,0.15); border: 1px solid rgba(240,90,40,0.35); color: #F05A28

[Main Statement — Playfair Display 700, 88–100px]
[Warm Cream + orange italic on 1 key phrase]

[Divider line — minimum 3px tall]

[Supporting body text — DM Sans 400, 52–58px, Muted Sand]
[1–2 short lines — adds context without explaining the mechanism]

[Slide number — bottom right, 26px DM Sans 400, Muted Sand]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Slide 3 — Dark Body Slide (with wider rule bar)

```
Background: #2B2B2B
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[48px top padding]

[Orange rule bar — 120px wide, 6px tall — visual anchor, no tag pill needed]

[Main Statement — Playfair Display 700, 88–100px]
[Warm Cream for most words]
[Orange italic for key phrase]

[Divider line — minimum 3px tall]

[Supporting body text — DM Sans 400, 52–58px, Muted Sand #C4B5A5]

[Slide number — bottom right, 26px DM Sans 400, very low opacity Muted Sand]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Slide 5 — CTA (Dark, centered)

```
Background: #2B2B2B
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Centered layout, all elements center-aligned]

[Micro-label — DM Sans 500, 24px, uppercase, letter-spacing 3px, Muted Sand]
["COMMENT BELOW"]

[CTA Keyword — Playfair Display 900, 220–240px, Court Orange]
[e.g., "KNEE" or "FREE"]

[Orange rule bar — 88px wide, 6px tall — centered, below keyword]

[Instruction lines — DM Sans 400, 38–42px, Warm Cream #F5EFE6]
["and I'll send you [specific framing]"]

[Spacer]

[Save/share line — DM Sans 400, 44–48px, Muted Sand — HARD FLOOR: never below 44px]
["Save this · Send it to someone who needs it"]

[Slide number — bottom right, 26px DM Sans 400, very low opacity]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Tag Pill Guidance — Reader-Facing Labels Only

The small pill/tag that appears at the top of slides (Slides 2 and 4) should always mean something to Dave. Never use internal copy labels like "Recognition" or "The Gap."

**All slides are dark (#2B2B2B). Pill styling is always:**
- `background: rgba(240,90,40,0.15); border: 1px solid rgba(240,90,40,0.35); color: #F05A28`
- No warm sand pills. No white background pills.

**Choose based on what the slide is doing:**

| Slide is doing... | Use a question | Use an empathy phrase |
|---|---|---|
| Naming Dave's exact experience | "Sound familiar?" | "You know this feeling." |
| Validating a failed attempt | "Been there?" | "You did everything right." |
| Naming a gap/the real cause | "What if it's not the knee?" | "Here's what nobody checked." |
| Pointing toward the solution | "What changes everything?" | "There's a reason for this." |
| Identity / who Dave is | "Still playing through it?" | "This one's for you." |

**Rule:** If the slide content is pure recognition/mirroring → lean toward empathy phrase. If the slide is introducing something new or surprising → lean toward a question. When in doubt, the question tends to hit harder.

---

## Rendering the Slides in Chat

Use `show_widget` to render all 5 slides as stacked HTML. Load fonts via Google Fonts import.

```html
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500&display=swap');
```

Each slide: `width: 500px; height: 625px; position: relative; overflow: hidden; border-radius: 6px;`

Stack slides vertically with `gap: 14px`. No drop shadows. Flat presentation.

**Orange italic accent technique:**
```html
<em style="color: #F05A28; font-style: italic;">your knee.</em>
```

**Orange rule bar:**
```html
<div style="width: 44px; height: 3px; background: #F05A28; margin: 0 0 24px;"></div>
```

**Thin divider line:**
```html
<div style="width: 100%; height: 1.5px; background: rgba(245,239,230,0.2); margin: 24px 0;"></div>
```

---

## Brand Do / Don't Quick Reference

| ✅ DO | ❌ DON'T |
|---|---|
| Italic + orange on 1–2 key words | Make entire headlines orange |
| Playfair Display for all headlines | Use Oswald — that's the old system |
| DM Sans 400 for body text | Use heavy body text — it kills the editorial feel |
| Dark background (#2B2B2B) on all slides | Mix in light slides |
| Warm Cream (#F5EFE6) for body text on dark slides | Use pure white — too cold |
| Orange rgba pill styling on all tag pills | Use warm sand or white background pills |
| Reader-facing question or empathy phrase in tag pill | Use internal labels like "Recognition" or "The Gap" |
| One idea per slide | Pack multiple points into one slide |
| Generous whitespace throughout | Fill every inch of the slide |
| Slide 5 always dark with orange keyword | Use a light CTA slide |
| Pillow canvas sizes in Python code | Use widget-visible (half-scale) sizes in Python |

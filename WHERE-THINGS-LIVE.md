# Where Things Live — Pickleball Chiro
*Reorganized July 10, 2026. Maintain this by hand: when you add a file, put it in the numbered folder it belongs to and it stays findable.*

## This folder (`Documents/Chiropractic/Pickleball Chiro/`)

| Folder | What goes here |
|---|---|
| **01 Business** | Legal & money paperwork: insurance policy, license, PCMA addendum, L1 certificate, coaching system doc |
| **02 Content** | Everything content production: strategy (`Content & Social Media/LANE_MASTER_CONTENT_STRATEGY_V1.md`), `generate_carousel.py`, photos, bio-link images, `carousel_output/` (generated slides land here) |
| **03 Website** | The live site **git repo** (`pickleballchiro-site` → pickleballchiro.co + /dashboard), the old quiz repo (`pickleball-quiz` — now just serves a redirect), and Google-review screenshots used on the site |
| **04 Products & Offers** | Knee Pain Course files, lead-magnet PDFs (`Guides/`) |
| **05 Skills & Automation** | Current skill file copies (sheets-updater, carousel, reels, viral-hook, llm-council) and `apps-script/` (the Google Sheets webhook code) |
| **06 Reference** | Mentorship notes and other learning material |
| **Clinical Templates** | ⚕️ Patient/clinical forms — deliberately left untouched and outside the numbered system |
| **_Archive 2026-07** | Everything stale or duplicated, moved (never deleted) during the reorg. See `MANIFEST.md` inside for what each item is. Safe to delete after you review it — **except rotate the instagram-audit Google credential first (see below)** |
| `skills-lock.json`, `.claude/`, `.git/` | Plumbing — leave alone. This folder is itself a git repo (`pickleball-chiro-dashboard` on GitHub) that versions the skill + apps-script files |

## Related folders elsewhere

| Location | What it is |
|---|---|
| `Documents/Chiropractic/Insight Chiropractic/` | Your independent-contractor work for Insight — kept **completely separate** from Pickleball Chiro (your call, Jul 10) |
| `Documents/Claude/Scheduled/` | daily-briefing & weekly-review scheduled skills |
| `Documents/Claude Skills/` | Downloaded third-party Claude skills |

## Cloud sources of truth (not on this Mac)

| Thing | Where |
|---|---|
| All business numbers | Google Sheet **"PickleballChiro HQ 2026"** (Income, Expenses, Mileage, Leads, Clients, Sessions, Dashboard, Summary) — old sheets are renamed "OLD" in Drive |
| Live dashboard | pickleballchiro.co/dashboard (key in Drive doc "Pickleball Chiro dashboard access key") |
| Offer pages | Notion: Pickleball Lessons / Mobile Chiro / 90-Days to 4.0 |
| Content skills (the real ones Claude uses) | Claude Project skills — the files in `05 Skills & Automation` are reference copies |

## ⚠️ Open flags from the reorg (not fixed, just found)

1. **Rotate the Google credential**: `_Archive 2026-07/instagram-audit/google-credentials.json` is a plaintext service-account key. Deactivate/rotate it in Google Cloud Console, then the archive folder is fully safe to delete.
2. **Your rating is 4.8 now** — these still say 4.9 and need updating when you next touch them: `05 Skills & Automation/lane-carousel-SKILL.md`, `02 Content/Content & Social Media/LANE_MASTER_CONTENT_STRATEGY_V1.md`, the Claude Project skills, and one Notion page says "5.0 competitive level".
3. **Old lesson-inquiry Google Form** (May 24) may still accept responses into its own sheet, outside HQ 2026.
4. `Documents/Daily Sales blueprint Travis Stephenson.md` — loose mentorship note at Documents root; file into `06 Reference` if you want it kept.

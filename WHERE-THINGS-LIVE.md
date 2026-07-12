# Where Things Live — Pickleball Chiro
*Reorganized July 10, 2026. Maintain this by hand: when you add a file, put it in the numbered folder it belongs to and it stays findable.*

## This folder (`Documents/Chiropractic/Pickleball Chiro/`)

| Folder | What goes here |
|---|---|
| **01 Business** | Legal & money paperwork: insurance policy, license, PCMA addendum, L1 certificate, coaching system doc |
| **02 Content** | Everything content production: strategy (`Content & Social Media/LANE_MASTER_CONTENT_STRATEGY_V1.md`), `generate_carousel.py`, photos, bio-link images, `carousel_output/` (generated slides land here) |
| **03 Website** | The live site **git repo** (`pickleballchiro-site` → pickleballchiro.co + /dashboard), the old quiz repo (`pickleball-quiz` — now just serves a redirect), and Google-review screenshots used on the site |
| **04 Products & Offers** | Knee Pain Course files, lead-magnet PDFs (`Guides/`) |
| **05 Skills & Automation** | Current skill file copies (sheets-updater, carousel, reels, viral-hook, llm-council), `apps-script/` (the Google Sheets webhook code), the daily content pipeline JSON, and `ceo-report/` (the `sunday_ceo_report.py` generator + its Google creds — gitignored) |
| **06 Reference** | Mentorship notes and other learning material (incl. `transcript with coby.txt`, BANGER Carousels, Daily Sales blueprint) |
| **Mobile Chiro** | ⚕️ All clinical material in one place (added Jul 12): `Templates/` (the `TPD_*` intake/exam/SOAP forms + mobile-chiro note templates, older versions in `Templates/Archive/`), `Patient Notes/`, `Reference/`. Absorbed the old `Clinical Templates/` folder. |
| **_Archive 2026-07** | Everything stale or duplicated, moved (never deleted) during the reorg. See `MANIFEST.md` inside for what each item is. Safe to delete after you review it — **except rotate the instagram-audit Google credential first (see below)** |
| `skills-lock.json`, `.claude/`, `.git/` | Plumbing — leave alone. This folder is itself a git repo (`pickleball-chiro-dashboard` on GitHub) that versions the skill + apps-script files |

## Related folders elsewhere

| Location | What it is |
|---|---|
| `Documents/Chiropractic/Insight Chiropractic/` | Your independent-contractor work for Insight — kept **completely separate** from Pickleball Chiro (your call, Jul 10) |
| `Documents/Chiropractic/FIC/` | Separate employment opportunity (employee NDA) — also kept apart (Jul 12) |
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

1. **Rotate the Google credentials** (two now): `_Archive 2026-07/instagram-audit/google-credentials.json` AND `05 Skills & Automation/ceo-report/google_credentials.json` (+ `token.json`) are plaintext keys. Both are gitignored so they won't commit, but rotate them in Google Cloud Console if there's any chance they were ever exposed.
2. **Your rating is 4.8 now** — these still say 4.9 and need updating when you next touch them: `05 Skills & Automation/lane-carousel-SKILL.md`, `02 Content/Content & Social Media/LANE_MASTER_CONTENT_STRATEGY_V1.md`, the Claude Project skills, and one Notion page says "5.0 competitive level".
3. **Old lesson-inquiry Google Form** (May 24) may still accept responses into its own sheet, outside HQ 2026.
4. ~~`Daily Sales blueprint Travis Stephenson.md` — loose at Documents root~~ ✅ Filed into `06 Reference/Mentorship Notes/` (Jul 12).
5. **Knee-course duplicates to reconcile** (Jul 12): `04 Products & Offers/Knee Pain Course/` now has both the repo originals and `pb_knee_course_MASTER (v2).docx` + `pickleball_knee_fix_course_reference (v2).md` — the incoming copies differed in content, so both were kept. Compare and delete whichever you don't want.
6. **`06 Reference/transcript with coby.txt`** — filed here as a business/mentorship transcript, but move it if "Coby" belongs elsewhere.

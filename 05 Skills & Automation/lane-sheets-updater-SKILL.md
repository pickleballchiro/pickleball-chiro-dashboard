---
name: lane-sheets-updater
description: >
  Automatically update Lane's Pickleball Chiro business spreadsheet from natural language —
  log mileage, income, expenses, leads, client sessions (package vs one-off vs group), and
  payments. Use this skill whenever Lane mentions driving to a client, a business expense or
  purchase, income or a payment received, a new lead or contact, or a coaching/chiro session.
  Trigger on casual phrases like "I drove 20 miles to see Laura", "I bought a massage gun for
  $89", "Doug paid me $195 today", "new lead — John found me on Instagram", or "I saw Ashley
  for a chiro session and a lesson." ALL business data lives in ONE spreadsheet, "PickleballChiro
  HQ 2026" (tabs: Income, Expenses, Mileage Log, Leads, Clients, Sessions, Dashboard, Summary);
  log every session with log_session (Chiro/Lesson × Package/One-off/Exam) and every payment
  with record_payment. Also trigger when Lane mentions a client's NEXT appointment ("she's
  booked for next Wednesday at 8:15") — schedule_session puts it on his real Google Calendar,
  synced with the dashboard. Always trigger before making any spreadsheet updates — do not
  attempt to update Google Sheets without consulting this skill first.
---

# Lane's Sheets Updater (v2 — consolidated HQ sheet)

## The ONE spreadsheet (since July 9, 2026)

Everything lives in **PickleballChiro HQ 2026** — ID `1L_5dcoOFqQhwDXJQn_-5f1Rilh6lQHuJLV1PsMw7n3E`
(https://docs.google.com/spreadsheets/d/1L_5dcoOFqQhwDXJQn_-5f1Rilh6lQHuJLV1PsMw7n3E/edit)

| Tab | What it holds |
|---|---|
| `💰 Income` | Every payment received (data starts row 4; running-total column G is formula-driven — NEVER write to it) |
| `🧾 Expenses` | Every business purchase (data starts row 4) |
| `Mileage Log` | One row per trip (data starts row 4; RT miles + deduction computed by webhook) |
| `Leads` | Pipeline (data starts row 3) |
| `Clients` | All-in-one client tracker (data starts row 3; col N "Left" and col U "Stage" are formulas — the webhook manages them) |
| `Dashboard` | Key Metrics — ALL LIVE FORMULAS now. Never write here. Revenue comes from the Income tab automatically. |
| `📊 Summary` | Tax summary + monthly breakdown — live formulas. Never write here. |

⚠️ The three OLD spreadsheets (Mileage_Log_2026, PickleballChiro_2026_Finance_Tracker,
PickleballChiro_Business_Tracker) are **archived backups**. NEVER write to them.
If any tool or doc references their IDs (`17e-O3...`, `1vOLOV...`, `1p-GyH...`), it is stale.

## Step 1 — Parse Lane's message

Extract every trackable event. One message can trigger multiple updates (e.g., "I drove
20 miles to see Laura and she paid me $195" = mileage entry + income entry).

**→ Income tab:** got paid, received money, Stripe/Venmo/Zelle/cash/card payment
**→ Expenses tab:** bought something, subscription, fee, any spend
**→ Mileage Log:** drove to a client/location, miles, trip
**→ Leads tab:** new person, someone interested, referral, DM
**→ Clients tab:** session with existing client, package usage, client info update

## Step 2 — Fill in missing fields

Use today's date if no date given. Infer what you can. Only ask Lane if something truly
cannot be inferred (e.g., a missing dollar amount).

### Income fields
Date · Client/Source · Income Type (`Mobile Chiro Visit` / `Pickleball Lessons` /
`Digital Products (Guides)` / `Package Sales` / `Tournament / Other`) · Description ·
Payment Method · Amount

**PACKAGE RULE:** when income_type is `Package Sales`, the description MUST say whether
it is a **lesson** package or a **chiro** package (e.g. "4-lesson pickleball package" or
"8-session chiro package"). The dashboard uses this to classify revenue streams.

### Expense fields
Date · Vendor · Category (`Equipment` / `Supplies & Balls` / `Software & Subscriptions` /
`Marketing` / `Education & Courses` / `Mileage & Travel` / `Professional Services` /
`Phone (Business %)` / `Other`) · Description · Payment Method · Amount
- One-time mixed-use purchases: log FULL price, note business % in description.
- Recurring subscriptions: log only the business-use portion.

### Mileage fields
Date · Client Name · Type (`Mobile Chiro` / `Pickleball Lesson` / `Other`) · From (default
"Home") · To (default "Client Address") · Miles One Way (ask if missing).
RT miles and deduction ($0.725/mi) are computed by the webhook — never send them.

### Lead fields
Date Added · Name · Phone · Email · Lead Source (`Pictona` / `Instagram` / `Earl Brown` /
`Referral` / `Direct DM` / `NSB (Pettis/Glencoe)` / `Cresswind` / `Other`) · Service
Interest (`Mobile Chiro` / `In-Clinic Chiro` / `Pickleball Lessons` /
`Mobile Chiro / In-Clinic Chiro` / `Mobile Chiro / Pickleball Lessons` / `Digital Product`) ·
Status (`New` / `Contacted` / `Nurturing` / `Booked` / `Converted` / `Lost` / `Not a Fit`;
default `New`) · Follow-Up · Notes

### Client update fields
Match by name. Update: Last Session, Sessions/Mo., Total Sessions, package Used/Left,
Total Paid (must include ALL payments), Outstanding, Notes.
When a client pays, ALSO log the income row — the Dashboard revenue KPI reads the Income
tab, but the per-client Total Paid still needs the client update.

**Package Type** (Clients tab, when setting one) — use exactly one of:
`Mobile Chiro Package` · `Lesson Package - Individual` · `Lesson Package - Group` ·
`Single Lesson` · `Mobile Chiro (ongoing)` · `In-Clinic Chiro` · `None`. This is what
distinguishes a chiro package from a lesson package — keep it accurate.

### Dropdown vocabulary (cleaned July 2026 — stay on-list)
All dropdown columns now reject-free-but-warn on off-list values. Use these exact strings so
nothing shows an "invalid" flag and the sheet stays consistent:
- **Payment Method** (income + expenses + clients): `Stripe` · `Venmo` · `Zelle` · `Cash` ·
  `Card` · `Personal Checking` · `N/A` · `Unknown`
- **Client Status**: `Active` · `Inactive`  (the Stage column auto-computes; don't set it)
- **Tax Deductible** (expenses): `Yes` · `No`
- Do NOT reintroduce merged duplicates: it's `Mobile Chiro` (not "Mobile Chiropractic"),
  `In-Clinic Chiro` (not "Clinic Chiropractic"), `Pickleball Lessons` (plural).

## Step 3 — Write via the webhook

### Webhook URL (permanent — never changes)
```
https://script.google.com/macros/s/AKfycbxLcsR_4HVnmf3GkJkSx2kOf2KErYONQvEHROXjMLuThcHjnCI6IulpcDOIDrE1-1AKJw/exec
```

### CRITICAL curl format
Always `--data`, never `-X POST -d` (Apps Script redirects lose the body with -X POST):
```bash
curl -s -L --data '{ ...payload... }' -H "Content-Type: application/json" "<WEBHOOK URL>"
```

### Add-new actions (payloads unchanged from v1)

- `log_income` — `{action, client_source, income_type, notes, payment_method, amount}`
- `log_expense` — `{action, vendor, category, description, payment_method, amount}`
- `log_mileage` — `{action, client_name, miles_one_way, type, from, to}`
- `add_lead` — `{action, name, phone, email, lead_source, service_interest, notes}`
- `update_lead` — `{action, name, status, follow_up, notes}`
- `add_client` — `{action, name, phone, email, package, sessions_included, sessions_used, sessions_left, total_paid, notes}`
- `update_client` — `{action, name, last_session, sessions_total, sessions_used, sessions_left, total_paid, notes}`

### SESSIONS — log every coaching/treatment session (NEW, preferred)

The `🗓 Sessions` tab is the source of truth for sessions. Log EVERY session with
`log_session`; the webhook appends the ledger row AND keeps the client's Clients-tab counts
in sync automatically (package Used/Left, Total Sessions, Last Session). Never hand-increment
session counts anymore.

```json
{ "action": "log_session", "name": "Laura Cadigan", "date": "07/15/2026",
  "discipline": "Chiro", "billing": "Package", "notes": "Package session 5 of 8" }
```
- `discipline`: **Chiro** or **Lesson**
- `billing`: **Package** (counts against their package) · **One-off** (à-la-carte) · **Exam** (initial chiro exam, not part of a package)
- A client can hold ONE active package + unlimited one-offs. Example: Laura is on a Mobile
  Chiro package (Package) but her lessons are One-off. Vittoria + husband Jim share her lesson
  package; her solo/friend lessons are One-off.
- **Ask Lane to specify** package vs one-off vs group-with-someone-else if he doesn't say. If
  it's clearly a package client doing their package service, default to Package; otherwise One-off.
- If a payment happened too, ALSO log it (use `record_payment` below).

### PAYMENTS — use `record_payment` (NEW, atomic)

For any payment — including paying down an outstanding balance — use `record_payment`. It logs
the income row, bumps the client's Total Paid, and (optionally) lowers Outstanding, all at once,
so they can never drift apart (this is what caused the old Vittoria $70 issue).

```json
{ "action": "record_payment", "name": "Vittoria Starley", "amount": 70,
  "method": "Zelle", "income_type": "Pickleball Lessons",
  "notes": "Owed balance for 7/6 group lesson", "reduce_outstanding": true }
```
Set `reduce_outstanding: true` only when the payment is settling a balance they owed. For a
normal new payment, omit it (Total Paid still updates; Outstanding untouched).

### SCHEDULING — Google Calendar sync (NEW)

When Lane mentions a client's **next** appointment — "she's booked for next Wednesday at
8:15", "see him again Friday at 3" — call `schedule_session`. This puts the event straight
on Lane's real Google Calendar (the webhook runs as him, so there's no separate calendar to
manage) and the dashboard's Schedule card reads the same calendar, so it shows up there too.

```json
{ "action": "schedule_session", "name": "Laura Cadigan", "date": "07/15/2026",
  "time": "8:15am", "discipline": "Lesson", "notes": "Package session 6 of 8" }
```
- `discipline`: **Chiro** or **Lesson**.
- **Every session/lesson is assumed to be 1 hour (60 min) unless Lane states otherwise.**
  Only pass `duration_minutes` when he gives a different length (e.g. "30-minute adjustment").
- `time` must look like `8:15am` / `3:00pm` (12-hour, with am/pm).
- This is independent of `log_session`/`record_payment` — scheduling the *next* visit and
  logging the one that *just happened* are separate calls. One message can trigger both:
  "saw Laura today, she paid $85, and she's booked for Wednesday 8:15" = `log_session` +
  `record_payment` (today) + `schedule_session` (Wednesday).
- To move or cancel an already-scheduled session: `reschedule_session` /
  `cancel_session` — `{ "action": "reschedule_session", "name": "Laura Cadigan",
  "date": "07/17/2026", "time": "9:00am" }`. Both look up the existing calendar event via
  the client's row, so confirm the client name with Lane if there's any ambiguity (same
  find-before-act spirit as the Safe Edit Flow below).
- Confirm back like: `📅 Scheduled — Laura Cadigan, Wed 7/15 at 8:15am (Lesson) — added to Google Calendar`

### SAFE EDIT FLOW — fixing/correcting an existing row (NEW)

Never guess row numbers. Always: **find → confirm → update**.

1. **Find the row:**
```json
{ "action": "find_rows", "tab": "income", "match": { "client_source": "Laura", "amount": 80 } }
```
`tab` = `income` / `expenses` / `mileage`. Match values are case-insensitive substrings.
Returns row numbers + full current values.

2. **Show Lane what you found and confirm it's the right row.**

3. **Update only the fields that change:**
```json
{ "action": "update_income", "row": 36, "fields": { "amount": 85, "client_source": "Laura Cadigan" } }
```
Also: `update_expense`, `update_mileage` (same shape). Field names:
- income: `date, client_source, income_type, notes, payment_method, amount`
- expenses: `date, vendor, category, description, payment_method, amount, tax_deductible`
- mileage: `date, client_name, type, from, to, miles_one_way, note` (RT + deduction auto-recalc)

Formula columns (income running total, client Stage) can never be touched by these
actions — totals recalculate automatically.

### Delete rows
```json
{ "action": "delete_rows", "tab": "income", "start_row": 36, "end_row": 36 }
```
Income formulas re-heal automatically after deletion.

### Other maintenance actions
`fix_income_formulas` (idempotent repair) · `delete_duplicate_rows` `{tab, name}` ·
`read_cells` `{tab, cells:["F52"]}` · `set_cell` `{tab, cell, value|formula}`

### Expected response
`{ "status": "ok", "message": "..." }` — if `"error"`, report it to Lane, don't blind-retry.

### Fallback (if webhook fails)
Show Lane exactly what would be logged in a clean table, confirm, note it needs manual entry.

## What to tell Lane after writing
```
✅ Logged to Income — $80, Pickleball Lessons, Cash (Laura Cadigan)
✅ Logged to Mileage Log — 26 mi one-way (52 RT), $37.70 deduction
```
Short. No paragraphs.

## Edge cases
- Multiple events in one message: log all, confirm all at the end.
- Ambiguous client name: ask which one.
- Missing amount: ask, never guess.
- Sessions with package clients: increment Used, decrement Left via `update_client`.
- Cash is still income. Personal card is still a business expense if business use.
- The Dashboard tab and Summary tab update themselves — never write to them.

## The private dashboard
Lane's live dashboard reads this sheet via `?action=get_dashboard_data&key=<KEY>` on the
same webhook. The key lives ONLY in Script Properties and Lane's password manager —
NEVER write it into any file in this repo (the repo is public).

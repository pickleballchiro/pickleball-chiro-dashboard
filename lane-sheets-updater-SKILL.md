---
name: lane-sheets-updater
description: >
  Automatically update Lane's three Pickleball Chiro Google Sheets from natural language.
  Use this skill whenever Lane mentions driving to a client, a business expense or purchase,
  income or payment received, a new lead or contact, a client session, package usage, or
  anything that sounds like it should be tracked in his business. Trigger on casual phrases
  like "I drove 20 miles to see Laura", "I bought a massage gun for $89", "Doug paid me
  $195 today", "new lead — John found me on Instagram", or "I saw Ashley this afternoon."
  This skill handles ALL three spreadsheets: Mileage Log, Finance Tracker, and Business
  Tracker. Always trigger before making any spreadsheet updates — do not attempt to update
  Google Sheets without consulting this skill first.
---

# Lane's Sheets Updater

## Spreadsheet IDs (hardcoded — never change these)

| Sheet | Google File ID |
|---|---|
| **Mileage_Log_2026** | `17e-O3auikpGd41qX8TXwzYmyJrmSD1u869Hf1Ch_asI` |
| **PickleballChiro_2026_Finance_Tracker** | `1vOLOVPz4K4jQwx3R4DBEoZyDXvE3KGYa6c8xZuYXyGw` |
| **PickleballChiro_Business_Tracker** | `1p-GyHNvvlo5Bbwpr3iIfdm32UUTc77faOxVxRczX4mU` |

---

## Step 1 — Parse Lane's message

Extract every trackable event from what Lane said. One message can trigger multiple updates (e.g., "I drove 20 miles to see Laura and she paid me $195" = mileage entry + income entry).

### Classification rules

**→ Mileage Log** if Lane mentions:
- Driving to a client, a location, a visit
- Miles, distance, trip
- Default origin: **Home (Ormond Beach)** unless he specifies otherwise

**→ Finance Tracker — Income tab** if Lane mentions:
- Getting paid, receiving money, a payment, income
- A client paid, Stripe, Venmo, Zelle, cash, card

**→ Finance Tracker — Expense tab** if Lane mentions:
- Buying something, a purchase, a subscription, a fee, spending money
- Any dollar amount attached to a product, service, or vendor

**→ Business Tracker — Leads tab** if Lane mentions:
- A new person, a new contact, someone interested
- Someone who found him, a referral, a DM

**→ Business Tracker — Clients tab** if Lane mentions:
- A session with an existing client
- Package usage, payments from a known client
- Updating a client's info, status, or notes

---

## Step 2 — Fill in missing fields

Before writing anything, resolve all required fields. Use today's date if no date is given. Infer what you can from context. **Only ask Lane if something truly cannot be inferred.**

### Mileage Log fields
| Field | Notes |
|---|---|
| Date | Today's date if not stated |
| Client Name | From context |
| Type | Mobile Chiro / Pickleball Lesson / Other |
| From | "Home" unless stated otherwise |
| To | "Client Address" unless Lane gives a specific location |
| Miles (One Way) | Lane almost always states this — ask if missing |
| Total Miles (RT) | = One Way × 2 (auto-calc in sheet, but log it) |
| Deduction ($) | = Total Miles × $0.725 (IRS standard mileage rate — hardcoded in webhook) |

### Finance Tracker — Income fields
| Field | Notes |
|---|---|
| Date | Today's date if not stated |
| Client / Source | Name or source |
| Income Type | Mobile Chiro Visit / Pickleball Lessons / Digital Products (Guides) / Package Sales / Tournament / Other |
| Description / Notes | Brief description |
| Payment Method | Stripe / Venmo / Zelle / Cash / Card / Personal Checking / Unknown |
| Amount ($) | Required — ask if missing |

### Finance Tracker — Expense fields
| Field | Notes |
|---|---|
| Date | Today's date if not stated |
| Vendor / Payee | Store, company, person |
| Category | Equipment / Supplies & Balls / Software & Subscriptions / Marketing / Education & Courses / Mileage & Travel / Professional Services / Phone (Business %) / Other |
| Description / Notes | What was purchased. For mixed-use items, include the business use % (e.g. "Insta360 X5 camera - content creation (80% business use)"). Log the **full purchase price** — let the accountant apply the % at filing. |
| Payment Method | Card / Cash / Stripe / Personal Checking / etc. |
| Amount ($) | Required — ask if missing. For items with a stated business use %, log the **full amount** (not the reduced amount) unless it's a recurring monthly subscription, in which case log only the business-use portion. |
| Tax Deductible? | Yes for most legitimate business expenses; use judgment |

### Mixed-use item rule
When an item is used partly for business and partly personal:
- **One-time purchases** (camera, laptop, paddle): log the **full price** with the business % noted in the description. The accountant applies the % at tax time.
- **Recurring subscriptions** (Pictona membership, etc.): log only the **business-use dollar amount** (e.g. 50% of $50/mo = $25) since it recurs every month and the tracker total should reflect actual deductible amounts.

### Business Tracker — Lead fields
| Field | Notes |
|---|---|
| Date Added | Today's date |
| Name | Full name |
| Phone | If provided |
| Email | If provided |
| Lead Source | **Pictona / Instagram / Earl Brown / Referral / Direct DM / Other** — default to asking if unclear |
| Service Interest | Mobile Chiro / In-Clinic Chiro / Pickleball Lessons / Digital Product |
| Status | Default: **New** |
| Follow-Up Date | Only if Lane specifies |
| Notes | Any context Lane provided |

### Business Tracker — Client update fields
| Field | Notes |
|---|---|
| Client Name | Match to existing row in Clients tab |
| Last Session | Date of session |
| Sessions / Mo. | Update if new month |
| Total Sessions | Increment by 1 per session |
| Package Used | Increment by 1 if package client (field: `sessions_used`) |
| Package Left | Decrement by 1 if package client (field: `sessions_left`) |
| Total Paid ($) | Add new payment if applicable — must include ALL payments (chiro + lessons) |
| Outstanding ($) | Update if applicable |
| Notes | Append any new context |

---

## Step 3 — Read the sheet first (for client updates)

When updating an **existing client record**, always read the current sheet content first using `Google Drive: read_file_content` with the Business Tracker file ID. Find the client's row, note current values, then calculate the updated values before writing.

For **new entries** (mileage, income, expenses, new leads), you can write directly without reading first.

---

## Step 4 — Write to the sheet

Use the **Google Apps Script webhook directly** via curl. No n8n, no localtunnel, no setup needed.

### Webhook URL (permanent — never changes)
```
https://script.google.com/macros/s/AKfycbxLcsR_4HVnmf3GkJkSx2kOf2KErYONQvEHROXjMLuThcHjnCI6IulpcDOIDrE1-1AKJw/exec
```

### How to call it — CRITICAL curl format
Always use `--data`, never `-X POST -d`. Google Apps Script redirects POST requests; `-X POST` with `-L` silently switches to GET on redirect and loses the body.

```bash
curl -s -L \
  --data '{ ...payload... }' \
  -H "Content-Type: application/json" \
  "https://script.google.com/macros/s/AKfycbxLcsR_4HVnmf3GkJkSx2kOf2KErYONQvEHROXjMLuThcHjnCI6IulpcDOIDrE1-1AKJw/exec"
```

### Action payloads

**Log mileage → Mileage_Log_2026**
```json
{
  "action": "log_mileage",
  "client_name": "Laura Cadigan",
  "miles_one_way": 26,
  "type": "Mobile Chiro",
  "from": "Home",
  "to": "Client Address"
}
```

**Log income → Finance Tracker (Income tab)**
```json
{
  "action": "log_income",
  "client_source": "Laura Cadigan",
  "income_type": "Mobile Chiro Visit",
  "notes": "Initial exam",
  "payment_method": "Stripe",
  "amount": 195
}
```

**Log expense → Finance Tracker (Expenses tab)**
```json
{
  "action": "log_expense",
  "category": "Equipment",
  "vendor": "Amazon",
  "description": "Massage gun",
  "payment_method": "Card",
  "amount": 89
}
```

**Add lead → Business Tracker (Leads tab)**
```json
{
  "action": "add_lead",
  "name": "John Smith",
  "phone": "",
  "email": "",
  "lead_source": "Instagram",
  "notes": ""
}
```

**Update lead → Business Tracker (Leads tab)**
```json
{
  "action": "update_lead",
  "name": "John Smith",
  "status": "Converted",
  "follow_up": "",
  "notes": ""
}
```

**Add client → Business Tracker (Clients tab)**
```json
{
  "action": "add_client",
  "name": "John Smith",
  "phone": "",
  "email": "",
  "package": "8-Session Package",
  "sessions_included": 8,
  "sessions_used": 0,
  "sessions_left": 8,
  "total_paid": 0,
  "notes": ""
}
```

**Update client → Business Tracker (Clients tab)**
```json
{
  "action": "update_client",
  "name": "Laura Cadigan",
  "last_session": "05/18/2026",
  "sessions_total": 3,
  "sessions_used": 2,
  "sessions_left": 6,
  "total_paid": 1270,
  "notes": "Session 3 of 8-session package."
}
```

**Delete rows by row number (any sheet)**
```json
{
  "action": "delete_rows",
  "sheet": "mileage",
  "start_row": 8,
  "end_row": 9
}
```
`sheet` must be `"mileage"`, `"finance"`, or `"business"`. `tab` is optional for sheets with multiple tabs.

**Fix income running-total formulas (one-time repair)**
```json
{ "action": "fix_income_formulas" }
```

**Delete duplicate client/lead rows by name**
```json
{
  "action": "delete_duplicate_rows",
  "tab": "Clients",
  "name": "John Smith"
}
```

### Expected response
```json
{ "status": "ok", "message": "..." }
```
If `status` is `"error"`, report the message to Lane and do not retry without investigating.

### Fallback (if webhook fails)
Show Lane exactly what would be logged in a clean table format, confirm it looks right, and note it needs to be entered manually. Don't silently fail.

### What to tell Lane after writing
Always confirm what was logged in a clean, brief summary:
```
✅ Logged to Mileage Log — May 18, Laura Cadigan, 26 miles (52 RT), $37.70 deduction
✅ Logged to Finance Tracker — $80 income, Pickleball Lessons, Cash
```
Keep it short. Lane doesn't need a paragraph — just confirmation it's done.

---

## Edge cases

- **Multiple events in one message:** Handle all of them. Log each one. Confirm all at the end.
- **Ambiguous client name:** If "Laura" could be two people, ask which Laura.
- **Amount missing on expense:** Ask before logging. Don't guess dollar amounts.
- **Lead source unclear:** Default to asking — this data matters for tracking what's working.
- **Session with non-package client:** Still log the session; skip package fields.
- **Cash payment:** Still income — log it with "Cash" as the method.
- **Personal card/checking:** Fine to log — what matters is business use, not which account paid.
- **Recurring monthly subscriptions:** Log each month's charge as a separate expense entry with that month's date.
- **Mixed-use items:** See the Mixed-use item rule in Step 2 above.

---

## Lead Source dropdown reference
Pictona | Instagram | Earl Brown | Referral | Direct DM | Other

## Income Type reference
Mobile Chiro Visit | Pickleball Lessons | Digital Products (Guides) | Package Sales | Tournament / Other

## Expense Category reference
Equipment | Supplies & Balls | Software & Subscriptions | Marketing | Education & Courses | Mileage & Travel | Professional Services | Phone (Business %) | Other

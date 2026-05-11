# Pickleball Chiro Command Center — Setup Guide

Get your live dashboard running in ~15 minutes. Do these steps in order.

---

## STEP 1 — Push this project to GitHub

1. Open **GitHub Desktop** (you already use this for your bio link)
2. Click **Add → Add Existing Repository**
3. Navigate to this folder: `Pickleball Chiro/Pickleball Chiro`
4. Click **Add Repository** (or "create a repository" if prompted)
5. Name it: `pickleball-chiro-dashboard` → set to **Private**
6. Click **Publish Repository**

---

## STEP 2 — Add secrets to GitHub (your API keys)

These replace the `.env` file so GitHub Actions can run the audit without your Mac.

1. On GitHub.com → open your `pickleball-chiro-dashboard` repo
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add each one below:

| Secret name | Value |
|---|---|
| `INSTAGRAM_ACCESS_TOKEN` | *(from your `.env` file)* |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | `17841452979926908` |
| `ANTHROPIC_API_KEY` | *(from your `.env` file)* |
| `GOOGLE_SHEET_ID` | `1JWo0C_cde5WH325iOnknNt9uxpTMNRT_bu1jqR6xftA` |
| `GOOGLE_CREDENTIALS` | *(paste the entire contents of `google-credentials.json`)* |

> **Tip:** Open `instagram-audit/.env` and `instagram-audit/google-credentials.json` in TextEdit to copy the values.

---

## STEP 3 — Test the GitHub Actions audit

1. On GitHub.com → your repo → **Actions** tab
2. Click **Manual Audit (On Demand)** in the left sidebar
3. Click **Run workflow** → **Run workflow**
4. Watch it run (takes ~2 minutes) — it should show a green checkmark ✅
5. Open your [Google Sheet](https://docs.google.com/spreadsheets/d/1JWo0C_cde5WH325iOnknNt9uxpTMNRT_bu1jqR6xftA) and confirm data was added

After this, the audit runs automatically every day at 7 AM Eastern. Your Mac never needs to be on.

---

## STEP 4 — Get a Google Sheets API key for the dashboard

The dashboard reads from your Google Sheet directly in the browser — it needs a read-only key.

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select your project **"My First Project"** (top left dropdown)
3. Left menu → **APIs & Services** → **Credentials**
4. Click **+ Create Credentials** → **API Key**
5. Click the new key to open it
6. Under **API restrictions** → select **Restrict key** → choose **Google Sheets API**
7. Save
8. Copy the key (starts with `AIza...`)

Now open `dashboard/js/config.js` and replace `YOUR_API_KEY_HERE` with your key.

---

## STEP 5 — Enable GitHub Pages (your dashboard URL)

1. On GitHub.com → your repo → **Settings** → **Pages**
2. Under **Source** → select **Deploy from a branch**
3. Branch: `main` → Folder: `/dashboard`
4. Click **Save**
5. Wait ~2 minutes → your dashboard will be live at:
   `https://pickleballchiro.github.io/pickleball-chiro-dashboard/`

Also update `dashboard/js/config.js` — replace `YOUR_GITHUB_USERNAME/pickleball-chiro-dashboard` with your actual GitHub username.

---

## STEP 6 — Initialize the Schedule tab

Tell me: **"Set up my schedule tab in Google Sheets"** and I'll create it for you with the right columns. Then any time you want to add an appointment, just say:

> "I have a lesson with Mike at 3 PM on Monday"
> "Add a new patient appointment Thursday at 10 AM"
> "Put a Zoom call with Sarah on Friday at 2 PM"

And I'll add it to your schedule, which appears on the dashboard automatically.

---

## Daily workflow going forward

| What you want | What to do |
|---|---|
| See your metrics | Open your dashboard URL |
| See fresh data right now | Click **Refresh** on the dashboard |
| Pull brand-new Instagram data | Click **▶ Run New Audit** → confirm in GitHub |
| Add a schedule entry | Tell me in chat |
| Renew Instagram token (Jun 26) | Tell me — I'll walk you through it |

---

## Token expiry reminder

Your Instagram access token expires around **June 26, 2026**. The dashboard will show a red warning banner 2 weeks before. When you see it, just tell me and I'll guide you through getting a new one (~5 minutes).

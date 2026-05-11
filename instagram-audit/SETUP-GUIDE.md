# Complete Setup Guide: Instagram Content Audit System
### @dr.lane_o — Pickleball Chiro Brand
### Written for someone with zero coding experience. You can do this.

---

## OVERVIEW — What You're Building

You're setting up a system that:
1. Connects to Instagram's official API to pull your post data
2. Grades every post using a scoring formula
3. Pushes everything into Google Sheets automatically
4. Writes you an AI strategy report every Sunday morning

This takes about 60–90 minutes to set up **once**. After that, it runs itself every Sunday at 7 AM with zero work from you.

---

## PART A: FACEBOOK PAGE SETUP

Instagram's API requires a Facebook Page to work — even if you never post to Facebook.

### Step A1 — Create a Facebook Page (skip if you already have one)

1. Open Facebook in your browser and log in with your personal account
2. Click the **grid icon** (top right, 9 squares) → click **"Page"**
3. Click the blue **"Create new Page"** button
4. In the **"Page name"** field, type: `Pickleball Chiro`
5. In the **"Category"** field, type `Chiropractor` and select it from the dropdown
6. Click **"Create Page"**
7. Skip any prompts asking you to add a profile photo or cover photo for now — you can do that later

**What you'll see:** A new blank Facebook Page called "Pickleball Chiro." Keep this tab open.

---

### Step A2 — Connect @dr.lane_o to Your Facebook Page

This is the link that gives the API access to your Instagram data.

1. Open the **Instagram app** on your phone (not the browser)
2. Go to your profile → tap the **hamburger menu** (three lines, top right)
3. Tap **"Settings and privacy"**
4. Scroll down and tap **"Account type and tools"**
5. Tap **"Switch to Professional Account"** (if you're not already a Business or Creator account)
   - Select **"Business"**
   - Choose category: **"Health/Beauty"** or **"Chiropractor"**
   - Tap **"Done"**
6. Now go back to **Settings → "Account type and tools"** → tap **"Connect to Facebook"**
7. Log in with the same Facebook account where you made the Page
8. When asked which Page to connect, select **"Pickleball Chiro"**
9. Tap **"Connect"** or **"OK"** on any permission screens

**What you'll see:** A confirmation that @dr.lane_o is now connected to your Pickleball Chiro Facebook Page. ✓

---

## PART B: META DEVELOPER APP SETUP

This is where you get the "keys" that let the code talk to Instagram on your behalf.

### Step B1 — Create Your Developer Account

1. Go to **[developers.facebook.com](https://developers.facebook.com)** in your browser
2. Click **"Get Started"** in the top right
3. Log in with your Facebook account
4. Accept the developer policies → click **"Complete Registration"**

---

### Step B2 — Create a New App

1. Once on the developer dashboard, click the blue **"Create App"** button
2. When asked **"What do you want your app to do?"**:
   - Select **"Other"** → click **"Next"**
3. For app type, select **"Business"** → click **"Next"**
4. Fill in the details:
   - **App name:** `Pickleball Chiro Audit` (can be anything)
   - **App contact email:** your email address
   - **Business portfolio:** Select your Facebook Page if prompted, or skip
5. Click **"Create App"**
6. Facebook may ask you to re-enter your password — do so

**What you'll see:** Your new app dashboard. It will show "App ID" in the top bar — **write this number down**, you'll need it.

---

### Step B3 — Add Instagram Graph API Product

1. On your app dashboard, scroll down to find **"Add products to your app"**
2. Find **"Instagram Graph API"** and click **"Set up"**
3. You'll land on the Instagram Graph API product page

---

### Step B4 — Generate a Long-Lived Access Token

This token is like a password that lets the script read your Instagram data. Instagram tokens expire, so we'll generate a long-lived one (valid 60 days — I'll explain how to refresh it below).

**First, get a Short-Lived Token:**

1. Go to **[developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer)**
2. In the top-right dropdown **"Meta App"**, select your app: `Pickleball Chiro Audit`
3. In the **"User or Page"** dropdown, select **"Get User Access Token"**
4. A permissions list will appear. Check ALL of these boxes:
   - ✅ `instagram_basic`
   - ✅ `instagram_manage_insights`
   - ✅ `pages_show_list`
   - ✅ `pages_read_engagement`
5. Click the blue **"Generate Access Token"** button
6. A popup will appear — click **"Continue as [Your Name]"** then **"OK"**
7. A long string of letters and numbers will appear in the "Access Token" field — this is your **short-lived token** (expires in 1 hour)
8. Copy it

**Convert it to a Long-Lived Token:**

1. Open a new browser tab
2. Go to this URL (replace the placeholder text with your actual values):
   ```
   https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=YOUR_SHORT_LIVED_TOKEN
   ```
   - **YOUR_APP_ID** = the App ID from Step B2
   - **YOUR_APP_SECRET** = found in your app dashboard under **Settings → Basic → App Secret** (click "Show" to reveal it)
   - **YOUR_SHORT_LIVED_TOKEN** = what you just copied

3. Press Enter. You'll see a JSON response like:
   ```json
   {"access_token":"EAABxxxxxx...","token_type":"bearer","expires_in":5183944}
   ```
4. The `access_token` value is your **long-lived token** (valid ~60 days)
5. **Copy this entire token and save it somewhere safe** — you'll put it in your .env file

> **Note on Refreshing:** This token needs refreshing every ~60 days. The simplest way: just re-run steps B4 whenever you see an error that says "token expired." I'll add a reminder in the logs.

---

### Step B5 — Find Your Instagram Business Account ID

1. In the **Graph API Explorer** ([developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer)):
2. Make sure your access token is still entered
3. In the query field at the top, type:
   ```
   me/accounts
   ```
4. Click the blue **"Submit"** button
5. You'll see a list of Pages. Find **"Pickleball Chiro"** in the results
6. Note the **"id"** value for that Page (looks like: `123456789012345`)
7. Now change the query to:
   ```
   YOUR_PAGE_ID?fields=instagram_business_account
   ```
   Replace `YOUR_PAGE_ID` with the number from step 6
8. Click **Submit**
9. You'll see a result like:
   ```json
   {"instagram_business_account": {"id": "17841400000000000"}, "id": "123456789012345"}
   ```
10. The `id` inside `instagram_business_account` is your **Instagram Business Account ID** — save it

---

## PART C: GOOGLE SHEETS API SETUP

This lets the script write data directly into your Google Sheet.

### Step C1 — Create a Google Cloud Project

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)**
2. Sign in with your Google account (odomlane17@gmail.com)
3. At the top, click the project dropdown (it may say "Select a project" or show an existing project name)
4. Click **"New Project"**
5. Name it: `Pickleball Chiro Audit`
6. Click **"Create"**
7. Wait a moment, then make sure this new project is selected in the top dropdown

---

### Step C2 — Enable the Google Sheets API

1. In the left sidebar, click **"APIs & Services"** → **"Library"**
2. In the search bar, type: `Google Sheets API`
3. Click on it when it appears
4. Click the blue **"Enable"** button
5. Wait for it to enable (takes 5–10 seconds)

Also enable the Drive API (needed for creating/accessing sheets):
1. Go back to **"Library"**
2. Search for `Google Drive API`
3. Click it → click **"Enable"**

---

### Step C3 — Create a Service Account

A service account is like a "bot user" that your script logs in as.

1. In the left sidebar: **"APIs & Services"** → **"Credentials"**
2. Click **"+ Create Credentials"** → **"Service Account"**
3. Fill in:
   - **Service account name:** `pickleball-audit`
   - **Service account ID:** will auto-fill as `pickleball-audit`
4. Click **"Create and Continue"**
5. For "Role," click the dropdown → type `Editor` → select **"Editor"** under Basic
6. Click **"Continue"** → **"Done"**

---

### Step C4 — Download the JSON Key File

1. You're back on the Credentials page — click on the service account you just created (`pickleball-audit@...`)
2. Click the **"Keys"** tab at the top
3. Click **"Add Key"** → **"Create new key"**
4. Select **"JSON"** → click **"Create"**
5. A file will download to your computer — it will have a long name like `pickleball-chiro-audit-abc123.json`
6. **Rename this file to:** `google-credentials.json`
7. **Move it into** the `instagram-audit` folder (the folder this guide is in)

> **IMPORTANT:** This file contains your Google credentials. Never share it, never upload it to GitHub.

---

### Step C5 — Create Your Google Sheet and Share It

1. Go to **[sheets.google.com](https://sheets.google.com)** and create a new blank spreadsheet
2. Name it: `Pickleball Chiro Content Audit`
3. Copy the **Sheet ID** from the URL — it's the long string between `/d/` and `/edit`:
   ```
   https://docs.google.com/spreadsheets/d/THIS_IS_YOUR_SHEET_ID/edit
   ```
4. Now share the sheet with your service account:
   - Click the green **"Share"** button (top right)
   - In the email field, paste the service account email — it looks like:
     `pickleball-audit@pickleball-chiro-audit.iam.gserviceaccount.com`
     (You can find this exact email on your Google Cloud Credentials page)
   - Set permission to **"Editor"**
   - **Uncheck** "Notify people"
   - Click **"Share"**

---

## PART D: INSTALL NODE.JS

Node.js is the programming language runtime that runs your scripts.

### Step D1 — Install Node.js

1. Go to **[nodejs.org](https://nodejs.org)**
2. Click the big **"LTS"** download button (LTS = Long Term Support = most stable)
3. Open the downloaded installer and follow the steps — just click "Next" through everything
4. To verify it installed, open **Terminal** (search for Terminal in Spotlight with Cmd+Space)
5. Type this and press Enter:
   ```
   node --version
   ```
6. You should see something like `v20.11.0` — any version is fine

---

## PART E: CREATE YOUR .ENV FILE

The `.env` file is like a safe in your project folder where all your secret keys live. The code reads from it, but it never gets shared anywhere.

### Step E1 — Create the File

1. Open **Terminal**
2. Type this command (copy and paste it exactly):
   ```
   cd "/Users/odomlane17/Documents/Chiropractic/Pickleball Chiropractor/Pickleball Chiro/Pickleball Chiro/instagram-audit"
   ```
   Press Enter
3. Then type:
   ```
   cp .env.example .env
   ```
   Press Enter
4. Now open the file:
   ```
   open .env
   ```
   This will open it in TextEdit

### Step E2 — Fill In Your Values

Replace each `PASTE_HERE` placeholder with your actual values:

```
# Instagram / Meta
INSTAGRAM_ACCESS_TOKEN=     ← Your long-lived token from Step B4
INSTAGRAM_BUSINESS_ACCOUNT_ID=   ← Your IG Business Account ID from Step B5

# Anthropic (Claude AI)
ANTHROPIC_API_KEY=          ← From console.anthropic.com (see below)

# Google Sheets
GOOGLE_SHEET_ID=            ← The Sheet ID from Step C5 URL
GOOGLE_CREDENTIALS_PATH=./google-credentials.json
```

**Getting your Anthropic API Key:**
1. Go to **[console.anthropic.com](https://console.anthropic.com)**
2. Sign in (or create a free account)
3. Click **"API Keys"** in the left sidebar
4. Click **"Create Key"**
5. Name it `pickleball-audit` → click **"Create Key"**
6. Copy the key (it starts with `sk-ant-...`) — you only see it once, so copy it now

---

## PART F: INSTALL THE PROJECT AND RUN IT

1. Open Terminal and navigate to the project folder:
   ```
   cd "/Users/odomlane17/Documents/Chiropractic/Pickleball Chiropractor/Pickleball Chiro/Pickleball Chiro/instagram-audit"
   ```

2. Install all dependencies (one-time setup):
   ```
   npm install
   ```
   Wait for it to finish — you'll see a lot of text scroll by, that's normal.

3. Test the full pipeline manually:
   ```
   node run-now.js
   ```

4. If everything worked, you'll see green checkmarks in your terminal and your Google Sheet will be populated.

5. To start the automatic Sunday scheduler:
   ```
   node scheduler.js
   ```
   Keep this terminal window open (or see the "Running in background" section below).

---

## PART G: RUNNING IN THE BACKGROUND (So You Can Close Terminal)

To keep the scheduler running even when you close Terminal, use **PM2**:

1. Install PM2:
   ```
   npm install -g pm2
   ```

2. Start the scheduler:
   ```
   cd "/Users/odomlane17/Documents/Chiropractic/Pickleball Chiropractor/Pickleball Chiro/Pickleball Chiro/instagram-audit"
   pm2 start scheduler.js --name "pickleball-audit"
   ```

3. Make it restart automatically if your Mac reboots:
   ```
   pm2 startup
   ```
   Copy and run the command it gives you, then:
   ```
   pm2 save
   ```

4. To check status: `pm2 status`
5. To see logs: `pm2 logs pickleball-audit`
6. To stop it: `pm2 stop pickleball-audit`

---

## TOKEN REFRESH REMINDER

Your Instagram access token expires every 60 days. When you see this error in your logs:
```
Error: OAuthException - Session has expired
```

Just repeat **Steps B4** (Get Short-Lived Token → Convert to Long-Lived) and paste the new token into your `.env` file. The script will pick it up on next run.

---

## TROUBLESHOOTING QUICK REFERENCE

| Error Message | Fix |
|---|---|
| `Session has expired` | Refresh your Instagram token (Step B4) |
| `Permission denied` | Re-check permissions in Step B4 — make sure all 4 are checked |
| `Invalid credentials` | Make sure `google-credentials.json` is in the `instagram-audit` folder |
| `Sheet not found` | Re-check your GOOGLE_SHEET_ID in .env |
| `Cannot find module` | Run `npm install` again |
| `ENOENT: .env` | Run `cp .env.example .env` and fill in your values |

---

You're set up. Every Sunday at 7 AM, the system runs automatically. You'll find your weekly report in the `instagram-audit` folder and in Tab 3 of your Google Sheet.

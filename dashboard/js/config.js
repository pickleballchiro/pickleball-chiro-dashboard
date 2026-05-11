// ─────────────────────────────────────────────────────────────────────────────
// PICKLEBALL CHIRO DASHBOARD — CONFIG
// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Go to console.cloud.google.com
// Step 2: APIs & Services → Credentials → + Create Credentials → API Key
// Step 3: Click the key → Restrict to "Google Sheets API" only
// Step 4: Paste your key below (replace YOUR_API_KEY_HERE)
// ─────────────────────────────────────────────────────────────────────────────

window.DASHBOARD_CONFIG = {
  // Main IG audit sheet — Weekly Posts, AI Reports, Schedule, Followers
  SHEET_ID: '1JWo0C_cde5WH325iOnknNt9uxpTMNRT_bu1jqR6xftA',

  // Finance Tracker — Income, Expenses
  FINANCE_SHEET_ID: '1vOLOVPz4K4jQwx3R4DBEoZyDXvE3KGYa6c8xZuYXyGw',
  FINANCE_INCOME_TAB:   '💰 Income',
  FINANCE_EXPENSE_TAB:  '🧾 Expenses',

  // Business Tracker — Leads, Clients
  BUSINESS_SHEET_ID: '1p-GyHNvvlo5Bbwpr3iIfdm32UUTc77faOxVxRczX4mU',
  BUSINESS_LEADS_TAB:   'Leads',
  BUSINESS_CLIENTS_TAB: 'Clients',

  SHEETS_API_KEY: 'AIzaSyAjtHneopV7x18gxtfNMfKZ3Wyg12SlwnY',

  // Instagram token expires ~June 26, 2026 — dashboard warns 14 days before
  IG_TOKEN_EXPIRY: '2026-06-26',

  // GitHub repo info — for "Run New Audit" button link
  GITHUB_REPO: 'pickleballchiro/pickleball-chiro',
};

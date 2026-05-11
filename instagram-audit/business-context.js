/**
 * business-context.js — Pulls revenue, expenses, leads from Lane's public
 * Finance Tracker and Business Tracker sheets, plus follower delta from the
 * audit sheet. Used to enrich the AI weekly report.
 *
 * All three sheets must be set to "Anyone with the link → Viewer".
 */

require('dotenv').config({ override: true });
const axios = require('axios');
const { log, warn } = require('./utils/logger');

const FINANCE_SHEET_ID  = '1vOLOVPz4K4jQwx3R4DBEoZyDXvE3KGYa6c8xZuYXyGw';
const BUSINESS_SHEET_ID = '1p-GyHNvvlo5Bbwpr3iIfdm32UUTc77faOxVxRczX4mU';
const INCOME_TAB   = '💰 Income';
const EXPENSE_TAB  = '🧾 Expenses';
const LEADS_TAB    = 'Leads';
const FOLLOWERS_TAB = 'Followers';

// We need an API key with Sheets API enabled. Reuse the dashboard's key
// (it's already restricted to Sheets API). If absent, businessContext returns null.
const SHEETS_API_KEY = process.env.SHEETS_API_KEY || 'AIzaSyAjtHneopV7x18gxtfNMfKZ3Wyg12SlwnY';

async function fetchTab(sheetId, tabName) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("'" + tabName + "'")}`;
  try {
    const res = await axios.get(url, { params: { key: SHEETS_API_KEY } });
    return res.data.values || [];
  } catch (err) {
    warn(`Could not fetch ${tabName} from sheet ${sheetId}: ${err.response?.data?.error?.message || err.message}`);
    return [];
  }
}

function parseMoney(s) {
  if (s == null || s === '' || s === '-') return 0;
  const n = parseFloat(String(s).replace(/[$,]/g, '').trim());
  return isNaN(n) ? 0 : n;
}

function parseDate(s) {
  if (!s) return null;
  const us = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return new Date(+us[3], +us[1] - 1, +us[2]);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function startOfWeek(d = new Date()) {
  const day = d.getDay();
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return monday;
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfYear(d = new Date()) {
  return new Date(d.getFullYear(), 0, 1);
}

/**
 * Returns a businessContext object suitable for the AI report.
 * Returns null if no data could be fetched (e.g., sheets not accessible).
 */
async function getBusinessContext() {
  log('Fetching business context (revenue, expenses, leads, follower delta)...');

  const [income, expenses, leads, followers] = await Promise.all([
    fetchTab(FINANCE_SHEET_ID,  INCOME_TAB),
    fetchTab(FINANCE_SHEET_ID,  EXPENSE_TAB),
    fetchTab(BUSINESS_SHEET_ID, LEADS_TAB),
    fetchTab(process.env.GOOGLE_SHEET_ID, FOLLOWERS_TAB),
  ]);

  // If nothing came back, skip
  if (income.length === 0 && expenses.length === 0 && leads.length === 0) {
    warn('No business data available — AI report will be content-only');
    return null;
  }

  const weekStart  = startOfWeek();
  const monthStart = startOfMonth();
  const yearStart  = startOfYear();

  // Revenue
  let revenueWeek = 0, revenueMonth = 0, revenueYTD = 0;
  for (const row of income) {
    if (!row || !row[0]) continue;
    const d = parseDate(row[0]);
    if (!d) continue;
    const amt = parseMoney(row[5]);
    if (d >= yearStart)  revenueYTD   += amt;
    if (d >= monthStart) revenueMonth += amt;
    if (d >= weekStart)  revenueWeek  += amt;
  }

  // Expenses
  let expenseWeek = 0, expenseMonth = 0, expenseYTD = 0;
  for (const row of expenses) {
    if (!row || !row[0]) continue;
    const d = parseDate(row[0]);
    if (!d) continue;
    const amt = parseMoney(row[5]);
    if (d >= yearStart)  expenseYTD   += amt;
    if (d >= monthStart) expenseMonth += amt;
    if (d >= weekStart)  expenseWeek  += amt;
  }

  // Leads
  let newLeadsWeek = 0, totalLeads = 0;
  for (const row of leads) {
    if (!row || !row[0]) continue;
    const d = parseDate(row[0]);
    if (!d) continue;
    totalLeads++;
    if (d >= weekStart) newLeadsWeek++;
  }

  // Follower 7-day delta
  let follower7dDelta = null;
  if (followers.length >= 2) {
    const data = followers.slice(1)
      .filter(r => r && r[0])
      .map(r => ({ date: r[0], followers: parseInt(r[1]) || 0 }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    if (data.length >= 2) {
      const latest = data[data.length - 1].followers;
      const weekAgo = data[Math.max(0, data.length - 8)].followers;
      follower7dDelta = latest - weekAgo;
    }
  }

  const ctx = {
    revenueWeek, revenueMonth, revenueYTD,
    expenseWeek, expenseMonth, expenseYTD,
    newLeadsWeek, totalLeads,
    follower7dDelta,
  };
  log(`Business context: revenue=$${revenueWeek} wk, expenses=$${expenseWeek} wk, leads=${newLeadsWeek} new`);
  return ctx;
}

module.exports = { getBusinessContext };

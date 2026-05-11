// ─────────────────────────────────────────────────────────────────────────────
// PICKLEBALL CHIRO COMMAND CENTER — dashboard.js
// ─────────────────────────────────────────────────────────────────────────────

const CFG = window.DASHBOARD_CONFIG;
const SHEET_ID = CFG.SHEET_ID;
const API_KEY  = CFG.SHEETS_API_KEY;
const BASE_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;

// Tab names — must match exactly what's in the Google Sheet
const TAB_POSTS     = 'Weekly Posts';
const TAB_REPORTS   = 'AI Reports';
const TAB_SCHEDULE  = 'Schedule';
const TAB_FOLLOWERS = 'Followers';

// Grade label → css class
const GRADE_CLASS = {
  'DOUBLE DOWN': 'grade-green',
  'MODIFY':      'grade-yellow',
  'RETIRE':      'grade-red',
  'KILL IT':     'grade-gray',
};

// Post column indices (0-based) matching sheets.js POST_HEADERS
const COL = {
  postId: 0, weekOf: 1, postDate: 2, dayPosted: 3, type: 4,
  pillar: 5, hook: 6, ctaKeyword: 7, reach: 8, views: 9,
  avgWatch: 10, skipRate: 11, saves: 12, shares: 13, reposts: 14,
  comments: 15, likes: 16, profileVisits: 17, follows: 18,
  score: 19, grade: 20,
};

// ─── API HELPERS ─────────────────────────────────────────────────────────────

async function fetchRange(tabName, range = '') {
  const r = range ? `'${tabName}'!${range}` : `'${tabName}'`;
  const url = `${BASE_URL}/values/${encodeURIComponent(r)}?key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Sheets API error ${res.status}`);
  }
  const data = await res.json();
  return data.values || [];
}

async function fetchFromSheet(sheetId, tabName) {
  const r = `'${tabName}'`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(r)}?key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.values || [];
}

// Strip currency symbols + commas, return Number
function parseMoney(s) {
  if (s == null || s === '' || s === '-') return 0;
  const n = parseFloat(String(s).replace(/[$,]/g, '').trim());
  return isNaN(n) ? 0 : n;
}

// Parse various date formats to a JS Date
function parseDate(s) {
  if (!s) return null;
  if (s instanceof Date) return s;
  // Try MM/DD/YYYY first (Lane's format)
  const us = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return new Date(+us[3], +us[1] - 1, +us[2]);
  // Try ISO
  const iso = new Date(s);
  return isNaN(iso) ? null : iso;
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

// Locate the grade column dynamically — look for emoji marker in the last 2 cells.
// Handles two schemas:
//   21-column (Node audit): score at idx 19, grade at idx 20
//   20-column (n8n workflow): grade at idx 19, no score
function findGradeIdx(row) {
  const re = /[🟢🟡🔴⚫]/u;
  for (let i = row.length - 1; i >= row.length - 3 && i >= 0; i--) {
    if (re.test(row[i] || '')) return i;
  }
  return -1;
}

// Fallback score when row is missing one — derive a rough number from grade label
function gradeFallbackScore(grade) {
  if (grade.includes('DOUBLE')) return 75;
  if (grade.includes('MODIFY'))  return 50;
  if (grade.includes('RETIRE'))  return 25;
  if (grade.includes('KILL'))    return 5;
  return 0;
}

function rowToPost(row) {
  const gradeIdx = findGradeIdx(row);
  const rawGrade = gradeIdx >= 0 ? (row[gradeIdx] || '') : '';
  const grade = rawGrade.replace(/[🟢🟡🔴⚫]\s*/u, '').trim();

  // The 21-column schema (Node audit) has score at idx 19 just before grade at idx 20.
  // The 20-column schema (n8n) has grade at idx 19 with no score column.
  // Detect by checking if there's a column AFTER the grade.
  let score = 0;
  if (gradeIdx === 20) {
    score = parseInt(row[19]) || 0;
  } else {
    // No real score column — derive a rough one from the grade label
    score = gradeFallbackScore(grade);
  }

  // Parse score breakdown JSON (column 21, only present on Node-audited rows)
  let breakdown = null;
  if (row[21]) {
    try { breakdown = JSON.parse(row[21]); } catch { /* ignore */ }
  }

  const numOrNull = v => {
    if (v === undefined || v === null || v === '' || v === 'N/A') return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };

  return {
    postId:   row[COL.postId]   || '',
    weekOf:   row[COL.weekOf]   || '',
    postDate: row[COL.postDate] || '',
    dayPosted: row[COL.dayPosted] || '',
    type:     row[COL.type]     || '',
    pillar:   row[COL.pillar]   || '',
    hook:     row[COL.hook]     || '',
    ctaKeyword: row[COL.ctaKeyword] || '',
    reach:    parseInt(row[COL.reach])  || 0,
    views:    parseInt(row[COL.views])  || 0,
    avgWatch: numOrNull(row[COL.avgWatch]),
    skipRate: numOrNull(row[COL.skipRate]),
    saves:    parseInt(row[COL.saves])  || 0,
    shares:   parseInt(row[COL.shares]) || 0,
    reposts:  parseInt(row[COL.reposts]) || 0,
    comments: parseInt(row[COL.comments]) || 0,
    likes:    parseInt(row[COL.likes])    || 0,
    profileVisits: numOrNull(row[COL.profileVisits]) || 0,
    follows:  numOrNull(row[COL.follows]) || 0,
    score,
    grade,
    breakdown,
  };
}

// ─── GRADE HELPERS ───────────────────────────────────────────────────────────

function gradeEmoji(grade) {
  if (grade.includes('DOUBLE')) return '🟢';
  if (grade.includes('MODIFY'))  return '🟡';
  if (grade.includes('RETIRE'))  return '🔴';
  if (grade.includes('KILL'))    return '⚫';
  return '';
}

function gradeCssClass(grade) {
  if (grade.includes('DOUBLE')) return 'grade-green';
  if (grade.includes('MODIFY'))  return 'grade-yellow';
  if (grade.includes('RETIRE'))  return 'grade-red';
  if (grade.includes('KILL'))    return 'grade-gray';
  return 'grade-gray';
}

function scoreColor(score) {
  if (score >= 65) return '#22c55e';
  if (score >= 40) return '#eab308';
  if (score >= 20) return '#ef4444';
  return '#6b7280';
}

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────

function parseWeekOf(str) {
  if (!str) return new Date(0);
  const [m, d, y] = str.split('/');
  return new Date(+y, +m - 1, +d);
}

function getWeekDays(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  // If today is Sunday, roll forward to show next week (Mon-Sun)
  const rollForward = day === 0 ? 1 : 0;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((day + 6) % 7) + (rollForward + offsetWeeks) * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

// Local-date ISO string (YYYY-MM-DD) — avoids UTC conversion that shifts dates
function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shortDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Convert a time string like "9:00 AM" or "3:00 PM" to minutes-since-midnight for sorting
function timeToMinutes(t) {
  if (!t) return 0;
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return 0;
  let h = parseInt(m[1]);
  const mins = parseInt(m[2]);
  const ampm = (m[3] || '').toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + mins;
}

// ─── CHART.JS CHARTS ─────────────────────────────────────────────────────────

let reachChart = null;
let gradeChart = null;

function renderReachChart(posts) {
  const ctx = document.getElementById('reach-chart');
  if (!ctx) return;

  // Group by weekOf, get avg reach per week (last 8 weeks)
  const weekMap = {};
  for (const p of posts) {
    if (!p.weekOf) continue;
    if (!weekMap[p.weekOf]) weekMap[p.weekOf] = { total: 0, count: 0 };
    weekMap[p.weekOf].total += p.reach;
    weekMap[p.weekOf].count++;
  }
  const weeks = Object.keys(weekMap)
    .sort((a, b) => parseWeekOf(a) - parseWeekOf(b))
    .slice(-8);

  const labels = weeks.map(w => {
    const d = parseWeekOf(w);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  const data = weeks.map(w => Math.round(weekMap[w].total / weekMap[w].count));

  if (reachChart) reachChart.destroy();
  reachChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Avg Reach',
        data,
        borderColor: '#E8541E',
        backgroundColor: 'rgba(232,84,30,0.08)',
        borderWidth: 2,
        pointBackgroundColor: '#E8541E',
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.3,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1a1a',
          borderColor: '#2a2a2a',
          borderWidth: 1,
          titleColor: '#f0f0f0',
          bodyColor: '#888',
          callbacks: {
            label: ctx => ` ${ctx.parsed.y.toLocaleString()} avg reach`,
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#666', font: { size: 11 } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#666', font: { size: 11 }, callback: v => v.toLocaleString() },
          beginAtZero: false,
        }
      }
    }
  });
}

function renderGradeChart(posts) {
  const ctx = document.getElementById('grade-chart');
  if (!ctx) return;

  const counts = { 'DOUBLE DOWN': 0, 'MODIFY': 0, 'RETIRE': 0, 'KILL IT': 0, 'Other': 0 };
  for (const p of posts) {
    const g = p.grade;
    if (g.includes('DOUBLE')) counts['DOUBLE DOWN']++;
    else if (g.includes('MODIFY')) counts['MODIFY']++;
    else if (g.includes('RETIRE')) counts['RETIRE']++;
    else if (g.includes('KILL')) counts['KILL IT']++;
    else counts['Other']++;
  }
  if (counts['Other'] === 0) delete counts['Other'];

  if (gradeChart) gradeChart.destroy();
  gradeChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: ['#22c55e', '#eab308', '#ef4444', '#6b7280', '#3b3b3b'],
        borderColor: '#1a1a1a',
        borderWidth: 3,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#888',
            font: { size: 11 },
            padding: 14,
            usePointStyle: true,
          }
        },
        tooltip: {
          backgroundColor: '#1a1a1a',
          borderColor: '#2a2a2a',
          borderWidth: 1,
          titleColor: '#f0f0f0',
          bodyColor: '#888',
        }
      }
    }
  });
}

// ─── RENDER FUNCTIONS ─────────────────────────────────────────────────────────

function renderKPIs(posts) {
  const total = posts.length;
  const avgReach = total
    ? Math.round(posts.reduce((s, p) => s + p.reach, 0) / total)
    : 0;
  const topPost = [...posts].sort((a, b) => b.score - a.score)[0];

  document.getElementById('kpi-posts').textContent   = total;
  document.getElementById('kpi-posts-sub').textContent = total === 0 ? 'no posts yet' : `${(total / 7).toFixed(1)} per day avg`;
  document.getElementById('kpi-reach').textContent   = avgReach.toLocaleString();
  document.getElementById('kpi-score').textContent   = topPost?.score ?? '—';

  if (topPost) {
    document.getElementById('kpi-score-sub').textContent = topPost.hook.substring(0, 40) + (topPost.hook.length > 40 ? '…' : '');
  }
}

// ─── FOLLOWERS — KPI mini card + full growth section ─────────────────────────

let followerChart = null;

function renderFollowers(rows) {
  const data = (rows || []).slice(1).filter(r => r && r[0])
    .map(r => ({ date: r[0], followers: parseInt(r[1]) || 0, mediaCount: parseInt(r[2]) || 0 }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // KPI mini card on top
  const el = document.getElementById('kpi-followers');
  const delta = document.getElementById('kpi-followers-delta');

  if (data.length === 0) {
    el.textContent = '—';
    delta.textContent = 'tracking starts on first audit run';
    renderFollowerGrowth([]);
    return;
  }

  const current = data[data.length - 1].followers;
  el.textContent = current.toLocaleString();

  if (data.length >= 2) {
    const start = data[0].followers;
    const change = current - start;
    const sign = change >= 0 ? '+' : '';
    delta.textContent = `${sign}${change.toLocaleString()} since ${data[0].date}`;
    delta.style.color = change > 0 ? 'var(--green)' : change < 0 ? 'var(--red)' : 'var(--text-dim)';
  } else {
    delta.textContent = `first snapshot: ${data[0].date}`;
  }

  renderFollowerGrowth(data);
}

function deltaSign(n) {
  if (n > 0) return '+' + n.toLocaleString();
  if (n < 0) return n.toLocaleString();
  return '0';
}
function deltaClass(n) {
  if (n > 0) return 'up';
  if (n < 0) return 'down';
  return 'flat';
}

// Find the followers count on (or just before) a given target date
function findFollowersOnDate(data, targetISO) {
  // Pick the latest snapshot with date <= target
  let best = null;
  for (const d of data) {
    if (d.date <= targetISO) best = d;
    else break;
  }
  return best;
}

function renderFollowerGrowth(data) {
  const noteEl = document.getElementById('follower-tracking-note');
  const currentEl = document.getElementById('follower-current');
  const todayEl   = document.getElementById('follower-today');
  const weekEl    = document.getElementById('follower-week');
  const monthEl   = document.getElementById('follower-month');

  if (!currentEl) return;

  // Empty state
  if (data.length === 0) {
    currentEl.textContent = '—';
    todayEl.textContent = '—';
    weekEl.textContent  = '—';
    monthEl.textContent = '—';
    noteEl.textContent  = 'Tracking starts after your first audit run';
    if (followerChart) followerChart.destroy();
    return;
  }

  const current = data[data.length - 1].followers;
  currentEl.textContent = current.toLocaleString();

  // Compute deltas
  const todayISO = new Date().toISOString().split('T')[0];
  const dToday = new Date(todayISO);
  const yesterdayISO = new Date(dToday.getTime() - 1*86400000).toISOString().split('T')[0];
  const weekAgoISO   = new Date(dToday.getTime() - 7*86400000).toISOString().split('T')[0];
  const monthAgoISO  = new Date(dToday.getTime() - 30*86400000).toISOString().split('T')[0];

  const yesterday = findFollowersOnDate(data, yesterdayISO);
  const weekAgo   = findFollowersOnDate(data, weekAgoISO);
  const monthAgo  = findFollowersOnDate(data, monthAgoISO);

  // Daily delta — only meaningful if we have a snapshot from yesterday or earlier
  if (yesterday && data.length >= 2 && yesterday.date !== data[data.length - 1].date) {
    const d = current - yesterday.followers;
    todayEl.textContent = deltaSign(d);
    todayEl.className = 'follower-stat-value ' + deltaClass(d);
  } else {
    todayEl.textContent = '—';
    todayEl.className = 'follower-stat-value flat';
  }

  // Weekly delta
  if (weekAgo && weekAgo.date !== data[data.length - 1].date) {
    const d = current - weekAgo.followers;
    weekEl.textContent = deltaSign(d);
    weekEl.className = 'follower-stat-value ' + deltaClass(d);
  } else {
    weekEl.textContent = '—';
    weekEl.className = 'follower-stat-value flat';
  }

  // Monthly delta
  if (monthAgo && monthAgo.date !== data[data.length - 1].date) {
    const d = current - monthAgo.followers;
    monthEl.textContent = deltaSign(d);
    monthEl.className = 'follower-stat-value ' + deltaClass(d);
  } else {
    monthEl.textContent = '—';
    monthEl.className = 'follower-stat-value flat';
  }

  noteEl.textContent = data.length === 1
    ? `First snapshot: ${data[0].date} — chart fills in daily`
    : `${data.length} daily snapshots since ${data[0].date}`;

  // Build the line chart
  const ctx = document.getElementById('follower-chart');
  if (!ctx) return;

  const labels = data.map(d => {
    const dt = new Date(d.date);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  const values = data.map(d => d.followers);

  if (followerChart) followerChart.destroy();
  followerChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Followers',
        data: values,
        borderColor: '#E8541E',
        backgroundColor: 'rgba(232,84,30,0.12)',
        borderWidth: 2.5,
        pointBackgroundColor: '#E8541E',
        pointRadius: data.length === 1 ? 6 : 4,
        pointHoverRadius: 7,
        tension: 0.25,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1a1a',
          borderColor: '#2a2a2a',
          borderWidth: 1,
          titleColor: '#f0f0f0',
          bodyColor: '#888',
          callbacks: {
            label: c => ` ${c.parsed.y.toLocaleString()} followers`,
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#666', font: { size: 11 }, maxRotation: 0 },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#666', font: { size: 11 }, callback: v => v.toLocaleString() },
          beginAtZero: false,
        }
      }
    }
  });
}

// ─── POSTING CADENCE ──────────────────────────────────────────────────────────

let cadenceChart = null;

function renderCadence(allPosts) {
  // Count posts by week — show last 5 weeks
  const weekMap = {};
  for (const p of allPosts) {
    if (!p.weekOf) continue;
    weekMap[p.weekOf] = (weekMap[p.weekOf] || 0) + 1;
  }
  const weeks = Object.keys(weekMap)
    .sort((a, b) => parseWeekOf(a) - parseWeekOf(b))
    .slice(-5);

  const labels = weeks.map(w => {
    const d = parseWeekOf(w);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  const counts = weeks.map(w => weekMap[w]);
  const thisWeek = counts[counts.length - 1] || 0;

  document.getElementById('cadence-this-week').textContent = thisWeek;

  const ctx = document.getElementById('cadence-chart');
  if (!ctx) return;
  if (cadenceChart) cadenceChart.destroy();
  cadenceChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: counts,
        backgroundColor: ctx2 => {
          const i = ctx2.dataIndex;
          return i === counts.length - 1 ? '#E8541E' : '#3a3a3a';
        },
        borderRadius: 4,
        barThickness: 16,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        backgroundColor: '#1a1a1a', borderColor: '#2a2a2a', borderWidth: 1,
        callbacks: { label: c => ` ${c.parsed.y} posts` }
      }},
      scales: {
        x: { grid: { display: false }, ticks: { color: '#666', font: { size: 10 } } },
        y: { display: false, beginAtZero: true }
      }
    }
  });
}

// ─── REVENUE (from Finance Tracker → Income tab) ──────────────────────────────
// Header row is at row 4, data starts row 5 — but the Sheets API returns all rows.
// Columns: Date, Client/Source, Income Type, Description, Payment Method, Amount, Running Total
function renderRevenue(rows) {
  const weekStart  = startOfWeek();
  const monthStart = startOfMonth();
  let week = 0, month = 0, lifetime = 0;
  let entries = 0;

  for (const row of (rows || [])) {
    if (!row || !row[0]) continue;
    const d = parseDate(row[0]);
    if (!d) continue;
    const amt = parseMoney(row[5]);
    if (amt === 0) continue;
    lifetime += amt;
    if (d >= monthStart) month += amt;
    if (d >= weekStart)  week  += amt;
    entries++;
  }

  document.getElementById('kpi-revenue').textContent = '$' + week.toLocaleString();
  document.getElementById('kpi-revenue-sub').textContent =
    `$${month.toLocaleString()} this month · $${lifetime.toLocaleString()} YTD`;
}

// ─── EXPENSES (from Finance Tracker → Expenses tab) ───────────────────────────
function renderExpenses(rows) {
  const weekStart  = startOfWeek();
  const monthStart = startOfMonth();
  let week = 0, month = 0, lifetime = 0;

  for (const row of (rows || [])) {
    if (!row || !row[0]) continue;
    const d = parseDate(row[0]);
    if (!d) continue;
    const amt = parseMoney(row[5]);
    if (amt === 0) continue;
    lifetime += amt;
    if (d >= monthStart) month += amt;
    if (d >= weekStart)  week  += amt;
  }

  document.getElementById('kpi-expenses').textContent = '$' + week.toLocaleString();
  document.getElementById('kpi-expenses-sub').textContent =
    `$${month.toLocaleString()} this month · $${lifetime.toLocaleString()} YTD`;
}

// ─── LEADS (Business Tracker → Leads tab + CTA-keyword IG posts) ─────────────
function renderLeads(posts, leadRows) {
  const ctaPosts = posts.filter(p => p.ctaKeyword && p.ctaKeyword !== '');
  const ctaReach = ctaPosts.reduce((s, p) => s + p.reach, 0);

  // Parse business sheet leads. Header is row 1 (Date Added, Name, Phone, Email, Source, Service Interest, Status, Follow-Up, Notes).
  // The first data rows start somewhere after the title row though — use the date column to filter.
  const weekStart  = startOfWeek();
  const monthStart = startOfMonth();
  let newThisWeek = 0, newThisMonth = 0, total = 0;
  const statusCounts = {};

  for (const row of (leadRows || [])) {
    if (!row || !row[0]) continue;
    const d = parseDate(row[0]);
    if (!d) continue;
    total++;
    const status = (row[6] || '').trim();
    if (status) statusCounts[status] = (statusCounts[status] || 0) + 1;
    if (d >= monthStart) newThisMonth++;
    if (d >= weekStart)  newThisWeek++;
  }

  const totalLeads = newThisWeek + ctaPosts.length;
  document.getElementById('kpi-leads').textContent = totalLeads;

  const parts = [];
  if (newThisWeek > 0) parts.push(`${newThisWeek} new this week`);
  if (ctaPosts.length > 0) parts.push(`${ctaPosts.length} CTA post${ctaPosts.length === 1 ? '' : 's'} reaching ${ctaReach.toLocaleString()}`);
  if (parts.length === 0) parts.push(`${total} total in pipeline`);

  document.getElementById('kpi-leads-sub').textContent = parts.join(' · ');
}

function renderTopPosts(posts) {
  const el = document.getElementById('top-posts');
  const top = [...posts].sort((a, b) => b.score - a.score).slice(0, 5);
  if (top.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div>No posts this week yet</div>`;
    return;
  }
  el.innerHTML = top.map((p, i) => `
    <div class="top-post">
      <div class="post-rank">${i + 1}</div>
      <div class="post-info">
        <div class="post-hook">${escHtml(p.hook || '(no caption)')}</div>
        <div class="post-meta">
          ${p.type} · ${p.pillar} · ${p.reach.toLocaleString()} reach
          <span class="grade-pill ${gradeCssClass(p.grade)}">${gradeEmoji(p.grade)} ${p.grade}</span>
        </div>
      </div>
      <div class="post-score" style="color:${scoreColor(p.score)}">${p.score}</div>
    </div>
  `).join('');
}

let currentPostsForBreakdown = [];

function renderPostsTable(posts) {
  currentPostsForBreakdown = posts;
  const el = document.getElementById('posts-table-body');
  if (posts.length === 0) {
    el.innerHTML = `<tr><td colspan="11" style="text-align:center;color:var(--text-dim);padding:24px">No posts this week</td></tr>`;
    return;
  }
  const sorted = [...posts].sort((a, b) => b.score - a.score);
  el.innerHTML = sorted.map(p => `
    <tr class="clickable-row" data-post-id="${escHtml(p.postId)}">
      <td><span class="hook-cell" title="${escHtml(p.hook)}">${escHtml(p.hook.substring(0, 50))}${p.hook.length > 50 ? '…' : ''}</span></td>
      <td>${p.type}</td>
      <td style="color:var(--text-dim)">${p.postDate}</td>
      <td>${p.profileVisits || 0}</td>
      <td>${p.follows || 0}</td>
      <td>${p.reach.toLocaleString()}</td>
      <td>${p.saves}</td>
      <td>${p.shares}</td>
      <td>${p.comments}</td>
      <td class="score-cell">${p.score}</td>
      <td><span class="grade-pill ${gradeCssClass(p.grade)}">${gradeEmoji(p.grade)} ${p.grade}</span></td>
    </tr>
  `).join('');

  // Wire up row clicks for breakdown panel
  el.querySelectorAll('tr.clickable-row').forEach(tr => {
    tr.addEventListener('click', () => {
      const id = tr.dataset.postId;
      const post = currentPostsForBreakdown.find(p => p.postId === id);
      if (post) showGradeBreakdown(post);
    });
  });
}

function showGradeBreakdown(post) {
  const panel = document.getElementById('grade-breakdown-panel');
  const title = document.getElementById('grade-panel-title');
  const body  = document.getElementById('grade-panel-body');

  title.textContent = `${gradeEmoji(post.grade)} ${post.grade} · Score ${post.score}/100`;

  // Reel formula max: Reach 30, Skip 20, Virality 20, Saves 15, Watch 10, Comments 5
  // Carousel/Image: Reach 30, Saves 25, Virality 20, Comments 10, ProfileVisits 8, Follows 4, Likes 3
  const isReel = post.type === 'Reel';
  const components = isReel ? [
    { label: 'Reach',         max: 30 },
    { label: 'Skip Rate',     max: 20 },
    { label: 'Virality',      max: 20 },
    { label: 'Saves',         max: 15 },
    { label: 'Watch Time',    max: 10 },
    { label: 'Comments',      max: 5 },
  ] : [
    { label: 'Reach',         max: 30 },
    { label: 'Saves',         max: 25 },
    { label: 'Virality',      max: 20 },
    { label: 'Comments',      max: 10 },
    { label: 'Profile Visits',max: 8 },
    { label: 'Follows',       max: 4 },
    { label: 'Likes',         max: 3 },
  ];

  const KEY_MAP = { 'Reach':'reach','Skip Rate':'skipRate','Virality':'virality','Saves':'saves','Watch Time':'watchTime','Comments':'comments','Profile Visits':'profileVisits','Follows':'follows','Likes':'likes' };
  const b = post.breakdown || {};

  body.innerHTML = `
    <div style="margin-bottom:14px;color:var(--text-dim);font-size:0.85rem">
      "<em>${escHtml(post.hook.substring(0, 100))}${post.hook.length > 100 ? '…' : ''}</em>"
    </div>
    ${post.breakdown ? components.map(c => {
      const got = b[KEY_MAP[c.label]] ?? 0;
      const pct = (got / c.max) * 100;
      return `<div class="score-component">
        <div class="score-component-label">${c.label}</div>
        <div class="score-bar"><div class="score-bar-fill" style="width:${pct}%"></div></div>
        <div class="score-component-val">${got}/${c.max}</div>
      </div>`;
    }).join('') : `<div style="color:var(--text-dim);font-size:0.85rem">Score breakdown not available for this post yet — it was added before the breakdown column existed. Future audits will populate this.</div>`}
  `;

  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderAIReport(rows) {
  const el = document.getElementById('ai-report-text');
  const weekEl = document.getElementById('ai-report-week');
  const expandBtn = document.getElementById('ai-expand-btn');

  // rows[0] = header, last row = most recent
  const dataRows = rows.slice(1).filter(r => r && r[0]);
  if (dataRows.length === 0) {
    el.innerHTML = '<div class="empty-state">No AI report yet — run the audit first.</div>';
    weekEl.textContent = '';
    return;
  }
  const latest = dataRows[dataRows.length - 1];
  weekEl.textContent = `Week of ${latest[0] || ''}`;
  el.textContent = latest[1] || '(empty report)';

  expandBtn.addEventListener('click', () => {
    el.classList.toggle('expanded');
    expandBtn.textContent = el.classList.contains('expanded') ? '▲ Show less' : '▼ Show full report';
  });
}

function renderSchedule(rows) {
  const wrap = document.getElementById('schedule-wrap');
  const weekDays = getWeekDays(0);
  const today = isoDate(new Date());

  // Parse schedule rows (skip header)
  const entries = [];
  for (const row of rows.slice(1)) {
    if (!row || !row[0]) continue;
    entries.push({
      date:  row[0] || '',  // ISO: YYYY-MM-DD or MM/DD/YYYY
      time:  row[1] || '',
      task:  row[2] || '',
      type:  row[3] || '',
      notes: row[4] || '',
    });
  }

  // Normalize dates to ISO
  const normalize = d => {
    if (!d) return '';
    if (d.includes('-')) return d;
    const [m, day, y] = d.split('/');
    return `${y}-${m.padStart(2,'0')}-${day.padStart(2,'0')}`;
  };

  if (rows.length <= 1) {
    // Tab exists but empty (or doesn't exist)
    wrap.innerHTML = `
      <div class="schedule-hint">
        No schedule yet.<br>
        Tell me: <strong>"I have a lesson with Mike at 3 PM Monday"</strong> and I'll add it here.
      </div>`;
    return;
  }

  const grid = weekDays.map((day, i) => {
    const iso = isoDate(day);
    const isToday = iso === today;
    const dayEntries = entries.filter(e => normalize(e.date) === iso)
      .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

    const apptHtml = dayEntries.length
      ? dayEntries.map(e => `
          <div class="appt-card">
            <div class="appt-time">${e.time}</div>
            <div class="appt-name">${escHtml(e.task)}</div>
            ${e.type ? `<div class="appt-type">${escHtml(e.type)}</div>` : ''}
          </div>
        `).join('')
      : `<div class="no-appts">Free</div>`;

    return `
      <div class="day-col">
        <div class="day-label${isToday ? ' today' : ''}">${DAY_NAMES[i]}</div>
        <div class="day-date${isToday ? ' today' : ''}">${shortDate(day)}</div>
        ${apptHtml}
      </div>
    `;
  }).join('');

  wrap.innerHTML = `<div class="schedule-grid">${grid}</div>`;
}

function renderActivityLog(reportRows) {
  const el = document.getElementById('activity-log');
  const dataRows = (reportRows || []).slice(1).filter(r => r && r[0]);

  if (dataRows.length === 0) {
    el.innerHTML = `<div class="log-entry"><div class="log-dot dim"></div><div><div class="log-msg">No audit runs yet</div><div class="log-time">Run the audit to see activity here</div></div></div>`;
    return;
  }

  const recent = [...dataRows].reverse().slice(0, 5);
  el.innerHTML = recent.map((row, i) => `
    <div class="log-entry">
      <div class="log-dot${i > 0 ? ' dim' : ''}"></div>
      <div>
        <div class="log-msg">✅ Weekly audit completed — Week of ${escHtml(row[0])}</div>
        <div class="log-time">AI report generated · Google Sheets updated</div>
      </div>
    </div>
  `).join('');
}

// ─── WEEKLY FOCUS ─────────────────────────────────────────────────────────────

function renderWeeklyFocus(reportRows, thisWeekPosts, followerRows) {
  const card = document.getElementById('focus-card');
  const content = document.getElementById('focus-content');
  const subtitle = document.getElementById('focus-subtitle');

  if (!card || thisWeekPosts.length === 0) return;

  // Top performing posts this week
  const sorted = [...thisWeekPosts].sort((a, b) => b.score - a.score);
  const top = sorted.slice(0, 3);
  const dead = sorted.filter(p => p.grade.includes('KILL') || p.grade.includes('RETIRE')).length;

  // Follower change
  let followerLine = '';
  const fdata = (followerRows || []).slice(1).filter(r => r && r[0])
    .map(r => ({ date: r[0], followers: parseInt(r[1]) || 0 }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (fdata.length >= 2) {
    const change = fdata[fdata.length - 1].followers - fdata[Math.max(0, fdata.length - 8)].followers;
    if (change !== 0) {
      followerLine = `<div class="focus-bullet"><div class="focus-bullet-icon">${change > 0 ? '📈' : '📉'}</div><div><strong>${change > 0 ? '+' : ''}${change.toLocaleString()} followers</strong> this week. ${change > 0 ? 'Momentum is building.' : 'Worth investigating which post style is leaking.'}</div></div>`;
    }
  }

  const bullets = [
    top.length > 0 ? `<div class="focus-bullet"><div class="focus-bullet-icon">🎯</div><div><strong>Top this week:</strong> "${escHtml(top[0].hook.substring(0, 80))}${top[0].hook.length > 80 ? '…' : ''}" — ${top[0].reach.toLocaleString()} reach, score ${top[0].score}. ${top[0].grade.includes('DOUBLE') ? 'Make 3 more in this exact format.' : 'Worth a follow-up post in this style.'}</div></div>` : '',
    followerLine,
    dead > 0 ? `<div class="focus-bullet"><div class="focus-bullet-icon">⚫</div><div><strong>${dead} posts</strong> graded RETIRE or KILL — review them in the table below and stop using those hook patterns.</div></div>` : '',
    `<div class="focus-bullet"><div class="focus-bullet-icon">📊</div><div><strong>This week:</strong> ${thisWeekPosts.length} posts, avg ${Math.round(thisWeekPosts.reduce((s, p) => s + p.reach, 0) / thisWeekPosts.length).toLocaleString()} reach. ${thisWeekPosts.length < 5 ? 'Consider posting more — cadence drives growth.' : 'Solid output. Focus on quality of top-performing patterns.'}</div></div>`,
  ].filter(Boolean).join('');

  content.innerHTML = bullets;
  subtitle.textContent = 'Auto-synthesized · refreshes with each audit';
  card.style.display = 'block';
}

// ─── ESCAPE HTML ─────────────────────────────────────────────────────────────

function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── TOKEN WARNING ───────────────────────────────────────────────────────────

function checkTokenExpiry() {
  const expiry = new Date(CFG.IG_TOKEN_EXPIRY);
  const daysLeft = Math.floor((expiry - new Date()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 14) {
    const banner = document.getElementById('token-warning');
    banner.style.display = 'block';
    banner.textContent = `⚠️ Your Instagram access token expires in ${daysLeft} days (${CFG.IG_TOKEN_EXPIRY}). Renew it to keep the audit running.`;
  }
}

// ─── SETUP CHECK ─────────────────────────────────────────────────────────────

function checkSetup() {
  if (API_KEY === 'YOUR_API_KEY_HERE') {
    document.getElementById('setup-overlay').style.display = 'flex';
    return false;
  }
  document.getElementById('setup-overlay').style.display = 'none';
  return true;
}

// ─── MAIN INIT ───────────────────────────────────────────────────────────────

async function init() {
  if (!checkSetup()) return;

  const refreshBtn = document.getElementById('refresh-btn');
  refreshBtn.classList.add('loading');

  const loading = document.getElementById('loading');
  const errorBanner = document.getElementById('error-banner');
  loading.style.display = 'flex';
  errorBanner.style.display = 'none';

  checkTokenExpiry();

  try {
    // Fetch all data in parallel — main audit sheet + finance sheet + business sheet
    const [postsRows, reportRows, scheduleRows, followerRows, incomeRows, expenseRows, leadRows] = await Promise.all([
      fetchRange(TAB_POSTS),
      fetchRange(TAB_REPORTS),
      fetchRange(TAB_SCHEDULE).catch(() => []),
      fetchRange(TAB_FOLLOWERS).catch(() => []),
      CFG.FINANCE_SHEET_ID  ? fetchFromSheet(CFG.FINANCE_SHEET_ID,  CFG.FINANCE_INCOME_TAB).catch(() => []) : [],
      CFG.FINANCE_SHEET_ID  ? fetchFromSheet(CFG.FINANCE_SHEET_ID,  CFG.FINANCE_EXPENSE_TAB).catch(() => []) : [],
      CFG.BUSINESS_SHEET_ID ? fetchFromSheet(CFG.BUSINESS_SHEET_ID, CFG.BUSINESS_LEADS_TAB).catch(() => []) : [],
    ]);

    // Parse posts (skip header row)
    const allPosts = (postsRows.slice(1) || [])
      .filter(r => r && r[COL.postId])
      .map(rowToPost);

    // Determine this week (most recent "Week Of" value in data)
    const weeks = [...new Set(allPosts.map(p => p.weekOf).filter(Boolean))]
      .sort((a, b) => parseWeekOf(a) - parseWeekOf(b));
    const latestWeek = weeks[weeks.length - 1];
    const thisWeekPosts = latestWeek
      ? allPosts.filter(p => p.weekOf === latestWeek)
      : allPosts.slice(-20); // fallback: last 20 posts

    // Render everything
    renderKPIs(thisWeekPosts);
    renderFollowers(followerRows);
    renderCadence(allPosts);
    renderRevenue(incomeRows);
    renderExpenses(expenseRows);
    renderLeads(thisWeekPosts, leadRows);
    renderTopPosts(thisWeekPosts);
    renderReachChart(allPosts);
    renderGradeChart(thisWeekPosts);
    renderPostsTable(thisWeekPosts);
    renderAIReport(reportRows);
    renderSchedule(scheduleRows);
    renderActivityLog(reportRows);
    renderWeeklyFocus(reportRows, thisWeekPosts, followerRows);

    // Update header
    document.getElementById('last-updated').textContent =
      'Last updated: ' + new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

    if (latestWeek) {
      document.getElementById('week-label').textContent = `Week of ${latestWeek}`;
    }

  } catch (err) {
    console.error(err);
    const msg = document.getElementById('error-message');
    errorBanner.style.display = 'flex';
    msg.textContent = `Could not load data: ${err.message}. Check your API key in config.js.`;
  } finally {
    loading.style.display = 'none';
    refreshBtn.classList.remove('loading');
  }
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refresh-btn').addEventListener('click', init);
  const closeBtn = document.getElementById('grade-panel-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      document.getElementById('grade-breakdown-panel').style.display = 'none';
    });
  }
  init();
});

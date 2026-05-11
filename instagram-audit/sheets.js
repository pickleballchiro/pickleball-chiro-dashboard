/**
 * sheets.js — Writes graded post data and weekly summary to Google Sheets.
 * Tab 1: "Weekly Posts"    — one row per post, never duplicated
 * Tab 2: "Weekly Summary"  — overwritten each Sunday
 * Tab 3: "AI Reports"      — appended each Sunday with the full AI report
 */

require('dotenv').config({ override: true });
const { google } = require('googleapis');
const { log, error, warn } = require('./utils/logger');
const { GRADE_COLORS } = require('./grade');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
const CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_PATH || './google-credentials.json';

const TAB_POSTS     = 'Weekly Posts';
const TAB_SUMMARY   = 'Weekly Summary';
const TAB_REPORTS   = 'AI Reports';
const TAB_SCHEDULE  = 'Schedule';
const TAB_FOLLOWERS = 'Followers';

// Column headers for Tab 1
const POST_HEADERS = [
  'Post ID', 'Week Of', 'Post Date', 'Day Posted', 'Type',
  'Pillar', 'Hook', 'CTA Keyword',
  'Reach', 'Views', 'Avg Watch (s)', 'Skip Rate %',
  'Saves', 'Shares', 'Reposts', 'Comments', 'Likes',
  'Profile Visits', 'Follows', 'Performance Score', 'Grade Label',
  'Score Breakdown'  // JSON blob with per-component scores
];

// Which column index (0-based) holds the Post ID — used for dedup
const POST_ID_COL = 0;
// Which column holds the Grade Label — used for color coding
const GRADE_COL_INDEX = 20; // column U (0-based = 20)

/**
 * Authenticate with Google using service account credentials
 */
async function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return auth.getClient();
}

/**
 * Get or create a sheet tab by name. Returns the sheetId (numeric).
 */
async function getOrCreateSheet(sheets, tabName) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existing = meta.data.sheets.find(s => s.properties.title === tabName);
  if (existing) return existing.properties.sheetId;

  // Create it
  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    resource: {
      requests: [{
        addSheet: {
          properties: { title: tabName }
        }
      }]
    }
  });
  const added = response.data.replies[0].addSheet;
  log(`Created new tab: "${tabName}"`);
  return added.properties.sheetId;
}

/**
 * Reads all values from a tab
 */
async function readTab(sheets, tabName) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${tabName}'`
    });
    return response.data.values || [];
  } catch {
    return [];
  }
}

/**
 * Converts a 0-based column index to A1 notation letter(s)
 */
function colLetter(index) {
  let letter = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

/**
 * Builds a row array from a graded post object
 */
function buildPostRow(post, weekOf) {
  return [
    post.id,
    weekOf,
    post.postDate,
    post.dayOfWeek,
    post.mediaType,
    post.pillar,
    post.hook,
    post.ctaKeyword,
    post.reach,
    post.videoViews,
    post.avgWatchTime != null ? post.avgWatchTime : 'N/A',
    post.skipRate != null ? post.skipRate : 'N/A',
    post.saves,
    post.shares,
    post.reposts,
    post.comments,
    post.likes,
    post.profileVisits != null ? post.profileVisits : 'N/A',
    post.follows != null ? post.follows : 'N/A',
    post.performanceScore,
    post.gradeLabel,
    post._scores ? JSON.stringify(post._scores) : ''
  ];
}

/**
 * Applies background color to the Grade Label cell for a given row
 */
async function colorGradeCell(sheets, sheetId, rowIndex, color) {
  const rgb = GRADE_COLORS[color];
  if (!rgb) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    resource: {
      requests: [{
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: rowIndex,
            endRowIndex: rowIndex + 1,
            startColumnIndex: GRADE_COL_INDEX,
            endColumnIndex: GRADE_COL_INDEX + 1
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: rgb,
              textFormat: {
                bold: true,
                foregroundColor: color === 'DARK_GRAY'
                  ? { red: 1, green: 1, blue: 1 }
                  : { red: 0, green: 0, blue: 0 }
              }
            }
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)'
        }
      }]
    }
  });
}

/**
 * Writes/updates the Weekly Posts tab.
 * - Adds header row if missing
 * - Updates existing rows by Post ID
 * - Appends new rows
 * Returns { added, updated } counts
 */
async function writePostsTab(sheets, gradedPosts, weekOf) {
  const sheetId = await getOrCreateSheet(sheets, TAB_POSTS);
  const existing = await readTab(sheets, TAB_POSTS);

  let added = 0;
  let updated = 0;

  // Ensure header row
  if (existing.length === 0 || existing[0][0] !== 'Post ID') {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${TAB_POSTS}'!A1`,
      valueInputOption: 'RAW',
      resource: { values: [POST_HEADERS] }
    });
    existing.unshift(POST_HEADERS);
    await colorHeaderRow(sheets, sheetId);
    log('Added header row to Weekly Posts tab');
  }

  // Build lookup: postId → row index (1-based for Sheets, 0-based here)
  const idToRow = {};
  for (let i = 1; i < existing.length; i++) {
    if (existing[i] && existing[i][POST_ID_COL]) {
      idToRow[existing[i][POST_ID_COL]] = i;
    }
  }

  for (const post of gradedPosts) {
    const row = buildPostRow(post, weekOf);
    const existingRowIndex = idToRow[post.id];

    if (existingRowIndex !== undefined) {
      // Update existing row
      const sheetsRowNum = existingRowIndex + 1; // Sheets is 1-indexed
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `'${TAB_POSTS}'!A${sheetsRowNum}`,
        valueInputOption: 'RAW',
        resource: { values: [row] }
      });
      await colorGradeCell(sheets, sheetId, existingRowIndex, post.gradeColor);
      updated++;
      log(`Updated row for post ${post.id} (score: ${post.performanceScore})`);
    } else {
      // Append new row
      const appendResponse = await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `'${TAB_POSTS}'!A1`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: [row] }
      });

      // Get the row index of the appended row for coloring
      const updatedRange = appendResponse.data.updates?.updatedRange || '';
      const rowMatch = updatedRange.match(/(\d+)$/);
      if (rowMatch) {
        const newRowIndex = parseInt(rowMatch[1]) - 1; // convert to 0-based
        await colorGradeCell(sheets, sheetId, newRowIndex, post.gradeColor);
      }
      added++;
      log(`Added new row for post ${post.id} (score: ${post.performanceScore})`);
    }

    await sleep(2500); // 2 API calls per row × 24 rows/min = ~48 calls/min, under quota
  }

  return { added, updated };
}

/**
 * Applies bold formatting and background to the header row
 */
async function colorHeaderRow(sheets, sheetId) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    resource: {
      requests: [{
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: POST_HEADERS.length
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.204, green: 0.396, blue: 0.647 }, // #346FA5
              textFormat: {
                bold: true,
                foregroundColor: { red: 1, green: 1, blue: 1 }
              }
            }
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)'
        }
      }, {
        updateSheetProperties: {
          properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
          fields: 'gridProperties.frozenRowCount'
        }
      }]
    }
  });
}

/**
 * Computes the weekly summary object from graded posts
 */
function buildWeeklySummary(gradedPosts, weekOf, priorWeekData) {
  const reels = gradedPosts.filter(p => p.mediaType === 'Reel');
  const avgReach = gradedPosts.length
    ? Math.round(gradedPosts.reduce((s, p) => s + p.reach, 0) / gradedPosts.length)
    : 0;
  const avgCompletion = reels.length
    ? Math.round(reels.reduce((s, p) => s + (p.completionRate || 0), 0) / reels.length)
    : null;

  // Best pillar by average score
  const pillarScores = {};
  const pillarCounts = {};
  for (const p of gradedPosts) {
    pillarScores[p.pillar] = (pillarScores[p.pillar] || 0) + p.performanceScore;
    pillarCounts[p.pillar] = (pillarCounts[p.pillar] || 0) + 1;
  }
  let bestPillar = 'N/A';
  let bestPillarAvg = 0;
  for (const [pillar, total] of Object.entries(pillarScores)) {
    const avg = total / pillarCounts[pillar];
    if (avg > bestPillarAvg) { bestPillarAvg = avg; bestPillar = pillar; }
  }

  // Top 3 and worst post
  const sorted = [...gradedPosts].sort((a, b) => b.performanceScore - a.performanceScore);
  const top3 = sorted.slice(0, 3);
  const worst = sorted[sorted.length - 1];

  // CTA keyword usage
  const ctaUsage = {};
  for (const p of gradedPosts) {
    if (p.ctaKeyword) {
      ctaUsage[p.ctaKeyword] = (ctaUsage[p.ctaKeyword] || 0) + 1;
    }
  }

  // Hook pattern analysis for top posts
  const topHooks = top3.map(p => p.hook).filter(Boolean);
  const hookPatterns = analyzeHookPatterns(topHooks);

  return {
    weekOf,
    dateRange: `${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString()} – ${new Date().toLocaleDateString()}`,
    totalPosts: gradedPosts.length,
    avgReach,
    priorWeekAvgReach: priorWeekData?.avgReach || 'N/A',
    avgCompletionRate: avgCompletion,
    priorWeekAvgCompletion: priorWeekData?.avgCompletion || 'N/A',
    bestPillar,
    bestPillarAvgScore: Math.round(bestPillarAvg),
    top3,
    worstPost: worst,
    ctaUsage,
    hookPatterns
  };
}

/**
 * Basic hook pattern detection — looks for question marks, numbers, call-outs, etc.
 */
function analyzeHookPatterns(hooks) {
  const patterns = [];
  const questionHooks = hooks.filter(h => h.includes('?'));
  const numberHooks = hooks.filter(h => /\d/.test(h));
  const youHooks = hooks.filter(h => /\byou\b/i.test(h));
  const ifHooks = hooks.filter(h => /\bif\b/i.test(h));

  if (questionHooks.length) patterns.push(`Question hook (${questionHooks.length}x)`);
  if (numberHooks.length) patterns.push(`Number/stat hook (${numberHooks.length}x)`);
  if (youHooks.length) patterns.push(`Direct "you" call-out (${youHooks.length}x)`);
  if (ifHooks.length) patterns.push(`Conditional "if" hook (${ifHooks.length}x)`);
  if (!patterns.length) patterns.push('Mixed/unclassified patterns');

  return patterns.join(' | ');
}

/**
 * Writes the Weekly Summary tab (overwrites every run)
 */
async function writeSummaryTab(sheets, gradedPosts, weekOf, priorWeekData) {
  await getOrCreateSheet(sheets, TAB_SUMMARY);
  const summary = buildWeeklySummary(gradedPosts, weekOf, priorWeekData);

  const ctaLines = Object.entries(summary.ctaUsage).length
    ? Object.entries(summary.ctaUsage).map(([k, v]) => `  ${k}: ${v}x`).join('\n')
    : '  None used this week';

  const top3Lines = summary.top3.map((p, i) =>
    `  #${i + 1}: [${p.gradeLabel}] Score ${p.performanceScore} — "${p.hook}"`
  ).join('\n');

  const worstLine = summary.worstPost
    ? `  [${summary.worstPost.gradeLabel}] Score ${summary.worstPost.performanceScore} — "${summary.worstPost.hook}"`
    : '  N/A';

  const rows = [
    ['WEEKLY CONTENT SUMMARY', ''],
    ['Generated', new Date().toLocaleString()],
    ['', ''],
    ['Date Range', summary.dateRange],
    ['Total Posts This Week', summary.totalPosts],
    ['Avg Reach Per Post', summary.avgReach],
    ['Prior Week Avg Reach', summary.priorWeekAvgReach],
    ['Avg Completion Rate (Reels)', summary.avgCompletionRate != null ? `${summary.avgCompletionRate}%` : 'N/A'],
    ['Prior Week Avg Completion', summary.priorWeekAvgCompletion !== 'N/A' ? `${summary.priorWeekAvgCompletion}%` : 'N/A'],
    ['', ''],
    ['Best Performing Pillar', `${summary.bestPillar} (avg score: ${summary.bestPillarAvgScore})`],
    ['', ''],
    ['TOP 3 POSTS', ''],
    ...summary.top3.map((p, i) => [
      `#${i + 1} — ${p.gradeLabel} (Score: ${p.performanceScore})`,
      `"${p.hook}" | ${p.mediaType} | ${p.pillar}`
    ]),
    ['', ''],
    ['WORST PERFORMING POST', ''],
    [summary.worstPost?.gradeLabel || '', `"${summary.worstPost?.hook || ''}" | Score: ${summary.worstPost?.performanceScore || ''}`],
    ['', ''],
    ['CTA KEYWORDS USED', ''],
    ...Object.entries(summary.ctaUsage).map(([k, v]) => [k, `${v}x`]),
    ...(Object.keys(summary.ctaUsage).length === 0 ? [['None used this week', '']] : []),
    ['', ''],
    ['HOOK PATTERN ANALYSIS', summary.hookPatterns]
  ];

  // Clear and rewrite
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: `'${TAB_SUMMARY}'`
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${TAB_SUMMARY}'!A1`,
    valueInputOption: 'RAW',
    resource: { values: rows }
  });

  log('Weekly Summary tab updated');
  return summary;
}

/**
 * Appends the AI report to Tab 3: "AI Reports"
 */
async function writeReportTab(sheets, weekOf, reportText) {
  const sheetId = await getOrCreateSheet(sheets, TAB_REPORTS);
  const existing = await readTab(sheets, TAB_REPORTS);

  // Add header if needed
  if (existing.length === 0 || existing[0][0] !== 'Week Of') {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${TAB_REPORTS}'!A1`,
      valueInputOption: 'RAW',
      resource: { values: [['Week Of', 'AI Strategy Report']] }
    });
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      resource: {
        requests: [{
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 2 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.204, green: 0.396, blue: 0.647 },
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)'
          }
        }]
      }
    });
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `'${TAB_REPORTS}'!A1`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: { values: [[weekOf, reportText]] }
  });

  log('AI Report appended to AI Reports tab');
}

/**
 * Main entry point — writes all three tabs to Google Sheets
 */
async function writeToSheets(gradedPosts, weekOf, reportText, priorWeekData) {
  if (!SHEET_ID) {
    throw new Error(
      'Missing GOOGLE_SHEET_ID in .env file. ' +
      'Please follow Step C5 in SETUP-GUIDE.md.'
    );
  }

  log('Connecting to Google Sheets...');
  const authClient = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  // Tab 1: Posts
  log('Writing Weekly Posts tab...');
  const { added, updated } = await writePostsTab(sheets, gradedPosts, weekOf);

  // Tab 2: Summary
  log('Writing Weekly Summary tab...');
  const summary = await writeSummaryTab(sheets, gradedPosts, weekOf, priorWeekData);

  // Tab 3: AI Reports
  if (reportText) {
    log('Writing AI Report tab...');
    await writeReportTab(sheets, weekOf, reportText);
  }

  log(`Google Sheets update complete — ${added} rows added, ${updated} rows updated`);
  return { added, updated, summary };
}

/**
 * Ensures the Schedule tab exists with correct headers.
 * Safe to call multiple times — won't overwrite existing data.
 */
async function ensureScheduleTab() {
  if (!SHEET_ID) return;
  const authClient = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  const sheetId = await getOrCreateSheet(sheets, TAB_SCHEDULE);

  const existing = await readTab(sheets, TAB_SCHEDULE);
  if (existing.length === 0 || existing[0][0] !== 'Date') {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${TAB_SCHEDULE}'!A1`,
      valueInputOption: 'RAW',
      resource: { values: [['Date', 'Time', 'Client/Task', 'Type', 'Notes']] }
    });
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      resource: {
        requests: [{
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 5 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.204, green: 0.396, blue: 0.647 },
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)'
          }
        }]
      }
    });
    log(`Created "${TAB_SCHEDULE}" tab`);
  }
}

/**
 * Appends a single schedule entry to the Schedule tab.
 * date: 'YYYY-MM-DD' or 'MM/DD/YYYY'
 * time: '3:00 PM'
 * task: 'Lesson with Mike'
 * type: 'Lesson' | 'Appointment' | 'Admin' | etc.
 * notes: optional string
 */
async function addScheduleEntry({ date, time, task, type = '', notes = '' }) {
  if (!SHEET_ID) throw new Error('Missing GOOGLE_SHEET_ID');
  await ensureScheduleTab();

  const authClient = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `'${TAB_SCHEDULE}'!A1`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: { values: [[date, time, task, type, notes]] }
  });

  log(`Schedule entry added: ${date} ${time} — ${task}`);
}

/**
 * Appends a follower snapshot to the Followers tab.
 * If a row for today already exists, updates it instead of appending.
 * stats = { date, timestamp, followers, mediaCount, username }
 */
async function writeFollowerSnapshot(stats) {
  if (!SHEET_ID) throw new Error('Missing GOOGLE_SHEET_ID');

  const authClient = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  const sheetId = await getOrCreateSheet(sheets, TAB_FOLLOWERS);
  const existing = await readTab(sheets, TAB_FOLLOWERS);

  // Ensure header
  if (existing.length === 0 || existing[0][0] !== 'Date') {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${TAB_FOLLOWERS}'!A1`,
      valueInputOption: 'RAW',
      resource: { values: [['Date', 'Followers', 'Media Count', 'Timestamp']] }
    });
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      resource: {
        requests: [{
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 4 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.204, green: 0.396, blue: 0.647 },
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)'
          }
        }, {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount'
          }
        }]
      }
    });
    existing.unshift(['Date', 'Followers', 'Media Count', 'Timestamp']);
  }

  // Check if today's row exists
  let todayRowIdx = -1;
  for (let i = 1; i < existing.length; i++) {
    if (existing[i] && existing[i][0] === stats.date) { todayRowIdx = i; break; }
  }

  const row = [stats.date, stats.followers, stats.mediaCount, stats.timestamp];

  if (todayRowIdx >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${TAB_FOLLOWERS}'!A${todayRowIdx + 1}`,
      valueInputOption: 'RAW',
      resource: { values: [row] }
    });
    log(`Updated follower snapshot for ${stats.date}: ${stats.followers}`);
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `'${TAB_FOLLOWERS}'!A1`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [row] }
    });
    log(`Added follower snapshot for ${stats.date}: ${stats.followers}`);
  }
}

module.exports = { writeToSheets, buildWeeklySummary, ensureScheduleTab, addScheduleEntry, writeFollowerSnapshot };

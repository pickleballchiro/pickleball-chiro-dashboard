/**
 * scheduler.js — Runs the full audit pipeline every Sunday at 7:00 AM Eastern.
 * Keep this running with: node scheduler.js
 * Or use PM2 for background execution (see SETUP-GUIDE.md Part G).
 */

require('dotenv').config({ override: true });
const cron = require('node-cron');
const { fetchWeeklyPosts }      = require('./fetch');
const { gradeAllPosts }         = require('./grade');
const { writeToSheets, buildWeeklySummary } = require('./sheets');
const { generateAndSaveReport } = require('./report');
const { log, error, warn, runSummary } = require('./utils/logger');

// Cron expression: 0 7 * * 0 = 7:00 AM every Sunday
// node-cron uses system time — to run at 7 AM Eastern, your Mac's timezone must be set to Eastern,
// OR adjust the hour below (e.g., 12 for UTC if your Mac is set to UTC)
const CRON_SCHEDULE = '0 7 * * 0';

async function runScheduledAudit() {
  const now = new Date();
  const weekOf = now.toLocaleDateString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric'
  });

  log(`\n${'='.repeat(60)}`);
  log(`SCHEDULED AUDIT TRIGGERED — Sunday ${now.toLocaleString()}`);
  log(`${'='.repeat(60)}\n`);

  let postsAdded = 0;
  let postsUpdated = 0;
  let errorCount = 0;

  try {
    // Step 1 — Fetch
    log('STEP 1/4 — Fetching posts from Instagram...');
    const rawPosts = await fetchWeeklyPosts();

    if (!rawPosts || rawPosts.length === 0) {
      warn('No posts found for the past 7 days. Run complete.');
      runSummary({ postsAdded: 0, postsUpdated: 0, errors: 0 });
      return;
    }

    // Step 2 — Grade
    log('STEP 2/4 — Grading posts...');
    const { graded } = gradeAllPosts(rawPosts);

    // Step 3 — AI Report
    log('STEP 3/4 — Generating AI report...');
    const tempSummary = buildWeeklySummary(graded, weekOf, null);
    const { reportText, filepath } = await generateAndSaveReport(graded, tempSummary);

    // Step 4 — Google Sheets
    log('STEP 4/4 — Writing to Google Sheets...');
    const sheetsResult = await writeToSheets(graded, weekOf, reportText, null);
    postsAdded   = sheetsResult.added;
    postsUpdated = sheetsResult.updated;

    runSummary({ postsAdded, postsUpdated, errors: 0 });

    // Console notification
    console.log('\n✅ SUNDAY AUDIT COMPLETE');
    console.log(`   Week of          : ${weekOf}`);
    console.log(`   Posts processed  : ${graded.length}`);
    console.log(`   Rows added       : ${postsAdded}`);
    console.log(`   Rows updated     : ${postsUpdated}`);
    if (filepath) console.log(`   Report saved     : ${filepath}`);
    console.log('   Check your Google Sheet for full results.\n');

  } catch (err) {
    errorCount++;
    error('Scheduled audit failed', err);
    runSummary({ postsAdded, postsUpdated, errors: errorCount });

    console.log('\n❌ SCHEDULED AUDIT FAILED');
    console.log(`   Error: ${err.message}`);
    console.log('   Check logs/audit-log.txt for details.\n');
  }
}

// ── Start the scheduler ──────────────────────────────────────────────────────

log('Scheduler started. Waiting for Sunday 7:00 AM...');
log(`Current time: ${new Date().toLocaleString()}`);
log('To run immediately instead, use: node run-now.js');

// Validate cron expression
if (!cron.validate(CRON_SCHEDULE)) {
  error('Invalid cron schedule expression. Check CRON_SCHEDULE in scheduler.js');
  process.exit(1);
}

cron.schedule(CRON_SCHEDULE, () => {
  runScheduledAudit();
}, {
  scheduled: true,
  timezone: 'America/New_York'  // Eastern Time
});

// Heartbeat — logs every hour so you know the process is still alive
cron.schedule('0 * * * *', () => {
  const next = getNextSundayDescription();
  log(`Scheduler heartbeat — still running. Next audit: ${next}`);
}, {
  scheduled: true,
  timezone: 'America/New_York'
});

function getNextSundayDescription() {
  const now = new Date();
  const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilSunday);
  next.setHours(7, 0, 0, 0);
  return next.toLocaleString('en-US', { timeZone: 'America/New_York' });
}

// Keep the process alive
console.log('\n' + '='.repeat(60));
console.log('  PICKLEBALL CHIRO AUDIT SCHEDULER — RUNNING');
console.log(`  Current time : ${new Date().toLocaleString()}`);
console.log(`  Next run     : Sunday 7:00 AM Eastern`);
console.log(`  Timezone     : America/New_York`);
console.log('  To stop      : Ctrl+C');
console.log('  To run now   : node run-now.js (in a new terminal)');
console.log('='.repeat(60) + '\n');

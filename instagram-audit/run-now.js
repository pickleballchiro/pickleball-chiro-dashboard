/**
 * run-now.js — Manually triggers the full audit pipeline immediately.
 * Usage: node run-now.js
 */

require('dotenv').config({ override: true });
const { fetchWeeklyPosts, fetchAccountStats } = require('./fetch');
const { gradeAllPosts }                       = require('./grade');
const { writeToSheets, writeFollowerSnapshot } = require('./sheets');
const { generateAndSaveReport } = require('./report');
const { getBusinessContext }    = require('./business-context');
const { log, error, warn, runSummary } = require('./utils/logger');

async function runPipeline() {
  const startTime = Date.now();
  const weekOf = new Date().toLocaleDateString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric'
  });

  console.log('\n' + '='.repeat(70));
  console.log('  PICKLEBALL CHIRO — INSTAGRAM CONTENT AUDIT');
  console.log(`  Running for week of: ${weekOf}`);
  console.log('='.repeat(70) + '\n');

  let postsAdded = 0;
  let postsUpdated = 0;
  let errorCount = 0;

  try {
    // ── STEP 0: Snapshot account stats (follower count) ─────────────────
    log('STEP 0/4 — Snapshotting account stats (followers, media count)...');
    try {
      const stats = await fetchAccountStats();
      log(`Account: @${stats.username} — ${stats.followers} followers, ${stats.mediaCount} posts`);
      await writeFollowerSnapshot(stats);
    } catch (statsErr) {
      warn(`Could not snapshot follower count: ${statsErr.message} (continuing anyway)`);
    }

    // ── STEP 1: Fetch posts from Instagram ──────────────────────────────
    log('STEP 1/4 — Fetching posts from Instagram Graph API...');
    const rawPosts = await fetchWeeklyPosts();

    if (!rawPosts || rawPosts.length === 0) {
      warn('No posts found for the past 7 days. The pipeline will complete without data.');
      runSummary({ postsAdded: 0, postsUpdated: 0, errors: 0 });
      return;
    }
    log(`Fetched ${rawPosts.length} posts`);

    // ── STEP 2: Grade all posts ──────────────────────────────────────────
    log('\nSTEP 2/4 — Grading posts...');
    const { graded, avgReach, avgProfileVisits } = gradeAllPosts(rawPosts);
    log(`Graded ${graded.length} posts`);

    // Print a quick score table to the console
    console.log('\n  POST SCORES:');
    for (const p of [...graded].sort((a, b) => b.performanceScore - a.performanceScore)) {
      const bar = '█'.repeat(Math.round(p.performanceScore / 5));
      console.log(`  ${String(p.performanceScore).padStart(3)} ${bar.padEnd(20)} ${p.gradeLabel} | "${p.hook.substring(0, 55)}"`);
    }
    console.log('');

    // ── STEP 3: Generate AI Report ───────────────────────────────────────
    log('STEP 3/4 — Generating AI weekly strategy report...');
    // We need summary before the report, so build it here
    const { buildWeeklySummary } = require('./sheets');
    const tempSummary = buildWeeklySummary(graded, weekOf, null);
    // Pull business context (revenue, expenses, leads, follower delta) for the prompt
    let businessContext = null;
    try { businessContext = await getBusinessContext(); }
    catch (bErr) { warn(`Business context fetch failed (continuing): ${bErr.message}`); }
    const { reportText, filepath } = await generateAndSaveReport(graded, tempSummary, businessContext);
    if (filepath) {
      log(`Report saved: ${filepath}`);
    }

    // ── STEP 4: Write to Google Sheets ───────────────────────────────────
    log('STEP 4/4 — Writing data to Google Sheets...');
    const sheetsResult = await writeToSheets(graded, weekOf, reportText, null);
    postsAdded   = sheetsResult.added;
    postsUpdated = sheetsResult.updated;

    // ── DONE ─────────────────────────────────────────────────────────────
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    runSummary({ postsAdded, postsUpdated, errors: errorCount });

    console.log('\n✅ AUDIT COMPLETE');
    console.log(`   Posts processed : ${graded.length}`);
    console.log(`   Rows added       : ${postsAdded}`);
    console.log(`   Rows updated     : ${postsUpdated}`);
    console.log(`   Time elapsed     : ${elapsed}s`);
    if (filepath) {
      console.log(`   Report file      : ${filepath}`);
    }
    console.log('   Check your Google Sheet for the full results.\n');

  } catch (err) {
    errorCount++;
    error('Pipeline failed', err);

    console.log('\n❌ PIPELINE FAILED');
    console.log(`   Error: ${err.message}`);
    console.log('   Check logs/audit-log.txt for details.');
    console.log('   If the error mentions "token expired," see Step B4 in SETUP-GUIDE.md.\n');

    runSummary({ postsAdded, postsUpdated, errors: errorCount });
    process.exit(1);
  }
}

// Run immediately
runPipeline();

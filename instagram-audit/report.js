/**
 * report.js — Calls the Claude API to generate the weekly content strategy brief.
 * Saves the report as a .txt file and returns the text for Google Sheets.
 */

require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { log, error, warn } = require('./utils/logger');

const REPORTS_DIR = path.join(__dirname, 'reports');

const SYSTEM_PROMPT = `You are the content strategist for @dr.lane_o, the Pickleball Chiro brand.

Lane is a 5.0 DUPR competitive pickleball player and licensed chiropractor (DC) targeting serious recreational players aged 45–65 who fear being forced off the court by injury. His audience is "Dave" — a 52-year-old who plays 4x per week, has dealt with knee or shoulder issues, and is terrified of slowing down or losing his edge.

Lane's four content pillars:
1. Pain & Injury — speaks directly to Dave's fear of injury ending his game
2. Performance & Technique — validates Dave's competitive identity
3. Recovery & Longevity — positions Lane as the answer to staying on the court long-term
4. Credibility & Story — builds trust through Lane's unique dual identity (5.0 player + DC)

Lane's ManyChat trigger keywords (currently active): KNEE, FREE
Planned future keywords: ELBOW, SHOULDER, RECOVERY, DROP

Primary metric priorities (in order of importance):
1. Reach — especially non-follower reach (signals algorithm push)
2. Completion rate — hooks must hold attention
3. Shares — strongest signal of resonance and virality
4. Saves — signals "bookmark for later" value
5. Profile visits — signals hook-to-brand curiosity
6. Likes — vanity metric, deprioritize

Core content philosophy:
- The goal of every piece of content is to OPEN A LOOP, not close it
- Content should MIRROR (validate Dave's experience), VALIDATE (confirm it's real), and TEASE (hint at the mechanism) — never fully explain
- Hooks are everything. A bad hook on great content kills the post
- Lane should sound like a competitive peer who happens to be a DC — not a clinical expert lecturing
- Avoid generic advice. Speak directly to the pickleball player who plays tournaments, tracks their DUPR, and thinks about their body mostly when something hurts

When writing your analysis, be direct, specific, and strategic. No filler. Act like you reviewed the data yourself.`;

/**
 * Formats the post data into a compact string for the AI prompt
 */
function formatPostsForPrompt(gradedPosts, summary) {
  const lines = [];

  lines.push('=== WEEK DATA ===');
  lines.push(`Date Range: ${summary.dateRange}`);
  lines.push(`Total Posts: ${summary.totalPosts}`);
  lines.push(`Avg Reach: ${summary.avgReach} | Avg Completion (Reels): ${summary.avgCompletionRate != null ? summary.avgCompletionRate + '%' : 'N/A'}`);
  lines.push(`Best Pillar: ${summary.bestPillar} (avg score: ${summary.bestPillarAvgScore})`);
  lines.push('');

  lines.push('=== ALL POSTS (sorted by score, high to low) ===');
  const sorted = [...gradedPosts].sort((a, b) => b.performanceScore - a.performanceScore);

  for (const p of sorted) {
    lines.push(`[${p.gradeLabel}] Score: ${p.performanceScore}/100`);
    lines.push(`  Hook: "${p.hook}"`);
    lines.push(`  Type: ${p.mediaType} | Pillar: ${p.pillar} | Day: ${p.dayOfWeek}`);
    lines.push(`  Reach: ${p.reach} | Completion: ${p.completionRate != null ? p.completionRate + '%' : 'N/A'} | Saves: ${p.saves} | Shares: ${p.shares} | Profile Visits: ${p.profileVisits}`);
    if (p.ctaKeyword) lines.push(`  CTA Keyword: ${p.ctaKeyword}`);
    lines.push('');
  }

  lines.push('=== CTA KEYWORD USAGE ===');
  if (Object.keys(summary.ctaUsage).length) {
    for (const [kw, count] of Object.entries(summary.ctaUsage)) {
      lines.push(`  ${kw}: ${count}x`);
    }
  } else {
    lines.push('  No CTA keywords used this week');
  }

  lines.push('');
  lines.push('=== TOP HOOK PATTERNS ===');
  lines.push(summary.hookPatterns);

  return lines.join('\n');
}

/**
 * Generates the weekly AI strategy report
 */
async function generateReport(gradedPosts, summary, businessContext = null) {
  if (!process.env.ANTHROPIC_API_KEY) {
    warn('ANTHROPIC_API_KEY not set in .env — skipping AI report generation');
    return null;
  }

  log('Generating AI weekly report...');

  const client = new Anthropic();
  const dataString = formatPostsForPrompt(gradedPosts, summary);

  let businessSection = '';
  if (businessContext) {
    businessSection = `

=== BUSINESS CONTEXT (week + month-to-date) ===
Revenue this week:    $${(businessContext.revenueWeek || 0).toLocaleString()}
Revenue MTD:          $${(businessContext.revenueMonth || 0).toLocaleString()}
Revenue YTD:          $${(businessContext.revenueYTD || 0).toLocaleString()}
Expenses this week:   $${(businessContext.expenseWeek || 0).toLocaleString()}
Expenses MTD:         $${(businessContext.expenseMonth || 0).toLocaleString()}
Net YTD:              $${((businessContext.revenueYTD || 0) - (businessContext.expenseYTD || 0)).toLocaleString()}
New leads this week:  ${businessContext.newLeadsWeek || 0}
Leads in pipeline:    ${businessContext.totalLeads || 0}
Follower change 7d:   ${businessContext.follower7dDelta != null ? (businessContext.follower7dDelta >= 0 ? '+' : '') + businessContext.follower7dDelta : 'no data yet'}
`;
  }

  const userPrompt = `Here is the Instagram performance data for @dr.lane_o for the week of ${summary.weekOf}:

${dataString}${businessSection}

Please write the weekly Sunday content brief. Structure it exactly as follows:

## WHAT WORKED THIS WEEK (AND WHY)
Analyze each post that scored 🟢 DOUBLE DOWN or 🟡 MODIFY. What hook patterns drove reach and completion? What does this tell you about what Dave is thinking about right now?

## WHAT FAILED AND THE DIAGNOSED REASON
For each 🔴 RETIRE or ⚫ KILL IT post: was it the hook, the pillar, the format, or the CTA? Be specific — don't just say "weak hook," explain what made it weak and why Dave scrolled past.

## CONTENT TO DOUBLE DOWN ON THIS WEEK
Specific angles, hook styles, and pillars to push more of this week. Reference actual hooks from the data where relevant.

## CONTENT TO RETIRE
Specific angles, topics, or formats to stop using based on this week's data.

## 3 HOOK IDEAS FOR NEXT WEEK
Write three ready-to-use hooks in Lane's voice — casual, competitive-peer tone, not clinical. Each should be directly informed by what the data says is resonating. Include the content pillar and recommended format (Reel or Carousel) for each.

## PILLAR RECOMMENDATION FOR THE WEEK
Which pillar should get the most posts this week and why? Base this on what's breaking through, not just what Lane wants to create.

## EXPERIMENT OF THE WEEK
One specific new angle or hook style to trial as a test this week. Include why you're recommending it and what success would look like.

## BUSINESS HEALTH CHECK
Reference the business context above (revenue, expenses, leads, follower delta). What does this week's combined picture tell us? Is content output translating to leads? Are leads converting to revenue? Call out one concrete business concern AND one win — skip this section only if no business data was provided.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }]
  });

  const reportText = response.content[0].text;
  log('AI report generated successfully');
  return reportText;
}

/**
 * Saves the report to a .txt file in the reports/ directory
 */
function saveReportFile(reportText, weekOf) {
  if (!reportText) return null;

  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `weekly-report-${dateStr}.txt`;
  const filepath = path.join(REPORTS_DIR, filename);

  const fullReport = [
    `PICKLEBALL CHIRO — WEEKLY CONTENT AUDIT REPORT`,
    `Week of: ${weekOf}`,
    `Generated: ${new Date().toLocaleString()}`,
    `Account: @dr.lane_o`,
    '='.repeat(60),
    '',
    reportText
  ].join('\n');

  fs.writeFileSync(filepath, fullReport, 'utf8');
  log(`Report saved to: ${filepath}`);
  return filepath;
}

/**
 * Main export — generates and saves the report
 */
async function generateAndSaveReport(gradedPosts, summary, businessContext = null) {
  try {
    const reportText = await generateReport(gradedPosts, summary, businessContext);
    const filepath = saveReportFile(reportText, summary.weekOf);
    return { reportText, filepath };
  } catch (err) {
    error('Failed to generate AI report', err);
    return { reportText: null, filepath: null };
  }
}

module.exports = { generateAndSaveReport };

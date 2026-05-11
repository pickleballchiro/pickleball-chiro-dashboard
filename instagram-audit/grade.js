/**
 * grade.js — Scores each post 0–100 and assigns a grade label.
 *
 * REEL formula (100 pts):
 *   Reach        30 — tiered scale, no hard cap, rewards viral
 *   Skip Rate    20 — hook quality; lower = better
 *   Shares+Repost 20 — viral amplifier; most important engagement action
 *   Saves        15 — high purchase intent signal
 *   Watch Time   10 — retention; algorithm signal
 *   Comments      5 — engagement depth
 *
 * CAROUSEL / IMAGE formula (100 pts):
 *   Reach        30 — same tiered scale
 *   Saves        25 — primary signal; people save to re-read
 *   Shares+Repost 20 — viral amplifier
 *   Comments     10 — engagement depth
 *   Profile Visits 8 — purchase intent
 *   Follows       4 — conversion signal
 *   Likes         3 — softest signal
 *
 * Grade thresholds (recalibrated 2026-05-10 to celebrate viral posts):
 *   65+ = 🟢 DOUBLE DOWN — make more exactly like this
 *   45–64 = 🟡 MODIFY   — good concept, tweak hook or format
 *   25–44 = 🔴 RETIRE   — concept not landing, don't repeat
 *   0–24  = ⚫ KILL IT  — stop immediately
 */

const { log } = require('./utils/logger');

const GRADES = [
  { min: 65, label: '🟢 DOUBLE DOWN', color: 'GREEN' },
  { min: 45, label: '🟡 MODIFY',      color: 'YELLOW' },
  { min: 25, label: '🔴 RETIRE',      color: 'RED' },
  { min: 0,  label: '⚫ KILL IT',     color: 'DARK_GRAY' }
];

const GRADE_COLORS = {
  GREEN:     { red: 0.204, green: 0.659, blue: 0.325 },
  YELLOW:    { red: 1.0,   green: 0.753, blue: 0.0   },
  RED:       { red: 0.918, green: 0.263, blue: 0.208 },
  DARK_GRAY: { red: 0.263, green: 0.263, blue: 0.263 }
};

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// ─── Component scorers ───────────────────────────────────────────────────────

/**
 * Reach (30 pts) — tiered scale relative to account average, no hard cap.
 * Rewards viral scale properly.
 */
function scoreReach(reach, avgReach) {
  if (!avgReach || avgReach === 0) return 0;
  const ratio = reach / avgReach;
  if (ratio >= 20) return 30;
  if (ratio >= 10) return 25;
  if (ratio >= 5)  return 20;
  if (ratio >= 3)  return 16;
  if (ratio >= 2)  return 13;
  if (ratio >= 1)  return 10;
  return Math.round(ratio * 10); // below average: 0–10 proportional
}

/**
 * Skip Rate (20 pts, Reels only) — lower is better.
 * Directly measures hook quality.
 */
function scoreSkipRate(skipRate) {
  if (skipRate == null) return null;
  if (skipRate <= 25) return 20;
  if (skipRate <= 30) return 17;
  if (skipRate <= 35) return 13;
  if (skipRate <= 40) return 9;
  if (skipRate <= 50) return 5;
  if (skipRate <= 60) return 2;
  return 0;
}

/**
 * Shares + Reposts (20 pts) — best virality signal for all post types.
 */
function scoreVirality(shares, reposts) {
  const combined = (shares || 0) + (reposts || 0);
  if (combined >= 500) return 20;
  if (combined >= 100) return 16;
  if (combined >= 20)  return 12;
  if (combined >= 10)  return 8;
  if (combined >= 3)   return 5;
  if (combined >= 1)   return 2;
  return 0;
}

/**
 * Saves — Reel version (15 pts) — absolute thresholds.
 * Rate-based saves penalize viral posts reaching cold audiences; absolute is fairer.
 */
function scoreReelSaves(saves) {
  if (saves >= 50)  return 15;
  if (saves >= 20)  return 11;
  if (saves >= 5)   return 7;
  if (saves >= 2)   return 4;
  if (saves >= 1)   return 2;
  return 0;
}

/**
 * Saves — Carousel version (25 pts) — higher weight; carousels are save-first content.
 */
function scoreCarouselSaves(saves) {
  if (saves >= 50)  return 25;
  if (saves >= 20)  return 19;
  if (saves >= 5)   return 12;
  if (saves >= 2)   return 7;
  if (saves >= 1)   return 3;
  return 0;
}

/**
 * Avg Watch Time (10 pts, Reels only) — retention signal.
 * Stored in seconds (ig_reels_avg_watch_time / 1000).
 */
function scoreWatchTime(seconds) {
  if (seconds == null) return null;
  if (seconds >= 20) return 10;
  if (seconds >= 12) return 7;
  if (seconds >= 7)  return 4;
  if (seconds >= 4)  return 2;
  return 0;
}

/**
 * Comments (5 pts Reels / 10 pts Carousels) — engagement depth + algorithm signal.
 */
function scoreComments(comments, maxPts) {
  const pts = maxPts || 5;
  if (comments >= 20) return pts;
  if (comments >= 5)  return Math.round(pts * 0.8);
  if (comments >= 1)  return Math.round(pts * 0.4);
  return 0;
}

/**
 * Profile Visits (8 pts, Carousels/Images only) — conversion intent signal.
 */
function scoreProfileVisits(visits, avgVisits) {
  if (!avgVisits || avgVisits === 0) return 0;
  const ratio = visits / avgVisits;
  if (ratio >= 3)  return 8;
  if (ratio >= 1.5) return 5;
  if (ratio >= 0.5) return 2;
  return 0;
}

/**
 * Follows (4 pts, Carousels/Images only) — conversion signal.
 */
function scoreFollows(follows) {
  if (follows >= 5)  return 4;
  if (follows >= 2)  return 2;
  if (follows >= 1)  return 1;
  return 0;
}

/**
 * Likes (3 pts, Carousels/Images only).
 */
function scoreLikes(likes) {
  if (likes >= 20) return 3;
  if (likes >= 10) return 2;
  if (likes >= 1)  return 1;
  return 0;
}

// ─── Account averages ────────────────────────────────────────────────────────

function computeAccountAverages(posts) {
  if (!posts || posts.length === 0) return { avgReach: 0, avgProfileVisits: 0 };
  const totalReach = posts.reduce((s, p) => s + (p.reach || 0), 0);
  const carousels = posts.filter(p => p.mediaType !== 'Reel' && p.profileVisits != null);
  const totalPV = carousels.reduce((s, p) => s + (p.profileVisits || 0), 0);
  return {
    avgReach: Math.round(totalReach / posts.length),
    avgProfileVisits: carousels.length ? Math.round(totalPV / carousels.length) : 0
  };
}

// ─── Grade assignment ─────────────────────────────────────────────────────────

function getGrade(score) {
  for (const tier of GRADES) {
    if (score >= tier.min) return tier;
  }
  return GRADES[GRADES.length - 1];
}

function gradePost(post, avgReach, avgProfileVisits) {
  const isReel = post.mediaType === 'Reel';
  let total = 0;
  let scores = {};

  if (isReel) {
    scores.reach      = scoreReach(post.reach, avgReach);
    scores.skipRate   = scoreSkipRate(post.skipRate);
    scores.virality   = scoreVirality(post.shares, post.reposts);
    scores.saves      = scoreReelSaves(post.saves);
    scores.watchTime  = scoreWatchTime(post.avgWatchTime);
    scores.comments   = scoreComments(post.comments, 5);

    total = scores.reach
          + (scores.skipRate   ?? 0)
          + scores.virality
          + scores.saves
          + (scores.watchTime  ?? 0)
          + scores.comments;
  } else {
    scores.reach         = scoreReach(post.reach, avgReach);
    scores.saves         = scoreCarouselSaves(post.saves);
    scores.virality      = scoreVirality(post.shares, post.reposts);
    scores.comments      = scoreComments(post.comments, 10);
    scores.profileVisits = scoreProfileVisits(post.profileVisits, avgProfileVisits);
    scores.follows       = scoreFollows(post.follows);
    scores.likes         = scoreLikes(post.likes);

    total = scores.reach
          + scores.saves
          + scores.virality
          + scores.comments
          + scores.profileVisits
          + scores.follows
          + scores.likes;
  }

  const finalScore = clamp(Math.round(total), 0, 100);
  const grade = getGrade(finalScore);

  return {
    ...post,
    performanceScore: finalScore,
    gradeLabel: grade.label,
    gradeColor: grade.color,
    gradeColorRgb: GRADE_COLORS[grade.color],
    _scores: scores
  };
}

function gradeAllPosts(posts) {
  const { avgReach, avgProfileVisits } = computeAccountAverages(posts);
  log(`Account averages — Reach: ${avgReach} | Profile Visits: ${avgProfileVisits}`);

  const graded = posts.map(post => gradePost(post, avgReach, avgProfileVisits));

  const dist = { '🟢 DOUBLE DOWN': 0, '🟡 MODIFY': 0, '🔴 RETIRE': 0, '⚫ KILL IT': 0 };
  for (const p of graded) { if (dist[p.gradeLabel] !== undefined) dist[p.gradeLabel]++; }
  log(`Grade distribution: ${JSON.stringify(dist)}`);

  return { graded, avgReach, avgProfileVisits };
}

module.exports = { gradeAllPosts, GRADE_COLORS };

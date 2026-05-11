/**
 * fetch.js — Pulls all Instagram posts from the previous 7 days
 * via the Instagram Graph API and returns structured post objects.
 */

require('dotenv').config({ override: true });
const axios = require('axios');
const { log, error, warn } = require('./utils/logger');

const IG_API_BASE = 'https://graph.facebook.com/v22.0';
const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const IG_ACCOUNT_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

// All insight metrics we want to pull per post
const REEL_METRICS = [
  'reach', 'total_views', 'saved', 'shares', 'reposts',
  'total_interactions', 'reels_skip_rate',
  'ig_reels_avg_watch_time', 'ig_reels_video_view_total_time'
].join(',');

// Clips and other non-Reel video types
const CLIP_METRICS = [
  'reach', 'total_views', 'saved', 'shares', 'reposts', 'total_interactions'
].join(',');

const CAROUSEL_METRICS = [
  'reach', 'total_views', 'saved', 'shares', 'reposts',
  'total_interactions', 'follows', 'profile_visits'
].join(',');

// ManyChat trigger keywords (current + future)
const MANYCHAT_KEYWORDS = ['KNEE', 'FREE', 'ELBOW', 'SHOULDER', 'RECOVERY', 'DROP'];

// Content pillar classification keywords
const PILLAR_MAP = {
  'Pain & Injury': [
    'knee', 'elbow', 'shoulder', 'pain', 'injury', 'hurt',
    'inflammation', 'tendon', 'sprain', 'strain', 'ache'
  ],
  'Performance & Technique': [
    'third shot', 'reset', 'kitchen', 'movement', 'drop',
    'technique', 'drill', 'dink', 'backhand', 'forehand',
    'serve', 'return', 'volley', 'speed', 'footwork'
  ],
  'Recovery & Longevity': [
    'recovery', 'longevity', 'rest', 'sleep', 'mobility',
    'maintenance', 'over 50', 'over 40', 'age', 'older',
    'stretch', 'warm up', 'cool down', 'ice', 'heat'
  ],
  'Credibility & Story': [
    'chiropractor', 'dupr', ' dc ', 'doctor', 'background',
    'story', 'why i', 'case', 'patient', 'clinic', 'degree',
    'licensed', 'chiro', 'adjustment'
  ]
};

/**
 * Sleep helper for retry logic
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make an API call with one automatic retry on failure
 */
async function apiCall(url, params = {}) {
  const fullParams = { access_token: ACCESS_TOKEN, ...params };
  try {
    const response = await axios.get(url, { params: fullParams });
    return response.data;
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.error?.message || err.message;

    // Token expiry check
    if (err.response?.data?.error?.code === 190) {
      throw new Error(
        'TOKEN_EXPIRED: Your Instagram access token has expired. ' +
        'Please follow Step B4 in SETUP-GUIDE.md to get a new token and update your .env file.'
      );
    }

    warn(`API call failed (${status}): ${msg}. Retrying in 30 seconds...`);
    await sleep(30000);

    try {
      const retry = await axios.get(url, { params: fullParams });
      return retry.data;
    } catch (retryErr) {
      const retryMsg = retryErr.response?.data?.error?.message || retryErr.message;
      throw new Error(`API call failed after retry: ${retryMsg}`);
    }
  }
}

/**
 * Extracts the hook — the first line of a caption
 */
function extractHook(caption) {
  if (!caption) return '';
  const lines = caption.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  return lines[0] || '';
}

/**
 * Detects which ManyChat CTA keyword appears in a caption (returns first match or '')
 */
function detectCtaKeyword(caption) {
  if (!caption) return '';
  const upper = caption.toUpperCase();
  for (const kw of MANYCHAT_KEYWORDS) {
    // Match whole word to avoid false positives
    const regex = new RegExp(`\\b${kw}\\b`);
    if (regex.test(upper)) return kw;
  }
  return '';
}

/**
 * Classifies caption into one of the four content pillars
 */
function classifyPillar(caption) {
  if (!caption) return 'Unclassified';
  const lower = caption.toLowerCase();
  for (const [pillar, keywords] of Object.entries(PILLAR_MAP)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return pillar;
    }
  }
  return 'Unclassified';
}

/**
 * Fetches insight metrics for a single post
 */
async function fetchPostInsights(postId, mediaType, mediaProductType) {
  let metrics;
  if (mediaProductType?.toUpperCase().includes('REEL')) {
    metrics = REEL_METRICS;
  } else if (mediaType === 'CAROUSEL_ALBUM') {
    metrics = CAROUSEL_METRICS;
  } else {
    metrics = CLIP_METRICS;
  }

  try {
    const url = `${IG_API_BASE}/${postId}/insights`;
    const data = await apiCall(url, { metric: metrics, period: 'lifetime' });

    const insights = {};
    for (const item of (data.data || [])) {
      insights[item.name] = item.values?.[0]?.value ?? item.value ?? 0;
    }
    return insights;
  } catch (err) {
    warn(`Could not fetch insights for post ${postId}: ${err.message}`);
    return {};
  }
}

/**
 * Parses the day of week from an ISO timestamp
 */
function getDayOfWeek(isoString) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date(isoString).getDay()];
}

/**
 * Main fetch function — returns array of enriched post objects
 */
async function fetchWeeklyPosts() {
  if (!ACCESS_TOKEN || !IG_ACCOUNT_ID) {
    throw new Error(
      'Missing INSTAGRAM_ACCESS_TOKEN or INSTAGRAM_BUSINESS_ACCOUNT_ID in .env file. ' +
      'Please follow the SETUP-GUIDE.md to configure these values.'
    );
  }

  // Calculate date range: last 7 days
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const since = Math.floor(sevenDaysAgo.getTime() / 1000);

  log(`Fetching posts from ${sevenDaysAgo.toDateString()} to ${now.toDateString()}`);

  // Fetch media list
  const mediaUrl = `${IG_API_BASE}/${IG_ACCOUNT_ID}/media`;
  const mediaData = await apiCall(mediaUrl, {
    fields: 'id,caption,media_type,media_product_type,timestamp,like_count,comments_count',
    since,
    limit: 50
  });

  const rawPosts = mediaData.data || [];
  log(`Found ${rawPosts.length} posts in the date range`);

  if (rawPosts.length === 0) {
    warn('No posts found for the past 7 days. This may be correct if you did not post this week.');
    return [];
  }

  // Enrich each post with insights and derived fields
  const enrichedPosts = [];

  for (const post of rawPosts) {
    log(`Processing post ${post.id} (${post.media_type}/${post.media_product_type}) from ${post.timestamp}`);

    const insights = await fetchPostInsights(post.id, post.media_type, post.media_product_type);

    const caption = post.caption || '';
    const isReel = post.media_product_type?.toUpperCase().includes('REEL');
    const isCarousel = post.media_type === 'CAROUSEL_ALBUM';

    // Average watch time in seconds (ig_reels_avg_watch_time returned in ms)
    let completionRate = null;
    if (isReel && insights.ig_reels_avg_watch_time != null) {
      completionRate = Math.round(insights.ig_reels_avg_watch_time / 1000);
    }

    enrichedPosts.push({
      id: post.id,
      timestamp: post.timestamp,
      postDate: new Date(post.timestamp).toLocaleDateString('en-US', {
        month: '2-digit', day: '2-digit', year: 'numeric'
      }),
      dayOfWeek: getDayOfWeek(post.timestamp),
      mediaType: isReel ? 'Reel' : isCarousel ? 'Carousel' : 'Image',
      caption,
      hook: extractHook(caption),
      ctaKeyword: detectCtaKeyword(caption),
      pillar: classifyPillar(caption),

      // Metrics — all fields available from Instagram Graph API v22.0
      reach: insights.reach || 0,
      videoViews: insights.total_views || 0,
      avgWatchTime: isReel ? (completionRate ?? null) : null,
      skipRate: isReel ? (insights.reels_skip_rate ?? null) : null,
      saves: insights.saved || 0,
      shares: insights.shares || 0,
      reposts: insights.reposts || 0,
      comments: post.comments_count || 0,
      likes: post.like_count || 0,
      profileVisits: isReel ? null : (insights.profile_visits || 0),
      follows: isReel ? null : (insights.follows || 0),
      totalInteractions: insights.total_interactions || 0,
      completionRate,

      // Raw API response for debugging
      _rawInsights: insights
    });

    // Small delay between posts to respect rate limits
    await sleep(300);
  }

  log(`Successfully enriched ${enrichedPosts.length} posts`);
  return enrichedPosts;
}

/**
 * Fetches account-level stats: follower count and total media count.
 * Used for the daily follower-growth snapshot.
 */
async function fetchAccountStats() {
  if (!ACCESS_TOKEN || !IG_ACCOUNT_ID) {
    throw new Error('Missing INSTAGRAM_ACCESS_TOKEN or INSTAGRAM_BUSINESS_ACCOUNT_ID');
  }
  const url = `${IG_API_BASE}/${IG_ACCOUNT_ID}`;
  const data = await apiCall(url, { fields: 'followers_count,media_count,username' });
  return {
    date: new Date().toISOString().split('T')[0],
    timestamp: new Date().toISOString(),
    followers: data.followers_count || 0,
    mediaCount: data.media_count || 0,
    username: data.username || '',
  };
}

module.exports = { fetchWeeklyPosts, fetchAccountStats };

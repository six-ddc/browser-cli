// scripts/youtube.mjs — YouTube recipe functions
// Each function: (browser, args?) => Promise<result>
// browser.evaluate() auto-unwraps { value } and JSON.parse, so expression
// that returns JSON.stringify(...) will yield a parsed JS object directly.

/** Detect login state → { loggedIn }
 * @requires Current tab is on youtube.com */
export async function detectLogin(browser) {
  console.log('Detecting login state...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const loggedIn = !!document.querySelector('#avatar-btn, button[aria-label="Account menu"]');
      const signInBtn = !!document.querySelector('a[href*="accounts.google.com/ServiceLogin"]');
      return { loggedIn: loggedIn && !signInBtn };
    })())`,
  });
  console.log('Login state:', result.loggedIn ? 'logged in' : 'not logged in');
  return result;
}

/** Search YouTube → navigate to search results page
 * @requires None */
export async function search(browser, { query } = {}) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  console.log(`Searching: "${query}"`);
  await browser.navigate({ url });
  await browser.wait({ selector: 'ytd-video-renderer', timeout: 8000 });
  console.log('Search results loaded');
}

/** Extract search results → [{ index, title, url, channel, views, age, duration }]
 * @requires Current page is a YouTube search results page */
export async function extractSearchResults(browser) {
  console.log('Extracting search results...');
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll("ytd-video-renderer")].map((el, i) => {
      const titleLink = el.querySelector("#video-title");
      const metaItems = [...el.querySelectorAll("#metadata-line span")];
      const channelEl = el.querySelector("ytd-channel-name a");
      const dur = el.querySelector("badge-shape .yt-badge-shape__text, ytd-thumbnail-overlay-time-status-renderer span");
      return {
        index: i + 1,
        title: titleLink?.innerText?.trim() || "",
        url: titleLink?.href || "",
        channel: channelEl?.innerText?.trim() || "",
        views: metaItems[0]?.innerText || "",
        age: metaItems[1]?.innerText || "",
        duration: dur?.innerText?.trim() || "",
      };
    }).filter(r => r.title))`,
  });
  console.log(`Extracted ${results.length} search results`);
  return results;
}

/** Extract homepage recommended videos → [{ index, title, url, channel, views, age, duration }]
 * @requires Current page is youtube.com homepage */
export async function extractHomeFeed(browser) {
  console.log('Extracting homepage feed...');
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll("ytd-rich-item-renderer")].map((el, i) => {
      if (el.querySelector("ytd-ad-slot-renderer")) return null;
      const links = [...el.querySelectorAll("a")];
      const videoLink = links.find(a => a.href?.includes("/watch?v="));
      if (!videoLink) return null;
      const titleEl = el.querySelector(".yt-core-attributed-string--white-space-pre-wrap");
      const metaSpans = [...el.querySelectorAll(".yt-content-metadata-view-model__metadata-text")];
      const dur = el.querySelector(".yt-badge-shape__text");
      return {
        index: i + 1,
        title: titleEl?.innerText || "",
        channel: metaSpans[0]?.innerText || "",
        views: metaSpans[1]?.innerText || "",
        age: metaSpans[2]?.innerText || "",
        duration: dur?.innerText?.trim() || "",
        url: videoLink.href,
      };
    }).filter(Boolean))`,
  });
  console.log(`Extracted ${results.length} videos from home feed`);
  return results;
}

/** Extract video page metadata → { title, channel, channelUrl, subscribers, likes, description, commentCount }
 * @requires Current page is a YouTube watch page (/watch?v=...) */
export async function extractVideoInfo(browser) {
  console.log('Extracting video info...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const title = document.querySelector("yt-formatted-string.style-scope.ytd-watch-metadata")?.innerText || "";
      const channelLink = document.querySelector("#owner #channel-name a, ytd-video-owner-renderer #channel-name a");
      const subscribers = document.querySelector("#owner-sub-count")?.innerText?.trim() || "";
      const likeBtn = document.querySelector("like-button-view-model button");
      const likesMatch = likeBtn?.getAttribute("aria-label")?.match(/([\\d,]+)/);
      const descSnippet = document.querySelector("#snippet-text")?.innerText || "";
      const commentHeader = document.querySelector("ytd-comments-header-renderer #count span")?.innerText || "";
      const player = document.querySelector("#movie_player");
      const videoData = player?.getVideoData?.() || {};
      const video = document.querySelector("video");
      return {
        title,
        channel: channelLink?.innerText?.trim() || "",
        channelUrl: channelLink?.href || "",
        subscribers,
        likes: likesMatch ? likesMatch[1] : "0",
        description: descSnippet.substring(0, 1000),
        commentCount: commentHeader,
        duration: video?.duration || 0,
        videoId: videoData.video_id || "",
        isLive: videoData.isLive || false,
      };
    })())`,
  });
  console.log(`Video: "${result.title}" by ${result.channel}`);
  return result;
}

/** Extract comments → [{ author, text, likes, time, replyCount }]
 * @requires Current page is a YouTube watch page, scrolled down to load comments */
export async function extractComments(browser) {
  console.log('Extracting comments...');
  // Scroll to load comments if needed
  await browser.scroll({ direction: 'down', amount: 800 });
  await browser.wait({ duration: 2000 });
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll("ytd-comment-thread-renderer")].map((c, i) => ({
      index: i + 1,
      author: c.querySelector("#author-text span")?.innerText?.trim() || "",
      text: c.querySelector("#content-text")?.innerText || "",
      likes: c.querySelector("#vote-count-middle")?.innerText?.trim() || "0",
      time: c.querySelector('a[href*="lc="]')?.innerText?.trim() || "",
      replyCount: c.querySelector("#more-replies button span")?.innerText?.trim() || "",
    })))`,
  });
  console.log(`Extracted ${results.length} comments`);
  return results;
}

/** Extract related/recommended videos from sidebar → [{ index, title, channel, views, url }]
 * @requires Current page is a YouTube watch page */
export async function extractRelatedVideos(browser) {
  console.log('Extracting related videos...');
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll("#related yt-lockup-view-model")].map((el, i) => {
      const links = [...el.querySelectorAll("a")];
      const videoLink = links.find(a => a.href?.includes("/watch?v="));
      const metaSpans = [...el.querySelectorAll(".yt-content-metadata-view-model__metadata-text")];
      const titleEl = el.querySelector(".yt-core-attributed-string--white-space-pre-wrap");
      return {
        index: i + 1,
        title: titleEl?.innerText || "",
        channel: metaSpans[0]?.innerText || "",
        views: metaSpans[1]?.innerText || "",
        url: videoLink?.href || "",
      };
    }).filter(r => r.title))`,
  });
  console.log(`Extracted ${results.length} related videos`);
  return results;
}

/** Get available caption/subtitle tracks → { available, tracks: [{ lang, name, kind, baseUrl }] }
 * @requires Current page is a YouTube watch page */
export async function getCaptionTracks(browser) {
  console.log('Getting caption tracks...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const player = document.querySelector("#movie_player");
      const tracks = player?.getOption?.("captions", "tracklist") || [];
      const resp = typeof ytInitialPlayerResponse !== "undefined" ? ytInitialPlayerResponse : {};
      const captionTracks = resp?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      return {
        available: tracks.length > 0 || captionTracks.length > 0,
        tracks: captionTracks.map(t => ({
          lang: t.languageCode,
          name: t.name?.simpleText || t.name?.runs?.[0]?.text || "",
          kind: t.kind || "",
          baseUrl: t.baseUrl || "",
        })),
      };
    })())`,
  });
  console.log(
    result.available
      ? `${result.tracks.length} caption tracks: ${result.tracks.map((t) => t.name).join(', ')}`
      : 'No captions available',
  );
  return result;
}

function formatTimestamp(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const millis = ms % 1000;
  const pad2 = (n) => n.toString().padStart(2, '0');
  const pad3 = (n) => n.toString().padStart(3, '0');
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${pad3(millis)}`;
}

/** Format segments as SRT string */
function toSrt(segments) {
  return segments
    .map((seg, i) => `${i + 1}\n${seg.startTime} --> ${seg.endTime}\n${seg.text}`)
    .join('\n\n');
}

/** Find a timedtext URL with POT from captured network requests.
 * POT is per-video, so we can reuse any captured POT URL and swap the lang param.
 * @param {string} videoId — current video ID to filter by
 * @returns {string|null} Full URL with POT for the requested language, or null */
async function findTimedtextUrl(browser, { videoId, lang, kind } = {}) {
  const { requests } = await browser.getRequests({ pattern: '*timedtext*', limit: 50 });
  // Only consider requests with POT token for the current video
  const withPot = requests.filter(
    (r) => r.url.includes('pot=') && (!videoId || r.url.includes(`v=${videoId}`)),
  );
  if (withPot.length === 0) return null;

  if (lang) {
    // Look for exact lang match first
    const exact = withPot.find((r) => {
      const u = new URL(r.url);
      return u.searchParams.get('lang') === lang;
    });
    if (exact) return exact.url;

    // POT is per-video — reuse any captured URL, swap lang (and kind if needed)
    const donor = withPot[withPot.length - 1];
    const u = new URL(donor.url);
    u.searchParams.set('lang', lang);
    if (kind) {
      u.searchParams.set('kind', kind);
    } else {
      u.searchParams.delete('kind');
    }
    return u.toString();
  }
  return withPot[withPot.length - 1].url;
}

/** Ensure the timedtext URL has fmt=json3 parameter */
function ensureJson3(url) {
  if (url.includes('fmt=json3')) return url;
  // Replace existing fmt= or append
  if (url.includes('fmt=')) return url.replace(/fmt=[^&]*/, 'fmt=json3');
  return url + '&fmt=json3';
}

/** Fetch timedtext JSON3 data via in-page fetch → parsed object
 * @returns {object|null} Parsed JSON3 data or null on failure */
async function fetchTimedtext(browser, url) {
  const json3Url = ensureJson3(url);
  const result = await browser.evaluate({
    expression: `(async () => {
      const resp = await fetch(${JSON.stringify(json3Url)});
      const text = await resp.text();
      return JSON.stringify({ status: resp.status, body: text });
    })()`,
  });
  if (result.status !== 200 || !result.body || result.body.length === 0) return null;
  try {
    return JSON.parse(result.body);
  } catch {
    return null;
  }
}

/** Extract transcript via API (network capture + in-page fetch)
 * @param {object} opts
 * @param {string} [opts.lang] — language code (e.g. "en", "ja")
 * @param {boolean} [opts.text] — if true, return plain text only (no timestamps/formatting)
 * @returns {string} SRT-formatted string, or plain text if opts.text is true
 * @requires Current page is a YouTube watch page with captions available */
export async function extractTranscript(browser, { lang, text: textOnly } = {}) {
  console.log('Extracting transcript...');

  // Get current video ID from URL
  const currentUrl = await browser.getUrl();
  const videoId = new URL(currentUrl.url).searchParams.get('v') || '';

  // Resolve target track info
  const tracks = await getCaptionTracks(browser);
  if (!tracks.available || tracks.tracks.length === 0) {
    return { error: 'No caption tracks available for this video.' };
  }
  const manual = tracks.tracks.filter((t) => t.kind !== 'asr');
  const auto = tracks.tracks.filter((t) => t.kind === 'asr');
  const track = lang
    ? // Exact match first, then prefix match (e.g. "en" matches "en-US"), then fallback
      tracks.tracks.find((t) => t.lang === lang) ||
      tracks.tracks.find((t) => t.lang.startsWith(lang)) ||
      tracks.tracks[0]
    : // No lang specified: prefer English manual → any manual → English auto → first available
      manual.find((t) => t.lang.startsWith('en')) ||
      manual[0] ||
      auto.find((t) => t.lang.startsWith('en')) ||
      tracks.tracks[0];
  const targetLang = track.lang;
  const targetKind = track.kind || undefined;

  // Step 1: Find a captured timedtext URL with POT (reuses POT across languages)
  let url = await findTimedtextUrl(browser, { videoId, lang: targetLang, kind: targetKind });

  // Step 2: If no POT captured yet, trigger caption loading to generate one
  if (!url) {
    console.log('No captured POT, triggering caption load...');
    await browser.evaluate({
      expression: `(() => {
        const player = document.querySelector("#movie_player");
        player?.setOption?.("captions", "track", { languageCode: "${targetLang}" });
      })()`,
    });
    await browser.wait({ duration: 2000 });
    url = await findTimedtextUrl(browser, { videoId, lang: targetLang, kind: targetKind });
  }

  // Step 3: Last resort — use baseUrl directly (may fail without POT)
  if (!url && track.baseUrl) {
    console.log('No POT available, trying baseUrl directly...');
    url = track.baseUrl;
  }

  if (!url) {
    return { error: 'Could not obtain timedtext URL. Video may not have captions.' };
  }

  // Step 4: Fetch and parse JSON3 transcript data
  console.log('Fetching transcript data...');
  const data = await fetchTimedtext(browser, url);
  if (!data) {
    return { error: 'Failed to fetch transcript data (empty response or parse error).' };
  }

  const segments = (data.events || [])
    .filter((e) => e.segs)
    .map((e) => ({
      startTime: formatTimestamp(e.tStartMs),
      endTime: formatTimestamp(e.tStartMs + (e.dDurationMs || 0)),
      text: e.segs
        .map((s) => s.utf8)
        .join('')
        .trim(),
    }))
    .filter((s) => s.text);

  console.log(`Extracted ${segments.length} transcript segments (${track.name})`);
  if (textOnly) {
    return segments.map((s) => s.text).join(' ');
  }
  return toSrt(segments);
}

/** Extract transcript as plain text (no timestamps) → string
 * @requires Current page is a YouTube watch page with captions available */
export async function extractTranscriptText(browser, { lang } = {}) {
  return extractTranscript(browser, { lang, text: true });
}

/** Enable/disable captions on the video player
 * @requires Current page is a YouTube watch page */
export async function toggleCaptions(browser, { lang } = {}) {
  console.log('Toggling captions...');
  if (lang) {
    await browser.evaluate({
      expression: `(() => {
        const player = document.querySelector("#movie_player");
        player?.setOption?.("captions", "track", { languageCode: "${lang}" });
      })()`,
    });
    console.log(`Captions enabled: ${lang}`);
  } else {
    await browser.click({ selector: '.ytp-subtitles-button' });
    const state = await browser.evaluate({
      expression: `document.querySelector(".ytp-subtitles-button")?.getAttribute("aria-pressed")`,
    });
    console.log(`Captions ${state === 'true' ? 'enabled' : 'disabled'}`);
  }
}

/** Control video playback: play, pause, seek, playback rate
 * @requires Current page is a YouTube watch page */
export async function playerControl(browser, { action, value } = {}) {
  console.log(`Player control: ${action}${value !== undefined ? ` (${value})` : ''}`);
  const result = await browser.evaluate({
    expression: `(() => {
      const video = document.querySelector("video");
      if (!video) return JSON.stringify({ error: "No video element found" });
      switch ("${action}") {
        case "play": video.play(); return JSON.stringify({ state: "playing" });
        case "pause": video.pause(); return JSON.stringify({ state: "paused" });
        case "seek": video.currentTime = ${Number(value) || 0}; return JSON.stringify({ currentTime: video.currentTime });
        case "speed": video.playbackRate = ${Number(value) || 1}; return JSON.stringify({ playbackRate: video.playbackRate });
        case "mute": video.muted = true; return JSON.stringify({ muted: true });
        case "unmute": video.muted = false; return JSON.stringify({ muted: false });
        case "status": return JSON.stringify({
          currentTime: video.currentTime,
          duration: video.duration,
          paused: video.paused,
          playbackRate: video.playbackRate,
          muted: video.muted,
          volume: video.volume,
        });
        default: return JSON.stringify({ error: "Unknown action: ${action}" });
      }
    })()`,
  });
  return result;
}

/** Navigate to a video page by URL or video ID
 * @requires None */
export async function openVideo(browser, { url, videoId } = {}) {
  const targetUrl = url || `https://www.youtube.com/watch?v=${videoId}`;
  console.log(`Opening video: ${targetUrl}`);
  await browser.navigate({ url: targetUrl });
  await browser.wait({ selector: '#movie_player', timeout: 8000 });
  console.log('Video page loaded');
}

/** Navigate to a channel page
 * @requires None */
export async function openChannel(browser, { handle, url } = {}) {
  const targetUrl = url || `https://www.youtube.com/@${handle}/videos`;
  console.log(`Opening channel: ${targetUrl}`);
  await browser.navigate({ url: targetUrl });
  await browser.wait({ selector: 'ytd-rich-item-renderer', timeout: 8000 });
  console.log('Channel page loaded');
}

/** Full workflow: search and extract results */
export default async function (browser, args) {
  if (args?.query) {
    await search(browser, { query: args.query });
    return await extractSearchResults(browser);
  }
  if (args?.videoId || args?.url) {
    await openVideo(browser, { url: args.url, videoId: args.videoId });
    return await extractVideoInfo(browser);
  }
  // Default: extract home feed
  return await extractHomeFeed(browser);
}

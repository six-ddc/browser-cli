// scripts/x.mjs — X (Twitter) recipe functions
// Each function: (browser, args?) => Promise<result>
// browser.evaluate() auto-unwraps { value } and JSON.parse, so expression
// that returns JSON.stringify(...) will yield a parsed JS object directly.

/** Detect login state → { loggedIn }
 * @requires Current tab is on x.com */
export async function detectLogin(browser) {
  console.log('Detecting login state...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const tweetButton = !!document.querySelector('[data-testid="SideNav_NewTweet_Button"]');
      const accountSwitcher = !!document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
      return { loggedIn: tweetButton || accountSwitcher };
    })())`,
  });
  console.log('Login state:', result.loggedIn ? 'logged in' : 'not logged in');
  return result;
}

/** Extract user profile info → { displayName, handle, description, joinDate, website, following, followers, verified }
 * @requires Current page is a user profile page (/handle) */
export async function extractProfile(browser) {
  console.log('Extracting user profile...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const nameEl = document.querySelector('[data-testid="UserName"]');
      const spans = nameEl ? [...nameEl.querySelectorAll('span')] : [];
      const displayName = spans.find(s => s.innerText && !s.innerText.startsWith('@'))?.innerText || "";
      const handle = spans.find(s => s.innerText?.startsWith('@'))?.innerText || "";
      const description = document.querySelector('[data-testid="UserDescription"]')?.innerText || "";
      const joinDate = document.querySelector('[data-testid="UserJoinDate"]')?.innerText || "";
      const website = document.querySelector('[data-testid="UserUrl"]')?.innerText || "";
      const following = document.querySelector('a[href$="/following"]')?.innerText || "";
      const followers = (document.querySelector('a[href$="/verified_followers"]') || document.querySelector('a[href$="/followers"]'))?.innerText || "";
      const verified = !!document.querySelector('[data-testid="icon-verified"]');
      return { displayName, handle, description, joinDate, website, following, followers, verified };
    })())`,
  });
  console.log(
    `Profile: ${result.displayName} ${result.handle} | Following: ${result.following} Followers: ${result.followers}`,
  );
  return result;
}

/** Extract tweets from the current page → [{ index, displayName, handle, text, datetime, timeText, tweetUrl, replies, retweets, likes, photos, hasVideo, hasCard }]
 * @requires Current page has a tweet list (timeline / search results / profile page) */
export async function extractTweets(browser) {
  console.log('Extracting tweets...');
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll('[data-testid="tweet"]')].map((el, i) => {
      const userNameEl = el.querySelector('[data-testid="User-Name"]');
      const links = userNameEl ? [...userNameEl.querySelectorAll('a')] : [];
      const displayName = links[0]?.innerText || "";
      const handle = links[1]?.innerText || "";
      const text = el.querySelector('[data-testid="tweetText"]')?.innerText || "";
      const time = el.querySelector('time');
      const statusLink = el.querySelector('a[href*="/status/"]');
      const parseCount = label => {
        if (!label) return "0";
        const m = label.match(/^(\\d[\\d,]*)/);
        return m ? m[1] : "0";
      };
      return {
        index: i + 1,
        displayName, handle,
        text: text.substring(0, 280),
        datetime: time?.getAttribute('datetime') || "",
        timeText: time?.innerText || "",
        tweetUrl: statusLink?.href || "",
        replies: parseCount(el.querySelector('[data-testid="reply"]')?.getAttribute('aria-label')),
        retweets: parseCount(el.querySelector('[data-testid="retweet"]')?.getAttribute('aria-label')),
        likes: parseCount(el.querySelector('[data-testid="like"]')?.getAttribute('aria-label')),
        photos: [...el.querySelectorAll('[data-testid="tweetPhoto"] img')].map(img => img.src.replace(/name=\\w+/, 'name=large')),
        hasVideo: !!el.querySelector('[data-testid="videoPlayer"]'),
        hasCard: !!el.querySelector('[data-testid="card.wrapper"]'),
      };
    }))`,
  });
  console.log(`Extracted ${results.length} tweets`);
  return results;
}

/** Inject global tweet collector (for virtual scrolling) → { collected }
 * @requires Current page has a tweet list */
export async function initTweetCollector(browser) {
  console.log('Injecting tweet collector...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      window.__tweetCollector = new Map();
      window.__collectTweets = function() {
        document.querySelectorAll('article[data-testid="tweet"]').forEach(el => {
          const url = el.querySelector('a[href*="/status/"]')?.href || "";
          if (!url || window.__tweetCollector.has(url)) return;
          const userNameEl = el.querySelector('[data-testid="User-Name"]');
          const links = userNameEl ? [...userNameEl.querySelectorAll('a')] : [];
          const parseCount = label => {
            if (!label) return "0";
            const m = label.match(/^(\\d[\\d,]*)/);
            return m ? m[1] : "0";
          };
          window.__tweetCollector.set(url, {
            displayName: links[0]?.innerText || "",
            handle: links[1]?.innerText || "",
            text: el.querySelector('[data-testid="tweetText"]')?.innerText?.substring(0, 280) || "",
            datetime: el.querySelector('time')?.getAttribute('datetime') || "",
            timeText: el.querySelector('time')?.innerText || "",
            tweetUrl: url,
            replies: parseCount(el.querySelector('[data-testid="reply"]')?.getAttribute('aria-label')),
            retweets: parseCount(el.querySelector('[data-testid="retweet"]')?.getAttribute('aria-label')),
            likes: parseCount(el.querySelector('[data-testid="like"]')?.getAttribute('aria-label')),
            photos: [...el.querySelectorAll('[data-testid="tweetPhoto"] img')].map(img => img.src.replace(/name=\\w+/, 'name=large')),
            hasVideo: !!el.querySelector('[data-testid="videoPlayer"]'),
            hasCard: !!el.querySelector('[data-testid="card.wrapper"]'),
          });
        });
        return window.__tweetCollector.size;
      };
      return { collected: window.__collectTweets() };
    })())`,
  });
  console.log(`Collector injected, initially collected ${result.collected} tweets`);
  return result;
}

/** Scroll and collect new tweets → { collected }
 * @requires initTweetCollector called first */
export async function scrollAndCollect(browser, { amount } = {}) {
  const scrollAmount = Number(amount) || 2000;
  console.log(`Scrolling ${scrollAmount}px and collecting...`);
  await browser.scroll({ direction: 'down', amount: scrollAmount });
  await browser.wait({ duration: 1500 });
  const result = await browser.evaluate({
    expression: `JSON.stringify({ collected: window.__collectTweets() })`,
  });
  console.log(`Total collected: ${result.collected} tweets`);
  return result;
}

/** Read collected tweets → tweet array
 * @requires initTweetCollector called first */
export async function getCollectedTweets(browser, { limit } = {}) {
  const n = Number(limit) || 0;
  console.log(`Reading collected tweets${n > 0 ? ` (limit: ${n})` : ''}...`);
  const results = await browser.evaluate({
    expression: `JSON.stringify(${n > 0 ? `[...window.__tweetCollector.values()].slice(0, ${n})` : '[...window.__tweetCollector.values()]'})`,
  });
  console.log(`Returned ${results.length} tweets`);
  return results;
}

/** Navigate to search page → wait for tweets to load
 * @requires Logged in (login required) */
export async function navigateSearch(browser, { query, tab } = {}) {
  const url = `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query${tab ? '&f=' + tab : ''}`;
  console.log(`Navigating to search: "${query}"${tab ? ` [tab: ${tab}]` : ''}`);
  await browser.navigate({ url });
  try {
    await browser.wait({ selector: '[data-testid="tweet"]', timeout: 5000 });
    console.log('Search results loaded');
  } catch {
    console.log(
      'Timed out waiting for tweets — may have no results, waiting for page to stabilize...',
    );
    await browser.wait({ duration: 3000 });
  }
}

/** Toggle like on the first tweet on the page
 * @requires Current page is a tweet detail page and user is logged in */
export async function toggleLike(browser) {
  console.log('Detecting like state...');
  const state = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const tweet = document.querySelector('article[data-testid="tweet"]');
      return {
        liked: !!tweet?.querySelector('[data-testid="unlike"]'),
        notLiked: !!tweet?.querySelector('[data-testid="like"]'),
      };
    })())`,
  });
  if (state.liked) {
    await browser.click({ selector: 'article[data-testid="tweet"] [data-testid="unlike"]' });
    console.log('Unliked');
  } else {
    await browser.click({ selector: 'article[data-testid="tweet"] [data-testid="like"]' });
    console.log('Liked');
  }
}

/** Compose and post a tweet from the home page
 * @requires Logged in */
export async function postTweet(browser, { text }) {
  console.log(`Posting tweet: "${text}"`);
  await browser.navigate({ url: 'https://x.com/home' });
  await browser.wait({ selector: '[data-testid="tweetTextarea_0"]', timeout: 5000 });
  await browser.evaluate({
    expression: `(() => {
      const el = document.querySelector('[data-testid="tweetTextarea_0"]');
      el.focus();
      el.dispatchEvent(new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: ${JSON.stringify(text)},
        bubbles: true,
        cancelable: true,
      }));
    })()`,
  });
  await browser.click({ selector: '[data-testid="tweetButtonInline"]' });
  await browser.wait({ duration: 2000 });
  console.log('Tweet posted');
}

/** Full workflow: detect login → (optional) navigate to user profile → extract tweets */
export default async function (browser, args) {
  const { loggedIn } = await detectLogin(browser);
  if (!loggedIn) {
    console.log('Not logged in. Please log in first and retry.');
    return { loggedIn: false };
  }
  if (args && args.handle) {
    await browser.navigate({ url: `https://x.com/${args.handle}` });
    await browser.wait({ selector: '[data-testid="tweet"]', timeout: 5000 });
  }
  return await extractTweets(browser);
}

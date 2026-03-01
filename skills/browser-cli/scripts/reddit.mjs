// scripts/reddit.mjs — Reddit recipe functions
// Each function: (browser, args?) => Promise<result>
// browser.evaluate() auto-unwraps { value } and JSON.parse, so expression
// that returns JSON.stringify(...) will yield a parsed JS object directly.

/** Detect login state → { loggedIn }
 * @requires Current tab is on reddit.com */
export async function detectLogin(browser) {
  console.log('Detecting login state...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const expandUser = !!document.querySelector('#expand-user-drawer-button');
      const createPost = !!document.querySelector('a[href="/submit"]');
      const notifications = !!document.querySelector('a[href*="/notifications"]');
      return { loggedIn: expandUser || createPost || notifications };
    })())`,
  });
  console.log('Login state:', result.loggedIn ? 'logged in' : 'not logged in');
  return result;
}

/** Extract posts from the current feed/subreddit page → [{ index, title, author, subreddit, score, comments, postType, permalink, created, url }]
 * @requires Current page is a Reddit home or subreddit page with shreddit-post elements loaded */
export async function extractFeed(browser) {
  console.log('Extracting posts...');
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll('shreddit-post')].map((el, i) => ({
      index: i + 1,
      title: el.getAttribute('post-title'),
      author: el.getAttribute('author'),
      subreddit: el.getAttribute('subreddit-prefixed-name'),
      score: el.getAttribute('score'),
      comments: el.getAttribute('comment-count'),
      postType: el.getAttribute('post-type'),
      permalink: el.getAttribute('permalink'),
      created: el.getAttribute('created-timestamp'),
      url: 'https://www.reddit.com' + el.getAttribute('permalink'),
    })))`,
  });
  console.log(`Extracted ${results.length} posts`);
  return results;
}

/** Navigate to a subreddit
 * @requires None (navigates automatically) */
export async function navigateSubreddit(browser, { subreddit, sort, timeframe } = {}) {
  let url = `https://www.reddit.com/r/${subreddit}/${sort ? sort + '/' : ''}`;
  if (sort === 'top' && timeframe) {
    url += `?t=${timeframe}`;
  }
  console.log(`Navigating to subreddit: ${url}`);
  await browser.navigate({ url });
  await browser.wait({ selector: 'shreddit-post', timeout: 5000 });
  console.log('Subreddit page loaded');
}

/** Extract subreddit info → { name, displayName, description, weeklyActiveUsers, isSubscribed }
 * @requires Current page is a subreddit page (with shreddit-subreddit-header) */
export async function extractSubredditInfo(browser) {
  console.log('Extracting subreddit info...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const h = document.querySelector('shreddit-subreddit-header');
      if (!h) return { error: 'no header' };
      return {
        name: h.getAttribute('name'),
        displayName: h.getAttribute('display-name'),
        description: h.getAttribute('description'),
        weeklyActiveUsers: h.getAttribute('weekly-active-users'),
        isSubscribed: h.hasAttribute('is-subscribed'),
      };
    })())`,
  });
  if (result.error) {
    console.log('Subreddit header not found');
  } else {
    console.log(
      `Subreddit: ${result.displayName || result.name}, active users: ${result.weeklyActiveUsers}`,
    );
  }
  return result;
}

/** Extract current post detail → { title, author, subreddit, score, comments, postType, created, body, permalink }
 * @requires Current page is a post detail page */
export async function extractPostDetail(browser) {
  console.log('Extracting post detail...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const p = document.querySelector('shreddit-post');
      if (!p) return { error: 'post not found' };
      const bodyEl = [...p.children].find(ch => ch.getAttribute('slot') === 'text-body');
      return {
        title: p.getAttribute('post-title'),
        author: p.getAttribute('author'),
        subreddit: p.getAttribute('subreddit-prefixed-name'),
        score: p.getAttribute('score'),
        comments: p.getAttribute('comment-count'),
        postType: p.getAttribute('post-type'),
        created: p.getAttribute('created-timestamp'),
        body: bodyEl?.innerText?.trim() || '',
        permalink: p.getAttribute('permalink'),
      };
    })())`,
  });
  if (result.error) {
    console.log('Post not found');
  } else {
    console.log(
      `Post: "${result.title}" by ${result.author} | score ${result.score}, ${result.comments} comments`,
    );
  }
  return result;
}

/** Extract comments → [{ index, author, score, depth, thingId, created, permalink, text }]
 * @requires Current page is a post detail page with comments loaded */
export async function extractComments(browser) {
  console.log('Extracting comments...');
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll('shreddit-comment')].map((c, i) => {
      const bodySlot = [...c.children].find(ch => ch.getAttribute('slot') === 'comment');
      return {
        index: i + 1,
        author: c.getAttribute('author'),
        score: c.getAttribute('score'),
        depth: parseInt(c.getAttribute('depth')),
        thingId: c.getAttribute('thingid'),
        created: c.getAttribute('created'),
        permalink: c.getAttribute('permalink'),
        text: bodySlot?.innerText?.trim() || '',
      };
    }))`,
  });
  console.log(`Extracted ${results.length} comments`);
  return results;
}

/** Format comment tree (human-readable indented tree text with scores) → string
 * @requires Current page is a post detail page with comments loaded */
export async function formatCommentTree(browser) {
  console.log('Formatting comment tree...');
  const result = await browser.evaluate({
    expression: `(() => {
      const comments = [...document.querySelectorAll('shreddit-comment')];
      const lines = comments.map(c => {
        const bodySlot = [...c.children].find(ch => ch.getAttribute('slot') === 'comment');
        const depth = parseInt(c.getAttribute('depth'));
        const author = c.getAttribute('author');
        const score = c.getAttribute('score');
        const text = (bodySlot?.innerText?.trim() || '[GIF/media]').split('\\n').join(' ');
        const prefix = depth === 0 ? '' : '\u2502' + '  \u2502'.repeat(depth - 1) + '  \u251c\u2500 ';
        return prefix + '[' + score + '\u2191] ' + author + ': ' + text;
      });
      return lines.join('\\n');
    })()`,
  });
  console.log('Comment tree formatted');
  return result;
}

/** Inject global post collector (for virtual scrolling pages) → { collected }
 * @requires Current page is a Reddit home or subreddit page */
export async function initPostCollector(browser) {
  console.log('Injecting post collector...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      window.__redditPosts = [];
      window.__redditSeen = new Set();
      const collect = () => {
        document.querySelectorAll('shreddit-post').forEach(el => {
          const permalink = el.getAttribute('permalink');
          if (permalink && !window.__redditSeen.has(permalink)) {
            window.__redditSeen.add(permalink);
            window.__redditPosts.push({
              index: window.__redditPosts.length + 1,
              title: el.getAttribute('post-title'),
              author: el.getAttribute('author'),
              subreddit: el.getAttribute('subreddit-prefixed-name'),
              score: el.getAttribute('score'),
              comments: el.getAttribute('comment-count'),
              postType: el.getAttribute('post-type'),
              permalink,
              created: el.getAttribute('created-timestamp'),
              url: 'https://www.reddit.com' + permalink,
            });
          }
        });
        return window.__redditPosts.length;
      };
      return { collected: collect() };
    })())`,
  });
  console.log(`Collector injected, initially collected ${result.collected} posts`);
  return result;
}

/** Scroll and collect new posts → { collected }
 * @requires initPostCollector called first */
export async function scrollAndCollect(browser, { amount } = {}) {
  console.log(`Scrolling ${amount || 2000}px and collecting...`);
  await browser.scroll({ direction: 'down', amount: Number(amount) || 2000 });
  await browser.wait({ duration: 1500 });
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      document.querySelectorAll('shreddit-post').forEach(el => {
        const permalink = el.getAttribute('permalink');
        if (permalink && !window.__redditSeen.has(permalink)) {
          window.__redditSeen.add(permalink);
          window.__redditPosts.push({
            index: window.__redditPosts.length + 1,
            title: el.getAttribute('post-title'),
            author: el.getAttribute('author'),
            subreddit: el.getAttribute('subreddit-prefixed-name'),
            score: el.getAttribute('score'),
            comments: el.getAttribute('comment-count'),
            postType: el.getAttribute('post-type'),
            permalink,
            created: el.getAttribute('created-timestamp'),
            url: 'https://www.reddit.com' + permalink,
          });
        }
      });
      return { collected: window.__redditPosts.length };
    })())`,
  });
  console.log(`Total collected: ${result.collected} posts`);
  return result;
}

/** Read collected posts → [{ index, title, author, subreddit, score, comments, postType, permalink, created, url }]
 * @requires initPostCollector called first */
export async function getCollectedPosts(browser, { limit } = {}) {
  const n = Number(limit) || 0;
  console.log(`Reading collected posts${n > 0 ? ` (limit: ${n})` : ''}...`);
  const results = await browser.evaluate({
    expression: `JSON.stringify(${n > 0 ? `window.__redditPosts.slice(0, ${n})` : 'window.__redditPosts'})`,
  });
  console.log(`Returned ${results.length} posts`);
  return results;
}

/** Full workflow: detect login → if logged in and subreddit provided, navigate and extract feed */
export default async function (browser, args) {
  const { loggedIn } = await detectLogin(browser);
  if (!loggedIn) {
    console.log('Not logged in. Please log in to Reddit in the browser and retry.');
    return { loggedIn: false };
  }
  if (args && args.subreddit) {
    await navigateSubreddit(browser, { subreddit: args.subreddit });
  }
  return await extractFeed(browser);
}

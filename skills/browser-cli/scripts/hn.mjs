// scripts/hn.mjs — Hacker News recipe functions
// Each function: (browser, args?) => Promise<result>
// browser.evaluate() auto-unwraps { value } and JSON.parse, so expression
// that returns JSON.stringify(...) will yield a parsed JS object directly.

/** Detect login state → { loggedIn, username }
 * @requires Current tab is on news.ycombinator.com */
export async function detectLogin(browser) {
  console.log('Detecting login state...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const loggedIn = !!document.querySelector('#logout');
      const username = document.querySelector('#me')?.innerText || null;
      return { loggedIn, username };
    })())`,
  });
  console.log('Login state:', result.loggedIn ? `logged in (${result.username})` : 'not logged in');
  return result;
}

/** Navigate to a category page
 * category: 'top' (default) | 'new' | 'ask' | 'show' | 'jobs'
 * @requires None */
export async function navigateTo(browser, { category } = {}) {
  const urlMap = {
    top: 'https://news.ycombinator.com/',
    new: 'https://news.ycombinator.com/newest',
    ask: 'https://news.ycombinator.com/ask',
    show: 'https://news.ycombinator.com/show',
    jobs: 'https://news.ycombinator.com/jobs',
  };
  const cat = category || 'top';
  const url = urlMap[cat] || 'https://news.ycombinator.com/';
  console.log(`Navigating to ${cat}: ${url}`);
  await browser.navigate({ url });
  await browser.wait({ selector: '.athing', timeout: 5000 });
  console.log('Page loaded');
}

/** Extract posts from the current list page → [{ index, id, title, url, site, score, user, age, comments }]
 * @requires Current page is a HN post list page */
export async function extractPosts(browser) {
  console.log('Extracting posts...');
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll('.athing')].map((el, i) => {
      const titleLink = el.querySelector('.titleline > a');
      const siteStr = el.querySelector('.sitestr')?.innerText || '';
      const sub = el.nextElementSibling;
      const score = sub?.querySelector('.score')?.innerText || '';
      const user = sub?.querySelector('.hnuser')?.innerText || '';
      const age = sub?.querySelector('.age a')?.innerText || '';
      const links = [...(sub?.querySelectorAll('a') || [])];
      const last = links[links.length - 1];
      const comments = last?.innerText?.includes('comment') || last?.innerText === 'discuss'
        ? last.innerText : '';
      return {
        index: i + 1,
        id: el.id,
        title: titleLink?.innerText || '',
        url: titleLink?.href || '',
        site: siteStr,
        score, user, age, comments,
      };
    }))`,
  });
  console.log(`Extracted ${results.length} posts`);
  return results;
}

/** Navigate to a post's comment page → https://news.ycombinator.com/item?id=<id>
 * @requires None */
export async function navigateToPost(browser, { id }) {
  const url = `https://news.ycombinator.com/item?id=${id}`;
  console.log(`Navigating to post: ${url}`);
  await browser.navigate({ url });
  await browser.wait({ selector: '.comment-tree, .fatitem', timeout: 5000 });
  console.log('Post page loaded');
}

/** Extract post metadata → { title, url, score, user, age }
 * @requires Current page is a HN post detail page (/item?id=...) */
export async function extractPostDetail(browser) {
  console.log('Extracting post detail...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const fat = document.querySelector('.fatitem');
      if (!fat) return null;
      return {
        title: fat.querySelector('.titleline > a')?.innerText || '',
        url: fat.querySelector('.titleline > a')?.href || '',
        score: fat.querySelector('.score')?.innerText || '',
        user: fat.querySelector('.hnuser')?.innerText || '',
        age: fat.querySelector('.age a')?.innerText || '',
      };
    })())`,
  });
  if (result) {
    console.log(`Post: "${result.title}" by ${result.user} | ${result.score}`);
  } else {
    console.log('.fatitem not found — may not be on a post detail page');
  }
  return result;
}

/** Extract all comments → [{ id, depth, user, age, text }]
 * Multi-paragraph text is joined with \n\n.
 * @requires Current page is a HN post detail page */
export async function extractComments(browser) {
  console.log('Extracting comments...');
  const results = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const flat = [...document.querySelectorAll('.comtr')].map(el => {
        const depth = parseInt(el.querySelector('.ind')?.getAttribute('indent') || '0');
        const ct = el.querySelector('.commtext');
        const parts = [];
        if (ct) {
          for (const node of ct.childNodes) {
            const t = node.nodeType === 3 ? node.textContent.trim()
              : (node.innerText?.trim() || node.textContent?.trim() || '');
            if (t) parts.push(t);
          }
        }
        return {
          id: el.id,
          depth,
          user: el.querySelector('.hnuser')?.innerText || '[deleted]',
          age: el.querySelector('.age a')?.innerText || '',
          text: parts.join('\\n\\n'),
          children: [],
        };
      });
      const roots = [];
      const stack = [];
      for (const node of flat) {
        while (stack.length > node.depth) stack.pop();
        if (stack.length === 0) {
          roots.push(node);
        } else {
          stack[stack.length - 1].children.push(node);
        }
        stack.push(node);
      }
      return roots;
    })())`,
  });
  const count = (nodes) => nodes.reduce((n, c) => n + 1 + count(c.children), 0);
  console.log(`Extracted ${count(results)} comments (${results.length} top-level)`);
  return results;
}

/** Format comment tree (human-readable indented tree text) → string
 * @requires Current page is a HN post detail page */
export async function formatCommentTree(browser) {
  console.log('Formatting comment tree...');
  const tree = await extractComments(browser);
  const lines = [];
  const render = (nodes, depth) => {
    for (const c of nodes) {
      const text = (c.text || '[deleted]').replace(/\n/g, ' ');
      const prefix = depth === 0 ? '' : '\u2502' + '  \u2502'.repeat(depth - 1) + '  \u251c\u2500 ';
      lines.push(prefix + '[' + c.user + ']: ' + text);
      render(c.children, depth + 1);
    }
  };
  render(tree, 0);
  console.log('Comment tree formatted');
  return lines.join('\n');
}

/** Click the "More" link at the bottom of the list page to go to the next page
 * @requires Current page is a HN post list page with .morelink visible */
export async function nextPage(browser) {
  console.log('Clicking More to load next page...');
  await browser.click({ selector: '.morelink' });
  await browser.wait({ selector: '.athing', timeout: 5000 });
  console.log('Next page loaded');
}

/** Full workflow: navigate to a category and extract posts */
export default async function (browser, args) {
  await navigateTo(browser, { category: args?.category || 'top' });
  return await extractPosts(browser);
}

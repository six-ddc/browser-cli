// scripts/quora.mjs — Quora recipe functions
// Each function: (browser, args?) => Promise<result>
// browser.evaluate() auto-unwraps { value } and JSON.parse, so expression
// that returns JSON.stringify(...) will yield a parsed JS object directly.

/** Detect login state → { loggedIn, username }
 * @requires Current tab is on quora.com */
export async function detectLogin(browser) {
  console.log('Detecting login state...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const avatarEl = document.querySelector('img[alt*="Profile photo for"]');
      const loggedIn = !!avatarEl;
      const username = loggedIn ? avatarEl.alt.replace('Profile photo for ', '') : null;
      return { loggedIn, username };
    })())`,
  });
  console.log('Login state:', result.loggedIn ? `logged in (${result.username})` : 'not logged in');
  return result;
}

/** Navigate to a Quora search results page
 * @requires None */
export async function navigateToSearch(browser, { query, type, time } = {}) {
  const params = new URLSearchParams({ q: query || '' });
  if (type) params.set('type', type); // question | answer | post | profile | topic | space
  if (time) params.set('time', time); // hour | day | week | month | year
  const url = `https://www.quora.com/search?${params}`;
  console.log(`Navigating to search: ${url}`);
  await browser.navigate({ url });
  await browser.wait({ selector: '.puppeteer_test_question_component_base', timeout: 8000 });
  console.log('Search page loaded');
}

/** Extract search results (questions) from the current search page
 * → [{ index, title, url, answerCount, followers }]
 * @requires Current page is a Quora search results page (/search?q=...) */
export async function extractSearchResults(browser) {
  console.log('Extracting search results...');
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll('.puppeteer_test_question_component_base')].map((el, i) => {
      const titleEl = el.querySelector('.puppeteer_test_question_title');
      const allLinks = [...el.querySelectorAll('a')];
      const titleLink = allLinks.find(a => a.href.includes('quora.com/') && !a.href.includes('/search'));
      const text = el.innerText || '';
      const answersMatch = text.match(/(\\d[\\d,.K]+)\\s*answers?/i);
      const followersMatch = text.match(/·\\s*([\\d.K]+)\\s*\\n/);
      return {
        index: i + 1,
        title: titleEl?.innerText?.trim() || '',
        url: titleLink?.href || '',
        answerCount: answersMatch?.[1] || null,
        followers: followersMatch?.[1] || null,
      };
    }).filter(r => r.title))`,
  });
  console.log(`Extracted ${results.length} search results`);
  return results;
}

/** Navigate to a question page by URL
 * @requires None */
export async function navigateToQuestion(browser, { url }) {
  console.log(`Navigating to question: ${url}`);
  await browser.navigate({ url });
  await browser.wait({ selector: '.puppeteer_test_question_title', timeout: 8000 });
  console.log('Question page loaded');
}

/** Extract question metadata from the current question page
 * → { title, questionUrl, topicTags }
 * @requires Current page is a Quora question page (quora.com/<QuestionSlug>) */
export async function extractQuestionMeta(browser) {
  console.log('Extracting question metadata...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const titleEl = document.querySelector('.puppeteer_test_question_title');
      return {
        title: titleEl?.innerText?.trim() || document.title.replace(' - Quora', ''),
        questionUrl: window.location.href,
        topicTags: [...document.querySelectorAll('.puppeteer_test_question_main a[href*="/topic/"]')]
          .map(a => a.innerText?.trim()).filter(Boolean),
      };
    })())`,
  });
  console.log(`Question: "${result.title}"`);
  return result;
}

/** Expand all truncated "(more)" answers on the current page
 * @requires Current page is a Quora question page */
export async function expandAllAnswers(browser) {
  const count = await browser.evaluate({
    expression: `(() => {
      const btns = document.querySelectorAll('.qt_read_more');
      btns.forEach(btn => btn.click());
      return btns.length;
    })()`,
  });
  if (count > 0) {
    console.log(`Expanded ${count} truncated answers`);
    await browser.wait({ duration: 500 });
  }
  return count;
}

/** Extract answers from the current question page
 * → [{ index, author, authorUrl, space, time, answerUrl, upvotes, answerText }]
 * Automatically expands truncated answers before extraction.
 * Handles both direct answers and Space-posted answers.
 * @requires Current page is a Quora question page */
export async function extractAnswers(browser) {
  await expandAllAnswers(browser);
  console.log('Extracting answers...');
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll('[class*="dom_annotate_question_answer_item_"]')].map((card, i) => {
      const content = card.querySelector('.puppeteer_test_answer_content');
      const upvoteBtn = card.querySelector('.puppeteer_test_votable_upvote_button');
      const allLinks = [...card.querySelectorAll('a')];
      const authorLink = allLinks.find(a => a.href.includes('quora.com/profile/') && a.innerText.trim());
      const timeLink = allLinks.find(a => a.href.includes('/answer/')) ||
        allLinks.find(a => {
          try { return new URL(a.href).pathname.length > 1 && a.innerText.trim() && !a.href.includes('/profile/'); }
          catch { return false; }
        });
      const spaceName = card.querySelector('.puppeteer_test_tribe_name');
      const upvoteCount = (upvoteBtn?.innerText || '').replace(/Upvote\\s*\\.?\\s*/g, '').replace(/·/g, '').trim();
      return {
        index: i + 1,
        author: authorLink?.innerText?.trim() || null,
        authorUrl: authorLink?.href || null,
        space: spaceName?.innerText?.trim() || null,
        time: timeLink?.innerText?.trim() || null,
        answerUrl: timeLink?.href || null,
        upvotes: upvoteCount,
        answerText: content?.innerText || '',
      };
    }))`,
  });
  console.log(`Extracted ${results.length} answers`);
  return results;
}

/** Scroll down to load more answers via infinite scroll
 * @requires Current page is a Quora question page */
export async function loadMoreAnswers(browser) {
  console.log('Scrolling to load more answers...');
  await browser.evaluate({ expression: 'window.scrollTo(0, document.body.scrollHeight)' });
  await browser.wait({ duration: 2000 });
  console.log('Scrolled');
}

/** Full workflow: search for a query and extract question results */
export default async function (browser, args) {
  await navigateToSearch(browser, { query: args?.query || '' });
  return await extractSearchResults(browser);
}

// scripts/google.mjs — Google recipe functions
// Each function: (browser, args?) => Promise<result>
// browser.evaluate() auto-unwraps { value } and JSON.parse, so expression
// that returns JSON.stringify(...) will yield a parsed JS object directly.

/** Search and navigate to results page (direct URL navigation to avoid bfcache disconnection)
 * @requires None */
export async function search(browser, { query, type } = {}) {
  const typeMap = { images: 'isch', news: 'nws' };
  const tbm = typeMap[type];
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}${tbm ? `&tbm=${tbm}` : ''}`;
  console.log(`Search: "${query}"${type ? ` (type: ${type})` : ''}`);
  await browser.navigate({ url });
  console.log('Waiting for search results...');
  await browser.wait({ selector: '#search', timeout: 5000 });
  console.log('Search results loaded');
}

/** Extract web search results → [{ index, title, url, snippet, displayedUrl }]
 * @requires Current page is a Google web search results page */
export async function extractResults(browser) {
  console.log('Extracting search results...');
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll(".MjjYud")].map((el, i) => {
      const h3 = el.querySelector("h3");
      if (!h3) return null;
      const link = h3.closest("a") || el.querySelector("a[href]");
      return {
        index: i + 1,
        title: h3.innerText || "",
        url: link?.href || "",
        snippet: el.querySelector(".VwiC3b")?.innerText || "",
        displayedUrl: el.querySelector("cite")?.innerText || ""
      };
    }).filter(Boolean))`,
  });
  console.log(`Extracted ${results.length} search results`);
  return results;
}

/** Extract news search results → [{ index, title, source, date, snippet, url }]
 * @requires Current page is a Google News search results page (tbm=nws) */
export async function extractNewsResults(browser) {
  console.log('Extracting news results...');
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll("#search .SoaBEf")].map((el, i) => ({
      index: i + 1,
      title: el.querySelector("[role='heading']")?.innerText || "",
      source: el.querySelector(".CEMjEf, .NUnG9d")?.innerText || "",
      date: el.querySelector(".OSrXXb span, .ZE0LJd span")?.innerText || "",
      snippet: el.querySelector(".UqSP2b")?.innerText || "",
      url: el.closest("a")?.href || el.querySelector("a")?.href || ""
    })).filter(r => r.title))`,
  });
  console.log(`Extracted ${results.length} news results`);
  return results;
}

/** Extract image search results → [{ index, title, source, site, thumbnail }]
 * @requires Current page is a Google Image search results page (tbm=isch) */
export async function extractImageResults(browser) {
  console.log('Extracting image results...');
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll("#search [data-lpage]")].slice(0, 20).map((el, i) => ({
      index: i + 1,
      title: el.querySelector(".toI8Rb")?.innerText || el.querySelector("img")?.alt || "",
      source: el.getAttribute("data-lpage") || "",
      site: (() => {
        const spans = [...el.querySelectorAll("span")];
        return spans.find(s => !s.querySelector("*") && s.innerText && !s.innerText.includes(" - "))?.innerText || "";
      })(),
      thumbnail: el.querySelector("img")?.src || ""
    })))`,
  });
  console.log(`Extracted ${results.length} image results`);
  return results;
}

/** Apply time filter
 * @requires Current page is a Google search results page */
export async function applyTimeFilter(browser, { range }) {
  // range: 'h' (past hour), 'd' (past 24h), 'w' (past week), 'm' (past month), 'y' (past year)
  console.log(`Applying time filter: qdr:${range}`);
  await browser.click({ selector: '#hdtb-tls' });
  await browser.wait({ duration: 1000 });
  await browser.click({ selector: '.mTpL7c.XhWQv' });
  await browser.wait({ selector: 'a[href*="tbs=qdr"]', timeout: 3000 });
  const result = await browser.evaluate({
    expression: `(() => {
      const links = [...document.querySelectorAll("a[href*='tbs=qdr']")];
      const target = links.find(a => a.href?.includes("qdr:${range}"));
      if (target) { target.click(); return "filter applied"; }
      return "filter not found";
    })()`,
  });
  console.log(
    result === 'filter applied' ? `Time filter applied (qdr:${range})` : 'Filter link not found',
  );
  return result;
}

/** Full workflow: search and extract results */
export default async function (browser, args) {
  await search(browser, { query: args.query, type: args.type });
  if (args.type === 'images') {
    return await extractImageResults(browser);
  } else if (args.type === 'news') {
    return await extractNewsResults(browser);
  }
  return await extractResults(browser);
}

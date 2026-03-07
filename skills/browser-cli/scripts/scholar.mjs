// scripts/scholar.mjs — Google Scholar recipe functions
// Each function: (browser, args?) => Promise<result>
// browser.evaluate() auto-unwraps { value } and JSON.parse, so expression
// that returns JSON.stringify(...) will yield a parsed JS object directly.

/** Search Google Scholar and navigate to results page (direct URL navigation)
 * @requires None */
export async function search(browser, { query, yearFrom, sort } = {}) {
  let url = `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`;
  if (yearFrom) url += `&as_ylo=${yearFrom}`;
  if (sort === 'date') url += `&scisbd=1`;
  console.log(
    `Scholar search: "${query}"${yearFrom ? ` (since ${yearFrom})` : ''}${sort === 'date' ? ' (sort by date)' : ''}`,
  );
  await browser.navigate({ url });
  await browser.wait({ selector: '#gs_res_ccl', timeout: 8000 });
  console.log('Search results loaded');
}

/** Extract search results → [{ index, title, url, authors, venue, year, publisher, snippet, citedBy, citedByUrl, relatedUrl, versionsText, pdfUrl, pdfSource }]
 * @requires Current page is a Google Scholar search/cited-by results page */
export async function extractResults(browser) {
  console.log('Extracting results...');
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll(".gs_r.gs_or.gs_scl")].map((el, i) => {
      const ri = el.querySelector('.gs_ri');
      if (!ri) return null;
      const aText = ri.querySelector('.gs_a')?.innerText || '';
      const parts = aText.split(/\\s-\\s/);
      const flb = ri.querySelector('.gs_fl.gs_flb');
      const links = [...(flb?.querySelectorAll('a') || [])];
      const citedLink = links.find(a => /^Cited by/.test(a.innerText));
      const versionsLink = links.find(a => /^All \\d/.test(a.innerText));
      return {
        index: i + 1,
        title: ri.querySelector('.gs_rt a')?.innerText || ri.querySelector('.gs_rt')?.innerText || '',
        url: ri.querySelector('.gs_rt a')?.href || '',
        authors: parts[0]?.trim() || '',
        venue: parts.length >= 3 ? parts.slice(1, -1).join(' - ').trim() : '',
        publisher: parts.length >= 2 ? parts[parts.length - 1]?.trim() : '',
        snippet: ri.querySelector('.gs_rs')?.innerText || '',
        citedBy: citedLink?.innerText || '',
        citedByUrl: citedLink?.href || '',
        relatedUrl: links.find(a => a.innerText === 'Related articles')?.href || '',
        versionsText: versionsLink?.innerText || '',
        pdfUrl: el.querySelector('.gs_ggs a')?.href || '',
        pdfSource: el.querySelector('.gs_ggs .gs_ctg2')?.innerText || '',
      };
    }).filter(Boolean))`,
  });
  console.log(`Extracted ${results.length} results`);
  return results;
}

/** Get result count and related searches from current page
 * @requires Current page is a Google Scholar results page */
export async function extractMeta(browser) {
  console.log('Extracting page metadata...');
  const result = await browser.evaluate({
    expression: `JSON.stringify({
      resultCount: document.querySelector('#gs_ab_md')?.innerText || '',
      relatedSearches: [...document.querySelectorAll('.gs_qsuggest_wrap a')].map(a => a.innerText),
    })`,
  });
  console.log(`Result count: ${result.resultCount}`);
  return result;
}

/** Navigate to the "Cited by" page for a given result
 * @requires citedByUrl from a previous extractResults call */
export async function navigateCitedBy(browser, { url }) {
  console.log('Navigating to cited-by page...');
  await browser.navigate({ url });
  await browser.wait({ selector: '#gs_res_ccl', timeout: 8000 });
  console.log('Cited-by page loaded');
}

/** Navigate to the next page of results
 * @requires Current page is a Scholar results page with pagination */
export async function nextPage(browser) {
  console.log('Navigating to next page...');
  const result = await browser.evaluate({
    expression: `(() => {
      const links = [...document.querySelectorAll('#gs_n a')];
      const next = links.find(a => a.innerText.trim() === 'Next');
      if (next) { next.click(); return 'clicked'; }
      return 'no next page';
    })()`,
  });
  if (result === 'clicked') {
    await browser.wait({ selector: '#gs_res_ccl', timeout: 8000 });
    console.log('Next page loaded');
  } else {
    console.log('No next page available');
  }
  return result;
}

/** Full workflow: search and extract results */
export default async function (browser, args) {
  await search(browser, { query: args.query, yearFrom: args.yearFrom, sort: args.sort });
  return await extractResults(browser);
}

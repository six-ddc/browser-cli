// scripts/weixin.mjs — 搜狗微信搜索 recipe functions
// Each function: (browser, args?) => Promise<result>
// browser.evaluate() auto-unwraps { value } and JSON.parse, so expression
// that returns JSON.stringify(...) will yield a parsed JS object directly.

/** 搜索关键词 → 跳转到搜索结果页（直接 URL 导航，避免 bfcache 断连）
 * @requires 无 */
export async function search(browser, { keyword }) {
  console.log(`搜索: "${keyword}"`);
  await browser.navigate({
    url: `https://weixin.sogou.com/weixin?type=2&query=${encodeURIComponent(keyword)}`,
  });
  console.log('等待搜索结果加载...');
  await browser.wait({ selector: '.news-list', timeout: 5000 });
  console.log('搜索结果已加载');
}

/** 提取搜索结果列表 → [{ index, title, url, account, date, snippet }]
 * @requires 当前页面为搜狗微信搜索结果页（.news-list 存在） */
export async function extractResults(browser) {
  console.log('提取搜索结果...');
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll(".news-list > li")].map((el, i) => ({
      index: i + 1,
      title: el.querySelector("h3 a")?.innerText || "",
      url: el.querySelector("h3 a")?.href || "",
      account: el.querySelector(".all-time-y2")?.innerText || "",
      date: el.querySelector(".s2")?.innerText || "",
      snippet: el.querySelector(".txt-info")?.innerText || "",
    })))`,
  });
  console.log(`提取到 ${results.length} 条搜索结果`);
  return results;
}

/** 翻到下一页 → "next page" | "no next page"
 * @requires 当前页面为搜狗微信搜索结果页 */
export async function nextPage(browser) {
  console.log('点击下一页...');
  const result = await browser.evaluate({
    expression: `(() => {
      const links = [...document.querySelectorAll(".p-fy a")];
      const next = links.find(a => a.innerText === "下一页");
      if (next) { next.click(); return "next page"; }
      return "no next page";
    })()`,
  });
  if (result === 'next page') {
    console.log('等待下一页加载...');
    await browser.wait({ selector: '.news-list', timeout: 5000 });
    console.log('下一页已加载');
  } else {
    console.log('已是最后一页');
  }
  return result;
}

/** 打开文章并提取内容 → { title, author, date, content } | { error }
 * @requires 目标文章 URL 已提取（从搜索结果 href） */
export async function openArticle(browser, { url }) {
  console.log(`导航到文章: ${url}`);
  await browser.navigate({ url });
  await browser.wait({ duration: 2000 });
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const title = document.querySelector("#activity-name")?.innerText?.trim() || "";
      const author = document.querySelector("#js_name")?.innerText?.trim() || "";
      const date = document.querySelector("#publish_time")?.innerText?.trim() || "";
      const content = document.querySelector("#js_content")?.innerText?.trim() || "";
      if (!content) {
        const errorTitle = document.querySelector(".weui-msg__title")?.innerText?.trim();
        if (errorTitle) return { error: errorTitle };
      }
      return { title, author, date, content };
    })())`,
  });
  if (result.error) {
    console.log(`文章不可用: ${result.error}`);
  } else {
    console.log(`文章: "${result.title}" by ${result.author} (${result.date})`);
  }
  return result;
}

/** 完整流程：搜索关键词 → 提取结果列表 */
export default async function (browser, args) {
  await search(browser, { keyword: args.keyword });
  return await extractResults(browser);
}

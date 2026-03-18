// scripts/weibo.mjs — 微博 recipe functions
// Each function: (browser, args?) => Promise<result>
// browser.evaluate() auto-unwraps { value } and JSON.parse, so expression
// that returns JSON.stringify(...) will yield a parsed JS object directly.
// 所有交互通过页面点击，不直接调用 API（反风控）

/** 检测登录状态 → { loggedIn }
 * @requires 当前标签页在 weibo.com 任意页面 */
export async function detectLogin(browser) {
  console.log('检测登录状态...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const loginBtn = !!document.querySelector('.woo-box-flex [class*=LoginBtn]');
      const visitor = !!document.querySelector('[class*=visitor]');
      return { loggedIn: !loginBtn && !visitor };
    })())`,
  });
  console.log('登录状态:', result.loggedIn ? '已登录' : '未登录');
  return result;
}

/** 搜索关键词 → 跳转到搜索结果页
 * @requires 无（会自动导航） */
export async function search(browser, { keyword }) {
  console.log(`搜索: "${keyword}"`);
  await browser.navigate({ url: `https://s.weibo.com/weibo?q=${encodeURIComponent(keyword)}` });
  console.log('等待搜索结果加载...');
  await browser.wait({ duration: 3000 });
  console.log('搜索结果已加载');
}

/** 提取首页 Feed 帖子 → [{ index, author, time, content, reposts, comments, likes, postUrl }]
 * @requires 当前页面为微博首页 (weibo.com/) */
export async function extractFeed(browser) {
  console.log('提取首页 Feed...');
  const results = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const num = t => { const n = (t || "").replace(/[^0-9]/g, ""); return n || "0"; };
      const toLarge = src => src.replace(/orj\\d+/, "large").replace(/thumb\\d+/, "large").replace(/mw\\d+/, "large");
      return [...document.querySelectorAll("article")].map((el, i) => ({
        index: i + 1,
        author: el.querySelector("a[class*=name]")?.innerText?.trim() || "",
        time: el.querySelector("a[class*=time]")?.innerText?.trim() || "",
        content: el.querySelector("[class*=_wbtext_]")?.innerText?.trim() || "",
        reposts: num(el.querySelector("i.woo-font--retweet")?.parentElement?.parentElement?.innerText),
        comments: num(el.querySelector("i.woo-font--comment")?.parentElement?.parentElement?.innerText),
        likes: num(el.querySelector(".woo-like-count")?.innerText),
        images: [...el.querySelectorAll("img.woo-picture-img, div.picture img")].map(img => toLarge(img.src)),
        postUrl: el.querySelector("a[class*=time]")?.href || ""
      }));
    })())`,
  });
  console.log(`提取到 ${results.length} 条 Feed`);
  return results;
}

/** 提取搜索结果 → [{ index, author, time, content, reposts, comments, likes, images, postUrl }]
 * @requires 当前页面为搜索结果页 (s.weibo.com/weibo?q=...) */
export async function extractSearchResults(browser) {
  console.log('提取搜索结果...');
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll('[action-type="feed_list_item"]')].map((el, i) => {
      const acts = [...el.querySelectorAll(".card-act li")];
      const actText = idx => acts[idx]?.innerText?.trim()?.replace(/[^0-9]/g, "") || "0";
      const fullText = el.querySelector('p.txt[node-type="feed_list_content_full"]');
      const briefText = el.querySelector('p.txt[node-type="feed_list_content"]');
      const media = el.querySelector('[node-type="fl_pic_list"]');
      const picIds = (media?.getAttribute("action-data")?.match(/pic_ids=([^&]*)/)?.[1] || "").split(",").filter(Boolean);
      const images = picIds.map(id => "https://wx1.sinaimg.cn/large/" + id + ".jpg");
      return {
        index: i + 1,
        author: el.querySelector(".name")?.innerText?.trim() || "",
        time: el.querySelector(".from a")?.innerText?.trim() || "",
        content: (fullText || briefText)?.innerText?.trim() || "",
        reposts: actText(0),
        comments: actText(1),
        likes: actText(2),
        images,
        postUrl: el.querySelector(".from a")?.href || ""
      };
    }))`,
  });
  console.log(`提取到 ${results.length} 条搜索结果`);
  return results;
}

/** 提取帖子详情 → { author, time, content, reposts, comments, likes, images }
 * @requires 当前页面为帖子详情页 (weibo.com/{uid}/{mid}) */
export async function extractPost(browser) {
  console.log('提取帖子详情...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const num = t => { const n = (t || "").replace(/[^0-9]/g, ""); return n || "0"; };
      const detail = document.querySelector("[class*=_detail_]") || document;
      const toLarge = src => src.replace(/orj\\d+/, "large").replace(/thumb\\d+/, "large").replace(/mw\\d+/, "large");
      const picImgs = detail.querySelectorAll("div.picture img");
      const wooImgs = detail.querySelectorAll("img.woo-picture-img");
      const images = [...(picImgs.length ? picImgs : wooImgs)].map(img => toLarge(img.src));
      return {
        author: detail.querySelector("a[class*=name]")?.innerText?.trim() || "",
        time: detail.querySelector("a[class*=time]")?.innerText?.trim() || "",
        content: detail.querySelector("[class*=_wbtext_]")?.innerText?.trim() || "",
        reposts: num(detail.querySelector("i.woo-font--retweet")?.parentElement?.parentElement?.innerText),
        comments: num(detail.querySelector("i.woo-font--comment")?.parentElement?.parentElement?.innerText),
        likes: num(detail.querySelector(".woo-like-count")?.innerText),
        images
      };
    })())`,
  });
  console.log(
    `帖子: by ${result.author} | 转发${result.reposts} 评论${result.comments} 赞${result.likes} | 图片${result.images.length}张`,
  );
  return result;
}

/** 打开帖子评论区（点击评论图标）
 * @requires 当前页面为帖子详情页 */
export async function openComments(browser) {
  console.log('打开评论区...');
  await browser.click({ selector: 'i.woo-font--comment' });
  await browser.wait({ duration: 1500 });
  console.log('评论区已打开');
}

/** 提取评论列表 → [{ author, content, date, likes, liked, subComments }]
 * @requires 当前页面为帖子详情页且评论区已展开（先调用 openComments） */
export async function extractComments(browser) {
  console.log('提取评论...');
  const results = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const parseItem = (el) => {
        const con = el.querySelector(".con1 .text, .con2 .text");
        const spans = con ? [...con.querySelectorAll("span")] : [];
        const authorLinks = [...el.querySelectorAll(':scope > div a[href*="/u/"]')];
        const authorEl = authorLinks.find(a => a.innerText?.trim());
        return {
          author: authorEl?.innerText?.trim() || "",
          content: spans.length > 0 ? spans[spans.length - 1]?.innerText?.trim() || "" : con?.innerText?.trim() || "",
          date: el.querySelector(".info div:first-child")?.innerText?.trim() || "",
          likes: el.querySelector(".woo-like-count")?.innerText?.trim() || "0",
          liked: !!el.querySelector("button.woo-like-main.woo-like-liked")
        };
      };
      const topComments = [...document.querySelectorAll(".item1")];
      return topComments.map(el => {
        const main = parseItem(el);
        const subs = [...el.querySelectorAll(".item2")].map(sub => parseItem(sub));
        return { ...main, subComments: subs.filter(s => s.author || s.content) };
      });
    })())`,
  });
  console.log(`提取到 ${results.length} 条评论`);
  return results;
}

/** 滚动加载并收集评论 → { collected }
 * 评论区使用虚拟滚动，DOM 中仅保留可见评论。多次调用此函数边滚边收集。
 * @requires 当前页面为帖子详情页且评论区已展开 */
export async function scrollComments(browser, { amount, limit } = {}) {
  // 首次调用时注入收集器
  await browser.evaluate({
    expression: `(() => {
      if (window.__wbComments) return;
      window.__wbComments = [];
      window.__wbCommentSeen = new Set();
    })()`,
  });
  // 滚动页面加载更多评论
  const scrollAmount = Number(amount) || 2000;
  console.log(`滚动 ${scrollAmount}px 加载评论...`);
  await browser.scroll({ direction: 'down', amount: scrollAmount });
  await browser.wait({ duration: 1500 });
  // 收集当前可见的评论
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const parseItem = (el) => {
        const con = el.querySelector(".con1 .text, .con2 .text");
        const spans = con ? [...con.querySelectorAll("span")] : [];
        const authorLinks = [...el.querySelectorAll(':scope > div a[href*="/u/"]')];
        const authorEl = authorLinks.find(a => a.innerText?.trim());
        return {
          author: authorEl?.innerText?.trim() || "",
          content: spans.length > 0 ? spans[spans.length - 1]?.innerText?.trim() || "" : con?.innerText?.trim() || "",
          date: el.querySelector(".info div:first-child")?.innerText?.trim() || "",
          likes: el.querySelector(".woo-like-count")?.innerText?.trim() || "0",
          liked: !!el.querySelector("button.woo-like-main.woo-like-liked")
        };
      };
      document.querySelectorAll(".item1").forEach(el => {
        const main = parseItem(el);
        const key = main.author + ":" + main.content.slice(0, 50);
        if (key && !window.__wbCommentSeen.has(key)) {
          window.__wbCommentSeen.add(key);
          const subs = [...el.querySelectorAll(".item2")].map(sub => parseItem(sub)).filter(s => s.author || s.content);
          window.__wbComments.push({ ...main, subComments: subs });
        }
      });
      return { collected: window.__wbComments.length };
    })())`,
  });
  const n = Number(limit) || 0;
  console.log(`累计收集 ${result.collected} 条评论`);
  if (n > 0 && result.collected >= n) {
    console.log(`已达到 limit ${n}，停止收集`);
  }
  return result;
}

/** 读取已收集的评论 → [{ author, content, date, likes, liked, subComments }]
 * @requires 先调用 scrollComments 收集评论 */
export async function getComments(browser, { limit } = {}) {
  const n = Number(limit) || 0;
  console.log(`读取已收集评论${n > 0 ? ` (limit: ${n})` : ''}...`);
  const results = await browser.evaluate({
    expression: `JSON.stringify(${n > 0 ? `window.__wbComments.slice(0, ${n})` : 'window.__wbComments'})`,
  });
  console.log(`返回 ${results.length} 条`);
  return results;
}

/** 提取热搜榜 → [{ rank, title, hotNum, href }]（过滤广告）
 * @requires 当前页面为热搜页 (weibo.com/hot/search) */
export async function extractTrending(browser) {
  console.log('提取热搜榜...');
  const results = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const items = [...document.querySelectorAll("[class*=_item_s5b56]")];
      return items
        .map(el => {
          const isAd = !!el.querySelector("[class*=_doticon]");
          if (isAd) return null;
          const rank = el.querySelector("[class*=_ranknum]")?.innerText?.trim() || "";
          const titleEl = el.querySelector("a[class*=_tit]");
          const title = titleEl?.innerText?.trim() || "";
          const hotNum = el.querySelector("[class*=_num_s5b56]")?.innerText?.trim() || "";
          const href = titleEl?.href || "";
          if (!rank && !hotNum) return null;
          return { rank, title, hotNum, href };
        })
        .filter(Boolean);
    })())`,
  });
  console.log(`提取到 ${results.length} 条热搜`);
  return results;
}

/** 点赞/取消点赞帖子（toggle）
 * @requires 当前页面为帖子详情页 */
export async function toggleLike(browser) {
  console.log('检测点赞状态...');
  const before = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const btn = document.querySelector("button.woo-like-main");
      const liked = btn?.classList.contains("woo-like-liked") || btn?.querySelector("path")?.getAttribute("fill") === "#E04023";
      return { liked };
    })())`,
  });
  await browser.click({ selector: 'button.woo-like-main' });
  await browser.wait({ duration: 500 });
  console.log(before.liked ? '取消点赞' : '点赞');
}

/** 发表评论
 * @requires 当前页面为帖子详情页，已登录 */
export async function postComment(browser, { text, alsoRepost }) {
  console.log(`发表评论: "${text}"`);
  // 切换到评论模式
  await browser.click({ selector: 'i.woo-font--comment' });
  await browser.wait({ duration: 800 });
  const textarea = 'textarea[id^="comment-textarea-"]';
  await browser.click({ selector: textarea });
  await browser.wait({ duration: 500 });
  await browser.fill({ selector: textarea, value: text });
  await browser.wait({ duration: 500 });
  // 勾选"同时转发"
  if (alsoRepost) {
    const checked = await browser.evaluate({
      expression: `JSON.stringify({ checked: document.querySelector('input[type="checkbox"]')?.checked })`,
    });
    if (!checked.checked) {
      await browser.click({ selector: 'input[type="checkbox"]' });
      await browser.wait({ duration: 300 });
    }
  }
  await browser.evaluate({
    expression: `(() => { const btn = [...document.querySelectorAll("button")].find(b => b.innerText?.trim() === "评论"); btn?.click(); })()`,
  });
  await browser.wait({ duration: 1000 });
  console.log('评论已提交' + (alsoRepost ? '（同时转发）' : ''));
}

/** 转发帖子
 * @requires 当前页面为帖子详情页，已登录 */
export async function repost(browser, { text, alsoComment } = {}) {
  const content = text || '';
  console.log(`转发帖子${content ? `: "${content}"` : ''}`);
  // 切换到转发模式
  await browser.click({ selector: 'i.woo-font--retweet' });
  await browser.wait({ duration: 800 });
  const textarea = 'textarea[id^="comment-textarea-"]';
  if (content) {
    await browser.click({ selector: textarea });
    await browser.wait({ duration: 500 });
    await browser.fill({ selector: textarea, value: content });
    await browser.wait({ duration: 500 });
  }
  // 勾选"同时评论"
  if (alsoComment) {
    const checked = await browser.evaluate({
      expression: `JSON.stringify({ checked: document.querySelector('input[type="checkbox"]')?.checked })`,
    });
    if (!checked.checked) {
      await browser.click({ selector: 'input[type="checkbox"]' });
      await browser.wait({ duration: 300 });
    }
  }
  await browser.evaluate({
    expression: `(() => { const btn = [...document.querySelectorAll("button")].find(b => b.innerText?.trim() === "转发"); btn?.click(); })()`,
  });
  await browser.wait({ duration: 1000 });
  console.log('转发已提交' + (alsoComment ? '（同时评论）' : ''));
}

/** 注入虚拟滚动收集器（首页 Feed / 搜索页）
 * @requires 当前页面为首页 Feed 或搜索结果页 */
export async function initScrollCollector(browser) {
  console.log('注入虚拟滚动收集器...');
  const isSearch = await browser.evaluate({
    expression: `JSON.stringify({ isSearch: location.hostname === "s.weibo.com" })`,
  });
  if (isSearch.isSearch) {
    // 搜索页收集器
    const result = await browser.evaluate({
      expression: `JSON.stringify((() => {
        window.__wbPosts = [];
        window.__wbSeen = new Set();
        const collect = () => {
          document.querySelectorAll('[action-type="feed_list_item"]').forEach(el => {
            const content = el.querySelector('p.txt[node-type="feed_list_content_full"]')?.innerText?.trim()
              || el.querySelector('p.txt[node-type="feed_list_content"]')?.innerText?.trim() || "";
            const key = el.querySelector(".name")?.innerText + ":" + content.slice(0, 50);
            if (key && !window.__wbSeen.has(key)) {
              window.__wbSeen.add(key);
              const acts = [...el.querySelectorAll(".card-act li")];
              const actText = idx => acts[idx]?.innerText?.trim()?.replace(/[^0-9]/g, "") || "0";
              window.__wbPosts.push({
                index: window.__wbPosts.length + 1,
                author: el.querySelector(".name")?.innerText?.trim() || "",
                time: el.querySelector(".from a")?.innerText?.trim() || "",
                content,
                reposts: actText(0),
                comments: actText(1),
                likes: actText(2)
              });
            }
          });
          return window.__wbPosts.length;
        };
        return { collected: collect() };
      })())`,
    });
    console.log(`收集器已注入 (搜索页), 初始采集 ${result.collected} 条`);
    return result;
  } else {
    // 首页 Feed 收集器
    const result = await browser.evaluate({
      expression: `JSON.stringify((() => {
        window.__wbPosts = [];
        window.__wbSeen = new Set();
        window.__wbNum = t => { const n = (t || "").replace(/[^0-9]/g, ""); return n || "0"; };
        const collect = () => {
          document.querySelectorAll("article").forEach(el => {
            const content = el.querySelector("[class*=_wbtext_]")?.innerText?.trim() || "";
            const author = el.querySelector("a[class*=name]")?.innerText?.trim() || "";
            const key = author + ":" + content.slice(0, 50);
            if (key && !window.__wbSeen.has(key)) {
              window.__wbSeen.add(key);
              window.__wbPosts.push({
                index: window.__wbPosts.length + 1,
                author,
                time: el.querySelector("a[class*=time]")?.innerText?.trim() || "",
                content,
                reposts: window.__wbNum(el.querySelector("i.woo-font--retweet")?.parentElement?.parentElement?.innerText),
                comments: window.__wbNum(el.querySelector("i.woo-font--comment")?.parentElement?.parentElement?.innerText),
                likes: window.__wbNum(el.querySelector(".woo-like-count")?.innerText),
                postUrl: el.querySelector("a[class*=time]")?.href || ""
              });
            }
          });
          return window.__wbPosts.length;
        };
        return { collected: collect() };
      })())`,
    });
    console.log(`收集器已注入 (首页), 初始采集 ${result.collected} 条`);
    return result;
  }
}

/** 滚动一次并收集新帖子 → { collected }
 * @requires 先调用 initScrollCollector 注入收集器 */
export async function scrollAndCollect(browser, { amount } = {}) {
  const scrollAmount = Number(amount) || 1500;
  console.log(`滚动 ${scrollAmount}px 并收集...`);
  await browser.scroll({ direction: 'down', amount: scrollAmount });
  await browser.wait({ duration: 1500 });
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const isSearch = location.hostname === "s.weibo.com";
      if (isSearch) {
        document.querySelectorAll('[action-type="feed_list_item"]').forEach(el => {
          const content = el.querySelector('p.txt[node-type="feed_list_content_full"]')?.innerText?.trim()
            || el.querySelector('p.txt[node-type="feed_list_content"]')?.innerText?.trim() || "";
          const key = el.querySelector(".name")?.innerText + ":" + content.slice(0, 50);
          if (key && !window.__wbSeen.has(key)) {
            window.__wbSeen.add(key);
            const acts = [...el.querySelectorAll(".card-act li")];
            const actText = idx => acts[idx]?.innerText?.trim()?.replace(/[^0-9]/g, "") || "0";
            window.__wbPosts.push({
              index: window.__wbPosts.length + 1,
              author: el.querySelector(".name")?.innerText?.trim() || "",
              time: el.querySelector(".from a")?.innerText?.trim() || "",
              content,
              reposts: actText(0),
              comments: actText(1),
              likes: actText(2)
            });
          }
        });
      } else {
        document.querySelectorAll("article").forEach(el => {
          const content = el.querySelector("[class*=_wbtext_]")?.innerText?.trim() || "";
          const author = el.querySelector("a[class*=name]")?.innerText?.trim() || "";
          const key = author + ":" + content.slice(0, 50);
          if (key && !window.__wbSeen.has(key)) {
            window.__wbSeen.add(key);
            window.__wbPosts.push({
              index: window.__wbPosts.length + 1,
              author,
              time: el.querySelector("a[class*=time]")?.innerText?.trim() || "",
              content,
              reposts: window.__wbNum(el.querySelector("i.woo-font--retweet")?.parentElement?.parentElement?.innerText),
              comments: window.__wbNum(el.querySelector("i.woo-font--comment")?.parentElement?.parentElement?.innerText),
              likes: window.__wbNum(el.querySelector(".woo-like-count")?.innerText),
              postUrl: el.querySelector("a[class*=time]")?.href || ""
            });
          }
        });
      }
      return { collected: window.__wbPosts.length };
    })())`,
  });
  console.log(`累计采集 ${result.collected} 条`);
  return result;
}

/** 读取已收集的数据 → [{ index, author, time, content, ... }]
 * @requires 先调用 initScrollCollector 注入收集器 */
export async function getCollected(browser, { limit } = {}) {
  const n = Number(limit) || 0;
  console.log(`读取已收集数据${n > 0 ? ` (limit: ${n})` : ''}...`);
  const results = await browser.evaluate({
    expression: `JSON.stringify(${n > 0 ? `window.__wbPosts.slice(0, ${n})` : 'window.__wbPosts'})`,
  });
  console.log(`返回 ${results.length} 条`);
  return results;
}

/** 完整流程：检测登录 → 如有 keyword 则搜索并提取；否则提取首页 Feed */
export default async function (browser, args) {
  const { loggedIn } = await detectLogin(browser);
  if (!loggedIn) {
    console.log('警告: 未登录，部分功能可能受限');
  }
  if (args.keyword) {
    await search(browser, { keyword: args.keyword });
    return await extractSearchResults(browser);
  }
  return await extractFeed(browser);
}

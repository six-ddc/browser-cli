// scripts/xhs.mjs — 小红书 recipe functions
// Each function: (browser, args?) => Promise<result>
// browser.evaluate() auto-unwraps { value } and JSON.parse, so expression
// that returns JSON.stringify(...) will yield a parsed JS object directly.

/** 检测登录状态 → { loggedIn, loginModal, floatingBox }
 * @requires 当前标签页在 xiaohongshu.com 任意页面 */
export async function detectLogin(browser) {
  console.log('检测登录状态...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const loggedOut = !!document.querySelector(".side-bar-component.login-btn");
      const loginModal = !!document.querySelector(".login-modal");
      const floatingBox = !!document.querySelector(".floating-box.visible");
      return { loggedIn: !loggedOut, loginModal, floatingBox };
    })())`,
  });
  console.log(
    '登录状态:',
    result.loggedIn ? '已登录' : '未登录',
    result.loginModal ? '(弹窗可见)' : '',
    result.floatingBox ? '(浮动提示可见)' : '',
  );
  return result;
}

/** 关闭登录弹窗
 * @requires 登录弹窗已弹出（detectLogin 返回 loginModal: true） */
export async function closeLoginModal(browser) {
  console.log('关闭登录弹窗...');
  await browser.click({ selector: '.login-container .close-button' });
  console.log('登录弹窗已关闭');
}

/** 搜索关键词 → 跳转到搜索结果页
 * @requires 无（会自动导航到小红书首页） */
export async function search(browser, { keyword }) {
  console.log(`搜索: "${keyword}"`);
  await browser.navigate({ url: 'https://www.xiaohongshu.com' });
  await browser.click({ selector: '#search-input' });
  await browser.fill({ selector: '#search-input', value: keyword });
  await browser.press({ key: 'Enter' });
  console.log('等待搜索结果加载...');
  await browser.wait({ selector: 'section.note-item', timeout: 5000 });
  console.log('搜索结果已加载');
}

/** 提取搜索结果列表 → [{ index, title, author, date, likes, link }]
 * @requires 当前页面为搜索结果页（先调用 search） */
export async function extractSearchResults(browser) {
  console.log('提取搜索结果...');
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll("section.note-item")]
      .filter(el => !el.querySelector(".query-note-wrapper"))
      .map((el, i) => ({
        index: i + 1,
        title: el.querySelector(".footer .title span")?.innerText,
        author: el.querySelector(".card-bottom-wrapper .name")?.innerText,
        date: el.querySelector(".card-bottom-wrapper .time")?.innerText,
        likes: el.querySelector(".like-wrapper .count")?.innerText,
        link: el.querySelector("a.cover")?.getAttribute("href")
      })))`,
  });
  console.log(`提取到 ${results.length} 条搜索结果`);
  return results;
}

/** 提取首页推荐帖子（发现页） → [{ index, title, author, likes, link }]
 * @requires 当前页面为小红书首页（xiaohongshu.com 或 /explore） */
export async function extractExplorePosts(browser) {
  console.log('提取首页推荐帖子...');
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll("section.note-item")].map((el, i) => ({
      index: i + 1,
      title: el.querySelector(".footer .title span")?.innerText,
      author: el.querySelector(".author-wrapper .name")?.innerText,
      likes: el.querySelector(".like-wrapper .count")?.innerText,
      link: el.querySelector("a.cover")?.getAttribute("href")
    })))`,
  });
  console.log(`提取到 ${results.length} 条推荐帖`);
  return results;
}

/** 提取帖子详情 → { title, content, author, date, likes, collects, comments, tags }
 * @requires 当前页面为帖子详情页（从搜索/推荐点击进入，URL 含 xsec_token） */
export async function extractPost(browser) {
  console.log('提取帖子详情...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const title = document.querySelector("#detail-title")?.innerText || "";
      const content = document.querySelector("#detail-desc .note-text")?.innerText || "";
      const author = document.querySelector(".author-container .username")?.innerText || "";
      const date = document.querySelector(".note-content .date")?.innerText?.trim() || "";
      const num = s => { const t = document.querySelector(s)?.innerText || ""; return /^\\d/.test(t) ? t : "0"; };
      return {
        title, content, author, date,
        likes: num(".engage-bar-style .like-wrapper .count"),
        collects: num(".engage-bar-style .collect-wrapper .count"),
        comments: num(".engage-bar-style .chat-wrapper .count"),
        tags: [...document.querySelectorAll("#detail-desc a.tag")].map(a => a.innerText.replace(/^#/, ""))
      };
    })())`,
  });
  console.log(
    `帖子: "${result.title}" by ${result.author} | 赞${result.likes} 藏${result.collects} 评${result.comments}`,
  );
  return result;
}

/** 提取评论列表 → [{ author, content, date, likes, liked, replyCount, replies }]
 * @requires 当前页面为帖子详情页 */
export async function extractComments(browser) {
  console.log('提取评论...');
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll(".parent-comment")].map(el => {
      const item = el.querySelector(".comment-item");
      const likeSvg = item?.querySelector(".like svg use")?.getAttribute("xlink:href");
      const replies = [...el.querySelectorAll(".comment-item")].slice(1);
      return {
        author: item?.querySelector(".author-wrapper .name")?.innerText,
        content: item?.querySelector(".content")?.innerText,
        date: item?.querySelector(".date")?.innerText,
        likes: item?.querySelector(".like .count")?.innerText,
        liked: likeSvg === "#liked",
        replyCount: el.querySelector(".reply.icon-container .count")?.innerText,
        replies: replies.map(r => ({
          author: r.querySelector(".author-wrapper .name")?.innerText,
          content: r.querySelector(".content")?.innerText,
        }))
      };
    }))`,
  });
  console.log(`提取到 ${results.length} 条评论`);
  return results;
}

/** 检测点赞/收藏状态 → { liked, collected }
 * @requires 当前页面为帖子详情页 */
export async function detectEngageState(browser) {
  console.log('检测互动状态...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const svg = s => document.querySelector(s)?.getAttribute("xlink:href");
      return {
        liked: svg(".engage-bar-style .like-wrapper svg use") === "#liked",
        collected: svg(".engage-bar-style .collect-wrapper svg use") === "#collected",
      };
    })())`,
  });
  console.log(
    `互动状态: ${result.liked ? '已点赞' : '未点赞'}, ${result.collected ? '已收藏' : '未收藏'}`,
  );
  return result;
}

/** 注入虚拟滚动收集器（推荐页/搜索页） → { collected }
 * @requires 当前页面为首页推荐页或搜索结果页（含 section.note-item） */
export async function initScrollCollector(browser) {
  console.log('注入虚拟滚动收集器...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      window.__xhsTitles = [];
      window.__xhsSeen = new Set();
      const collect = () => {
        document.querySelectorAll("section.note-item").forEach(el => {
          const title = el.querySelector(".footer .title span")?.innerText?.trim();
          const author = el.querySelector(".author-wrapper .name")?.innerText?.trim();
          const likes = el.querySelector(".like-wrapper .count")?.innerText?.trim();
          if (title && !window.__xhsSeen.has(title)) {
            window.__xhsSeen.add(title);
            window.__xhsTitles.push({ index: window.__xhsTitles.length + 1, title, author, likes });
          }
        });
        return window.__xhsTitles.length;
      };
      return { collected: collect() };
    })())`,
  });
  console.log(`收集器已注入, 初始采集 ${result.collected} 条`);
  return result;
}

/** 滚动一次并收集新数据 → { collected }
 * @requires 先调用 initScrollCollector 注入收集器 */
export async function scrollAndCollect(browser, { amount, selector } = {}) {
  const scrollOpts = { direction: 'down', amount: Number(amount) || 1500 };
  if (selector) scrollOpts.selector = selector;
  console.log(`滚动 ${scrollOpts.amount}px 并收集...`);
  await browser.scroll(scrollOpts);
  await browser.wait({ duration: 1500 });
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const collect = () => {
        document.querySelectorAll("section.note-item").forEach(el => {
          const title = el.querySelector(".footer .title span")?.innerText?.trim();
          const author = el.querySelector(".author-wrapper .name")?.innerText?.trim();
          const likes = el.querySelector(".like-wrapper .count")?.innerText?.trim();
          if (title && !window.__xhsSeen.has(title)) {
            window.__xhsSeen.add(title);
            window.__xhsTitles.push({ index: window.__xhsTitles.length + 1, title, author, likes });
          }
        });
        return window.__xhsTitles.length;
      };
      return { collected: collect() };
    })())`,
  });
  console.log(`累计采集 ${result.collected} 条`);
  return result;
}

/** 读取已收集的数据 → [{ index, title, author, likes }]
 * @requires 先调用 initScrollCollector 注入收集器 */
export async function getCollected(browser, { limit } = {}) {
  const n = Number(limit) || 0;
  console.log(`读取已收集数据${n > 0 ? ` (limit: ${n})` : ''}...`);
  const results = await browser.evaluate({
    expression: `JSON.stringify(${n > 0 ? `window.__xhsTitles.slice(0, ${n})` : 'window.__xhsTitles'})`,
  });
  console.log(`返回 ${results.length} 条`);
  return results;
}

/** 获取图片轮播位置 → { current, total }
 * @requires 当前页面为帖子详情页且帖子含多图轮播（.note-slider 存在） */
export async function getSlidePosition(browser) {
  return browser.evaluate({
    expression: `JSON.stringify((() => {
      const slides = [...document.querySelectorAll(".note-slider .swiper-slide")];
      const realCount = new Set(slides.map(s => s.getAttribute("data-swiper-slide-index")).filter(Boolean)).size;
      const active = document.querySelector(".note-slider .swiper-slide-active");
      const current = Number(active?.getAttribute("data-swiper-slide-index") || 0) + 1;
      return { current, total: realCount };
    })())`,
  });
}

/** 筛选搜索结果 → "filters applied"
 * @requires 当前页面为搜索结果页 */
export async function applySearchFilters(browser, { sort, type, time } = {}) {
  const parts = [sort, type, time].filter(Boolean);
  console.log(`应用筛选: ${parts.join(', ') || '(无)'}`);
  await browser.click({ selector: '.filter' });
  await browser.wait({ selector: '.filters-wrapper', timeout: 3000 });
  const result = await browser.evaluate({
    expression: `(() => {
      const groups = [...document.querySelectorAll('.filters-wrapper .filters')];
      const click = (groupIdx, text) => {
        if (!text) return;
        const tags = [...groups[groupIdx].querySelectorAll('.tags')];
        tags.find(t => t.innerText === text)?.click();
      };
      click(0, ${JSON.stringify(sort || '')});
      click(1, ${JSON.stringify(type || '')});
      click(2, ${JSON.stringify(time || '')});
      return "filters applied";
    })()`,
  });
  console.log('筛选已应用');
  return result;
}

/** 点赞/取消点赞（toggle）
 * @requires 当前页面为帖子详情页 */
export async function toggleLike(browser) {
  const before = await detectEngageState(browser);
  await browser.click({ selector: '.engage-bar-style .like-wrapper' });
  console.log(before.liked ? '取消点赞' : '点赞');
}

/** 收藏/取消收藏（toggle）
 * @requires 当前页面为帖子详情页 */
export async function toggleCollect(browser) {
  const before = await detectEngageState(browser);
  await browser.click({ selector: '.engage-bar-style .collect-wrapper' });
  console.log(before.collected ? '取消收藏' : '收藏');
}

/** 详情页滚动加载更多评论 → { commentCount }
 * @requires 当前页面为帖子详情页 */
export async function loadMoreComments(browser, { amount } = {}) {
  console.log('滚动加载更多评论...');
  await browser.scroll({
    direction: 'down',
    amount: Number(amount) || 2000,
    selector: '.note-scroller',
  });
  await browser.wait({ duration: 1500 });
  const result = await browser.evaluate({
    expression: `JSON.stringify({ commentCount: document.querySelectorAll(".parent-comment").length })`,
  });
  console.log(`当前评论数: ${result.commentCount}`);
  return result;
}

/** 图片翻页 — 下一张
 * @requires 当前页面为帖子详情页且帖子含多图轮播 */
export async function nextSlide(browser) {
  await browser.click({ selector: '.arrow-controller.right' });
  await browser.wait({ duration: 300 });
  const pos = await getSlidePosition(browser);
  console.log(`翻页 → 第 ${pos.current}/${pos.total} 张`);
  return pos;
}

/** 图片翻页 — 上一张
 * @requires 当前页面为帖子详情页且帖子含多图轮播 */
export async function prevSlide(browser) {
  await browser.click({ selector: '.arrow-controller.left' });
  await browser.wait({ duration: 300 });
  const pos = await getSlidePosition(browser);
  console.log(`翻页 ← 第 ${pos.current}/${pos.total} 张`);
  return pos;
}

/** 图片翻页 — 回到第一张
 * @requires 当前页面为帖子详情页且帖子含多图轮播 */
export async function goToFirstSlide(browser) {
  console.log('回到第一张图片...');
  await browser.evaluate({
    expression: `(() => {
      while (!document.querySelector(".arrow-controller.left")?.classList.contains("forbidden")) {
        document.querySelector(".arrow-controller.left")?.click();
      }
    })()`,
  });
  await browser.wait({ duration: 300 });
  const pos = await getSlidePosition(browser);
  console.log(`已回到第 ${pos.current}/${pos.total} 张`);
  return pos;
}

/** 发表评论
 * @requires 当前页面为帖子详情页，且已登录 */
export async function postComment(browser, { text }) {
  console.log(`发表评论: "${text}"`);
  await browser.click({ selector: '.not-active .inner' });
  await browser.wait({ duration: 500 });
  await browser.evaluate({
    expression: `(() => {
      const el = document.querySelector("#content-textarea");
      el.focus();
      document.execCommand("selectAll");
      document.execCommand("delete");
      document.execCommand("insertText", false, ${JSON.stringify(text)});
    })()`,
  });
  await browser.wait({ duration: 500 });
  await browser.click({ selector: '.btn.submit' });
  console.log('评论已提交');
}

/** 回复评论 — 按 author 或 keyword 定位目标评论并回复
 * @requires 当前页面为帖子详情页，且已登录 */
export async function replyToComment(browser, { author, keyword, text }) {
  console.log(`回复评论: ${author ? `@${author}` : `含"${keyword}"`} → "${text}"`);
  const found = await browser.evaluate({
    expression: `(() => {
      const items = [...document.querySelectorAll(".parent-comment .comment-item")];
      const target = items.find(el => {
        const a = el.querySelector(".author-wrapper .name")?.innerText;
        const c = el.querySelector(".content")?.innerText || "";
        return ${author ? `a === ${JSON.stringify(author)}` : 'false'} || ${keyword ? `c.includes(${JSON.stringify(keyword)})` : 'false'};
      });
      target?.querySelector(".reply.icon-container")?.click();
      return target ? "found" : "not found";
    })()`,
  });
  if (found !== 'found') {
    console.log('未找到目标评论');
    return found;
  }
  await browser.wait({ duration: 500 });
  await browser.evaluate({
    expression: `(() => {
      const el = document.querySelector("#content-textarea");
      el.focus();
      document.execCommand("insertText", false, ${JSON.stringify(text)});
    })()`,
  });
  await browser.wait({ duration: 500 });
  await browser.click({ selector: '.btn.submit' });
  console.log('回复已提交');
  return 'replied';
}

/** 评论点赞 — 按 author 或 keyword 定位
 * @requires 当前页面为帖子详情页 */
export async function likeComment(browser, { author, keyword }) {
  console.log(`评论点赞: ${author ? `@${author}` : `含"${keyword}"`}`);
  const result = await browser.evaluate({
    expression: `(() => {
      const items = [...document.querySelectorAll(".parent-comment .comment-item")];
      const target = items.find(el => {
        const a = el.querySelector(".author-wrapper .name")?.innerText;
        const c = el.querySelector(".content")?.innerText || "";
        return ${author ? `a === ${JSON.stringify(author)}` : 'false'} || ${keyword ? `c.includes(${JSON.stringify(keyword)})` : 'false'};
      });
      target?.querySelector(".like .like-wrapper")?.click();
      return target ? "found" : "not found";
    })()`,
  });
  console.log(result === 'found' ? '已点赞' : '未找到目标评论');
  return result;
}

/** 删除自己的一条评论 → "delete dialog opened" | "no deletable comments"
 * @requires 当前页面为帖子详情页，且已登录 */
export async function deleteMyComment(browser) {
  console.log('删除自己的评论...');
  const result = await browser.evaluate({
    expression: `(() => {
      const ddContainers = [...document.querySelectorAll(".dropdown-container.delete-dropdown")];
      const mine = ddContainers.filter(c => c.innerHTML.includes("删除评论"));
      if (mine.length > 0) {
        mine[0].querySelector(".dropdown-items").style.display = "block";
        mine[0].querySelector(".menu-item")?.click();
        return "delete dialog opened, remaining: " + (mine.length - 1);
      }
      return "no deletable comments";
    })()`,
  });
  if (typeof result === 'string' && result.startsWith('delete dialog opened')) {
    await browser.wait({ duration: 500 });
    await browser.click({ selector: '.foot-btn.strong' });
    console.log('评论已删除');
  } else {
    console.log('没有可删除的评论');
  }
  return result;
}

/** 展开更多子回复
 * @requires 当前页面为帖子详情页，且有"展开更多回复"按钮可见 */
export async function expandReplies(browser) {
  console.log('展开更多回复...');
  await browser.click({ selector: '.reply-container .show-more' });
}

/** 完整流程：检测登录 → 搜索 → 提取结果 */
export default async function (browser, args) {
  const { loggedIn, loginModal } = await detectLogin(browser);
  if (!loggedIn && loginModal) {
    await closeLoginModal(browser);
  }
  if (args.keyword) {
    await search(browser, { keyword: args.keyword });
    return await extractSearchResults(browser);
  }
}

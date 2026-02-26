# xiaohongshu.com

> 小红书 — 生活分享社区。内容以图文/视频笔记为主。

> **Tip**: 为避免干扰用户浏览，建议先在独立标签页中操作：
>
> ```
> browser-cli tab new 'https://www.xiaohongshu.com' --group browser-cli
> ```
>
> 后续命令加 `--tab <tabId>`。

## 登录检测

**在执行任何操作之前，先检测登录状态**。未登录时推荐内容受限，且页面会弹出登录弹窗遮挡操作。

**检测登录状态**:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify((() => {
  const loggedOut = !!document.querySelector(".side-bar-component.login-btn");
  const loginModal = !!document.querySelector(".login-modal");
  const floatingBox = !!document.querySelector(".floating-box.visible");
  return {
    loggedIn: !loggedOut,
    loginModal: loginModal,
    floatingBox: floatingBox
  };
})())
EOF
```

**关键选择器**:

| 状态     | 选择器                           | 说明                           |
| -------- | -------------------------------- | ------------------------------ |
| 未登录   | `.side-bar-component.login-btn`  | 侧边栏"登录"按钮，存在即未登录 |
| 登录弹窗 | `.login-modal`                   | 登录弹窗 wrapper，弹出时存在   |
| 登录提示 | `.floating-box.visible`          | 侧边栏浮动提示"马上登录即可"   |
| 关闭弹窗 | `.login-container .close-button` | 登录弹窗右上角关闭按钮         |

**关闭登录弹窗**（未登录时自动弹出）:

```bash
browser-cli click '.login-container .close-button'
```

> **注意**: 关闭弹窗后 `.floating-box.visible`（侧边栏登录提示）仍会显示，不影响页面操作。

**推荐流程**: 检测到未登录时，提示用户在浏览器中手动登录小红书账号，然后 `browser-cli --tab <tabId> reload` 刷新页面。未登录状态下搜索和浏览功能可用，但推荐内容不够个性化，且部分交互（收藏、评论等）不可用。

## 首页推荐（发现页）

**URL 模式**: `/explore`

**导航**: `browser-cli --tab <tabId> navigate 'https://www.xiaohongshu.com/explore'`

**等待加载**: `browser-cli --tab <tabId> wait 'section.note-item' --timeout 5000`

**提取当前可见帖子**:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll("section.note-item")].map((el, i) => ({
  index: i + 1,
  title: el.querySelector(".footer .title span")?.innerText,
  author: el.querySelector(".author-wrapper .name")?.innerText,
  likes: el.querySelector(".like-wrapper .count")?.innerText,
  link: el.querySelector("a.cover")?.getAttribute("href")
})))
EOF
```

**关键选择器**（与搜索结果页共用 `section.note-item`，但字段有差异）:

| 元素     | 选择器                  | 与搜索页差异                                                  |
| -------- | ----------------------- | ------------------------------------------------------------- |
| 笔记卡片 | `section.note-item`     | 相同                                                          |
| 标题     | `.footer .title span`   | 相同                                                          |
| 作者名   | `.author-wrapper .name` | 搜索页为 `.card-bottom-wrapper .name`                         |
| 点赞数   | `.like-wrapper .count`  | 相同                                                          |
| 封面链接 | `a.cover`               | 相同                                                          |
| 发布时间 | —                       | 推荐页卡片不显示日期（搜索页有 `.card-bottom-wrapper .time`） |

**批量采集（虚拟滚动）**:

推荐页使用虚拟滚动，DOM 中仅保留当前可视区域附近的卡片（约 15–24 个），滚动后旧卡片会从 DOM 中移除。因此**不能先滚到底再一次性提取**，必须边滚边收集。

步骤 1 — 注入全局收集器：

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify((() => {
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
})())
EOF
```

步骤 2 — 循环滚动 + 收集（每次滚动后调用收集器，直到达到目标数量）：

```bash
browser-cli --tab <tabId> scroll down --amount 1500
browser-cli --tab <tabId> wait 1500
browser-cli --tab <tabId> eval 'JSON.stringify((() => { /* 同上 collect() 逻辑 */ return { collected: collect() }; })())'
# 重复直到 collected >= 目标数量
```

步骤 3 — 读取结果：

```bash
browser-cli --tab <tabId> eval 'JSON.stringify(window.__xhsTitles.slice(0, 100))'
```

> **注意**: 使用 `window.__xhsSeen`（Set）按标题去重，避免滚动边界处同一卡片被重复采集。

## 搜索

通过主页搜索框发起搜索：

```bash
browser-cli --tab <tabId> navigate 'https://www.xiaohongshu.com'
browser-cli --tab <tabId> click '#search-input'
browser-cli --tab <tabId> fill '#search-input' '<关键词>'
browser-cli --tab <tabId> press Enter
browser-cli --tab <tabId> wait 'section.note-item' --timeout 5000
```

## 搜索结果页

**URL 模式**: `/search_result?keyword=<keyword>`（由上面的搜索流程自动跳转到）

**等待加载**: `browser-cli --tab <tabId> wait 'section.note-item' --timeout 5000`

**提取搜索结果列表**:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll("section.note-item")]
  .filter(el => !el.querySelector(".query-note-wrapper"))
  .map((el, i) => ({
    index: i + 1,
    title: el.querySelector(".footer .title span")?.innerText,
    author: el.querySelector(".card-bottom-wrapper .name")?.innerText,
    date: el.querySelector(".card-bottom-wrapper .time")?.innerText,
    likes: el.querySelector(".like-wrapper .count")?.innerText,
    link: el.querySelector("a.cover")?.getAttribute("href")
  })))
EOF
```

**关键选择器**:

| 元素                       | 选择器                                       |
| -------------------------- | -------------------------------------------- |
| 笔记卡片                   | `section.note-item`                          |
| "大家都在搜"卡片（需过滤） | `section.note-item:has(.query-note-wrapper)` |
| 封面链接（含 xsec_token）  | `a.cover`                                    |
| 标题                       | `.footer .title span`                        |
| 作者名                     | `.card-bottom-wrapper .name`                 |
| 发布时间                   | `.card-bottom-wrapper .time`                 |
| 点赞数                     | `.like-wrapper .count`                       |

**筛选搜索结果**:

筛选通过 DOM 点击控制（不是 URL 参数），需要先打开筛选面板：

```bash
browser-cli --tab <tabId> click '.filter'                    # 打开/关闭筛选面板
browser-cli --tab <tabId> wait '.filters-wrapper' --timeout 3000
```

然后通过 eval 点击具体选项：

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
(() => {
  const groups = [...document.querySelectorAll('.filters-wrapper .filters')];
  // groups[0]=排序依据  groups[1]=笔记类型  groups[2]=发布时间
  // groups[3]=搜索范围  groups[4]=位置距离
  const click = (groupIdx, text) => {
    const tags = [...groups[groupIdx].querySelectorAll('.tags')];
    tags.find(t => t.innerText === text)?.click();
  };
  click(0, '最多点赞');  // 排序依据: 综合|最新|最多点赞|最多评论|最多收藏
  click(1, '图文');       // 笔记类型: 不限|视频|图文
  click(2, '一周内');     // 发布时间: 不限|一天内|一周内|半年内
  return "filters applied";
})()
EOF
```

筛选选项：

| 分组     | index | 选项                                           |
| -------- | ----- | ---------------------------------------------- |
| 排序依据 | 0     | 综合、最新、最多点赞、最多评论、最多收藏       |
| 笔记类型 | 1     | 不限、视频、图文                               |
| 发布时间 | 2     | 不限、一天内、一周内、半年内                   |
| 搜索范围 | 3     | 不限、已看过、未看过、已关注                   |
| 位置距离 | 4     | 不限、同城、附近（需浏览器已授权地理位置权限） |

> **注意**: "同城"和"附近"会触发浏览器地理位置权限弹窗，需要用户预先在浏览器中对 xiaohongshu.com 授权位置访问，否则筛选不会生效。

顶部还有频道 tab（`.channel-scroll-container .channel`）：全部、图文、视频、用户，也是 DOM 点击切换。

**翻页**: 无限滚动

```bash
browser-cli --tab <tabId> scroll down --amount 2000
browser-cli --tab <tabId> wait 2000
```

**点击进入帖子**: 直接点击 `a.cover` 链接，会跳转到 `/explore/<noteId>?xsec_token=...` 详情页。

## 帖子详情页

**URL 模式**: `/explore/<noteId>?xsec_token=...`（从搜索页点击自动带 token）

**等待加载**: `browser-cli --tab <tabId> wait '#noteContainer' --timeout 5000`

**提取帖子内容**:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify((() => {
  const title = document.querySelector("#detail-title")?.innerText || "";
  const content = document.querySelector("#detail-desc .note-text")?.innerText || "";
  const author = document.querySelector(".author-container .username")?.innerText || "";
  const date = document.querySelector(".note-content .date")?.innerText?.trim() || "";
  const num = s => { const t = document.querySelector(s)?.innerText || ""; return /^\d/.test(t) ? t : "0"; };
  const likes = num(".engage-bar-style .like-wrapper .count");
  const collects = num(".engage-bar-style .collect-wrapper .count");
  const comments = num(".engage-bar-style .chat-wrapper .count");
  const tags = [...document.querySelectorAll("#detail-desc a.tag")]
    .map(a => a.innerText.replace(/^#/, ""));
  return { title, content, author, date, likes, collects, comments, tags };
})())
EOF
```

**关键选择器**:

| 元素               | 选择器                                      |
| ------------------ | ------------------------------------------- |
| 容器               | `#noteContainer` / `.note-container`        |
| 可滚动区域         | `.note-scroller`                            |
| 标题               | `#detail-title`                             |
| 正文（含标签文字） | `#detail-desc .note-text`                   |
| 标题+正文+日期     | `.note-content`                             |
| 作者名             | `.author-container .username`               |
| 日期               | `.note-content .date`                       |
| 点赞数             | `.engage-bar-style .like-wrapper .count`    |
| 收藏数             | `.engage-bar-style .collect-wrapper .count` |
| 评论数             | `.engage-bar-style .chat-wrapper .count`    |
| 话题标签           | `#detail-desc a.tag`                        |

**图片翻页**:

多图帖子使用 Swiper 轮播，通过左右箭头翻页：

```bash
browser-cli --tab <tabId> click '.arrow-controller.right'     # 下一张
browser-cli --tab <tabId> click '.arrow-controller.left'       # 上一张
```

获取当前图片位置和总数：

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify((() => {
  const slides = [...document.querySelectorAll(".note-slider .swiper-slide")];
  const realCount = new Set(slides.map(s => s.getAttribute("data-swiper-slide-index")).filter(Boolean)).size;
  const active = document.querySelector(".note-slider .swiper-slide-active");
  const current = Number(active?.getAttribute("data-swiper-slide-index") || 0) + 1;
  return { current, total: realCount };
})())
EOF
```

| 元素       | 选择器                    | 说明                                                |
| ---------- | ------------------------- | --------------------------------------------------- |
| 轮播容器   | `.note-slider`            | Swiper 实例                                         |
| 右箭头     | `.arrow-controller.right` | 有 `.forbidden` 类时为最后一张                      |
| 左箭头     | `.arrow-controller.left`  | 有 `.forbidden` 类时为第一张                        |
| 当前 slide | `.swiper-slide-active`    | `data-swiper-slide-index` 为真实图片索引（0-based） |
| 分页圆点   | `.pagination-item .dot`   | 当前页的子元素有 `.active` 类                       |

**截取当前图片**（用于大模型理解图片内容）：

```bash
browser-cli --tab <tabId> screenshot --selector '.note-slider' --path <保存路径>
```

翻页并逐张截图的完整流程：

```bash
# 1. 先回到第一张
browser-cli --tab <tabId> eval --stdin <<'EOF'
(() => {
  while (!document.querySelector(".arrow-controller.left")?.classList.contains("forbidden")) {
    document.querySelector(".arrow-controller.left")?.click();
  }
})()
EOF
browser-cli --tab <tabId> wait 300

# 2. 截取当前图片 + 翻页，循环直到最后一张
browser-cli --tab <tabId> screenshot --selector '.note-slider' --path slide-1.png
browser-cli --tab <tabId> click '.arrow-controller.right'
browser-cli --tab <tabId> wait 300
browser-cli --tab <tabId> screenshot --selector '.note-slider' --path slide-2.png
# ... 重复直到右箭头出现 .forbidden
```

> **注意**: Swiper 的 loop 模式会在首尾各复制 slide，导致 `.swiper-slide` 总数大于实际图片数。用 `data-swiper-slide-index` 去重可得到真实图片数量。单图帖子没有 `.note-slider` 和箭头。

**滚动加载更多评论**:

> **重要**: 帖子详情页是覆盖层（overlay），页面级 `scroll down` 无效。必须指定 `--selector '.note-scroller'` 在详情页内部滚动，才能触发评论的懒加载。

```bash
browser-cli --tab <tabId> scroll down --amount 2000 --selector '.note-scroller'
browser-cli --tab <tabId> wait 1500
```

每次滚动约加载 10 条评论。重复滚动直到评论数不再增长。

**提取评论**:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll(".parent-comment")].map(el => {
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
}))
EOF
```

**评论选择器**:

| 元素                 | 选择器                                    |
| -------------------- | ----------------------------------------- |
| 顶级评论组（含回复） | `.parent-comment`                         |
| 单条评论             | `.comment-item`                           |
| 评论者名             | `.author-wrapper .name`                   |
| 评论内容             | `.content`                                |
| 评论日期             | `.date`                                   |
| 评论点赞数           | `.like .count`（"赞"=0，数字=实际点赞数） |
| 回复按钮             | `.comment-item .reply.icon-container`     |
| 展开更多回复         | `.reply-container .show-more`             |
| 子评论容器           | `.reply-container`                        |
| 子评论               | `.comment-item-sub`                       |

## 帖子交互

### 点赞 / 收藏

直接点击底部互动栏的按钮即可切换状态（toggle）：

```bash
browser-cli --tab <tabId> click '.engage-bar-style .like-wrapper'       # 点赞/取消点赞
browser-cli --tab <tabId> click '.engage-bar-style .collect-wrapper'     # 收藏/取消收藏
```

**判断当前点赞/收藏状态**：

> **重要**: `.like-wrapper` 上的 `like-active` CSS 类始终存在，**不能**作为是否已点赞的判据。必须检查 SVG icon 的 `xlink:href` 值。

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify((() => {
  const svg = s => document.querySelector(s)?.getAttribute("xlink:href");
  return {
    liked: svg(".engage-bar-style .like-wrapper svg use") === "#liked",
    collected: svg(".engage-bar-style .collect-wrapper svg use") === "#collected",
  };
})())
EOF
```

**状态对应关系**:

| 操作 | SVG href（未激活） | SVG href（已激活） | 选择器                                       |
| ---- | ------------------ | ------------------ | -------------------------------------------- |
| 点赞 | `#like`            | `#liked`           | `.engage-bar-style .like-wrapper svg use`    |
| 收藏 | `#collect`         | `#collected`       | `.engage-bar-style .collect-wrapper svg use` |

### 发表评论（回复帖子）

评论输入框是 `contentEditable` 的 `<p>` 元素（`#content-textarea`），**不是** `<input>` 或 `<textarea>`，因此 `fill` 和 `type` 命令无法使用。

步骤 1 — **激活输入框**（必须先点击，否则后续输入无效）：

> **重要**: 初始状态下输入区被 `.not-active` 覆盖层遮挡（显示"说点什么..."），必须点击 `.not-active .inner` 激活。直接点击 `#content-textarea` 或 `.not-active` 外层均无效。

```bash
browser-cli --tab <tabId> click '.not-active .inner'
browser-cli --tab <tabId> wait 500                        # 等待输入框展开，出现发送/取消按钮
```

步骤 2 — **输入文本**（通过 `execCommand`）：

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
(() => {
  const el = document.querySelector("#content-textarea");
  el.focus();
  document.execCommand("selectAll");
  document.execCommand("delete");
  document.execCommand("insertText", false, "<评论内容>");
})()
EOF
```

步骤 3 — **等待 Vue 响应后发送**（提交按钮从 `.btn.submit.gray` 变为 `.btn.submit`）：

```bash
browser-cli --tab <tabId> wait 500
browser-cli --tab <tabId> click '.btn.submit'
```

**关键选择器**:

| 元素             | 选择器               | 说明                                           |
| ---------------- | -------------------- | ---------------------------------------------- |
| 输入区激活触发器 | `.not-active .inner` | 点击后展开输入框，显示发送/取消按钮            |
| 评论输入框       | `#content-textarea`  | `contentEditable` 的 `<p>` 元素                |
| 发送按钮         | `.btn.submit`        | 有 `.gray` 类时为禁用状态，无 `.gray` 时可点击 |
| 取消按钮         | `.btn.cancel`        | 取消输入或退出回复模式                         |

### 回复评论

通过 author 或关键词定位目标评论，点击其回复按钮进入回复模式。与发表评论不同，点击回复按钮会**自动激活输入框**（无需先点击 `.not-active .inner`），输入区会显示引用文本：

```bash
# 按 author 或关键词定位评论并点击回复
browser-cli --tab <tabId> eval --stdin <<'EOF'
(() => {
  const AUTHOR = "<作者名>";      // 按作者匹配（精确）
  const KEYWORD = "<关键词>";     // 按内容关键词匹配（模糊）
  const items = [...document.querySelectorAll(".parent-comment .comment-item")];
  const target = items.find(el => {
    const author = el.querySelector(".author-wrapper .name")?.innerText;
    const content = el.querySelector(".content")?.innerText || "";
    return (AUTHOR && author === AUTHOR) || (KEYWORD && content.includes(KEYWORD));
  });
  target?.querySelector(".reply.icon-container")?.click();
  return target ? "found" : "not found";
})()
EOF
```

进入回复模式后：

- 底部输入栏出现 `.reply-content`，包含 `.reply`（"回复 @用户名"）和 `.content`（被回复的评论内容）
- 出现"取消"按钮（`.btn.cancel`）

```bash
# 检测是否处于回复模式
browser-cli --tab <tabId> eval '!!document.querySelector(".reply-content")'

# 输入回复内容（同发表评论的 execCommand 方式）
browser-cli --tab <tabId> eval --stdin <<'EOF'
(() => {
  const el = document.querySelector("#content-textarea");
  el.focus();
  document.execCommand("insertText", false, "<回复内容>");
})()
EOF

# 等待 + 发送
browser-cli --tab <tabId> wait 500
browser-cli --tab <tabId> click '.btn.submit'

# 取消回复模式
browser-cli --tab <tabId> click '.btn.cancel'
```

**展开子回复**:

点击评论的回复按钮会展开 `.reply-container`，显示部分子回复。如有更多子回复，需点击"展开"：

```bash
browser-cli --tab <tabId> click '.reply-container .show-more'    # "展开 N 条回复"
```

**评论点赞**（按 author 或关键词定位）：

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
(() => {
  const AUTHOR = "<作者名>";      // 按作者匹配（精确）
  const KEYWORD = "<关键词>";     // 按内容关键词匹配（模糊）
  const items = [...document.querySelectorAll(".parent-comment .comment-item")];
  const target = items.find(el => {
    const author = el.querySelector(".author-wrapper .name")?.innerText;
    const content = el.querySelector(".content")?.innerText || "";
    return (AUTHOR && author === AUTHOR) || (KEYWORD && content.includes(KEYWORD));
  });
  target?.querySelector(".like .like-wrapper")?.click();
  return target ? "found" : "not found";
})()
EOF
```

### 删除自己的评论

每条评论有一个 `.delete-dropdown` 区域（三个点图标），但其下拉菜单（`.dropdown-container.delete-dropdown` > `.dropdown-items`）默认 `display: none`，且只在 CSS hover 时显示。browser-cli 的 `hover` 命令无法可靠触发 Vue 的 hover 状态，因此**必须用 eval 手动展示 dropdown 并点击删除**。

> **关键区分**: 自己的评论 dropdown 文本为 `"删除评论"`，他人的为 `"举报评论"`。利用此差异定位自己的评论。

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
(() => {
  const ddContainers = [...document.querySelectorAll(".dropdown-container.delete-dropdown")];
  const mine = ddContainers.filter(c => c.innerHTML.includes("删除评论"));
  if (mine.length > 0) {
    mine[0].querySelector(".dropdown-items").style.display = "block";
    mine[0].querySelector(".menu-item")?.click();
    return "delete dialog opened, remaining: " + (mine.length - 1);
  }
  return "no deletable comments";
})()
EOF
```

弹出确认弹窗后，点击确定按钮（`div.foot-btn.strong`，不是 `<button>`）：

```bash
browser-cli --tab <tabId> wait 500
browser-cli --tab <tabId> click '.foot-btn.strong'
```

循环执行上述两步直到所有评论删除完毕。

**关键选择器**:

| 元素         | 选择器                                | 说明                                     |
| ------------ | ------------------------------------- | ---------------------------------------- |
| 三个点图标   | `.comment-menu .delete-dropdown`      | SVG 元素，CSS hover 才可见               |
| 下拉菜单容器 | `.dropdown-container.delete-dropdown` | 默认 `display: none`，需 JS 强制展示     |
| 菜单项       | `.dropdown-items .menu-item`          | 文本为"删除评论"或"举报评论"             |
| 确认删除按钮 | `.foot-btn.strong`                    | 是 `<div>` 不是 `<button>`，`click` 可用 |
| 取消删除按钮 | `.foot-btn`（不含 `.strong`）         | 弹窗中的"取消"                           |

## 注意事项

- **搜索页点击**: 从搜索页点击帖子会跳转新页面（`/explore/<id>?xsec_token=...`），用 `browser-cli --tab <tabId> back` 返回搜索结果
- **xsec_token**: 直接访问 `/explore/<id>` 不带 token 会 404。必须从搜索页点击进入（链接自动带 token），或从 `a.cover` 的 href 中获取完整 URL
- **详情页滚动**: 帖子详情页是覆盖层（overlay），`scroll down` 不会滚动详情内容。必须使用 `scroll down --selector '.note-scroller'` 在详情页内部滚动，否则评论无法懒加载
- **虚拟滚动**: 推荐页和搜索页均使用虚拟滚动（DOM 回收），DOM 中仅保留约 15–24 个卡片。批量采集时必须边滚边收集（用 `window` 全局变量累积），不能滚完再提取
- **动态渲染**: 页面使用 CSR，必须 `wait` 等待元素出现后再提取
- **登录墙**: 未登录时会自动弹出登录弹窗，详见上方「登录检测」章节。用 `browser-cli --tab <tabId> click '.login-container .close-button'` 关闭弹窗后可继续操作
- **图片**: 图片 URL 在 `.note-container img[src]` 中，带防盗链（需 Referer header）
- **日期格式**: 搜索页日期为 `YYYY-MM-DD` 或相对时间（"1天前"），详情页可能带"编辑于"前缀和地区（"编辑于 2天前 美国"）
- **零值文本**: 点赞/收藏/评论数为 0 时，`.count` 文本分别是 `"赞"`/`"收藏"`/`"评论"` 而非 `"0"`，提取脚本已用 `num()` 处理
- **视频笔记**: `content` 可能为空（仅含标签），正文在视频中，文字描述仍在 `#detail-desc .note-text`
- **contentEditable 输入**: 评论框是 `contentEditable` 的 `<p>` 元素，`fill`/`type` 命令无效。必须先点击 `.not-active .inner` 激活输入框，再用 `eval` + `document.execCommand("insertText")` 输入文本，等待约 500ms 让 Vue 响应后提交按钮才会激活。直接点击 `#content-textarea` 或 `.not-active` 外层均无法激活
- **like-active 陷阱**: `.like-wrapper` 上的 `like-active` 类始终存在，不反映实际点赞状态。必须通过 SVG `use[xlink:href]` 值（`#like` vs `#liked`）判断

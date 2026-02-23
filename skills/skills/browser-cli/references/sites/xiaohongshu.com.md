# xiaohongshu.com

> 小红书 — 生活分享社区。内容以图文/视频笔记为主。

## 搜索

通过主页搜索框发起搜索：

```bash
browser-cli navigate 'https://www.xiaohongshu.com'
browser-cli click '#search-input'
browser-cli fill '#search-input' '<关键词>'
browser-cli press Enter
browser-cli wait 'section.note-item' --timeout 5000
```

## 搜索结果页

**URL 模式**: `/search_result?keyword=<keyword>`（由上面的搜索流程自动跳转到）

**等待加载**: `browser-cli wait 'section.note-item' --timeout 5000`

**提取搜索结果列表**:

```bash
browser-cli eval --stdin <<'EOF'
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
browser-cli click '.filter'                    # 打开/关闭筛选面板
browser-cli wait '.filters-wrapper' --timeout 3000
```

然后通过 eval 点击具体选项：

```bash
browser-cli eval --stdin <<'EOF'
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
browser-cli scroll down --amount 2000
browser-cli wait 2000
```

**点击进入帖子**: 直接点击 `a.cover` 链接，会跳转到 `/explore/<noteId>?xsec_token=...` 详情页。

## 帖子详情页

**URL 模式**: `/explore/<noteId>?xsec_token=...`（从搜索页点击自动带 token）

**等待加载**: `browser-cli wait '#noteContainer' --timeout 5000`

**提取帖子内容**:

```bash
browser-cli eval --stdin <<'EOF'
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
| 标题               | `#detail-title`                             |
| 正文（含标签文字） | `#detail-desc .note-text`                   |
| 标题+正文+日期     | `.note-content`                             |
| 作者名             | `.author-container .username`               |
| 日期               | `.note-content .date`                       |
| 点赞数             | `.engage-bar-style .like-wrapper .count`    |
| 收藏数             | `.engage-bar-style .collect-wrapper .count` |
| 评论数             | `.engage-bar-style .chat-wrapper .count`    |
| 话题标签           | `#detail-desc a.tag`                        |

**提取评论**:

```bash
browser-cli eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll(".parent-comment")].map(el => {
  const item = el.querySelector(".comment-item");
  const replies = [...el.querySelectorAll(".comment-item")].slice(1);
  return {
    author: item?.querySelector(".author-wrapper .name")?.innerText,
    content: item?.querySelector(".content")?.innerText,
    date: item?.querySelector(".date")?.innerText,
    likes: item?.querySelector(".like .count")?.innerText,
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

## 注意事项

- **搜索页点击**: 从搜索页点击帖子会跳转新页面（`/explore/<id>?xsec_token=...`），用 `browser-cli back` 返回搜索结果
- **xsec_token**: 直接访问 `/explore/<id>` 不带 token 会 404。必须从搜索页点击进入（链接自动带 token），或从 `a.cover` 的 href 中获取完整 URL
- **动态渲染**: 页面使用 CSR，必须 `wait` 等待元素出现后再提取
- **登录墙**: 未登录时可能弹出登录弹窗，用 `browser-cli click '.close-button'` 关闭
- **图片**: 图片 URL 在 `.note-container img[src]` 中，带防盗链（需 Referer header）
- **日期格式**: 搜索页日期为 `YYYY-MM-DD` 或相对时间（"1天前"），详情页可能带"编辑于"前缀和地区（"编辑于 2天前 美国"）
- **零值文本**: 点赞/收藏/评论数为 0 时，`.count` 文本分别是 `"赞"`/`"收藏"`/`"评论"` 而非 `"0"`，提取脚本已用 `num()` 处理
- **视频笔记**: `content` 可能为空（仅含标签），正文在视频中，文字描述仍在 `#detail-desc .note-text`

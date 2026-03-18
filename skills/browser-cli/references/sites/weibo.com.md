# weibo.com

> 微博 — 中国最大的社交媒体平台之一，以短文本（140字）+ 图片/视频为主。

> **Tip**: 为避免干扰用户浏览，建议先在独立标签页中操作：
>
> ```
> browser-cli tab new 'https://weibo.com' --group browser-cli
> ```
>
> 后续命令加 `--tab <tabId>`。

> **页面导航**:
>
> | 页面           | URL                              | 说明                                      |
> | -------------- | -------------------------------- | ----------------------------------------- |
> | 首页 Feed      | `weibo.com/`                     | 关注的人的微博                            |
> | 热门推荐       | `weibo.com/hot`                  | 热门 Feed 流                              |
> | 热门榜单       | `weibo.com/hot/list/1028039999`  | 按热度排序的 Feed                         |
> | 热搜榜         | `weibo.com/hot/search`           | 热搜词条列表（recipe: `extractTrending`） |
> | 文娱/生活/社会 | `weibo.com/hot/entertainment` 等 | 分类 Feed                                 |
> | 搜索结果       | `s.weibo.com/weibo?q=...`        | recipe: `search`                          |
>
> 所有 Feed 页面都可用 `extractFeed` 提取。直接 `navigate` 到目标 URL 即可。
>
> **个人分组**: gid 因人而异，需从首页 `snapshot -ic` 查看左侧栏分组链接（`weibo.com/mygroups?gid=...`）。

> **Recipe 脚本**: `scripts/weibo.mjs`，阅读源码了解可用函数及前置条件（`@requires`）。
>
> ```bash
> browser-cli --tab <tabId> script scripts/weibo.mjs --list
> browser-cli --tab <tabId> script scripts/weibo.mjs --call detectLogin
> browser-cli --tab <tabId> script scripts/weibo.mjs --call search -- --keyword "微博热搜"
> ```
>
> Agent 执行时将 `scripts/weibo.mjs` 替换为绝对路径（基于 SKILL.md 所在目录推导）。

> **Recipe 调试**: 复制函数修改选择器后通过 `script -` 重跑，或用 `eval` 单步调试选择器。

## 选择器参考

### 登录检测

| 元素     | 选择器                            | 说明         |
| -------- | --------------------------------- | ------------ |
| 登录按钮 | `.woo-box-flex [class*=LoginBtn]` | 存在即未登录 |
| 访客标识 | `[class*=visitor]`                | 存在即未登录 |

### Feed 帖子（首页/热门/榜单通用）

| 元素     | 选择器                                     | 说明                                           |
| -------- | ------------------------------------------ | ---------------------------------------------- |
| 帖子卡片 | `article`                                  |                                                |
| 作者名   | `a[class*=name]`                           | CSS Module hash 类名                           |
| 发布时间 | `a[class*=time]`                           | 同时是详情页链接                               |
| 正文     | `[class*=_wbtext_]`                        |                                                |
| 转发图标 | `i.woo-font--retweet`                      | 计数在 `parentElement.parentElement.innerText` |
| 评论图标 | `i.woo-font--comment`                      | 同上                                           |
| 点赞按钮 | `button.woo-like-main`                     | 计数在 `.woo-like-count`                       |
| 帖子图片 | `img.woo-picture-img` 或 `div.picture img` | 两种结构混用，需同时匹配                       |

### 帖子详情页 (weibo.com/{uid}/{mid})

| 元素     | 选择器                                           | 说明                      |
| -------- | ------------------------------------------------ | ------------------------- |
| 详情面板 | `[class*=_detail_]`                              |                           |
| 帖子图片 | `div.picture img` fallback `img.woo-picture-img` | URL 替换 `/large/` 得原图 |
| 已点赞   | `path[fill="#E04023"]`                           | `currentColor` 为未赞     |

### 互动操作（详情页 + Feed 内联）

评论和转发共用同一个 textarea，通过点击图标切换模式：

| 模式 | 触发                       | placeholder    | 提交按钮 | checkbox   |
| ---- | -------------------------- | -------------- | -------- | ---------- |
| 评论 | 点击 `i.woo-font--comment` | "发布你的评论" | "评论"   | "同时转发" |
| 转发 | 点击 `i.woo-font--retweet` | "说说分享心得" | "转发"   | "同时评论" |

| 元素     | 选择器                              | 说明 |
| -------- | ----------------------------------- | ---- |
| 输入框   | `textarea[id^="comment-textarea-"]` |      |
| 提交按钮 | 按 `innerText` 匹配 "评论"/"转发"   |      |
| checkbox | `input[type="checkbox"]`            |      |

### 评论区

评论区使用虚拟滚动，DOM 中仅保留可见评论。`extractComments` 只能拿到当前可见的几条，要收集更多评论需要用滚动收集器：

1. `openComments` — 点击评论图标展开评论区
2. `scrollComments` — 多次调用，每次滚动并收集新出现的评论（自动去重）
3. `getComments` — 读取所有已收集的评论（支持 `--limit`）

| 元素     | 选择器                        | 说明                                     |
| -------- | ----------------------------- | ---------------------------------------- |
| 顶级评论 | `.item1`                      | vue-recycle-scroller 虚拟滚动            |
| 子评论   | `.item2`                      | 嵌套在 item1 内                          |
| 评论内容 | `.con1 .text` / `.con2 .text` | 正文为最后一个 `span`                    |
| 评论作者 | `a[href*="/u/"]`              | 取有文字的那个（第一个可能是头像空链接） |
| 评论日期 | `.info div:first-child`       |                                          |
| 评论排序 | `.wbpro-tab3` 内的按钮        | "按热度" / "按时间"                      |

### 搜索页 (s.weibo.com/weibo?q=...)

| 元素     | 选择器                                       | 说明                                   |
| -------- | -------------------------------------------- | -------------------------------------- |
| 结果卡片 | `[action-type="feed_list_item"]`             |                                        |
| 作者名   | `.name`                                      |                                        |
| 发布时间 | `.from a`                                    |                                        |
| 正文     | `p.txt[node-type="feed_list_content_full"]`  | 优先；fallback `feed_list_content`     |
| 操作栏   | `.card-act li`                               | 依次：转发/评论/点赞                   |
| 帖子图片 | `[node-type="fl_pic_list"]` 的 `action-data` | `pic_ids=id1,id2` 拼 `/large/{id}.jpg` |

### 热搜页 (weibo.com/hot/search)

| 元素     | 选择器                 | 说明   |
| -------- | ---------------------- | ------ |
| 热搜项   | `[class*=_item_s5b56]` |        |
| 排名     | `[class*=_ranknum]`    |        |
| 标题链接 | `a[class*=_tit]`       |        |
| 热度数   | `[class*=_num_s5b56]`  |        |
| 广告标识 | `[class*=_doticon]`    | 需过滤 |

## 注意事项

- **详情页互动**: 转评赞操作需要在帖子详情页进行。从 Feed 进详情页时应使用 `tab new <postUrl>` 在新标签页打开，避免原 Feed 标签页导航后列表状态丢失
- **反风控**: 微博有较强的风控策略，所有交互必须通过页面点击（`browser.click()`），不能直接调用 API。操作之间需要添加合理延时（500-2000ms）
- **关注风控**: 关注操作极易触发频率限制，需要在用户主页（`weibo.com/u/{uid}`）操作，且每次关注间隔 10 秒以上
- **CSS Module 类名**: 微博使用 CSS Module，类名包含 hash 后缀（如 `_detail_zsq3w`），选择器应使用 `[class*=_detail_]` 模糊匹配
- **虚拟滚动**: 评论区和 Feed 都使用虚拟滚动，DOM 中仅保留可见元素。需要边滚动边收集数据（recipe: `initScrollCollector` + `scrollAndCollect`）
- **评论区延迟加载**: 帖子详情页默认不显示评论，需要先点击评论图标（`i.woo-font--comment`）加载评论区，然后等待 1-2 秒
- **图片防盗链**: sinaimg.cn CDN 会校验 Referer 头，非微博来源的 Referer 会返回 403。不带 Referer 或 `Referer: https://weibo.com` 时正常访问
- **图片 URL 规则**: 缩略图路径为 `/orj360/`、`/mw690/` 等，替换为 `/large/` 即可获取原图
- **搜索页正文**: 长文本有简要版和展开版两个元素，应优先使用 `feed_list_content_full`（展开版）
- **动态渲染**: 全站为 SPA 架构，页面切换后需要 `wait` 等待目标元素出现再进行提取

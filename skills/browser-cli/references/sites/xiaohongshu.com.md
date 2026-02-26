# xiaohongshu.com

> 小红书 — 生活分享社区。内容以图文/视频笔记为主。

> **Tip**: 为避免干扰用户浏览，建议先在独立标签页中操作：
>
> ```
> browser-cli tab new 'https://www.xiaohongshu.com' --group browser-cli
> ```
>
> 后续命令加 `--tab <tabId>`。

> **Recipe 脚本**: 本站常用操作已封装为可复用脚本，请阅读 `scripts/xhs.mjs` 源码了解可用的 recipe 函数及其前置条件（`@requires`）。
>
> ```bash
> # 调用指定函数
> browser-cli --tab <tabId> script scripts/xhs.mjs --call detectLogin
> # 传参给函数
> browser-cli --tab <tabId> script scripts/xhs.mjs --call search -- --keyword "咖啡"
> ```
>
> Agent 执行时将 `scripts/xhs.mjs` 替换为绝对路径（基于 SKILL.md 所在目录推导）。

> **Recipe 调试**: 如果某个 recipe 函数失败（如选择器变了），可以从 `scripts/xhs.mjs` 复制该函数，修改选择器后通过 `script -`（stdin）重跑：
>
> ```bash
> browser-cli --tab <tabId> script - <<'EOF'
> export default async function(browser) {
>   // 从 xhs.mjs 的 extractPost 复制出来，修改了选择器
>   return browser.evaluate({
>     expression: `JSON.stringify({
>       title: document.querySelector(".new-title-selector")?.innerText
>     })`
>   });
> }
> EOF
> ```
>
> 也可以直接用 `eval` 单步调试选择器：`browser-cli --tab <tabId> eval 'document.querySelector(".some-selector")?.innerText'`
>
> 下方选择器表格供参考。

## 选择器参考

### 登录

| 元素     | 选择器                           | 说明                           |
| -------- | -------------------------------- | ------------------------------ |
| 未登录   | `.side-bar-component.login-btn`  | 侧边栏"登录"按钮，存在即未登录 |
| 登录弹窗 | `.login-modal`                   | 登录弹窗 wrapper，弹出时存在   |
| 登录提示 | `.floating-box.visible`          | 侧边栏浮动提示"马上登录即可"   |
| 关闭弹窗 | `.login-container .close-button` | 登录弹窗右上角关闭按钮         |

### 笔记卡片（推荐页 / 搜索页共用）

| 元素                       | 选择器                                       | 备注                 |
| -------------------------- | -------------------------------------------- | -------------------- |
| 笔记卡片                   | `section.note-item`                          |                      |
| "大家都在搜"卡片（需过滤） | `section.note-item:has(.query-note-wrapper)` | 搜索页独有           |
| 封面链接                   | `a.cover`                                    | href 含 `xsec_token` |
| 标题                       | `.footer .title span`                        |                      |
| 作者名（推荐页）           | `.author-wrapper .name`                      |                      |
| 作者名（搜索页）           | `.card-bottom-wrapper .name`                 |                      |
| 发布时间（搜索页）         | `.card-bottom-wrapper .time`                 | 推荐页无日期         |
| 点赞数                     | `.like-wrapper .count`                       |                      |

### 帖子详情页

| 元素               | 选择器                                      |
| ------------------ | ------------------------------------------- |
| 容器               | `#noteContainer` / `.note-container`        |
| 可滚动区域         | `.note-scroller`                            |
| 标题               | `#detail-title`                             |
| 正文（含标签文字） | `#detail-desc .note-text`                   |
| 作者名             | `.author-container .username`               |
| 日期               | `.note-content .date`                       |
| 点赞数             | `.engage-bar-style .like-wrapper .count`    |
| 收藏数             | `.engage-bar-style .collect-wrapper .count` |
| 评论数             | `.engage-bar-style .chat-wrapper .count`    |
| 话题标签           | `#detail-desc a.tag`                        |

### 图片轮播（Swiper）

| 元素       | 选择器                    | 说明                                                |
| ---------- | ------------------------- | --------------------------------------------------- |
| 轮播容器   | `.note-slider`            | 单图帖子没有此元素                                  |
| 右箭头     | `.arrow-controller.right` | 有 `.forbidden` 类时为最后一张                      |
| 左箭头     | `.arrow-controller.left`  | 有 `.forbidden` 类时为第一张                        |
| 当前 slide | `.swiper-slide-active`    | `data-swiper-slide-index` 为真实图片索引（0-based） |
| 截图选择器 | `.note-slider`            | `screenshot --selector '.note-slider'`              |

### 评论

| 元素                 | 选择器                                | 说明                    |
| -------------------- | ------------------------------------- | ----------------------- |
| 顶级评论组（含回复） | `.parent-comment`                     |                         |
| 单条评论             | `.comment-item`                       |                         |
| 评论者名             | `.author-wrapper .name`               |                         |
| 评论内容             | `.content`                            |                         |
| 评论日期             | `.date`                               |                         |
| 评论点赞数           | `.like .count`                        | "赞"=0，数字=实际点赞数 |
| 回复按钮             | `.comment-item .reply.icon-container` |                         |
| 展开更多回复         | `.reply-container .show-more`         |                         |

### 互动状态（SVG 判定）

| 操作 | SVG href（未激活） | SVG href（已激活） | 选择器                                       |
| ---- | ------------------ | ------------------ | -------------------------------------------- |
| 点赞 | `#like`            | `#liked`           | `.engage-bar-style .like-wrapper svg use`    |
| 收藏 | `#collect`         | `#collected`       | `.engage-bar-style .collect-wrapper svg use` |

### 评论输入

| 元素             | 选择器               | 说明                                         |
| ---------------- | -------------------- | -------------------------------------------- |
| 输入区激活触发器 | `.not-active .inner` | 点击后展开输入框                             |
| 评论输入框       | `#content-textarea`  | `contentEditable` 的 `<p>`，需 `execCommand` |
| 发送按钮         | `.btn.submit`        | 有 `.gray` 类时为禁用状态                    |
| 取消按钮         | `.btn.cancel`        | 取消输入或退出回复模式                       |
| 回复模式标识     | `.reply-content`     | 存在即处于回复模式                           |

### 删除评论

| 元素         | 选择器                                | 说明                                 |
| ------------ | ------------------------------------- | ------------------------------------ |
| 下拉菜单容器 | `.dropdown-container.delete-dropdown` | 默认 `display: none`，需 JS 强制展示 |
| 菜单项       | `.dropdown-items .menu-item`          | 自己的="删除评论"，他人的="举报评论" |
| 确认删除按钮 | `.foot-btn.strong`                    | 是 `<div>` 不是 `<button>`           |

### 搜索筛选

| 分组     | index | 选项                                     |
| -------- | ----- | ---------------------------------------- |
| 排序依据 | 0     | 综合、最新、最多点赞、最多评论、最多收藏 |
| 笔记类型 | 1     | 不限、视频、图文                         |
| 发布时间 | 2     | 不限、一天内、一周内、半年内             |
| 搜索范围 | 3     | 不限、已看过、未看过、已关注             |
| 位置距离 | 4     | 不限、同城、附近（需授权地理位置）       |

## 注意事项

- **xsec_token**: 直接访问 `/explore/<id>` 不带 token 会 404。必须从搜索页点击进入（`a.cover` 的 href 自动带 token）
- **详情页滚动**: 帖子详情页是覆盖层（overlay），`scroll down` 无效。必须 `scroll down --selector '.note-scroller'`
- **虚拟滚动**: 推荐页和搜索页 DOM 中仅保留约 15–24 个卡片，必须边滚边收集（recipe: `initScrollCollector` + `scrollAndCollect`）
- **动态渲染**: CSR 页面，必须 `wait` 等待元素出现后再提取
- **登录墙**: 未登录时自动弹出登录弹窗（recipe: `detectLogin` + `closeLoginModal`）
- **图片防盗链**: `.note-container img[src]` 带 Referer 校验
- **日期格式**: 搜索页 `YYYY-MM-DD` 或相对时间；详情页可能带"编辑于"前缀和地区
- **零值文本**: 点赞/收藏/评论数为 0 时 `.count` 文本为 `"赞"`/`"收藏"`/`"评论"`（recipe 已处理）
- **contentEditable**: 评论框是 `contentEditable` 的 `<p>`，`fill`/`type` 无效，必须用 `execCommand("insertText")`（recipe: `postComment`）
- **like-active 陷阱**: `.like-wrapper` 的 `like-active` 类始终存在，必须通过 SVG `xlink:href` 判断（recipe: `detectEngageState`）
- **Swiper loop**: 首尾复制 slide 导致总数 > 实际图片数，用 `data-swiper-slide-index` 去重（recipe: `getSlidePosition`）

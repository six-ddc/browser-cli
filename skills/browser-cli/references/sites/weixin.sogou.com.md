# weixin.sogou.com

> 搜狗微信搜索 — 微信公众号文章搜索引擎，独家收录微信公众号文章内容。

> **Tip**: 为避免干扰用户浏览，建议先在独立标签页中操作：
>
> ```
> browser-cli tab new 'https://weixin.sogou.com' --group browser-cli
> ```
>
> 后续命令加 `--tab <tabId>`。

> **Recipe 脚本**: 本站常用操作已封装为可复用脚本，请阅读 `scripts/weixin.mjs` 源码了解可用的 recipe 函数及其前置条件（`@requires`）。
>
> ```bash
> # 调用指定函数
> browser-cli --tab <tabId> script scripts/weixin.mjs --call extractResults
> # 传参给函数
> browser-cli --tab <tabId> script scripts/weixin.mjs --call search -- --keyword "人工智能"
> ```
>
> Agent 执行时将 `scripts/weixin.mjs` 替换为绝对路径（基于 SKILL.md 所在目录推导）。

> **Recipe 调试**: 如果某个 recipe 函数失败（如选择器变了），可以从 `scripts/weixin.mjs` 复制该函数，修改选择器后通过 `script -`（stdin）重跑：
>
> ```bash
> browser-cli --tab <tabId> script - <<'EOF'
> export default async function(browser) {
>   // 从 weixin.mjs 的 extractResults 复制出来，修改了选择器
>   return browser.evaluate({
>     expression: `JSON.stringify([...document.querySelectorAll(".news-list > li")].slice(0,3).map(el => ({ title: el.querySelector("h3 a")?.innerText || "" })))`
>   });
> }
> EOF
> ```
>
> 也可以直接用 `eval` 单步调试选择器：`browser-cli --tab <tabId> eval 'document.querySelectorAll(".news-list > li").length'`
>
> 下方选择器表格供参考。

## 选择器参考

### 搜索页

| 元素         | 选择器                 | 说明                              |
| ------------ | ---------------------- | --------------------------------- |
| 搜索输入框   | `#query`               | 首页和结果页均可用                |
| 搜索按钮     | `input[type="submit"]` | "搜文章"按钮                      |
| 结果列表容器 | `.news-list`           | `<ul>` 元素                       |
| 单条结果     | `.news-list > li`      | 每页 10 条                        |
| 文章标题     | `h3 a`                 | 文本为标题，href 为搜狗重定向链接 |
| 缩略图       | `.img-box img`         | 文章封面图                        |
| 摘要         | `.txt-info`            | 文章正文摘要                      |
| 公众号名称   | `.all-time-y2`         | 来源公众号                        |
| 发布日期     | `.s2`                  | 格式为 `YYYY-M-DD`                |
| 翻页链接     | `.p-fy a`              | 含"下一页"等分页按钮              |

### 文章详情页（mp.weixin.qq.com）

| 元素     | 选择器             | 说明                                     |
| -------- | ------------------ | ---------------------------------------- |
| 正文容器 | `#js_content`      | 文章主体内容                             |
| 文章标题 | `#activity-name`   | 文章标题                                 |
| 公众号名 | `#js_name`         | 发布公众号名称                           |
| 发布时间 | `#publish_time`    | 格式如 `2025年8月25日 16:17`             |
| 错误标题 | `.weui-msg__title` | 不可用页面的错误信息（正常文章无此元素） |
| 错误描述 | `.weui-msg__desc`  | 不可用页面的详细说明                     |

### URL 规律

| 页面       | URL 模式                             |
| ---------- | ------------------------------------ |
| 搜索结果页 | `/weixin?type=2&query=<kw>&page=<n>` |

## 注意事项

- **弹窗拦截**: 搜索结果链接为 `target="_blank"`，直接 `click` 可能被浏览器弹窗拦截。推荐先 `eval` 提取 URL 再 `navigate`
- **重定向**: 搜狗链接（`/link?url=...`）为重定向 URL，`navigate` 会自动跟随到 `mp.weixin.qq.com` 真实地址
- **markdown 优先**: 微信文章页面用 `browser-cli --tab <tabId> markdown` 提取效果最佳，格式化输出包含标题、作者、正文和图片
- **反爬**: 频繁搜索可能触发验证码（需输入图片验证码），如结果异常检查是否出现验证码页面
- **无登录要求**: 搜索和阅读文章均不需要登录
- **日期格式**: 搜索结果页日期为 `YYYY-M-DD`（月份不补零），文章页日期为中文格式
- **每页结果数**: 固定 10 条，通过 `page` 参数翻页

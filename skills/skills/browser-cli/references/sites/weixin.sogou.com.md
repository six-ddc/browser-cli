# weixin.sogou.com

> 搜狗微信搜索 — 微信公众号文章搜索引擎，独家收录微信公众号文章内容。

## 搜索

```bash
browser-cli navigate 'https://weixin.sogou.com/'
browser-cli fill '#query' '<关键词>'
browser-cli click 'input[type="submit"]'
browser-cli wait '.news-list' --timeout 5000
```

> **注意**: `press Enter` 不生效，必须 `click 'input[type="submit"]'`（"搜文章"按钮）提交搜索。

## 搜索结果页

**URL 模式**: `/weixin?type=2&query=<keyword>&page=<n>`

**等待加载**: `browser-cli wait '.news-list' --timeout 5000`

**提取搜索结果**:

```bash
browser-cli eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll(".news-list > li")].map((el, i) => ({
  index: i + 1,
  title: el.querySelector("h3 a")?.innerText || "",
  url: el.querySelector("h3 a")?.href || "",
  account: el.querySelector(".all-time-y2")?.innerText || "",
  date: el.querySelector(".s2")?.innerText || "",
  snippet: el.querySelector(".txt-info")?.innerText || "",
})))
EOF
```

**关键选择器**:

| 元素         | 选择器                 | 说明                              |
| ------------ | ---------------------- | --------------------------------- |
| 结果列表容器 | `.news-list`           | `<ul>` 元素                       |
| 单条结果     | `.news-list > li`      | 每页 10 条                        |
| 文章标题     | `h3 a`                 | 文本为标题，href 为搜狗重定向链接 |
| 缩略图       | `.img-box img`         | 文章封面图                        |
| 摘要         | `.txt-info`            | 文章正文摘要                      |
| 公众号名称   | `.all-time-y2`         | 来源公众号                        |
| 发布日期     | `.s2`                  | 格式为 `YYYY-M-DD`                |
| 搜索输入框   | `#query`               | 首页和结果页均可用                |
| 搜索按钮     | `input[type="submit"]` | "搜文章"按钮                      |

**翻页**:

URL 参数分页 — 修改 `page` 参数：

```bash
# 第 2 页
browser-cli navigate 'https://weixin.sogou.com/weixin?type=2&query=<关键词>&page=2'
browser-cli wait '.news-list' --timeout 5000
```

或点击"下一页"：

```bash
browser-cli eval --stdin <<'EOF'
(() => {
  const links = [...document.querySelectorAll(".p-fy a")];
  const next = links.find(a => a.innerText === "下一页");
  if (next) { next.click(); return "next page"; }
  return "no next page";
})()
EOF
```

```bash
browser-cli wait '.news-list' --timeout 5000
```

## 阅读文章

搜索结果链接是搜狗重定向 URL（`/link?url=...`），最终跳转到 `mp.weixin.qq.com`。

**打开文章并提取内容**（从搜索结果提取 URL 后直接导航，避免 `target="_blank"` 弹窗拦截）：

```bash
# 先提取目标文章的 URL
browser-cli eval 'document.querySelectorAll(".news-list > li h3 a")[0]?.href'

# 然后直接导航 + markdown 提取（navigate 完成即表示页面已加载）
browser-cli navigate '<提取到的URL>'
browser-cli markdown
```

`markdown` 对所有页面状态都能正确返回：

- **正常文章** — 返回完整的标题、作者、公众号名、正文内容
- **违规/删除/过期文章** — 返回 `此内容因违规无法查看` 等错误文本，据此判断跳过即可

> **不要用 `wait '#js_content'`** — 违规或已删除的文章页面没有此元素，会白等到超时。`navigate` 返回后页面已加载完成，直接 `markdown` 即可。

如需结构化数据，可用 `eval` 提取：

```bash
browser-cli eval --stdin <<'EOF'
JSON.stringify((() => {
  const title = document.querySelector("#activity-name")?.innerText?.trim() || "";
  const author = document.querySelector("#js_name")?.innerText?.trim() || "";
  const date = document.querySelector("#publish_time")?.innerText?.trim() || "";
  const content = document.querySelector("#js_content")?.innerText?.trim() || "";
  return { title, author, date, content };
})())
EOF
```

**文章页关键选择器**（`mp.weixin.qq.com`）:

| 元素     | 选择器             | 说明                                     |
| -------- | ------------------ | ---------------------------------------- |
| 正文容器 | `#js_content`      | 文章主体内容                             |
| 文章标题 | `#activity-name`   | 文章标题                                 |
| 公众号名 | `#js_name`         | 发布公众号名称                           |
| 发布时间 | `#publish_time`    | 格式如 `2025年8月25日 16:17`             |
| 错误标题 | `.weui-msg__title` | 不可用页面的错误信息（正常文章无此元素） |
| 错误描述 | `.weui-msg__desc`  | 不可用页面的详细说明                     |

**返回搜索结果**:

```bash
browser-cli back
browser-cli wait '.news-list' --timeout 5000
```

## 注意事项

- **弹窗拦截**: 搜索结果链接为 `target="_blank"`，直接 `click` 可能被浏览器弹窗拦截。推荐先 `eval` 提取 URL 再 `navigate`
- **重定向**: 搜狗链接（`/link?url=...`）为重定向 URL，`navigate` 会自动跟随到 `mp.weixin.qq.com` 真实地址
- **markdown 优先**: 微信文章页面用 `browser-cli markdown` 提取效果最佳，格式化输出包含标题、作者、正文和图片
- **反爬**: 频繁搜索可能触发验证码（需输入图片验证码），如结果异常检查是否出现验证码页面
- **无登录要求**: 搜索和阅读文章均不需要登录
- **日期格式**: 搜索结果页日期为 `YYYY-M-DD`（月份不补零），文章页日期为中文格式
- **每页结果数**: 固定 10 条，通过 `page` 参数翻页

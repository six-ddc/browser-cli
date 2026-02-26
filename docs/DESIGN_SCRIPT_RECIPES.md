# Design: Script Named Exports (Recipe Files)

> Status: Draft  
> Date: 2026-02-26

## 动机

当前 site guide（如 `xiaohongshu.com.md`）中的复杂操作以 `eval --stdin` 形式内联在 markdown 里，AI agent 使用时需要逐条复制执行。问题：

1. **冗长易错** — 大段 heredoc eval 命令，AI 拼接时容易出错
2. **不可复用** — 同一段提取逻辑在不同工作流中反复粘贴
3. **调试困难** — eval 表达式嵌在 bash heredoc 中，出错后难以定位和修改

`script` 命令已支持 ES module 脚本（`browser` SDK 1:1 映射所有 CLI 命令），但目前一个文件只能有一个 `default` export，无法把一个站点的多个操作组织在一起。

## 方案

扩展 `script` 命令，支持 **named exports** 调用（JS 模块天然支持），实现"一个文件多个命名函数"。

### 核心改动

1. **`--call <name>`** — 调用指定的 named export（不传则调用 `default`，完全向后兼容）
2. **`--list`** — 列出文件中所有可调用的 exported 函数

仅此两项，无需名称解析、recipe 注册等额外机制。

### 用法

```bash
# 现有用法不变（调用 default export）
browser-cli script ./my-script.mjs

# 调用指定函数
browser-cli script scripts/xhs.mjs --call search -- --keyword "咖啡"

# 列出可用函数
browser-cli script scripts/xhs.mjs --list
# → detectLogin, closeLoginModal, search(keyword), extractSearchResults, ...
```

> **路径问题**：AI agent 通过 skill 执行时 cwd 不确定，但 agent 读 SKILL.md 时已知其绝对路径，
> 可以推导出同级 `scripts/xhs.mjs` 的绝对路径。无需 CLI 做任何特殊解析。

### Recipe 文件格式

Recipe 文件就是普通的 ES module（`.mjs`），区别于单一 `default export` 的脚本，它通过 **named exports** 导出多个函数：

```js
// scripts/xhs.mjs

/** 检测登录状态 → { loggedIn, loginModal, floatingBox } */
export async function detectLogin(browser) {
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const loggedOut = !!document.querySelector(".side-bar-component.login-btn");
      const loginModal = !!document.querySelector(".login-modal");
      const floatingBox = !!document.querySelector(".floating-box.visible");
      return { loggedIn: !loggedOut, loginModal, floatingBox };
    })())`,
  });
  return JSON.parse(result);
}

/** 关闭登录弹窗 */
export async function closeLoginModal(browser) {
  await browser.click({ selector: '.login-container .close-button' });
}

/** 搜索关键词 → 跳转到搜索结果页 */
export async function search(browser, { keyword }) {
  await browser.navigate({ url: 'https://www.xiaohongshu.com' });
  await browser.click({ selector: '#search-input' });
  await browser.fill({ selector: '#search-input', value: keyword });
  await browser.press({ key: 'Enter' });
  await browser.wait({ selector: 'section.note-item', timeout: 5000 });
}

/** 提取搜索结果列表 → [{ title, author, date, likes, link }] */
export async function extractSearchResults(browser) {
  const raw = await browser.evaluate({
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
  return JSON.parse(raw);
}

/** 提取帖子详情 → { title, content, author, date, likes, collects, comments, tags } */
export async function extractPost(browser) {
  const raw = await browser.evaluate({
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
  return JSON.parse(raw);
}

/** 注入虚拟滚动收集器 */
export async function initScrollCollector(browser) {
  return JSON.parse(
    await browser.evaluate({
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
    }),
  );
}

/** 也可以有 default export（可选），作为完整流程的入口 */
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
```

**关键设计点**：

- 每个函数签名统一为 `(browser, args?)` — 和 `default` export 一致
- 函数之间可以互相调用（如 `default` 里调用 `detectLogin` + `search`）
- JSDoc 注释描述参数和返回值 — `--list` 提取展示
- 文件就是普通 JS，可以直接 `node` 或其他工具执行/测试

### Recipe 文件位置

放在 SKILL.md 同级的 `scripts/` 目录下，AI agent 基于已知的 SKILL.md 路径自然能找到：

```
skills/browser-cli/
├── SKILL.md
├── scripts/
│   ├── xhs.mjs              # 小红书 recipe
│   ├── x.mjs                # X/Twitter recipe
│   └── ...                  # 按需添加
└── references/
    └── sites/
        ├── xiaohongshu.com.md   # site guide（文档 + 选择器参考）
        ├── x.com.md
        └── ...
```

命名约定：`<short-name>.mjs`，简短好记。

### Site Guide 引用方式

`xiaohongshu.com.md` 头部加入引用（路径相对于 site guide 文件位置）：

````markdown
# xiaohongshu.com

> **Recipe 脚本**: 本站常用操作已封装为可复用脚本，优先使用 recipe 调用：
>
> ```bash
> # 列出所有可用操作
> browser-cli script scripts/xhs.mjs --list
>
> # 直接调用（路径基于 skill 目录）
> browser-cli --tab <tabId> script scripts/xhs.mjs --call detectLogin
> browser-cli --tab <tabId> script scripts/xhs.mjs --call search -- --keyword "咖啡"
> browser-cli --tab <tabId> script scripts/xhs.mjs --call extractSearchResults
> ```
>
> Agent 执行时将 `scripts/xhs.mjs` 替换为绝对路径（基于 SKILL.md 所在目录推导）。
> 如果 recipe 失败，参考下方对应章节的选择器表格进行手动调试。
````

原有的手动 eval 命令和选择器表格保留 — 作为 recipe 失败时的 fallback 参考。

## AI Agent 工作流

### Happy Path（快速路径）

```
AI 读取 site guide → 发现 recipe 文件引用 → 按名调用 recipe 函数 → 返回结构化数据
```

```bash
# 1. 检测登录
browser-cli --tab 123 script /path/to/skills/browser-cli/scripts/xhs.mjs --call detectLogin
# → { "loggedIn": true, "loginModal": false }

# 2. 搜索
browser-cli --tab 123 script /path/to/skills/browser-cli/scripts/xhs.mjs --call search -- --keyword "咖啡拉花"
# → (navigates to search results)

# 3. 提取结果
browser-cli --tab 123 script /path/to/skills/browser-cli/scripts/xhs.mjs --call extractSearchResults
# → [{ title: "...", author: "...", likes: "1.2万", link: "/explore/..." }, ...]
```

### 出错时的调试流程

```
recipe 失败 → AI 看到错误（step + action + 错误信息）
           → 用 snapshot -ic 检查页面状态
           → 定位问题原因（选择器变了？页面没加载？登录弹窗？）
           → 两种修复路径：
              a) 手动执行 — 回退到 eval/click/wait 等原生命令（参考 .md 中的选择器表格）
              b) 修改脚本 — 从 recipe 复制函数 → 修改 → script - 重跑
```

**路径 a — 回退到原生命令**（最常用）：

```bash
# recipe extractSearchResults 失败了
# → 先看看页面结构
browser-cli --tab 123 snapshot -ic

# → 发现选择器变了，用新选择器手动提取
browser-cli --tab 123 eval 'JSON.stringify([...document.querySelectorAll(".new-selector")]...)'
```

**路径 b — 修改脚本重跑**（函数较复杂时）：

```bash
# 复制 extractSearchResults 函数，改一下选择器，通过 stdin 跑
browser-cli --tab 123 script - <<'EOF'
export default async function(browser) {
  // 从 recipe 中复制出来，修改了选择器
  const raw = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll(".new-note-item")]
      .map((el, i) => ({ index: i+1, title: el.querySelector(".new-title")?.innerText })))`
  });
  return JSON.parse(raw);
}
EOF
```

**关键**：recipe 文件本身就是 JS 源码，AI 可以直接阅读、理解、修改 — 不存在 YAML/DSL 的翻译层。

## 实现计划

### Phase 1：`--call` + `--list`（CLI 改动）

**涉及文件**：

| 文件                                | 改动                                       |
| ----------------------------------- | ------------------------------------------ |
| `apps/cli/src/commands/script.ts`   | 添加 `--call <name>` 和 `--list` 选项      |
| `apps/cli/src/lib/script-runner.ts` | `runScript` 接受 `call` 参数，列出 exports |
| `apps/cli/test/`                    | 新增单元测试                               |

**`script-runner.ts` 改动**（约 20 行）：

```ts
// ScriptOptions 新增
export interface ScriptOptions {
  // ...existing fields...
  /** Named export to call (default: 'default') */
  call?: string;
  /** If true, list all exported functions instead of running */
  list?: boolean;
}

// runScript 内部改动
const mod = await import(pathToFileURL(absPath).href);

if (options.list) {
  // 列出所有 function exports
  const fns = Object.entries(mod)
    .filter(([, v]) => typeof v === 'function')
    .map(([name]) => name);
  return fns;
}

const exportName = options.call ?? 'default';
const fn = mod[exportName];
if (typeof fn !== 'function') {
  const available = Object.entries(mod)
    .filter(([, v]) => typeof v === 'function')
    .map(([name]) => name);
  throw new Error(
    `Export "${exportName}" is not a function in ${scriptPath}\n` +
      `Available functions: ${available.join(', ') || '(none)'}\n` +
      `Hint: use --list to see all exported functions`,
  );
}

return await fn(browser, args);
```

**`script.ts` 改动**（约 5 行）：

```ts
export const scriptCommand = new Command('script')
  // ...existing...
  .option('-c, --call <name>', 'Call a named export instead of default')
  .option('-l, --list', 'List all exported functions in the script');
```

不需要名称解析模块。AI agent 基于 SKILL.md 路径推导绝对路径，直接传给 `script` 命令。

### Phase 2：编写 Recipe 文件

为现有 site guide 创建对应的 `.recipes.mjs` 文件：

| Site Guide           | Recipe File       | 函数                                                                                                                            |
| -------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `xiaohongshu.com.md` | `scripts/xhs.mjs` | detectLogin, closeLoginModal, search, extractSearchResults, extractPost, extractComments, initScrollCollector, scrollAndCollect |
| `x.com.md`           | `scripts/x.mjs`   | extractTweets, search, extractProfile, ...                                                                                      |
| 其他站点             | 按需添加          | -                                                                                                                               |

### Phase 3：更新 Site Guide

在每个 `.md` 文件头部添加 recipe 引用说明，指导 AI 优先使用 `--call` 方式。

### Phase 4（可选）：`--show` 选项

```bash
browser-cli script xhs.recipes.mjs --show search
```

打印指定函数的源码，方便 AI 阅读和修改。实现方式是解析 AST 或简单正则提取 export 函数块。优先级较低，AI 也可以直接读文件。

## 设计决策

### 为什么不用 YAML？

| 对比        | JS Named Exports         | YAML Recipe                       |
| ----------- | ------------------------ | --------------------------------- |
| eval 表达式 | 原生 JS 字符串，IDE 支持 | 嵌在 YAML 字符串中，转义/缩进易错 |
| debug       | 复制函数即可运行         | 需从 YAML 提取 JS 再运行          |
| 条件/循环   | 原生 JS                  | 需要设计 DSL 或不支持             |
| 新依赖      | 无                       | YAML parser                       |
| 翻译层      | 无（直接执行）           | YAML → JS 步骤序列                |
| IDE 支持    | 完整（类型检查、补全）   | 有限                              |

### 为什么不用单独的 `recipe` 命令？

- 避免概念膨胀 — `script` 已经是运行脚本的命令，`--call` 是自然扩展
- 复用全部现有基础设施（参数解析、错误报告、`--json` 输出、`--tab`）
- 用户心智模型简单：`script` 跑脚本，加 `--call` 跑指定函数

### 为什么不做名称解析？

- AI agent 读 SKILL.md 时已知其绝对路径，可以推导 `scripts/xhs.mjs` 的绝对路径
- 零额外代码 — 不需要 recipe-resolver、搜索目录、构建时复制等机制
- 用户手写脚本本身就是传路径，保持一致
- 如果未来确实需要名称解析，可以作为后续增强，不影响当前设计

### 粒度原则

每个函数做**一件可独立验证的事**：

- ✅ `detectLogin` — 检测登录状态
- ✅ `search` — 执行搜索（导航 + 输入 + 等待结果）
- ✅ `extractSearchResults` — 提取搜索结果
- ❌ `searchAndExtract` — 搜索 + 提取（组合太大，出错难定位）

组合逻辑由 AI agent 编排（或放在 `default` export 里作为"一键"入口）。

## Checklist

- [ ] Phase 1: `--call` + `--list` 实现
- [ ] Phase 1: 单元测试
- [ ] Phase 1: SKILL.md 更新 script 命令文档
- [ ] Phase 2: `scripts/xhs.mjs` 编写
- [ ] Phase 3: `xiaohongshu.com.md` 添加 recipe 引用
- [ ] Phase 2-3: 其他站点 recipe（按需）
- [ ] CLAUDE.md 更新（如有新约定）

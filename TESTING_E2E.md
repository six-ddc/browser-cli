# Manual E2E Testing Guide

browser-cli 的手动 E2E 测试流程。修改代码后运行此流程验证功能完整性。

## 准备工作

```bash
pnpm build                                    # 构建 CLI + 扩展
browser-cli stop && browser-cli start         # 重启 daemon
# 在 Chrome 中重新加载扩展: chrome://extensions → 刷新按钮
browser-cli status                            # 确认扩展已连接
```

## 测试流程

browser-cli 的所有功能已在 `/browser-cli` skill 中完整描述（安装在 `~/.claude/skills/browser-cli/SKILL.md`）。
测试时直接按照 skill 中列出的所有命令逐一验证即可。

### 测试站点

1. **小红书** (https://www.xiaohongshu.com/explore) — 主要测试站点
   - 真实生产环境：SPA 路由、动态内容、中文文本、严格 CSP、大 DOM
   - 覆盖绝大部分功能

2. **the-internet.herokuapp.com** — 补充测试站点
   - 经典 Web 自动化测试游乐场，每种 HTML 交互模式都有专门页面
   - 用于小红书上不容易找到的特定元素类型（checkbox、dropdown、drag、iframe、upload、dialog 等）

### 测试顺序

1. 先在小红书上测试 skill 中的所有功能
2. 对于需要特定 HTML 元素的功能，切换到 the-internet 对应页面测试
3. 发现问题时立即修复，修复后重新构建并重新测试该功能

## 参考实现 (agent-browser)

`.agent-browser-ref/` 目录是 [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) 的本地 clone（已加入 .gitignore）。

如果该目录不存在，先 clone：
```bash
git clone https://github.com/vercel-labs/agent-browser.git .agent-browser-ref
```

**关键参考文件：**
- `src/actions.ts` — 所有命令处理函数
- `cli/src/commands.rs` — CLI 命令解析
- `cli/src/output.rs` — 输出格式

**参考原则：**

CLI 的命令语法、参数用法、输入输出格式、功能效果等应尽量与 agent-browser 保持一致。
但由于架构差异（Playwright vs Chrome Extension），底层实现可能无法完全对齐，agent-browser 的代码仅作参考：

- **应参考的**：命令名称、参数语义、输出格式、匹配逻辑（如 `selectOption` 同时匹配 value/text/label，`waitForURL` 支持 glob 模式）
- **可能不一致的**：凡是 Playwright 通过原生 API 实现的能力（如 `page.on('console')`、`page.on('dialog')`、`page.evaluate()`），browser-cli 需要通过 extension 架构等价实现（如 `chrome.scripting.executeScript({ world: 'MAIN' })`）

**修复 bug 时的对照模式：**
1. 先查看 agent-browser 中相同功能的实现，理解预期行为
2. 确保 browser-cli 的用户可见行为与之一致（机制不同但结果一致）
3. 常见映射关系：
   - `page.evaluate()` → `chrome.scripting.executeScript({ world: 'MAIN' })`
   - `page.goBack()` / `page.goForward()` → `history.back()` / `history.forward()` via executeScript
   - `locator.screenshot()` (原生裁剪) → 全页截图 + OffscreenCanvas 裁剪
   - `page.on('console')` / `page.on('dialog')` → 通过 background script 注入 MAIN world 脚本拦截
   - 内容脚本 CSP 限制 → 通过 background script 的 `chrome.scripting.executeScript` 中转

## 已知问题

| 问题 | 说明 |
|------|------|
| `wait --text` 大页面超时 | `document.body.innerText` 在大 DOM 上开销大 |
| iframe 内命令超时 | frame bridge 通信问题 |
| 新标签页 `back`/`forward` | 无导航历史时会报错（已有错误分类和 hint） |

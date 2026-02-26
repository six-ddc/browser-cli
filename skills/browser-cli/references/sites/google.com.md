# google.com

> Google — the world's most widely used search engine.

> **Tip**: To avoid disrupting user browsing, open a dedicated tab first:
>
> ```
> browser-cli tab new 'https://www.google.com' --group browser-cli
> ```
>
> Then use `--tab <tabId>` for all subsequent commands.

## Search

Initiate a search from the homepage:

```bash
browser-cli --tab <tabId> navigate 'https://www.google.com'
browser-cli --tab <tabId> fill 'textarea[name="q"]' '<query>'
browser-cli --tab <tabId> press Enter
browser-cli --tab <tabId> wait '#search' --timeout 5000
```

Or navigate directly via URL:

```bash
browser-cli --tab <tabId> navigate 'https://www.google.com/search?q=<query>'
browser-cli --tab <tabId> wait '#search' --timeout 5000
```

## Search Results Page

**URL pattern**: `/search?q=<query>` (additional params: `&start=<offset>`, `&num=<count>`, `&tbm=<type>`)

**Wait**: `browser-cli --tab <tabId> wait '#search' --timeout 5000`

**Extract search results**:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll(".MjjYud")].map((el, i) => {
  const h3 = el.querySelector("h3");
  if (!h3) return null;
  const link = h3.closest("a") || el.querySelector("a[href]");
  return {
    index: i + 1,
    title: h3.innerText || "",
    url: link?.href || "",
    snippet: el.querySelector(".VwiC3b")?.innerText || "",
    displayed_url: el.querySelector("cite")?.innerText || ""
  };
}).filter(Boolean))
EOF
```

**Key selectors**:

| Element                  | Selector                               |
| ------------------------ | -------------------------------------- |
| Search results container | `#search`                              |
| Organic result block     | `.MjjYud` (filter by `h3` presence)    |
| Result title             | `h3` (class `LC20lb`)                  |
| Result link              | `h3` closest `<a>`, or first `a[href]` |
| Snippet text             | `.VwiC3b`                              |
| Displayed URL            | `cite`                                 |
| Search input             | `textarea[name="q"]`                   |

**Search tools (filters)**:

Open the Tools panel to access time and verbatim filters:

```bash
browser-cli --tab <tabId> click '#hdtb-tls'
browser-cli --tab <tabId> wait 1000
```

Click the "Any time" dropdown to open time filters:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
(() => {
  const btn = document.querySelector(".mTpL7c.XhWQv");
  if (btn) { btn.click(); return "time dropdown opened"; }
  return "dropdown not found";
})()
EOF
```

```bash
browser-cli --tab <tabId> wait 'a[href*="tbs=qdr"]' --timeout 3000
```

Then click the desired time range:

```bash
# Past hour / Past 24 hours / Past week / Past month / Past year
browser-cli --tab <tabId> eval --stdin <<'EOF'
(() => {
  const links = [...document.querySelectorAll("a[href*='tbs=qdr']")];
  // qdr:h = past hour, qdr:d = past 24h, qdr:w = past week, qdr:m = past month, qdr:y = past year
  const target = links.find(a => a.href?.includes("qdr:w"));
  if (target) { target.click(); return "filter applied"; }
  return "filter not found";
})()
EOF
```

Time filter values:

| Time Range    | `tbs` param |
| ------------- | ----------- |
| Past hour     | `qdr:h`     |
| Past 24 hours | `qdr:d`     |
| Past week     | `qdr:w`     |
| Past month    | `qdr:m`     |
| Past year     | `qdr:y`     |

**Pagination**:

URL-based — increment the `start` parameter by 10:

```bash
# Page 2 (results 11–20)
browser-cli --tab <tabId> navigate 'https://www.google.com/search?q=<query>&start=10'
browser-cli --tab <tabId> wait '#search' --timeout 5000
```

Or click the "Next" link:

```bash
browser-cli --tab <tabId> click '#pnnext'
browser-cli --tab <tabId> wait '#search' --timeout 5000
```

## Image Search

**URL pattern**: `/search?q=<query>&tbm=isch`

**Navigation**:

```bash
browser-cli --tab <tabId> navigate 'https://www.google.com/search?q=<query>&tbm=isch'
browser-cli --tab <tabId> wait '#search' --timeout 5000
```

**Extract image results**:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll("#search [data-lpage]")].slice(0, 20).map((el, i) => ({
  index: i + 1,
  title: el.querySelector(".toI8Rb")?.innerText || el.querySelector("img")?.alt || "",
  source: el.getAttribute("data-lpage") || "",
  site: (() => {
    const spans = [...el.querySelectorAll("span")];
    return spans.find(s => !s.querySelector("*") && s.innerText && !s.innerText.includes(" - "))?.innerText || "";
  })(),
  thumbnail: el.querySelector("img")?.src || ""
})))
EOF
```

**Key selectors**:

| Element     | Selector                  |
| ----------- | ------------------------- |
| Image card  | `#search [data-lpage]`    |
| Image title | `.toI8Rb` or `img[alt]`   |
| Source URL  | `data-lpage` attribute    |
| Site name   | first short `<span>` text |
| Thumbnail   | `img` (base64 data URI)   |

**Pagination**: Infinite scroll

```bash
browser-cli --tab <tabId> scroll down --amount 2000
browser-cli --tab <tabId> wait 2000
```

## News Search

**URL pattern**: `/search?q=<query>&tbm=nws`

**Navigation**:

```bash
browser-cli --tab <tabId> navigate 'https://www.google.com/search?q=<query>&tbm=nws'
browser-cli --tab <tabId> wait '#search' --timeout 5000
```

**Extract news results**:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll("#search .SoaBEf")].map((el, i) => ({
  index: i + 1,
  title: el.querySelector("[role='heading']")?.innerText || "",
  source: el.querySelector(".CEMjEf, .NUnG9d")?.innerText || "",
  date: el.querySelector(".OSrXXb span, .ZE0LJd span")?.innerText || "",
  snippet: el.querySelector(".UqSP2b")?.innerText || "",
  url: el.closest("a")?.href || el.querySelector("a")?.href || ""
})).filter(r => r.title))
EOF
```

**Key selectors**:

| Element     | Selector                     |
| ----------- | ---------------------------- |
| News card   | `.SoaBEf`                    |
| Title       | `[role='heading']`           |
| Source name | `.CEMjEf, .NUnG9d`           |
| Date        | `.OSrXXb span, .ZE0LJd span` |
| Snippet     | `.UqSP2b`                    |
| Link        | closest `<a>`                |

## Knowledge Panel (Right Sidebar)

When Google displays a Knowledge Panel for an entity (person, company, place, etc.), extract it from `#rhs`:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify((() => {
  const rhs = document.querySelector("#rhs");
  if (!rhs) return null;
  const title = rhs.querySelector("[data-attrid='title']")?.innerText || "";
  const subtitle = rhs.querySelector("[data-attrid='subtitle']")?.innerText || "";
  const descEl = rhs.querySelector("[data-attrid='VisualDigestDescription'], [data-attrid='description']");
  const description = descEl?.innerText || "";
  const facts = [...rhs.querySelectorAll("[data-attrid]")]
    .filter(el => {
      const a = el.getAttribute("data-attrid") || "";
      return a.includes("kc:/") || a.includes("hw:/");
    })
    .map(el => {
      const text = el.innerText || "";
      const colonIdx = text.indexOf(":");
      if (colonIdx === -1) return null;
      return {
        label: text.substring(0, colonIdx).trim(),
        value: text.substring(colonIdx + 1).trim()
      };
    }).filter(Boolean);
  return { title, subtitle, description, facts };
})())
EOF
```

**Key selectors**:

| Element       | Selector                                     |
| ------------- | -------------------------------------------- |
| Right sidebar | `#rhs`                                       |
| Entity title  | `[data-attrid='title']`                      |
| Subtitle      | `[data-attrid='subtitle']`                   |
| Description   | `[data-attrid='VisualDigestDescription']`    |
| Fact rows     | `[data-attrid]` with `kc:/` or `hw:/` prefix |

## Notes

- **Dynamic rendering**: Google uses progressive rendering; always `wait '#search'` before extraction
- **Consent page**: In some regions (EU), Google shows a cookie consent page. Dismiss with: `browser-cli --tab <tabId> click '#L2AGLb'` (Accept All button)
- **CAPTCHA**: Excessive automated queries may trigger a CAPTCHA. If extraction returns empty, check for CAPTCHA with `browser-cli --tab <tabId> snapshot -ic`
- **Selectors may change**: Google frequently updates class names. Stable selectors: `#search`, `#rhs`, `h3`, `cite`, `[data-attrid]`. Unstable: `.MjjYud`, `.VwiC3b`, `.SoaBEf`, `.UqSP2b` — if extraction fails, use `browser-cli --tab <tabId> snapshot -ic` to inspect current structure
- **Search type params**: `tbm=isch` (images), `tbm=nws` (news), `tbm=vid` (videos), `tbm=shop` (shopping)
- **Safe search**: Append `&safe=active` for safe search, `&safe=off` to disable
- **Language/region**: `&hl=en` for language, `&gl=us` for region
- **Number of results**: `&num=20` to request more results per page (default 10)

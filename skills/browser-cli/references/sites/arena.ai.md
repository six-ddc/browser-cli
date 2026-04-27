# arena.ai

> Arena.ai — multi-model AI chat arena. This guide focuses on the Direct workflow: choosing text or image models, sending prompts, waiting for responses, and extracting generated images.

> **Tip**: To avoid disrupting user browsing, open a dedicated tab first:
>
> ```
> browser-cli tab new 'https://arena.ai/text/direct' --group browser-cli
> ```
>
> Then use `--tab <tabId>` for all subsequent commands.

> **Recipe scripts**: Common operations are encapsulated as reusable script functions. Read `scripts/arena.mjs` source to see available recipe functions and their preconditions (`@requires`).
>
> ```bash
> # Select a model
> browser-cli --tab <tabId> script scripts/arena.mjs --call selectModel -- --model "gpt-5.2-chat-latest"
> # Send a Direct message and wait for the reply
> browser-cli --tab <tabId> script scripts/arena.mjs -- --model "gpt-5.2-chat-latest" --message "Say OK"
> # Generate an image and return the image URL
> browser-cli --tab <tabId> script scripts/arena.mjs --call generateImage -- --model "gpt-image-2-medium" --prompt "A red apple on a white background"
> ```
>
> When the agent runs, replace `scripts/arena.mjs` with the absolute path (derived from the SKILL.md directory).

> **Recipe debugging**: If a recipe function fails (e.g. selectors changed), copy the function from `scripts/arena.mjs`, modify the selectors, and re-run via `script -` (stdin):
>
> ```bash
> browser-cli --tab <tabId> script - <<'EOF'
> export default async function(browser) {
>   return browser.evaluate({
>     expression: `JSON.stringify([...document.querySelectorAll('ol > div')].map(el => el.innerText.trim()).filter(Boolean))`
>   });
> }
> EOF
> ```
>
> You can also debug selectors step by step with `eval`: `browser-cli --tab <tabId> eval 'document.querySelectorAll("textarea[name=\\"message\\"]").length'`
>
> See the selector tables below for reference.

## Selector Reference

### Login Detection

| State         | Selector                                | Notes                                                                          |
| ------------- | --------------------------------------- | ------------------------------------------------------------------------------ |
| Logged in     | `button` whose `innerText` contains `@` | Account menu in the sidebar; in the tested session it showed an email address. |
| Direct ready  | `textarea[name="message"]`              | Main prompt input is visible on `/text/direct` and conversation pages.         |
| Not logged in | `a[href*="login"], a[href*="sign-in"]`  | Use as a fallback check if the prompt box is missing.                          |

### Text Direct Page

**URL pattern**: `https://arena.ai/text/direct`

| Element               | Selector                                            | Notes                                                                                                              |
| --------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Mode selector         | `main button[role="combobox"]`                      | Shows `Direct` on this workflow.                                                                                   |
| Model selector button | `main button[aria-haspopup="dialog"]`               | Shows current model, e.g. `Max` or `gpt-5.2-chat-latest`.                                                          |
| Prompt textarea       | `textarea[name="message"]`                          | Placeholder changes by modality: text uses `Ask anything…`, image uses `Describe the image you want to generate…`. |
| Submit button         | `form button[type="submit"]`                        | Disabled until the textarea has text.                                                                              |
| Attachment button     | `form button` before submit with no `type="submit"` | Icon-only button; avoid for text-only Direct sends.                                                                |
| Modality buttons      | `button[data-modality-button="true"]`               | `aria-label` values include `Search`, `Image`, and `Code`.                                                         |

### Image Direct Mode

Activated by clicking `button[data-modality-button="true"][aria-label="Image"]` or `button[aria-label="Image"]`.

| Element               | Selector                                              | Notes                                                                                                               |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| Image modality button | `button[aria-label="Image"]`                          | Switches the prompt box to text-to-image mode.                                                                      |
| Image prompt textarea | `textarea[name="message"]`                            | Placeholder observed as `Describe the image you want to generate…`.                                                 |
| Default image model   | `main button[aria-haspopup="dialog"]`                 | After switching Image, the tested page auto-selected `gemini-3.1-flash-image-preview (nano-banana-2) [web-search]`. |
| Generating state      | main text contains `Generating image...`              | Poll until this disappears and an image appears.                                                                    |
| Generated image       | `main img`                                            | Filter to large images (`naturalWidth > 40`, `naturalHeight > 40`) with image-like URLs.                            |
| Image URL             | `img.currentSrc                                       |                                                                                                                     | img.src` | Tested output was a signed Cloudflare R2 PNG URL, expiring after a short interval. |
| Rate limit            | main text contains `You have reached your rate limit` | Stop polling and retry later; for `gpt-image-2 (medium)`, the page returned a 30-31 minute wait during testing.     |
| Generic failure       | main text contains `Something went wrong`             | Stop polling; the page may include a trace ID.                                                                      |

### Model Picker

Opened by clicking `main button[aria-haspopup="dialog"]`.

| Element            | Selector                                             | Notes                                                                                                                                                              |
| ------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Picker dialog      | `[role="dialog"]`                                    | Radix popover dialog.                                                                                                                                              |
| Model search input | `[role="dialog"] input[placeholder="Search models"]` | Filter by visible model name or value.                                                                                                                             |
| Category buttons   | `[role="dialog"] button`                             | Visible categories: `Text`, `Code`, `Image`, `Search`.                                                                                                             |
| Model option       | `[role="dialog"] [role="option"]`                    | Command option; click to select.                                                                                                                                   |
| Model label        | `[role="option"]` first text line                    | Example: `gpt-5.2-chat-latest`.                                                                                                                                    |
| Model value        | `[role="option"][data-value]`                        | True model identifier. Some labels differ from values, e.g. `Max` has `data-value="boss-bandit"` and `gpt-image-2 (medium)` has `data-value="gpt-image-2-medium"`. |
| Selection state    | `[role="option"][aria-selected="true"]`              | Only reliable while the picker is open.                                                                                                                            |

### Conversation Page

**URL pattern**: `https://arena.ai/c/<conversationId>`

| Element            | Selector                                   | Notes                                                                                        |
| ------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Message list       | `ol`                                       | Uses `flex-col-reverse`; in tested chats, the newest message row appears first in DOM order. |
| Message row        | `ol > div`                                 | Filter out the spacer row with class `h-0`.                                                  |
| User row           | `ol > div[class*="justify-end"]`           | User messages are right-aligned.                                                             |
| User text          | `ol > div[class*="justify-end"] .prose`    | Contains the prompt text.                                                                    |
| Assistant row      | `ol > div.mx-auto.max-w-[800px].w-full`    | Assistant response card.                                                                     |
| Assistant body     | `ol > div .prose`                          | Markdown-rendered assistant text.                                                            |
| Assistant model    | First non-empty text line in assistant row | Example: `Max`.                                                                              |
| Assistant provider | Text line after `Response provided by`     | Example observed after Max routing: `Google`.                                                |
| Generated image    | `main img`                                 | Image responses appear as actual `<img>` elements inside the conversation.                   |

## Common Interactions

### Select a Model

```bash
browser-cli --tab <tabId> script scripts/arena.mjs --call selectModel -- --model "gpt-5.2-chat-latest"
```

For non-current categories, pass the picker category explicitly:

```bash
browser-cli --tab <tabId> script scripts/arena.mjs --call selectModel -- --category Image --model "gpt-image-1.5-high-fidelity"
```

The robust flow is: click `main button[aria-haspopup="dialog"]`, optionally click the category button (`Text`, `Code`, `Image`, `Search`), first try to click the already-rendered `[role="option"][data-value="<model>"]`, then fall back to filtering with `[role="dialog"] input[placeholder="Search models"]` and clicking the matching option. Arena's search is scoped to the active category, so do not rely on cross-category search.

### Send and Receive a Direct Message

```bash
browser-cli --tab <tabId> script scripts/arena.mjs -- --model "gpt-5.2-chat-latest" --message "Say OK"
```

For manual debugging:

```bash
browser-cli --tab <tabId> fill 'textarea[name="message"]' 'Say OK'
browser-cli --tab <tabId> click 'form button[type="submit"]'
browser-cli --tab <tabId> wait 5000
browser-cli --tab <tabId> script scripts/arena.mjs --call extractMessages
```

### Multi-turn Text Chat

Arena keeps context within the same `/c/<conversationId>` page. Send follow-up prompts in the same tab after the previous response completes:

```bash
browser-cli --tab <tabId> script scripts/arena.mjs --call sendMessage -- --message "请记住暗号：示例暗号。只回复：已记住。"
browser-cli --tab <tabId> script scripts/arena.mjs --call waitForResponse -- --timeoutMs 120000
browser-cli --tab <tabId> script scripts/arena.mjs --call sendMessage -- --message "刚才让你记住的暗号是什么？请只回复暗号本身。"
browser-cli --tab <tabId> script scripts/arena.mjs --call waitForResponse -- --timeoutMs 120000
```

During streaming, assistant rows can temporarily contain only `Generating...`; ignore that placeholder and wait until the newest assistant row has real content.

### Generate an Image

```bash
browser-cli --tab <tabId> script scripts/arena.mjs --call generateImage -- --prompt "A clean square illustration of a red apple on a white background, no text."
```

With an explicit model:

```bash
browser-cli --tab <tabId> script scripts/arena.mjs --call generateImage -- --model "gpt-image-1.5-high-fidelity" --prompt "A clean square illustration of a red apple on a white background, no text."
```

`generateImage` selects the page Image modality and the picker `Image` category before searching for the model. The returned object includes `src`, `width`, and `height`. Download the `src` quickly because generated image URLs can be signed and time-limited.

For sensitive batch work, use the explicit step-by-step flow and verify the displayed model before sending:

```bash
browser-cli --tab <tabId> script scripts/arena.mjs --call selectModality -- --modality Image
browser-cli --tab <tabId> script scripts/arena.mjs --call selectModel -- --category Image --model "gpt-image-2-medium"
browser-cli --tab <tabId> script scripts/arena.mjs --call getCurrentSelection
# confirm model is "gpt-image-2 (medium)"
browser-cli --tab <tabId> script scripts/arena.mjs --call sendMessage -- --message "<prompt>"
browser-cli --tab <tabId> script scripts/arena.mjs --call waitForImage -- --timeoutMs 360000
```

To adopt an already-submitted generation tab:

```bash
browser-cli --tab <tabId> script scripts/arena.mjs --call getGenerationState
browser-cli --tab <tabId> script scripts/arena.mjs --call waitForImage -- --timeoutMs 360000
```

### List Model Options

```bash
browser-cli --tab <tabId> script scripts/arena.mjs --call listModels -- --category Text --query "gpt-5.2"
browser-cli --tab <tabId> script scripts/arena.mjs --call listModels -- --category Image --query "gpt"
```

## Notes

- Login is required for sending Direct messages.
- `Max` is a router, not a fixed model; in the tested chat it displayed `Response provided by Google` after answering.
- In Image mode, `gemini-3.1-flash-image-preview (nano-banana-2) [web-search]` successfully generated a 1024x1024 PNG from text.
- `gpt-image-2-medium` must be selected from the `Image` picker category. The displayed label is `gpt-image-2 (medium)`, so exact search by `gpt-image-2-medium` may not filter to the option; prefer direct option click by `data-value`, or search `gpt-image-2` and then click the `data-value="gpt-image-2-medium"` option.
- Do not over-parallelize `gpt-image-2 (medium)`. In testing, three successful generations were followed by rate-limit failures for the next batch, with a 30-31 minute retry message.
- The model picker labels and `data-value` are not always identical. Prefer matching `data-value` when an exact backend model id is known, and fall back to the visible label.
- Directly setting DOM values is not enough to select a model because the picker is a React/Radix controlled component. Trigger the page's own state update by clicking the matching rendered option.
- The page has duplicate mobile and desktop header controls. Scope model actions to `main button[aria-haspopup="dialog"]` and prompt actions to `form` to avoid sidebar controls.
- Sending a message redirects from `/text/direct` to `/c/<conversationId>`.
- Text multi-turn works in the same conversation URL. In testing, a second prompt successfully recalled a phrase from the first prompt.

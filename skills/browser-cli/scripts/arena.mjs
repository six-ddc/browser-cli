// scripts/arena.mjs — Arena.ai Direct chat and image recipe functions
// Each function: (browser, args?) => Promise<result>
// browser.evaluate() auto-unwraps { value } and JSON.parse, so expression
// that returns JSON.stringify(...) will yield a parsed JS object directly.

const DIRECT_URL = 'https://arena.ai/text/direct';
const MESSAGE_BOX = 'textarea[name="message"]';

async function selectPickerCategory(browser, category) {
  if (!category) return { selected: false, skipped: true };
  console.log(`Selecting picker category: ${category}...`);
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const wanted = ${JSON.stringify(category)}.trim().toLowerCase();
      const dialog = document.querySelector('[role="dialog"]');
      const buttons = [...(dialog || document).querySelectorAll('button')];
      const button = buttons.find(el => (el.innerText || el.getAttribute('aria-label') || '').trim().toLowerCase() === wanted);
      if (!button) {
        return {
          selected: false,
          available: buttons.map(el => (el.innerText || el.getAttribute('aria-label') || '').trim()).filter(Boolean),
        };
      }
      button.click();
      return { selected: true, label: button.innerText.trim() || button.getAttribute('aria-label') || '' };
    })())`,
  });
  await browser.wait({ duration: 500 });
  return result;
}

/** Detect login state -> { loggedIn, username, onArena }
 * @requires Current tab is on arena.ai */
export async function detectLogin(browser) {
  console.log('Detecting Arena.ai login state...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const accountButton = [...document.querySelectorAll('button')]
        .find(el => /@/.test(el.innerText || ''));
      const promptBox = document.querySelector('textarea[name="message"]');
      const loginLink = document.querySelector('a[href*="login"], a[href*="sign-in"]');
      return {
        onArena: location.hostname === 'arena.ai',
        loggedIn: !!accountButton || (!!promptBox && !loginLink),
        username: accountButton?.innerText?.trim() || '',
        directReady: !!promptBox,
        url: location.href,
      };
    })())`,
  });
  console.log(
    'Login state:',
    result.loggedIn
      ? `logged in${result.username ? ` as ${result.username}` : ''}`
      : 'not logged in',
  );
  return result;
}

/** Navigate to Direct text chat
 * @requires Logged in for sending messages */
export async function navigateDirect(browser) {
  console.log(`Navigating to ${DIRECT_URL}...`);
  await browser.navigate({ url: DIRECT_URL });
  await browser.wait({ selector: MESSAGE_BOX, timeout: 10000 });
  console.log('Direct chat is ready');
}

/** Select a prompt modality (Text, Image, Code, Search) -> { selected, label }
 * @requires Current page is Arena.ai Direct or a chat page */
export async function selectModality(browser, { modality }) {
  if (!modality) throw new Error('selectModality requires --modality');
  console.log(`Selecting modality: ${modality}...`);
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const wanted = ${JSON.stringify(modality)}.toLowerCase();
      const buttons = [...document.querySelectorAll('button[data-modality-button="true"], button[aria-label]')];
      const button = buttons.find(el => {
        const label = (el.getAttribute('aria-label') || el.innerText || '').trim().toLowerCase();
        return label === wanted;
      });
      if (!button) {
        return { selected: false, available: buttons.map(el => el.getAttribute('aria-label') || el.innerText.trim()).filter(Boolean) };
      }
      button.click();
      return { selected: true, label: button.getAttribute('aria-label') || button.innerText.trim() };
    })())`,
  });
  await browser.wait({ duration: 700 });
  console.log(
    result.selected ? `Selected modality: ${result.label}` : `Modality not found: ${modality}`,
  );
  return result;
}

/** Read current mode/model header -> { mode, model }
 * @requires Current page is Arena.ai Direct or a chat page */
export async function getCurrentSelection(browser) {
  console.log('Reading current mode and model...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const main = document.querySelector('main') || document.body;
      const mode = [...main.querySelectorAll('button[role="combobox"]')]
        .map(el => el.innerText.trim())
        .find(Boolean) || '';
      const model = [...main.querySelectorAll('button[aria-haspopup="dialog"]')]
        .map(el => el.innerText.trim())
        .find(Boolean) || '';
      return { mode, model };
    })())`,
  });
  console.log(`Current selection: ${result.mode || '(unknown)'} / ${result.model || '(unknown)'}`);
  return result;
}

/** List visible model picker options -> [{ label, value, selected }]
 * @requires Current page is Arena.ai Direct or a chat page */
export async function listModels(browser, { query, category, modality } = {}) {
  const pickerCategory = category || modality;
  console.log(
    `Opening model picker${pickerCategory ? ` in ${pickerCategory}` : ''}${query ? ` and filtering "${query}"` : ''}...`,
  );
  await browser.click({ selector: 'main button[aria-haspopup="dialog"]' });
  await browser.wait({
    selector: '[role="dialog"] input[placeholder="Search models"]',
    timeout: 5000,
  });
  if (pickerCategory) {
    const categoryResult = await selectPickerCategory(browser, pickerCategory);
    if (!categoryResult.selected) {
      await browser.press({ key: 'Escape' });
      return { error: `Category not found: ${pickerCategory}`, ...categoryResult };
    }
  }
  if (query) {
    await browser.fill({
      selector: '[role="dialog"] input[placeholder="Search models"]',
      value: query,
    });
    await browser.wait({ duration: 500 });
  }
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll('[role="dialog"] [role="option"]')].map(el => ({
      label: el.innerText.trim().split('\\n')[0] || '',
      value: el.getAttribute('data-value') || '',
      selected: el.getAttribute('aria-selected') === 'true',
      disabled: el.getAttribute('aria-disabled') === 'true',
    })).filter(r => r.label || r.value))`,
  });
  await browser.press({ key: 'Escape' });
  console.log(`Found ${results.length} model options`);
  return results;
}

/** Select a model by visible label or data-value -> { selected, label, value }
 * @requires Current page is Arena.ai Direct or a chat page */
export async function selectModel(browser, { model, category, modality }) {
  if (!model) throw new Error('selectModel requires --model');
  const pickerCategory = category || modality;
  console.log(`Selecting model${pickerCategory ? ` from ${pickerCategory}` : ''}: ${model}...`);
  await browser.click({ selector: 'main button[aria-haspopup="dialog"]' });
  await browser.wait({
    selector: '[role="dialog"] input[placeholder="Search models"]',
    timeout: 5000,
  });
  if (pickerCategory) {
    const categoryResult = await selectPickerCategory(browser, pickerCategory);
    if (!categoryResult.selected) {
      await browser.press({ key: 'Escape' });
      console.log(`Category not found: ${pickerCategory}`);
      return { selected: false, error: `Category not found: ${pickerCategory}`, ...categoryResult };
    }
  }
  const directResult = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const wanted = ${JSON.stringify(model)};
      const normalize = s => (s || '').trim().toLowerCase().replace(/[\\s()_]+/g, '-').replace(/-+/g, '-');
      const options = [...document.querySelectorAll('[role="dialog"] [role="option"]')];
      const option = options.find(el => {
        const label = el.innerText.trim().split('\\n')[0] || '';
        const value = el.getAttribute('data-value') || '';
        return value === wanted || label === wanted || normalize(value) === normalize(wanted) || normalize(label) === normalize(wanted);
      });
      if (!option) {
        return {
          selected: false,
          availableCount: options.length,
          available: options.slice(0, 10).map(el => ({
            label: el.innerText.trim().split('\\n')[0] || '',
            value: el.getAttribute('data-value') || '',
          })),
        };
      }
      const label = option.innerText.trim().split('\\n')[0] || '';
      const value = option.getAttribute('data-value') || '';
      option.click();
      return { selected: true, method: 'direct-option-click', label, value };
    })())`,
  });
  if (directResult.selected) {
    await browser.wait({ duration: 700 });
    console.log(`Selected model: ${directResult.label} (${directResult.value})`);
    return directResult;
  }
  const searchCandidates = [
    ...new Set(
      [
        model,
        model.replace(/-(low|medium|high|fast|pro|mini|preview|latest|text|image)$/i, ''),
        model.split('-').slice(0, -1).join('-'),
        model.split('-').slice(0, -2).join('-'),
      ].filter(Boolean),
    ),
  ];
  let result = { selected: false, available: [] };
  for (const search of searchCandidates) {
    console.log(`Searching model picker for: ${search}`);
    await browser.fill({
      selector: '[role="dialog"] input[placeholder="Search models"]',
      value: search,
    });
    await browser.wait({ duration: 500 });
    result = await browser.evaluate({
      expression: `JSON.stringify((() => {
        const wanted = ${JSON.stringify(model)};
        const normalize = s => (s || '').trim().toLowerCase().replace(/[\\s()_]+/g, '-').replace(/-+/g, '-');
        const options = [...document.querySelectorAll('[role="dialog"] [role="option"]')];
        const option = options.find(el => {
          const label = el.innerText.trim().split('\\n')[0] || '';
          const value = el.getAttribute('data-value') || '';
          return value === wanted || label === wanted || normalize(value) === normalize(wanted) || normalize(label) === normalize(wanted);
        });
        if (!option) {
          return {
            selected: false,
            search: ${JSON.stringify(search)},
            available: options.slice(0, 10).map(el => ({
              label: el.innerText.trim().split('\\n')[0] || '',
              value: el.getAttribute('data-value') || '',
            })),
          };
        }
        const label = option.innerText.trim().split('\\n')[0] || '';
        const value = option.getAttribute('data-value') || '';
        option.click();
        return { selected: true, search: ${JSON.stringify(search)}, label, value };
      })())`,
    });
    if (result.selected) break;
  }
  await browser.wait({ duration: 700 });
  if (!result.selected) {
    await browser.press({ key: 'Escape' });
    console.log(`Model not found: ${model}`);
    return result;
  }
  console.log(`Selected model: ${result.label} (${result.value})`);
  return result;
}

/** Send a Direct message -> { sent, url }
 * @requires Current page is Arena.ai Direct or a chat page, message box is visible */
export async function sendMessage(browser, { message }) {
  if (!message) throw new Error('sendMessage requires --message');
  console.log(`Sending message (${message.length} chars)...`);
  await browser.fill({ selector: MESSAGE_BOX, value: message });
  await browser.wait({ duration: 300 });
  await browser.click({ selector: 'form button[type="submit"]' });
  await browser.wait({ duration: 1000 });
  const result = await browser.evaluate({
    expression: `JSON.stringify({ sent: true, url: location.href })`,
  });
  console.log(`Message submitted; URL: ${result.url}`);
  return result;
}

/** Extract generated images -> [{ index, src, width, height, alt }]
 * @requires Current page is an Arena.ai conversation, usually after Image generation */
export async function extractImages(browser) {
  console.log('Extracting generated images...');
  const results = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const imageUrlLike = url => {
        if (!url) return false;
        return /\\.(png|jpe?g|webp|gif)(\\?|$)/i.test(url)
          || url.startsWith('blob:')
          || /cloudflarestorage|r2\\.cloudflare|supabase|storage|cdn/i.test(url);
      };
      return [...document.querySelectorAll('main img')].map((img, i) => ({
        index: i + 1,
        src: img.currentSrc || img.src,
        alt: img.alt || '',
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
      })).filter(r => r.src && imageUrlLike(r.src) && r.width > 40 && r.height > 40);
    })())`,
  });
  console.log(`Extracted ${results.length} images`);
  return results;
}

/** Read image generation state -> { url, model, generating, rateLimited, error, images }
 * @requires Current page is Arena.ai Direct or a conversation */
export async function getGenerationState(browser) {
  console.log('Reading generation state...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const text = document.querySelector('main')?.innerText || '';
      const imageUrlLike = url => {
        if (!url) return false;
        return /\\.(png|jpe?g|webp|gif)(\\?|$)/i.test(url)
          || url.startsWith('blob:')
          || /cloudflarestorage|r2\\.cloudflare|supabase|storage|cdn/i.test(url);
      };
      const images = [...document.querySelectorAll('main img')].map((img, i) => ({
        index: i + 1,
        src: img.currentSrc || img.src,
        alt: img.alt || '',
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
      })).filter(r => r.src && imageUrlLike(r.src) && r.width > 40 && r.height > 40);
      const model = [...document.querySelectorAll('main button[aria-haspopup="dialog"]')]
        .map(el => el.innerText.trim()).find(Boolean) || '';
      const rateLimitMatch = text.match(/You have reached your rate limit[^\\n]*/i);
      const genericErrorMatch = text.match(/Something went wrong[^\\n]*/i);
      return {
        url: location.href,
        model,
        generating: /Generating image/i.test(text),
        rateLimited: !!rateLimitMatch,
        error: rateLimitMatch?.[0] || genericErrorMatch?.[0] || '',
        images,
        textPreview: text.slice(0, 1000),
      };
    })())`,
  });
  console.log(
    `Generation state: ${result.images.length} image(s), model=${result.model || '(unknown)'}` +
      (result.error ? `, error=${result.error}` : ''),
  );
  return result;
}

/** Wait until the latest generated image is available -> latest image
 * @requires An Image prompt was just submitted */
export async function waitForImage(browser, { timeoutMs } = {}) {
  const timeout = Number(timeoutMs) || 180000;
  console.log(`Waiting for generated image (timeout ${timeout}ms)...`);
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const state = await getGenerationState(browser);
    if (state.images.length) {
      const image = state.images[state.images.length - 1];
      console.log(`Generated image available: ${image.width}x${image.height}`);
      return image;
    }
    if (state.rateLimited || state.error) {
      throw new Error(state.error || 'Arena image generation failed');
    }
    if (!state.generating && Date.now() - started > 10000) {
      console.log(
        'Image generation is no longer marked as in progress, continuing to poll briefly...',
      );
    }
    await browser.wait({ duration: 5000 });
  }
  throw new Error(`Timed out waiting for generated image after ${timeout}ms`);
}

/** Full image workflow: select Image, optionally select model, send prompt, wait for image */
export async function generateImage(browser, args = {}) {
  const prompt = args.prompt || args.message;
  if (!prompt) throw new Error('generateImage requires --prompt or --message');
  if (args.navigate !== false) {
    await navigateDirect(browser);
  }
  await selectModality(browser, { modality: 'Image' });
  if (args.model) {
    await selectModel(browser, { model: args.model, category: args.category || 'Image' });
    const selection = await getCurrentSelection(browser);
    if (
      !selection.model ||
      !selection.model
        .toLowerCase()
        .includes(args.model.toLowerCase().split('-').slice(0, 3).join('-'))
    ) {
      console.log(`Selected model display after selection: ${selection.model || '(unknown)'}`);
    }
  }
  await sendMessage(browser, { message: prompt });
  return await waitForImage(browser, { timeoutMs: args.timeoutMs });
}

/** Extract visible Direct conversation messages -> [{ index, role, text, model, provider }]
 * @requires Current page is an Arena.ai Direct conversation */
export async function extractMessages(browser) {
  console.log('Extracting visible messages...');
  const results = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const rows = [...document.querySelectorAll('ol > div')]
        .filter(el => el.innerText?.trim() && !el.className.includes('h-0'));
      return rows.map((el, i) => {
        const text = el.innerText.trim();
        const isUser = el.className.includes('justify-end') || !!el.querySelector('[class*="justify-end"]');
        if (isUser) {
          const prose = el.querySelector('.prose') || el;
          return {
            index: i + 1,
            role: 'user',
            text: prose.innerText.trim(),
            model: '',
            provider: '',
          };
        }
        const lines = text.split('\\n').map(s => s.trim()).filter(Boolean);
        const responseIndex = lines.indexOf('Response provided by');
        const provider = responseIndex >= 0 ? (lines[responseIndex + 1] || '') : '';
        const model = lines[0] || '';
        const body = el.querySelector('.prose')?.innerText?.trim() || lines.slice(responseIndex >= 0 ? responseIndex + 2 : 1).join('\\n');
        return {
          index: i + 1,
          role: 'assistant',
          text: body,
          model,
          provider,
        };
      }).filter(r => r.text);
    })())`,
  });
  console.log(`Extracted ${results.length} messages`);
  return results;
}

/** Wait until the latest assistant response has non-empty text -> latest assistant message
 * @requires A message was just submitted */
export async function waitForResponse(browser, { timeoutMs } = {}) {
  const timeout = Number(timeoutMs) || 60000;
  console.log(`Waiting for assistant response (timeout ${timeout}ms)...`);
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const messages = await extractMessages(browser);
    const latestAssistant = messages.find((msg) => msg.role === 'assistant');
    if (latestAssistant && !/^Generating\.\.\.$/i.test(latestAssistant.text.trim())) {
      console.log(`Received response from ${latestAssistant.model || 'assistant'}`);
      return latestAssistant;
    }
    await browser.wait({ duration: 1000 });
  }
  throw new Error(`Timed out waiting for assistant response after ${timeout}ms`);
}

/** Full workflow: optionally select model, send message, wait for response */
export default async function (browser, args = {}) {
  if ((args.modality || '').toLowerCase() === 'image' || args.image) {
    return await generateImage(browser, args);
  }
  if (args.navigate !== false) {
    await navigateDirect(browser);
  }
  if (args.modality) {
    await selectModality(browser, { modality: args.modality });
  }
  if (args.model) {
    await selectModel(browser, { model: args.model, category: args.category });
  }
  await sendMessage(browser, { message: args.message || args.prompt });
  return await waitForResponse(browser, { timeoutMs: args.timeoutMs });
}

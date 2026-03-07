// scripts/discord.mjs — Discord recipe functions (read-only community maintenance)
// Each function: (browser, args?) => Promise<result>
// browser.evaluate() auto-unwraps { value } and JSON.parse, so expression
// that returns JSON.stringify(...) will yield a parsed JS object directly.

/** Detect login state → { loggedIn, username }
 * @requires Current tab is on discord.com */
export async function detectLogin(browser) {
  console.log('Detecting login state...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const section = document.querySelector('section[aria-label="User status and settings"]');
      if (!section) return { loggedIn: false, username: '' };
      const nameTag = section.querySelector('[class*="nameTag"]');
      const username = nameTag?.innerText?.split('\\n')[0] || '';
      return { loggedIn: true, username };
    })())`,
  });
  console.log(
    'Login state:',
    result.loggedIn ? `logged in as ${result.username}` : 'not logged in',
  );
  return result;
}

/** List joined servers → [{ index, name }]
 * @requires Logged in, on any discord.com page */
export async function listServers(browser) {
  console.log('Listing servers...');
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll('nav[aria-label="Servers sidebar"] [role="treeitem"]')].map((el, i) => {
      const hidden = el.querySelector('span[class*="hiddenVisually"]');
      const name = hidden?.innerText?.trim() || '';
      return { index: i, name };
    }).filter(r => r.name && !['Direct Messages', 'Add a Server', 'Discover', 'Download Apps'].includes(r.name)))`,
  });
  console.log(`Found ${results.length} servers`);
  return results;
}

/** Navigate to a server by name (clicks the server icon in sidebar)
 * @requires Logged in, on any discord.com page */
export async function navigateServer(browser, { name }) {
  console.log(`Navigating to server: "${name}"...`);
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const items = [...document.querySelectorAll('nav[aria-label="Servers sidebar"] [role="treeitem"]')];
      const server = items.find(el => {
        const hidden = el.querySelector('span[class*="hiddenVisually"]');
        return hidden?.innerText?.trim() === ${JSON.stringify(name)};
      });
      if (server) { server.click(); return { found: true }; }
      return { found: false };
    })())`,
  });
  if (!result.found) {
    console.log(`Server "${name}" not found`);
    return result;
  }
  await browser.wait({ duration: 2000 });
  console.log(`Navigated to server: ${name}`);
  return result;
}

/** List channels in current server → [{ name, type, href, unread }]
 * @requires Currently viewing a server (not DMs) */
export async function listChannels(browser) {
  console.log('Listing channels...');
  // Click "Show All" if present to expand collapsed categories
  await browser.evaluate({
    expression: `(() => {
      const btn = [...document.querySelectorAll('ul[aria-label="Channels"] button')].find(b => b.innerText === 'Show All');
      if (btn) btn.click();
    })()`,
  });
  await browser.wait({ duration: 500 });
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll('ul[aria-label="Channels"] li')].map(li => {
      const link = li.querySelector('a');
      const button = li.querySelector('button');
      const label = link?.getAttribute('aria-label') || button?.getAttribute('aria-label') || '';
      if (!label) return null;
      const isCategory = label.includes('category');
      const isVoice = label.includes('voice channel');
      const isAnnouncement = label.includes('announcement');
      const unread = label.startsWith('unread,');
      const name = label.replace(/^unread, /, '').replace(/ \\(text channel\\)$/, '').replace(/ \\(announcement channel\\)$/, '').replace(/ \\(voice channel\\).*$/, '').replace(/ \\(category\\)$/, '');
      const type = isCategory ? 'category' : isVoice ? 'voice' : isAnnouncement ? 'announcement' : 'text';
      return { name, type, href: link?.href || '', unread };
    }).filter(Boolean))`,
  });
  console.log(`Found ${results.length} channels`);
  return results;
}

/** Navigate to a channel by URL
 * @requires None */
export async function navigateChannel(browser, { url }) {
  console.log(`Navigating to channel: ${url}`);
  await browser.navigate({ url });
  await browser.wait({ duration: 2000 });
  const info = await browser.evaluate({
    expression: `JSON.stringify({
      channel: document.querySelector('main')?.getAttribute('aria-label') || document.querySelector('h1')?.innerText || '',
      topic: document.querySelector('[class*="topic"]')?.innerText || '',
      hasMessages: !!document.querySelector('ol[aria-label^="Messages in"]'),
      isForum: !!document.querySelector('[class*="tag"], [class*="forum"]'),
    })`,
  });
  console.log(`Channel: ${info.channel}${info.isForum ? ' (forum)' : ''}`);
  return info;
}

/** Extract messages from current channel → [{ index, msgId, username, isBot, datetime, content, reactions, embeds, attachments, hasReply, replyTo }]
 * @requires Currently viewing a text channel with messages loaded */
export async function extractMessages(browser) {
  console.log('Extracting messages...');
  const results = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const msgs = [...document.querySelectorAll('li[id^="chat-messages"]')];
      let lastUser = '';
      let lastTime = '';
      return msgs.map((el, i) => {
        const msgId = el.id.split('-').pop();
        const header = el.querySelector('h3[class*="header"]');
        const userEl = header?.querySelector('span[class*="username"]');
        const username = userEl?.innerText || '';
        if (username) lastUser = username;
        const isBot = !!el.querySelector('[class*="contents"] > [class*="header"] [class*="botTag"]');
        const time = header?.querySelector('time');
        const datetime = time?.getAttribute('datetime') || '';
        if (datetime) lastTime = datetime;
        const content = document.getElementById('message-content-' + msgId)?.innerText || '';
        const replyRef = el.querySelector('[class*="repliedMessage"]');
        const replyRefContent = replyRef?.querySelector('[class*="repliedTextContent"], [class*="repliedTextPreview"]');
        const reactions = [...el.querySelectorAll('[class*="reactionInner"][role="button"]')].map(r => {
          const label = r.getAttribute('aria-label') || '';
          const count = r.querySelector('[class*="reactionCount"]')?.innerText || '1';
          const emoji = label.split(',')[0] || '';
          return { emoji, count };
        });
        const embeds = el.querySelectorAll('article[class*="embed"]').length;
        const attachments = el.querySelectorAll('[class*="imageWrapper"], [class*="attachment"]').length;
        return {
          index: i + 1,
          msgId,
          username: username || lastUser,
          isBot,
          datetime: datetime || lastTime,
          content: content.substring(0, 500),
          reactions,
          embeds,
          attachments,
          hasReply: !!replyRef,
          replyTo: replyRef?.querySelector('[class*="username"]')?.innerText || '',
          replyPreview: replyRefContent?.innerText?.substring(0, 200) || '',
        };
      });
    })())`,
  });
  console.log(`Extracted ${results.length} messages`);
  return results;
}

/** Extract pinned messages → [{ username, datetime, content }]
 * @requires Currently viewing a text channel */
export async function extractPinnedMessages(browser) {
  console.log('Opening pinned messages...');
  await browser.click({ selector: '[aria-label="Pinned Messages"]' });
  await browser.wait({ duration: 1000 });
  const results = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const popout = document.querySelector('[class*="messagesPopout"]');
      if (!popout) return [];
      return [...popout.querySelectorAll('[class*="messageGroupWrapper"]')].map(el => {
        const username = el.querySelector('[class*="username"]')?.innerText || '';
        const time = el.querySelector('time');
        const content = el.querySelector('[class*="messageContent"]')?.innerText || '';
        return {
          username,
          datetime: time?.getAttribute('datetime') || '',
          content: content.substring(0, 500),
        };
      });
    })())`,
  });
  await browser.press({ key: 'Escape' });
  console.log(`Extracted ${results.length} pinned messages`);
  return results;
}

/** List threads in current channel → [{ title, lastMessage, lastActive }]
 * @requires Currently viewing a text channel */
export async function listThreads(browser) {
  console.log('Opening threads panel...');
  await browser.click({ selector: '[aria-label="Threads"]' });
  await browser.wait({ duration: 1000 });
  const results = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const scroller = document.querySelector('[class*="list_c441f0"] [class*="content"]');
      if (!scroller) return [];
      return [...scroller.querySelectorAll('[class*="container__6764b"]')].map(el => {
        const text = el.innerText || '';
        const lines = text.split('\\n').filter(Boolean);
        return {
          title: lines[0] || '',
          detail: lines.slice(1).join(' | '),
        };
      });
    })())`,
  });
  await browser.press({ key: 'Escape' });
  console.log(`Found ${results.length} threads`);
  return results;
}

/** Extract member list with roles → [{ role, members: [{ name, status }] }]
 * @requires Currently viewing a text channel with member list visible */
export async function extractMembers(browser) {
  console.log('Extracting member list...');
  // Ensure member list is visible
  const visible = await browser.evaluate({
    expression: `JSON.stringify({ visible: !!document.querySelector('[class*="membersWrap"]') })`,
  });
  if (!visible.visible) {
    console.log('Member list not visible, toggling...');
    await browser.click({ selector: '[aria-label="Show Member List"]' });
    await browser.wait({ duration: 1000 });
  }
  const results = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const content = document.querySelector('[class*="members_"][class*="thin_"] [class*="content"]');
      if (!content) return [];
      const groups = [];
      let currentRole = '';
      const children = [...content.children].filter(c => typeof c.className === 'string');
      for (const child of children) {
        if (child.querySelector('[class*="membersGroupName"]')) {
          currentRole = child.querySelector('[class*="membersGroupName"]')?.innerText || '';
        } else if (child.getAttribute('role') === 'listitem') {
          const name = child.querySelector('[class*="username"]')?.innerText?.split('\\n')[0] || '';
          const activity = child.querySelector('[class*="activity"]')?.innerText || '';
          if (name) {
            let group = groups.find(g => g.role === currentRole);
            if (!group) { group = { role: currentRole, members: [] }; groups.push(group); }
            group.members.push({ name, activity: activity.substring(0, 80) });
          }
        }
      }
      return groups;
    })())`,
  });
  const totalMembers = results.reduce((sum, g) => sum + g.members.length, 0);
  console.log(`Extracted ${totalMembers} members across ${results.length} role groups`);
  return results;
}

/** Scroll up to load older messages → { messageCount }
 * @requires Currently viewing a text channel */
export async function loadOlderMessages(browser, { amount } = {}) {
  const scrollAmount = Number(amount) || 3000;
  console.log(`Scrolling up ${scrollAmount}px to load older messages...`);
  await browser.scroll({
    direction: 'up',
    amount: scrollAmount,
    selector: 'ol[aria-label^="Messages in"]',
  });
  await browser.wait({ duration: 1500 });
  const result = await browser.evaluate({
    expression: `JSON.stringify({ messageCount: document.querySelectorAll('li[id^="chat-messages"]').length })`,
  });
  console.log(`Messages in DOM: ${result.messageCount}`);
  return result;
}

/** Get server info from sidebar → { serverName, channels, categories }
 * @requires Currently viewing a server */
export async function getServerInfo(browser) {
  console.log('Getting server info...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const nav = document.querySelector('nav[aria-label*="server"]');
      const serverName = nav?.getAttribute('aria-label')?.replace(' (server)', '') || '';
      const channels = [...document.querySelectorAll('ul[aria-label="Channels"] a')].map(a => {
        const label = a.getAttribute('aria-label') || '';
        return label;
      });
      return { serverName, channelCount: channels.length, channels };
    })())`,
  });
  console.log(`Server: ${result.serverName}, ${result.channelCount} channels`);
  return result;
}

/** Search messages in current server
 * @requires Currently viewing a server, uses CDP key dispatch for Draft.js input */
export async function searchMessages(browser, { query }) {
  console.log(`Searching for: "${query}"...`);
  await browser.click({ selector: '[role="combobox"]' });
  await browser.wait({ duration: 300 });
  // Draft.js combobox — use key-by-key input via press --debugger
  for (const char of query) {
    await browser.press({ key: char, debugger: true });
  }
  await browser.press({ key: 'Enter', debugger: true });
  await browser.wait({ duration: 2500 });
  const results = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const items = [...document.querySelectorAll('[class*="searchResult__"]')].filter(e => typeof e.className === 'string');
      const totalText = document.querySelector('[class*="searchResultsWrap"]')?.querySelector('[class*="totalResults"], [class*="header"]')?.innerText || '';
      return {
        total: totalText,
        results: items.slice(0, 10).map(el => {
          const username = el.querySelector('[class*="username"]')?.innerText || '';
          const content = el.querySelector('[class*="messageContent"]')?.innerText || '';
          const time = el.querySelector('time');
          return {
            username,
            content: content.substring(0, 300),
            datetime: time?.getAttribute('datetime') || '',
          };
        }),
      };
    })())`,
  });
  console.log(`Search results: ${results.total}, showing ${results.results.length}`);
  return results;
}

/** Full workflow: detect login → list servers */
export default async function (browser, args) {
  const { loggedIn } = await detectLogin(browser);
  if (!loggedIn) {
    console.log('Not logged in. Please log in first and retry.');
    return { loggedIn: false };
  }
  if (args?.server) {
    await navigateServer(browser, { name: args.server });
    return await listChannels(browser);
  }
  return await listServers(browser);
}

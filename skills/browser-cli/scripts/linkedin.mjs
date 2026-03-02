// scripts/linkedin.mjs — LinkedIn recipe functions
// Each function: (browser, args?) => Promise<result>
// browser.evaluate() auto-unwraps { value } and JSON.parse, so expression
// that returns JSON.stringify(...) will yield a parsed JS object directly.
//
// Multi-language: All text matching handles both English and Chinese UI.
// Helper: matchText(text, enPatterns, zhPatterns) checks both locales.

/** Detect login state → { loggedIn }
 * @requires Current tab is on linkedin.com */
export async function detectLogin(browser) {
  console.log('Detecting login state...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const navMe = !!document.querySelector('.global-nav__me');
      const searchBox = !!document.querySelector('.search-global-typeahead');
      const loginBtn = !!document.querySelector('a[href*="/login"]');
      return { loggedIn: navMe && searchBox, loginBtn };
    })())`,
  });
  console.log('Login state:', result.loggedIn ? 'logged in' : 'not logged in');
  return result;
}

/** Extract posts from the feed → [{ index, urn, author, authorDesc, time, body, reactions, comments, hasImage, hasVideo, hasArticle }]
 * @requires Current page is LinkedIn feed (/feed/) with posts loaded */
export async function extractFeed(browser) {
  console.log('Extracting feed posts...');
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll('.feed-shared-update-v2[data-urn*="activity"], .feed-shared-update-v2[data-urn*="ugcPost"]')].map((el, i) => ({
      index: i + 1,
      urn: el.getAttribute('data-urn'),
      author: el.querySelector('.update-components-actor__title span[dir="ltr"] > span[aria-hidden="true"]')?.innerText?.trim() || '',
      authorDesc: el.querySelector('.update-components-actor__description span[aria-hidden="true"]')?.innerText?.trim() || '',
      time: el.querySelector('.update-components-actor__sub-description span[aria-hidden="true"]')?.innerText?.trim() || '',
      body: el.querySelector('.feed-shared-inline-show-more-text')?.innerText?.trim()?.substring(0, 500) || '',
      reactions: el.querySelector('.social-details-social-counts__reactions-count')?.innerText?.trim() || '0',
      comments: el.querySelector('.social-details-social-counts__comments')?.innerText?.trim() || '',
      hasImage: !!el.querySelector('.update-components-image'),
      hasVideo: !!el.querySelector('.update-components-video, video'),
      hasArticle: !!el.querySelector('.update-components-article'),
    })))`,
  });
  console.log(`Extracted ${results.length} feed posts`);
  return results;
}

/** Extract profile info → { name, headline, location, experience }
 * @requires Current page is a LinkedIn profile page (/in/<user>/) */
export async function extractProfile(browser) {
  console.log('Extracting profile...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const name = document.querySelector('h1')?.innerText?.trim() || '';
      const headline = document.querySelector('.text-body-medium')?.innerText?.trim() || '';
      const location = document.querySelector('.text-body-small.inline')?.innerText?.trim() || '';
      const expSection = document.querySelector('#experience')?.closest('section');
      const experience = expSection ? [...expSection.querySelectorAll('li.artdeco-list__item')].map((el, i) => ({
        index: i + 1,
        title: el.querySelector('.t-bold span[aria-hidden="true"]')?.innerText?.trim() || '',
        company: el.querySelector('.t-normal span[aria-hidden="true"]')?.innerText?.trim() || '',
        duration: el.querySelector('.t-black--light span[aria-hidden="true"]')?.innerText?.trim() || '',
      })) : [];
      return { name, headline, location, experience, url: window.location.href };
    })())`,
  });
  console.log(`Profile: ${result.name} — ${result.headline}`);
  return result;
}

/** Navigate to a profile page
 * @requires None (navigates automatically) */
export async function navigateProfile(browser, { username } = {}) {
  const url = `https://www.linkedin.com/in/${username}/`;
  console.log(`Navigating to profile: ${url}`);
  await browser.navigate({ url });
  await browser.wait({ selector: 'h1', timeout: 5000 });
  console.log('Profile page loaded');
}

/** Search people → [{ index, name, title, location, extra }]
 * @requires None (navigates automatically) */
export async function searchPeople(browser, { keywords } = {}) {
  const url = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
  console.log(`Searching people: ${keywords}`);
  await browser.navigate({ url });
  await browser.wait({ duration: 3000 });
  const results = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const list = document.querySelector('[role="list"]');
      if (!list) return [];
      return [...list.children]
        .filter(el => el.innerText?.trim().length > 5)
        .map((el, i) => {
          const lines = el.innerText.split('\\n').map(l => l.trim()).filter(Boolean);
          return {
            index: i + 1,
            name: lines[0] || '',
            title: lines[1] || '',
            location: lines[2] || '',
            extra: lines.slice(3).join(' | '),
          };
        });
    })())`,
  });
  console.log(`Found ${results.length} people`);
  return results;
}

/** Search jobs → [{ index, title, company, location, link, isPromoted }]
 * @requires None (navigates automatically) */
export async function searchJobs(browser, { keywords, location } = {}) {
  let url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keywords || '')}`;
  if (location) url += `&location=${encodeURIComponent(location)}`;
  console.log(`Searching jobs: ${keywords} in ${location || 'anywhere'}`);
  await browser.navigate({ url });
  await browser.wait({ selector: '.job-card-container', timeout: 5000 });
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll('.job-card-container')].map((el, i) => ({
      index: i + 1,
      title: el.querySelector('a[class*="job-card"]')?.innerText?.trim()?.split('\\n')[0] || '',
      company: el.querySelector('.artdeco-entity-lockup__subtitle')?.innerText?.trim() || '',
      location: el.querySelector('.artdeco-entity-lockup__caption')?.innerText?.trim() || '',
      link: el.querySelector('a')?.href || '',
      isPromoted: /Promoted|推广/.test(el.innerText),
    })))`,
  });
  console.log(`Found ${results.length} jobs`);
  return results;
}

/** Extract job detail from the right panel → { title, company, description, hasApply, hasSave }
 * @requires Current page is a job search page with a job selected */
export async function extractJobDetail(browser) {
  console.log('Extracting job detail...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const title = document.querySelector('.job-details-jobs-unified-top-card__job-title')?.innerText?.trim() || '';
      const company = document.querySelector('.job-details-jobs-unified-top-card__company-name a')?.innerText?.trim()
        || document.querySelector('.job-details-jobs-unified-top-card__company-name')?.innerText?.trim() || '';
      const desc = document.querySelector('#job-details')?.innerText?.trim()?.substring(0, 1000)
        || document.querySelector('.jobs-description-content')?.innerText?.trim()?.substring(0, 1000) || '';
      const hasApply = !!document.querySelector('.jobs-apply-button');
      const hasSave = !!document.querySelector('.jobs-save-button');
      return { title, company, description: desc, hasApply, hasSave };
    })())`,
  });
  console.log(`Job: ${result.title} at ${result.company}`);
  return result;
}

/** Extract company info → { name, industry, headquarters, followers, employeeCount, about, tabs }
 * @requires Current page is a company page (/company/<slug>/) */
export async function extractCompany(browser) {
  console.log('Extracting company info...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const name = document.querySelector('h1')?.innerText?.trim() || '';
      const infoItems = [...document.querySelectorAll('.org-top-card-summary-info-list__info-item')];
      const about = document.querySelector('.org-about-module__description, [class*="org-about"]')?.innerText?.trim()?.substring(0, 500) || '';
      const tabs = [...document.querySelectorAll('.org-page-navigation__item a')].map(a => a.innerText?.trim());
      return {
        name,
        industry: infoItems[0]?.innerText?.trim() || '',
        headquarters: infoItems[1]?.innerText?.trim() || '',
        followers: infoItems[2]?.innerText?.trim() || '',
        employeeCount: infoItems[3]?.innerText?.trim() || '',
        about,
        tabs,
      };
    })())`,
  });
  console.log(`Company: ${result.name} (${result.industry})`);
  return result;
}

/** Navigate to a company page
 * @requires None (navigates automatically) */
export async function navigateCompany(browser, { slug } = {}) {
  const url = `https://www.linkedin.com/company/${slug}/`;
  console.log(`Navigating to company: ${url}`);
  await browser.navigate({ url });
  await browser.wait({ selector: 'h1', timeout: 5000 });
  console.log('Company page loaded');
}

/** Extract notifications → [{ index, text, time, link, isUnread }]
 * @requires Current page is notifications page or navigates automatically */
export async function extractNotifications(browser, { limit } = {}) {
  const n = Number(limit) || 20;
  console.log(`Extracting up to ${n} notifications...`);
  await browser.navigate({ url: 'https://www.linkedin.com/notifications/' });
  await browser.wait({ selector: '.nt-card', timeout: 5000 });
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll('.nt-card')].slice(0, ${n}).map((el, i) => ({
      index: i + 1,
      text: el.innerText?.trim()?.replace(/\\n+/g, ' ')?.substring(0, 200),
      time: (el.querySelector('.nt-card__time-ago') || el.querySelector('time'))?.innerText?.trim() || '',
      link: el.querySelector('a')?.href || '',
      isUnread: el.classList.contains('nt-card--unread'),
    })))`,
  });
  console.log(`Extracted ${results.length} notifications`);
  return results;
}

/** Search companies → [{ index, name, industry, location, followers, companyUrl }]
 * @requires None (navigates automatically) */
export async function searchCompanies(browser, { keywords } = {}) {
  const url = `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(keywords)}`;
  console.log(`Searching companies: ${keywords}`);
  await browser.navigate({ url });
  await browser.wait({ duration: 3000 });
  const results = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const list = document.querySelector('[role="list"]');
      if (!list) return [];
      return [...list.children]
        .filter(el => el.innerText?.trim().length > 5)
        .map((el, i) => {
          const lines = el.innerText.split('\\n').map(l => l.trim()).filter(Boolean);
          const link = el.querySelector('a[href*="/company/"]');
          const followerMatch = el.innerText.match(/(\\d[\\d,.KMkm万千]+)\\s*(?:followers|个?关注者)/);
          return {
            index: i + 1,
            name: lines[0] || '',
            industry: lines[1] || '',
            location: lines[2] || '',
            followers: followerMatch ? followerMatch[1] : '',
            companyUrl: link?.href || '',
          };
        });
    })())`,
  });
  console.log(`Found ${results.length} companies`);
  return results;
}

/** Search posts/content → [{ index, author, authorTitle, time, body, authorUrl }]
 * @requires None (navigates automatically) */
export async function searchContent(browser, { keywords } = {}) {
  const url = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(keywords)}`;
  console.log(`Searching content: ${keywords}`);
  await browser.navigate({ url });
  await browser.wait({ duration: 3000 });
  const results = await browser.evaluate({
    expression: `JSON.stringify((() => {
      // Find like buttons (multi-language: aria-label patterns)
      const likeBtns = [...document.querySelectorAll('button')].filter(b => {
        const label = b.getAttribute('aria-label') || '';
        return /Reaction button|React Like|回应按钮/.test(label);
      });
      if (likeBtns.length < 2) return [];
      const getAncestors = (el) => { const a = []; let e = el; while(e) { a.push(e); e = e.parentElement; } return a; };
      const a1 = getAncestors(likeBtns[0]);
      const s1 = new Set(a1);
      const lca = getAncestors(likeBtns[1]).find(el => s1.has(el));
      const depth = a1.indexOf(lca);
      let card0 = likeBtns[0];
      for (let i = 0; i < depth - 1; i++) card0 = card0.parentElement;
      const container = card0.parentElement;
      const cards = [...container.children].filter(c => c.innerText?.trim().length > 20);
      return cards.map((card, i) => {
        const lines = card.innerText.split('\\n').map(l => l.trim()).filter(Boolean);
        const nameIdx = /^(Feed post|信息流动态)$/.test(lines[0]) ? 1 : 0;
        const authorLink = card.querySelector('a[href*="/in/"]');
        const timeLine = lines.find(l => /\\d+\\s*(h|d|w|m|mo|hr|min|hour|day|week|小时|天前|周前|分钟|个月)/.test(l)) || '';
        const bodyLines = lines.filter(l => l.length > 40 && !/\\d+(st|nd|rd|th)\\+?$|度\\+/.test(l));
        return {
          index: i + 1,
          author: lines[nameIdx] || '',
          authorTitle: lines[nameIdx + 1] || '',
          time: timeLine,
          body: bodyLines[0]?.substring(0, 300) || '',
          authorUrl: authorLink?.href || '',
        };
      }).filter(p => p.author && !/useful|有用|helpful|Are these/.test(p.author))
        .map((p, i) => ({ ...p, index: i + 1 }));
    })())`,
  });
  console.log(`Found ${results.length} content posts`);
  return results;
}

/** Extract network suggestions (people you may know) → [{ index, name, title, mutual, profileUrl }]
 * @requires Current page is My Network (/mynetwork/) or navigates automatically */
export async function extractNetworkSuggestions(browser) {
  console.log('Extracting network suggestions...');
  await browser.navigate({ url: 'https://www.linkedin.com/mynetwork/' });
  await browser.wait({ duration: 3000 });
  const results = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const connectBtns = [...document.querySelectorAll('button')].filter(b =>
        /^(Connect|加为好友)$/.test(b.innerText?.trim())
      );
      return connectBtns.map((btn, i) => {
        let card = btn;
        for (let j = 0; j < 6; j++) card = card.parentElement;
        const lines = card.innerText.split('\\n').map(l => l.trim()).filter(l =>
          l && !/^(Connect|加为好友|Follow|关注|Pending|待处理)$/.test(l) && l.length > 1
        );
        const link = card.querySelector('a[href*="/in/"]');
        // lines: [name+badge, name, title, company, ...mutual]
        const name = lines[0]?.replace(/,\\s*(Verified|已验证)/, '') || '';
        const title = lines[2] || '';
        const mutual = lines.find(l => /mutual|共同/.test(l)) || lines[3] || '';
        return {
          index: i + 1,
          name,
          title,
          mutual,
          profileUrl: link?.href || '',
        };
      });
    })())`,
  });
  console.log(`Found ${results.length} suggestions`);
  return results;
}

/** Create a new post → { posted }
 * @requires Current tab is on linkedin.com */
export async function createPost(browser, { text } = {}) {
  console.log(`Creating post (${text.length} chars)...`);
  await browser.navigate({ url: 'https://www.linkedin.com/feed/' });
  await browser.wait({ duration: 2000 });

  // Click "Start a post" area
  await browser.evaluate({
    expression: `document.querySelector('.share-box-feed-entry__top-bar')?.click()`,
  });
  await browser.wait({ duration: 1500 });

  // Type into the Quill editor
  await browser.evaluate({
    expression: `(() => {
      const editor = document.querySelector('.ql-editor');
      if (!editor) return;
      editor.focus();
      editor.innerHTML = '<p>' + ${JSON.stringify(text)}.replace(/\\n/g, '</p><p>') + '</p>';
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    })()`,
  });
  await browser.wait({ duration: 500 });

  // Click "Post" / "发布" button
  await browser.evaluate({
    expression: `document.querySelector('.share-actions__primary-action')?.click()`,
  });
  await browser.wait({ duration: 2000 });

  console.log('Post published');
  return { posted: true };
}

/** Like/unlike a post by its index (1-based) in the current feed/search view → { liked, index }
 * @requires Current page has posts with like buttons visible */
export async function toggleLike(browser, { index } = {}) {
  const n = Number(index) || 1;
  console.log(`Toggling like on post #${n}...`);
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const likeBtns = [...document.querySelectorAll('button')].filter(b => {
        const label = b.getAttribute('aria-label') || '';
        return /Reaction button|React Like|回应按钮/.test(label);
      });
      const btn = likeBtns[${n - 1}];
      if (!btn) return { error: 'Like button not found at index ${n}' };
      const wasLiked = btn.getAttribute('aria-pressed') === 'true'
        || /Unlike|取消|already reacted/.test(btn.getAttribute('aria-label') || '');
      btn.click();
      return { liked: !wasLiked, index: ${n} };
    })())`,
  });
  if (result.error) console.log(result.error);
  else console.log(`Post #${n}: ${result.liked ? 'liked' : 'unliked'}`);
  return result;
}

/** Comment on a post by its index (1-based) → { commented, index }
 * @requires Current page has feed posts with comment buttons visible */
export async function commentOnPost(browser, { index, text } = {}) {
  const n = Number(index) || 1;
  console.log(`Commenting on post #${n}...`);

  // Click the comment button to open comment box
  await browser.evaluate({
    expression: `(() => {
      const commentBtns = [...document.querySelectorAll('.comment-button, button[aria-label*="Comment"], button[aria-label*="评论"]')];
      const btn = commentBtns[${n - 1}];
      if (btn) btn.click();
    })()`,
  });
  await browser.wait({ duration: 1500 });

  // Type into comment editor
  await browser.evaluate({
    expression: `(() => {
      const editors = document.querySelectorAll('.ql-editor[data-placeholder]');
      const editor = editors[editors.length - 1];
      if (!editor) return;
      editor.focus();
      editor.innerHTML = '<p>' + ${JSON.stringify(text)} + '</p>';
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    })()`,
  });
  await browser.wait({ duration: 500 });

  // Click submit comment button
  await browser.evaluate({
    expression: `(() => {
      const submitBtn = [...document.querySelectorAll('button.comments-comment-box__submit-button, button[class*="comment"][type="submit"]')]
        .find(b => !b.disabled);
      if (submitBtn) submitBtn.click();
    })()`,
  });
  await browser.wait({ duration: 2000 });

  console.log(`Commented on post #${n}`);
  return { commented: true, index: n };
}

/** Send a connection request to the current profile → { sent, name }
 * @requires Current page is a profile page (/in/<user>/) with a Connect button */
export async function sendConnectionRequest(browser, { note } = {}) {
  console.log('Sending connection request...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const btn = [...document.querySelectorAll('button')].find(b =>
        /^(Connect|加为好友)$/.test(b.innerText?.trim())
      );
      if (!btn) return { error: 'No Connect button found. User may already be a connection.' };
      const name = document.querySelector('h1')?.innerText?.trim() || '';
      btn.click();
      return { clicked: true, name };
    })())`,
  });

  if (result.error) {
    console.log(result.error);
    return result;
  }

  await browser.wait({ duration: 1500 });

  if (note) {
    // Click "Add a note" if the dialog appears
    await browser.evaluate({
      expression: `(() => {
        const addNoteBtn = [...document.querySelectorAll('button')].find(b =>
          /^(Add a note|添加备注)$/.test(b.innerText?.trim())
        );
        if (addNoteBtn) addNoteBtn.click();
      })()`,
    });
    await browser.wait({ duration: 1000 });

    // Type the note
    await browser.evaluate({
      expression: `(() => {
        const textarea = document.querySelector('#custom-message, textarea[name="message"]');
        if (textarea) {
          textarea.focus();
          textarea.value = ${JSON.stringify(note)};
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()`,
    });
    await browser.wait({ duration: 500 });
  }

  // Click Send
  await browser.evaluate({
    expression: `(() => {
      const sendBtn = [...document.querySelectorAll('button[aria-label*="Send"], button[aria-label*="发送"]')]
        .find(b => !b.disabled) || [...document.querySelectorAll('button')].find(b =>
          /^(Send now|Send|发送)$/.test(b.innerText?.trim())
        );
      if (sendBtn) sendBtn.click();
    })()`,
  });
  await browser.wait({ duration: 1500 });

  console.log(`Connection request sent to ${result.name}`);
  return { sent: true, name: result.name };
}

/** Send a direct message to the current profile → { sent, name }
 * @requires Current page is a profile page with a Message button */
export async function sendMessage(browser, { text } = {}) {
  console.log('Sending message...');

  // Click Message button
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const btn = [...document.querySelectorAll('button')].find(b =>
        /^(Message|发消息)$/.test(b.innerText?.trim())
      );
      if (!btn) return { error: 'No Message button found.' };
      const name = document.querySelector('h1')?.innerText?.trim() || '';
      btn.click();
      return { clicked: true, name };
    })())`,
  });

  if (result.error) {
    console.log(result.error);
    return result;
  }

  await browser.wait({ duration: 2000 });

  // Type message into the messaging overlay editor
  await browser.evaluate({
    expression: `(() => {
      const editor = document.querySelector('.msg-form__contenteditable [contenteditable="true"], .msg-form__msg-content-container [contenteditable="true"]');
      if (!editor) return;
      editor.focus();
      editor.innerHTML = '<p>' + ${JSON.stringify(text)} + '</p>';
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    })()`,
  });
  await browser.wait({ duration: 500 });

  // Click Send
  await browser.evaluate({
    expression: `(() => {
      const sendBtn = document.querySelector('.msg-form__send-button, button[type="submit"].msg-form__send-button')
        || [...document.querySelectorAll('button')].find(b => /^(Send|发送)$/.test(b.innerText?.trim()));
      if (sendBtn && !sendBtn.disabled) sendBtn.click();
    })()`,
  });
  await browser.wait({ duration: 1500 });

  console.log(`Message sent to ${result.name}`);
  return { sent: true, name: result.name };
}

/** Follow or unfollow a company → { followed, name }
 * @requires Current page is a company page (/company/<slug>/) */
export async function toggleFollowCompany(browser) {
  console.log('Toggling company follow...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const name = document.querySelector('h1')?.innerText?.trim() || '';
      const followBtn = [...document.querySelectorAll('button')].find(b => {
        const t = b.innerText?.trim();
        return /^(Follow|关注|Following|正在关注|已关注)$/.test(t);
      });
      if (!followBtn) return { error: 'No Follow button found' };
      const t = followBtn.innerText?.trim();
      const wasFollowing = /^(Following|正在关注|已关注)$/.test(t);
      followBtn.click();
      return { followed: !wasFollowing, name };
    })())`,
  });
  if (result.error) console.log(result.error);
  else console.log(`${result.followed ? 'Followed' : 'Unfollowed'} ${result.name}`);
  return result;
}

/** Save the currently selected job → { saved }
 * @requires Current page is a job search page with a job detail panel open */
export async function saveJob(browser) {
  console.log('Saving job...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const saveBtn = document.querySelector('.jobs-save-button');
      if (!saveBtn) return { error: 'No save button found' };
      const title = document.querySelector('.job-details-jobs-unified-top-card__job-title')?.innerText?.trim() || '';
      saveBtn.click();
      return { saved: true, title };
    })())`,
  });
  if (result.error) console.log(result.error);
  else console.log(`Saved job: ${result.title}`);
  return result;
}

/** Extract pending connection invitations → [{ index, name, title, time, profileUrl }]
 * @requires None (navigates automatically) */
export async function extractInvitations(browser) {
  console.log('Extracting invitations...');
  await browser.navigate({ url: 'https://www.linkedin.com/mynetwork/invitation-manager/' });
  await browser.wait({ duration: 3000 });
  const results = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const cards = document.querySelectorAll('.invitation-card, [class*="invitation-card"]');
      if (cards.length > 0) {
        return [...cards].map((el, i) => ({
          index: i + 1,
          text: el.innerText?.trim()?.substring(0, 200),
          link: el.querySelector('a')?.href || '',
        }));
      }
      const main = document.querySelector('[role="main"]');
      const text = main?.innerText?.substring(0, 500) || '';
      const noInvites = /No pending|No new invitations|无待处理|没有新邀请/.test(text);
      return [{ info: noInvites ? 'No pending invitations' : text.substring(0, 200) }];
    })())`,
  });
  console.log(`Found ${results.length} invitations`);
  return results;
}

/** Inject global feed post collector (for infinite scroll) → { collected }
 * @requires Current page is LinkedIn feed */
export async function initFeedCollector(browser) {
  console.log('Injecting feed collector...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      window.__linkedinPosts = [];
      window.__linkedinSeen = new Set();
      const collect = () => {
        document.querySelectorAll('.feed-shared-update-v2[data-urn*="activity"], .feed-shared-update-v2[data-urn*="ugcPost"]').forEach(el => {
          const urn = el.getAttribute('data-urn');
          if (urn && !window.__linkedinSeen.has(urn)) {
            window.__linkedinSeen.add(urn);
            window.__linkedinPosts.push({
              index: window.__linkedinPosts.length + 1,
              urn,
              author: el.querySelector('.update-components-actor__title span[dir="ltr"] > span[aria-hidden="true"]')?.innerText?.trim() || '',
              authorDesc: el.querySelector('.update-components-actor__description span[aria-hidden="true"]')?.innerText?.trim() || '',
              time: el.querySelector('.update-components-actor__sub-description span[aria-hidden="true"]')?.innerText?.trim() || '',
              body: el.querySelector('.feed-shared-inline-show-more-text')?.innerText?.trim()?.substring(0, 500) || '',
              reactions: el.querySelector('.social-details-social-counts__reactions-count')?.innerText?.trim() || '0',
              comments: el.querySelector('.social-details-social-counts__comments')?.innerText?.trim() || '',
            });
          }
        });
        return window.__linkedinPosts.length;
      };
      return { collected: collect() };
    })())`,
  });
  console.log(`Collector injected, initially collected ${result.collected} posts`);
  return result;
}

/** Scroll and collect new feed posts → { collected }
 * @requires initFeedCollector called first */
export async function scrollAndCollect(browser, { amount } = {}) {
  console.log(`Scrolling ${amount || 2000}px and collecting...`);
  await browser.scroll({ direction: 'down', amount: Number(amount) || 2000 });
  await browser.wait({ duration: 2000 });
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      document.querySelectorAll('.feed-shared-update-v2[data-urn*="activity"], .feed-shared-update-v2[data-urn*="ugcPost"]').forEach(el => {
        const urn = el.getAttribute('data-urn');
        if (urn && !window.__linkedinSeen.has(urn)) {
          window.__linkedinSeen.add(urn);
          window.__linkedinPosts.push({
            index: window.__linkedinPosts.length + 1,
            urn,
            author: el.querySelector('.update-components-actor__title span[dir="ltr"] > span[aria-hidden="true"]')?.innerText?.trim() || '',
            body: el.querySelector('.feed-shared-inline-show-more-text')?.innerText?.trim()?.substring(0, 500) || '',
            reactions: el.querySelector('.social-details-social-counts__reactions-count')?.innerText?.trim() || '0',
          });
        }
      });
      return { collected: window.__linkedinPosts.length };
    })())`,
  });
  console.log(`Total collected: ${result.collected} posts`);
  return result;
}

/** Read collected posts → array
 * @requires initFeedCollector called first */
export async function getCollectedPosts(browser, { limit } = {}) {
  const n = Number(limit) || 0;
  console.log(`Reading collected posts${n > 0 ? ` (limit: ${n})` : ''}...`);
  const results = await browser.evaluate({
    expression: `JSON.stringify(${n > 0 ? `window.__linkedinPosts.slice(0, ${n})` : 'window.__linkedinPosts'})`,
  });
  console.log(`Returned ${results.length} posts`);
  return results;
}

/** Full workflow: detect login → extract feed or search jobs */
export default async function (browser, args) {
  const { loggedIn } = await detectLogin(browser);
  if (!loggedIn) {
    console.log('Not logged in. Please log in to LinkedIn in the browser and retry.');
    return { loggedIn: false };
  }
  if (args && args.keywords) {
    return await searchJobs(browser, { keywords: args.keywords, location: args.location });
  }
  return await extractFeed(browser);
}

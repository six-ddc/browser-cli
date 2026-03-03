// scripts/gmail.mjs — Gmail recipe functions
// Each function: (browser, args?) => Promise<result>
// browser.evaluate() auto-unwraps { value } and JSON.parse, so expression
// that returns JSON.stringify(...) will yield a parsed JS object directly.

/** Detect login state → { loggedIn }
 * @requires Current tab is on mail.google.com */
export async function detectLogin(browser) {
  console.log('Detecting login state...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const title = document.title;
      const hasInbox = title.includes("Inbox");
      const hasGmail = title.includes("Gmail");
      const hasCompose = !!document.querySelector('button[aria-label*="Compose"]');
      const loggedIn = hasInbox || hasCompose;
      return { loggedIn, title, hasInbox, hasGmail, hasCompose };
    })())`,
  });
  console.log(
    'Login state:',
    result.loggedIn ? 'logged in' : 'not logged in',
    `(title: "${result.title}")`,
  );
  return { loggedIn: result.loggedIn };
}

/** Extract email list → [{ threadId, unread, sender, senderEmail, subject, snippet, date, hasAttachment }]
 * @requires Current page is Gmail inbox or any email list view */
export async function extractInbox(browser) {
  console.log('Extracting email list...');
  const results = await browser.evaluate({
    expression: `JSON.stringify(Array.from(document.querySelectorAll("tr:has(span[data-thread-id])")).map(r => ({
      threadId: r.querySelector("span[data-thread-id]")?.getAttribute("data-legacy-thread-id") || "",
      unread: getComputedStyle(r.querySelector("span[email]")).fontWeight === "700",
      sender: r.querySelector("span[email]")?.getAttribute("name") || "",
      senderEmail: r.querySelector("span[email]")?.getAttribute("email") || "",
      subject: r.querySelector("span[data-thread-id]")?.textContent || "",
      snippet: r.querySelector("td[role='gridcell'] div[role='link'] > div > span")?.textContent?.replace(/^\\s*-\\s*/, "").trim() || "",
      date: r.querySelector("td span[title]")?.getAttribute("title") || "",
      hasAttachment: !!r.querySelector("img[alt='Has attachment']")
    })))`,
  });
  console.log(`Extracted ${results.length} emails`);
  return results;
}

/** Open an email by subject text
 * @requires Current page is a Gmail email list with the target email visible */
export async function openEmail(browser, { subject }) {
  console.log(`Opening email: "${subject}"`);
  await browser.find({ selector: `text=${subject}`, action: 'click' });
  await browser.wait({ duration: 2000 });
  console.log('Email opened');
}

/** Extract current email detail → { subject, senderName, senderEmail, date, messageId, bodyText }
 * @requires Current page is a Gmail email detail view */
export async function extractEmailDetail(browser) {
  console.log('Extracting email detail...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const subject = document.querySelector("h2[data-thread-perm-id]")?.textContent || "";
      const container = document.querySelector("[data-legacy-message-id]");
      const senderName = container?.querySelector("span[email]")?.getAttribute("name") || "";
      const senderEmail = container?.querySelector("span[email]")?.getAttribute("email") || "";
      const date = container?.querySelector("span[role='gridcell'][title]")?.getAttribute("title") || "";
      const messageId = container?.getAttribute("data-legacy-message-id") || "";
      const bodyText = container?.querySelector("div.a3s")?.innerText || "";
      return { subject, senderName, senderEmail, date, messageId, bodyText };
    })())`,
  });
  console.log(`Email: "${result.subject}" from ${result.senderName} <${result.senderEmail}>`);
  return result;
}

/** Search emails → navigate to search results page
 * @requires Current tab is on mail.google.com */
export async function searchEmails(browser, { query }) {
  console.log(`Searching emails: "${query}"`);
  await browser.navigate({
    url: `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(query)}`,
  });
  await browser.wait({ duration: 3000 });
  console.log('Search results loaded');
}

/** Full workflow: detect login → optional search → extract email list */
export default async function (browser, args) {
  const { loggedIn } = await detectLogin(browser);
  if (!loggedIn) {
    console.log('Not logged in. Please log in to Gmail first.');
    return { loggedIn: false };
  }
  if (args && args.query) {
    await searchEmails(browser, { query: args.query });
  }
  return await extractInbox(browser);
}

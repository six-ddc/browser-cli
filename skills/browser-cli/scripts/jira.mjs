// scripts/jira.mjs — Jira Data Center / Server recipe functions (read-only)
// Compatible with any self-hosted Jira Server or Data Center instance.
// All REST API calls use browser.evaluate() so they run in the browser context
// and inherit the current session cookies automatically.
//
// browser.evaluate() auto-unwraps { value } and JSON.parse, so an expression
// that returns JSON.stringify(...) will yield a parsed JS object directly.

// ─── Node.js-side parse helpers ──────────────────────────────────────────────
// These run in the CLI process (not the browser) to transform raw API responses
// into clean, ready-to-use structures. This is the key value-add over raw fetch.

function formatDate(iso) {
  return iso ? iso.slice(0, 16).replace('T', ' ') : '';
}

// Module-level field name cache: { customfield_XXXXX: 'Human Name' }
// Populated lazily on first getIssue call; reused for the entire script session.
let _fieldMap = null;

// getFieldMap returns { id → displayKey } where displayKey is:
//   - "Human Name"              when the name is unique across all custom fields
//   - "Human Name (customfield_XXXXX)"  when the name collides with another field
async function getFieldMap(browser) {
  if (_fieldMap) return _fieldMap;
  console.log('Fetching field name map (one-time)...');
  const data = await jiraFetch(browser, '/rest/api/2/field');
  if (data.error || !Array.isArray(data)) return {};

  const customFields = data.filter((f) => f.id.startsWith('customfield_'));

  // Count how many fields share each name
  const nameCount = {};
  for (const f of customFields) nameCount[f.name] = (nameCount[f.name] || 0) + 1;

  _fieldMap = {};
  for (const f of customFields) {
    // Disambiguate duplicate names by appending the field ID
    _fieldMap[f.id] = nameCount[f.name] > 1 ? `${f.name} (${f.id})` : f.name;
  }
  return _fieldMap;
}

/**
 * Parse a raw Jira issue API response into a clean structured object.
 * Flattens nested objects, formats dates, separates custom fields.
 * @param {object} fieldMap — optional { customfield_XXXXX: 'Human Name' } for key renaming
 */
function parseIssue(raw, fieldMap = {}) {
  const f = raw.fields || {};

  // Browse URL derived from self link
  const url = raw.self ? raw.self.replace(/\/rest\/api\/2\/issue\/\d+$/, '/browse/' + raw.key) : '';

  // Sprint field: detect dynamically by value shape (Java-serialized toString array).
  // The custom field ID for Sprint varies per Jira instance — never hardcode it.
  const sprintEntry = Object.entries(f).find(
    ([k, v]) =>
      k.startsWith('customfield_') &&
      Array.isArray(v) &&
      v.length > 0 &&
      typeof v[0] === 'string' &&
      v[0].includes('com.atlassian.greenhopper'),
  );
  const sprints = sprintEntry
    ? sprintEntry[1].map((s) => {
        if (typeof s !== 'string') return s;
        const get = (key) => s.match(new RegExp(key + '=([^,\\]]+)'))?.[1]?.trim() ?? '';
        return { id: get('id'), name: get('name'), state: get('state'), endDate: get('endDate') };
      })
    : [];

  // Non-null custom fields — skip Java blobs (strings > 500 chars) and sprint (handled above)
  // Use human-readable names from fieldMap when available, fall back to raw ID.
  const customFields = {};
  for (const [k, v] of Object.entries(f)) {
    if (!k.startsWith('customfield_')) continue;
    if (v === null || v === undefined || v === '') continue;
    if (sprintEntry && k === sprintEntry[0]) continue; // sprint handled separately
    if (typeof v === 'string' && v.length > 500) continue; // Java toString blobs
    // Flatten single-key option objects { value, id, ... } → just the value string
    const cleaned = v && typeof v === 'object' && !Array.isArray(v) && 'value' in v ? v.value : v;
    const name = fieldMap[k] || k;
    customFields[name] = cleaned;
  }

  return {
    key: raw.key,
    url,
    summary: f.summary || '',
    type: f.issuetype?.name || '',
    status: f.status?.name || '',
    statusCategory: f.status?.statusCategory?.name || '',
    priority: f.priority?.name || '',
    assignee: f.assignee?.displayName || '',
    reporter: f.reporter?.displayName || '',
    created: formatDate(f.created),
    updated: formatDate(f.updated),
    labels: f.labels || [],
    fixVersions: (f.fixVersions || []).map((v) => v.name),
    components: (f.components || []).map((c) => c.name),
    parent: f.parent
      ? {
          key: f.parent.key,
          summary: f.parent.fields?.summary || '',
          status: f.parent.fields?.status?.name || '',
        }
      : null,
    subtasks: (f.subtasks || []).map((s) => ({
      key: s.key,
      summary: s.fields?.summary || '',
      status: s.fields?.status?.name || '',
      type: s.fields?.issuetype?.name || '',
    })),
    sprints,
    description: f.description || '',
    comments: (f.comment?.comments || []).map((c) => ({
      author: c.author?.displayName || '',
      created: formatDate(c.created),
      updated: formatDate(c.updated),
      body: c.body || '',
    })),
    customFields,
  };
}

/**
 * Parse a raw issue into a lightweight summary (for list views / search results).
 */
function parseIssueSummary(raw) {
  const f = raw.fields || {};
  return {
    key: raw.key,
    summary: f.summary || '',
    type: f.issuetype?.name || '',
    status: f.status?.name || '',
    statusCategory: f.status?.statusCategory?.name || '',
    priority: f.priority?.name || '',
    assignee: f.assignee?.displayName || '',
    updated: formatDate(f.updated),
  };
}

// ─── Internal helper ──────────────────────────────────────────────────────────

/**
 * Run a fetch against the Jira REST API in the browser context (uses session cookies).
 * Returns parsed JSON on success, or { error, hint } on failure.
 * @param {object} browser
 * @param {string} path — full path + query string, e.g. "/rest/api/2/issue/ORI-1?fields=summary"
 */
async function jiraFetch(browser, path) {
  const result = await browser.evaluate({
    expression: `(async () => {
      try {
        const resp = await fetch(location.origin + ${JSON.stringify(path)}, {
          headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          credentials: 'include',
        });
        if (!resp.ok) {
          const body = (await resp.text()).slice(0, 300);
          return { __error: true, status: resp.status, statusText: resp.statusText, body };
        }
        return resp.json();
      } catch (e) {
        return { __error: true, status: 0, statusText: e.message };
      }
    })()`,
  });

  if (result && result.__error) {
    const { status, statusText } = result;
    const hint =
      status === 401
        ? 'You are not logged in. Navigate to the Jira instance and log in first.'
        : status === 403
          ? 'Access denied. You may not have permission to view this resource.'
          : status === 404
            ? 'Resource not found. Check the issue key or API path.'
            : 'Check that the current tab is a valid Jira instance and you are logged in.';
    return { error: `Jira API ${path} failed: ${status} ${statusText}`, hint };
  }
  return result;
}

// ─── Page Detection ───────────────────────────────────────────────────────────

/**
 * Detect the current Jira page type from URL and DOM signals.
 * @requires Current tab is any page on a Jira Server / Data Center instance
 * @returns {{ type: 'issue'|'board'|'search'|'other', context: object }}
 */
export async function detectPage(browser) {
  console.log('Detecting Jira page type...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const appName = document.querySelector('meta[name="application-name"]')?.content;
      if (appName !== 'JIRA') {
        return { type: 'other', context: { url: location.href, appName, hint: 'meta[name="application-name"] is not "JIRA" — this may not be a Jira instance' } };
      }

      const url = location.href;

      // Issue detail page: /browse/{KEY}
      const issueMatch = url.match(/\\/browse\\/([A-Z][A-Z0-9]+-\\d+)/);
      if (issueMatch && document.querySelector('#issue-content')) {
        const key = issueMatch[1];
        const summary = document.querySelector('#summary-val')?.innerText?.trim() || '';
        const status = (
          document.querySelector('[data-issue-status]')?.getAttribute('data-issue-status') ||
          document.querySelector('#status-val .jira-issue-status-lozenge')?.innerText?.trim() ||
          document.querySelector('#status-val')?.innerText?.trim() ||
          ''
        );
        const assignee = document.querySelector('#assignee-val .user-hover')?.innerText?.trim() ||
          document.querySelector('#assignee-val')?.innerText?.trim() || '';
        return { type: 'issue', context: { key, summary, status, assignee, url } };
      }

      // Agile board: /secure/RapidBoard.jspa
      if (url.includes('/secure/RapidBoard.jspa')) {
        const params = new URLSearchParams(location.search);
        return {
          type: 'board',
          context: {
            rapidView: params.get('rapidView'),
            quickFilter: params.get('quickFilter'),
            sprint: params.get('sprint'),
            hasBoard: !!document.querySelector('.ghx-board, [data-test-id="software-board"]'),
            url
          }
        };
      }

      // Issue search/list: /issues/ or jql= in URL
      if (url.includes('/issues/') || url.includes('jql=') || document.querySelector('#issuetable')) {
        const total = (
          document.querySelector('#issue-total')?.innerText?.trim() ||
          document.querySelector('.results-count-total')?.innerText?.trim() ||
          ''
        );
        const jql = new URLSearchParams(location.search).get('jql') || '';
        return { type: 'search', context: { url, totalResults: total, jql } };
      }

      return { type: 'other', context: { url } };
    })())`,
  });

  console.log(
    `Page type: ${result.type}${result.context?.key ? ' (' + result.context.key + ')' : ''}`,
  );
  return result;
}

// ─── Current User ─────────────────────────────────────────────────────────────

/**
 * Get the currently logged-in user's info.
 * @requires Logged in to Jira
 * @returns {{ name, displayName, emailAddress, locale, timeZone }}
 */
export async function getCurrentUser(browser) {
  console.log('Fetching current user...');
  const data = await jiraFetch(browser, '/rest/api/2/myself');
  if (data.error) return data;
  const { name, displayName, emailAddress, locale, timeZone } = data;
  console.log(`Current user: ${displayName} (${name})`);
  return { name, displayName, emailAddress, locale, timeZone };
}

// ─── Issues ───────────────────────────────────────────────────────────────────

/**
 * Get full details for a single Jira issue.
 * @requires Logged in with Browse Issues permission for the project
 * @param {string} issueKey — e.g. "ORI-137826"
 * @param {string} [fields] — comma-separated field IDs; "*all" returns every field including custom
 * @returns Full issue object: { key, fields: { summary, status, assignee, priority, ... } }
 */
export async function getIssue(browser, { issueKey, fields = '*all' } = {}) {
  if (!issueKey) {
    return {
      error: 'issueKey is required',
      hint: 'Provide --issueKey <PROJECT-123> when calling: browser-cli script jira.mjs --call getIssue -- --issueKey PROJECT-123',
    };
  }
  console.log(`Fetching issue ${issueKey}...`);
  const path = `/rest/api/2/issue/${encodeURIComponent(issueKey)}?fields=${encodeURIComponent(fields)}`;
  const fieldMap = await getFieldMap(browser);
  const data = await jiraFetch(browser, path);
  if (data.error) return data;
  const parsed = parseIssue(data, fieldMap);
  console.log(`Issue: ${parsed.key} — ${parsed.summary}`);
  return parsed;
}

/**
 * Search issues using JQL.
 * @requires Logged in with Browse Issues permission
 * @param {string} jql — JQL query string, e.g. "project = ORI AND status = Open"
 * @param {string} [fields] — comma-separated field IDs (default: common fields)
 * @param {number} [maxResults] — max results to return (default: 50)
 * @param {number} [startAt] — pagination offset (default: 0)
 * @returns {{ total, startAt, maxResults, issues: [{ key, fields }] }}
 */
export async function searchIssues(
  browser,
  {
    jql,
    fields = 'summary,status,assignee,priority,issuetype,created,updated',
    maxResults = 50,
    startAt = 0,
  } = {},
) {
  if (!jql) {
    return {
      error: 'jql is required',
      hint: 'Provide --jql "project = ORI AND status = Open" when calling searchIssues',
    };
  }
  console.log(`Searching issues: ${jql}`);
  const path =
    `/rest/api/2/search?` +
    `jql=${encodeURIComponent(jql)}` +
    `&fields=${encodeURIComponent(fields)}` +
    `&maxResults=${maxResults}` +
    `&startAt=${startAt}`;
  const data = await jiraFetch(browser, path);
  if (data.error) return data;
  const issues = (data.issues || []).map(parseIssueSummary);
  console.log(`Found ${data.total} issues (showing ${issues.length})`);
  return { total: data.total, startAt: data.startAt, maxResults: data.maxResults, issues };
}

/**
 * Get all open issues assigned to the current user in open sprints.
 * @requires Logged in with Browse Issues permission; Jira Software (Agile) required for sprint filter
 * @returns Same shape as searchIssues
 */
export async function getMyOpenIssues(browser) {
  console.log('Fetching my open issues in active sprints...');
  const jql =
    'assignee = currentUser() AND sprint in openSprints() ORDER BY priority DESC, updated DESC';
  return searchIssues(browser, {
    jql,
    fields: 'summary,status,assignee,priority,issuetype,sprint,created,updated',
    maxResults: 50,
  });
}

/**
 * Get all issues in a specific sprint.
 * @requires Logged in with Browse Issues permission
 * @param {number|string} sprintId — sprint ID (numeric). Find IDs via board URL params or /rest/agile/1.0/board/{boardId}/sprint
 * @param {string} [fields] — comma-separated field IDs
 * @param {number} [maxResults] — max results (default: 100)
 * @returns Same shape as searchIssues
 */
export async function getSprintIssues(
  browser,
  { sprintId, fields = 'summary,status,assignee,priority,issuetype', maxResults = 100 } = {},
) {
  if (!sprintId) {
    return {
      error: 'sprintId is required',
      hint: 'Provide --sprintId <number>. Find sprint IDs via the board URL (?sprint=<id>) or /rest/agile/1.0/board/<boardId>/sprint',
    };
  }
  console.log(`Fetching sprint ${sprintId} issues...`);
  const jql = `sprint = ${sprintId} ORDER BY status ASC, priority DESC`;
  return searchIssues(browser, { jql, fields, maxResults });
}

// ─── Field Discovery ──────────────────────────────────────────────────────────

/**
 * Discover all available fields in this Jira instance, including company-specific custom fields.
 * Useful for agents to understand what field IDs to use in getIssue/searchIssues calls.
 * @requires Logged in to Jira
 * @returns {{ totalFields, customFields: [{ id, name, schema }], systemFields: [{ id, name }] }}
 */
export async function discoverCustomFields(browser) {
  console.log('Discovering all fields (system + custom)...');
  const data = await jiraFetch(browser, '/rest/api/2/field');
  if (data.error) return data;
  if (!Array.isArray(data)) {
    return {
      error: 'Unexpected response from /rest/api/2/field',
      hint: 'Ensure you are logged in and the instance is Jira Server/DC',
      raw: data,
    };
  }
  const customFields = data
    .filter((f) => f.custom)
    .map((f) => ({ id: f.id, name: f.name, schema: f.schema?.type || 'unknown', custom: true }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const systemFields = data
    .filter((f) => !f.custom)
    .map((f) => ({ id: f.id, name: f.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  console.log(`Found ${customFields.length} custom fields, ${systemFields.length} system fields`);
  return { totalFields: data.length, customFields, systemFields };
}

// ─── Board (DOM) ──────────────────────────────────────────────────────────────

/**
 * Extract all issues from the current Agile board page.
 * Tries ARIA structure first, falls back to legacy .ghx-* selectors.
 * @requires Current tab is a Jira Agile Board (/secure/RapidBoard.jspa) with cards loaded
 * @returns Array of { swimlane, column, key, title, assignee, priority, type }
 */
export async function getBoardIssues(browser) {
  console.log('Extracting board issues from DOM...');

  // First wait for the board to render
  await browser.wait({
    selector: '.ghx-board, [role="group"][aria-label*="Swimlane"]',
    timeout: 8000,
  });

  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      // Strategy 1: ARIA structure (newer Jira DC versions)
      const ariaSwimlanesEls = [...document.querySelectorAll('[role="group"][aria-label*="Swimlane"]')];
      if (ariaSwimlanesEls.length > 0) {
        const issues = [];
        ariaSwimlanesEls.forEach(swimlaneEl => {
          const swimlaneLabel = swimlaneEl.getAttribute('aria-label') || '';
          const swimlane = swimlaneLabel.replace(/^Swimlane:\\s*/i, '').trim() || 'Default';
          const cards = [...swimlaneEl.querySelectorAll('[role="group"][aria-label*="Issue"]')];
          cards.forEach(card => {
            const label = card.getAttribute('aria-label') || '';
            const keyMatch = label.match(/([A-Z][A-Z0-9]+-\\d+)/);
            const key = keyMatch ? keyMatch[1] : '';
            const assignee =
              card.querySelector('[data-tooltip*="Assignee"]')?.getAttribute('data-tooltip') ||
              card.querySelector('.ghx-avatar img')?.alt || '';
            const priority =
              card.querySelector('.ghx-priority-icon img')?.alt ||
              card.querySelector('[data-tooltip*="Priority"]')?.getAttribute('data-tooltip') || '';
            const type =
              card.querySelector('.ghx-type img')?.alt ||
              card.querySelector('[data-tooltip*="Issue Type"]')?.getAttribute('data-tooltip') || '';
            issues.push({ swimlane, column: '', key, title: label, assignee, priority, type });
          });
        });
        if (issues.length > 0) return { strategy: 'aria', issues };
      }

      // Strategy 2: Legacy .ghx-* selectors (stable across all Jira DC versions)
      const columnHeaders = [...document.querySelectorAll('#ghx-column-headers .ghx-column')];
      const swimlaneEls = [...document.querySelectorAll('.ghx-swimlane')];
      if (swimlaneEls.length > 0) {
        const issues = [];
        swimlaneEls.forEach(swimlaneEl => {
          const swimlane =
            swimlaneEl.querySelector('.ghx-swimlane-name')?.innerText?.trim() || 'Default';
          const colEls = [...swimlaneEl.querySelectorAll('.ghx-columns > .ghx-column')];
          colEls.forEach((colEl, colIdx) => {
            const column =
              columnHeaders[colIdx]?.querySelector('.ghx-column-title')?.innerText?.trim() ||
              String(colIdx + 1);
            colEl.querySelectorAll('.ghx-issue').forEach(card => {
              const key = card.getAttribute('data-issue-key') || '';
              // Use title attribute — innerText returns '' for off-screen cards
              const title =
                card.querySelector('.ghx-summary')?.getAttribute('title') ||
                card.querySelector('.ghx-summary')?.textContent?.trim() || '';
              const assigneeRaw =
                card.querySelector('.ghx-avatar img')?.alt ||
                card.querySelector('.ghx-avatar span[title]')?.getAttribute('title') || '';
              const assignee = assigneeRaw.replace(/^Assignee:\\s*/i, '');
              const priority = (card.querySelector('.ghx-priority-icon img')?.alt || '').replace(/^Priority:\\s*/i, '');
              const type = (card.querySelector('.ghx-type img')?.alt || '').replace(/^Issue Type:\\s*/i, '');
              issues.push({ swimlane, column, key, title, assignee, priority, type });
            });
          });
        });
        if (issues.length > 0) return { strategy: 'ghx', issues };
      }

      // No issues found
      return {
        strategy: 'none',
        issues: [],
        error: 'No board issues found',
        hint: 'Navigate to a Jira Agile Board (/secure/RapidBoard.jspa) and wait for cards to load before calling getBoardIssues'
      };
    })())`,
  });

  if (result.strategy === 'none') {
    console.log('No board issues found');
    return result;
  }
  console.log(`Extracted ${result.issues.length} board issues (strategy: ${result.strategy})`);
  return result.issues;
}

// ─── Default export ───────────────────────────────────────────────────────────

/**
 * Auto-detect the current Jira page type and return contextual data.
 * On issue page → returns full issue details.
 * On board page → returns all board issues.
 * Otherwise → returns page detection result with navigation hint.
 */
export default async function (browser) {
  const page = await detectPage(browser);
  if (page.type === 'issue' && page.context?.key) {
    return getIssue(browser, { issueKey: page.context.key });
  }
  if (page.type === 'board') {
    return getBoardIssues(browser);
  }
  if (page.type === 'search') {
    return { page, hint: 'Use searchIssues with a JQL query to fetch structured results via API' };
  }
  return {
    page,
    hint: 'Navigate to a Jira issue (/browse/KEY), board (/secure/RapidBoard.jspa), or search (/issues/) first',
  };
}

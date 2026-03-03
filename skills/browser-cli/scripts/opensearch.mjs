// scripts/opensearch.mjs — OpenSearch Dashboards recipe functions (read-only)
// Compatible with any self-hosted OpenSearch Dashboards instance.
// All search calls use /internal/search/opensearch (OSD's internal proxy) so they
// run in the browser context and inherit session cookies automatically.
//
// IMPORTANT: browser.evaluate() does NOT await Promises returned by async
// expressions. All HTTP calls must use synchronous XMLHttpRequest.
//
// Typical workflow:
//   1. listIndexPatterns()      — discover available indices
//   2. getIndexFields()         — discover field names and which are aggregatable
//   3. searchPhrase() / searchLogs() / countByField() / timeHistogram()

// ─── Node.js-side helpers ─────────────────────────────────────────────────────

function formatDate(iso) {
  return iso ? iso.slice(0, 19).replace('T', ' ') : '';
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Run a DSL search against the OSD internal search proxy.
 * Uses synchronous XHR — works inside browser.evaluate() which does not await Promises.
 * @param {object} browser
 * @param {string} index — index name or pattern, e.g. "my-logs-*"
 * @param {object} dslBody — full OpenSearch DSL body ({ query, aggs, size, sort, _source, ... })
 * @returns parsed rawResponse ({ hits, aggregations, ... }) or { error, hint }
 */
async function osdSearch(browser, index, dslBody) {
  const payload = JSON.stringify({ params: { index, body: dslBody } });
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', location.origin + '/internal/search/opensearch', false);
        xhr.setRequestHeader('osd-xsrf', 'true');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.withCredentials = true;
        xhr.send(${JSON.stringify(payload)});
        if (xhr.status < 200 || xhr.status >= 300) {
          return { __error: true, status: xhr.status, body: xhr.responseText.slice(0, 400) };
        }
        const d = JSON.parse(xhr.responseText);
        return d.rawResponse || d;
      } catch(e) {
        return { __error: true, status: 0, message: e.message };
      }
    })())`,
  });

  if (result && result.__error) {
    const hint =
      result.status === 401
        ? 'Not logged in. Navigate to the OpenSearch Dashboards instance and log in first.'
        : result.status === 403
          ? 'Access denied. You may not have permission for this index.'
          : 'Check that the current tab is on the OpenSearch Dashboards instance and you are logged in.';
    return { error: `Search failed: ${result.status} — ${result.body || result.message}`, hint };
  }
  return result;
}

/**
 * Call an OSD REST API (GET) in the browser context.
 * @param {object} browser
 * @param {string} path — e.g. "/api/saved_objects/_find?type=index-pattern"
 */
async function osdGet(browser, path) {
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', location.origin + ${JSON.stringify(path)}, false);
        xhr.setRequestHeader('osd-xsrf', 'true');
        xhr.withCredentials = true;
        xhr.send();
        if (xhr.status < 200 || xhr.status >= 300) {
          return { __error: true, status: xhr.status, body: xhr.responseText.slice(0, 400) };
        }
        return JSON.parse(xhr.responseText);
      } catch(e) {
        return { __error: true, status: 0, message: e.message };
      }
    })())`,
  });

  if (result && result.__error) {
    return { error: `GET ${path} failed: ${result.status}`, hint: 'Check login state and path.' };
  }
  return result;
}

// ─── Cluster & Index Discovery ────────────────────────────────────────────────

/**
 * Get OpenSearch Dashboards version and cluster health.
 * @requires Current tab is on an OpenSearch Dashboards instance
 * @returns {{ name, version, status, os, uptime_hours }}
 */
export async function getStatus(browser) {
  console.log('Fetching OSD status...');
  const data = await osdGet(browser, '/api/status');
  if (data.error) return data;
  const os = data.metrics?.os || {};
  const proc = data.metrics?.process || {};
  return {
    name: data.name,
    version: data.version?.number,
    status: data.status?.overall?.state,
    os: `${os.distro} ${os.platformRelease}`,
    uptime_hours: Math.round((proc.uptime_in_millis || 0) / 3600000),
  };
}

/**
 * List all saved index patterns in this OSD instance.
 * Run this first to discover available index patterns and their IDs.
 * @requires Logged in to OpenSearch Dashboards
 * @returns Array of { id, title, timeField }
 */
export async function listIndexPatterns(browser) {
  console.log('Listing index patterns...');
  const data = await osdGet(browser, '/api/saved_objects/_find?type=index-pattern&per_page=50');
  if (data.error) return data;
  const patterns = (data.saved_objects || []).map((o) => ({
    id: o.id,
    title: o.attributes.title,
    timeField: o.attributes.timeFieldName || '',
  }));
  console.log(`Found ${patterns.length} index patterns`);
  return patterns;
}

/**
 * List fields for a given index pattern (by saved object ID).
 * Run this to discover field names and which fields are aggregatable before
 * calling countByField() or timeHistogram().
 *
 * Aggregatable fields (aggregatable: true) can be used in terms/date_histogram
 * aggregations. Non-aggregatable text fields can be searched but not aggregated.
 *
 * @requires Logged in to OpenSearch Dashboards
 * @param {string} patternId — saved object ID (get from listIndexPatterns, e.g. "my-logs")
 * @returns {{ title, timeField, aggrFields: [{ name, type }], searchFields: [{ name, type }] }}
 */
export async function getIndexFields(browser, { patternId } = {}) {
  if (!patternId) {
    return {
      error: 'patternId is required',
      hint: 'Run listIndexPatterns first to get pattern IDs, then pass one as --patternId <id>',
    };
  }
  console.log(`Fetching fields for index pattern: ${patternId}`);
  const data = await osdGet(browser, `/api/saved_objects/index-pattern/${patternId}`);
  if (data.error) return data;
  const raw = JSON.parse(data.attributes.fields || '[]');
  const fields = raw
    .filter((f) => !f.name.startsWith('_'))
    .map((f) => ({
      name: f.name,
      type: f.type,
      aggregatable: !!f.aggregatable,
      searchable: !!f.searchable,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    title: data.attributes.title,
    timeField: data.attributes.timeFieldName,
    totalFields: fields.length,
    aggrFields: fields.filter((f) => f.aggregatable),
    searchFields: fields.filter((f) => f.searchable && !f.aggregatable),
  };
}

// ─── Log Search ───────────────────────────────────────────────────────────────

/**
 * Full-text phrase search across the `message` field (or a field of your choice).
 * @requires Logged in with read access to the target index
 * @param {string} index — index pattern title, e.g. "my-logs-*" (get from listIndexPatterns)
 * @param {string} phrase — exact phrase to search for
 * @param {string} [field] — field to search in (default: "message")
 * @param {string} [from] — time range start (ISO or relative like "now-1h"). Default: "now-24h"
 * @param {string} [to] — time range end. Default: "now"
 * @param {string} [timeField] — name of the timestamp field. Default: "@timestamp"
 * @param {number} [size] — number of hits to return (default: 10)
 * @param {string[]} [sourceFields] — list of fields to include in results (default: all)
 * @returns {{ total, hits: [{ _index, _source }] }}
 */
export async function searchPhrase(
  browser,
  {
    index,
    phrase,
    field = 'message',
    from = 'now-24h',
    to = 'now',
    timeField = '@timestamp',
    size = 10,
    sourceFields,
  } = {},
) {
  if (!index)
    return {
      error: 'index is required',
      hint: 'Run listIndexPatterns to find available index patterns',
    };
  if (!phrase)
    return { error: 'phrase is required', hint: 'Provide --phrase "your search phrase"' };

  console.log(`Searching phrase "${phrase}" in ${index}/${field} [${from} → ${to}]...`);
  const raw = await osdSearch(browser, index, {
    size,
    query: {
      bool: {
        must: [{ match_phrase: { [field]: phrase } }],
        filter: [{ range: { [timeField]: { gte: from, lte: to } } }],
      },
    },
    sort: [{ [timeField]: { order: 'desc' } }],
    ...(sourceFields ? { _source: sourceFields } : {}),
  });
  if (raw.error) return raw;

  const hits = (raw.hits?.hits || []).map((h) => ({
    _index: h._index,
    _source: h._source,
  }));

  console.log(`Found ${raw.hits?.total?.value ?? 0} total matches, showing ${hits.length}`);
  return { total: raw.hits?.total, hits };
}

/**
 * Structured log search with term filters and an optional free-form query.
 * Use getIndexFields() to discover available field names before calling this.
 *
 * @requires Logged in with read access to the target index
 * @param {string} index — index pattern title (get from listIndexPatterns)
 * @param {object} [termFilters] — key/value pairs for exact-match filters, e.g.
 *                                 { "level": "ERROR", "kubernetes.container_name": "apiserver" }
 *                                 Uses match (not term) to support text fields without .keyword.
 * @param {string} [query] — Lucene query string, e.g. "timeout OR connection refused"
 * @param {string} [from] — time range start (default: "now-1h")
 * @param {string} [to] — time range end (default: "now")
 * @param {string} [timeField] — timestamp field name (default: "@timestamp")
 * @param {number} [size] — number of hits (default: 20)
 * @param {string[]} [sourceFields] — fields to include in results (default: all)
 * @returns {{ total, hits: [{ _index, _source }] }}
 */
export async function searchLogs(
  browser,
  {
    index,
    termFilters = {},
    query,
    from = 'now-1h',
    to = 'now',
    timeField = '@timestamp',
    size = 20,
    sourceFields,
  } = {},
) {
  if (!index)
    return {
      error: 'index is required',
      hint: 'Run listIndexPatterns to find available index patterns',
    };

  const filters = [{ range: { [timeField]: { gte: from, lte: to } } }];
  for (const [field, value] of Object.entries(termFilters)) {
    filters.push({ match: { [field]: value } });
  }
  const must = query ? [{ query_string: { query, default_field: 'message' } }] : [];

  const filterDesc = Object.entries(termFilters)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  console.log(
    `Searching logs in ${index} [${from} → ${to}]${filterDesc ? ' ' + filterDesc : ''}...`,
  );

  const raw = await osdSearch(browser, index, {
    size,
    query: { bool: { must, filter: filters } },
    sort: [{ [timeField]: { order: 'desc' } }],
    ...(sourceFields ? { _source: sourceFields } : {}),
  });
  if (raw.error) return raw;

  const hits = (raw.hits?.hits || []).map((h) => ({ _index: h._index, _source: h._source }));
  console.log(`Found ${raw.hits?.total?.value ?? 0} total, showing ${hits.length}`);
  return { total: raw.hits?.total, hits };
}

// ─── Aggregations ─────────────────────────────────────────────────────────────

/**
 * Count log events grouped by a keyword field (terms aggregation).
 * Use getIndexFields() first to find aggregatable field names (aggregatable: true).
 *
 * NOTE: If buckets come back empty despite a non-zero total, the field may not have
 * a keyword mapping in all index shards. Try a wider time range, or use a field
 * explicitly marked aggregatable: true in getIndexFields().
 *
 * @requires Logged in with read access to the target index
 * @param {string} index — index pattern title
 * @param {string} field — aggregatable field name (e.g. "status.keyword", "region")
 * @param {object} [termFilters] — additional term filters (same format as searchLogs)
 * @param {string} [from] — default: "now-1h"
 * @param {string} [to] — default: "now"
 * @param {string} [timeField] — timestamp field name (default: "@timestamp")
 * @param {number} [topN] — top N values (default: 20)
 * @returns {{ total, field, buckets: [{ key, count }] }}
 */
export async function countByField(
  browser,
  {
    index,
    field,
    termFilters = {},
    from = 'now-1h',
    to = 'now',
    timeField = '@timestamp',
    topN = 20,
  } = {},
) {
  if (!index)
    return {
      error: 'index is required',
      hint: 'Run listIndexPatterns to find available index patterns',
    };
  if (!field)
    return {
      error: 'field is required',
      hint: 'Run getIndexFields to find aggregatable fields (aggregatable: true)',
    };

  const filters = [{ range: { [timeField]: { gte: from, lte: to } } }];
  for (const [k, v] of Object.entries(termFilters)) {
    filters.push({ match: { [k]: v } });
  }

  console.log(`Counting by ${field} in ${index} [${from} → ${to}]...`);
  const raw = await osdSearch(browser, index, {
    size: 0,
    query: { bool: { filter: filters } },
    aggs: { by_field: { terms: { field, size: topN } } },
  });
  if (raw.error) return raw;

  const buckets = (raw.aggregations?.by_field?.buckets || []).map((b) => ({
    key: b.key,
    count: b.doc_count,
  }));
  console.log(`Found ${buckets.length} buckets, total docs: ${raw.hits?.total?.value}`);
  return { total: raw.hits?.total, field, buckets };
}

/**
 * Build a time-series histogram (event count over time).
 * Useful for spotting spikes in errors, latency, or any other event type.
 *
 * @requires Logged in with read access to the target index
 * @param {string} index — index pattern title
 * @param {string} [timeField] — timestamp field name (default: "@timestamp")
 * @param {object} [termFilters] — additional term filters (same format as searchLogs)
 * @param {string} [phrase] — optional phrase filter on the message field
 * @param {string} [interval] — calendar interval: "1m", "5m", "1h", "1d" (default: "1h")
 * @param {string} [from] — default: "now-24h"
 * @param {string} [to] — default: "now"
 * @returns {{ total, interval, buckets: [{ time, count }] }}
 */
export async function timeHistogram(
  browser,
  {
    index,
    timeField = '@timestamp',
    termFilters = {},
    phrase,
    interval = '1h',
    from = 'now-24h',
    to = 'now',
  } = {},
) {
  if (!index)
    return {
      error: 'index is required',
      hint: 'Run listIndexPatterns to find available index patterns',
    };

  const filters = [{ range: { [timeField]: { gte: from, lte: to } } }];
  for (const [k, v] of Object.entries(termFilters)) {
    filters.push({ match: { [k]: v } });
  }
  const must = phrase ? [{ match_phrase: { message: phrase } }] : [];

  console.log(`Time histogram [${from} → ${to}] interval=${interval} index=${index}...`);
  const raw = await osdSearch(browser, index, {
    size: 0,
    query: { bool: { must, filter: filters } },
    aggs: {
      over_time: { date_histogram: { field: timeField, calendar_interval: interval } },
    },
  });
  if (raw.error) return raw;

  const buckets = (raw.aggregations?.over_time?.buckets || []).map((b) => ({
    time: formatDate(b.key_as_string),
    count: b.doc_count,
  }));
  console.log(`${buckets.length} time buckets, total=${raw.hits?.total?.value}`);
  return { total: raw.hits?.total, interval, buckets };
}

// ─── Default export ───────────────────────────────────────────────────────────

/**
 * Starting point: returns OSD status + all index patterns.
 * Run this first on a new instance to understand what's available.
 */
export default async function (browser) {
  console.log('Fetching OSD overview...');
  const [status, patterns] = await Promise.all([getStatus(browser), listIndexPatterns(browser)]);
  return {
    status: status.error ? status : status,
    index_patterns: patterns.error ? [] : patterns,
    hint: 'Use getIndexFields({ patternId }) to discover fields, then searchPhrase/searchLogs/countByField/timeHistogram to query',
  };
}

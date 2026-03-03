# opensearch-dashboards

> OpenSearch Dashboards — self-hosted log analytics UI (open-source fork of Kibana).
> This guide is **domain-independent**: it applies to any self-hosted OSD instance (e.g., `log.corp.example.com`).
> Detection signal: page title contains "OpenSearch Dashboards", or `/api/status` returns `version.number`.
> Tested against OpenSearch Dashboards v2.19.1.

> **Tip**: Open a dedicated tab first to avoid disrupting user browsing:
>
> ```bash
> browser-cli tab new 'https://your-osd.example.com/app/data-explorer/discover' --group browser-cli
> ```
>
> Then use `--tab <tabId>` for all subsequent commands.

> **Recipe scripts**: Common read-only operations are in `scripts/opensearch.mjs`.
>
> **Always start with these two discovery steps before querying:**
>
> ```bash
> # Step 1: Discover available index patterns and their IDs
> browser-cli --tab <tabId> script scripts/opensearch.mjs --call listIndexPatterns
>
> # Step 2: Discover field names for the index you want to query
> browser-cli --tab <tabId> script scripts/opensearch.mjs --call getIndexFields -- --patternId <id-from-step-1>
> ```
>
> Then query using the index pattern title and field names you discovered:
>
> ```bash
> # Search for a phrase in the last 24 hours
> browser-cli --tab <tabId> script scripts/opensearch.mjs --call searchPhrase -- \
>   --index "my-logs-*" --phrase "connection refused" --from now-24h
>
> # Structured search with term filters (field=value pairs as JSON)
> browser-cli --tab <tabId> script scripts/opensearch.mjs --call searchLogs -- \
>   --index "my-logs-*" --termFilters '{"level":"ERROR","service":"api"}' --from now-1h
>
> # Count by a field (must be aggregatable — check getIndexFields output)
> browser-cli --tab <tabId> script scripts/opensearch.mjs --call countByField -- \
>   --index "my-logs-*" --field "status.keyword" --from now-1h
>
> # Time histogram to spot spikes
> browser-cli --tab <tabId> script scripts/opensearch.mjs --call timeHistogram -- \
>   --index "my-logs-*" --interval 1h --from now-24h
>
> # Histogram scoped to a phrase
> browser-cli --tab <tabId> script scripts/opensearch.mjs --call timeHistogram -- \
>   --index "my-logs-*" --phrase "connection refused" --interval 1d --from now-30d
> ```
>
> When the agent runs, replace `scripts/opensearch.mjs` with the absolute path (derived from the SKILL.md directory).

> **Recipe debugging**: If a function fails, test the raw search call directly:
>
> ```bash
> browser-cli --tab <tabId> script - <<'EOF'
> export default async function(browser) {
>   return browser.evaluate({
>     expression: `JSON.stringify((() => {
>       const xhr = new XMLHttpRequest();
>       xhr.open('POST', location.origin + '/internal/search/opensearch', false);
>       xhr.setRequestHeader('osd-xsrf', 'true');
>       xhr.setRequestHeader('Content-Type', 'application/json');
>       xhr.withCredentials = true;
>       xhr.send(JSON.stringify({ params: { index: 'YOUR-INDEX-*', body: { size: 1, query: { match_all: {} } } } }));
>       return { status: xhr.status, preview: xhr.responseText.slice(0, 500) };
>     })())`
>   });
> }
> EOF
> ```

---

## Detection & Navigation

### Verify This Is an OSD Instance

```bash
browser-cli --tab <tabId> navigate 'https://your-osd.example.com/api/status'
browser-cli --tab <tabId> eval 'JSON.parse(document.body.innerText).version.number'
# Expected output: "2.x.x"
```

### Page Types

| Page       | URL Pattern                                              |
| ---------- | -------------------------------------------------------- |
| Discover   | `/app/data-explorer/discover` (v2.9+) or `/app/discover` |
| Dashboards | `/app/dashboards`                                        |
| Dev Tools  | `/app/dev_tools` (for raw DSL queries in the browser)    |

---

## REST API Reference

> **Prefer the internal search API over DOM scraping.** OSD's internal API uses session cookies, returns structured JSON, and works across all OSD versions.

### Key Endpoints

| Endpoint                                      | Method | Description                                    |
| --------------------------------------------- | ------ | ---------------------------------------------- |
| `/api/status`                                 | GET    | OSD version, cluster health, process metrics   |
| `/api/saved_objects/_find?type=index-pattern` | GET    | List all index patterns                        |
| `/api/saved_objects/index-pattern/{id}`       | GET    | Fields for a specific index pattern            |
| `/internal/search/opensearch`                 | POST   | **Primary search endpoint** — full DSL support |

### Authentication

All recipe functions run in the browser context and use session cookies via `XMLHttpRequest` with `withCredentials = true`. No API tokens needed. If calls return 401, navigate to the OSD login page first.

**Required header on every call**: `osd-xsrf: true`

### `/internal/search/opensearch` — Request & Response Format

**Request:**

```json
{
  "params": {
    "index": "my-logs-*",
    "body": {
      "size": 10,
      "query": { "bool": { "must": [...], "filter": [...] } },
      "aggs": { ... },
      "sort": [ { "@timestamp": { "order": "desc" } } ],
      "_source": ["field1", "field2"]
    }
  }
}
```

**Response** — always unwrap `rawResponse`:

```json
{
  "rawResponse": {
    "hits": { "total": { "value": 1234 }, "hits": [...] },
    "aggregations": { ... }
  }
}
```

---

## Field Mapping Gotchas

### `.keyword` sub-fields and aggregations

OpenSearch stores text fields (type `text`) as full-text searchable but **not** aggregatable.
For `terms` aggregations you need a `keyword` variant of the field.

Common patterns:

- `message` (text, searchable) → `message.keyword` (keyword, aggregatable)
- Some deployments map fields as `keyword` directly (no `.keyword` suffix needed)

Use `getIndexFields()` to check which fields have `aggregatable: true` before using `countByField()`.

### Rolling index mapping drift

If an index pattern spans many time-based indices (e.g. `logs-2024-*`), newer index
shards may have a different mapping than older ones. Symptoms:

- `countByField()` returns non-zero `total` but empty `buckets`
- Fix: widen the time range to include older shards, or query a specific index

### `terminated_early: true` in response

Normal for large indices with `size: 0` aggregation-only queries. Results are still accurate.

---

## DSL Quick Reference

### Phrase search + time range

```json
{
  "query": {
    "bool": {
      "must": [{ "match_phrase": { "message": "connection reset" } }],
      "filter": [{ "range": { "@timestamp": { "gte": "now-1h", "lte": "now" } } }]
    }
  }
}
```

### Term filters (use `match` for text fields that may lack `.keyword`)

```json
{
  "bool": {
    "filter": [
      { "range": { "@timestamp": { "gte": "now-6h", "lte": "now" } } },
      { "match": { "level": "ERROR" } },
      { "match": { "service": "auth" } }
    ]
  }
}
```

### Count by field (terms aggregation)

```json
{
  "size": 0,
  "aggs": { "by_status": { "terms": { "field": "http.response.status_code", "size": 10 } } }
}
```

### Time histogram

```json
{
  "size": 0,
  "aggs": {
    "over_time": {
      "date_histogram": { "field": "@timestamp", "calendar_interval": "1h" }
    }
  }
}
```

---

## Notes

- **`browser.evaluate()` does not await Promises** — always use synchronous `XMLHttpRequest`, never `fetch()`.
- **`/api/console/proxy` returns 404 for wildcard index patterns** — always use `/internal/search/opensearch` for DSL queries.
- **Large queries can time out** — avoid fetching full `_source` on high-volume indices without `_source` field filtering, or use aggregations (`size: 0`).
- **Session authentication** — all calls inherit browser session cookies. If you get 401, navigate to the OSD login page first.
- **`termFilters` uses `match` not `term`** — this handles both text fields and keyword fields, at the cost of not doing exact keyword matching. For exact matching on keyword fields, pass the `.keyword` variant as the field name.

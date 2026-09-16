# Usage Examples

## test_request — HTTP API Calls

### GET request to a microservice
```json
{ "stand": "staging", "service": "orders", "method": "GET", "endpoint": "/api/v1/health" }
```

### POST request with body
```json
{
  "stand": "dev", "service": "billing", "method": "POST",
  "endpoint": "/api/v1/payments",
  "body": { "amount": 100, "currency": "USD" }
}
```

### Direct OpenSearch query via test_request
```json
{ "stand": "staging", "service": "elastic", "method": "GET", "endpoint": "/_cluster/health" }
```

---

## db_query — PostgreSQL

### Simple SELECT
```json
{ "stand": "staging", "query": "SELECT * FROM orders.users LIMIT 10" }
```

### Count rows
```json
{ "stand": "staging", "query": "SELECT COUNT(*) FROM billing.payments WHERE status = 'completed'" }
```

> **Note**: All queries run inside `BEGIN TRANSACTION READ ONLY` — no data modifications are possible.

---

## os_search — OpenSearch Query DSL

### Search for errors in logs
```json
{
  "stand": "staging", "index": "app-logs-*",
  "query_body": {
    "query": {
      "bool": {
        "must": [
          { "match": { "level": "ERROR" } },
          { "match": { "kubernetes.namespace": "staging" } }
        ]
      }
    },
    "size": 10,
    "sort": [{ "@timestamp": "desc" }]
  }
}
```

### Search with specific fields
```json
{
  "stand": "staging", "index": "app-logs-*",
  "query_body": { "query": { "match_all": {} }, "size": 5 },
  "fields": ["@timestamp", "message", "level"]
}
```

### Omitting `index` (uses the stand's configured `elastic.indexPattern`)
```json
{ "stand": "staging", "query_body": { "query": { "match_all": {} }, "size": 5 } }
```

---

## os_indices — List OpenSearch Indices

### List all indices
```json
{ "stand": "staging" }
```

### Filter by pattern
```json
{ "stand": "staging", "index_pattern": "app-logs-2025*" }
```

---

## os_mappings — Index Mappings

```json
{ "stand": "staging", "index": "app-logs-2025.07" }
```

---

## list_services — Service Discovery

### All stands overview
```json
{}
```

### Specific stand details
```json
{ "stand": "staging" }
```

---

## health — Infrastructure Health Check

### Check everything
```json
{ "stand": "staging" }
```

### Check only database
```json
{ "stand": "staging", "target": "database" }
```

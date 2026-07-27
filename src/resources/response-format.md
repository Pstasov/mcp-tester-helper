# Response Format

## test_request Response

```json
{
  "request": {
    "url": "https://service.example.com/api/endpoint",
    "method": "GET",
    "auth": "Bearer [REDACTED]",
    "body": null
  },
  "response": {
    "statusCode": 200,
    "statusText": "OK",
    "timing": "142ms",
    "headers": { "content-type": "application/json", "authorization": "[REDACTED]" },
    "body": "{ ... }",
    "note": "Truncated: 52000 bytes → 10000 bytes"
  }
}
```

## db_query Response

```json
{
  "request": { "stand": "staging", "query": "SELECT ..." },
  "response": {
    "rowCount": 5,
    "timing": "23ms",
    "rows": "[{...}, {...}]",
    "note": "Truncated: 25000 bytes → 10000 bytes"
  }
}
```

## os_search Response

```json
{
  "total": 1523,
  "returned": 10,
  "timing": "85ms",
  "hits": [ { "_source fields" } ],
  "aggregations": { "if present" }
}
```

## Truncation

All responses are limited to **10KB** by default (configurable via `REST_RESPONSE_SIZE_LIMIT`).
When truncated, a `note` field indicates original vs returned size.

## Security

- Authorization headers are always replaced with `[REDACTED]` in responses
- Database credentials and tokens never appear in tool output
- All auth is handled server-side, invisible to the AI assistant

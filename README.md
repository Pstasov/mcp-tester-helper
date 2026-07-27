# mcp-tester-helper

> A unified MCP (Model Context Protocol) server for multi-stand infrastructure testing:
> REST APIs, PostgreSQL databases, and OpenSearch — all through a single config file.

Built for DevOps, QA, and developers who need AI-assisted testing across multiple environments (stands).

## Features

- 🔀 **Multi-stand** — switch between dev / test / prod environments via config
- 🔒 **Secure auth** — OAuth tokens and DB credentials stay server-side, never exposed in AI chat
- 🌐 **REST API** — test any microservice endpoint with auto-authentication
- 🐘 **PostgreSQL** — run SQL queries with connection pooling and read-only safety
- 🔍 **OpenSearch** — search logs, list indices, inspect mappings via Query DSL
- 📋 **Service Discovery** — AI can list available stands and services
- ❤️ **Health Checks** — verify stand infrastructure availability

## Quick Start

```bash
npx -y mcp-tester-helper --config ./config.json
```

## Configuration

### MCP Client Setup

Add to your MCP client configuration (Claude Desktop, Antigravity, Cursor, etc.):

```json
{
  "mcpServers": {
    "infra": {
      "command": "npx",
      "args": ["-y", "mcp-tester-helper", "--config", "/path/to/config.json"],
      "env": {
        "STAGING_USERNAME": "admin",
        "STAGING_PASSWORD": "secret",
        "REST_ENABLE_SSL_VERIFY": "false"
      }
    }
  }
}
```

### Config File (`config.json`)

```json
{
  "stands": {
    "dev": {
      "auth": {
        "url": "https://auth.dev.example.com/oauth/token",
        "type": "json",
        "user": "DEV_USERNAME",
        "pass": "DEV_PASSWORD"
      },
      "elastic": {
        "url": "https://opensearch.dev.example.com:9200",
        "user": "DEV_ELASTIC_USER",
        "pass": "DEV_ELASTIC_PASS"
      },
      "database": {
        "host": "db.dev.example.com",
        "port": 5432,
        "db": "dev_db",
        "user": "DEV_DB_USER",
        "pass": "DEV_DB_PASS"
      },
      "services": {
        "billing": {
          "url": "https://billing.dev.example.com/api",
          "openapi": "api-docs/billing.json"
        }
      }
    }
  }
}
```

**Note:** `user` and `pass` fields contain **environment variable names**, not actual credentials. Actual values come from `.env` file or MCP client `env` config.

### Auth Types

| Type | Description | Content-Type |
|---|---|---|
| `json` (default) | `{"username":"...","password":"..."}` | `application/json` |
| `oauth2` | `grant_type=password&username=...&password=...` | `x-www-form-urlencoded` |

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `REST_RESPONSE_SIZE_LIMIT` | Max response body size in bytes | `10000` |
| `REST_ENABLE_SSL_VERIFY` | Set to `false` to skip SSL cert verification | `true` |

## Tools Reference

### `test_request` — HTTP API Calls

Test a REST API endpoint with auto-authentication.

```json
{
  "stand": "staging",
  "service": "orders",
  "method": "GET",
  "endpoint": "/api/v1/health"
}
```

| Parameter | Required | Description |
|---|---|---|
| `stand` | ✅ | Target stand name |
| `service` | ✅ | Service name from config, or `"elastic"` for OpenSearch |
| `method` | ✅ | `GET`, `POST`, `PUT`, `DELETE`, `PATCH` |
| `endpoint` | ✅ | Path (e.g. `/api/v1/users`) |
| `body` | | Request body (for POST/PUT/PATCH) |
| `headers` | | Extra headers (don't pass Authorization) |

### `db_query` — PostgreSQL Queries

Execute read-only SQL queries with connection pooling.

```json
{ "stand": "staging", "query": "SELECT * FROM schema.table LIMIT 10" }
```

> All queries run inside `BEGIN TRANSACTION READ ONLY` — data modifications are blocked.

### `os_search` — OpenSearch Query DSL

Search OpenSearch indices using the full Query DSL.

```json
{
  "stand": "staging",
  "index": "app-logs-*",
  "query_body": {
    "query": { "match": { "level": "ERROR" } },
    "size": 10,
    "sort": [{ "@timestamp": "desc" }]
  },
  "fields": ["@timestamp", "message", "level"]
}
```

### `os_indices` — List OpenSearch Indices

```json
{ "stand": "staging", "index_pattern": "app-logs-*" }
```

### `os_mappings` — Index Mappings

```json
{ "stand": "staging", "index": "app-logs-2025.07" }
```

### `list_services` — Service Discovery

```json
{ "stand": "staging" }
```

Returns all services, database, and OpenSearch info for the stand.

### `health` — Infrastructure Health Check

```json
{ "stand": "staging", "target": "all" }
```

Pings services, OpenSearch, and PostgreSQL. Returns status and timing for each.

## Security

- 🔐 Auth tokens are obtained automatically and cached server-side (with TTL)
- 🚫 Credentials never appear in tool responses sent to the AI
- 🔄 Automatic token refresh on 401 responses
- 📖 All SQL queries are wrapped in read-only transactions
- ✂️ Response bodies are truncated to prevent token overflow

## Credits & Attribution

This project is built upon and inspired by the following open-source projects:

- **[dkmaker/mcp-rest-api](https://github.com/dkmaker/mcp-rest-api)** (MIT License) — REST API testing MCP server, used as the foundation for HTTP client and MCP server structure.

- **[modelcontextprotocol/servers — server-postgres](https://github.com/modelcontextprotocol/servers-archived/tree/main/src/postgres)** (MIT License) — Official PostgreSQL MCP reference implementation. Connection pooling and read-only transaction patterns.

- **[elastic/mcp-server-elasticsearch](https://github.com/elastic/mcp-server-elasticsearch)** (Apache-2.0 License) — Official Elasticsearch MCP server. Tool design for search, indices, and mappings (reimplemented from Rust to TypeScript for OpenSearch compatibility).

## License

MIT

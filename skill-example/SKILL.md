---
name: mcp-tester-helper
description: Rules for AI-assisted infrastructure testing via mcp-tester-helper MCP server. Activate when the user asks to make HTTP requests to services (REST API), search logs (OpenSearch), or run SQL queries against databases (PostgreSQL) across different stands (environments).
---

# Rules for Working with Multi-Stand Infrastructure

This skill describes the algorithm for the AI assistant to execute requests to corporate services, logs, and databases using the `mcp-tester-helper` MCP server and a local configuration file.

## 1. Infrastructure Configuration
All information about stands (environments), their addresses, databases, and OpenAPI specs is stored in the configuration file `config.json` in the project root.

The AI assistant **must** before any request:
1. Read `config.json`.
2. Verify that the target stand (e.g. `dev`) and service exist in the config.

**Structure of `config.json`:**
- Stands (e.g. `dev`, `test`, `staging`, `prod`).
  - `auth` — stand authorization settings (URL, env variable names for login/password).
  - `elastic` — OpenSearch/Elasticsearch cluster access settings (for logs).
  - `database` — PostgreSQL database connection settings for this stand.
  - `services` — list of microservices, where the key is the system name (e.g. `billing`, `users`).
    - `url` — base URL of the service.
    - `openapi` — path to local Swagger/OpenAPI spec file or URL.

## 2. HTTP API Requests (Tool: `test_request`)
When the user asks to call a microservice:
1. The AI reads `config.json` and finds the service `url` and `openapi` spec.
2. If needed, studies the Swagger/OpenAPI file using `view_file`.
3. Calls the `test_request` tool:
```json
{
  "stand": "dev",
  "service": "billing",
  "method": "POST",
  "endpoint": "/payments",
  "body": { ... }
}
```
**Auth is automatic:** the server obtains a token from the stand's `auth` URL and injects it into the request.

## 3. OpenSearch / Log Search (Tools: `os_search`, `os_indices`, `os_mappings`)
OpenSearch is part of each stand's infrastructure (the `elastic` section in config).

### Preferred tools for log search:
- `os_indices` — list available indices (start here to discover index names).
- `os_search` — search with full Query DSL (for complex queries with filters, aggregations).
- `os_mappings` — inspect index field mappings before writing queries.

### Fallback (raw HTTP):
- You can also use `test_request` with `"service": "elastic"` for any raw OpenSearch REST API call.

### **CRITICAL RULE — Namespace Filtering:**
When building Query DSL queries for log search, the `namespace` field in your filters **must always match** the current stand name. Example:
```json
{ "match": { "kubernetes.namespace": "staging" } }
```
This prevents mixing logs from different environments.

## 4. Database Queries (Tool: `db_query`)
Each stand has a shared PostgreSQL database (the `database` section in config).
- When the user asks for a SQL query, the AI uses the `db_query` tool with `stand` and `query` parameters.

### **CRITICAL RULE — Database Schemas:**
Each microservice in the shared database has its own dedicated **schema**, whose name exactly matches the service's system name.

All SQL queries to service tables **must** be schema-prefixed:
- ✅ `SELECT * FROM orders.users` (schema `orders`)
- ✅ `SELECT * FROM billing.payments` (schema `billing`)
- ❌ `SELECT * FROM users` (missing schema — will fail or query wrong table)

## 5. Service Discovery (Tool: `list_services`)
Before making requests, especially to unfamiliar stands, use `list_services` to discover:
- Available stands and their services.
- Whether a stand has OpenSearch and/or database configured.

## 6. Health Checks (Tool: `health`)
Use `health` to verify infrastructure availability before running queries:
```json
{ "stand": "staging", "target": "all" }
```

## 7. Adding New Stands and Services
If the user refers to a stand or service not yet in `config.json`, the AI assistant **must**:
1. Ask for the addresses and credentials (add them to `.env`).
2. Add a new section to `config.json`.
3. Save the Swagger/OpenAPI spec file (if available).
4. Execute the request using the updated config.

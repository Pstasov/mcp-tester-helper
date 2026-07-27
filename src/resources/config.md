# Configuration Guide

## config.json

The config file defines your stands (environments) and their infrastructure:

```json
{
  "stands": {
    "<stand_name>": {
      "auth": {
        "url": "https://auth.example.com/oauth/token",
        "type": "json",
        "user": "ENV_VAR_NAME_FOR_USERNAME",
        "pass": "ENV_VAR_NAME_FOR_PASSWORD"
      },
      "elastic": {
        "url": "https://opensearch.example.com:9200",
        "user": "ENV_VAR_NAME",
        "pass": "ENV_VAR_NAME"
      },
      "database": {
        "host": "db.example.com",
        "port": 5432,
        "db": "my_database",
        "user": "ENV_VAR_NAME",
        "pass": "ENV_VAR_NAME",
        "ssl": false
      },
      "services": {
        "<service_name>": {
          "url": "https://service.example.com/api",
          "openapi": "path/to/spec.json"
        }
      }
    }
  }
}
```

### Auth Types

- `"json"` (default): Sends `{ "username": "...", "password": "..." }` as JSON body
- `"oauth2"`: Sends `grant_type=password&username=...&password=...` as form-urlencoded

### Credential Resolution

The `user` and `pass` fields contain **environment variable names**, not actual values.
Actual credentials are stored in `.env` file next to `config.json`.

## .env File

```env
DEV_USERNAME=admin
DEV_PASSWORD=secret123
DEV_DB_USER=postgres
DEV_DB_PASS=dbpass
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `REST_RESPONSE_SIZE_LIMIT` | Max response body size in bytes | `10000` |
| `REST_ENABLE_SSL_VERIFY` | Set to `false` to skip SSL verification | `true` |

## CLI Usage

```bash
npx mcp-tester-helper --config ./path/to/config.json
```

If `--config` is omitted, looks for `config.json` in the current directory.

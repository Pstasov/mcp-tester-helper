import pg from 'pg';
import { getStandConfig, resolveCredential } from '../config.js';
import { truncateResponse } from '../http-client.js';

// ── Connection Pool per Stand ──────────────────────────────────────────────────

const pools = new Map<string, pg.Pool>();

const REST_ENABLE_SSL_VERIFY = process.env.REST_ENABLE_SSL_VERIFY !== 'false';

function getPool(stand: string): pg.Pool {
  if (pools.has(stand)) {
    return pools.get(stand)!;
  }

  const standConfig = getStandConfig(stand);
  const dbConfig = standConfig.database;

  if (!dbConfig) {
    throw new Error(`Database config not found for stand '${stand}'.`);
  }

  const user = resolveCredential(dbConfig.user);
  const password = resolveCredential(dbConfig.pass);

  if (!user || !password) {
    throw new Error(`Missing DB credentials for stand '${stand}'. Check .env for ${dbConfig.user} / ${dbConfig.pass}.`);
  }

  const pool = new pg.Pool({
    host: dbConfig.host,
    port: dbConfig.port || 5432,
    database: dbConfig.db,
    user,
    password,
    ssl: dbConfig.ssl === true
      ? (REST_ENABLE_SSL_VERIFY ? true : { rejectUnauthorized: false })
      : false,
    max: 5,
    idleTimeoutMillis: 30000,
  });

  pools.set(stand, pool);
  return pool;
}

/**
 * Tool: db_query
 * Execute a SQL query against a stand's PostgreSQL database.
 * Uses connection pooling and read-only transactions by default.
 */
export async function dbQuery(args: {
  stand: string;
  query: string;
}): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const pool = getPool(args.stand);
  const client = await pool.connect();

  try {
    const startTime = Date.now();

    // Read-only transaction (from modelcontextprotocol/server-postgres)
    await client.query('BEGIN TRANSACTION READ ONLY');
    const result = await client.query(args.query);

    const timing = Date.now() - startTime;

    // Serialize rows, handling BigInt
    const bodyStr = JSON.stringify(result.rows, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );

    const { body: finalBody, truncated, originalSize } = truncateResponse(bodyStr);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          request: { stand: args.stand, query: args.query },
          response: {
            rowCount: result.rowCount,
            timing: `${timing}ms`,
            rows: finalBody,
            ...(truncated ? { note: `Truncated: ${originalSize} bytes → ${finalBody.length} bytes` } : {}),
          },
        }, null, 2),
      }],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `DB Query failed: ${error.message}` }],
      isError: true,
    };
  } finally {
    // Always rollback (read-only tx) and release connection back to pool
    client.query('ROLLBACK').catch((err) =>
      console.warn('Could not roll back transaction:', err)
    );
    client.release();
  }
}

/**
 * Tool schema for db_query.
 */
export const dbQuerySchema = {
  name: 'db_query',
  description: 'Execute a read-only SQL query against a stand\'s PostgreSQL database. Use schema-qualified table names (e.g. "SELECT * FROM orders.users").',
  inputSchema: {
    type: 'object' as const,
    properties: {
      stand: { type: 'string', description: 'Target stand (e.g. staging)' },
      query: { type: 'string', description: 'SQL query. Use schema-prefixed table names (e.g. "SELECT * FROM schema.table").' },
    },
    required: ['stand', 'query'],
  },
};

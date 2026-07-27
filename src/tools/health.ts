import axios from 'axios';
import pg from 'pg';
import { loadConfig, resolveCredential } from '../config.js';
import { buildBasicAuth } from '../auth.js';
import { getHttpsAgent } from '../http-client.js';

interface HealthResult {
  target: string;
  status: 'ok' | 'error';
  timing?: string;
  detail?: string;
}

/**
 * Tool: health
 * Check availability of stand infrastructure components.
 */
export async function health(args: {
  stand: string;
  target?: string; // 'all' | 'services' | 'elastic' | 'database'
}): Promise<{ content: Array<{ type: string; text: string }> }> {
  const config = loadConfig();
  const standConfig = config.stands[args.stand];

  if (!standConfig) {
    const available = Object.keys(config.stands).join(', ');
    return {
      content: [{ type: 'text', text: `Stand '${args.stand}' not found. Available: ${available}` }],
    };
  }

  const target = args.target || 'all';
  const results: HealthResult[] = [];

  // Check services
  if (target === 'all' || target === 'services') {
    for (const [name, svc] of Object.entries(standConfig.services || {})) {
      try {
        const start = Date.now();
        await axios.get(svc.url, {
          timeout: 10000,
          validateStatus: () => true,
          httpsAgent: getHttpsAgent(),
        });
        results.push({ target: `service/${name}`, status: 'ok', timing: `${Date.now() - start}ms` });
      } catch (error: any) {
        results.push({ target: `service/${name}`, status: 'error', detail: error.message });
      }
    }
  }

  // Check OpenSearch
  if ((target === 'all' || target === 'elastic') && standConfig.elastic) {
    try {
      const start = Date.now();
      const auth = buildBasicAuth(standConfig.elastic);
      const response = await axios.get(standConfig.elastic.url, {
        headers: { 'Authorization': auth },
        timeout: 10000,
        validateStatus: () => true,
        httpsAgent: getHttpsAgent(),
      });
      const clusterName = response.data?.cluster_name || 'unknown';
      const version = response.data?.version?.number || 'unknown';
      results.push({
        target: 'opensearch',
        status: 'ok',
        timing: `${Date.now() - start}ms`,
        detail: `cluster=${clusterName}, version=${version}`,
      });
    } catch (error: any) {
      results.push({ target: 'opensearch', status: 'error', detail: error.message });
    }
  }

  // Check Database
  if ((target === 'all' || target === 'database') && standConfig.database) {
    const dbConfig = standConfig.database;
    const user = resolveCredential(dbConfig.user);
    const password = resolveCredential(dbConfig.pass);
    const sslVerify = process.env.REST_ENABLE_SSL_VERIFY !== 'false';

    if (user && password) {
      const client = new pg.Client({
        host: dbConfig.host,
        port: dbConfig.port || 5432,
        database: dbConfig.db,
        user,
        password,
        ssl: dbConfig.ssl === true ? (sslVerify ? true : { rejectUnauthorized: false }) : false,
        connectionTimeoutMillis: 10000,
      });

      try {
        const start = Date.now();
        await client.connect();
        const res = await client.query('SELECT version()');
        await client.end();
        const pgVersion = res.rows[0]?.version?.split(' ').slice(0, 2).join(' ') || 'unknown';
        results.push({
          target: 'database',
          status: 'ok',
          timing: `${Date.now() - start}ms`,
          detail: pgVersion,
        });
      } catch (error: any) {
        try { await client.end(); } catch (_) {}
        results.push({ target: 'database', status: 'error', detail: error.message });
      }
    } else {
      results.push({ target: 'database', status: 'error', detail: 'Missing credentials' });
    }
  }

  return {
    content: [{ type: 'text', text: JSON.stringify({ stand: args.stand, results }, null, 2) }],
  };
}

export const healthSchema = {
  name: 'health',
  description: 'Check availability of a stand\'s infrastructure: services, OpenSearch, and PostgreSQL.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      stand: { type: 'string', description: 'Target stand (e.g. staging)' },
      target: {
        type: 'string', enum: ['all', 'services', 'elastic', 'database'],
        description: 'What to check. Default: "all"',
      },
    },
    required: ['stand'],
  },
};

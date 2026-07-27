import axios from 'axios';
import { getStandConfig } from '../config.js';
import { buildBasicAuth } from '../auth.js';
import { getHttpsAgent, truncateResponse } from '../http-client.js';

// ── Helper: make authenticated request to OpenSearch ───────────────────────────

async function osRequest(stand: string, method: string, path: string, body?: any) {
  const standConfig = getStandConfig(stand);
  if (!standConfig.elastic) {
    throw new Error(`OpenSearch/Elastic config not found for stand '${stand}'.`);
  }

  const baseUrl = standConfig.elastic.url.replace(/\/+$/, '');
  const url = `${baseUrl}${path}`;
  const auth = buildBasicAuth(standConfig.elastic);

  const response = await axios.request({
    method: method as any,
    url,
    data: body,
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/json',
    },
    validateStatus: () => true,
    timeout: 30000,
    httpsAgent: getHttpsAgent(),
  });

  return response;
}

// ── Tool: os_search ────────────────────────────────────────────────────────────

/**
 * OpenSearch Query DSL search.
 * Reimplemented from elastic/mcp-server-elasticsearch (Rust → TypeScript).
 */
export async function osSearch(args: {
  stand: string;
  index: string;
  query_body: any;
  fields?: string[];
}): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    let queryBody = { ...args.query_body };

    // Inject _source filter if fields specified (from elastic MCP pattern)
    if (args.fields && args.fields.length > 0) {
      if (Array.isArray(queryBody._source)) {
        queryBody._source = [...queryBody._source, ...args.fields];
      } else {
        queryBody._source = args.fields;
      }
    }

    const startTime = Date.now();
    const response = await osRequest(args.stand, 'POST', `/${args.index}/_search`, queryBody);
    const timing = Date.now() - startTime;

    if (response.status >= 400) {
      return {
        content: [{ type: 'text', text: `OpenSearch error (${response.status}): ${JSON.stringify(response.data)}` }],
        isError: true,
      };
    }

    const data = response.data;
    const total = data.hits?.total?.value ?? data.hits?.total ?? 'unknown';
    const hits = data.hits?.hits ?? [];
    const sources = hits.map((hit: any) => hit._source);

    const result: any = {
      total,
      returned: hits.length,
      timing: `${timing}ms`,
    };

    if (sources.length > 0) {
      result.hits = sources;
    }

    // Include aggregations if present
    if (data.aggregations && Object.keys(data.aggregations).length > 0) {
      result.aggregations = data.aggregations;
    }

    const bodyStr = JSON.stringify(result, null, 2);
    const { body: finalBody, truncated, originalSize } = truncateResponse(bodyStr);

    return {
      content: [{
        type: 'text',
        text: truncated
          ? `${finalBody}\n\n(Truncated: ${originalSize} → ${finalBody.length} bytes)`
          : finalBody,
      }],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `OpenSearch search failed: ${error.message}` }],
      isError: true,
    };
  }
}

// ── Tool: os_indices ───────────────────────────────────────────────────────────

/**
 * List OpenSearch indices.
 */
export async function osIndices(args: {
  stand: string;
  index_pattern?: string;
}): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    const pattern = args.index_pattern || '*';
    const response = await osRequest(
      args.stand, 'GET',
      `/_cat/indices/${encodeURIComponent(pattern)}?format=json&h=index,status,docs.count,store.size`
    );

    if (response.status >= 400) {
      return {
        content: [{ type: 'text', text: `OpenSearch error (${response.status}): ${JSON.stringify(response.data)}` }],
        isError: true,
      };
    }

    const indices = response.data;
    const bodyStr = JSON.stringify({
      count: indices.length,
      indices,
    }, null, 2);

    const { body: finalBody, truncated, originalSize } = truncateResponse(bodyStr);

    return {
      content: [{
        type: 'text',
        text: truncated
          ? `${finalBody}\n\n(Truncated: ${originalSize} → ${finalBody.length} bytes)`
          : finalBody,
      }],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `OpenSearch indices failed: ${error.message}` }],
      isError: true,
    };
  }
}

// ── Tool: os_mappings ──────────────────────────────────────────────────────────

/**
 * Get mappings for an OpenSearch index.
 */
export async function osMappings(args: {
  stand: string;
  index: string;
}): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    const response = await osRequest(args.stand, 'GET', `/${args.index}/_mapping`);

    if (response.status >= 400) {
      return {
        content: [{ type: 'text', text: `OpenSearch error (${response.status}): ${JSON.stringify(response.data)}` }],
        isError: true,
      };
    }

    const bodyStr = JSON.stringify(response.data, null, 2);
    const { body: finalBody, truncated, originalSize } = truncateResponse(bodyStr);

    return {
      content: [{
        type: 'text',
        text: truncated
          ? `${finalBody}\n\n(Truncated: ${originalSize} → ${finalBody.length} bytes)`
          : finalBody,
      }],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `OpenSearch mappings failed: ${error.message}` }],
      isError: true,
    };
  }
}

// ── Schemas ─────────────────────────────────────────────────────────────────────

export const osSearchSchema = {
  name: 'os_search',
  description: 'Search an OpenSearch index using Query DSL. Use for log analysis and data queries.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      stand: { type: 'string', description: 'Target stand (e.g. staging)' },
      index: { type: 'string', description: 'Index name to search (e.g. "app-logs-*")' },
      query_body: { type: 'object', description: 'Complete OpenSearch Query DSL body (query, size, from, sort, aggs, etc.)' },
      fields: { type: 'array', items: { type: 'string' }, description: 'Optional: fields to return in _source' },
    },
    required: ['stand', 'index', 'query_body'],
  },
};

export const osIndicesSchema = {
  name: 'os_indices',
  description: 'List available OpenSearch indices with doc counts and sizes.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      stand: { type: 'string', description: 'Target stand (e.g. staging)' },
      index_pattern: { type: 'string', description: 'Optional index pattern (e.g. "app-logs-*"). Default: "*"' },
    },
    required: ['stand'],
  },
};

export const osMappingsSchema = {
  name: 'os_mappings',
  description: 'Get field mappings for a specific OpenSearch index.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      stand: { type: 'string', description: 'Target stand (e.g. staging)' },
      index: { type: 'string', description: 'Index name to get mappings for' },
    },
    required: ['stand', 'index'],
  },
};

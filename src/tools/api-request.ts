import axios, { type AxiosRequestConfig, type Method } from 'axios';
import { getStandConfig } from '../config.js';
import { getAuthToken, clearTokenCache, buildBasicAuth } from '../auth.js';
import { getHttpsAgent, truncateResponse, sanitizeHeaders } from '../http-client.js';

/**
 * Tool: test_request
 * HTTP request to a microservice on a specific stand with auto-auth.
 */
export async function testRequest(args: {
  stand: string;
  service: string;
  method: string;
  endpoint: string;
  body?: any;
  headers?: Record<string, string>;
}): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const standConfig = getStandConfig(args.stand);

  // Resolve service config
  let baseUrl: string;
  let authType: 'bearer' | 'basic' = 'bearer';

  if (args.service === 'elastic') {
    if (!standConfig.elastic) {
      throw new Error(`OpenSearch/Elastic config not found for stand '${args.stand}'.`);
    }
    baseUrl = standConfig.elastic.url.replace(/\/+$/, '');
    authType = 'basic';
  } else {
    const serviceConfig = standConfig.services?.[args.service];
    if (!serviceConfig) {
      const available = Object.keys(standConfig.services || {}).join(', ');
      throw new Error(`Service '${args.service}' not found for stand '${args.stand}'. Available: ${available}`);
    }
    baseUrl = serviceConfig.url.replace(/\/+$/, '');
  }

  // Build full URL
  const normalizedEndpoint = `/${args.endpoint.replace(/^\/+|\/+$/g, '')}`;
  const fullUrl = `${baseUrl}${normalizedEndpoint}`;

  // Request function with auth injection
  const makeRequest = async (forceRefreshAuth: boolean = false) => {
    let authHeader = '';
    let authRedacted = '';

    if (authType === 'basic' && standConfig.elastic) {
      authHeader = buildBasicAuth(standConfig.elastic);
      authRedacted = 'Basic [REDACTED]';
    } else {
      const token = await getAuthToken(args.stand, standConfig.auth, forceRefreshAuth);
      authHeader = `Bearer ${token}`;
      authRedacted = 'Bearer [REDACTED]';
    }

    const reqConfig: AxiosRequestConfig = {
      method: args.method as Method,
      url: fullUrl,
      headers: {
        ...(args.headers || {}),
        'Authorization': authHeader,
      },
      data: args.body,
      validateStatus: () => true,
      timeout: 30000,
      httpsAgent: getHttpsAgent(),
    };

    const startTime = Date.now();
    const response = await axios.request(reqConfig);
    const timing = Date.now() - startTime;

    return { response, timing, authRedacted };
  };

  try {
    let result = await makeRequest(false);

    // Auto-retry on 401 for bearer auth
    if (result.response.status === 401 && authType !== 'basic') {
      clearTokenCache(args.stand);
      result = await makeRequest(true);
    }

    const { response, timing, authRedacted } = result;

    // Truncate response body
    const bodyStr = typeof response.data === 'string'
      ? response.data
      : JSON.stringify(response.data);
    const { body: finalBody, truncated, originalSize } = truncateResponse(bodyStr);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          request: {
            url: fullUrl,
            method: args.method,
            auth: authRedacted,
            body: args.body,
          },
          response: {
            statusCode: response.status,
            statusText: response.statusText,
            timing: `${timing}ms`,
            headers: sanitizeHeaders(response.headers as Record<string, any>),
            body: finalBody,
            ...(truncated ? { note: `Truncated: ${originalSize} bytes → ${finalBody.length} bytes` } : {}),
          },
        }, null, 2),
      }],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Request failed: ${error.message}` }],
      isError: true,
    };
  }
}

/**
 * Tool schema for test_request.
 */
export const testRequestSchema = {
  name: 'test_request',
  description: 'Test a REST API or OpenSearch endpoint on a specific stand. Auth is handled automatically.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      stand: { type: 'string', description: 'Target stand name (e.g. dev, test, staging)' },
      service: { type: 'string', description: 'Service name from config (e.g. billing, orders) or "elastic" for OpenSearch' },
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], description: 'HTTP method' },
      endpoint: { type: 'string', description: 'Endpoint path (e.g. "/api/v1/users")' },
      body: { type: 'object', description: 'Optional request body' },
      headers: {
        type: 'object', description: 'Optional headers. Do NOT pass Authorization here.',
        additionalProperties: { type: 'string' },
      },
    },
    required: ['stand', 'service', 'method', 'endpoint'],
  },
};

import https from 'https';
import type { Agent } from 'https';

// ── SSL Configuration ──────────────────────────────────────────────────────────

const SSL_VERIFY = process.env.REST_ENABLE_SSL_VERIFY !== 'false';

const httpsAgent: Agent | undefined = SSL_VERIFY
  ? undefined
  : new https.Agent({ rejectUnauthorized: false });

/**
 * Get the global HTTPS agent (with or without SSL verification).
 */
export function getHttpsAgent(): Agent | undefined {
  return httpsAgent;
}

// ── Response Size Limit ────────────────────────────────────────────────────────

const DEFAULT_SIZE_LIMIT = 10000; // 10KB

export const RESPONSE_SIZE_LIMIT: number = process.env.REST_RESPONSE_SIZE_LIMIT
  ? parseInt(process.env.REST_RESPONSE_SIZE_LIMIT, 10)
  : DEFAULT_SIZE_LIMIT;

// ── Response Truncation ────────────────────────────────────────────────────────

export interface TruncationResult {
  body: string;
  truncated: boolean;
  originalSize: number;
}

/**
 * Truncate a response body string to the configured size limit.
 */
export function truncateResponse(body: string): TruncationResult {
  const size = Buffer.from(body).length;

  if (size <= RESPONSE_SIZE_LIMIT) {
    return { body, truncated: false, originalSize: size };
  }

  return {
    body: body.slice(0, RESPONSE_SIZE_LIMIT),
    truncated: true,
    originalSize: size,
  };
}

// ── Header Sanitization ────────────────────────────────────────────────────────

/**
 * Sanitize response/request headers by redacting sensitive values.
 */
export function sanitizeHeaders(
  headers: Record<string, any>
): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === 'authorization' || lowerKey === 'x-api-key') {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

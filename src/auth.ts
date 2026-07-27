import axios from 'axios';
import { resolveCredential, type AuthConfig, type ElasticConfig } from './config.js';
import { getHttpsAgent } from './http-client.js';

// ── Token Cache with TTL ───────────────────────────────────────────────────────

interface CachedToken {
  token: string;
  expiresAt: number; // Unix timestamp in ms
}

const tokenCache = new Map<string, CachedToken>();

const DEFAULT_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get a Bearer auth token for a stand. Uses cache with TTL.
 * If forceRefresh is true, bypasses cache and fetches a new token.
 */
export async function getAuthToken(
  stand: string,
  auth: AuthConfig,
  forceRefresh: boolean = false
): Promise<string> {
  // Check cache
  if (!forceRefresh) {
    const cached = tokenCache.get(stand);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.token;
    }
  }

  const user = resolveCredential(auth.user);
  const pass = resolveCredential(auth.pass);

  if (!user || !pass) {
    throw new Error(`Missing credentials for stand '${stand}'. Check your .env file for ${auth.user} / ${auth.pass}.`);
  }

  try {
    let response;

    if (auth.type === 'oauth2') {
      // OAuth2 password grant: application/x-www-form-urlencoded
      const params = new URLSearchParams();
      params.append('grant_type', 'password');
      params.append('username', user);
      params.append('password', pass);

      response = await axios.post(auth.url, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
        httpsAgent: getHttpsAgent(),
      });
    } else {
      // JSON body auth (default)
      response = await axios.post(auth.url, { username: user, password: pass }, {
        headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
        timeout: 15000,
        httpsAgent: getHttpsAgent(),
      });
    }

    const token = response.data.access_token || response.data.token;
    if (!token) {
      throw new Error('Token not found in auth response. Expected "access_token" or "token" field.');
    }

    // Calculate TTL from response or use default
    const expiresIn = response.data.expires_in
      ? response.data.expires_in * 1000
      : DEFAULT_TOKEN_TTL_MS;

    tokenCache.set(stand, {
      token,
      expiresAt: Date.now() + expiresIn,
    });

    return token;
  } catch (error: any) {
    throw new Error(`Auth failed for stand '${stand}' at ${auth.url}: ${error.message}`);
  }
}

/**
 * Clear cached token for a stand (e.g. after 401 response).
 */
export function clearTokenCache(stand: string): void {
  tokenCache.delete(stand);
}

/**
 * Build a Basic Auth header value for OpenSearch/Elasticsearch.
 */
export function buildBasicAuth(elastic: ElasticConfig): string {
  const user = resolveCredential(elastic.user);
  const pass = resolveCredential(elastic.pass);

  if (!user || !pass) {
    throw new Error(`Missing OpenSearch credentials. Check your .env file for ${elastic.user} / ${elastic.pass}.`);
  }

  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
}

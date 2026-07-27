import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AuthConfig {
  url: string;
  type?: 'json' | 'oauth2';
  user: string;  // env variable name
  pass: string;  // env variable name
}

export interface ElasticConfig {
  url: string;
  user: string;  // env variable name
  pass: string;  // env variable name
}

export interface DatabaseConfig {
  host: string;
  port: number;
  db: string;
  user: string;  // env variable name
  pass: string;  // env variable name
  ssl?: boolean;
}

export interface ServiceConfig {
  url: string;
  openapi?: string;
}

export interface StandConfig {
  auth: AuthConfig;
  elastic?: ElasticConfig;
  database?: DatabaseConfig;
  services: Record<string, ServiceConfig>;
}

export interface AppConfig {
  stands: Record<string, StandConfig>;
}

// ── Config Loading ─────────────────────────────────────────────────────────────

let cachedConfig: AppConfig | null = null;
let configPath: string = '';

/**
 * Initialize config path from CLI arguments.
 * Looks for --config <path> in process.argv.
 */
export function initConfigPath(): string {
  const args = process.argv.slice(2);
  const configIdx = args.indexOf('--config');

  if (configIdx !== -1 && args[configIdx + 1]) {
    configPath = path.resolve(args[configIdx + 1]);
  } else {
    // Default: look for config.json next to the entry point
    configPath = path.resolve('config.json');
  }

  return configPath;
}

/**
 * Load .env file from the same directory as config.json.
 */
export function loadEnv(): void {
  const envPath = path.join(path.dirname(configPath), '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const key in envConfig) {
      process.env[key] = envConfig[key];
    }
  }
}

/**
 * Resolve a credential value: if it matches an env variable name, return the env value.
 * Otherwise return the raw value (for cases where the value is literal).
 */
export function resolveCredential(envKeyOrValue: string): string | undefined {
  return process.env[envKeyOrValue] || envKeyOrValue;
}

/**
 * Load and parse the config file. Re-reads from disk on each call
 * to pick up hot changes. Also reloads .env.
 */
export function loadConfig(): AppConfig {
  loadEnv();

  if (!fs.existsSync(configPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  const raw = fs.readFileSync(configPath, 'utf-8');
  const config: AppConfig = JSON.parse(raw);

  if (!config.stands || typeof config.stands !== 'object') {
    throw new Error('Invalid config: missing "stands" object');
  }

  cachedConfig = config;
  return config;
}

/**
 * Get a specific stand config, throwing a descriptive error if not found.
 */
export function getStandConfig(stand: string): StandConfig {
  const config = loadConfig();
  const standConfig = config.stands[stand];
  if (!standConfig) {
    const available = Object.keys(config.stands).join(', ');
    throw new Error(`Stand '${stand}' not found in config. Available stands: ${available}`);
  }
  return standConfig;
}

/**
 * Get the current config path.
 */
export function getConfigPath(): string {
  return configPath;
}

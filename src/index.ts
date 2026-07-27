#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { initConfigPath } from './config.js';
import { testRequest, testRequestSchema } from './tools/api-request.js';
import { dbQuery, dbQuerySchema } from './tools/db-query.js';
import { osSearch, osSearchSchema, osIndices, osIndicesSchema, osMappings, osMappingsSchema } from './tools/os-search.js';
import { listServices, listServicesSchema } from './tools/list-services.js';
import { health, healthSchema } from './tools/health.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_NAME = 'mcp-tester-helper';
const VERSION = '1.0.0';

// ── Initialize config ──────────────────────────────────────────────────────────

const configPath = initConfigPath();

// ── MCP Server Setup ───────────────────────────────────────────────────────────

const server = new Server(
  { name: SERVER_NAME, version: VERSION },
  { capabilities: { tools: {}, resources: {} } },
);

// ── Tool Handlers ──────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    testRequestSchema,
    dbQuerySchema,
    osSearchSchema,
    osIndicesSchema,
    osMappingsSchema,
    listServicesSchema,
    healthSchema,
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'test_request':
      return testRequest(args as any);

    case 'db_query':
      return dbQuery(args as any);

    case 'os_search':
      return osSearch(args as any);

    case 'os_indices':
      return osIndices(args as any);

    case 'os_mappings':
      return osMappings(args as any);

    case 'list_services':
      return listServices(args as any);

    case 'health':
      return health(args as any);

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
});

// ── Resource Handlers ──────────────────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: `${SERVER_NAME}://examples`,
      name: 'Usage Examples',
      description: 'Examples of using all tools with different stands',
      mimeType: 'text/markdown',
    },
    {
      uri: `${SERVER_NAME}://config`,
      name: 'Configuration Guide',
      description: 'How to set up config.json and .env',
      mimeType: 'text/markdown',
    },
    {
      uri: `${SERVER_NAME}://response-format`,
      name: 'Response Format',
      description: 'Response structure documentation',
      mimeType: 'text/markdown',
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const match = request.params.uri.match(new RegExp(`^${SERVER_NAME}://(.+)$`));

  if (!match) {
    throw new McpError(ErrorCode.InvalidRequest, `Invalid resource URI: ${request.params.uri}`);
  }

  const resourceName = match[1];
  const resourcePath = path.join(__dirname, 'resources', `${resourceName}.md`);

  try {
    const content = fs.readFileSync(resourcePath, 'utf8');
    return {
      contents: [{
        uri: request.params.uri,
        mimeType: 'text/markdown',
        text: content,
      }],
    };
  } catch {
    throw new McpError(ErrorCode.InvalidRequest, `Resource not found: ${resourceName}`);
  }
});

// ── Error Handling ─────────────────────────────────────────────────────────────

server.onerror = (error) => console.error('[MCP Error]', error);
process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});

// ── Start ──────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} v${VERSION} running on stdio (config: ${configPath})`);
}

main().catch(console.error);

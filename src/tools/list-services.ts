import { loadConfig } from '../config.js';

/**
 * Tool: list_services
 * Returns the tree of stands and their services from config.
 */
export async function listServices(args: {
  stand?: string;
}): Promise<{ content: Array<{ type: string; text: string }> }> {
  const config = loadConfig();

  if (args.stand) {
    const standConfig = config.stands[args.stand];
    if (!standConfig) {
      const available = Object.keys(config.stands).join(', ');
      return {
        content: [{ type: 'text', text: `Stand '${args.stand}' not found. Available: ${available}` }],
      };
    }

    const result = {
      stand: args.stand,
      services: Object.entries(standConfig.services || {}).map(([name, svc]) => ({
        name,
        url: svc.url,
        openapi: svc.openapi || null,
      })),
      elastic: standConfig.elastic ? { url: standConfig.elastic.url, indexPattern: standConfig.elastic.indexPattern || null } : null,
      database: standConfig.database ? {
        host: standConfig.database.host,
        port: standConfig.database.port,
        db: standConfig.database.db,
      } : null,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }

  // Return all stands overview
  const result = Object.entries(config.stands).map(([name, stand]) => ({
    stand: name,
    services: Object.keys(stand.services || {}),
    hasElastic: !!stand.elastic,
    hasDatabase: !!stand.database,
  }));

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
}

export const listServicesSchema = {
  name: 'list_services',
  description: 'List available stands and their services, databases, and OpenSearch endpoints from the config file.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      stand: { type: 'string', description: 'Optional: specific stand to inspect. Omit to list all stands.' },
    },
    required: [] as string[],
  },
};

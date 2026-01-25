import type { AgentConfiguration } from './definition.js';

export function getTags(config: AgentConfiguration): string[] {
    const tags: string[] = config.capabilities?.extensions?.map((extension) => extension.uri) ?? [];
    tags.push(config.name);
    // tags.push(config.description);
    if (config.modelId) {
        tags.push(config.modelId);
    }
    if (config.version) {
        tags.push(config.version);
    }
    if (config.toolUris) {
        tags.concat(config.toolUris);
    }
    if (config.groupIds) {
        tags.concat(config.groupIds?.map((groupId) => (typeof groupId === 'string' ? groupId : groupId.id)) ?? []);
    }
    tags.push(config.schemaVersion);
    tags.push('a2a');
    return tags;
}

const services = [
    {
        type: 'mcp',
        uri: 'filesystem',
        url: 'http://localhost:3000/mcp/fs',
        info: {
            implementation: {
                version: '0.0.1',
                name: `filesystem-mcp`,
                serverCapabilities: {},
            },
        },
    },
    {
        type: 'a2a',
        uri: 'database-specialist',
        url: 'https://agents.example.com/db',
        info: {
            protocolVersion: '0.3.0',
            name: 'database-specialist',
            // ...
        },
    },
];

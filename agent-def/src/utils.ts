import type { AgentConfiguration } from "./definition.js";

export function getTags(config: AgentConfiguration): string[] {
    const tags: string[] = config.capabilities?.extensions?.map((extension) => extension.uri) ?? [];
    tags.push(config.name);
    tags.push(config.description);
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
        tags.concat(config.groupIds?.map((groupId) => typeof groupId === "string" ? groupId : groupId.id) ?? []);
    }
    tags.push(config.schemaVersion);
    tags.push("a2a");
    return tags;
}

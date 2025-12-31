# @artinet/loader

Load and validate agent definitions from markdown files.

## Overview

`@artinet/loader` discovers, parses, and validates agent definitions stored as markdown files with YAML frontmatter. It supports loading individual files or entire directories, handles parallel processing, and provides detailed error reporting.

**Key capabilities:**

- Load from single files or directories
- Parse YAML frontmatter + markdown instructions
- Validate against `agent-def` schemas
- Auto-generate IDs if not provided
- Parallel processing with configurable threads
- Detailed error tracking per file

## Installation

```bash
npm install @artinet/loader
```

## Usage

### Load a single agent

```typescript
import { AgentLoader } from "@artinet/loader";

const loader = new AgentLoader();
const result = await loader.loadAgents("./agents/backend-architect.md");

console.log(result.agents); // { "backend-architect": { config, sourceFile } }
console.log(result.errors); // []
```

### Load a directory of agents

```typescript
import { AgentLoader } from "@artinet/loader";

const loader = new AgentLoader({
  threads: 10, // parallel file processing
});

const result = await loader.loadAgents("./agents");

// Access loaded agents
for (const [id, agent] of Object.entries(result.agents)) {
  console.log(`${id}: ${agent.config.name}`);
}

// Check for errors
if (result.errors.length > 0) {
  console.error("Failed to load some agents:", result.errors);
}
```

## Agent File Format

Agent definitions are stored as markdown files with YAML frontmatter:

```markdown
---
id: backend-architect
name: Backend System Architect
modelId: openai/gpt-4
toolIds: [filesystem, database-analyzer]
groupIds: [team:backend]
services:
  - type: mcp
    id: filesystem
    url: http://localhost:3000/mcp/fs
---

You are a backend system architect specializing in scalable API design.
Focus on RESTful patterns, microservice boundaries, and database optimization.
```

The markdown body becomes the agent's `instructions` field. All frontmatter fields are validated against the [`agent-def`](https://github.com/the-artinet-project/agent-def) schema.

## Configuration Options

```typescript
interface AgentLoaderConfig {
  threads: number; // Parallel processing threads (default: 10)
  availableTools: string[]; // Reserved for future validation
  fileExtensions: string[]; // File types to load (default: [".md", ".markdown"])
}
```

## API

### `AgentLoader`

Main class for loading agent definitions.

#### `constructor(config?: Partial<AgentLoaderConfig>)`

Create a new loader with optional configuration.

#### `async loadAgents(targetPath: string): Promise<LoadResults>`

Load agent definitions from a file or directory.

**Returns:**

```typescript
interface LoadResults {
  agents: Record<string, ResolvedAgent>; // Successfully loaded agents
  errors: LoadError[]; // Files that failed to load
}

interface ResolvedAgent {
  sourceFile: string; // Path to source file
  config: AgentConfiguration; // Parsed and validated config
  client?: boolean; // Reserved for future use
}
```

### Helper function

```typescript
import { loadAgents } from "@artinet/loader";

const loader = await loadAgents("./agents");
// Returns AgentLoader instance after loading
```

## Error Handling

The loader collects all errors during batch processing instead of failing fast:

```typescript
const result = await loader.loadAgents("./agents");

result.errors.forEach(({ filePath, errors }) => {
  console.error(`Failed to load ${filePath}:`);
  errors.forEach((err) => console.error(`  - ${err.message}`));
});
```

Common errors:

- Invalid YAML frontmatter
- Missing required fields (name, instructions)
- Schema validation failures
- Duplicate agent IDs
- Empty or missing files

## Development

```bash
# Build the library
npm run build

# Run tests
npm test

# Clean build artifacts
npm run clean
```

## Related Projects

- [`agent-def`](https://github.com/the-artinet-project/agent-def) - Agent definition schemas
- [`@artinet/sdk`](https://github.com/the-artinet-project/sdk) - Artinet SDK

## License

Apache-2.0

## Links

- [GitHub Repository](https://github.com/the-artinet-project/loader)
- [Issue Tracker](https://github.com/the-artinet-project/loader/issues)

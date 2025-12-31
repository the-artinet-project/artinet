[![Website](https://img.shields.io/badge/website-artinet.io-black)](https://artinet.io/)
[![npm version](https://img.shields.io/npm/v/@artinet/bash-mcp.svg)](https://www.npmjs.com/package/@artinet/bash-mcp)
[![npm downloads](https://img.shields.io/npm/dt/@artinet/bash-mcp.svg)](https://www.npmjs.com/package/@artinet/bash-mcp)
[![Apache License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Known Vulnerabilities](https://snyk.io/test/npm/@artinet/bash-mcp/badge.svg)](https://snyk.io/test/npm/@artinet/bash-mcp)
[![GitHub stars](https://img.shields.io/github/stars/the-artinet-project/mcp?style=social)](https://github.com/the-artinet-project/mcp/stargazers)
[![Discord](https://dcbadge.limes.pink/api/server/DaxzSchmmX?style=flat)](https://discord.gg/DaxzSchmmX)

# Bash MCP Server

A lightweight [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for executing bash commands in a persistent shell session. This implementation is based on Anthropic's [BashTool20250124](https://docs.claude.com/en/docs/agents-and-tools/tool-use/bash-tool) and optimized for use with the `InMemoryTransport`.

## Features

- **Persistent Sessions**: Execute commands in a long-running bash session that maintains state
- **Security Controls**: Built-in banned command list to prevent dangerous operations
- **Timeout Management**: Configurable command timeout (default: 2 minutes)
- **Session Lifecycle**: Start, stop, and restart sessions as needed
- **Error Handling**: Captures both stdout and stderr with proper error reporting

## Installation

```bash
npm install @artinet/bash-mcp
```

## Usage

### Commandline

```bash
npx @artinet/bash-mcp
```

Running with banned commands:

```bash
npx @artinet/bash-mcp git docker rm
```

### As an MCP Server

```typescript
import { BashServer } from "@artinet/bash-mcp";

const server = new BashServer();
// Server will register the 'bash' tool automatically
```

### Programmatic Usage

```typescript
import { BashSession } from "@artinet/bash-mcp";

const session = new BashSession();
await session.start();

// Execute commands
const result = await session.run('echo "Hello, World!"');
console.log(result.output); // "Hello, World!"

// Clean up
await session.stop();
```

## Tool Reference

The server exposes a single tool: `bash`

### Parameters

| Parameter | Type    | Description                            |
| --------- | ------- | -------------------------------------- |
| `command` | string  | The bash command to execute            |
| `restart` | boolean | Restart the session (clears all state) |
| `stop`    | boolean | Stop the current session               |

### Examples

```typescript
// Execute a command
await server.bash({ command: "ls -la" });

// Set environment variable (persists in session)
await server.bash({ command: 'export MY_VAR="value"' });
await server.bash({ command: "echo $MY_VAR" }); // "value"

// Restart session (clears all state)
await server.bash({ restart: true });

// Stop session
await server.bash({ stop: true });
```

## Security

For security and to mitigate prompt injection attacks, the following commands are banned:

**Network Tools**: `curl`, `wget`, `nc`, `telnet`, `lynx`, `w3m`, `httpie`  
**Text Editors**: `vim`, `nano`, `vi`, `emacs`, `code`, `atom`, `cursor`  
**Privilege Escalation**: `sudo`, `su`, `doas`  
**Dangerous Operations**: `rm -rf /`, fork bombs, `alias`  
**Pagers**: `less`

You can extend this list by passing additional banned commands to the constructor:

```typescript
const server = new BashServer(
  { name: "bash-mcp-server", version: "1.0.0" },
  {},
  ["git", "docker"] // Additional banned commands
);
```

## Configuration

### Session Parameters

```typescript
const session = new BashSession({
  command: "/bin/bash", // Shell to use
  output_delay: 200, // Delay before reading output (ms)
  timeout: 120000, // Command timeout (ms)
  sentinel: "<<exit>>", // Internal marker for command completion
});
```

## Limitations

- **No Interactive Commands**: Cannot handle `vim`, `less`, or password prompts
- **No GUI Applications**: Command-line only
- **Output Limits**: Large outputs may be truncated
- **No Streaming**: Results returned only after command completion
- **Session Persistence**: Sessions persist within the conversation but not between API calls

## Development

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

## License

Apache-2.0

## References

- [MCP Specification](https://modelcontextprotocol.io)
- [Anthropic Computer Use Demo](https://github.com/anthropics/claude-quickstarts/blob/main/computer-use-demo/computer_use_demo/tools/bash.py)
- [Claude Bash Tool Documentation](https://docs.claude.com/en/docs/agents-and-tools/tool-use/bash-tool)

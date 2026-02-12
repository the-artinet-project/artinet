# API Reference

This document provides a comprehensive reference for Fleet's HTTP endpoints and JSON-RPC methods.

## HTTP Endpoints

### POST /deploy

Create a new agent by sending a configuration to the `/deploy` endpoint.

**Request Body:**

```json
{
    "config": {
        "uri": "my-agent",
        "name": "My Agent",
        "description": "A helpful assistant",
        "modelId": "gpt-4o",
        "instructions": "You are a helpful assistant.",
        "version": "1.0.0",
        "skills": [],
        "capabilities": {},
        "defaultInputModes": ["text"],
        "defaultOutputModes": ["text"],
        "services": []
    }
}
```

**Response:**

```json
{
    "success": true,
    "agentId": "my-agent"
}
```

**Agent Configuration Fields:**

| Field                | Type        | Required | Description                           |
| -------------------- | ----------- | -------- | ------------------------------------- |
| `uri`                | `string`    | Yes      | Unique identifier for the agent       |
| `name`               | `string`    | Yes      | Display name                          |
| `description`        | `string`    | No       | Agent description                     |
| `modelId`            | `string`    | No       | LLM model ID (default: `gpt-4o`)      |
| `instructions`       | `string`    | Yes      | A System prompt for the agent         |
| `version`            | `string`    | Yes      | Semantic version                      |
| `skills`             | `Skill[]`   | No       | Agent capabilities                    |
| `capabilities`       | `object`    | No       | Feature flags                         |
| `defaultInputModes`  | `string[]`  | No       | Supported input types                 |
| `defaultOutputModes` | `string[]`  | No       | Supported output types                |
| `services`           | `Service[]` | Yes      | STDIO MCP servers & Remote A2A Agents |
| `agentUris`          | `string[]`  | No       | Local Sub-agents to connect to        |

- _See `agent-def` for more information on agent configurations._

**Service Configuration (MCP):**

```json
{
    "type": "mcp",
    "uri": "filesystem-server",
    "info": {
        "implementation": {
            "version": "1.0.0",
            "name": "filesystem"
        }
    },
    "arguments": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
    }
}
```

- _Currently limited to `STDIO` MCP Servers with Remote Server support coming soon_

---

### POST /test

Test an agent configuration before deployment. Runs the agent with a set of test messages and returns the results.

**Request Body:**

```json
{
    "config": {
        "uri": "test-agent",
        "name": "Test Agent",
        "modelId": "gpt-4o",
        "instructions": "You are a helpful assistant.",
        "version": "1.0.0",
        "services": []
    },
    "tests": [
        {
            "message": {
                "messageId": "test-1",
                "kind": "message",
                "role": "user",
                "parts": [{ "kind": "text", "text": "Hello!" }]
            }
        },
        {
            "message": {
                "messageId": "test-2",
                "kind": "message",
                "role": "user",
                "parts": [{ "kind": "text", "text": "What is 2+2?" }]
            }
        }
    ]
}
```

**Response:**

Test results are returned using SSE.

```json
{
    "results": [
        {
            "testId": "test-1",
            "success": true,
            "response": {
                /* Task or Message */
            }
        },
        {
            "testId": "test-2",
            "success": true,
            "response": {
                /* Task or Message */
            }
        }
    ]
}
```

---

### GET /agentId/:id/.well-known/agent-card.json

Retrieve the agent card (metadata) for a deployed agent.

**Response:**

```json
{
    "name": "My Agent",
    "description": "A helpful assistant",
    "url": "http://localhost:3000/agentId/my-agent",
    "version": "1.0.0",
    "capabilities": {
        "streaming": true,
        "pushNotifications": false,
        "stateTransitionHistory": true
    },
    "defaultInputModes": ["text"],
    "defaultOutputModes": ["text"],
    "skills": []
}
```

---

### POST /agentId/:id

JSON-RPC 2.0 endpoint for agent interaction.

**Request Headers:**

```
Content-Type: application/json
```

**Request Body:**

```json
{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "message/send",
    "params": {
        /* method-specific params */
    }
}
```

---

## Agent2Agent JSON-RPC Methods

All methods follow the [JSON-RPC 2.0 specification](https://www.jsonrpc.org/specification) and are part of the [Agent2Agent (A2A) protocol](https://github.com/a2aproject/A2A).

### message/send

Send a message to the agent and receive a response.

**Params:**

```json
{
    "message": {
        "messageId": "msg-123",
        "kind": "message",
        "role": "user",
        "parts": [{ "kind": "text", "text": "Hello, agent!" }]
    },
    "configuration": {
        "blocking": true,
        "acceptedOutputModes": ["text"]
    }
}
```

**Result (blocking):**

```json
{
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
        "id": "task-456",
        "contextId": "ctx-789",
        "status": {
            "state": "completed",
            "timestamp": "2025-01-27T10:00:00Z"
        },
        "artifacts": [
            {
                "artifactId": "art-001",
                "parts": [{ "kind": "text", "text": "Hello! How can I help you today?" }]
            }
        ],
        "history": [
            /* message history */
        ]
    }
}
```

**Message Parts:**

| Kind   | Fields                                                               | Description        |
| ------ | -------------------------------------------------------------------- | ------------------ |
| `text` | `text: string`                                                       | Plain text content |
| `file` | `name: string`, `mimeType: string`, `bytes?: string`, `uri?: string` | File attachment    |
| `data` | `data: Record<string,unknown>`                                       | Structured data    |

---

### message/stream

Send a message and receive streaming updates via Server-Sent Events (SSE).

**Params:**

```json
{
    "message": {
        "messageId": "msg-123",
        "kind": "message",
        "role": "user",
        "parts": [{ "kind": "text", "text": "Tell me a story" }]
    }
}
```

**Response Headers:**

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Event Types:**

```json
event: task.status
data: {"taskId":"task-456","contextId":"ctx-789","status":{"state":"working"}}

event: task.artifact
data: {"taskId":"task-456","artifact":{"parts":[{"kind":"text","text":"Once upon a time..."}]}}

event: task.status
data: {"taskId":"task-456","contextId":"ctx-789","status":{"state":"completed"}}
```

**Task States:**

| State            | Description                          |
| ---------------- | ------------------------------------ |
| `submitted`      | Task received, queued for processing |
| `working`        | Agent is actively processing         |
| `input-required` | Agent needs additional input         |
| `completed`      | Task finished successfully           |
| `failed`         | Task encountered an error            |
| `canceled`       | Task was cancelled                   |

---

### task/get

Retrieve a task by ID.

**Params:**

```json
{
    "id": "task-456"
}
```

**Result:**

```json
{
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
        "id": "task-456",
        "contextId": "ctx-789",
        "status": {
            "state": "completed",
            "timestamp": "2025-01-27T10:00:00Z"
        },
        "artifacts": [
            /* ... */
        ],
        "history": [
            /* ... */
        ]
    }
}
```

---

### task/cancel

Cancel a running task.

**Params:**

```json
{
    "id": "task-456"
}
```

**Result:**

```json
{
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
        "id": "task-456",
        "contextId": "ctx-789",
        "status": {
            "state": "canceled",
            "timestamp": "2025-01-27T10:01:00Z"
        }
    }
}
```

---

### resubscribe

Resubscribe to updates for an existing task. Returns an SSE stream.

**Params:**

```json
{
    "id": "task-456"
}
```

**Response:**

SSE stream with task events (same format as `message/stream`).

---

## Error Responses

Errors follow the JSON-RPC 2.0 error format:

```json
{
    "jsonrpc": "2.0",
    "id": 1,
    "error": {
        "code": -32600,
        "message": "Invalid Request",
        "data": {
            /* additional details */
        }
    }
}
```

**Standard Error Codes:**

| Code     | Message          | Description                  |
| -------- | ---------------- | ---------------------------- |
| `-32700` | Parse error      | Invalid JSON                 |
| `-32600` | Invalid Request  | Not a valid JSON-RPC request |
| `-32601` | Method not found | Unknown method               |
| `-32602` | Invalid params   | Invalid method parameters    |
| `-32603` | Internal error   | Server error                 |

**Application Error Codes:**

| Code     | Message         | Description                    |
| -------- | --------------- | ------------------------------ |
| `-32001` | Agent not found | No agent with the specified ID |
| `-32002` | Task not found  | No task with the specified ID  |
| `-32003` | Unauthorized    | Authentication required        |
| `-32004` | Rate limited    | Too many requests              |

---

## Client Examples

There's yet to be an AgentCard discovery standard, so use [artinet's specialized A2AClient]() (`AgentMessenger`) to communicate programatically with Fleet Agents.

### JavaScript/TypeScript (SDK)

```typescript
import { createMessenger } from '@artinet/sdk';

const messenger = createMessenger({
    baseUrl: 'http://localhost:3000/agentId/my-agent',
});

// Send blocking message
const task = await messenger.sendMessage('Hello!');

// Stream response
for await (const event of messenger.sendMessageStream('Tell me a story')) {
    console.log(event);
}

// Get task
const task = await messenger.getTask('task-456');

// Cancel task
await messenger.cancelTask('task-456');
```

### cURL

Or bypass the client entirely with curl.

```bash
# Deploy agent
curl -X POST http://localhost:3000/deploy \
  -H "Content-Type: application/json" \
  -d '{"config":{"uri":"my-agent","name":"My Agent","version":"1.0.0"}}'

# Get agent card
curl http://localhost:3000/agentId/my-agent/.well-known/agent-card.json

# Send message
curl -X POST http://localhost:3000/agentId/my-agent \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "message/send",
    "params": {
      "message": {
        "messageId": "msg-1",
        "kind": "message",
        "role": "user",
        "parts": [{"kind": "text", "text": "Hello!"}]
      }
    }
  }'

# Stream response
curl -X POST http://localhost:3000/agentId/my-agent \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "message/stream",
    "params": {
      "message": {
        "messageId": "msg-1",
        "kind": "message",
        "role": "user",
        "parts": [{"kind": "text", "text": "Tell me a story"}]
      }
    }
  }'
```

### Python

```python
import requests
import json

base_url = "http://localhost:3000"

# Deploy agent
response = requests.post(
    f"{base_url}/deploy",
    json={
        "config": {
            "uri": "my-agent",
            "name": "My Agent",
            "version": "1.0.0"
        }
    }
)
print(response.json())

# Send message
response = requests.post(
    f"{base_url}/agentId/my-agent",
    json={
        "jsonrpc": "2.0",
        "id": 1,
        "method": "message/send",
        "params": {
            "message": {
                "messageId": "msg-1",
                "kind": "message",
                "role": "user",
                "parts": [{"kind": "text", "text": "Hello!"}]
            }
        }
    }
)
print(response.json())
```

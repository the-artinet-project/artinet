[![Website](https://img.shields.io/badge/website-artinet.io-black)](https://artinet.io/)
[![npm version](https://img.shields.io/npm/v/@artinet/ask.svg)](https://www.npmjs.com/package/@artinet/ask)
[![npm downloads](https://img.shields.io/npm/dt/@artinet/ask.svg)](https://www.npmjs.com/package/@artinet/ask)
[![Apache License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Known Vulnerabilities](https://snyk.io/test/npm/@artinet/ask/badge.svg)](https://snyk.io/test/npm/@artinet/ask)
[![GitHub stars](https://img.shields.io/github/stars/the-artinet-project/chat?style=social)](https://github.com/the-artinet-project/chat/stargazers)
[![Discord](https://dcbadge.limes.pink/api/server/DaxzSchmmX?style=flat)](https://discord.gg/DaxzSchmmX)

# @artinet/ask

A light-weight/minimalist commandline client for connecting to local and remote Agent2Agent (A2A) Servers.

https://github.com/user-attachments/assets/71e25f02-da97-470f-a5e4-19096b165e7b

## Installation

```bash
npm install -g @artinet/ask
```

## Usage

```bash
# Connect to the default endpoint (http://localhost:3000/a2a)
ask

# Connect to a custom endpoint
ask -e https://your-agent.com/api

# Send a single message
ask -m <message>

# View agent card
ask -c

# Enable verbose output
ask -v

# Continue with an existing conversation
ask -t <taskId>
```

**The client expects the AgentCard to be served at /.well-known/agent-card.json**

## Options

- `-m, --message` - Send a single message to the agent and recieve a response
- `-e, --endpoint <endpoint>` - Set the A2A endpoint
- `-v, --verbose` - Enable verbose output with detailed status updates
- `-t, --task <taskId>` - Continue an existing conversation
- `-c, --card` - Show the agent card and exit

## Development

```bash
npm install
npm run build
npm run dev
```

## License

Apache-2.0

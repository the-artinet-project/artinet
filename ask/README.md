
<p align="center">
<a href="https://artinet.io"><img src="https://img.shields.io/badge/website-artinet.io-black" alt="Website"></a>
<a href="https://www.npmjs.com/package/@artinet/ask"><img src="https://img.shields.io/npm/v/@artinet/ask?color=black" alt="Version"></a>
<a href="https://www.npmjs.com/package/@artinet/ask"><img src="https://img.shields.io/npm/dt/@artinet/ask?color=black" alt="Downloads"></a>
<a><img src="https://img.shields.io/badge/License-Apache_2.0-black.svg" alt="License"></a>
<a href="https://snyk.io/test/npm/@artinet/ask"><img src="https://snyk.io/test/npm/@artinet/ask/badge.svg" alt="Known Vulnerabilities"></a>
</p>

<h1 align="center"><em>ask</em></h1>

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

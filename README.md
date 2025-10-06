# @artinet/lchat

A light-weight/minimalist CLI chat client for connecting to local and remote Agent2Agent (A2A) Servers.

## Installation

```bash
npm install -g @artinet/chat
```

## Usage

```bash
# Connect to default endpoint (http://localhost:3000/a2a)
lchat

# Connect to custom endpoint
lchat -e https://your-agent.com/api

# View agent card
lchat -c

# Enable verbose output
lchat -v

# Continue existing task
lchat -t <taskId>
```

## Options

- `-e, --endpoint <endpoint>` - Set the A2A endpoint
- `-v, --verbose` - Enable verbose output with detailed status updates
- `-t, --task <taskId>` - Continue an existing task conversation
- `-c, --card` - Show the agent card and exit

## Development

```bash
npm install
npm run build
npm run dev
```

## License

Apache-2.0

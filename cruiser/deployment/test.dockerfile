# test.dockerfile
FROM node:20-alpine

WORKDIR /test

# Copy package tarball
COPY artinet-cruiser-*.tgz  /tmp/cruiser.tgz

# Create test project
RUN npm init -y && \
    npm install /tmp/cruiser.tgz \
    @ai-sdk/openai \
    ai \
    openai \
    typescript \
    tsx \
    @artinet/sdk \
    express \
    @a2a-js/sdk \
    @modelcontextprotocol/sdk \
    @mastra/core \
    @mastra/server \
    @strands-agents/sdk \
    @anthropic-ai/claude-agent-sdk \
    @anthropic-ai/sdk \
    @openai/agents \
    @langchain/openai \
    @langchain/core \
    langchain

ENV OPENAI_API_KEY=
ENV INFERENCE_PROVIDER_URL=undefined

# Copy test file
COPY ./deployment/test-pack.js .

CMD ["node", "test-pack.js"]
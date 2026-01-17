# test.dockerfile
FROM node:20-alpine

WORKDIR /test

# Copy package tarball
COPY artinet-cruiser-*.tgz  /tmp/cruiser.tgz

# Create test project
RUN npm init -y && npm install \
    @openrouter/ai-sdk-provider \
    ai \
    openai \
    typescript \
    tsx \
    express \
    @mastra/core \
    @mastra/server \
    @strands-agents/sdk \
    @anthropic-ai/claude-agent-sdk \
    @anthropic-ai/sdk \
    @openai/agents \
    @langchain/openai \
    @langchain/core \
    langchain

RUN npm install @artinet/sdk

RUN npm install /tmp/cruiser.tgz

ENV OPENAI_API_KEY=
ENV INFERENCE_PROVIDER_URL=undefined

# Copy test file
COPY ./deployment/test-pack.js .

CMD ["node", "test-pack.js"]
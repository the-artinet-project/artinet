# test.dockerfile
FROM node:20-alpine

WORKDIR /test

# Copy package tarball
COPY artinet-agent-relay-*.tgz /tmp/relay.tgz

# Create test project
RUN npm init -y && \
    npm install /tmp/relay.tgz express portscanner @artinet/sdk @a2a-js/sdk

# Copy test file
COPY ./deployment/test-pack.js .

CMD ["node", "test-pack.js"]
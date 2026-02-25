FROM node:22-slim

WORKDIR /app

# Copy the full repo structure needed by the server
COPY server/package.json server/package-lock.json ./server/
COPY src/engine/ ./src/engine/
COPY src/shared/ ./src/shared/
COPY src/data/ ./src/data/

# Install server dependencies
WORKDIR /app/server
RUN npm ci --omit=dev

WORKDIR /app

# The server uses relative imports to ../src/engine/ etc.
CMD ["node", "--import", "tsx", "server/src/index.ts"]

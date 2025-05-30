# Build stage
FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm


# OpenAPI generation stage
FROM base AS openapi-generator
WORKDIR /app

# Install OpenJDK for OpenAPI generator
RUN apt-get update && apt-get install -y openjdk-17-jdk

# Copy package.json and pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Copy the rest of the files including the downloaded spec
COPY . .

# Generate OpenAPI code
RUN pnpm ci-gen-api

# Build stage
# ? Uses data compiled from the base stage
FROM base AS builder 
WORKDIR /app

# Copy package.json and pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --force

# Copy the rest of the files and generated OpenAPI code
COPY . .
COPY --from=openapi-generator /app/src/openapi ./src/openapi

# Build the application
RUN pnpm build

# Production stage
FROM base AS production
WORKDIR /app

# Copy built files and production dependencies
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/dist ./dist
# Copy Assets
COPY --from=builder /app/assets ./assets

# Install production dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --force

EXPOSE 2090
CMD ["pnpm", "start"]
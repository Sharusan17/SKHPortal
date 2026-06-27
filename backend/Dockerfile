# SKHPortal backend — Express + Prisma
FROM node:20-bookworm-slim

# Prisma needs OpenSSL at build and runtime.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install all dependencies (devDeps included — needed to compile TypeScript).
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build: `prisma generate` + `tsc` -> dist/
COPY . .
RUN npm run build

ENV NODE_ENV=production

# Railway provides PORT at runtime; the app reads process.env.PORT.
# Start runs `prisma migrate deploy` then `node dist/index.js`.
CMD ["npm", "start"]

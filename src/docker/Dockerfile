# Dockerfile
# Build stage
FROM node:22-alpine AS builder

# Instalar pnpm globalmente
RUN corepack enable && corepack prepare pnpm@latest --activate

# Instalar dependências de build
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copiar arquivos de dependência do pnpm
COPY pnpm-lock.yaml package.json ./
COPY .npmrc* ./

# Instalar dependências usando pnpm
RUN pnpm install --frozen-lockfile

# Copiar o resto do código
COPY prisma ./prisma/
COPY . .

# Gerar Prisma Client
RUN pnpm prisma generate

# Build da aplicação
RUN pnpm run build

# Remover devDependencies
RUN pnpm prune --prod

# Production stage
FROM node:22-alpine

# Instalar pnpm no runtime também (menor overhead)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Instalar apenas o necessário para runtime
RUN apk add --no-cache dumb-init tzdata \
  && cp /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime \
  && echo "America/Sao_Paulo" > /etc/timezone

# Definir timezone no container
ENV TZ=America/Sao_Paulo

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

WORKDIR /app

# Copiar arquivos necessários do builder
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/pnpm-lock.yaml ./
COPY --from=builder --chown=nestjs:nodejs /app/.env ./
# Mudar para usuário não-root
USER nestjs

# Expor porta
EXPOSE 3001

# Healthcheck local
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/healthz', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Usar dumb-init para melhor handling de sinais
ENTRYPOINT ["dumb-init", "--"]

# Comando para iniciar
CMD ["node", "dist/src/main"]

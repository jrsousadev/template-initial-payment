# Dockerfile para shop-fox-api
# Build stage
FROM node:22-alpine AS builder

# Habilitar pnpm via corepack (incluído no Node.js 22)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Instalar dependências de build necessárias
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copiar apenas os arquivos necessários para instalar dependências
COPY package.json pnpm-lock.yaml ./
COPY .npmrc* ./

# Instalar dependências com cache otimizado
RUN pnpm install --frozen-lockfile

# Copiar o restante do código fonte
COPY . .

# Gerar Prisma Client com o schema no caminho correto
RUN pnpm prisma generate

# Build da aplicação
RUN pnpm run build

# Remover devDependencies para reduzir o tamanho final
RUN pnpm prune --prod

# Production stage
FROM node:22-alpine AS production

# Habilitar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Instalar apenas pacotes essenciais para runtime
RUN apk add --no-cache dumb-init tzdata \
  && cp /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime \
  && echo "America/Sao_Paulo" > /etc/timezone

# Definir timezone
ENV TZ=America/Sao_Paulo
ENV NODE_ENV=production

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

WORKDIR /app

# Copiar apenas os arquivos necessários do estágio de build
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/pnpm-lock.yaml ./
COPY --from=builder --chown=nestjs:nodejs /app/.env ./
COPY --from=builder --chown=nestjs:nodejs /app/swagger.json ./
COPY --from=builder --chown=nestjs:nodejs /app/public ./public

# Copiar arquivos do Prisma necessários para runtime
COPY --from=builder --chown=nestjs:nodejs /app/src/infrastructure/database/prisma ./src/infrastructure/database/prisma

# Mudar para usuário não-root
USER nestjs

# Expor porta da aplicação
EXPOSE 3001

# Configurar healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Usar dumb-init para melhor gerenciamento de sinais
ENTRYPOINT ["dumb-init", "--"]

# Comando para iniciar a aplicação
CMD ["node", "dist/main"]

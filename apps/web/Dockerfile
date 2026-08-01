# Next.js standalone 生产镜像（Render Blueprint 使用）
# 构建上下文必须为仓库根目录：docker build -f apps/web/Dockerfile .
FROM node:20-alpine AS builder

WORKDIR /repo
COPY . .
RUN npm install
RUN npm --workspace apps/web run build

FROM node:20-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /repo/apps/web/.next/standalone/apps/web ./
COPY --from=builder /repo/apps/web/public ./public
COPY --from=builder /repo/apps/web/.next/static ./.next/static

EXPOSE 3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

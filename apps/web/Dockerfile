# Render 前端 Dockerfile —— Next.js 静态导出 + nginx 静态服务 + API 代理
# 多阶段构建：builder（Node.js 构建）→ runner（nginx 提供静态文件）

# ── Stage 1: 构建 Next.js 静态导出 ──
FROM node:22-alpine AS builder

WORKDIR /app

# 先复制依赖文件，利用 Docker 层缓存
COPY package.json ./

# 安装依赖
RUN npm install --legacy-peer-deps

# 复制源代码
COPY . .

# 构建参数
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# 构建 Next.js 静态导出（output: "export" → out/ 目录）
RUN npm run build

# ── Stage 2: nginx 提供静态文件 + API 代理 ──
FROM nginx:alpine AS runner

# 复制自定义 nginx 配置
COPY nginx.conf /etc/nginx/http.d/default.conf

# 复制构建产物
COPY --from=builder /app/out /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

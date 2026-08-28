#!/usr/bin/env bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════
# deploy_on_server.sh — 在腾讯服务器上构建并部署
# 前提: 代码已 git pull 到 /opt/ai-life-os
# ══════════════════════════════════════════════════════════════

APP_DIR="/opt/ai-life-os"
CONTAINER_NAME="ai-life-os-api"
IMAGE_NAME="ai-life-os-api"
PORT="${PORT:-8000}"
WORK_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "═══════════════════════════════════════════════════════"
echo "  AI Life OS — 部署脚本"
echo "  工作目录: $WORK_DIR"
echo "  端口: $PORT"
echo "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════════"

cd "$WORK_DIR"

# ── 1. 检查 Docker ──────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "❌ Docker 未安装，请先安装 Docker"
  exit 1
fi
echo "✓ Docker 已安装: $(docker --version)"

# ── 2. 构建前端 (如果 pnpm 可用) ──────────────────────────
if command -v pnpm &>/dev/null; then
  echo "--- 构建前端 (pnpm build) ---"
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
  pnpm --filter @ai-aggregation/web run build
  rm -rf apps/backend/static
  mkdir -p apps/backend/static
  cp -r apps/web/out/* apps/backend/static/
  echo "✓ 前端构建完成"
elif [ -d "apps/backend/static" ] && [ "$(find apps/backend/static -type f | wc -l)" -gt 0 ]; then
  echo "⚠ pnpm 不可用，使用已有的静态文件"
else
  echo "⚠ pnpm 不可用且无预构建静态文件，跳过前端"
  mkdir -p apps/backend/static
fi

# ── 3. 检查 .env 文件 ──────────────────────────────────────
if [ ! -f "$WORK_DIR/.env" ]; then
  echo "⚠ .env 文件不存在，从 .env.example 创建"
  cp "$WORK_DIR/.env.example" "$WORK_DIR/.env"
  echo "请编辑 $WORK_DIR/.env 填入实际的 API Key"
fi

# ── 4. 构建 Docker 镜像 ─────────────────────────────────────
echo "--- 构建 Docker 镜像 ---"
docker build -t "$IMAGE_NAME:latest" -f apps/backend/Dockerfile apps/backend/
echo "✓ Docker 镜像构建完成"

# ── 5. 停止旧容器 ───────────────────────────────────────────
echo "--- 停止旧容器 ---"
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  docker stop "$CONTAINER_NAME" || true
  docker rm "$CONTAINER_NAME" || true
  echo "✓ 旧容器已移除"
else
  echo "  无旧容器"
fi

# ── 6. 启动新容器 ───────────────────────────────────────────
echo "--- 启动新容器 ---"
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "${PORT}:8000" \
  --env-file "$WORK_DIR/.env" \
  -e PORT="$PORT" \
  -e APP_ENV=production \
  -e DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://postgres:postgres@host.docker.internal:5432/ai_agg_db}" \
  -e REDIS_URL="${REDIS_URL:-redis://host.docker.internal:6379/0}" \
  --add-host=host.docker.internal:host-gateway \
  "$IMAGE_NAME:latest"

echo "✓ 容器已启动"

# ── 7. 健康检查 ─────────────────────────────────────────────
echo "--- 健康检查 ---"
for i in $(seq 1 30); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "http://127.0.0.1:${PORT}/ready" 2>/dev/null || echo "000")
  if [ "$CODE" = "200" ]; then
    echo "✓ /ready HTTP 200 (第 ${i} 次尝试)"
    break
  fi
  echo "  等待中... /ready HTTP $CODE (第 ${i} 次尝试)"
  sleep 5
done

if [ "$CODE" != "200" ]; then
  echo "❌ 健康检查失败，最近日志:"
  docker logs --tail 50 "$CONTAINER_NAME" 2>&1 || true
  exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅ 部署成功!"
echo "  服务地址: http://127.0.0.1:${PORT}"
echo "  健康检查: http://127.0.0.1:${PORT}/ready"
echo "  API 文档: http://127.0.0.1:${PORT}/docs"
echo "═══════════════════════════════════════════════════════"

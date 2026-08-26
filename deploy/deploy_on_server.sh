#!/usr/bin/env bash
# ==============================================================================
# 服务器端自动部署脚本（放在服务器 /opt/ai-life-os/deploy_on_server.sh）
# 调用方：GitHub Actions 通过 SSH 进入服务器后执行此脚本
#
# 流程：
#   1. 校验前置条件（docker/docker-compose/目录结构）
#   2. 备份 .env / docker-compose.yml / data
#   3. （可选）如果 build_src/ 目录有新的构建产物，则更新到 build/
#   4. docker compose build + up
#   5. 健康检查验证
# ==============================================================================
set -euo pipefail

APP_DIR="/opt/ai-life-os"
LOG_FILE="$APP_DIR/deploy.log"
cd "$APP_DIR"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

log "========= 开始部署 ========="

# 1. 前置检查
for cmd in docker; do
  if ! command -v "$cmd" &>/dev/null; then
    log "❌ 缺少命令：$cmd"
    exit 1
  fi
done
if ! docker compose version &>/dev/null; then
  log "❌ docker compose 插件不可用"
  exit 1
fi
for f in .env docker-compose.yml build/Dockerfile; do
  if [ ! -f "$APP_DIR/$f" ]; then
    log "❌ 缺少文件：$APP_DIR/$f"
    exit 1
  fi
done

# 2. 如本地 build_src 有新产物（GitHub Actions 上传的），替换 build 目录
if [ -d "$APP_DIR/build_src" ] && [ -n "$(ls -A "$APP_DIR/build_src" 2>/dev/null)" ]; then
  log "📁 检测到 build_src，替换 build 目录..."
  BACKUP="$APP_DIR/build.bak.$(date +%Y%m%d_%H%M%S)"
  cp -a "$APP_DIR/build" "$BACKUP"
  rm -rf "$APP_DIR/build"
  mv "$APP_DIR/build_src" "$APP_DIR/build"
  log "✅ build 目录已替换，备份：$BACKUP"
fi

# 3. 构建 + 重启
log "🐳 停止旧容器..."
docker compose down 2>&1 | tail -5 || true

log "🐳 构建新镜像（--no-cache）..."
docker compose build --no-cache api 2>&1 | tail -20

log "🐳 启动新容器..."
docker compose up -d api 2>&1 | tail -5

# 4. 等待健康检查（与 docker-compose.yml 的 start_period 对齐：60s）
log "⏳ 等待服务启动（60s）..."
sleep 60

HEALTH_OK=0
for i in 1 2 3 4 5 6; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' ai-life-os-api 2>/dev/null || echo "unknown")
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 http://127.0.0.1:8000/health 2>/dev/null || echo 000)
  log "  check $i: status=$STATUS http=$HTTP_CODE"
  if [ "$STATUS" = "healthy" ] && [ "$HTTP_CODE" = "200" ]; then
    HEALTH_OK=1
    break
  fi
  sleep 15
done

if [ "$HEALTH_OK" != "1" ]; then
  log "❌ 健康检查失败，打印最后 80 行日志："
  docker logs --tail 80 ai-life-os-api 2>&1 | tee -a "$LOG_FILE"
  exit 1
fi

log "=== /ready 检查 ==="
curl -s http://127.0.0.1:8000/ready 2>&1 | tee -a "$LOG_FILE" || true
echo "" | tee -a "$LOG_FILE"

log "🎉 部署成功，当前容器状态："
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | tee -a "$LOG_FILE"
log "========= 部署结束 ========="

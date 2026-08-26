#!/bin/bash
# update-middleware.sh: 在服务器上重建并启动后端容器
set -e
REMOTE="/opt/ai-life-os"
cd $REMOTE

echo "=== Step 1: 重建后端镜像 ==="
sg docker -c 'docker compose build api 2>&1' | tail -20

echo ""
echo "=== Step 2: 启动新容器 ==="
sg docker -c 'docker compose up -d api 2>&1' | tail -10
sleep 5

echo ""
echo "=== Step 3: 容器状态 ==="
sg docker -c 'docker compose ps'

echo ""
echo "=== Step 4: 健康检查 ==="
echo -n "health: "; curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/health
echo -n "ready: "; curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/ready
echo -n "static: "; curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/_next/static/chunks/webpack-59f02ba726e744ac.js

echo ""
echo "=== Step 5: 容器日志（最近20行） ==="
sg docker -c 'docker compose logs --tail 20 api'

echo ""
echo "UPDATE_DONE"

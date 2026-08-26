#!/bin/bash
# build-and-run.sh: 在服务器上执行的构建脚本
set +e
REMOTE="/opt/ai-life-os"
cd $REMOTE

echo "=== Step 1: 准备 build 目录 ==="
rm -rf build
mkdir -p build
if [ ! -d src ]; then echo "SRC_MISSING"; exit 1; fi
cp -r src/* build/
for f in Dockerfile pyproject.toml uv.lock alembic.ini; do
  if [ ! -f "build/$f" ]; then echo "MISSING build/$f"; ls build/; exit 1; fi
done
echo "BUILD_DIR_OK"
ls build/Dockerfile build/pyproject.toml

echo ""
echo "=== Step 2: 停止旧容器并构建镜像（5-15 分钟） ==="
sg docker -c 'docker compose down 2>&1 | tail -5'
echo "---"
sg docker -c 'docker compose build --no-cache api 2>&1 | tail -100'
BUILD_EC=$?
echo "BUILD_EXIT_$BUILD_EC"
if [ $BUILD_EC -ne 0 ]; then
  echo "Build failed, here are last 200 lines:"
  sg docker -c 'docker compose build api 2>&1 | tail -200'
  exit 1
fi

echo ""
echo "=== Step 3: 启动容器 ==="
sg docker -c 'docker compose up -d api 2>&1'
echo "START_DONE"
sleep 3
sg docker -c 'docker compose ps'

echo ""
echo "=== Step 4: 轮询 health 端点 ==="
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  sleep 5
  STATUS=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/health 2>/dev/null || echo '000')
  echo "[$i] health status: $STATUS"
  if [ "$STATUS" = "200" ]; then
    echo "HEALTHY"
    curl -s http://127.0.0.1:8000/health
    echo
    break
  fi
done
echo "LAST_LOGS"
sg docker -c 'docker compose logs --tail 40 api' 2>&1
echo "LOGS_DONE"

echo ""
echo "=== Step 5: 外网验证 ==="
echo "-- port 8000 direct --"
curl -s -o /dev/null -w '%{http_code}' http://124.223.183.102:8000/health || echo FAIL
echo
echo "-- nginx port 80 proxy --"
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/health || echo FAIL
echo
echo "FINAL_DONE"

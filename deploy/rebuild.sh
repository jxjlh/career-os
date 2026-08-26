#!/bin/bash
# rebuild.sh: 配置 Docker 镜像加速 + 修改 Dockerfile + 重新构建
set +e
REMOTE="/opt/ai-life-os"
cd $REMOTE

echo "=== Step 0: 配置 Docker 镜像加速 ==="
sudo mkdir -p /etc/docker
sudo bash -c 'cat > /etc/docker/daemon.json <<MIRROREOF
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com",
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com"
  ]
}
MIRROREOF'
sudo systemctl restart docker
sleep 3
echo "Docker mirror configured"
sg docker -c 'docker info 2>&1 | grep -A5 "Registry Mirrors"'

echo ""
echo "=== Step 1: 创建修改后的 Dockerfile（用 Docker Hub python 基础镜像） ==="
cat > build/Dockerfile <<'NEWDOCKERFILE'
FROM python:3.13-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production \
    UV_PYTHON=python3.13 \
    UV_LINK_MODE=copy \
    UV_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple \
    PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple \
    PIP_TRUSTED_HOST=pypi.tuna.tsinghua.edu.cn

WORKDIR /app

# 安装 uv（用清华 PyPI 镜像）
RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock ./
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./alembic.ini
COPY static ./static

# 安装含 dev 组（提供 alembic）
RUN uv sync --frozen

RUN useradd --create-home --shell /bin/bash app && chown -R app:app /app

USER app
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f\"http://127.0.0.1:{os.environ.get('PORT', '8000')}/health\")"

CMD ["sh", "-c", "uv run alembic upgrade head 2>&1; echo '--- Starting uvicorn ---'; uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
NEWDOCKERFILE
echo "Dockerfile updated"
cat build/Dockerfile | head -5

echo ""
echo "=== Step 2: 构建镜像 ==="
sg docker -c 'docker compose build --no-cache api 2>&1'
BUILD_RC=$?
echo "BUILD_RC=$BUILD_RC"

if [ $BUILD_RC -ne 0 ]; then
  echo "BUILD FAILED"
  exit 1
fi

echo ""
echo "=== Step 3: 启动容器 ==="
sg docker -c 'docker compose up -d api 2>&1'
echo "START_DONE"
sleep 3
sg docker -c 'docker compose ps'

echo ""
echo "=== Step 4: 轮询 health ==="
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

echo ""
echo "=== Step 5: 日志 ==="
sg docker -c 'docker compose logs --tail 40 api' 2>&1

echo ""
echo "=== Step 6: 外网验证 ==="
echo "-- port 8000 --"
curl -s -o /dev/null -w '%{http_code}' http://124.223.183.102:8000/health || echo FAIL
echo
echo "-- nginx port 80 --"
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/health || echo FAIL
echo
echo "FINAL_DONE"

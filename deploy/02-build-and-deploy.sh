#!/bin/bash
set -e

cd /opt/ai-life-os

echo "===== Step 1: 清理旧的构建目录 ====="
sudo rm -rf /opt/ai-life-os/build
sudo mkdir -p /opt/ai-life-os/build
sudo chown -R $USER:$USER /opt/ai-life-os

echo ""
echo "===== Step 2: 准备 Docker 构建上下文（用本地 apps/api 目录） ====="
# 由于我们在远程服务器，这里假设代码已经通过 scp 或 git clone 到了 /opt/ai-life-os/src
# 如果还没有，先 clone 或 scp：
#   git clone <your-repo> /opt/ai-life-os/src
#   或者在本地运行：scp -r apps/api ubuntu@124.223.183.102:/opt/ai-life-os/src

SRC_DIR="/opt/ai-life-os/src"
if [ ! -d "$SRC_DIR" ]; then
    echo "错误：找不到源代码目录 $SRC_DIR"
    echo ""
    echo "请先上传代码。两种方法任选其一："
    echo ""
    echo "方法 A（推荐）：在你的本地 Mac 终端运行："
    echo "  cd /Users/liheng/Documents/AI职业发展路径规划"
    echo "  tar czf api-src.tar.gz -C apps api"
    echo "  scp api-src.tar.gz ubuntu@124.223.183.102:/opt/ai-life-os/"
    echo ""
    echo "  然后回到服务器执行："
    echo "  cd /opt/ai-life-os && tar xzf api-src.tar.gz && mv api src"
    echo ""
    echo "方法 B：git clone"
    echo "  git clone <你的仓库地址> $SRC_DIR"
    exit 1
fi

echo "代码目录存在：$SRC_DIR"
ls -la $SRC_DIR | head -10

echo ""
echo "===== Step 3: 复制文件到 build 目录（构建上下文必须是 apps/api 级别） ====="
cp -r $SRC_DIR/* build/
# 确认关键文件存在
for f in Dockerfile pyproject.toml uv.lock alembic.ini; do
    if [ ! -f "build/$f" ]; then
        echo "错误：build/$f 不存在！检查源代码目录结构"
        exit 1
    fi
done

echo ""
echo "===== Step 4: 清理旧容器并构建新镜像 ====="
cd /opt/ai-life-os
docker compose down 2>/dev/null || true
docker compose build --no-cache api

echo ""
echo "===== Step 5: 启动容器 ====="
docker compose up -d api

echo ""
echo "===== Step 6: 等待服务启动并检查健康状态 ====="
sleep 5
echo "容器状态："
docker compose ps
echo ""
echo "最近 30 行日志："
docker compose logs --tail 30 api

echo ""
echo "===== Step 7: 验证 API ====="
sleep 5
for i in 1 2 3 4 5 6 7 8; do
    sleep 5
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/health || echo "000")
    echo "  [$i] health endpoint status: $STATUS"
    if [ "$STATUS" = "200" ]; then
        echo ""
        echo "✅ 部署成功！"
        echo ""
        echo "API 访问地址："
        echo "  本地：http://127.0.0.1:8000/health"
        echo "  外网：http://124.223.183.102:8000/health"
        echo ""
        echo "常用命令："
        echo "  docker compose logs -f api   # 实时查看日志"
        echo "  docker compose restart api   # 重启服务"
        echo "  docker compose pull && docker compose up -d api  # 升级镜像"
        exit 0
    fi
done

echo ""
echo "❌ 服务未能在预期时间内启动，查看完整日志："
docker compose logs api
exit 1

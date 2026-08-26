#!/bin/bash
# 在本地 Mac 上执行：上传 apps/api 源代码到服务器
cd "$(dirname "$0")/.."

SERVER="ubuntu@124.223.183.102"
REMOTE_DIR="/opt/ai-life-os"

echo "===== 清理旧的本地打包 ====="
rm -f api-src.tar.gz

echo ""
echo "===== 打包 apps/api ====="
tar czf api-src.tar.gz -C apps api
echo "打包完成，大小：$(du -h api-src.tar.gz | awk '{print $1}')"

echo ""
echo "===== 上传到服务器（需要 SSH 密码：LH040828@） ====="
# 先确保目录存在
ssh $SERVER "sudo mkdir -p $REMOTE_DIR && sudo chown -R ubuntu:ubuntu $REMOTE_DIR && rm -rf $REMOTE_DIR/src $REMOTE_DIR/build $REMOTE_DIR/api"

# 上传
scp api-src.tar.gz $SERVER:$REMOTE_DIR/

# 解压
ssh $SERVER "cd $REMOTE_DIR && tar xzf api-src.tar.gz && mv api src && rm -f api-src.tar.gz && echo '✅ 上传并解压完成' && ls -la src | head -10"

echo ""
echo "===== 清理本地临时文件 ====="
rm -f api-src.tar.gz

echo ""
echo "✅ 代码上传完成！现在回到服务器执行："
echo ""
echo "  cd /opt/ai-life-os && bash 02-build-and-deploy.sh"

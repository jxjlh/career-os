#!/bin/bash
set -e
CONF="/etc/nginx/sites-available/ai-life-os"

# 备份原配置
sudo cp $CONF ${CONF}.bak.$(date +%s)

# 禁用 HTTP/2，可能造成间歇性连接失败
sudo sed -i 's/listen 443 ssl http2;/listen 443 ssl;/g' $CONF

# 测试配置
sudo nginx -t

# 重载
sudo systemctl reload nginx

echo "CONFIG_UPDATED"
echo "=== 新配置 ==="
sudo grep -E 'listen|ssl_|keepalive' $CONF | head -10
echo "SCRIPT_EXIT_OK"

#!/bin/bash
echo "=== Nginx SSL 配置 ==="
sudo grep -E 'ssl_|listen|server_name' /etc/nginx/sites-available/ai-life-os | head -30

echo ""
echo "=== 实时 nginx 错误日志 (最近10条) ==="
sudo tail -10 /var/log/nginx/error.log

echo ""
echo "=== 测试本地 SSL 握手 ==="
for i in 1 2 3 4 5; do
  echo -n "attempt $i: "
  echo "Q" | openssl s_client -connect 127.0.0.1:443 -servername growlog.club 2>&1 | grep -E 'Verify|Protocol|Cipher|error' | head -3
  echo ""
done

echo ""
echo "=== 检查 Nginx worker_connections 和 keepalive ==="
sudo nginx -T 2>&1 | grep -E 'worker_processes|worker_connections|keepalive|multi_accept|reuseport' | head -10

echo ""
echo "=== Nginx 主配置中的 events 块 ==="
sudo cat /etc/nginx/nginx.conf | grep -A 5 '^events'

echo "SCRIPT_EXIT_OK"

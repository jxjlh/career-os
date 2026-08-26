#!/bin/bash
set -e
NGINX_CONF="/etc/nginx/nginx.conf"
SITE_CONF="/etc/nginx/sites-available/ai-life-os"

# 备份
sudo cp $NGINX_CONF ${NGINX_CONF}.bak.$(date +%s)
sudo cp $SITE_CONF ${SITE_CONF}.bak.$(date +%s)

echo "=== Step 1: 增加 worker_connections 和 rlimit ==="
# 增大 worker_connections
sudo sed -i 's/worker_connections 768;/worker_connections 4096;/g' $NGINX_CONF
# 取消注释 multi_accept
sudo sed -i 's/# multi_accept on;/multi_accept on;/g' $NGINX_CONF

# 在 events 块前添加 rlimit
if ! grep -q 'worker_rlimit_nofile' $NGINX_CONF; then
  sudo sed -i '/^events {/i worker_rlimit_nofile 65535;' $NGINX_CONF
fi

echo "=== Step 2: 优化 /api/ 反向代理（添加 keepalive 和 Connection 头） ==="
sudo tee $SITE_CONF > /dev/null << 'EOF'
server {
    listen 80;
    server_name growlog.club www.growlog.club;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type "text/plain";
        try_files $uri =404;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name growlog.club www.growlog.club;

    ssl_certificate /etc/letsencrypt/live/growlog.club/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/growlog.club/privkey.pem;

    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    client_max_body_size 50M;

    # keepalive 优化：减少 TCP 连接建立开销
    keepalive_timeout 65s;
    keepalive_requests 1000;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 300s;
        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        # 清除 Connection 头，让代理使用 keepalive
        proxy_set_header Connection "";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 300s;
        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        proxy_set_header Connection "";
    }

    location /media/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF

echo "=== Step 3: 增大系统 ulimit ==="
if ! grep -q 'fs.file-max' /etc/sysctl.conf; then
  echo 'fs.file-max = 65535' | sudo tee -a /etc/sysctl.conf > /dev/null
fi
sudo sysctl -p 2>&1 | tail -3

echo "=== Step 4: 测试并重载 ==="
sudo nginx -t
sudo systemctl reload nginx

echo "=== 验证 ==="
sudo grep -E 'worker_connections|multi_accept|worker_rlimit' /etc/nginx/nginx.conf
echo "---"
sudo nginx -T 2>&1 | grep -E 'worker_connections|worker_rlimit|multi_accept' | head -5

echo "SCRIPT_EXIT_OK"

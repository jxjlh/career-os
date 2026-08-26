#!/bin/bash
set -e

DOMAIN="growlog.club"
EMAIL="admin@growlog.club"

echo "===== Step 1: 安装 Certbot ====="
sudo apt-get update -y
sudo apt-get install -y certbot python3-certbot-nginx

echo ""
echo "===== Step 2: 创建 ACME webroot 目录 ====="
sudo mkdir -p /var/www/letsencrypt
sudo chown -R www-data:www-data /var/www/letsencrypt

echo ""
echo "===== Step 3: 配置 Nginx (HTTP + HTTPS 准备) ====="
sudo tee /etc/nginx/sites-available/ai-life-os > /dev/null << 'EOF'
server {
    listen 80;
    server_name growlog.club www.growlog.club;

    # Let's Encrypt 验证路径
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type "text/plain";
        try_files $uri =404;
    }

    # 其余请求跳转 HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name growlog.club www.growlog.club;

    # SSL 证书路径（certbot 会自动填充或通过 --nginx 自动改写）
    ssl_certificate /etc/letsencrypt/live/growlog.club/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/growlog.club/privkey.pem;

    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    client_max_body_size 50M;

    # 前端静态文件 (由后端容器提供)
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        # WebSocket 支持
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # API 后端
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }

    # 媒体文件
    location /media/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF

echo ""
echo "===== Step 4: 先用临时 HTTP-only 配置申请证书 ====="
# 先切回最简 HTTP 配置，让 certbot 能通过 80 端口验证
sudo tee /etc/nginx/sites-available/ai-life-os > /dev/null << 'EOF'
server {
    listen 80;
    server_name growlog.club www.growlog.club;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type "text/plain";
        try_files $uri =404;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "===== Step 5: 申请 Let's Encrypt 证书 ====="
sudo certbot certonly --webroot \
    -w /var/www/letsencrypt \
    -d growlog.club \
    -d www.growlog.club \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --no-eff

echo ""
echo "===== Step 6: 启用完整 HTTPS 配置 ====="
sudo tee /etc/nginx/sites-available/ai-life-os > /dev/null << 'EOF'
server {
    listen 80;
    server_name growlog.club www.growlog.club;

    # Let's Encrypt 续期验证路径
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type "text/plain";
        try_files $uri =404;
    }

    # HTTP 跳转 HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
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

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }

    location /media/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/ai-life-os /etc/nginx/sites-enabled/ai-life-os
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "===== Step 7: 配置证书自动续期 ====="
# Let's Encrypt 证书有效期 90 天，certbot 默认会安装 systemd timer
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# 测试续期流程（不真正续期，仅验证）
sudo certbot renew --dry-run || true

echo ""
echo "===== SSL 证书配置完成！ ====="
echo "访问 https://growlog.club 验证 HTTPS 是否生效"
echo ""
echo "证书路径：/etc/letsencrypt/live/growlog.club/"
echo "自动续期：已启用 (certbot.timer)"
echo ""
echo "如需查看证书状态："
echo "  sudo certbot certificates"

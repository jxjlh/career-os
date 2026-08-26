#!/bin/bash
set -e

echo "===== Step 1: 更新系统并安装依赖 ====="
sudo apt-get update -y && sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release git nginx software-properties-common

echo ""
echo "===== Step 2: 安装 Docker ====="
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER

echo ""
echo "===== Step 3: 安装 Docker Compose ====="
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker compose version

echo ""
echo "===== Step 4: 创建项目目录 ====="
sudo mkdir -p /opt/ai-life-os
cd /opt/ai-life-os

echo ""
echo "===== Step 5: 创建环境变量文件 .env ====="
sudo tee .env > /dev/null << 'EOF'
APP_ENV=production
API_PREFIX=/api/v1
PORT=8000

SUPABASE_URL=https://odthfgmjgutpsfjkmvto.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kdGhmZ21qZ3V0cHNmamttdnRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0NjIxNTcsImV4cCI6MjEwMTAzODE1N30.ORovjxkwm74Jpc-_cp6oK60k16--WF6ttcKqzobRkbE
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kdGhmZ21qZ3V0cHNmamttdnRvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQ2MjE1NywiZXhwIjoyMTAxMDM4MTU3fQ.s3UL2Jpi7eMmE9AAh5d08WuDzNcUsSupjOu8ja81KNQ
SUPABASE_JWKS_URL=https://odthfgmjgutpsfjkmvto.supabase.co/auth/v1/.well-known/jwks.json

XFYUN_API_KEY=309bcffee01285f0b319e2e7a72a0dca
XFYUN_API_SECRET=OTBjMmY5ZmUxZTI1MjAwMjMwM2ZjMTU4
XFYUN_APP_ID=a1ff432b
SPARK_MODEL=Spark-Lite
SPARK_WS_URL=wss://spark-api.xf-yun.com/v1.1/chat
SPARK_DOMAIN=lite

OPENAI_API_KEY=sk-ws-H.EPRHMDI.hFq6.MEUCIQCkmDdebYtzTWkkhOMHUtXFzMhbM6e6wPBAbGMz0vyWaAIgfmj_5Z5ZU2UOf3fwhXd6SGapQbrNSQ2TW90hQVFvf6U
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
FINANCE_OCR_MODEL=qwen3.5-ocr

FINANCE_AI_API_KEY=sk-d67c849d7d04426fb797826f918dd9c9
FINANCE_AI_BASE_URL=https://api.deepseek.com/v1
FINANCE_AI_MODEL=deepseek-chat
EOF

echo ""
echo "===== Step 6: 创建 docker-compose.yml ====="
sudo tee docker-compose.yml > /dev/null << 'EOF'
version: "3.9"

services:
  api:
    image: ghcr.io/liheng/ai-life-os-api:latest
    build:
      context: ./build
      dockerfile: Dockerfile
    container_name: ai-life-os-api
    restart: unless-stopped
    ports:
      - "8000:8000"
    env_file:
      - .env
    environment:
      - APP_ENV=production
      - PORT=8000
    volumes:
      - api-data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  api-data:
EOF

echo ""
echo "===== Step 7: 创建 Nginx 配置 ====="
sudo tee /etc/nginx/sites-available/ai-life-os > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/ai-life-os /etc/nginx/sites-enabled/ai-life-os
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
sudo systemctl enable nginx

echo ""
echo "===== Step 8: 准备构建上下文（从 GitHub 拉代码并构建） ====="
sudo mkdir -p /opt/ai-life-os/build

echo ""
echo "===== Docker 和 Nginx 安装完成！ ====="
echo "下一步："
echo "  1. 运行: newgrp docker   # 让 docker 组生效"
echo "  2. 然后执行部署脚本 02-build-and-deploy.sh 构建镜像并启动"
echo ""
echo "服务器信息："
echo "  IP: $(hostname -I | awk '{print $1}')"
echo "  API: http://$(hostname -I | awk '{print $1}'):8000/health"

#!/bin/bash
set +e
cd /opt/ai-life-os

echo "=== 启动容器 ==="
sg docker -c 'docker compose up -d api 2>&1'
echo "STARTED"
sleep 5
sg docker -c 'docker compose ps 2>&1'

echo ""
echo "=== 等待 health check ==="
for i in $(seq 1 20); do
  sleep 5
  STATUS=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/health 2>/dev/null || echo '000')
  echo "[$i] health: $STATUS"
  if [ "$STATUS" = "200" ]; then
    echo "HEALTHY"
    curl -s http://127.0.0.1:8000/health
    echo
    break
  fi
done

echo ""
echo "=== 容器日志 ==="
sg docker -c 'docker compose logs --tail 30 api 2>&1'

echo ""
echo "=== 外网验证 ==="
echo -n "port 8000: "
curl -s -o /dev/null -w '%{http_code}' http://124.223.183.102:8000/health 2>/dev/null || echo FAIL
echo
echo -n "nginx port 80: "
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/health 2>/dev/null || echo FAIL
echo
echo "ALLDONE"

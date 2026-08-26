#!/bin/bash
echo "=== nginx error log (recent 30 lines) ==="
sudo tail -30 /var/log/nginx/error.log

echo "---"
echo "=== nginx worker_connections ==="
sudo nginx -T 2>&1 | grep -E 'worker_|keepalive|proxy_' | head -30

echo "---"
echo "=== container status ==="
sudo docker ps --filter name=ai-life-os-api --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

echo "---"
echo "=== concurrent test - direct backend ==="
for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -s -o /dev/null -w "req$i: %{http_code} %{time_total}s\n" -H 'Authorization: Bearer dev' http://127.0.0.1:8000/api/v1/skills/matrix &
done
wait

echo "---"
echo "=== concurrent test - via Nginx HTTPS ==="
for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -s -o /dev/null -w "req$i: %{http_code} %{time_total}s\n" -H 'Authorization: Bearer dev' -k --resolve growlog.club:443:127.0.0.1 https://growlog.club/api/v1/skills/matrix &
done
wait

echo "---"
echo "=== ulimit ==="
ulimit -n

echo "---"
echo "=== nginx process limits ==="
NGINX_PID=$(pgrep -f 'nginx: master' | head -1)
if [ -n "$NGINX_PID" ]; then
  sudo cat /proc/$NGINX_PID/limits 2>&1 | grep -i 'open\|process' | head -5
fi

echo "---"
echo "=== container logs - recent 30 lines ==="
sudo docker logs ai-life-os-api --tail 30 2>&1

echo "---"
echo "=== Supabase Storage bucket test ==="
curl -s -o /dev/null -w "avatars_bucket: %{http_code}\n" "https://odthfgmjgutpsfjkmvto.supabase.co/storage/v1/object/list/avatars"

echo "SCRIPT_EXIT_OK"

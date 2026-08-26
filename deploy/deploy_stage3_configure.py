#!/usr/bin/env python3
"""部署第三阶段：修复 Dockerfile（健康检查）+ git clone + 构建部署 + 恢复技能"""
import pexpect
import sys

HOST = "124.223.183.102"
USER = "ubuntu"
PASSWORD = "LH040828@"
PROMPT = r"ubuntu@VM-0-5-ubuntu:.*\$ "

def run_cmd(child, cmd, timeout=600):
    print(f"\n{'='*60}")
    print(f"▶ {cmd[:100]}")
    print(f"{'='*60}")
    child.sendline(cmd)
    child.expect(PROMPT, timeout=timeout)
    output = child.before if isinstance(child.before, str) else child.before.decode("utf-8", errors="replace")
    lines = output.splitlines()
    if lines:
        lines = lines[1:]
    result = "\n".join(lines).strip()
    # 只打印最后30行，避免输出过长
    out_lines = result.splitlines()
    if len(out_lines) > 30:
        print("\n".join(out_lines[:10]))
        print(f"... 已截断 {len(out_lines)-20} 行 ...")
        print("\n".join(out_lines[-20:]))
    else:
        print(result)
    return result

def sudo_run(child, cmd, timeout=180):
    print(f"\n{'='*60}")
    print(f"▶ sudo: {cmd[:100]}")
    print(f"{'='*60}")
    child.sendline(f"sudo -p 'SUDO_ASK::' {cmd}")
    i = child.expect([r"SUDO_ASK::", PROMPT, pexpect.TIMEOUT], timeout=timeout)
    if i == 0:
        child.sendline(PASSWORD)
        child.expect(PROMPT, timeout=timeout)
    output = child.before if isinstance(child.before, str) else child.before.decode("utf-8", errors="replace")
    lines = output.splitlines()
    if lines:
        lines = lines[1:]
    result = "\n".join(lines).strip()
    print(result)
    return result

def main():
    print(f"🚀 连接 {USER}@{HOST} ...")
    child = pexpect.spawn(
        f"ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {USER}@{HOST}",
        encoding="utf-8",
        timeout=30
    )
    i = child.expect([r"[Pp]assword:", PROMPT, pexpect.TIMEOUT])
    if i == 0:
        child.sendline(PASSWORD)
        child.expect(PROMPT, timeout=30)
    print("✅ 已连接")

    # ===== 1. 先看 Nginx 配置 =====
    sudo_run(child, "cat /etc/nginx/sites-available/ai-life-os")

    # ===== 2. 备份 DB（从 src-old 复制 career_os.db 到安全位置） =====
    run_cmd(child, "cp /opt/ai-life-os/src-old/career_os.db /opt/ai-life-os/career_os.db.backup.$(date +%Y%m%d%H%M) 2>/dev/null; ls -la /opt/ai-life-os/*.backup.* 2>/dev/null || echo '备份完成或无DB文件'")

    # ===== 3. 删除旧 src，git clone 最新 GitHub 代码 =====
    run_cmd(child, "cd /opt/ai-life-os && rm -rf src && git clone --depth 1 https://github.com/jxjlh/career-os.git src", timeout=240)
    run_cmd(child, "cd /opt/ai-life-os/src && git log --oneline -3 && echo '---' && ls apps/api/Dockerfile && echo '---目录结构---' && ls -la")

    # ===== 4. 复制 DB 回去 =====
    run_cmd(child, "if [ -f /opt/ai-life-os/career_os.db.backup.* ]; then cp /opt/ai-life-os/career_os.db.backup.* /opt/ai-life-os/src/apps/api/career_os.db && echo '已恢复 career_os.db'; elif [ -f /opt/ai-life-os/src-old/career_os.db ]; then cp /opt/ai-life-os/src-old/career_os.db /opt/ai-life-os/src/apps/api/career_os.db && echo '从 src-old 恢复 career_os.db'; else echo '⚠️ 未找到 DB 备份文件'; fi")
    run_cmd(child, "ls -la /opt/ai-life-os/src/apps/api/*.db 2>/dev/null || echo '无 .db 文件'")

    # ===== 5. 修复 Dockerfile：安装 curl（健康检查需要）=====
    run_cmd(child, "cat /opt/ai-life-os/src/apps/api/Dockerfile")
    run_cmd(child, """cat > /tmp/patch_dockerfile.py << 'PYEOF'
import re
with open('/opt/ai-life-os/src/apps/api/Dockerfile','r') as f:
    content = f.read()
# 在 apt-get install 那行加 curl
if 'apt-get install' in content:
    content = content.replace(
        'apt-get install -y --no-install-recommends',
        'apt-get install -y --no-install-recommends curl'
    )
else:
    # 在 RUN 后面添加一行安装 curl
    content = content.replace(
        'RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \\\n    --mount=type=cache,target=/var/lib/apt,sharing=locked \\\n    apt-get update && \\\n    apt-get install -y --no-install-recommends ca-certificates && \\\n',
        'RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \\\n    --mount=type=cache,target=/var/lib/apt,sharing=locked \\\n    apt-get update && \\\n    apt-get install -y --no-install-recommends ca-certificates curl && \\\n'
    )
with open('/opt/ai-life-os/src/apps/api/Dockerfile','w') as f:
    f.write(content)
print('Dockerfile 已添加 curl')
PYEOF
python3 /tmp/patch_dockerfile.py""")
    run_cmd(child, "echo '---修复后 Dockerfile---' && cat /opt/ai-life-os/src/apps/api/Dockerfile")

    # ===== 6. 修复 Nginx：proxy_pass 指向本地 8000，不是 Render =====
    sudo_run(child, """cat > /tmp/nginx_patch.py << 'PYEOF'
path = '/etc/nginx/sites-available/ai-life-os'
with open(path,'r') as f:
    content = f.read()
print('原 Nginx 内容前15行:')
print('\\n'.join(content.splitlines()[:15]))
# 把 Render 域名替换成本地 Docker
old = 'https://ai-life-os-api-4y3x.onrender.com'
new = 'http://127.0.0.1:8000'
changed = old in content
content = content.replace(old, new)
# 去掉多余的 proxy_ssl_server_name 和 ssl Host header
content = content.replace('    proxy_ssl_server_name on;\\n', '')
content = content.replace('proxy_set_header Host ai-life-os-api-4y3x.onrender.com;', 'proxy_set_header Host $host;')
with open(path,'w') as f:
    f.write(content)
if changed:
    print(f'✅ 已替换: {old} → {new}')
else:
    print('⚠️ Nginx 中未找到 Render 域名，跳过')
PYEOF
python3 /tmp/nginx_patch.py""")
    sudo_run(child, "echo '---修复后 Nginx---' && cat /etc/nginx/sites-available/ai-life-os && nginx -t 2>&1 && echo 'Nginx 配置检查通过'")

    print("\n\n=== ✅ 第三阶段（代码拉取+配置修复）完成 ===")
    print("继续执行第四阶段：构建 Docker + 恢复技能 + 重启")
    child.close()

if __name__ == "__main__":
    main()

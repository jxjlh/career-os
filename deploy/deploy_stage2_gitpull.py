#!/usr/bin/env python3
"""部署第二阶段：查看 Nginx 配置 + 诊断容器 + 初始化 git 仓库 + git pull"""
import pexpect
import sys

HOST = "124.223.183.102"
USER = "ubuntu"
PASSWORD = "LH040828@"
PROMPT = r"(ubuntu@VM-0-5-ubuntu:~|ubuntu@VM-0-5-ubuntu:/opt/ai-life-os/src)\$ "

def run_cmd(child, cmd, timeout=300):
    print(f"\n{'='*60}")
    print(f"▶ {cmd}")
    print(f"{'='*60}")
    child.sendline(cmd)
    child.expect(PROMPT, timeout=timeout)
    output = child.before if isinstance(child.before, str) else child.before.decode("utf-8", errors="replace")
    lines = output.splitlines()
    if lines:
        lines = lines[1:]  # skip command echo
    result = "\n".join(lines).strip()
    print(result)
    return result

def sudo_run(child, cmd, timeout=180):
    print(f"\n{'='*60}")
    print(f"▶ sudo: {cmd}")
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
    i = child.expect([r"[Pp]assword:", r"\$ ", pexpect.TIMEOUT])
    if i == 0:
        child.sendline(PASSWORD)
        child.expect(PROMPT, timeout=30)
    print("✅ 已连接")

    # ===== 1. 查看 Nginx 站点配置 =====
    sudo_run(child, "cat /etc/nginx/sites-available/ai-life-os")

    # ===== 2. 查看 Docker 容器日志 =====
    sudo_run(child, "sg docker -c 'docker logs --tail 60 ai-life-os-api' 2>&1")
    sudo_run(child, "sg docker -c 'docker inspect ai-life-os-api --format \"{{json .State.Health}}\"' 2>&1")

    # ===== 3. 初始化 git 仓库并拉取 GitHub 最新代码 =====
    run_cmd(child, "cd /opt/ai-life-os/src && ls -la | head -15")
    run_cmd(child, "cd /opt/ai-life-os/src && cat pyproject.toml 2>/dev/null | head -5 && echo '---' && cat Dockerfile 2>/dev/null | head -5")

    # 备份 src 到 src-old（保留数据），然后 git clone 最新代码
    run_cmd(child, "cd /opt/ai-life-os && if [ ! -d src-old ]; then cp -a src src-old && echo '已备份 src → src-old'; else echo 'src-old 已存在，跳过备份'; fi")
    run_cmd(child, "cd /opt/ai-life-os && ls -la | grep src")

    # 检查 git 是否可用
    run_cmd(child, "which git && git --version")

    # 删除 src 后重新 git clone
    run_cmd(child, "cd /opt/ai-life-os && rm -rf src && git clone --depth 1 https://github.com/jxjlh/career-os.git src", timeout=180)
    run_cmd(child, "cd /opt/ai-life-os/src && ls -la | head -15 && echo '---' && git log --oneline -3")

    # ===== 4. 检查 docker-compose.yml 和 .env =====
    run_cmd(child, "cd /opt/ai-life-os && cat docker-compose.yml && echo '--- ENV ---' && cat .env")

    print("\n\n=== ✅ 第二阶段完成 ===")
    child.close()

if __name__ == "__main__":
    main()

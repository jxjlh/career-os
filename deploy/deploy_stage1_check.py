#!/usr/bin/env python3
"""部署脚本：SSH 登录服务器，检查状态并 git pull + 修复 Nginx + 恢复技能数据"""
import pexpect
import sys
import time

HOST = "124.223.183.102"
USER = "ubuntu"
PASSWORD = "LH040828@"
PROMPT = r"\$ "

def run_cmd(child, cmd, timeout=120):
    """执行命令并返回输出"""
    print(f"\n{'='*60}")
    print(f"▶ 执行: {cmd}")
    print(f"{'='*60}")
    child.sendline(cmd)
    child.expect(PROMPT, timeout=timeout)
    output = child.before if isinstance(child.before, str) else child.before.decode("utf-8", errors="replace")
    # 去掉回显的命令本身
    lines = output.splitlines()
    if lines and cmd in lines[0]:
        lines = lines[1:]
    result = "\n".join(lines).strip()
    print(result)
    return result

def sudo_run(child, cmd, timeout=120):
    """执行 sudo 命令（自动输入密码）"""
    print(f"\n{'='*60}")
    print(f"▶ sudo: {cmd}")
    print(f"{'='*60}")
    child.sendline(f"sudo -p 'SUDO_PROMPT::' {cmd}")
    i = child.expect([r"SUDO_PROMPT::", PROMPT, pexpect.TIMEOUT], timeout=timeout)
    if i == 0:
        child.sendline(PASSWORD)
        child.expect(PROMPT, timeout=timeout)
    output = child.before if isinstance(child.before, str) else child.before.decode("utf-8", errors="replace")
    lines = output.splitlines()
    result = "\n".join(lines).strip()
    print(result)
    return result

def main():
    print(f"🚀 连接到 {USER}@{HOST} ...")
    child = pexpect.spawn(
        f"ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {USER}@{HOST}",
        encoding="utf-8",
        timeout=30
    )

    i = child.expect([r"[Pp]assword:", r"\$ ", pexpect.TIMEOUT, r"Permission denied"])
    if i == 0:
        print("🔑 输入密码...")
        child.sendline(PASSWORD)
        child.expect(PROMPT, timeout=30)
    elif i == 1:
        print("✅ 已通过密钥登录")
    elif i == 3:
        print("❌ 密码错误！")
        sys.exit(1)
    else:
        print("❌ 连接超时或失败")
        print(child.before)
        sys.exit(1)

    print("✅ SSH 连接成功")

    # ===== 步骤 1: 检查服务器当前状态 =====
    run_cmd(child, "pwd && hostname && whoami")
    run_cmd(child, "ls -la /opt/ai-life-os/ 2>/dev/null || echo '目录不存在'")
    sudo_run(child, "sg docker -c 'docker ps -a --format \"table {{.Names}}\\t{{.Status}}\\t{{.Ports}}\"'")
    run_cmd(child, "ls -la /etc/nginx/sites-enabled/ 2>/dev/null; ls -la /etc/nginx/conf.d/ 2>/dev/null")
    sudo_run(child, "cat /etc/nginx/sites-enabled/growlog.club 2>/dev/null | head -80 || echo '站点配置不存在，检查其他路径'")
    sudo_run(child, "cat /etc/nginx/nginx.conf 2>/dev/null | tail -40")

    # ===== 步骤 2: 检查源码目录和 git 状态 =====
    run_cmd(child, "if [ -d /opt/ai-life-os/src ]; then cd /opt/ai-life-os/src && pwd && git status --short --branch && git remote -v; else echo 'src目录不存在，检查其他位置'; fi")

    # ===== 步骤 3: 尝试 git pull =====
    run_cmd(child, "if [ -d /opt/ai-life-os/src ]; then cd /opt/ai-life-os/src && git fetch origin && git status --short --branch; else echo '跳过'; fi")

    print("\n\n=== ✅ 第一阶段检查完成 ===")
    child.sendline("echo STAGE1_DONE")
    child.expect(PROMPT)
    child.close()

if __name__ == "__main__":
    main()

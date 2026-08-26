#!/usr/bin/env python3
"""部署第四阶段：恢复 src-old + 修复 Dockerfile（curl + healthcheck）+ 构建重启 + 恢复技能"""
import pexpect
import sys

HOST = "124.223.183.102"
USER = "ubuntu"
PASSWORD = "LH040828@"
PROMPT = r"ubuntu@VM-0-5-ubuntu:.*\$ "

def run_cmd(child, cmd, timeout=600):
    print(f"\n{'='*60}")
    print(f"▶ {cmd[:120]}")
    print(f"{'='*60}")
    child.sendline(cmd)
    child.expect(PROMPT, timeout=timeout)
    output = child.before if isinstance(child.before, str) else child.before.decode("utf-8", errors="replace")
    lines = output.splitlines()
    if lines:
        lines = lines[1:]
    result = "\n".join(lines).strip()
    out_lines = result.splitlines()
    if len(out_lines) > 40:
        print("\n".join(out_lines[:15]))
        print(f"... 截断 {len(out_lines)-30} 行 ...")
        print("\n".join(out_lines[-15:]))
    else:
        print(result)
    return result

def sudo_run(child, cmd, timeout=300):
    print(f"\n{'='*60}")
    print(f"▶ sudo: {cmd[:120]}")
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

    # ===== 1. 恢复 src-old 为 src（GitHub clone 失败） =====
    run_cmd(child, "cd /opt/ai-life-os && ls -la src-old 2>/dev/null | head -3 && ls -la src 2>/dev/null | head -3 || echo 'src不存在'")
    run_cmd(child, "cd /opt/ai-life-os && if [ ! -d src/apps ]; then mv src src-empty 2>/dev/null; mv src-old src && echo '✅ 已用 src-old 恢复 src'; else echo 'src 已存在且有 apps 目录'; fi")
    run_cmd(child, "cd /opt/ai-life-os/src && ls apps/api/Dockerfile && ls apps/api/career_os.db 2>/dev/null || echo '⚠️ career_os.db 不存在'")

    # 如果没有 db，从备份恢复
    run_cmd(child, "cd /opt/ai-life-os/src/apps/api && if [ ! -f career_os.db ]; then ls /opt/ai-life-os/*.backup.* 2>/dev/null && cp /opt/ai-life-os/career_os.db.backup.* career_os.db && echo '✅ 从备份恢复 DB'; else echo 'DB 已存在'; fi && ls -la career_os.db")

    # ===== 2. 尝试 git clone（HTTP/1.1，禁用 HTTP/2） =====
    run_cmd(child, "cd /opt/ai-life-os/src && git init 2>/dev/null; git remote remove origin 2>/dev/null; git remote add origin https://github.com/jxjlh/career-os.git; git -c http.version=HTTP/1.1 fetch --depth 1 origin master 2>&1 | tail -20", timeout=180)

    # ===== 3. 修复 Dockerfile：安装 curl + 健康检查用 python wget 兜底 =====
    run_cmd(child, "cat /opt/ai-life-os/src/apps/api/Dockerfile")

    # 直接写一个修复版本的 Dockerfile
    run_cmd(child, r"""cat > /tmp/fix_dockerfile.py << 'PYEOF'
path = '/opt/ai-life-os/src/apps/api/Dockerfile'
with open(path,'r') as f:
    c = f.read()

# 1. apt-get install 行追加 curl
if 'apt-get install' in c:
    c = c.replace(
        'apt-get install -y --no-install-recommends ca-certificates',
        'apt-get install -y --no-install-recommends ca-certificates curl'
    )
# 2. 检查 HEALTHCHECK，如果是 curl 且没有 fallback，添加 wget/python 兜底
if 'HEALTHCHECK' in c:
    # 保留现有 HEALTHCHECK，但替换 curl 命令为更安全的
    import re
    # 替换 curl URL 为 python 版本健康检查（更可靠）
    new_hc = (
        'HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \\\n'
        '  CMD python -c "import urllib.request,sys; \\\\\n'
        '      r=urllib.request.urlopen(\\\"http://127.0.0.1:8000/health\\\",timeout=5); \\\\\n'
        '      sys.exit(0 if r.status==200 else 1)" || exit 1'
    )
    c = re.sub(r'HEALTHCHECK --interval=.*?exit 1', new_hc, c, flags=re.DOTALL)
else:
    # 在 EXPOSE/CMD 前插入一个 HEALTHCHECK
    c = c + '\n\n' + (
        'HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \\\n'
        '  CMD python -c "import urllib.request,sys; \\\\\n'
        '      r=urllib.request.urlopen(\\\"http://127.0.0.1:8000/health\\\",timeout=5); \\\\\n'
        '      sys.exit(0 if r.status==200 else 1)" || exit 1\n'
    )

with open(path,'w') as f:
    f.write(c)
print('✅ Dockerfile 已修复')
print('---修复后 HEALTCHECK 相关部分---')
for i, line in enumerate(c.splitlines()):
    if 'HEALTH' in line or 'install' in line or 'curl' in line or 'CMD python' in line:
        print(f'{i+1}: {line}')
PYEOF
python3 /tmp/fix_dockerfile.py""")

    # ===== 4. 构建 Docker 镜像 =====
    run_cmd(child, "cd /opt/ai-life-os && cat docker-compose.yml")
    run_cmd(child, "cd /opt/ai-life-os && rm -rf build && mkdir -p build && cp -r src/apps/api/* build/ && ls build/ | head -15")

    print("\n⏳ 开始构建 Docker 镜像（约 3-10 分钟）...")
    sudo_run(child, "cd /opt/ai-life-os && sg docker -c 'docker compose build --no-cache api 2>&1'", timeout=900)
    sudo_run(child, "cd /opt/ai-life-os && sg docker -c 'docker compose up -d api 2>&1'")
    sudo_run(child, "sg docker -c 'docker ps -a --format \"table {{.Names}}\\t{{.Status}}\\t{{.Ports}}\"'")

    # ===== 5. 等服务启动，验证健康检查 =====
    run_cmd(child, "echo '等 20s 让服务启动...' && sleep 20")
    sudo_run(child, "sg docker -c 'docker logs --tail 40 ai-life-os-api 2>&1'")
    run_cmd(child, "curl -s --connect-timeout 5 http://127.0.0.1:8000/health && echo '' && curl -s --connect-timeout 5 http://127.0.0.1:8000/ready 2>&1")

    # ===== 6. 恢复 user_skills 数据 =====
    print("\n⏳ 恢复 user_skills 技能矩阵数据...")
    restore_script = r'''
import sys, os
sys.path.insert(0, '/app')
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.models import Skill, UserSkill, Profile
from app.core.config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

SEED = [
    ("Marketing", "Marketing", "品牌与营销基础"),
    ("Growth", "Growth Marketing", "增长营销与 A/B 测试"),
    ("Data", "SQL", "数据分析查询"),
    ("Data", "Power BI", "数据可视化"),
    ("Data", "Python", "数据处理与自动化"),
    ("Data", "GA4", "网站数据分析"),
    ("AI", "AI Agent", "智能体应用开发"),
    ("Marketing", "Product Marketing", "产品上市与定位"),
    ("Ops", "Marketing Ops", "营销运营与自动化"),
    ("CRM", "HubSpot", "CRM 管理与自动化"),
    ("Engineering", "System Design", "系统设计"),
    ("Product", "Product Planning", "产品规划"),
]

# 找第一个用户
user = db.query(Profile).first()
if not user:
    print('❌ 没有用户 profile')
    sys.exit(1)
print(f'目标用户: id={user.id}, email={user.email}')

added, skipped = [], []
for category, name, desc in SEED:
    skill = db.query(Skill).filter(Skill.name == name).first()
    if skill is None:
        skill = Skill(name=name, category=category, description=desc)
        db.add(skill); db.flush()
        print(f'  + 新增 Skill: {name}')
    us = db.query(UserSkill).filter(UserSkill.user_id==user.id, UserSkill.skill_id==skill.id).first()
    if us:
        skipped.append(name)
    else:
        db.add(UserSkill(user_id=user.id, skill_id=skill.id, current_level=1, target_level=5, confidence=0.5, learning_status='learning'))
        added.append(name)
db.commit()
print(f'✅ 完成: 新增 {len(added)} 个技能关联, 跳过 {len(skipped)} 个')
print('新增:', added)
print('跳过:', skipped)
'''
    # 写脚本到文件
    run_cmd(child, f"cat > /tmp/restore_skills.py << 'PYEOF_SKILLS'\n{restore_script}\nPYEOF_SKILLS\necho '✅ 写入 restore_skills.py'")
    sudo_run(child, "sg docker -c 'docker cp /tmp/restore_skills.py ai-life-os-api:/tmp/restore_skills.py' 2>&1")
    sudo_run(child, "sg docker -c 'docker exec ai-life-os-api python /tmp/restore_skills.py 2>&1'")

    # ===== 7. reload Nginx（确保配置生效）=====
    sudo_run(child, "nginx -t 2>&1 && systemctl reload nginx 2>&1 && echo '✅ Nginx 已 reload'")

    print("\n" + "="*60)
    print("🎉 第四阶段完成")
    print("="*60)
    child.close()

if __name__ == "__main__":
    main()

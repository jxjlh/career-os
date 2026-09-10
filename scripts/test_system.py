#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CareerOS 系统全功能测试脚本
================================
测试目标：https://124.223.183.102（growlog.club）

覆盖范围：
  1. 前端页面路由可用性
  2. 前端静态资源加载
  3. 后端健康检查（/health、/ready）
  4. 后端功能接口存在性（planner / journal-companion / journal / finance / library …）
  5. 认证机制（Supabase 配置 / 开发模式检测）
  6. 核心功能点（每日小记、周计划、AI 情绪/听见、座右铭、搜索）

运行方式：
  python3 scripts/test_system.py            # 输出控制台报告
  python3 scripts/test_system.py --md       # 额外输出 Markdown 测试报告到 outputs/
  python3 scripts/test_system.py --html     # 额外输出 HTML 测试报告到 outputs/

无第三方依赖，仅用 Python 标准库。
"""

import ssl
import sys
import os
import time
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

BASE = os.environ.get("CAREER_OS_BASE", "https://124.223.183.102").rstrip("/")

# 忽略自签名证书（测试环境）
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

RESULTS = []  # {name, group, pass, detail, status, latency_ms}


def http(method, path, headers=None, body=None, timeout=15):
    """发起 HTTP 请求，返回 (status, body_text)。"""
    url = BASE + path
    data = body.encode("utf-8") if isinstance(body, str) else body
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        t0 = time.time()
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
            return r.status, r.read().decode("utf-8", "ignore"), (time.time() - t0) * 1000
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "ignore"), (time.time() - t0) * 1000
    except Exception as e:
        return 0, str(e), (time.time() - t0) * 1000


def record(group, name, ok, detail, status=None, latency=None):
    RESULTS.append({
        "group": group,
        "name": name,
        "pass": bool(ok),
        "detail": detail,
        "status": status,
        "latency_ms": round(latency) if latency is not None else None,
    })


# ============================================================================
# 1. 前端页面路由
# ============================================================================
FRONTEND_ROUTES = [
    "/", "/dashboard/", "/login/", "/signup/",
    "/journal/", "/journal/companion/", "/planner/",
    "/finance/", "/library/", "/settings/",
    "/life/", "/career/", "/skills/", "/explore/",
]


def test_frontend_routes():
    for route in FRONTEND_ROUTES:
        status, body, lat = http("GET", route)
        ok = status == 200
        # 检测是否返回了前端 SPA 骨架（含 Next.js 标记）
        is_spa = "_next/static" in body or "CareerOS" in body
        record("前端路由", route, ok and is_spa,
               f"HTTP {status}" + ("" if is_spa else "（非 SPA 骨架）"), status, lat)


# ============================================================================
# 2. 前端静态资源
# ============================================================================
def test_static_assets():
    # 首页引用的 CSS 指纹
    status, html, _ = http("GET", "/")
    import re
    css = re.findall(r'/_next/static/css/[a-z0-9]+\.css', html)
    js = re.findall(r'/_next/static/chunks/[a-zA-Z0-9/_.-]+\.js', html)

    record("静态资源", "首页 CSS 引用", len(css) > 0,
           f"发现 {len(css)} 个 CSS：" + (css[0] if css else "无"), 200 if len(css) else None)

    for path in css[:3]:
        s, body, lat = http("GET", path)
        record("静态资源", f"CSS 可访问 {path.split('/')[-1]}", s == 200 and len(body) > 0,
               f"HTTP {s}, {len(body)} bytes", s, lat)

    for path in js[:3]:
        s, body, lat = http("GET", path)
        record("静态资源", f"JS 可访问 {path.split('/')[-1]}", s == 200 and len(body) > 0,
               f"HTTP {s}, {len(body)} bytes", s, lat)


# ============================================================================
# 3. 后端健康检查
# ============================================================================
def test_health():
    for ep in ["/health", "/ready"]:
        s, body, lat = http("GET", ep)
        ok = s == 200
        detail = f"HTTP {s}"
        try:
            j = json.loads(body)
            detail += f" → {json.dumps(j, ensure_ascii=False)[:120]}"
        except Exception:
            detail += f" → {body[:80]}"
        record("健康检查", ep, ok, detail, s, lat)


# ============================================================================
# 4. 后端功能接口存在性
#    （401/405/422 = 接口存在但需认证/参数；404 = 接口缺失）
# ============================================================================
API_PROBES = [
    # (method, path, body)
    ("GET", "/api/v1/planner/current", None),
    ("GET", "/api/v1/planner/progress", None),
    ("POST", "/api/v1/planner/generate", "{}"),
    ("GET", "/api/v1/ai/journal-companion/mirror?date=2026-09-10", None),
    ("GET", "/api/v1/ai/journal-companion/weather?days=7", None),
    ("GET", "/api/v1/ai/journal-companion/patterns", None),
    ("POST", "/api/v1/ai/journal-companion/hear", '{"journals":[]}'),
    ("POST", "/api/v1/ai/journal-companion/chat",
     '{"session_id":null,"mode":"chat","message":"hello"}'),
    ("GET", "/api/v1/journal/entries", None),
    ("GET", "/api/v1/finance/accounts", None),
    ("GET", "/api/v1/library/bookmarks", None),
]


def test_api_existence():
    dev_headers = {"Authorization": "Bearer dev", "Content-Type": "application/json"}
    for method, path, body in API_PROBES:
        s, resp, lat = http(method, path, headers=dev_headers, body=body)
        # 404 = 接口缺失；其余状态（401 认证失败、422 参数错误、405 方法不允许）都说明路由存在
        exists = s != 404
        record("接口存在性", f"{method} {path}",
               exists, f"HTTP {s}（{'存在' if exists else '缺失'}）", s, lat)


# ============================================================================
# 5. 认证机制 / 开发模式检测
# ============================================================================
def test_auth():
    # 5.1 登录页可访问
    s, body, lat = http("GET", "/login/")
    record("认证", "登录页可访问", s == 200, f"HTTP {s}", s, lat)

    # 5.2 前端是否已内联 Supabase 配置（开发模式检测）
    _, html, _ = http("GET", "/")
    import re
    js_chunks = re.findall(r'/_next/static/chunks/[a-zA-Z0-9/_.-]+\.js', html)
    supabase_inlined = False
    checked = 0
    for chunk in js_chunks[:20]:
        _, body, _ = http("GET", chunk)
        checked += 1
        if "supabase.co" in body:
            supabase_inlined = True
            break
    record("认证", "前端已内联 Supabase 配置（非开发模式）", supabase_inlined,
           f"扫描 {checked} 个 JS 分片，" + ("发现 supabase.co" if supabase_inlined else "未发现 supabase.co（仍为开发模式）"))

    # 5.3 dev token 应被拒绝（后端用 Supabase JWT）
    s, resp, lat = http("GET", "/api/v1/planner/current", headers={"Authorization": "Bearer dev"})
    is_rejected = s in (401, 403)
    record("认证", "非法 token 被后端拒绝", is_rejected,
           f"HTTP {s}（{'正确拒绝' if is_rejected else '异常：未拒绝'}）", s, lat)


# ============================================================================
# 6. 核心功能点
# ============================================================================
def test_core_features():
    # 6.1 每日小记 —— dashboard 应渲染每日小记（组件已恢复）
    s, html, lat = http("GET", "/dashboard/")
    has_daily = ("每日小记" in html) or ("daily" in html.lower())
    record("核心功能", "主页渲染每日小记", has_daily,
           f"HTTP {s}，" + ("检测到每日小记" if has_daily else "未检测到每日小记（可能为客户端渲染）"), s, lat)

    # 6.2 座右铭 —— dashboard 应包含座右铭 Banner
    has_motto = ("座右铭" in html) or ("motto" in html.lower())
    record("核心功能", "主页包含座右铭", has_motto,
           f"HTTP {s}，" + ("检测到座右铭" if has_motto else "未检测到座右铭"), s, lat)

    # 6.3 今日动态已删除 —— dashboard 不应再有今日动态
    has_today_feed = "今日动态" in html
    record("核心功能", "主页已移除今日动态", not has_today_feed,
           f"HTTP {s}，" + ("已移除" if not has_today_feed else "仍存在今日动态"), s, lat)

    # 6.4 AI 情绪（companion）页面可访问
    s2, body2, lat2 = http("GET", "/journal/companion/")
    record("核心功能", "AI 情绪/陪伴页面可访问", s2 == 200, f"HTTP {s2}", s2, lat2)

    # 6.5 周计划页面可访问
    s3, body3, lat3 = http("GET", "/planner/")
    record("核心功能", "周计划页面可访问", s3 == 200, f"HTTP {s3}", s3, lat3)


# ============================================================================
# 报告输出
# ============================================================================
def render_summary():
    total = len(RESULTS)
    passed = sum(1 for r in RESULTS if r["pass"])
    failed = total - passed
    return total, passed, failed


def print_report():
    total, passed, failed = render_summary()
    print("=" * 72)
    print("  CareerOS 系统全功能测试报告")
    print("  目标: " + BASE)
    print("  时间: " + datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d %H:%M:%S %Z"))
    print("=" * 72)

    current_group = None
    for r in RESULTS:
        if r["group"] != current_group:
            current_group = r["group"]
            print(f"\n  [{current_group}]")
        mark = "✅" if r["pass"] else "❌"
        lat = f"  {r['latency_ms']}ms" if r["latency_ms"] is not None else ""
        print(f"    {mark} {r['name']}  —  {r['detail']}{lat}")

    print("\n" + "=" * 72)
    print(f"  总计 {total} 项 | 通过 {passed} 项 | 失败 {failed} 项")
    print(f"  通过率: {passed / total * 100:.1f}%" if total else "  无测试项")
    print("=" * 72)
    return 0 if failed == 0 else 1


def render_markdown(path):
    total, passed, failed = render_summary()
    now = datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d %H:%M:%S")
    lines = [
        "# CareerOS 系统全功能测试报告",
        "",
        f"- 测试目标：`{BASE}`",
        f"- 测试时间：{now}",
        f"- 测试项数：{total} | 通过：{passed} | 失败：{failed} | 通过率：{passed / total * 100:.1f}%" if total else "- 无测试项",
        "",
        "## 结果明细",
        "",
        "| 分组 | 测试项 | 结果 | 说明 | 状态码 | 耗时 |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for r in RESULTS:
        lines.append(
            f"| {r['group']} | {r['name']} | {'✅ 通过' if r['pass'] else '❌ 失败'} "
            f"| {r['detail']} | {r['status'] or '-'} | {r['latency_ms'] if r['latency_ms'] is not None else '-'}ms |"
        )
    lines += ["", f"**结论**：{'全部通过 🎉' if failed == 0 else f'存在 {failed} 项失败，需排查。'}", ""]
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    return path


def render_html(path):
    total, passed, failed = render_summary()
    now = datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d %H:%M:%S")
    rate = (passed / total * 100) if total else 0
    rows = []
    for r in RESULTS:
        color = "#16a34a" if r["pass"] else "#dc2626"
        rows.append(
            f"<tr><td>{r['group']}</td><td>{r['name']}</td>"
            f"<td style='color:{color};font-weight:600'>{'通过' if r['pass'] else '失败'}</td>"
            f"<td>{r['detail']}</td><td>{r['status'] or '-'}</td>"
            f"<td>{r['latency_ms'] if r['latency_ms'] is not None else '-'}</td></tr>"
        )
    html = f"""<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CareerOS 测试报告</title>
<style>
body{{font-family:-apple-system,'PingFang SC',sans-serif;margin:0;background:#EEF2FF;color:#1A1A1A}}
.wrap{{max-width:1000px;margin:32px auto;padding:0 20px}}
h1{{font-size:24px}} .meta{{color:#686868;font-size:14px}}
.cards{{display:flex;gap:16px;margin:24px 0}}
.card{{flex:1;background:#fff;border:1px solid #E2E8F0;border-radius:14px;padding:20px;text-align:center}}
.card b{{font-size:32px}} .pass b{{color:#16a34a}} .fail b{{color:#dc2626}}
table{{width:100%;border-collapse:collapse;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.04)}}
th,td{{text-align:left;padding:10px 14px;border-bottom:1px solid #EEF2FA;font-size:13px}}
th{{background:#F5F8FF;color:#686868;font-weight:600}}
</style></head><body><div class="wrap">
<h1>CareerOS 系统全功能测试报告</h1>
<p class="meta">目标：{BASE} ｜ 时间：{now}</p>
<div class="cards">
<div class="card"><div>总测试项</div><b>{total}</b></div>
<div class="card pass"><div>通过</div><b>{passed}</b></div>
<div class="card fail"><div>失败</div><b>{failed}</b></div>
<div class="card"><div>通过率</div><b>{rate:.1f}%</b></div>
</div>
<table><tr><th>分组</th><th>测试项</th><th>结果</th><th>说明</th><th>状态码</th><th>耗时(ms)</th></tr>
{''.join(rows)}
</table>
<p class="meta" style="margin-top:20px">结论：{'✅ 全部通过' if failed == 0 else f'⚠️ 存在 {failed} 项失败，需排查。'}</p>
</div></body></html>"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    return path


def main():
    out_md = "--md" in sys.argv
    out_html = "--html" in sys.argv

    print("开始测试 CareerOS ...\n")
    test_frontend_routes()
    test_static_assets()
    test_health()
    test_api_existence()
    test_auth()
    test_core_features()

    code = print_report()

    if out_md or out_html:
        os.makedirs("outputs", exist_ok=True)
        if out_md:
            p = render_markdown("outputs/test-report.md")
            print(f"\n📄 Markdown 报告已生成: {p}")
        if out_html:
            p = render_html("outputs/test-report.html")
            print(f"📄 HTML 报告已生成: {p}")

    return code


if __name__ == "__main__":
    sys.exit(main())

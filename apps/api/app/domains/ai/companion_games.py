"""AI 陪伴 · 解压小游戏引擎.

设计原则（对齐项目确定性铁律）:
    全部为确定性脚本 —— 同输入同输出，不调用大模型。
    游戏目录由服务端统一定义，前端通过 GET /ai/journal-companion/games 拉取渲染，
    避免前后端各维护一份脚本而漂移。

两类游戏:
    - guided（引导式）: 气球 / 寻宝 —— 步骤脚本固定，前端按 step 本地即时推进，零延迟
    - text（输入式）:   沙袋 / 垃圾桶 —— 用户打字，服务端按轮次给确定性回应
"""

from __future__ import annotations

from typing import Any

# ── 游戏目录 ──────────────────────────────────────────────────────────
GAMES: list[dict[str, Any]] = [
    {
        "id": "punchbag",
        "title": "文字发泄沙袋",
        "emoji": "🥊",
        "kind": "text",
        "desc": "把最烦的事打出来，乱码、感叹号、表情包轰炸都行",
        "placeholder": "尽情打，我在这里看着……",
        "hint": "这里不用讲道理，也不用体面。",
        "cta": "打出去",
    },
    {
        "id": "treasure",
        "title": "视觉寻宝",
        "emoji": "🔍",
        "kind": "guided",
        "desc": "在房间里找东西，把注意力拉回当下",
        "hint": "找到了就点一下，慢慢来。",
        "steps": [
            {
                "prompt": "请在现在的房间里，找出 3 个红色的东西。\n找到了告诉我哦！",
                "cta": "我找到 3 个红色了",
                "done": "很好！这 3 个红色，现在都真切地在你眼前。",
            },
            {
                "prompt": "再找 3 个蓝色的东西吧 👇",
                "cta": "我找到 3 个蓝色了",
                "done": "不错，眼睛已经开始扫过整个房间了。",
            },
            {
                "prompt": "最后，找 3 个摸起来让你觉得舒服的东西，什么都行。",
                "cta": "我找到了",
                "done": "很好。你现在已经回到这个房间里了 🌿",
            },
        ],
        "closing": "你做得非常好！\n注意力已经回到眼前了，感觉有没有稳一点？",
    },
    {
        "id": "balloon",
        "title": "深呼吸吹气球",
        "emoji": "🎈",
        "kind": "guided",
        "desc": "把烦恼吹进气球，然后松手让它飞走",
        "hint": "跟着节奏来，不用做对。",
        "steps": [
            {
                "prompt": "想象你手里攥着一个瘪瘪的气球。\n\n用鼻子慢慢吸气……1…2…3…4…\n把最烦的那件事吹进去。\n气球鼓起来了一点点 🫧",
                "cta": "吸气 4 秒",
                "done": "好，第一口气进去了。",
            },
            {
                "prompt": "再吸气……1…2…3…4…\n\n把那些说不清的闷、堵、累，也一起吹进去。\n气球变大了 🎈",
                "cta": "再吸一口",
                "done": "很好，它在变大。",
            },
            {
                "prompt": "最后一口气，使劲吹！\n\n把剩下所有东西都塞进去。\n气球又大又圆 🎈🎈🎈",
                "cta": "最后一吹",
                "done": "快满了。",
            },
            {
                "prompt": "现在 —— 松开手。\n\n看着它咻地一下飞走，越飞越高，越飞越远，\n变成天空里的一个小点，然后不见了。✨",
                "cta": "松手放飞",
                "done": "它不见了。",
            },
        ],
        "closing": "气球飞走了。\n现在感觉好一点了吗？要不要再来一次？",
    },
    {
        "id": "trash",
        "title": "情绪垃圾桶",
        "emoji": "🗑️",
        "kind": "text",
        "desc": "写下一种情绪，我当场扔进赛博黑洞粉碎",
        "placeholder": "比如：焦虑 / 对他的火气 / 说不清的委屈",
        "hint": "一次扔一个，扔多少都行。",
        "cta": "扔进黑洞",
    },
]

GAME_MAP: dict[str, dict[str, Any]] = {g["id"]: g for g in GAMES}

# ── 沙袋回应（按轮次轮换，确定性） ─────────────────────────────────────
PUNCHBAG_REPLIES = [
    "收到了。这里不用讲道理，也不用体面。继续打，我在看着。",
    "嗯，我都接住了。再来。",
    "好，这一下我替你挨着。还有吗？",
    "打出来了就好。继续，我哪儿也不去。",
    "我在。不用组织语言，想到什么就敲什么。",
    "嗯。这一拳算数。继续。",
]

PUNCHBAG_HEAVY_REPLY = "这一下够狠的。我接住了，一点没漏。还要继续吗？"

# ── 垃圾桶 ────────────────────────────────────────────────────────────
TRASH_REPLY = "收到！我已经把「{emotion}」扔进赛博黑洞里粉碎了。\n它现在不见了。\n\n还想再扔点什么吗？"
TRASH_EMPTY_REPLY = "收到！不管那是什么，已经扔进赛博黑洞粉碎了。\n它现在不见了。\n\n还想再扔点什么吗？"

GAME_FALLBACK_REPLY = (
    "想玩哪个？\n"
    "🥊 文字发泄沙袋 —— 把最烦的事打出来\n"
    "🔍 视觉寻宝 —— 在房间里找 3 个东西\n"
    "🎈 深呼吸吹气球 —— 把烦恼吹走\n"
    "🗑️ 情绪垃圾桶 —— 扔进赛博黑洞粉碎"
)


def get_catalog() -> list[dict[str, Any]]:
    """返回游戏目录（给前端渲染用）。"""
    return GAMES


def _is_heavy(message: str) -> bool:
    """判断这一下打得很用力：够长，或者满屏感叹号/重复字。"""
    if len(message) >= 40:
        return True
    bang = message.count("!") + message.count("！")
    if bang >= 3:
        return True
    # 连续的同一个字，例如"啊啊啊啊啊"
    for i in range(len(message) - 3):
        ch = message[i]
        if ch == message[i + 1] == message[i + 2] == message[i + 3] and ch.strip():
            return True
    return False


def run_game(game_id: str, message: str = "", step: int = 0) -> dict[str, Any]:
    """执行一步游戏，返回确定性结果。

    Args:
        game_id: 游戏 id
        message: 用户输入（text 类游戏用）
        step: 当前步序（guided 类从 0 开始；text 类表示已进行轮数）

    Returns:
        {"gameId", "reply", "step", "done"}
    """
    game = GAME_MAP.get(game_id)

    if game is None:
        return {"gameId": game_id, "reply": GAME_FALLBACK_REPLY, "step": 0, "done": False}

    # ── 引导式：按 step 取脚本 ────────────────────────────────────────
    if game["kind"] == "guided":
        steps = game["steps"]
        if step < 0:
            step = 0
        if step < len(steps):
            return {
                "gameId": game_id,
                "reply": steps[step]["prompt"],
                "step": step + 1,
                "done": False,
            }
        return {"gameId": game_id, "reply": game["closing"], "step": step, "done": True}

    # ── 输入式：沙袋 ──────────────────────────────────────────────────
    if game_id == "punchbag":
        text = (message or "").strip()
        if not text:
            return {
                "gameId": game_id,
                "reply": "打点什么吧，哪怕是乱码。我在这里看着，不评判。",
                "step": step,
                "done": False,
            }
        if _is_heavy(text):
            reply = PUNCHBAG_HEAVY_REPLY
        else:
            reply = PUNCHBAG_REPLIES[step % len(PUNCHBAG_REPLIES)]
        return {"gameId": game_id, "reply": reply, "step": step + 1, "done": False}

    # ── 输入式：情绪垃圾桶 ────────────────────────────────────────────
    if game_id == "trash":
        emotion = (message or "").strip()
        # 去掉句尾标点，截断过长输入，保证"扔进去"的东西是一句话能装下的
        emotion = emotion.rstrip("。.!！?？~～,， ")
        if len(emotion) > 16:
            emotion = emotion[:16] + "…"
        if not emotion:
            reply = TRASH_EMPTY_REPLY
        else:
            reply = TRASH_REPLY.format(emotion=emotion)
        return {"gameId": game_id, "reply": reply, "step": step + 1, "done": False}

    return {"gameId": game_id, "reply": GAME_FALLBACK_REPLY, "step": step, "done": False}

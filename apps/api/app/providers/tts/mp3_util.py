"""MP3 工具: 解析 CBR 帧头估算音频时长.

讯飞 TTS 只返回音频字节, 不返回时长。前端播放器需要一个 durationSeconds 来展示,
这里用 MPEG 帧头解析 + 文件大小做确定性估算（不引入额外依赖、不调外部服务）。

只处理 Layer III (mp3) 的 CBR 情况 —— 讯飞 lame 编码就是这种情况。
解析失败返回 None, 前端会退化到用 <audio> 的 loadedmetadata 真实时长。
"""

from __future__ import annotations

# MPEG1 Layer III 比特率表 (kbps)
_BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
# MPEG2 / MPEG2.5 Layer III 比特率表 (kbps)
_BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]

_SAMPLE_RATES = {
    3: [44100, 48000, 32000],  # MPEG1
    2: [22050, 24000, 16000],  # MPEG2
    0: [11025, 12000, 8000],   # MPEG2.5
}


def _skip_id3v2(data: bytes) -> int:
    """跳过 ID3v2 标签, 返回音频数据起始偏移."""
    if len(data) < 10 or data[0:3] != b"ID3":
        return 0
    # syncsafe integer: 每字节只用低 7 位
    size = (
        (data[6] & 0x7F) << 21
        | (data[7] & 0x7F) << 14
        | (data[8] & 0x7F) << 7
        | (data[9] & 0x7F)
    )
    return 10 + size


def mp3_duration_seconds(data: bytes) -> int | None:
    """估算 mp3 时长（秒）. 无法解析时返回 None."""
    if not data:
        return None
    offset = _skip_id3v2(data)
    audio_size = len(data) - offset
    if audio_size <= 0:
        return None

    # 扫描帧同步头 (最多看前 8KB, 避开可能的杂散字节)
    limit = min(len(data) - 4, offset + 8192)
    for i in range(offset, limit):
        if data[i] != 0xFF:
            continue
        b1 = data[i + 1]
        if (b1 & 0xE0) != 0xE0:
            continue

        version = (b1 >> 3) & 0x03   # 3=MPEG1, 2=MPEG2, 0=MPEG2.5
        layer = (b1 >> 1) & 0x03     # 1=Layer III
        if version == 1 or layer != 1:
            continue  # reserved version / 非 Layer III

        b2 = data[i + 2]
        bitrate_index = (b2 >> 4) & 0x0F
        samplerate_index = (b2 >> 2) & 0x03
        if bitrate_index == 0 or bitrate_index == 0x0F or samplerate_index == 0x03:
            continue  # free / bad / reserved

        table = _BITRATES_V1_L3 if version == 3 else _BITRATES_V2_L3
        bitrate_kbps = table[bitrate_index]
        if bitrate_kbps <= 0:
            continue

        # CBR 估算: 时长 = 音频字节数 * 8 / 比特率
        seconds = audio_size * 8 / (bitrate_kbps * 1000)
        if seconds <= 0 or seconds > 3600:  # 超过 1 小时视为解析异常
            return None
        return max(1, round(seconds))

    return None


def mp3_frame_info(data: bytes) -> dict | None:
    """返回帧头解析出的调试信息（比特率/采样率）, 解析失败返回 None."""
    offset = _skip_id3v2(data)
    limit = min(len(data) - 4, offset + 8192)
    for i in range(offset, limit):
        if data[i] != 0xFF:
            continue
        b1 = data[i + 1]
        if (b1 & 0xE0) != 0xE0:
            continue
        version = (b1 >> 3) & 0x03
        layer = (b1 >> 1) & 0x03
        if version == 1 or layer != 1:
            continue
        b2 = data[i + 2]
        bitrate_index = (b2 >> 4) & 0x0F
        samplerate_index = (b2 >> 2) & 0x03
        if bitrate_index in (0, 0x0F) or samplerate_index == 0x03:
            continue
        table = _BITRATES_V1_L3 if version == 3 else _BITRATES_V2_L3
        return {
            "version": {3: "MPEG1", 2: "MPEG2", 0: "MPEG2.5"}[version],
            "bitrate_kbps": table[bitrate_index],
            "sample_rate": _SAMPLE_RATES[version][samplerate_index],
        }
    return None

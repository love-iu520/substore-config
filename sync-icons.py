#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sync-icons.py
将 icons/ 目录下的所有图标转为 Base64 Data URI，并自动内嵌写入 scripts/mihomo-clash-party.js。
实现 100% 离线、零网络依赖、零 CDN 缓存延迟的策略组图标分发。
"""

import os
import sys
import base64
import re

# 兼容 Windows 终端的 UTF-8 打印输出
if sys.platform.startswith("win") and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# 项目路径配置
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
ICONS_DIR = os.path.join(ROOT_DIR, "icons")
JS_PATH = os.path.join(ROOT_DIR, "scripts", "mihomo-clash-party.js")

# 策略组名称与图标文件名对应表
ICON_MAPPING = {
    "Proxy": "Proxy.png",
    "机场入口": "Airport-Entry.png",
    "AI": "AI.png",

    "OpenAI": "OpenAI.png",
    "Claude": "Claude.png",
    "Gemini": "Gemini.png",

    "Google Drive": "Google-Drive.png",
    "YouTube": "YouTube.png",
    "Google": "Google.png",

    "GitHub": "GitHub.png",
    "Telegram": "Telegram.png",
    "Twitter": "Twitter.png",
    "Discord": "Discord.png",
    "Instagram": "Instagram.png",
    "Pinterest": "Pinterest.png",
    "TikTok": "TikTok.png",

    "Netflix": "Netflix.png",
    "Spotify": "Spotify.png",

    "Microsoft": "Microsoft.png",
    "Apple": "Apple.png",
    "Bilibili": "Bilibili.png",
    "国内网站": "China.png",
    "国际": "International.png",
    "GLOBAL": "GLOBAL.png",

    "香港": "Hong-Kong.png",
    "美国": "United-States.png",
    "日本": "Japan.png",
    "新加坡": "Singapore.png",
    "台湾": "Taiwan.png",
    "其它地区": "Other-Regions.png",

    "兜底策略": "Fallback.png"
}

def get_base64_data_uri(file_path):
    with open(file_path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode("ascii")
    return f"data:image/png;base64,{encoded}"

def main():
    if not os.path.exists(ICONS_DIR):
        print(f"[错误] 找不到图标目录: {ICONS_DIR}")
        return 1

    if not os.path.exists(JS_PATH):
        print(f"[错误] 找不到脚本文件: {JS_PATH}")
        return 1

    print("[1/3] 开始读取 icons/ 目录并生成 Base64 内联数据...")

    # 生成 groupIcons 的 JS 代码块
    lines = []
    lines.append("  // ===== 策略组图标 (由 sync-icons.py 自动生成，Base64 纯离线内联) =====")
    lines.append("  // 优点：100% 离线可用，零 CDN 缓存延迟，彻底杜绝外链失效。")
    lines.append("  var groupIcons = {")

    items = list(ICON_MAPPING.items())
    for idx, (group_name, file_name) in enumerate(items):
        icon_path = os.path.join(ICONS_DIR, file_name)
        if not os.path.exists(icon_path):
            print(f"  [警告] 缺少图标文件 {file_name} (策略组: {group_name})")
            continue

        data_uri = get_base64_data_uri(icon_path)
        comma = "," if idx < len(items) - 1 else ""
        lines.append(f'    "{group_name}": "{data_uri}"{comma}')
        print(f"  [OK] {group_name:<10} -> {file_name} ({len(data_uri)} 字符)")

    lines.append("  };")
    lines.append("  // ===== 策略组图标生成结束 =====")
    new_icons_block = "\n".join(lines)

    print("[2/3] 正在更新 scripts/mihomo-clash-party.js...")

    # 读取原 JS 文件
    with open(JS_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # 正则匹配并替换图标配置区域
    pattern_new = r"  // ===== 策略组图标 \(由 sync-icons\.py 自动生成.*?\n  // ===== 策略组图标生成结束 ====="
    pattern_old = r"  // ===== 策略组图标 =====.*?(?=  for \(var gi = 0; gi < proxyGroups\.length; gi\+\+\) \{)"

    if re.search(pattern_new, content, re.DOTALL):
        updated_content = re.sub(pattern_new, new_icons_block, content, flags=re.DOTALL)
    elif re.search(pattern_old, content, re.DOTALL):
        updated_content = re.sub(pattern_old, new_icons_block + "\n\n", content, flags=re.DOTALL)
    else:
        print("[错误] 无法在 scripts/mihomo-clash-party.js 中定位到 groupIcons 区域！")
        return 1

    # 写入新内容
    with open(JS_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(updated_content)

    print(f"[3/3] 同步完成！已成功将 {len(items)} 个策略组图标内嵌到 {os.path.basename(JS_PATH)}。")
    return 0

if __name__ == "__main__":
    exit(main())

/**
 * sync-icons.js
 * 使用 Node.js 将 icons/ 目录下的所有图标转为 Base64 Data URI，并自动写入 scripts/mihomo-clash-party.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname);
const ICONS_DIR = path.join(ROOT_DIR, 'icons');
const JS_PATH = path.join(ROOT_DIR, 'scripts', 'mihomo-clash-party.js');

const ICON_MAPPING = {
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
};

function main() {
  if (!fs.existsSync(ICONS_DIR)) {
    console.error(`[错误] 找不到图标目录: ${ICONS_DIR}`);
    process.exit(1);
  }
  if (!fs.existsSync(JS_PATH)) {
    console.error(`[错误] 找不到脚本文件: ${JS_PATH}`);
    process.exit(1);
  }

  console.log('[1/3] 开始读取 icons/ 目录并生成 Base64 内联数据...');

  const lines = [
    '  // ===== 策略组图标 (由 sync-icons.py 自动生成，Base64 纯离线内联) =====',
    '  // 优点：100% 离线可用，零 CDN 缓存延迟，彻底杜绝外链失效。',
    '  var groupIcons = {'
  ];

  const entries = Object.entries(ICON_MAPPING);
  entries.forEach(([groupName, fileName], index) => {
    const filePath = path.join(ICONS_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`  [警告] 缺少图标文件 ${fileName} (策略组: ${groupName})`);
      return;
    }

    const fileBuf = fs.readFileSync(filePath);
    const dataUri = `data:image/png;base64,${fileBuf.toString('base64')}`;
    const comma = index < entries.length - 1 ? ',' : '';
    lines.push(`    "${groupName}": "${dataUri}"${comma}`);
    console.log(`  [OK] ${groupName.padEnd(10, ' ')} -> ${fileName} (${dataUri.length} 字符)`);
  });

  lines.push('  };');
  lines.push('  // ===== 策略组图标生成结束 =====');
  const newIconsBlock = lines.join('\n');

  console.log('[2/3] 正在更新 scripts/mihomo-clash-party.js...');

  let content = fs.readFileSync(JS_PATH, 'utf8');
  const patternNew = /  \/\/ ===== 策略组图标 \(由 sync-icons\.py 自动生成[\s\S]*?  \/\/ ===== 策略组图标生成结束 =====/;
  const patternOld = /  \/\/ ===== 策略组图标 =====[\s\S]*?(?=  for \(var gi = 0; gi < proxyGroups\.length; gi\+\+\) \{)/;

  if (patternNew.test(content)) {
    content = content.replace(patternNew, newIconsBlock);
  } else if (patternOld.test(content)) {
    content = content.replace(patternOld, newIconsBlock + '\n\n');
  } else {
    console.error('[错误] 无法在 scripts/mihomo-clash-party.js 中定位到 groupIcons 区域！');
    process.exit(1);
  }

  fs.writeFileSync(JS_PATH, content, 'utf8');
  console.log(`[3/3] 同步完成！已成功将 ${entries.length} 个策略组图标内嵌到 ${path.basename(JS_PATH)}。\n`);
}

main();

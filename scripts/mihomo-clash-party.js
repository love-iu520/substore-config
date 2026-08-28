function main(config) {
  config = config || {};

  // Mihomo v1.19.29+ 安全版：
  // 对要求“不发送 SNI”的 AnyTLS 节点，分离 SNI 与证书校验域名，
  // 在隐藏 SNI 的同时保留证书校验。
  // 策略优化：显示兜底组；微软、苹果、B站和国内网站直连优先。
  // AI/Google 优化：严格服务分离测试版。仅真正的 Gemini/Antigravity 进入 Gemini；YouTube、Google Drive、普通 Google 分别独立；Google IP 统一回到 Google。
  // V8：AI 与海外服务分组直接展开全部实际节点，便于逐节点 A/B 测试；入口/地区/默认直连组保持精简。
  // V9：为 Sub-Store/Clash Party 远程文件拉取增加 Fake-IP 排除，避免 198.18.x.x:443 超时。
  // V10：Gemini 统一改用 MetaCubeX google-gemini.mrs；Drive 收窄为 3 个明确域名；DNS 增加代理/直连双层冗余。
  // V11：精简低频策略组；Copilot/Perplexity/Grok 并入 AI；保留 Instagram/Pinterest；策略组改为名称 + 彩色图标。
  // V12：地区组改为 香港→美国→日本→新加坡→台湾→其它地区；服务组选项精简；图标切换为 Alpha 透明轻量风。
  // V13：修正 Alpha 白色图标在浅色界面不可见的问题，改为透明底彩色图标。
  // V14：所有策略组图标统一到 Oasisic-Icons 单一来源；Pinterest 使用同源通用搜索图标。
  // 链式代理：住宅 SOCKS 直接显示在 Proxy；仅存在住宅 SOCKS 时显示“机场入口”。
  // 入口只接受名称含 🍃/🌏 + 美国/美國/香港 的普通节点；不再创建“🛬 落地节点”分组。
  // 顺序策略：所有实际节点组均使用显式 proxies 列表，保持 Sub-Store 最终顺序。
  // 空组保护：所有策略组都保证至少一个成员；入口全不可用时也回退到 REJECT。
  // 兜底整理：仅删除实际连接配置完全相同的节点，并处理残余重名与保留名称冲突。
  // 常用服务：增加社交、云盘、办公、游戏和流媒体的独立规则集与策略组。
  // DNS/TUN：关闭 Mihomo IPv6，启用严格路由，并让主 DNS 通过 Proxy 出口。

  // 节点由 Sub-Store 的组合订阅注入到 config.proxies，
  // 因此删除外部 proxy-providers，避免重复加载。
  delete config["proxy-providers"];
  delete config["global-client-fingerprint"];

  // 统一使用 Mihomo 内置 DIRECT。
  var directName = "DIRECT";
  var fallbackGroupName = "兜底策略";
  var proxies = Array.isArray(config.proxies) ? config.proxies : [];

  // 节点名称不能与 Mihomo 内置出站、GLOBAL 或本配置的策略组重名。
  // 若订阅中恰好出现这些名称，后续自动改为“原名-节点”。
  var reservedProxyNames = Object.create(null);
  [
    "DIRECT",
    "REJECT",
    "REJECT-DROP",
    "PASS",
    "PASS-RULE",
    "COMPATIBLE",
    "GLOBAL",
    "Proxy",
    "机场入口",
    "美国",
    "香港",
    "日本",
    "新加坡",
    "台湾",
    "其它地区",
    "AI",
    "OpenAI",
    "Claude",
    "Gemini",
    "Google Drive",
    "YouTube",
    "Google",
    "GitHub",
    "Telegram",
    "Twitter",
    "Discord",
    "Instagram",
    "Pinterest",
    "TikTok",
    "Netflix",
    "Spotify",
    "Global",
    "Microsoft",
    "Apple",
    "Bilibili",
    "国内网站",
    fallbackGroupName
  ].forEach(function (name) {
    reservedProxyNames[name] = true;
  });

  function cloneProxy(proxy) {
    var obj = {};
    for (var key in proxy) {
      if (Object.prototype.hasOwnProperty.call(proxy, key)) {
        obj[key] = proxy[key];
      }
    }
    return obj;
  }

  // ===== 节点兜底整理 =====
  // 这里仅作为组合订阅后的最后兜底：
  // 1. 不主动排序，始终保留 Sub-Store 传入顺序；
  // 2. 实际连接配置完全相同的节点只保留第一次出现的一个；
  // 3. 同名但配置不同的节点保留，并自动追加 -2、-3；
  // 4. 去重时忽略节点名称和 Sub-Store 以“_”开头的内部来源字段。

  function shouldIgnoreFingerprintKey(key) {
    return key === "name" || String(key).charAt(0) === "_";
  }

  function stableStringify(value) {
    if (value === null || typeof value !== "object") {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      var arrayParts = [];
      for (var i = 0; i < value.length; i++) {
        arrayParts.push(stableStringify(value[i]));
      }
      return "[" + arrayParts.join(",") + "]";
    }

    var keys = Object.keys(value).sort();
    var objectParts = [];

    for (var j = 0; j < keys.length; j++) {
      var key = keys[j];
      if (shouldIgnoreFingerprintKey(key)) continue;

      objectParts.push(
        JSON.stringify(key) + ":" + stableStringify(value[key])
      );
    }

    return "{" + objectParts.join(",") + "}";
  }

  var seenProxyFingerprints = Object.create(null);
  var removedDuplicateCount = 0;
  var preparedProxies = [];

  // 机场入口候选节点筛选规则：只接受指定 emoji + 美国/美國/香港。
  // 例如：🍃美国、🌏美国、🍃美國、🌏美國、🍃香港、🌏香港。
  // 普通“美国高速”“香港高速”、US/USA/HK、州名/城市名等不会进入。
  var entryIncludeRegex = /(?:🍃|🌏)(?:美国|美國|香港)/;
  var hasResidentialSocksNode = false;

  for (var i = 0; i < proxies.length; i++) {
    var p = proxies[i];
    if (!p || typeof p !== "object" || !p.name) continue;

    var item = cloneProxy(p);
    var originalName = String(item.name);
    var proxyType = String(item.type || "").toLowerCase();

    // Sub-Store 会将部分 AnyTLS 节点的“不发送 SNI”转换为：
    // sni: 127.0.0.1 + disable-sni: true。
    // Mihomo AnyTLS 不读取 disable-sni；v1.19.29+ 可使用
    // name-cert-verify 单独指定证书校验域名。
    if (proxyType === "anytls") {
      var disableSniValue = item["disable-sni"];
      var disableSni =
        disableSniValue === true ||
        disableSniValue === 1 ||
        String(disableSniValue).toLowerCase() === "true" ||
        String(disableSniValue) === "1";
      var usesNoSniSentinel = String(item.sni || "").trim() === "127.0.0.1";
      var needsNoSniCompatibility = disableSni || usesNoSniSentinel;

      delete item["disable-sni"];

      if (needsNoSniCompatibility) {
        item.sni = "127.0.0.1";
        if (!item["name-cert-verify"] && item.server) {
          item["name-cert-verify"] = String(item.server);
        }
      }
    }

    // 订阅中的 direct 节点不保留，统一使用 Mihomo 内置 DIRECT。
    if (proxyType === "direct") continue;

    // 仅为适用且未设置指纹的节点补充 Chrome 指纹。
    var supportsClientFingerprint =
      proxyType === "vmess" ||
      proxyType === "vless" ||
      proxyType === "trojan";

    if (supportsClientFingerprint && !item["client-fingerprint"]) {
      item["client-fingerprint"] = "chrome";
    }

    // 名称含“住宅”且类型为 SOCKS/SOCKS5 的节点作为最终出口，
    // 通过“机场入口”建立第一跳。
    var isResidential = originalName.indexOf("住宅") !== -1;
    var isSocks = proxyType === "socks5" || proxyType === "socks";

    if (isResidential && isSocks) {
      hasResidentialSocksNode = true;
      item["dialer-proxy"] = "机场入口";
    }

    // 精确兜底去重：忽略 name 和 Sub-Store 内部字段，其余配置必须完全相同。
    var proxyFingerprint = stableStringify(item);
    if (Object.prototype.hasOwnProperty.call(seenProxyFingerprints, proxyFingerprint)) {
      removedDuplicateCount += 1;
      continue;
    }
    seenProxyFingerprints[proxyFingerprint] = true;

    var baseName = originalName;
    if (baseName === "直连") baseName = "直连-节点";
    if (reservedProxyNames[baseName]) baseName = baseName + "-节点";

    preparedProxies.push({
      item: item,
      baseName: baseName,
      isResidential: isResidential
    });
  }

  // 预留所有原始名称，避免重命名时占用后面本来就存在的“名称-2”。
  var reservedOriginalNames = Object.create(null);
  for (var r = 0; r < preparedProxies.length; r++) {
    reservedOriginalNames[preparedProxies[r].baseName] = true;
  }

  var usedFinalNames = Object.create(null);
  var nameCounters = Object.create(null);
  var renamedNodeCount = 0;
  var cleanedProxies = [];
  var entryNodeNames = [];

  function getUniqueName(baseName) {
    if (!usedFinalNames[baseName] && !reservedProxyNames[baseName]) {
      usedFinalNames[baseName] = true;
      nameCounters[baseName] = 1;
      return baseName;
    }

    var count = (nameCounters[baseName] || 1) + 1;
    var candidate = baseName + "-" + count;

    while (
      usedFinalNames[candidate] ||
      reservedOriginalNames[candidate] ||
      reservedProxyNames[candidate]
    ) {
      count += 1;
      candidate = baseName + "-" + count;
    }

    nameCounters[baseName] = count;
    usedFinalNames[candidate] = true;
    return candidate;
  }

  for (var n = 0; n < preparedProxies.length; n++) {
    var prepared = preparedProxies[n];
    var finalName = getUniqueName(prepared.baseName);

    if (finalName !== prepared.baseName) renamedNodeCount += 1;
    prepared.item.name = finalName;

    // 机场入口只包含名称明确带“美国”“美國”或“香港”的普通节点。
    if (!prepared.isResidential && entryIncludeRegex.test(finalName)) {
      entryNodeNames.push(finalName);
    }

    cleanedProxies.push(prepared.item);
  }

  config.proxies = cleanedProxies;

  // 这些列表全部按 cleanedProxies 的顺序生成，因此保持 Sub-Store 最终顺序。
  var allProxyNames = [];
  var usProxyNames = [];
  var hkProxyNames = [];
  var jpProxyNames = [];
  var sgProxyNames = [];
  var twProxyNames = [];
  var otherProxyNames = [];

  var usRegionRegex = /(美国|美國|美西|美东|美東|波特兰|波特蘭|达拉斯|達拉斯|俄勒冈|俄勒岡|凤凰城|鳳凰城|费利蒙|費利蒙|硅谷|矽谷|拉斯维加斯|拉斯維加斯|洛杉矶|洛杉磯|圣何塞|聖荷西|圣克拉拉|聖克拉拉|西雅图|西雅圖|芝加哥|纽约|紐約|华盛顿|華盛頓|弗吉尼亚|維吉尼亞|亚特兰大|亞特蘭大|迈阿密|邁阿密|丹佛|United[ _-]*States|(^|[^A-Za-z])(US|USA)([^A-Za-z]|$))/i;
  var hkRegionRegex = /(香港|港|Hong[ _-]*Kong|HongKong|(^|[^A-Za-z])HK([^A-Za-z]|$))/i;
  var jpRegionRegex = /(日本|川日|东京|東京|大阪|泉日|埼玉|沪日|深日|Japan|(^|[^A-Za-z])JP([^A-Za-z]|$))/i;
  var sgRegionRegex = /(新加坡|坡|狮城|獅城|Singapore|(^|[^A-Za-z])SG([^A-Za-z]|$))/i;
  var twRegionRegex = /(台湾|臺灣|台灣|Taiwan|(^|[^A-Za-z])TW([^A-Za-z]|$))/i;

  for (var q = 0; q < cleanedProxies.length; q++) {
    var proxyName = String(cleanedProxies[q].name);
    allProxyNames.push(proxyName);

    var isUS = usRegionRegex.test(proxyName);
    var isHK = hkRegionRegex.test(proxyName);
    var isJP = jpRegionRegex.test(proxyName);
    var isSG = sgRegionRegex.test(proxyName);
    var isTW = twRegionRegex.test(proxyName);

    if (isUS) usProxyNames.push(proxyName);
    if (isHK) hkProxyNames.push(proxyName);
    if (isJP) jpProxyNames.push(proxyName);
    if (isSG) sgProxyNames.push(proxyName);
    if (isTW) twProxyNames.push(proxyName);

    if (!isUS && !isHK && !isJP && !isSG && !isTW) {
      otherProxyNames.push(proxyName);
    }
  }

  if (
    typeof console !== "undefined" &&
    console &&
    typeof console.log === "function"
  ) {
    console.log(
      "[Mihomo 配置] 保持 Sub-Store 节点顺序；兜底删除重复节点 " +
        removedDuplicateCount +
        " 个，重命名同名异配置节点 " +
        renamedNodeCount +
        " 个。"
    );
  }

  // 地区策略列表。国外服务默认先进入 Proxy。
  function regionProxyList(includeDirect) {
    var list = ["Proxy"]
      .concat([
        "美国",
        "香港",
        "日本",
        "新加坡",
        "台湾",
        "其它地区"
      ]);

    if (includeDirect) {
      list.push(directName);
    }

    return list;
  }

  // AI 子服务：
  // AI → Proxy → 美国 → 全部实际节点。
  // 平时可统一跟随 AI；测试时也能直接点任意单节点。
  function aiServiceProxyList() {
    return ["AI", "Proxy", "美国"].concat(allProxyNames);
  }

  // 普通海外服务：
  // Proxy → 美国 → 全部实际节点。
  // 不再重复放香港/日本/新加坡/台湾等二级地区入口，缩短列表。
  function foreignServiceProxyList() {
    return ["Proxy", "美国"].concat(allProxyNames);
  }

  // 默认直连类服务：
  // DIRECT → Proxy → 美国。
  // 不展开全部节点，保持界面简洁。
  function domesticServiceProxyList() {
    return [directName, "Proxy", "美国"];
  }

  // Mihomo 的策略组必须至少包含一个 proxies 成员，或提供 use。
  // Sub-Store/覆写序列化时，空数组可能被省略，最终触发：
  // “use or proxies missing”。因此所有空列表都显式使用 REJECT 占位，
  // 保证配置可加载，同时避免空组意外回退到 DIRECT。
  function safeProxyList(proxyList, fallbackProxy) {
    var list = Array.isArray(proxyList) ? proxyList.slice() : [];
    if (list.length === 0) {
      list.push(fallbackProxy || "REJECT");
    }
    return list;
  }

  function createSelectGroup(name, proxyList) {
    return {
      name: name,
      type: "select",
      proxies: safeProxyList(proxyList, "REJECT")
    };
  }

  config["mixed-port"] = 7890;
  config.ipv6 = false;
  config["allow-lan"] = false;
  config["unified-delay"] = false;
  config["tcp-concurrent"] = true;
  config["external-controller"] = "127.0.0.1:9090";
  config["external-ui"] = "ui";
  config["external-ui-url"] =
    "https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip";

  config["find-process-mode"] = "strict";

  config.profile = {
    "store-selected": true,
    "store-fake-ip": true
  };

  config.sniffer = {
    enable: true,
    sniff: {
      HTTP: {
        ports: [80, "8080-8880"],
        "override-destination": true
      },
      TLS: {
        ports: [443, 8443]
      },
      QUIC: {
        ports: [443, 8443]
      }
    },
    "skip-domain": [
      "Mijia Cloud",
      "+.push.apple.com"
    ]
  };

  config.tun = {
    enable: true,
    stack: "mixed",
    "dns-hijack": [
      "any:53",
      "tcp://any:53"
    ],
    "auto-route": true,
    "auto-detect-interface": true,
    "strict-route": true
  };

  config.dns = {
    enable: true,
    ipv6: false,
    "enhanced-mode": "fake-ip",
    "fake-ip-range": "198.18.0.1/16",
    "fake-ip-filter-mode": "blacklist",
    "fake-ip-filter": [
      // 局域网 / 本地域名保持真实解析。
      "+.lan",
      "+.local",
      "+.market.xiaomi.com",

      // Sub-Store / 远程脚本兼容：
      // 这些地址常由 Sub-Store、Clash Party 或 Mihomo 自身直接拉取。
      // 若返回 198.18.x.x Fake-IP，而拉取进程没有经过当前 TUN，
      // 会出现 connect ETIMEDOUT 198.18.x.x:443。
      "sub-store.vercel.app",
      "raw.githubusercontent.com",
      "gist.githubusercontent.com",
      "objects.githubusercontent.com",
      "github-releases.githubusercontent.com",
      "codeload.github.com",
      "api.github.com",
      "cdn.jsdelivr.net",
      "fastly.jsdelivr.net"

      // 如果你使用自建 Sub-Store 域名，例如 sub.example.com，
      // 请在这里额外加入：
      // "sub.example.com"
      // 或需要排除整个子域时：
      // "+.example.com"
    ],
    "prefer-h3": false,
    "respect-rules": false,
    "default-nameserver": [
      "tls://223.5.5.5",
      "tls://223.6.6.6"
    ],
    // 节点自身域名解析：使用可直连的国内 DoH，避免节点域名解析形成循环依赖。
    "proxy-server-nameserver": [
      "https://doh.pub/dns-query",
      "https://dns.alidns.com/dns-query"
    ],

    // 默认代理 DNS：两路境外 DoH 都通过 Proxy，避免单点故障。
    nameserver: [
      "https://cloudflare-dns.com/dns-query#Proxy",
      "https://dns.google/dns-query#Proxy"
    ],

    // DIRECT 流量使用独立直连 DNS，不依赖上面的代理 DNS。
    "direct-nameserver": [
      "https://doh.pub/dns-query",
      "https://dns.alidns.com/dns-query"
    ],
    "direct-nameserver-follow-policy": false,

    fallback: []
  };

  var proxyGroups = [];

  // Proxy 使用显式节点列表，不使用 include-all。
  // 因此 Mihomo 不会再按名称重排，显示顺序与 Sub-Store 最终输出顺序一致。
  proxyGroups.push({
    name: "Proxy",
    type: "select",
    proxies: safeProxyList(allProxyNames, "REJECT")
  });

  // 仅当确实存在名称含“住宅”的 SOCKS/SOCKS5 节点时才显示机场入口。
  // 有住宅节点且存在合格入口时：fallback 按 Sub-Store 原顺序选择第一个可用入口。
  // 有住宅节点但没有合格入口时：保留 REJECT 入口，防止住宅节点绕过链式代理直连。
  if (hasResidentialSocksNode) {
    if (entryNodeNames.length > 0) {
      proxyGroups.push({
        name: "机场入口",
        type: "fallback",
        proxies: entryNodeNames.slice(),
        url: "https://www.gstatic.com/generate_204",
        interval: 300,
        timeout: 5000,
        lazy: false,
        "max-failed-times": 2,
        "expected-status": 204,
        "empty-fallback": "REJECT"
      });
    } else {
      proxyGroups.push({
        name: "机场入口",
        type: "select",
        proxies: ["REJECT"]
      });
    }
  }

  // AI 总分流：Copilot / Perplexity / Grok / 其它海外 AI 均并入 AI。
  proxyGroups.push({
    name: "AI",
    type: "select",
    proxies: ["Proxy", "美国"].concat(allProxyNames)
  });

  // 常用 AI 服务继续单独展示。
  proxyGroups.push(createSelectGroup("OpenAI", aiServiceProxyList()));
  proxyGroups.push(createSelectGroup("Claude", aiServiceProxyList()));
  proxyGroups.push(createSelectGroup("Gemini", aiServiceProxyList()));

  // Google 系：Drive 仍保留可见分组，但最终继承 Google 出口。
  proxyGroups.push(createSelectGroup("Google Drive", ["Google"]));
  proxyGroups.push(createSelectGroup("YouTube", foreignServiceProxyList()));
  proxyGroups.push(createSelectGroup("Google", foreignServiceProxyList()));

  // 常用开发 / 通讯 / 社交。
  proxyGroups.push(createSelectGroup("GitHub", foreignServiceProxyList()));
  proxyGroups.push(createSelectGroup("Telegram", foreignServiceProxyList()));
  proxyGroups.push(createSelectGroup("Twitter", foreignServiceProxyList()));
  proxyGroups.push(createSelectGroup("Discord", foreignServiceProxyList()));
  proxyGroups.push(createSelectGroup("Instagram", foreignServiceProxyList()));
  proxyGroups.push(createSelectGroup("Pinterest", foreignServiceProxyList()));
  proxyGroups.push(createSelectGroup("TikTok", foreignServiceProxyList()));

  // 常用流媒体。
  proxyGroups.push(createSelectGroup("Netflix", foreignServiceProxyList()));
  proxyGroups.push(createSelectGroup("Spotify", foreignServiceProxyList()));

  // 其它低频海外服务规则继续存在，但统一进入 Global，不再单独占策略卡片。
  proxyGroups.push(createSelectGroup("Global", foreignServiceProxyList()));

  // Microsoft / Apple / Bilibili / 国内默认直连。
  proxyGroups.push(createSelectGroup("Microsoft", domesticServiceProxyList()));
  proxyGroups.push(createSelectGroup("Apple", domesticServiceProxyList()));
  proxyGroups.push(createSelectGroup("Bilibili", domesticServiceProxyList()));
  proxyGroups.push(createSelectGroup("国内网站", domesticServiceProxyList()));

  // ===== 地区组 =====
  // 固定连续排列：香港 → 美国 → 日本 → 新加坡 → 台湾 → 其它地区。
  proxyGroups.push({
    name: "香港",
    type: "select",
    proxies: safeProxyList(hkProxyNames, "REJECT")
  });

  proxyGroups.push({
    name: "美国",
    type: "select",
    proxies: safeProxyList(usProxyNames, "REJECT")
  });

  proxyGroups.push({
    name: "日本",
    type: "select",
    proxies: safeProxyList(jpProxyNames, "REJECT")
  });

  proxyGroups.push({
    name: "新加坡",
    type: "select",
    proxies: safeProxyList(sgProxyNames, "REJECT")
  });

  proxyGroups.push({
    name: "台湾",
    type: "select",
    proxies: safeProxyList(twProxyNames, "REJECT")
  });

  proxyGroups.push({
    name: "其它地区",
    type: "select",
    proxies: safeProxyList(otherProxyNames, "REJECT")
  });

  // 显式展示最终 MATCH 使用的兜底策略，并放在界面最下面。
  // 默认走 Proxy，也可以在 Clash Party 中手动改成地区组或 DIRECT。
  proxyGroups.push(
    createSelectGroup(fallbackGroupName, foreignServiceProxyList())
  );


  // ===== 策略组图标 =====
  // V14：全部统一使用 Oasisic-Icons 单一来源。
  // 这样品牌、功能、地区图标的路径、风格和维护源统一，减少多仓库失效问题。
  var iconBase =
    "https://cdn.jsdelivr.net/gh/Hawaiine/Oasisic-Icons@main/icons/";

  var groupIcons = {
    // 功能组
    "Proxy": iconBase + "General/Lightning-1.png",
    "机场入口": iconBase + "Proxy/IEPL.png",
    "AI": iconBase + "AI/AI.png",

    // AI
    "OpenAI": iconBase + "AI/OpenAI-1.png",
    "Claude": iconBase + "AI/Anthropic-1.png",
    "Gemini": iconBase + "Google/Gemini.png",

    // Google 系
    "Google Drive": iconBase + "Google/GoogleDrive.png",
    "YouTube": iconBase + "Media/YouTube-1.png",
    "Google": iconBase + "Google/Google-1.png",

    // 开发 / 社交
    "GitHub": iconBase + "Tool/GitHub-1.png",
    "Telegram": iconBase + "Social/Telegram-1.png",
    "Twitter": iconBase + "Social/X-1.png",
    "Discord": iconBase + "Social/Discord-1.png",
    "Instagram": iconBase + "Social/Instagram-1.png",

    // Oasisic 当前没有 Pinterest 专属图标；
    // 使用同仓库的搜索/发现类图标，避免引入第二个图标源。
    "Pinterest": iconBase + "General/Search-1.png",

    "TikTok": iconBase + "Social/TikTok-1.png",

    // 流媒体
    "Netflix": iconBase + "Media/Netflix-1.png",
    "Spotify": iconBase + "Music/Spotify-1.png",

    // 系统 / 国内 / 全局
    "Microsoft": iconBase + "Microsoft/Microsoft-1.png",
    "Apple": iconBase + "Apple/Apple-1.png",
    "Bilibili": iconBase + "Media/Bilibili-1.png",
    "国内网站": iconBase + "Country/China.png",
    "Global": iconBase + "General/Global-1.png",

    // 地区
    "香港": iconBase + "Country/HongKong.png",
    "美国": iconBase + "Country/US.png",
    "日本": iconBase + "Country/Japan.png",
    "新加坡": iconBase + "Country/Singapore.png",
    "台湾": iconBase + "Country/CN-Taiwan.png",
    "其它地区": iconBase + "General/Area.png",

    // 兜底
    "兜底策略": iconBase + "General/Traffic-1.png"
  };

  for (var gi = 0; gi < proxyGroups.length; gi++) {
    var currentGroup = proxyGroups[gi];
    if (currentGroup && groupIcons[currentGroup.name]) {
      currentGroup.icon = groupIcons[currentGroup.name];
    }
  }

  config["proxy-groups"] = proxyGroups;

  config.rules = [
    // 局域网和私有地址始终直连。
    "RULE-SET,private_ip,DIRECT,no-resolve",

    // ===== AI：具体服务必须放在“其它 AI”和 Google/Microsoft/Twitter 大规则之前 =====
    // OpenAI / ChatGPT / Codex
    "RULE-SET,openai_domain,OpenAI",

    // Claude / Anthropic：远程规则集 + 本地补充，避免上游尚未收录的新域名漏分。
    "RULE-SET,claude_domain,Claude",
    "DOMAIN-SUFFIX,claude.ai,Claude",
    "DOMAIN-SUFFIX,claude.com,Claude",
    "DOMAIN-SUFFIX,clau.de,Claude",
    "DOMAIN-SUFFIX,anthropic.com,Claude",
    "DOMAIN-SUFFIX,anthropicusercontent.com,Claude",
    "DOMAIN-SUFFIX,claudeusercontent.com,Claude",
    "DOMAIN-SUFFIX,claudemcpcontent.com,Claude",
    "DOMAIN-SUFFIX,claudemcpclient.com,Claude",
    "DOMAIN,servd-anthropic-website.b-cdn.net,Claude",

    // Gemini / Google AI / Antigravity：
    // 统一使用 MetaCubeX google-gemini.mrs。
    // 当前上游已覆盖 Gemini、AI Studio、Gemini API、Code Assist、Antigravity 等核心域名。
    "RULE-SET,google_gemini_domain,Gemini",

    // 仅保留目前已确认仍未进入 google-gemini 上游的少量补充。
    // Android Gemini 客户端。
    "DOMAIN,optimizationguide-pa.googleapis.com,Gemini",
    // iOS Gemini 客户端；注意它不是 robinfrontend-pa 的子域，而是以连字符开头的新主机名。
    "DOMAIN,webchannel-robinfrontend-pa.googleapis.com,Gemini",

    // Microsoft Copilot + GitHub Copilot
    "DOMAIN-SUFFIX,copilot.microsoft.com,AI",
    "DOMAIN-SUFFIX,copilot.cloud.microsoft,AI",
    "DOMAIN-SUFFIX,copilot.com,AI",
    "DOMAIN-SUFFIX,copilot-stg.com,AI",
    "DOMAIN-SUFFIX,githubcopilot.com,AI",
    "DOMAIN,copilot-proxy.githubusercontent.com,AI",
    "DOMAIN,copilot-workspace.githubnext.com,AI",
    "DOMAIN,copilotprodattachments.blob.core.windows.net,AI",
    "RULE-SET,copilot_domain,AI",

    // 其它常用 AI 独立组
    "DOMAIN-SUFFIX,perplexity.ai,AI",
    "DOMAIN-SUFFIX,perplexity.com,AI",
    "DOMAIN-SUFFIX,pplx.ai,AI",
    "DOMAIN,pplx-res.cloudinary.com,AI",
    "DOMAIN,ppl-ai-file-upload.s3.amazonaws.com,AI",

    "DOMAIN-SUFFIX,x.ai,AI",
    "DOMAIN-SUFFIX,grok.com,AI",
    "DOMAIN-SUFFIX,grokipedia.com,AI",
    "DOMAIN,grok.x.com,AI",

    "DOMAIN-SUFFIX,deepseek.com,DIRECT",

    // 其它未单独建组的海外 AI（Cursor/Poe/Mistral/Meta AI/Windsurf 等）统一进入 AI分流。
    // 必须位于上面各 AI 独立规则之后，否则会把它们先吃掉。
    "RULE-SET,ai_other_domain,AI",

    // ===== 国外软件和服务 =====
    // Google Drive 只截获明确入口域名；googleusercontent.com、www.googleapis.com 等共享资源回落到 Google。
    "DOMAIN,drive.google.com,Google Drive",
    "DOMAIN,docs.google.com,Google Drive",
    "DOMAIN-SUFFIX,googledrive.com,Google Drive",

    // YouTube 仍必须位于 Google 大规则之前。
    "RULE-SET,youtube_domain,YouTube",
    "RULE-SET,onedrive_domain,Microsoft",
    "RULE-SET,teams_domain,Microsoft",

    // 社交 / 通讯 / 社区。Instagram、WhatsApp 放在 Facebook 大规则之前。
    "RULE-SET,whatsapp_domain,Global",
    "RULE-SET,instagram_domain,Instagram",
    "RULE-SET,facebook_domain,Global",
    "RULE-SET,reddit_domain,Global",
    "RULE-SET,twitch_domain,Global",
    "RULE-SET,slack_domain,Global",
    "RULE-SET,notion_domain,Global",
    "RULE-SET,dropbox_domain,Global",

    // 游戏与流媒体。
    "RULE-SET,steam_domain,DIRECT",
    "RULE-SET,epic_domain,DIRECT",
    "RULE-SET,disney_domain,Global",
    "RULE-SET,primevideo_domain,Global",

    // GitHub：显式覆盖网页、资源域名和 SSH-over-443 主机，再进入完整 GitHub 规则集。
    "DOMAIN,ssh.github.com,GitHub",
    "DOMAIN-SUFFIX,github.com,GitHub",
    "DOMAIN-SUFFIX,githubusercontent.com,GitHub",

    // 其它已有服务规则。
    "RULE-SET,github_domain,GitHub",
    // 普通 Google 域名独立进入 Google。
    // Gemini/Antigravity、Drive 明确入口域名、YouTube 已由更靠前规则截获。
    "RULE-SET,google_domain,Google",
    "RULE-SET,apple_domain,Apple",
    "RULE-SET,microsoft_domain,Microsoft",
    "RULE-SET,telegram_domain,Telegram",
    "RULE-SET,twitter_domain,Twitter",
    "RULE-SET,discord_domain,Discord",
    "RULE-SET,pinterest_domain,Pinterest",

    // Behance 主站、图片和项目资源均位于 behance.net 子域。
    "DOMAIN-SUFFIX,behance.net,Global",
    "DOMAIN-SUFFIX,behance.com,Global",

    "RULE-SET,tiktok_domain,TikTok",
    "RULE-SET,netflix_domain,Netflix",
    "RULE-SET,spotify_domain,Spotify",
    "RULE-SET,bahamut_domain,Global",

    // 国内软件。
    "RULE-SET,bilibili_domain,Bilibili",

    // 国内域名默认 DIRECT；国外域名默认 Proxy。
    "RULE-SET,cn_domain,国内网站",
    "RULE-SET,geolocation-!cn,Global",

    // IP 规则。
    // Google IP 兜底统一回到 Google。
    // 用于测试真正的 Gemini/Antigravity 触发边界，避免其它 Google/YouTube 流量误入 AI 节点。
    "RULE-SET,google_ip,Google",
    "RULE-SET,netflix_ip,Netflix",
    "RULE-SET,telegram_ip,Telegram",
    "RULE-SET,twitter_ip,Twitter",
    "RULE-SET,cn_ip,国内网站",

    // 其余未匹配流量进入可见的兜底策略组，默认走 Proxy。
    "MATCH," + fallbackGroupName
  ];

  function domainProvider(url) {
    return {
      type: "http",
      interval: 86400,
      behavior: "domain",
      format: "mrs",
      url: url
    };
  }

  function ipProvider(url) {
    return {
      type: "http",
      interval: 86400,
      behavior: "ipcidr",
      format: "mrs",
      url: url
    };
  }

  function classicalProvider(url) {
    return {
      type: "http",
      interval: 86400,
      behavior: "classical",
      format: "yaml",
      url: url
    };
  }

  config["rule-providers"] = {
    openai_domain: domainProvider(
      "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/openai.mrs"
    ),

    claude_domain: classicalProvider(
      "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Claude/Claude.yaml"
    ),

    // Gemini / Google AI / Code Assist / Antigravity 统一规则源。
    google_gemini_domain: domainProvider(
      "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/google-gemini.mrs"
    ),

    // 海外 AI 总兜底：覆盖 Cursor、Poe、Mistral、Meta AI、Windsurf、Grok、Perplexity 等。
    // 具体服务已有更靠前的规则时，会优先进入各自独立策略组。
    ai_other_domain: domainProvider(
      "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-ai-!cn.mrs"
    ),

    copilot_domain: classicalProvider(
      "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Copilot/Copilot.yaml"
    ),

    onedrive_domain: classicalProvider(
      "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/OneDrive/OneDrive.yaml"
    ),

    teams_domain: classicalProvider(
      "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Teams/Teams.yaml"
    ),

    whatsapp_domain: classicalProvider(
      "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Whatsapp/Whatsapp.yaml"
    ),

    instagram_domain: classicalProvider(
      "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Instagram/Instagram.yaml"
    ),

    facebook_domain: classicalProvider(
      "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Facebook/Facebook.yaml"
    ),

    reddit_domain: classicalProvider(
      "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Reddit/Reddit.yaml"
    ),

    twitch_domain: classicalProvider(
      "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Twitch/Twitch.yaml"
    ),

    slack_domain: classicalProvider(
      "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Slack/Slack.yaml"
    ),

    notion_domain: classicalProvider(
      "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Notion/Notion.yaml"
    ),

    dropbox_domain: classicalProvider(
      "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Dropbox/Dropbox.yaml"
    ),

    steam_domain: classicalProvider(
      "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Steam/Steam.yaml"
    ),

    epic_domain: classicalProvider(
      "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Epic/Epic.yaml"
    ),

    disney_domain: classicalProvider(
      "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Disney/Disney.yaml"
    ),

    primevideo_domain: classicalProvider(
      "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/AmazonPrimeVideo/AmazonPrimeVideo.yaml"
    ),

    github_domain: domainProvider(
      "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/github.mrs"
    ),

    google_domain: domainProvider(
      "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/google.mrs"
    ),

    apple_domain: domainProvider(
      "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/apple.mrs"
    ),

    microsoft_domain: domainProvider(
      "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/microsoft.mrs"
    ),

    telegram_domain: domainProvider(
      "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/telegram.mrs"
    ),

    twitter_domain: domainProvider(
      "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/twitter.mrs"
    ),

    discord_domain: classicalProvider(
      "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Discord/Discord.yaml"
    ),

    pinterest_domain: classicalProvider(
      "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Pinterest/Pinterest.yaml"
    ),

    tiktok_domain: domainProvider(
      "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/tiktok.mrs"
    ),

    youtube_domain: domainProvider(
      "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/youtube.mrs"
    ),

    netflix_domain: domainProvider(
      "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/netflix.mrs"
    ),

    spotify_domain: domainProvider(
      "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/spotify.mrs"
    ),

    bilibili_domain: domainProvider(
      "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/bilibili.mrs"
    ),

    bahamut_domain: domainProvider(
      "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/bahamut.mrs"
    ),

    cn_domain: domainProvider(
      "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/cn.mrs"
    ),

    "geolocation-!cn": domainProvider(
      "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/geolocation-!cn.mrs"
    ),

    private_ip: ipProvider(
      "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/private.mrs"
    ),

    cn_ip: ipProvider(
      "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/cn.mrs"
    ),

    google_ip: ipProvider(
      "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/google.mrs"
    ),

    netflix_ip: ipProvider(
      "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/netflix.mrs"
    ),

    twitter_ip: ipProvider(
      "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/twitter.mrs"
    ),

    telegram_ip: ipProvider(
      "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/telegram.mrs"
    )
  };

  return config;
}
